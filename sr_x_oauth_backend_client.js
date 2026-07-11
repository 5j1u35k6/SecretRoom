// SecretRoom X OAuth client: talks only to SecretRoom Firebase Functions.
(() => {
  if (window.__SR_X_OAUTH_BACKEND_CLIENT__) return;
  window.__SR_X_OAUTH_BACKEND_CLIENT__ = true;

  const EXPECTED_STATE_KEY = 'sr_x_oauth_expected_state';
  const MEMBER_KEY = 'sr_x_oauth_member';
  let callbackPromise = null;
  const qs = id => document.getElementById(id);
  const toast = (message, type = 'info') => window.showToast?.(message, type);
  const config = () => window.SR_X_OAUTH_CONFIG || {};
  const memberId = () => String(window.state?.applicationId || localStorage.getItem('sr_username') || sessionStorage.getItem(MEMBER_KEY) || '').trim();

  function cleanQuery() {
    const url = new URL(location.href);
    ['code', 'state', 'error', 'error_description'].forEach(key => url.searchParams.delete(key));
    history.replaceState({}, document.title, url.pathname + (url.search ? url.search : '') + url.hash);
  }

  function clearSession() {
    sessionStorage.removeItem(EXPECTED_STATE_KEY);
    sessionStorage.removeItem(MEMBER_KEY);
  }

  async function postJson(endpoint, body) {
    if (!endpoint) throw new Error('X 驗證後端尚未設定。');
    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
        credentials: 'omit'
      });
    } catch (_) {
      throw new Error('X 驗證後端尚未部署、連線被阻擋，或網路暫時中斷。');
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) throw new Error(payload.message || 'X 驗證服務沒有完成請求。');
    return payload;
  }

  async function start(password) {
    const id = memberId();
    if (!id) throw new Error('找不到目前登入帳號。');
    if (!password) throw new Error('請先輸入 SecretRoom 密碼。');
    const payload = await postJson(config().startEndpoint, { memberId: id, password });
    sessionStorage.setItem(EXPECTED_STATE_KEY, payload.state);
    sessionStorage.setItem(MEMBER_KEY, id);
    return payload.authorizationUrl;
  }

  function showProcessing() {
    qs('sr-x-oauth-processing')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'sr-x-oauth-processing';
    overlay.className = 'fixed inset-0 z-[260] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md';
    overlay.innerHTML = '<section class="glass-panel crystal-border w-[92vw] max-w-sm rounded-3xl border border-sky-500/20 p-6 text-center"><i class="fa-solid fa-circle-notch fa-spin text-3xl text-sky-300"></i><h2 class="text-lg text-white font-black mt-4">正在確認 X 帳號</h2><p class="text-xs text-slate-400 mt-2">請不要關閉這個頁面。</p></section>';
    document.body.appendChild(overlay);
  }

  async function completeFromCallback() {
    if (callbackPromise) return callbackPromise;
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const state = params.get('state');
    const oauthError = params.get('error');
    if (!code && !oauthError) return;

    callbackPromise = (async () => {
      if (oauthError) {
        const message = params.get('error_description') || '你取消了 X 驗證。';
        cleanQuery();
        clearSession();
        toast(message, 'error');
        return;
      }

      const expected = sessionStorage.getItem(EXPECTED_STATE_KEY);
      if (!expected || state !== expected) {
        cleanQuery();
        clearSession();
        toast('X 驗證狀態不一致，請重新開始。', 'error');
        return;
      }

      showProcessing();
      try {
        const payload = await postJson(config().completeEndpoint, { code, state });
        if (window.state) {
          window.state.userData = {
            ...(window.state.userData || {}),
            xInfo: payload.xInfo,
            socialBindingProvider: 'x_oauth'
          };
        }
        cleanQuery();
        clearSession();
        qs('sr-x-oauth-processing')?.remove();
        toast(`X 帳號 @${payload.xInfo.handle} 已完成官方驗證。`, 'success');
        setTimeout(() => location.reload(), 650);
      } catch (error) {
        console.error('X OAuth completion failed:', error);
        cleanQuery();
        clearSession();
        qs('sr-x-oauth-processing')?.remove();
        toast('X 驗證沒有完成：' + error.message, 'error');
      }
    })();
    return callbackPromise;
  }

  window.SRXOAuth = {
    start,
    completeFromCallback,
    memberId,
    backendReady: () => Boolean(config().startEndpoint && config().completeEndpoint)
  };

  completeFromCallback();
})();
