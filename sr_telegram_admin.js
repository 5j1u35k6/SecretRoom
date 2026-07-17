/* SecretRoom Telegram admin integration.
 * Keeps platform notifications and Telegram deliveries in separate collections.
 */
;(() => {
  const APP_ID = 'secretg-production-node-tw';
  let sdkPromise = null;

  async function firebase() {
    if (sdkPromise) return sdkPromise;
    sdkPromise = Promise.all([
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js')
    ]).then(([appMod, fs]) => {
      const app = appMod.getApps()[0];
      if (!app) throw new Error('Firebase 尚未初始化');
      return { db: fs.getFirestore(app), fs };
    });
    return sdkPromise;
  }

  async function queueTelegramNotification({ userId, category, title, message, required = false }) {
    const { db, fs } = await firebase();
    const memberSnap = await fs.getDoc(fs.doc(db, 'secretg_apps', APP_ID, 'applications', userId));
    if (!memberSnap.exists()) throw new Error('找不到會員資料');
    const member = memberSnap.data() || {};
    const binding = member.telegramBinding || member.telegramInfo || {};
    const chatId = binding.telegramChatId || binding.chatId || binding.id || '';
    if (!chatId) throw new Error('會員尚未綁定 Telegram');

    const preferences = member.telegramNotificationPreferences || {};
    const enabled = required || category === 'security' || preferences[category] !== false;
    if (!enabled) return { skipped: true, reason: 'preference_disabled' };

    const ref = fs.doc(fs.collection(db, 'secretg_apps', APP_ID, 'telegram_notification_queue'));
    await fs.setDoc(ref, {
      userId,
      telegramChatId: String(chatId),
      category,
      title,
      message,
      required,
      status: 'pending',
      attempts: 0,
      createdAt: fs.serverTimestamp(),
      createdAtMs: Date.now(),
      source: 'admin'
    });
    return { skipped: false, queueId: ref.id };
  }

  async function notifyReviewResult(userId, title, message, approved) {
    return queueTelegramNotification({
      userId,
      category: 'review',
      title,
      message: `${approved ? '✅' : '⚠️'} ${message}`
    });
  }

  async function notifySecurityEvent(userId, title, message) {
    return queueTelegramNotification({ userId, category: 'security', title, message, required: true });
  }

  function installAdminNotice() {
    const main = document.getElementById('admin-main');
    if (!main || document.getElementById('sr-telegram-admin-notice')) return;
    const notice = document.createElement('div');
    notice.id = 'sr-telegram-admin-notice';
    notice.className = 'mb-6 rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4 text-xs text-sky-100';
    notice.innerHTML = '<b>Telegram 通知已與平台通知分流</b><div class="mt-1 text-slate-400">平台公告仍寫入 notifications；Telegram 外部通知寫入 telegram_notification_queue。</div>';
    main.insertBefore(notice, main.children[1] || null);
  }

  window.SRTelegramAdmin = Object.freeze({ queueTelegramNotification, notifyReviewResult, notifySecurityEvent });
  document.addEventListener('DOMContentLoaded', () => setTimeout(installAdminNotice, 1000), { once: true });
})();
