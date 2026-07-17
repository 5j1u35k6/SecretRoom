/* SecretRoom Telegram self-service module.
 * Phase coverage: binding, passive password recovery, preferences, request status.
 */
;(() => {
  const APP_ID = 'secretg-production-node-tw';
  const BOT_NAME = 'SecretRoomtwBot';
  const TOKEN_TTL_MS = 10 * 60 * 1000;
  let sdkPromise = null;

  const now = () => Date.now();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const randomToken = () => `bind_${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const sha256 = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(byte => byte.toString(16).padStart(2, '0')).join('');

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

  function currentMember() {
    const state = window.state || {};
    const candidate = state.currentUser || state.user || window.currentUser || window.loggedInUser || null;
    if (candidate && (candidate.id || candidate.userId)) return candidate;
    const id = state.currentUserId || state.userId || localStorage.getItem('sr_user_id') || localStorage.getItem('secretroom_user_id');
    return id ? { id, userId: id } : null;
  }

  function requireMember() {
    const member = currentMember();
    if (!member) throw new Error('請先登入 SecretRoom 再使用此功能');
    return { ...member, id: String(member.id || member.userId), userId: String(member.userId || member.id) };
  }

  async function createBindingLink() {
    const member = requireMember();
    const { db, fs } = await firebase();
    const token = randomToken();
    const tokenHash = await sha256(token);
    const ref = fs.doc(fs.collection(db, 'secretg_apps', APP_ID, 'telegram_binding_tokens'));
    await fs.setDoc(ref, {
      userId: member.userId,
      tokenHash,
      status: 'pending',
      createdAt: fs.serverTimestamp(),
      createdAtMs: now(),
      expiresAtMs: now() + TOKEN_TTL_MS,
      usedAtMs: null,
      source: 'platform_self_service'
    });
    return `https://t.me/${BOT_NAME}?start=${encodeURIComponent(token)}`;
  }

  async function requestPasswordReset() {
    const member = requireMember();
    const { db, fs } = await firebase();
    const existing = await fs.getDocs(fs.query(
      fs.collection(db, 'secretg_apps', APP_ID, 'password_reset_requests'),
      fs.where('userId', '==', member.userId),
      fs.where('status', '==', 'pending')
    ));
    if (!existing.empty) return { reused: true, requestId: existing.docs[0].id };
    const ref = fs.doc(fs.collection(db, 'secretg_apps', APP_ID, 'password_reset_requests'));
    await fs.setDoc(ref, {
      userId: member.userId,
      status: 'pending',
      channel: 'telegram',
      requestedFrom: 'platform',
      createdAt: fs.serverTimestamp(),
      createdAtMs: now(),
      expiresAtMs: now() + 30 * 60 * 1000
    });
    return { reused: false, requestId: ref.id };
  }

  async function saveTelegramPreferences(patch) {
    const member = requireMember();
    const { db, fs } = await firebase();
    await fs.setDoc(fs.doc(db, 'secretg_apps', APP_ID, 'applications', member.userId), {
      telegramNotificationPreferences: {
        security: true,
        review: patch.review !== false,
        service: patch.service !== false,
        promotion: patch.promotion === true,
        updatedAtMs: now()
      }
    }, { merge: true });
  }

  async function getRequestStatus() {
    const member = requireMember();
    const { db, fs } = await firebase();
    const [passwords, accounts] = await Promise.all([
      fs.getDocs(fs.query(fs.collection(db, 'secretg_apps', APP_ID, 'password_reset_requests'), fs.where('userId', '==', member.userId))),
      fs.getDocs(fs.query(fs.collection(db, 'secretg_apps', APP_ID, 'account_requests'), fs.where('userId', '==', member.userId)))
    ]);
    const latest = docs => docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0))[0] || null;
    return { passwordReset: latest(passwords.docs), accountRequest: latest(accounts.docs) };
  }

  function toast(message, type = 'info') {
    if (typeof window.showToast === 'function') return window.showToast(message, type);
    alert(message);
  }

  function closeModal() { document.getElementById('sr-telegram-service-modal')?.remove(); }

  function openModal() {
    closeModal();
    const wrap = document.createElement('div');
    wrap.id = 'sr-telegram-service-modal';
    wrap.className = 'fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-4';
    wrap.innerHTML = `
      <div class="w-full max-w-md rounded-3xl border border-sky-500/20 bg-[#07111d] p-5 shadow-2xl text-slate-100">
        <div class="flex items-start justify-between gap-4 mb-5"><div><div class="text-sky-300 text-xs font-black tracking-[.18em]">TELEGRAM SERVICE</div><h2 class="text-xl font-black mt-1">SecretRoom 會員服務</h2><p class="text-xs text-slate-400 mt-2">Telegram 外部通知與平台內通知分開管理。</p></div><button data-close class="text-slate-400 text-2xl">×</button></div>
        <div class="grid gap-3">
          <button data-action="bind" class="text-left rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4"><b>🔗 綁定帳號</b><div class="text-xs text-slate-400 mt-1">產生一次性連結並前往機器人完成綁定</div></button>
          <button data-action="reset" class="text-left rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4"><b>🔐 忘記密碼</b><div class="text-xs text-slate-400 mt-1">先在平台申請，再到機器人確認</div></button>
          <button data-action="prefs" class="text-left rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4"><b>🔔 Telegram 通知設定</b><div class="text-xs text-slate-400 mt-1">安全通知固定開啟；其他通知可選擇</div></button>
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
          await requestPasswordReset();
          toast('申請已建立，請到 Telegram 機器人點選「忘記密碼」繼續。', 'success');
          window.open(`https://t.me/${BOT_NAME}`, '_blank', 'noopener');
        }
        if (action === 'prefs') {
          const promotion = confirm('要接收 Telegram 活動與公告通知嗎？');
          await saveTelegramPreferences({ review: true, service: true, promotion });
          toast('Telegram 通知偏好已更新', 'success');
        }
        if (action === 'status') {
          const status = await getRequestStatus();
          alert(`忘記密碼：${status.passwordReset?.status || '無申請'}\n帳號申請：${status.accountRequest?.status || '無申請'}`);
        }
      } catch (error) { toast(error.message || String(error), 'error'); }
    });
    document.body.appendChild(wrap);
  }

  function installEntryButton() {
    if (document.getElementById('sr-telegram-service-entry')) return;
    const button = document.createElement('button');
    button.id = 'sr-telegram-service-entry';
    button.type = 'button';
    button.className = 'fixed left-4 bottom-20 md:bottom-6 z-[90] rounded-full border border-sky-400/25 bg-sky-500/15 backdrop-blur-xl px-4 py-3 text-xs font-black text-sky-200 shadow-xl';
    button.textContent = '✈ Telegram 會員服務';
    button.onclick = openModal;
    document.body.appendChild(button);
  }

  window.SRTelegramPlatform = Object.freeze({ createBindingLink, requestPasswordReset, saveTelegramPreferences, getRequestStatus, openModal });
  document.addEventListener('DOMContentLoaded', installEntryButton, { once: true });
})();
