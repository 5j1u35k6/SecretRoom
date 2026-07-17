/* SecretRoom Firebase custom authentication for the admin portal. */
;(() => {
  let sdkPromise = null;
  const capturedHandlers = new WeakMap();

  function backendUrl() {
    const value = String(
      window.SecretRoomBackendConfig?.backendUrl ||
      localStorage.getItem('sr_backend_url') ||
      ''
    ).replace(/\/+$/, '');
    if (!value) throw new Error('尚未在 sr_backend_config.js 設定 Cloudflare Worker URL');
    return value;
  }

  async function sdk() {
    if (sdkPromise) return sdkPromise;
    sdkPromise = Promise.all([
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js')
    ]).then(([appMod, authMod]) => {
      const app = appMod.getApps()[0];
      if (!app) throw new Error('Firebase 尚未初始化');
      return { auth: authMod.getAuth(app), signInWithCustomToken: authMod.signInWithCustomToken };
    });
    return sdkPromise;
  }

  async function authenticate(adminId, password) {
    const response = await fetch(`${backendUrl()}/api/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId, password }),
      cache: 'no-store'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || `管理員驗證失敗：${response.status}`);
    const { auth, signInWithCustomToken } = await sdk();
    await signInWithCustomToken(auth, data.customToken);
    return data;
  }

  function showError(message) {
    const box = document.getElementById('admin-login-error');
    if (box) {
      box.textContent = message;
      box.classList.remove('hidden');
    }
    window.showToast?.(message, 'error');
  }

  function install() {
    const button = document.getElementById('admin-login-submit');
    if (!button || button.dataset.srSecureAdmin === '1' || typeof button.onclick !== 'function') return;
    button.dataset.srSecureAdmin = '1';
    capturedHandlers.set(button, button.onclick);

    document.addEventListener('click', async event => {
      const hit = event.target?.closest?.('#admin-login-submit');
      if (hit !== button) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const adminId = document.getElementById('admin-login-id')?.value?.trim() || '';
      const password = document.getElementById('admin-login-password')?.value || '';
      if (!adminId || !password) return showError('請輸入管理員帳號與密碼');

      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = '安全驗證中…';
      try {
        await authenticate(adminId, password);
        const original = capturedHandlers.get(button);
        await original?.call(button, event);
      } catch (error) {
        console.error('Secure admin login failed', error);
        const configured = String(window.SecretRoomBackendConfig?.backendUrl || localStorage.getItem('sr_backend_url') || '').trim();
        if (!configured && window.SecretRoomBackendConfig?.strictAuth !== true) {
          const original = capturedHandlers.get(button);
          await original?.call(button, event);
        } else {
          showError(error.message || String(error));
        }
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    }, true);
  }

  const observer = new MutationObserver(install);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', install, { once: true });
  install();

  window.SRSecureAdminAuth = Object.freeze({ backendUrl, authenticate });
})();
