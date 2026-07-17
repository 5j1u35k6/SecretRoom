/* SecretRoom Telegram member self-service.
 * The entry point is shown only for a verified Firebase member session.
 */
;(() => {
  const BOT_NAME = 'SecretRoomtwBot';
  let authPromise = null;
  let unsubscribeAuth = null;

  function backendEnabled() {
    return window.SRSecureAuth?.migrationEnabled?.() === true;
  }

  async function firebaseAuthTools() {
    if (authPromise) return authPromise;
    authPromise = Promise.all([
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js')
    ]).then(([appMod, authMod]) => {
      const app = appMod.getApps()[0];
      if (!app) throw new Error('Firebase 尚未初始化');
      return {
        auth: authMod.getAuth(app),
        onAuthStateChanged: authMod.onAuthStateChanged,
        getIdTokenResult: authMod.getIdTokenResult
      };
    });
    return authPromise;
  }

  async function memberIdentity(forceRefresh = false) {
    if (window.SRSecureAuth?.currentMemberIdentity) {
      return window.SRSecureAuth.currentMemberIdentity(forceRefresh);
    }

    const { auth, getIdTokenResult } = await firebaseAuthTools();
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return null;
    const tokenResult = await getIdTokenResult(user, forceRefresh);
    const claims = tokenResult.claims || {};
    if (claims.secretroomMember !== true || !claims.secretroomUserId) return null;
    return {
      user,
      userId: String(claims.secretroomUserId),
      claims,
      tokenResult
    };
  }

  async function idToken() {
    const identity = await memberIdentity(true);
    if (!identity) {
      throw new Error('請先登出目前帳號，再使用 SecretRoom 會員帳號重新安全登入');
    }
    return identity.user.getIdToken();
  }

  async function api(path, body = {}) {
    if (!window.SRSecureAuth || !backendEnabled()) {
      throw new Error('Telegram 會員服務尚未完成後端啟用');
    }
    return window.SRSecureAuth.api(path, body, await idToken());
  }

  async function createBindingLink() {
    const result = await api('/api/member/binding-link');
    return result.url;
  }

  async function saveTelegramPreferences(patch) {
    return api('/api/member/preferences', patch);
  }

  async function getRequestStatus() {
    return api('/api/member/status');
  }

  function toast(message, type = 'info') {
    window.showToast?.(message, type) || alert(message);
  }

  function closeModal() {
    document.getElementById('sr-telegram-service-modal')?.remove();
  }

  function preferenceDialog(current = {}) {
    const review = confirm(
      `審核結果通知目前為${current.review === false ? '關閉' : '開啟'}。\n按「確定」保持開啟；按「取消」關閉。`
    );
    const service = confirm(
      `服務與系統通知目前為${current.service === false ? '關閉' : '開啟'}。\n按「確定」保持開啟；按「取消」關閉。`
    );
    const promotion = confirm(
      `活動與公告通知目前為${current.promotion === true ? '開啟' : '關閉'}。\n按「確定」開啟；按「取消」關閉。`
    );
    return { review, service, promotion };
  }

  async function openModal() {
    if (!backendEnabled()) {
      return toast('Telegram 會員服務尚未完成後端啟用。', 'info');
    }
    const identity = await memberIdentity(true);
    if (!identity) {
      removeEntryButton();
      return toast('請先登出目前帳號，再使用 SecretRoom 會員帳號重新安全登入。', 'error');
    }

    closeModal();
    const wrap = document.createElement('div');
    wrap.id = 'sr-telegram-service-modal';
    wrap.className = 'fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-4';
    wrap.innerHTML = `
      <div class="w-full max-w-md rounded-3xl border border-sky-500/20 bg-[#07111d] p-5 shadow-2xl text-slate-100">
        <div class="flex items-start justify-between gap-4 mb-5">
          <div>
            <div class="text-sky-300 text-xs font-black tracking-[.18em]">TELEGRAM SERVICE</div>
            <h2 class="text-xl font-black mt-1">SecretRoom 會員服務</h2>
            <p class="text-xs text-slate-400 mt-2">Telegram 外部通知與平台內通知分開管理。</p>
            <p class="text-[11px] text-sky-300/80 mt-2">目前會員：@${identity.userId}</p>
          </div>
          <button data-close class="text-slate-400 text-2xl">×</button>
        </div>
        <div class="grid gap-3">
          <button data-action="bind" class="text-left rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4"><b>🔗 綁定帳號</b><div class="text-xs text-slate-400 mt-1">產生 10 分鐘有效的一次性安全連結</div></button>
          <button data-action="reset" class="text-left rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4"><b>🔐 忘記密碼</b><div class="text-xs text-slate-400 mt-1">請先從登入頁申請，再到機器人完成</div></button>
          <button data-action="prefs" class="text-left rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4"><b>🔔 Telegram 通知設定</b><div class="text-xs text-slate-400 mt-1">安全通知固定開啟，其他通知獨立設定</div></button>
          <button data-action="status" class="text-left rounded-2xl border border-slate-700 bg-slate-900/70 p-4"><b>📋 我的申請進度</b></button>
        </div>
      </div>`;

    wrap.querySelector('[data-close]').onclick = closeModal;
    wrap.addEventListener('click', async event => {
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (!action) return;
      try {
        if (action === 'bind') location.href = await createBindingLink();
        if (action === 'reset') {
          toast('忘記密碼必須先從登入頁送出申請，再到 Telegram 操作。', 'info');
          window.open(`https://t.me/${BOT_NAME}`, '_blank', 'noopener');
        }
        if (action === 'prefs') {
          const current = await getRequestStatus();
          await saveTelegramPreferences(
            preferenceDialog(current.preferences || {})
          );
          toast('Telegram 通知偏好已更新', 'success');
        }
        if (action === 'status') {
          const status = await getRequestStatus();
          alert(
            `帳號綁定：${status.binding ? '已綁定' : '未綁定'}\n` +
            `忘記密碼：${status.passwordReset?.status || '無申請'}\n` +
            `帳號異動：${status.accountRequest?.status || '無申請'}`
          );
        }
      } catch (error) {
        toast(error.message || String(error), 'error');
      }
    });
    document.body.appendChild(wrap);
  }

  function removeEntryButton() {
    document.getElementById('sr-telegram-service-entry')?.remove();
    closeModal();
  }

  function createEntryButton(identity) {
    if (document.getElementById('sr-telegram-service-entry')) return;
    const button = document.createElement('button');
    button.id = 'sr-telegram-service-entry';
    button.type = 'button';
    button.className = 'fixed left-4 bottom-20 md:bottom-6 z-[90] rounded-full border border-sky-400/25 bg-sky-500/15 backdrop-blur-xl px-4 py-3 text-xs font-black text-sky-200 shadow-xl';
    button.textContent = `✈ Telegram 會員服務 · @${identity.userId}`;
    button.onclick = () => openModal().catch(error => toast(error.message || String(error), 'error'));
    document.body.appendChild(button);
  }

  async function syncEntryButton() {
    if (!backendEnabled()) {
      removeEntryButton();
      return;
    }
    try {
      const identity = await memberIdentity(false);
      if (identity) createEntryButton(identity);
      else removeEntryButton();
    } catch (error) {
      console.warn('Telegram member identity check failed', error);
      removeEntryButton();
    }
  }

  async function installAuthObserver() {
    if (unsubscribeAuth) return;
    const { auth, onAuthStateChanged } = await firebaseAuthTools();
    unsubscribeAuth = onAuthStateChanged(auth, () => {
      syncEntryButton();
    });
    await syncEntryButton();
  }

  window.SRTelegramPlatform = Object.freeze({
    createBindingLink,
    saveTelegramPreferences,
    getRequestStatus,
    openModal,
    memberIdentity,
    syncEntryButton
  });

  document.addEventListener('DOMContentLoaded', () => {
    installAuthObserver().catch(error => console.warn(error));
  }, { once: true });
  installAuthObserver().catch(error => console.warn(error));
})();