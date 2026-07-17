/**
 * SecretRoom EmailJS → Telegram 相容橋接層
 *
 * 目的：
 * 1. 讓既有 app.js / admin.js 不必一次重寫所有通知呼叫。
 * 2. 攔截原本的 emailjs.send()，改寫入 telegram_outbox。
 * 3. 平台通知仍維持 notifications 集合，不與 Telegram 混用。
 * 4. 忘記密碼的臨時密碼不允許經過佇列，避免明文憑證留在 Firestore。
 */
(() => {
  'use strict';

  if (window.__SR_EMAILJS_TELEGRAM_BRIDGE__) return;
  window.__SR_EMAILJS_TELEGRAM_BRIDGE__ = true;

  const APP_ID = 'secretg-production-node-tw';
  const VERSION = '20260717-telegram-phase6-bridge-v1';
  let toolsPromise = null;

  function text(value) {
    return String(value ?? '').trim();
  }

  function inferCategory(params = {}) {
    const haystack = `${params.email_type || ''} ${params.status_text || ''} ${params.message || ''}`.toLowerCase();
    if (/密碼|登入|安全|security/.test(haystack)) return 'security';
    if (/頭像|avatar/.test(haystack)) return 'avatar';
    if (/黃金|spec/.test(haystack)) return 'spec';
    if (/審核|會籍|申請|registration|review/.test(haystack)) return 'review';
    if (/檢舉|貼文|留言|report/.test(haystack)) return 'account';
    if (/帳號|刪除|停用/.test(haystack)) return 'account';
    return 'platform';
  }

  function containsTemporaryCredential(params = {}) {
    const value = `${params.status_text || ''}\n${params.message || ''}`;
    return /臨時密碼|temporary password|SR-[A-Z0-9]{3,}/i.test(value);
  }

  async function tools() {
    if (!toolsPromise) {
      toolsPromise = Promise.all([
        import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js')
      ]).then(([appModule, fs]) => {
        const app = appModule.getApps()[0];
        if (!app) throw new Error('Firebase 尚未初始化');
        return { db: fs.getFirestore(app), fs };
      });
    }
    return toolsPromise;
  }

  async function resolveMemberId(params, db, fs) {
    const explicit = text(params.member_id || params.userId || params.accountId);
    if (explicit) return explicit.replace(/^@+/, '');

    const email = text(params.to_email).toLowerCase();
    if (!email) return '';

    const snapshot = await fs.getDocs(
      fs.query(
        fs.collection(db, 'secretg_apps', APP_ID, 'applications'),
        fs.where('email', '==', email)
      )
    );

    return snapshot.empty ? '' : snapshot.docs[0].id;
  }

  async function queueTelegramNotification(params = {}) {
    if (containsTemporaryCredential(params)) {
      throw new Error('臨時密碼不得寫入 Telegram 佇列；請改用 Bot 被動密碼重設流程。');
    }

    const { db, fs } = await tools();
    const memberId = await resolveMemberId(params, db, fs);
    const category = inferCategory(params);
    const title = text(params.status_text) || 'SecretRoom 通知';
    const message = text(params.message) || '你有一則新的 SecretRoom 通知。';

    /* app.js 既有 Telegram Phase 2 會另外建立密碼變更安全通知，避免重複排隊。 */
    if (/密碼已更新|密碼剛剛已更新/.test(`${title} ${message}`)) {
      return { status: 204, text: 'Handled by native Telegram security queue' };
    }

    if (!memberId) {
      const adminRef = fs.doc(fs.collection(db, 'secretg_apps', APP_ID, 'telegram_admin_outbox'));
      await fs.setDoc(adminRef, {
        category: 'system',
        title,
        message,
        source: 'legacy_emailjs_bridge_unresolved_member',
        status: 'pending',
        attemptCount: 0,
        nextAttemptAtMs: 0,
        createdAt: fs.serverTimestamp(),
        createdAtMs: Date.now()
      });

      return { status: 202, text: 'Queued for admin review', id: adminRef.id };
    }

    const outboxRef = fs.doc(fs.collection(db, 'secretg_apps', APP_ID, 'telegram_outbox'));
    await fs.setDoc(outboxRef, {
      accountId: memberId,
      category,
      title,
      message,
      status: 'pending',
      attemptCount: 0,
      nextAttemptAtMs: 0,
      source: 'legacy_emailjs_bridge',
      legacyEmailType: text(params.email_type),
      buttonText: '開啟 SecretRoom',
      buttonUrl: `${location.origin}${location.pathname}`,
      createdAt: fs.serverTimestamp(),
      createdAtMs: Date.now()
    });

    return { status: 202, text: 'Queued for Telegram', id: outboxRef.id };
  }

  const bridge = {
    init() {
      document.documentElement.dataset.srEmailTransport = 'telegram';
      return true;
    },

    async send(_serviceId, _templateId, params = {}) {
      return queueTelegramNotification(params);
    }
  };

  window.emailjs = bridge;
  window.SRTelegramNotificationBridge = Object.freeze({
    version: VERSION,
    queue: queueTelegramNotification,
    inferCategory
  });
})();
