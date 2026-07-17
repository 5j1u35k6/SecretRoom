/* SecretRoom Telegram admin integration.
 * Admin actions continue using the existing UI. Notification deliveries are
 * routed to the privileged backend and remain separate from platform notices.
 */
;(() => {
  async function idToken() {
    const [appMod, authMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js')
    ]);
    const app = appMod.getApps()[0];
    if (!app) throw new Error('Firebase 尚未初始化');
    const user = authMod.getAuth(app).currentUser;
    if (!user || user.isAnonymous) throw new Error('請先完成管理員安全登入');
    return user.getIdToken();
  }

  function backendUrl() {
    return window.SRSecureAdminAuth?.backendUrl?.() ||
      String(window.SecretRoomBackendConfig?.backendUrl || localStorage.getItem('sr_backend_url') || '').replace(/\/+$/, '');
  }

  async function api(path, body = {}) {
    const response = await fetch(`${backendUrl()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await idToken()}` },
      body: JSON.stringify(body),
      cache: 'no-store'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || `後端錯誤：${response.status}`);
    return data;
  }

  async function queueTelegramNotification({ userId, category, title, message, required = false }) {
    return api('/api/admin/telegram-notify', { userId, category, title, message, required });
  }

  async function notifyReviewResult(userId, title, message, approved) {
    return queueTelegramNotification({
      userId, category: 'review', title,
      message: `${approved ? '✅' : '⚠️'} ${message}`
    });
  }

  async function notifySecurityEvent(userId, title, message) {
    return queueTelegramNotification({ userId, category: 'security', title, message, required: true });
  }

  async function processQueue() {
    const result = await api('/api/admin/process-queue');
    window.showToast?.(`Telegram Queue 已處理 ${result.processed || 0} 筆`, 'success');
    return result;
  }

  async function migrateCredentials(limit = 100) {
    const result = await api('/api/admin/migrate-credentials', { limit });
    window.showToast?.(`已遷移 ${result.migrated || 0} 組會員憑證`, 'success');
    return result;
  }

  function installAdminNotice() {
    const main = document.getElementById('admin-main');
    if (!main || document.getElementById('sr-telegram-admin-notice')) return;
    const notice = document.createElement('div');
    notice.id = 'sr-telegram-admin-notice';
    notice.className = 'mb-6 rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4 text-xs text-sky-100';
    notice.innerHTML = `
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div><b>Telegram 外部通知已與平台通知分流</b>
        <div class="mt-1 text-slate-400">平台公告保留於 notifications；外部通知由 Telegram Queue 發送。</div></div>
        <div class="flex gap-2">
          <button id="sr-process-telegram-queue" class="px-3 py-2 rounded-xl border border-sky-400/20 bg-sky-500/10 text-sky-200 font-bold">處理待送通知</button>
          <button id="sr-migrate-credentials" class="px-3 py-2 rounded-xl border border-amber-400/20 bg-amber-500/10 text-amber-200 font-bold">遷移舊密碼</button>
        </div>
      </div>`;
    main.insertBefore(notice, main.children[1] || null);
    notice.querySelector('#sr-process-telegram-queue').onclick = () => processQueue().catch(error => window.showToast?.(error.message, 'error'));
    notice.querySelector('#sr-migrate-credentials').onclick = () => {
      if (confirm('要將最多 100 組舊明文密碼遷移為 PBKDF2 雜湊並從會員文件移除嗎？')) {
        migrateCredentials(100).catch(error => window.showToast?.(error.message, 'error'));
      }
    };
  }

  new MutationObserver(installAdminNotice).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => setTimeout(installAdminNotice, 1000), { once: true });

  window.SRTelegramAdmin = Object.freeze({
    queueTelegramNotification, notifyReviewResult, notifySecurityEvent,
    processQueue, migrateCredentials
  });
})();
