/* SecretRoom 管理後台：Telegram 通知與失敗重送 */
;(() => {
  const APP_ID = 'secretg-production-node-tw';
  let db = null;
  let fs = null;

  async function firebase_() {
    if (db && fs) return { db, fs };
    const [appMod, firestoreMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js')
    ]);
    const app = appMod.getApps()[0];
    if (!app) throw new Error('Firebase 尚未初始化');
    db = firestoreMod.getFirestore(app);
    fs = firestoreMod;
    return { db, fs };
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  }

  function toast(message, type = 'info') {
    if (typeof window.showToast === 'function') return window.showToast(message, type);
    alert(message);
  }

  async function queueTelegramNotification({ memberId, category, title, message, mandatory = false }) {
    const { db, fs } = await firebase_();
    const memberRef = fs.doc(db, 'secretg_apps', APP_ID, 'applications', memberId);
    const memberSnap = await fs.getDoc(memberRef);
    if (!memberSnap.exists()) throw new Error('找不到會員帳號');
    const member = memberSnap.data() || {};
    const binding = member.telegramBinding || {};
    if (!binding.telegramChatId || binding.status !== 'active') throw new Error('會員尚未綁定 Telegram');

    const preferences = member.telegramNotificationPreferences || {};
    if (!mandatory && preferences[category] === false) {
      return { skipped: true, reason: 'member_preference' };
    }

    const queueRef = fs.doc(fs.collection(db, 'secretg_apps', APP_ID, 'telegram_notification_queue'));
    await fs.setDoc(queueRef, {
      memberId,
      telegramChatId: String(binding.telegramChatId),
      category,
      title,
      message,
      mandatory,
      status: 'pending',
      attempts: 0,
      createdAt: fs.serverTimestamp(),
      createdAtMs: Date.now(),
      createdBy: localStorage.getItem('sr_admin_id') || 'admin'
    });
    return { queued: true, id: queueRef.id };
  }

  async function retryTelegramDelivery(id) {
    const { db, fs } = await firebase_();
    await fs.updateDoc(fs.doc(db, 'secretg_apps', APP_ID, 'telegram_notification_queue', id), {
      status: 'pending',
      retryRequestedAt: fs.serverTimestamp(),
      retryRequestedAtMs: Date.now(),
      retryRequestedBy: localStorage.getItem('sr_admin_id') || 'admin'
    });
    toast('已排入 Telegram 重送佇列', 'success');
  }

  function injectPanel() {
    const adminMain = document.getElementById('admin-main');
    if (!adminMain || document.getElementById('sr-admin-telegram-panel')) return;
    const platformPanel = [...adminMain.querySelectorAll('h2')].find(node => node.textContent.includes('平台通知'))?.closest('.glass-panel');
    if (!platformPanel) return;

    const panel = document.createElement('div');
    panel.id = 'sr-admin-telegram-panel';
    panel.className = 'bg-slate-950/40 border border-sky-500/15 rounded-3xl p-6 glass-panel mb-8';
    panel.innerHTML = `
      <div class="flex items-center justify-between gap-4 mb-5">
        <div><h2 class="text-lg font-bold text-white"><i class="fa-brands fa-telegram text-sky-400 mr-2"></i>Telegram 外部通知</h2>
        <p class="text-xs text-slate-500 mt-1">與平台內通知完全分開；安全通知不能由會員關閉。</p></div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <input id="sr-tg-admin-member" class="bg-slate-900 border border-slate-800 rounded-xl px-3 py-3 text-sm text-slate-200" placeholder="會員帳號 ID">
        <select id="sr-tg-admin-category" class="bg-slate-900 border border-slate-800 rounded-xl px-3 py-3 text-sm text-sky-300">
          <option value="security">帳號安全（必要）</option><option value="review">審核結果</option><option value="service">服務通知</option><option value="promotion">活動公告</option>
        </select>
      </div>
      <input id="sr-tg-admin-title" class="w-full mb-3 bg-slate-900 border border-slate-800 rounded-xl px-3 py-3 text-sm text-slate-200" placeholder="Telegram 通知標題">
      <textarea id="sr-tg-admin-message" class="w-full min-h-[100px] bg-slate-900 border border-slate-800 rounded-2xl px-3 py-3 text-sm text-slate-200 resize-none" placeholder="Telegram 通知內容"></textarea>
      <div class="flex justify-end mt-4"><button id="sr-tg-admin-send" class="px-5 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold"><i class="fa-brands fa-telegram mr-1.5"></i>排入 Telegram 發送佇列</button></div>
      <div class="mt-6 border-t border-slate-800 pt-5"><div class="flex justify-between mb-3"><h3 class="text-xs font-bold text-slate-300">發送與失敗紀錄</h3><span id="sr-tg-admin-count" class="text-[10px] text-slate-500">-</span></div><div id="sr-tg-admin-history" class="space-y-2 max-h-72 overflow-y-auto"></div></div>`;
    platformPanel.insertAdjacentElement('afterend', panel);
    document.getElementById('sr-tg-admin-send').onclick = sendFromPanel;
    listenQueue();
  }

  async function sendFromPanel() {
    const button = document.getElementById('sr-tg-admin-send');
    const memberId = document.getElementById('sr-tg-admin-member').value.trim();
    const category = document.getElementById('sr-tg-admin-category').value;
    const title = document.getElementById('sr-tg-admin-title').value.trim();
    const message = document.getElementById('sr-tg-admin-message').value.trim();
    if (!memberId || !title || !message) return toast('請填寫會員帳號、標題與內容', 'error');
    button.disabled = true;
    try {
      const result = await queueTelegramNotification({ memberId, category, title, message, mandatory: category === 'security' });
      toast(result.skipped ? '會員已關閉此類 Telegram 通知' : '已排入 Telegram 發送佇列', result.skipped ? 'info' : 'success');
      if (!result.skipped) {
        document.getElementById('sr-tg-admin-title').value = '';
        document.getElementById('sr-tg-admin-message').value = '';
      }
    } catch (error) {
      toast(error.message, 'error');
    } finally { button.disabled = false; }
  }

  async function listenQueue() {
    try {
      const { db, fs } = await firebase_();
      fs.onSnapshot(fs.collection(db, 'secretg_apps', APP_ID, 'telegram_notification_queue'), snapshot => {
        const items = [];
        snapshot.forEach(docSnap => items.push({ id: docSnap.id, ...docSnap.data() }));
        items.sort((a,b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
        renderQueue(items);
      });
    } catch (error) { console.warn('Telegram 佇列監聽失敗:', error); }
  }

  function renderQueue(items) {
    const box = document.getElementById('sr-tg-admin-history');
    const count = document.getElementById('sr-tg-admin-count');
    if (!box) return;
    count.textContent = `${items.length} 筆`;
    box.innerHTML = items.length ? items.slice(0, 100).map(item => `
      <div class="rounded-xl border ${item.status === 'failed' ? 'border-rose-500/25' : item.status === 'sent' ? 'border-emerald-500/20' : 'border-sky-500/15'} bg-slate-950/60 p-3">
        <div class="flex justify-between gap-3"><div class="min-w-0"><div class="text-sm font-bold text-slate-200 truncate">${esc(item.title || 'Telegram 通知')}</div><div class="text-[10px] text-slate-500 mt-1">@${esc(item.memberId || '')} · ${esc(item.category || '')} · ${esc(item.status || 'pending')}</div><p class="text-xs text-slate-400 mt-2">${esc(item.message || '')}</p>${item.lastError ? `<p class="text-xs text-rose-300 mt-2">${esc(item.lastError)}</p>` : ''}</div>${item.status === 'failed' ? `<button data-tg-retry="${item.id}" class="shrink-0 text-xs text-sky-300">重送</button>` : ''}</div>
      </div>`).join('') : '<div class="text-xs text-slate-500 text-center py-4">尚無 Telegram 發送紀錄</div>';
    box.querySelectorAll('[data-tg-retry]').forEach(button => button.onclick = () => retryTelegramDelivery(button.dataset.tgRetry));
  }

  window.SecretRoomAdminTelegram = Object.freeze({ queue: queueTelegramNotification, retry: retryTelegramDelivery });
  const observer = new MutationObserver(injectPanel);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', injectPanel) : injectPanel();
})();
