/* SecretRoom Firebase custom-auth migration.
 * The secure overrides are installed only after a Cloudflare backend URL has
 * been configured. Until then the existing production login and registration
 * remain untouched.
 */
;(() => {
  const cfg = () => window.SecretRoomBackendConfig || {};
  let sdkPromise = null;
  const originalLoginHandlers = new WeakMap();
  const boundForms = new WeakSet();

  function configuredBackendUrl() {
    return String(
      cfg().backendUrl ||
      localStorage.getItem('sr_backend_url') ||
      ''
    ).replace(/\/+$/, '');
  }

  function migrationEnabled() {
    return Boolean(configuredBackendUrl()) || cfg().strictAuth === true;
  }

  function backendUrl() {
    const value = configuredBackendUrl();
    if (!value) throw new Error('尚未設定 SecretRoom 後端網址。請先在 sr_backend_config.js 填入 Cloudflare Worker URL。');
    return value;
  }

  async function authSdk() {
    if (sdkPromise) return sdkPromise;
    sdkPromise = Promise.all([
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js')
    ]).then(([appMod, authMod]) => {
      const app = appMod.getApps()[0];
      if (!app) throw new Error('Firebase 尚未初始化');
      return {
        auth: authMod.getAuth(app),
        signInWithCustomToken: authMod.signInWithCustomToken
      };
    });
    return sdkPromise;
  }

  async function api(path, body, token = '') {
    const response = await fetch(`${backendUrl()}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body || {}),
      cache: 'no-store'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || `後端錯誤：${response.status}`);
    return data;
  }

  async function signIn(customToken) {
    const { auth, signInWithCustomToken } = await authSdk();
    const credential = await signInWithCustomToken(auth, customToken);
    return credential.user;
  }

  function showError(message) {
    window.showToast?.(message, 'error');
    const box = document.getElementById('login-error-box');
    if (box) {
      box.textContent = message;
      box.classList.remove('hidden');
    }
  }

  function setBusy(button, busy, text = '驗證中...') {
    if (!button) return;
    if (busy) {
      button.dataset.srOriginalText = button.innerHTML;
      button.disabled = true;
      button.classList.add('opacity-60', 'cursor-not-allowed');
      button.innerHTML = text;
    } else {
      button.disabled = false;
      button.classList.remove('opacity-60', 'cursor-not-allowed');
      if (button.dataset.srOriginalText) button.innerHTML = button.dataset.srOriginalText;
    }
  }

  async function forcePasswordChange(loginResult, user) {
    if (!loginResult.mustChangePassword) return;
    let first = '';
    let second = '';
    while (true) {
      first = prompt('你目前使用的是臨時密碼。請設定新的 SecretRoom 密碼：') || '';
      if (!first) throw new Error('必須先設定新密碼才能進入平台');
      second = prompt('請再次輸入新密碼：') || '';
      if (first === second) break;
      alert('兩次輸入的密碼不同，請重新操作。');
    }
    const idToken = await user.getIdToken();
    const changed = await api('/api/member/change-password', { newPassword: first }, idToken);
    await signIn(changed.customToken);
    window.showToast?.('新密碼設定完成', 'success');
  }

  async function secureLogin() {
    const username = document.getElementById('login-username')?.value?.trim() || '';
    const password = document.getElementById('login-password')?.value || '';
    const button = document.getElementById('btn-login-submit');
    if (!username || !password) return showError('請填寫完整登入資訊！');

    setBusy(button, true);
    try {
      const result = await api('/api/auth/member-login', { userId: username, password });
      const user = await signIn(result.customToken);
      await forcePasswordChange(result, user);
      localStorage.setItem('sr_username', result.userId);
      window.showToast?.('安全登入成功，正在載入俱樂部…', 'success');
      location.reload();
    } catch (error) {
      console.error('Secure login failed', error);
      if (!cfg().strictAuth && originalLoginHandlers.has(button)) {
        return originalLoginHandlers.get(button)?.();
      }
      showError(error.message || String(error));
    } finally {
      setBusy(button, false);
    }
  }

  async function secureRegister(form) {
    const button = document.getElementById('apply-submit');
    const avatar = document.getElementById('avatar-preview')?.src || '';
    const kinks = [...document.querySelectorAll('input[name="reg-kink"]:checked')].map(input => input.value);
    const payload = {
      userId: document.getElementById('reg-username')?.value?.trim(),
      password: document.getElementById('reg-password')?.value || '',
      email: document.getElementById('reg-email')?.value?.trim() || '',
      nickname: document.getElementById('reg-nickname')?.value?.trim() || '',
      birthYear: document.getElementById('reg-year')?.value || '',
      birthMonth: document.getElementById('reg-month')?.value || '',
      birthDay: document.getElementById('reg-day')?.value || '',
      height: document.getElementById('reg-height')?.value || '',
      weight: document.getElementById('reg-weight')?.value || '',
      length: document.getElementById('reg-length')?.value || '',
      girth: document.getElementById('reg-girth')?.value || '',
      kinks,
      avatar: avatar.startsWith('data:image/') ? avatar : ''
    };
    setBusy(button, true, '建立安全帳號中…');
    try {
      const result = await api('/api/auth/register', payload);
      await signIn(result.customToken);
      localStorage.setItem('sr_username', result.userId);
      window.showToast?.('申請資料提交成功！請靜待審核。', 'success');
      location.reload();
    } catch (error) {
      window.showToast?.(error.message || String(error), 'error');
    } finally {
      setBusy(button, false);
    }
  }

  function installLoginOverride() {
    if (!migrationEnabled()) return;
    const button = document.getElementById('btn-login-submit');
    if (!button || button.dataset.srSecureAuth === '1') return;
    button.dataset.srSecureAuth = '1';
    originalLoginHandlers.set(button, window.__srHandleLoginSubmit || button.onclick);
    window.__srHandleLoginSubmit = secureLogin;
    button.onclick = secureLogin;
  }

  function installRegisterOverride() {
    if (!migrationEnabled()) return;
    const form = document.getElementById('apply-form');
    if (!form || boundForms.has(form)) return;
    boundForms.add(form);
    const email = document.getElementById('reg-email');
    if (email) {
      email.required = false;
      email.placeholder = '選填；外部通知將以 Telegram 為主';
      const label = email.closest('div')?.querySelector('label');
      if (label) label.innerHTML = '備用聯絡信箱 <span class="text-slate-500 font-normal">(選填)</span>';
      const note = email.closest('div')?.querySelector('p');
      if (note) note.textContent = '外部通知與忘記密碼已改由 Telegram；信箱僅作備用聯絡。';
    }
    form.addEventListener('submit', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      secureRegister(form);
    }, true);
    const button = document.getElementById('apply-submit');
    if (button) button.onclick = event => {
      event.preventDefault();
      secureRegister(form);
    };
  }

  function installForgotPasswordOverride() {
    if (!migrationEnabled()) return;
    const button = document.getElementById('btn-forgot-password');
    if (!button || button.dataset.srSecureReset === '1') return;
    button.dataset.srSecureReset = '1';
    button.onclick = async event => {
      event?.preventDefault?.();
      const current = document.getElementById('login-username')?.value?.trim() || '';
      const userId = prompt('請輸入要申請忘記密碼的 SecretRoom 帳號：', current) || '';
      if (!userId.trim()) return;
      try {
        await api('/api/auth/request-password-reset', { userId: userId.trim() });
        alert('申請已建立。請開啟 SecretRoom Telegram Bot，點選「忘記密碼」完成驗證。');
        window.open('https://t.me/SecretRoomtwBot', '_blank', 'noopener');
      } catch (error) {
        showError(error.message || String(error));
      }
    };
  }

  function apply() {
    installLoginOverride();
    installRegisterOverride();
    installForgotPasswordOverride();
  }

  new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', apply, { once: true });
  apply();

  window.SRSecureAuth = Object.freeze({ api, signIn, backendUrl, migrationEnabled });
})();
