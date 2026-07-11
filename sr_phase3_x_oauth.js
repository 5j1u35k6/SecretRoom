// SecretRoom phase three: verified X OAuth 2.0 PKCE account binding.
(() => {
  if (window.__SR_PHASE3_X_OAUTH__) return;
  window.__SR_PHASE3_X_OAUTH__ = true;

  const APP_ID = 'secretg-production-node-tw';
  const VERSION = '20260711-phase3-x-oauth-v1';
  const STATE_KEY = 'sr_x_oauth_state';
  const VERIFIER_KEY = 'sr_x_oauth_verifier';
  const MEMBER_KEY = 'sr_x_oauth_member';
  let queued = false;
  let callbackPromise = null;

  const qs = id => document.getElementById(id);
  const toast = (message, type = 'info') => window.showToast?.(message, type);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const config = () => window.SR_X_OAUTH_CONFIG || {};
  const memberId = () => String(window.state?.applicationId || localStorage.getItem('sr_username') || sessionStorage.getItem(MEMBER_KEY) || '').trim();

  async function tools() {
    if (window.SRP?.tools) return window.SRP.tools();
    const appMod = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js');
    const fs = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
    const app = appMod.getApps()[0];
    if (!app) throw new Error('Firebase 尚未初始化');
    return { db: fs.getFirestore(app), fs };
  }

  function base64Url(bytes) {
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function randomValue(size = 48) {
    const bytes = new Uint8Array(size);
    crypto.getRandomValues(bytes);
    return base64Url(bytes);
  }

  async function challengeFor(verifier) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return base64Url(new Uint8Array(digest));
  }

  function cleanOAuthQuery() {
    const url = new URL(location.href);
    ['code', 'state', 'error', 'error_description'].forEach(key => url.searchParams.delete(key));
    history.replaceState({}, document.title, url.pathname + (url.search ? url.search : '') + url.hash);
  }

  function clearSession() {
    sessionStorage.removeItem(STATE_KEY);
    sessionStorage.removeItem(VERIFIER_KEY);
    sessionStorage.removeItem(MEMBER_KEY);
  }

  async function beginOAuth() {
    const settings = config();
    const id = memberId();
    if (!id) return toast('找不到目前登入帳號。', 'error');
    if (!settings.clientId) return showSetupNotice();
    if (!crypto?.subtle) return toast('目前瀏覽器不支援安全驗證流程。', 'error');

    const verifier = randomValue(64);
    const state = randomValue(32);
    const challenge = await challengeFor(verifier);
    const redirectUri = settings.redirectUri || `${location.origin}${location.pathname}`;
    sessionStorage.setItem(VERIFIER_KEY, verifier);
    sessionStorage.setItem(STATE_KEY, state);
    sessionStorage.setItem(MEMBER_KEY, id);

    const url = new URL('https://x.com/i/oauth2/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', settings.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', (settings.scopes || ['tweet.read', 'users.read']).join(' '));
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    location.assign(url.toString());
  }

  async function exchangeCode(code) {
    const settings = config();
    const verifier = sessionStorage.getItem(VERIFIER_KEY);
    if (!settings.clientId || !verifier) throw new Error('X 驗證工作階段已失效，請重新開始。');
    const body = new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: settings.clientId,
      redirect_uri: settings.redirectUri || `${location.origin}${location.pathname}`,
      code_verifier: verifier
    });
    const response = await fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) throw new Error(payload.error_description || payload.error || '無法取得 X 驗證權杖。');
    return payload.access_token;
  }

  async function fetchXUser(accessToken) {
    const response = await fetch('https://api.x.com/2/users/me?user.fields=id,name,username,profile_image_url', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.data?.id || !payload.data?.username) throw new Error(payload.detail || payload.title || '無法讀取 X 帳號資料。');
    return payload.data;
  }

  async function revokeToken(accessToken) {
    const settings = config();
    if (!settings.clientId || !accessToken) return;
    try {
      await fetch('https://api.x.com/2/oauth2/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: accessToken, client_id: settings.clientId })
      });
    } catch (_) {}
  }

  async function saveVerifiedUser(user) {
    const id = memberId();
    if (!id) throw new Error('找不到 SecretRoom 帳號。');
    const { db, fs } = await tools();
    const now = Date.now();
    const xInfo = {
      id: String(user.id),
      handle: String(user.username),
      name: String(user.name || user.username),
      profileImageUrl: String(user.profile_image_url || ''),
      profileUrl: `https://x.com/${user.username}`,
      verificationStatus: 'oauth_verified',
      verifiedAt: fs.serverTimestamp(),
      verifiedAtMs: now
    };
    const compatibility = {
      provider: 'x-oauth-compat',
      deprecated: true,
      xUserId: xInfo.id,
      xHandle: xInfo.handle,
      verified: true,
      verifiedAtMs: now
    };
    await fs.updateDoc(fs.doc(db, 'secretg_apps', APP_ID, 'applications', id), {
      xInfo,
      socialBindingProvider: 'x_oauth',
      socialBindingUpdatedAt: fs.serverTimestamp(),
      socialBindingUpdatedAtMs: now,
      telegramInfo: compatibility
    });
    if (window.state) window.state.userData = { ...(window.state.userData || {}), xInfo, socialBindingProvider: 'x_oauth', telegramInfo: compatibility };
  }

  async function handleCallback() {
    if (callbackPromise) return callbackPromise;
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const returnedState = params.get('state');
    const error = params.get('error');
    if (!code && !error) return;

    callbackPromise = (async () => {
      if (error) {
        const message = params.get('error_description') || '你取消了 X 驗證。';
        cleanOAuthQuery();
        clearSession();
        toast(message, 'error');
        return;
      }
      const expectedState = sessionStorage.getItem(STATE_KEY);
      if (!expectedState || returnedState !== expectedState) {
        cleanOAuthQuery();
        clearSession();
        toast('X 驗證狀態不一致，請重新操作。', 'error');
        return;
      }
      let token = '';
      try {
        token = await exchangeCode(code);
        const user = await fetchXUser(token);
        await saveVerifiedUser(user);
        toast(`X 帳號 @${user.username} 已完成官方驗證。`, 'success');
        cleanOAuthQuery();
        clearSession();
        setTimeout(() => location.reload(), 500);
      } catch (cause) {
        console.error('X OAuth 驗證失敗:', cause);
        cleanOAuthQuery();
        clearSession();
        toast('X 驗證沒有完成：' + cause.message, 'error');
      } finally {
        await revokeToken(token);
      }
    })();
    return callbackPromise;
  }

  function statusText() {
    const info = window.state?.userData?.xInfo;
    if (info?.verificationStatus === 'oauth_verified') return `已驗證：X @${info.handle}`;
    if (info?.handle) return `尚未官方驗證：X @${info.handle}`;
    return '尚未綁定 X 帳號';
  }

  function authPanel(gate = false) {
    const settings = config();
    const verified = window.state?.userData?.xInfo?.verificationStatus === 'oauth_verified';
    return `<section class="glass-panel crystal-border border border-sky-500/20 rounded-3xl p-6 w-[94vw] max-w-md shadow-2xl"><div class="w-12 h-12 rounded-full bg-black border border-sky-500/25 flex items-center justify-center text-white text-xl font-black mb-4">X</div><div class="text-xs text-sky-300 font-black">X 官方驗證</div><h2 class="text-xl text-white font-black mt-1">${verified ? 'X 帳號已驗證' : '綁定並驗證 X 帳號'}</h2><p class="text-xs text-slate-400 leading-relaxed mt-2">會前往 X 官方授權頁確認帳號所有權。SecretRoom 不會取得你的 X 密碼，也不會保存存取權杖。</p><div class="mt-4 rounded-2xl border border-slate-800 bg-slate-950/55 p-3 text-xs ${verified ? 'text-emerald-300' : 'text-slate-400'}">${esc(statusText())}</div>${settings.clientId ? `<button id="sr-x-oauth-start" class="w-full min-h-[48px] mt-4 rounded-xl bg-white text-black font-black text-sm">${verified ? '重新驗證 X 帳號' : '使用 X 官方驗證'}</button>` : '<div class="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">X OAuth 尚未設定 Client ID。完成開發者後台設定後即可啟用。</div>'}${gate ? '<button id="sr-x-oauth-logout" class="w-full min-h-[44px] mt-3 rounded-xl border border-slate-700 text-slate-400 text-xs font-black">先登出</button>' : ''}</section>`;
  }

  function bindPanel(root) {
    root.querySelector('#sr-x-oauth-start')?.addEventListener('click', beginOAuth);
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
    gate.innerHTML = authPanel(true);
    bindPanel(gate);
  }

  function openModal() {
    qs('sr-x-oauth-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'sr-x-oauth-modal';
    modal.className = 'fixed inset-0 z-[230] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md';
    modal.innerHTML = `<button id="sr-x-oauth-close" class="absolute top-4 right-4 w-11 h-11 rounded-full border border-slate-700 bg-slate-950 text-slate-300" aria-label="關閉"><i class="fa-solid fa-xmark"></i></button>${authPanel(false)}`;
    document.body.appendChild(modal);
    qs('sr-x-oauth-close').onclick = () => modal.remove();
    modal.addEventListener('click', event => { if (event.target === modal) modal.remove(); });
    bindPanel(modal);
  }

  function showSetupNotice() {
    openModal();
    toast('請先在 X Developer Console 設定 OAuth Client ID。', 'info');
  }

  window.SRPhase3OpenXOAuth = openModal;
  window.SRPhase2OpenXBinding = openModal;

  function apply() {
    queued = false;
    handleCallback();
    renderGate();
    document.documentElement.dataset.srPhase3XOAuth = VERSION;
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  apply();
})();