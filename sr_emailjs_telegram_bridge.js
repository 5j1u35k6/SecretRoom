/* EmailJS compatibility bridge.
 * The external EmailJS SDK is not loaded. Existing admin notification calls
 * are translated into authenticated Telegram backend deliveries.
 */
;(() => {
  async function currentIdToken() {
    const [appMod, authMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js')
    ]);
    const app = appMod.getApps()[0];
    if (!app) throw new Error('Firebase 尚未初始化');
    const user = authMod.getAuth(app).currentUser;
    if (!user || user.isAnonymous) throw new Error('管理員尚未完成安全登入');
    return user.getIdToken();
  }

  async function send(_serviceId, _templateId, parameters = {}) {
    const backend = window.SRSecureAdminAuth?.backendUrl?.() ||
      String(window.SecretRoomBackendConfig?.backendUrl || localStorage.getItem('sr_backend_url') || '').replace(/\/+$/, '');
    if (!backend) throw new Error('尚未設定 SecretRoom 後端網址');
    const token = await currentIdToken();
    const response = await fetch(`${backend}/api/admin/telegram-notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        userId: parameters.member_id || '',
        toEmail: parameters.to_email || '',
        category: /安全|密碼|帳號/.test(`${parameters.email_type || ''} ${parameters.status_text || ''}`) ? 'security' : 'review',
        title: parameters.status_text || 'SecretRoom 通知',
        message: parameters.message || '',
        required: /安全|密碼|帳號/.test(`${parameters.email_type || ''} ${parameters.status_text || ''}`)
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || `Telegram 通知失敗：${response.status}`);
    return { status: 200, text: data.sent ? 'telegram_sent' : 'telegram_queued' };
  }

  window.emailjs = Object.freeze({ init() {}, send });
})();
