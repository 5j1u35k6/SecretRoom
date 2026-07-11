// SecretRoom password and account-recovery helpers.
(() => {
  const VERSION = '20260711-phase1-auth-v1';
  const APP_ID = 'secretg-production-node-tw';
  const LAST_LOGIN_KEY = 'sr_last_login_id';
  const RESET_EMAIL_KEY = 'sr_last_reset_email';

  window.SRP = window.SRP || { app: APP_ID, db: null, fs: null };
  SRP.app = APP_ID;

  SRP.tools = async () => {
    if (SRP.db && SRP.fs) return SRP;
    const appMod = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js');
    const firestoreMod = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
    const app = appMod.getApps()[0];
    if (!app) throw new Error('Firebase 尚未初始化');
    SRP.db = firestoreMod.getFirestore(app);
    SRP.fs = firestoreMod;
    return SRP;
  };

  SRP.valid = password => String(password || '').length >= 8 && /[A-Z]/.test(password || '') && /[!@#$%^&*(),.?":{}|<>]/.test(password || '');
  SRP.need = user => !!(user && (user.mustChangePassword || user.forcePasswordChange || user.tempPasswordActive || user.passwordChangeRequired));
  SRP.toast = (message, type = 'info') => window.showToast ? window.showToast(message, type) : console.log(message);

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function setButtonBusy(button, busy, busyText = '處理中...') {
    if (!button) return;
    if (busy) {
      if (!button.dataset.srOriginalText) button.dataset.srOriginalText = button.innerHTML;
      button.disabled = true;
      button.classList.add('opacity-60', 'cursor-not-allowed');
      button.textContent = busyText;
    } else {
      button.disabled = false;
      button.classList.remove('opacity-60', 'cursor-not-allowed');
      button.innerHTML = button.dataset.srOriginalText || '登入';
    }
  }

  function showLoginError(message) {
    const box = document.getElementById('login-error-box');
    if (box) {
      box.textContent = message;
      box.classList.remove('hidden');
    }
    SRP.toast(message, 'error');
  }

  function clearLoginError() {
    const box = document.getElementById('login-error-box');
    if (box) {
      box.textContent = '';
      box.classList.add('hidden');
    }
  }

  window.SRP.sendMail = async (user, id, message) => {
    if (!window.emailjs || !user?.email) return;
    try {
      await emailjs.send('service_1ou10mi', 'template_sr_security', {
        to_email: user.email,
        to_name: user.nickname || id,
        status_text: 'SecretRoom 密碼已更新',
        message: message || '你的 SecretRoom 密碼剛剛已更新。不是你本人操作的話，請盡快聯絡管理員。',
        email_type: '帳號安全提醒',
        member_id: id
      }, { publicKey: 'XggJY7iHQcZYYhNY7' });
    } catch (error) {
      console.warn('密碼安全提醒寄送失敗:', error);
    }
  };

  window.SRP_enter = function(id) {
    localStorage.setItem('sr_username', id);
    localStorage.setItem(LAST_LOGIN_KEY, id);
    SRP.toast('登入成功，正在帶你進去。', 'success');
    setTimeout(() => location.reload(), 450);
  };

  function passwordFieldHtml(id, placeholder) {
    return `<div class="relative"><input id="${id}" type="password" class="w-full bg-slate-900 border border-amber-500/10 rounded-xl pl-3.5 pr-11 py-3 text-sm text-white focus:outline-none focus:border-amber-500" placeholder="${placeholder}"><button type="button" data-sr-toggle-password="${id}" class="absolute inset-y-0 right-0 min-w-[44px] flex items-center justify-center text-slate-400 hover:text-amber-300" aria-label="顯示或隱藏密碼"><i class="fa-solid fa-eye-slash text-xs"></i></button></div>`;
  }

  function bindPasswordToggles(root = document) {
    root.querySelectorAll('[data-sr-toggle-password]').forEach(button => {
      if (button.dataset.srBound === '1') return;
      button.dataset.srBound = '1';
      button.onclick = () => {
        const input = document.getElementById(button.dataset.srTogglePassword || '');
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
        const icon = button.querySelector('i');
        if (icon) icon.className = `fa-solid ${input.type === 'password' ? 'fa-eye-slash' : 'fa-eye'} text-xs`;
      };
    });
  }

  window.SRP_force = function(id, user) {
    if (document.getElementById('sr-force-change')) return;
    const modal = document.createElement('div');
    modal.id = 'sr-force-change';
    modal.className = 'fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md';
    modal.innerHTML = `<div class="glass-panel border border-amber-500/25 rounded-3xl p-6 w-[92vw] max-w-sm shadow-2xl relative crystal-border"><div class="text-[10px] text-amber-300 font-black mb-2">最後一步</div><h3 class="text-lg font-black text-white mb-1 font-luxury"><i class="fa-solid fa-key text-amber-500 mr-2"></i>換一組新密碼</h3><p class="text-xs text-slate-400 leading-relaxed mb-5">你現在是用臨時密碼登入，先換成自己的密碼就能繼續。</p><div class="space-y-3">${passwordFieldHtml('sr-new1', '新密碼')}${passwordFieldHtml('sr-new2', '再輸入一次新密碼')}<div class="text-xs text-slate-500 leading-relaxed">至少 8 碼，並包含 1 個大寫英文字母和 1 個特殊符號。</div><button id="sr-save-new" class="w-full min-h-[44px] brushed-gold font-bold text-sm py-3.5 rounded-xl crystal-border hover-breath click-press">換好密碼，繼續登入</button></div></div>`;
    document.body.appendChild(modal);
    bindPasswordToggles(modal);
    document.getElementById('sr-save-new').onclick = async () => {
      const saveButton = document.getElementById('sr-save-new');
      const first = document.getElementById('sr-new1').value;
      const second = document.getElementById('sr-new2').value;
      if (!first || !second) return SRP.toast('請把兩個密碼欄位都填好。', 'error');
      if (first !== second) return SRP.toast('兩次輸入不一樣，再確認一下。', 'error');
      if (first === user.password) return SRP.toast('新密碼不能和臨時密碼一樣。', 'error');
      if (!SRP.valid(first)) return SRP.toast('密碼格式不符：至少 8 碼，並包含 1 個大寫英文字母和 1 個特殊符號。', 'error');
      setButtonBusy(saveButton, true, '正在更新...');
      try {
        const { db, fs } = await SRP.tools();
        const updates = {
          password: first,
          mustChangePassword: false,
          forcePasswordChange: false,
          tempPasswordActive: false,
          passwordChangeRequired: false,
          passwordChangedAt: fs.serverTimestamp(),
          passwordChangedAtMs: Date.now(),
          passwordChangedBy: 'member',
          lastPasswordChangeMethod: 'temporary_login'
        };
        await fs.updateDoc(fs.doc(db, 'secretg_apps', SRP.app, 'applications', id), updates);
        await SRP.sendMail({ ...user, ...updates }, id);
        modal.remove();
        window.SRP_enter(id);
      } catch (error) {
        console.error(error);
        SRP.toast('密碼沒換成功：' + error.message, 'error');
        setButtonBusy(saveButton, false);
      }
    };
  };

  async function SRP_login() {
    const idInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const button = document.getElementById('btn-login-submit');
    const id = idInput?.value.trim() || '';
    const password = passwordInput?.value || '';
    clearLoginError();
    if (!id || !password) return showLoginError('帳號和密碼都要填。');
    if (button?.dataset.srBusy === '1') return;
    if (button) button.dataset.srBusy = '1';
    localStorage.setItem(LAST_LOGIN_KEY, id);
    setButtonBusy(button, true, '登入中...');
    try {
      const { db, fs } = await SRP.tools();
      const snapshot = await fs.getDoc(fs.doc(db, 'secretg_apps', SRP.app, 'applications', id));
      if (!snapshot.exists()) return showLoginError('找不到這個帳號，請先完成申請。');
      const user = snapshot.data() || {};
      const expiresAt = Number(user.tempPasswordExpiresAtMs || user.temporaryCredentialExpiresAtMs || 0);
      if (SRP.need(user) && expiresAt && Date.now() > expiresAt) return showLoginError('這組臨時密碼已過期，請重新申請。');
      if (user.password !== password) return showLoginError('密碼不對，再試一次。');
      if (SRP.need(user)) return window.SRP_force(id, user);
      window.SRP_enter(id);
    } catch (error) {
      console.error(error);
      showLoginError('登入時出了點問題：' + error.message);
    } finally {
      if (button) button.dataset.srBusy = '0';
      if (document.body.contains(button)) setButtonBusy(button, false);
    }
  }

  function renderResetStep(modal, step, content) {
    const steps = modal.querySelectorAll('[data-sr-reset-step]');
    steps.forEach(node => {
      const value = Number(node.dataset.srResetStep || 0);
      node.classList.toggle('sr-reset-step-active', value === step);
      node.classList.toggle('sr-reset-step-done', value < step);
    });
    const body = modal.querySelector('#sr-reset-flow-body');
    if (body) body.innerHTML = content;
  }

  function openLoginFromReset(modal, accountId) {
    modal.remove();
    const existingLogin = document.getElementById('login-username');
    if (existingLogin) {
      existingLogin.value = accountId || existingLogin.value;
      localStorage.setItem(LAST_LOGIN_KEY, existingLogin.value.trim());
      document.getElementById('login-password')?.focus();
      return;
    }
    document.getElementById('btn-goto-login')?.click();
    setTimeout(() => {
      const input = document.getElementById('login-username');
      if (input) input.value = accountId || localStorage.getItem(LAST_LOGIN_KEY) || '';
      document.getElementById('login-password')?.focus();
    }, 80);
  }

  window.SRP_showResetFlow = function(previousModal = null) {
    document.getElementById('sr-reset-flow')?.remove();
    const loginId = document.getElementById('login-username')?.value.trim() || localStorage.getItem(LAST_LOGIN_KEY) || '';
    const savedEmail = localStorage.getItem(RESET_EMAIL_KEY) || '';
    const modal = document.createElement('div');
    modal.id = 'sr-reset-flow';
    modal.className = 'fixed inset-0 z-[125] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md';
    modal.innerHTML = `<div class="glass-panel border border-amber-500/25 rounded-3xl p-5 sm:p-6 w-[94vw] max-w-md shadow-2xl relative crystal-border"><button id="sr-reset-close" type="button" class="absolute top-3 right-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white text-xl" aria-label="關閉忘記密碼流程"><i class="fa-solid fa-xmark"></i></button><h3 class="text-lg font-black text-white font-luxury pr-10"><i class="fa-solid fa-key text-amber-500 mr-2"></i>忘記密碼</h3><p class="text-xs text-slate-400 mt-1">照著三個步驟，就能重新登入。</p><div class="sr-reset-steps grid grid-cols-3 gap-2 my-5"><div data-sr-reset-step="1" class="sr-reset-step sr-reset-step-active"><span>1</span><small>送出申請</small></div><div data-sr-reset-step="2" class="sr-reset-step"><span>2</span><small>收到臨時密碼</small></div><div data-sr-reset-step="3" class="sr-reset-step"><span>3</span><small>登入並換密碼</small></div></div><div id="sr-reset-flow-body"></div></div>`;
    document.body.appendChild(modal);
    document.getElementById('sr-reset-close').onclick = () => modal.remove();
    modal.addEventListener('click', event => { if (event.target === modal) modal.remove(); });

    const stepOne = `<div class="space-y-3"><div><label class="block text-xs font-bold text-slate-300 mb-1.5">帳號</label><input id="sr-reset-id" class="w-full bg-slate-900 border border-amber-500/10 rounded-xl px-3.5 py-3 text-sm text-white focus:outline-none focus:border-amber-500" value="${esc(loginId)}" autocomplete="username"></div><div><label class="block text-xs font-bold text-slate-300 mb-1.5">註冊信箱</label><input id="sr-reset-email" type="email" class="w-full bg-slate-900 border border-amber-500/10 rounded-xl px-3.5 py-3 text-sm text-white focus:outline-none focus:border-amber-500" value="${esc(savedEmail)}" autocomplete="email"></div><p class="text-xs text-slate-500 leading-relaxed">送出後，管理員會寄一組 10 分鐘有效的臨時密碼到你的信箱。</p><button id="sr-reset-submit" class="w-full min-h-[44px] brushed-gold font-bold text-sm py-3.5 rounded-xl crystal-border">送出申請</button></div>`;
    renderResetStep(modal, 1, stepOne);

    document.getElementById('sr-reset-submit').onclick = async () => {
      const button = document.getElementById('sr-reset-submit');
      const userId = document.getElementById('sr-reset-id').value.trim();
      const email = document.getElementById('sr-reset-email').value.trim().toLowerCase();
      if (!userId || !email) return SRP.toast('帳號和註冊信箱都要填。', 'error');
      if (!/^\S+@\S+\.\S+$/.test(email)) return SRP.toast('請確認信箱格式。', 'error');
      localStorage.setItem(LAST_LOGIN_KEY, userId);
      localStorage.setItem(RESET_EMAIL_KEY, email);
      setButtonBusy(button, true, '正在送出...');
      try {
        const { db, fs } = await SRP.tools();
        const userRef = fs.doc(db, 'secretg_apps', SRP.app, 'applications', userId);
        const userSnapshot = await fs.getDoc(userRef);
        if (!userSnapshot.exists()) throw new Error('帳號或註冊信箱不相符。');
        const user = userSnapshot.data() || {};
        const boundEmail = String(user.email || user.boundEmail || user.notificationEmail || '').trim().toLowerCase();
        if (!boundEmail || boundEmail !== email) throw new Error('帳號或註冊信箱不相符。');
        const status = String(user.status || '').toLowerCase();
        if (status && !['approved', 'active'].includes(status)) throw new Error('這個帳號尚未通過審核。');
        const pendingQuery = fs.query(
          fs.collection(db, 'secretg_apps', SRP.app, 'password_reset_requests'),
          fs.where('userId', '==', userId),
          fs.where('status', '==', 'pending')
        );
        const pendingSnapshot = await fs.getDocs(pendingQuery);
        if (pendingSnapshot.empty) {
          const requestRef = fs.doc(fs.collection(db, 'secretg_apps', SRP.app, 'password_reset_requests'));
          await fs.setDoc(requestRef, {
            userId,
            email,
            status: 'pending',
            type: 'forgot_password',
            verifiedMember: true,
            userDisplayName: user.nickname || user.displayName || userId,
            memberStatus: user.status || '',
            createdAt: fs.serverTimestamp(),
            createdAtMs: Date.now(),
            userAgent: navigator.userAgent || ''
          });
        }
        renderResetStep(modal, 2, `<div class="text-center py-2"><div class="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center justify-center mx-auto mb-4"><i class="fa-solid fa-check text-xl"></i></div><h4 class="text-base font-black text-white">申請已送出</h4><p class="text-xs text-slate-400 leading-relaxed mt-2">臨時密碼會寄到 <span class="text-amber-300">${esc(email.replace(/(^.).*(@.*$)/, '$1***$2'))}</span>。收到後，請在 10 分鐘內回來登入。</p><div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-5"><button id="sr-reset-wait" class="min-h-[44px] bg-slate-900 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold">先關閉</button><button id="sr-reset-received" class="min-h-[44px] brushed-gold rounded-xl text-xs font-black crystal-border">我已收到臨時密碼</button></div></div>`);
        document.getElementById('sr-reset-wait').onclick = () => modal.remove();
        document.getElementById('sr-reset-received').onclick = () => {
          renderResetStep(modal, 3, `<div class="text-center py-2"><div class="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center justify-center mx-auto mb-4"><i class="fa-solid fa-right-to-bracket text-xl"></i></div><h4 class="text-base font-black text-white">用臨時密碼登入</h4><p class="text-xs text-slate-400 leading-relaxed mt-2">登入後，系統會請你立刻換成自己的新密碼。</p><button id="sr-reset-back-login" class="w-full min-h-[44px] brushed-gold rounded-xl text-sm font-black crystal-border mt-5">回到登入</button></div>`);
          document.getElementById('sr-reset-back-login').onclick = () => openLoginFromReset(modal, userId);
        };
        previousModal?.remove?.();
      } catch (error) {
        console.error('忘記密碼申請失敗:', error);
        SRP.toast(error.message || '申請沒有送出，請稍後再試。', 'error');
        setButtonBusy(button, false);
      }
    };
  };

  window.showPasswordResetRequestModal = window.SRP_showResetFlow;

  function patchLogin() {
    const button = document.getElementById('btn-login-submit');
    const idInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const forgot = document.getElementById('btn-forgot-password');
    if (!button || !idInput || !passwordInput) return;

    button.textContent = '登入';
    button.classList.add('min-h-[44px]');
    window.__srHandleLoginSubmit = SRP_login;
    button.onclick = SRP_login;

    if (!idInput.dataset.srLoginBound) {
      idInput.dataset.srLoginBound = '1';
      if (!idInput.value) idInput.value = localStorage.getItem(LAST_LOGIN_KEY) || '';
      idInput.addEventListener('input', () => localStorage.setItem(LAST_LOGIN_KEY, idInput.value.trim()));
    }

    if (!passwordInput.dataset.srCapsBound) {
      passwordInput.dataset.srCapsBound = '1';
      const hint = document.createElement('div');
      hint.id = 'sr-caps-lock-hint';
      hint.className = 'hidden mt-1.5 text-xs text-amber-300';
      hint.textContent = 'Caps Lock 已開啟';
      passwordInput.closest('div')?.parentElement?.appendChild(hint);
      const updateCaps = event => hint.classList.toggle('hidden', !event.getModifierState?.('CapsLock'));
      passwordInput.addEventListener('keydown', updateCaps);
      passwordInput.addEventListener('keyup', updateCaps);
      passwordInput.addEventListener('blur', () => hint.classList.add('hidden'));
    }

    if (forgot) {
      forgot.textContent = '忘記密碼？';
      forgot.classList.add('min-h-[44px]');
      forgot.onclick = event => {
        event.preventDefault();
        window.SRP_showResetFlow(forgot.closest('.fixed'));
      };
    }
    bindPasswordToggles(document);
    document.documentElement.dataset.srAuthUi = VERSION;
  }

  function patchProfile() {
    const submitButton = document.getElementById('btn-submit-profile-edit');
    if (!submitButton || document.getElementById('srp-profile-pass')) return;
    const box = document.createElement('div');
    box.id = 'srp-profile-pass';
    box.className = 'p-4 bg-slate-900/40 border border-amber-500/10 rounded-2xl space-y-3';
    box.innerHTML = `<span class="text-xs font-bold text-amber-500 tracking-widest block"><i class="fa-solid fa-key mr-1"></i> 更改登入密碼</span><p class="text-xs text-slate-500 leading-relaxed">先輸入目前密碼，再設定新密碼。</p>${passwordFieldHtml('srp-old', '目前密碼')}${passwordFieldHtml('srp-newp', '新密碼')}${passwordFieldHtml('srp-newp2', '再輸入一次新密碼')}<div class="text-xs text-slate-500 leading-relaxed">至少 8 碼，並包含 1 個大寫英文字母和 1 個特殊符號。</div><button type="button" id="srp-save-pass" class="w-full min-h-[44px] bg-slate-950/60 text-amber-300 font-bold text-xs py-3 px-4 rounded-xl border border-amber-500/15 transition hover-breath click-press">更新密碼</button>`;
    submitButton.parentElement.insertBefore(box, submitButton);
    bindPasswordToggles(box);
    document.getElementById('srp-save-pass').onclick = async () => {
      const saveButton = document.getElementById('srp-save-pass');
      const id = localStorage.getItem('sr_username');
      const oldPassword = document.getElementById('srp-old').value;
      const first = document.getElementById('srp-newp').value;
      const second = document.getElementById('srp-newp2').value;
      if (!oldPassword || !first || !second) return SRP.toast('目前密碼、新密碼和確認欄位都要填。', 'error');
      if (first !== second) return SRP.toast('兩次輸入不一樣，再確認一下。', 'error');
      if (first === oldPassword) return SRP.toast('新密碼不能和目前密碼一樣。', 'error');
      if (!SRP.valid(first)) return SRP.toast('密碼格式不符：至少 8 碼，並包含 1 個大寫英文字母和 1 個特殊符號。', 'error');
      setButtonBusy(saveButton, true, '正在更新...');
      try {
        const { db, fs } = await SRP.tools();
        const ref = fs.doc(db, 'secretg_apps', SRP.app, 'applications', id);
        const snapshot = await fs.getDoc(ref);
        if (!snapshot.exists()) throw new Error('找不到你的帳號資料。');
        const user = snapshot.data() || {};
        if (user.password !== oldPassword) throw new Error('目前密碼不對。');
        const updates = {
          password: first,
          mustChangePassword: false,
          forcePasswordChange: false,
          tempPasswordActive: false,
          passwordChangeRequired: false,
          passwordChangedAt: fs.serverTimestamp(),
          passwordChangedAtMs: Date.now(),
          passwordChangedBy: 'member',
          lastPasswordChangeMethod: 'profile_edit'
        };
        await fs.updateDoc(ref, updates);
        await SRP.sendMail({ ...user, ...updates }, id);
        SRP.toast('密碼換好了，安全提醒也寄出了。', 'success');
        ['srp-old', 'srp-newp', 'srp-newp2'].forEach(fieldId => { const field = document.getElementById(fieldId); if (field) field.value = ''; });
      } catch (error) {
        console.error(error);
        SRP.toast('密碼沒換成功：' + error.message, 'error');
      } finally {
        setButtonBusy(saveButton, false);
      }
    };
  }

  function installStyles() {
    if (document.getElementById('sr-auth-phase1-style')) return;
    const style = document.createElement('style');
    style.id = 'sr-auth-phase1-style';
    style.textContent = `
      .sr-reset-step{display:flex;flex-direction:column;align-items:center;gap:.35rem;padding:.65rem .25rem;border:1px solid rgba(148,163,184,.12);border-radius:.9rem;color:#64748b;background:rgba(15,23,42,.35);text-align:center}.sr-reset-step span{display:flex;width:1.55rem;height:1.55rem;border-radius:999px;align-items:center;justify-content:center;border:1px solid rgba(148,163,184,.18);font-size:.7rem;font-weight:900}.sr-reset-step small{font-size:.62rem;line-height:1.2;font-weight:800}.sr-reset-step-active{color:#fcd34d;border-color:rgba(245,158,11,.28);background:rgba(245,158,11,.07)}.sr-reset-step-done{color:#6ee7b7;border-color:rgba(16,185,129,.22);background:rgba(16,185,129,.06)}
      @media(max-width:480px){.sr-reset-step small{font-size:.58rem}}
    `;
    document.head.appendChild(style);
  }

  let scheduled = false;
  function apply() {
    scheduled = false;
    installStyles();
    patchLogin();
    patchProfile();
  }
  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  }

  new MutationObserver(scheduleApply).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', apply, { once: true });
  apply();
})();