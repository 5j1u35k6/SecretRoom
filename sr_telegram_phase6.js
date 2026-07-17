/**
 * SecretRoom Telegram Phase 6 — 會員端整合
 *
 * 完成項目：
 * 1. Telegram 帳號與平台綁定入口。
 * 2. 忘記密碼採「平台先申請、Bot 再確認」的被動流程。
 * 3. Telegram 通知設定與平台內通知分離。
 * 4. 我的申請進度。
 * 5. 不顯示假的綁定成功或假的密碼重設成功。
 */
(() => {
  'use strict';

  if (window.__SR_TELEGRAM_PHASE6_MEMBER__) return;
  window.__SR_TELEGRAM_PHASE6_MEMBER__ = true;

  const APP_ID = 'secretg-production-node-tw';
  const BOT_USERNAME = 'SecretRoomtwBot';
  const VERSION = '20260717-telegram-phase6-member-v2';
  const REQUEST_COOLDOWN_MS = 2 * 60 * 1000;
  let toolsPromise = null;
  let queued = false;

  const qs = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const toast = (message, type = 'info') => window.showToast?.(message, type);
  const accountId = () => String(window.state?.applicationId || localStorage.getItem('sr_username') || '').trim();

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

  function modalShell(id, title, body) {
    qs(id)?.remove();
    const modal = document.createElement('div');
    modal.id = id;
    modal.className = 'fixed inset-0 z-[280] flex items-center justify-center bg-black/92 backdrop-blur-md p-4';
    modal.innerHTML = `
      <section class="w-full max-w-md rounded-3xl border border-cyan-500/20 bg-[#070a10] p-5 shadow-2xl">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-xs font-black text-cyan-300"><i class="fa-brands fa-telegram mr-1.5"></i>SecretRoom 會員服務</div>
            <h2 class="mt-1 text-xl font-black text-white">${esc(title)}</h2>
          </div>
          <button data-close-modal class="w-11 h-11 rounded-full border border-slate-700 text-slate-300"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="mt-5">${body}</div>
      </section>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('[data-close-modal]').onclick = close;
    modal.onclick = event => { if (event.target === modal) close(); };
    return modal;
  }

  async function getBindingStatus(id) {
    if (!id) return { active: false, binding: null };
    const { db, fs } = await tools();
    const snapshot = await fs.getDoc(fs.doc(db, 'secretg_apps', APP_ID, 'telegram_bindings', id));
    const binding = snapshot.exists() ? snapshot.data() : null;
    const active = Boolean(
      binding &&
      String(binding.status || '').toLowerCase() === 'active' &&
      String(binding.telegramUserId || '').trim() &&
      String(binding.telegramChatId || '').trim()
    );
    return { active, binding };
  }

  function openTelegramService() {
    if (typeof window.SROpenTelegramBinding === 'function') {
      window.SROpenTelegramBinding();
      return;
    }
    window.open(`https://t.me/${BOT_USERNAME}`, '_blank', 'noopener,noreferrer');
  }

  async function submitPasswordResetRequest(userId) {
    const normalizedId = String(userId || '').trim().replace(/^@+/, '');
    if (!normalizedId) throw new Error('請輸入會員帳號。');

    const { db, fs } = await tools();
    const memberRef = fs.doc(db, 'secretg_apps', APP_ID, 'applications', normalizedId);
    const memberSnapshot = await fs.getDoc(memberRef);
    if (!memberSnapshot.exists()) throw new Error('查無可使用忘記密碼服務的會員帳號。');

    const member = memberSnapshot.data() || {};
    const status = String(member.status || '').toLowerCase();
    if (status && !['approved', 'active'].includes(status)) {
      throw new Error('此帳號尚未通過審核，無法使用忘記密碼功能。');
    }

    const pendingQuery = fs.query(
      fs.collection(db, 'secretg_apps', APP_ID, 'password_reset_requests'),
      fs.where('userId', '==', normalizedId),
      fs.where('status', '==', 'pending')
    );
    const pendingSnapshot = await fs.getDocs(pendingQuery);
    if (!pendingSnapshot.empty) {
      const newest = pendingSnapshot.docs
        .map(item => item.data() || {})
        .sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0))[0];
      if (Date.now() - Number(newest.createdAtMs || 0) < REQUEST_COOLDOWN_MS) {
        throw new Error('此帳號已有待處理申請，請直接到 Telegram Bot 繼續。');
      }
    }

    const binding = await getBindingStatus(normalizedId);
    const requestRef = fs.doc(fs.collection(db, 'secretg_apps', APP_ID, 'password_reset_requests'));
    await fs.setDoc(requestRef, {
      userId: normalizedId,
      status: 'pending',
      type: 'forgot_password',
      channel: 'telegram',
      requestedVia: 'platform',
      telegramRequired: true,
      telegramBindingActiveAtRequest: binding.active,
      userDisplayName: member.nickname || member.displayName || normalizedId,
      memberStatus: member.status || '',
      createdAt: fs.serverTimestamp(),
      createdAtMs: Date.now(),
      userAgent: navigator.userAgent || ''
    });

    const adminOutbox = fs.doc(fs.collection(db, 'secretg_apps', APP_ID, 'telegram_admin_outbox'));
    await fs.setDoc(adminOutbox, {
      category: 'security',
      title: '新的忘記密碼申請',
      message: `會員 @${normalizedId} 已在平台送出忘記密碼申請。${binding.active ? '可由會員在 Bot 自助完成。' : '目前未啟用 Telegram，可能需要人工例外處理。'}`,
      accountId: normalizedId,
      requestId: requestRef.id,
      status: 'pending',
      attemptCount: 0,
      nextAttemptAtMs: 0,
      createdAt: fs.serverTimestamp(),
      createdAtMs: Date.now()
    });

    return { requestId: requestRef.id, accountId: normalizedId, bindingActive: binding.active };
  }

  function openPasswordResetRequestModal() {
    const body = `
      <p class="text-sm leading-relaxed text-slate-400">先在這裡建立申請，再到 Telegram Bot 的「忘記密碼」完成驗證。Bot 只有在帳號已綁定時，才會建立 10 分鐘一次性重設連結。</p>
      <label class="mt-5 block text-xs font-black text-slate-300">會員帳號</label>
      <input id="sr-reset-account" class="mt-2 w-full min-h-[48px] rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white" placeholder="例如：your_account">
      <div class="mt-3 rounded-xl border border-amber-500/15 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-200">不需要輸入 Email；新密碼只會由你在一次性重設頁設定。未綁定 Telegram 的舊會員仍需管理員例外處理。</div>
      <button id="sr-reset-submit" class="mt-5 w-full min-h-[48px] rounded-xl bg-[#229ED9] text-sm font-black text-white">送出申請並開啟 Bot</button>`;

    const modal = modalShell('sr-telegram-password-reset-modal', '忘記密碼', body);
    const submit = modal.querySelector('#sr-reset-submit');
    submit.onclick = async () => {
      submit.disabled = true;
      submit.textContent = '正在建立申請…';
      try {
        const result = await submitPasswordResetRequest(modal.querySelector('#sr-reset-account').value);
        modal.remove();
        toast('申請已建立，請到 Telegram Bot 繼續。', 'success');
        const parameter = result.bindingActive ? 'reset' : 'help_reset';
        window.open(`https://t.me/${BOT_USERNAME}?start=${parameter}`, '_blank', 'noopener,noreferrer');
      } catch (error) {
        toast(error.message || '申請建立失敗', 'error');
        submit.disabled = false;
        submit.textContent = '送出申請並開啟 Bot';
      }
    };
  }

  function formatStatus(value) {
    return ({
      pending: '等待處理', processing: '處理中', telegram_verified: 'Telegram 驗證完成，等待設定新密碼', completed: '已完成', approved: '已核准', rejected: '已拒絕', invalid: '無效'
    })[String(value || '').toLowerCase()] || String(value || '未知');
  }

  async function openRequestProgress() {
    const id = accountId();
    if (!id) return toast('請先登入 SecretRoom。', 'info');
    const modal = modalShell('sr-telegram-request-progress-modal', '我的申請進度', '<div class="text-sm text-slate-400">正在讀取…</div>');

    try {
      const { db, fs } = await tools();
      const [memberSnapshot, passwordSnapshot, accountSnapshot] = await Promise.all([
        fs.getDoc(fs.doc(db, 'secretg_apps', APP_ID, 'applications', id)),
        fs.getDocs(fs.query(fs.collection(db, 'secretg_apps', APP_ID, 'password_reset_requests'), fs.where('userId', '==', id))),
        fs.getDocs(fs.query(fs.collection(db, 'secretg_apps', APP_ID, 'account_requests'), fs.where('userId', '==', id)))
      ]);
      const rows = [];
      if (memberSnapshot.exists()) rows.push({ title: '會員申請', status: memberSnapshot.data().status || 'pending', at: memberSnapshot.data().reviewedAtMs || memberSnapshot.data().createdAtMs || 0 });
      passwordSnapshot.forEach(item => rows.push({ title: '忘記密碼', status: item.data().status || 'pending', at: item.data().createdAtMs || 0 }));
      accountSnapshot.forEach(item => rows.push({ title: item.data().type === 'account_delete' ? '帳號刪除' : '帳號申請', status: item.data().status || 'pending', at: item.data().createdAtMs || 0 }));
      rows.sort((a, b) => Number(b.at || 0) - Number(a.at || 0));

      const host = modal.querySelector('.mt-5');
      host.innerHTML = rows.length ? rows.slice(0, 20).map(row => `
        <article class="mb-2 rounded-2xl border border-slate-800 bg-slate-950/65 p-4">
          <div class="flex items-center justify-between gap-3"><strong class="text-sm text-slate-200">${esc(row.title)}</strong><span class="text-xs font-black text-cyan-300">${esc(formatStatus(row.status))}</span></div>
          <div class="mt-2 text-[11px] text-slate-600">${row.at ? new Date(row.at).toLocaleString('zh-TW', { hour12: false }) : '未記錄時間'}</div>
        </article>`).join('') : '<div class="text-sm text-slate-500">目前沒有申請紀錄。</div>';
    } catch (error) {
      modal.querySelector('.mt-5').innerHTML = `<div class="text-sm text-rose-300">讀取失敗：${esc(error.message)}</div>`;
    }
  }

  function ensureMemberServicePanel() {
    const root = window.state?.currentTab === 'profile' ? qs('dashboard-tab-content') : null;
    const existing = qs('sr-telegram-phase6-member-panel');
    if (!root || !accountId()) {
      existing?.remove();
      return;
    }
    if (existing) return;

    const panel = document.createElement('section');
    panel.id = 'sr-telegram-phase6-member-panel';
    panel.className = 'glass-panel crystal-border mb-4 rounded-3xl border border-cyan-500/15 p-5';
    panel.innerHTML = `
      <div class="text-xs font-black text-cyan-300"><i class="fa-brands fa-telegram mr-1.5"></i>Telegram 會員服務</div>
      <h3 class="mt-1 text-lg font-black text-white">帳號、安全與外部通知</h3>
      <p class="mt-1 text-xs leading-relaxed text-slate-500">Telegram 與平台內通知分開管理；安全通知固定開啟。</p>
      <div class="mt-4 grid grid-cols-2 gap-2">
        <button data-sr-phase6-action="binding" class="min-h-[48px] rounded-xl bg-[#229ED9] px-3 text-xs font-black text-white">帳號與綁定</button>
        <button data-sr-phase6-action="reset" class="min-h-[48px] rounded-xl border border-amber-500/20 px-3 text-xs font-black text-amber-300">忘記密碼</button>
        <button data-sr-phase6-action="settings" class="min-h-[48px] rounded-xl border border-cyan-500/20 px-3 text-xs font-black text-cyan-300">Telegram 通知設定</button>
        <button data-sr-phase6-action="requests" class="min-h-[48px] rounded-xl border border-slate-700 px-3 text-xs font-black text-slate-300">我的申請進度</button>
      </div>`;
    root.prepend(panel);
    panel.querySelectorAll('[data-sr-phase6-action]').forEach(button => {
      button.onclick = () => {
        const action = button.dataset.srPhase6Action;
        if (action === 'binding' || action === 'settings') openTelegramService();
        if (action === 'reset') openPasswordResetRequestModal();
        if (action === 'requests') openRequestProgress();
      };
    });
  }

  function replaceLegacyForgotPassword() {
    window.showPasswordResetRequestModal = openPasswordResetRequestModal;
    document.querySelectorAll('button,a').forEach(element => {
      if (/忘記密碼/.test(element.textContent || '') && element.dataset.srPhase6Reset !== '1') {
        element.dataset.srPhase6Reset = '1';
        element.addEventListener('click', event => {
          if (element.closest('#sr-telegram-password-reset-modal')) return;
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          openPasswordResetRequestModal();
        }, true);
      }
    });
  }

  function apply() {
    queued = false;
    replaceLegacyForgotPassword();
    ensureMemberServicePanel();
    document.documentElement.dataset.srTelegramPhase6 = VERSION;
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  window.SRTelegramPhase6 = Object.freeze({
    openService: openTelegramService,
    openPasswordReset: openPasswordResetRequestModal,
    openRequests: openRequestProgress,
    createPasswordResetRequest: submitPasswordResetRequest
  });

  window.SRRuntime?.register(schedule);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', schedule, { once: true });
  apply();
})();
