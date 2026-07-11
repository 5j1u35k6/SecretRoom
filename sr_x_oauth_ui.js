// SecretRoom X OAuth interface.
(() => {
  if (window.__SR_X_OAUTH_UI__) return;
  window.__SR_X_OAUTH_UI__ = true;

  const VERSION = '20260711-x-oauth-ui-v2';
  let queued = false;
  const qs = id => document.getElementById(id);
  const toast = (message, type = 'info') => window.showToast?.(message, type);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

  function statusText() {
    const info = window.state?.userData?.xInfo;
    if (info?.verificationStatus === 'oauth_verified') return `已驗證：X @${info.handle}`;
    if (info?.handle) return `尚未官方驗證：X @${info.handle}`;
    return '尚未綁定 X 帳號';
  }

  function panel(gate = false) {
    const verified = window.state?.userData?.xInfo?.verificationStatus === 'oauth_verified';
    const ready = window.SRXOAuth?.backendReady?.();
    return `<section class="glass-panel crystal-border border border-sky-500/20 rounded-3xl p-6 w-[94vw] max-w-md shadow-2xl"><div class="w-12 h-12 rounded-full bg-black border border-sky-500/25 flex items-center justify-center text-white text-xl font-black mb-4">X</div><div class="text-xs text-sky-300 font-black">X 官方驗證</div><h2 class="text-xl text-white font-black mt-1">${verified ? 'X 帳號已驗證' : '綁定並驗證 X 帳號'}</h2><p class="text-xs text-slate-400 leading-relaxed mt-2">會前往 X 官方授權頁確認帳號所有權。SecretRoom 不會取得你的 X 密碼，也不會保存 X 存取權杖。</p><div class="mt-4 rounded-2xl border border-slate-800 bg-slate-950/55 p-3 text-xs ${verified ? 'text-emerald-300' : 'text-slate-400'}">${esc(statusText())}</div>${ready ? `<div class="mt-4"><label class="block text-xs text-slate-300 font-black mb-2">再次輸入 SecretRoom 密碼</label><div class="relative"><input id="sr-x-secretroom-password" type="password" autocomplete="current-password" class="w-full min-h-[46px] rounded-xl border border-sky-500/20 bg-slate-900 px-3 pr-12 text-sm text-white focus:outline-none focus:border-sky-400" placeholder="用來確認是本人操作"><button type="button" data-toggle-x-password class="absolute inset-y-0 right-0 min-w-[44px] text-slate-400" aria-label="顯示或隱藏密碼"><i class="fa-solid fa-eye-slash"></i></button></div></div><button id="sr-x-oauth-start" class="w-full min-h-[48px] mt-4 rounded-xl bg-white text-black font-black text-sm">${verified ? '重新驗證 X 帳號' : '使用 X 官方驗證'}</button>` : '<div class="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">X 驗證後端尚未部署，完成 Firebase Functions 部署後即可使用。</div>'}${gate ? '<button id="sr-x-oauth-logout" class="w-full min-h-[44px] mt-3 rounded-xl border border-slate-700 text-slate-400 text-xs font-black">先登出</button>' : ''}</section>`;
  }

  function setBusy(button, busy) {
    if (!button) return;
    if (busy) {
      if (!button.dataset.originalText) button.dataset.originalText = button.textContent;
      button.disabled = true;
      button.classList.add('opacity-60', 'cursor-not-allowed');
      button.textContent = '正在建立安全驗證...';
    } else {
      button.disabled = false;
      button.classList.remove('opacity-60', 'cursor-not-allowed');
      button.textContent = button.dataset.originalText || '使用 X 官方驗證';
    }
  }

  function bind(root) {
    root.querySelector('[data-toggle-x-password]')?.addEventListener('click', event => {
      const input = root.querySelector('#sr-x-secretroom-password');
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
      const icon = event.currentTarget.querySelector('i');
      if (icon) icon.className = `fa-solid ${input.type === 'password' ? 'fa-eye-slash' : 'fa-eye'}`;
    });

    root.querySelector('#sr-x-oauth-start')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      const password = root.querySelector('#sr-x-secretroom-password')?.value || '';
      setBusy(button, true);
      try {
        const authorizationUrl = await window.SRXOAuth.start(password);
        location.assign(authorizationUrl);
      } catch (error) {
        toast(error.message || '無法開始 X 驗證。', 'error');
        setBusy(button, false);
      }
    });

    root.querySelector('#sr-x-oauth-logout')?.addEventListener('click', () => {
      localStorage.removeItem('sr_username');
      location.reload();
    });
  }

  function renderGate() {
    if (window.state?.currentView !== 'telegram-bind') return;
    const app = qs('app');
    if (!app) return;
    let gate = qs('sr-x-gate');
    if (!gate) {
      app.innerHTML = '<main id="sr-x-gate" class="min-h-[100dvh] w-full flex items-center justify-center p-4"></main>';
      gate = qs('sr-x-gate');
    }
    if (gate.dataset.srOAuth === VERSION) return;
    gate.dataset.srOAuth = VERSION;
    gate.innerHTML = panel(true);
    bind(gate);
  }

  function openModal() {
    qs('sr-x-oauth-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'sr-x-oauth-modal';
    modal.className = 'fixed inset-0 z-[230] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md';
    modal.innerHTML = `<button id="sr-x-oauth-close" class="absolute top-4 right-4 w-11 h-11 rounded-full border border-slate-700 bg-slate-950 text-slate-300" aria-label="關閉"><i class="fa-solid fa-xmark"></i></button>${panel(false)}`;
    document.body.appendChild(modal);
    qs('sr-x-oauth-close').onclick = () => modal.remove();
    modal.addEventListener('click', event => { if (event.target === modal) modal.remove(); });
    bind(modal);
  }

  window.SRPhase3OpenXOAuth = openModal;
  window.SRPhase2OpenXBinding = openModal;

  function apply() {
    queued = false;
    renderGate();
    document.documentElement.dataset.srXOAuthUi = VERSION;
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  apply();
})();
