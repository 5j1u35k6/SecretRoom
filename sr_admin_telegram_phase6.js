/**
 * SecretRoom Telegram Phase 6 — 管理端整合
 *
 * 功能：
 * 1. 標準忘記密碼流程改由會員在 Telegram Bot 自助完成。
 * 2. 管理員只處理「未綁定 Telegram／帳號歸屬爭議」等例外。
 * 3. EmailJS UI 改成 Telegram 發送中心與失敗重送。
 * 4. 平台通知與 Telegram 通知維持獨立管道。
 */
(() => {
  'use strict';

  if (window.__SR_ADMIN_TELEGRAM_PHASE6__) return;
  window.__SR_ADMIN_TELEGRAM_PHASE6__ = true;

  const APP_ID = 'secretg-production-node-tw';
  const VERSION = '20260717-telegram-phase6-admin-v1';
  let toolsPromise = null;
  let queued = false;

  const qs = id => document.getElementById(id);
  const toast = (message, type = 'info') => window.showToast?.(message, type);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

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

  function currentAdminId() {
    return String(
      window.SRAdminPhase2?.adminId ||
      sessionStorage.getItem('sr_admin_session_id_v2') ||
      qs('admin-login-id')?.value ||
      'admin'
    ).trim();
  }

  async function getRequest(requestId) {
    const { db, fs } = await tools();
    const ref = fs.doc(db, 'secretg_apps', APP_ID, 'password_reset_requests', requestId);
    const snapshot = await fs.getDoc(ref);
    if (!snapshot.exists()) throw new Error('找不到這筆忘記密碼申請。');
    return { ref, data: { id: snapshot.id, ...snapshot.data() }, db, fs };
  }

  async function hasActiveTelegramBinding(accountId, db, fs) {
    const snapshot = await fs.getDoc(fs.doc(db, 'secretg_apps', APP_ID, 'telegram_bindings', accountId));
    if (!snapshot.exists()) return false;
    const binding = snapshot.data() || {};
    return String(binding.status || '').toLowerCase() === 'active' && Boolean(binding.telegramUserId && binding.telegramChatId);
  }

  async function routePasswordResetToTelegram(requestId) {
    const { ref, data, db, fs } = await getRequest(requestId);
    const accountId = String(data.userId || '').trim();
    if (!accountId) throw new Error('申請缺少會員帳號。');

    const active = await hasActiveTelegramBinding(accountId, db, fs);
    if (!active) {
      await fs.setDoc(ref, {
        status: 'admin_exception_required',
        exceptionReason: 'telegram_not_bound',
        reviewedBy: currentAdminId(),
        reviewedAt: fs.serverTimestamp(),
        reviewedAtMs: Date.now()
      }, { merge: true });
      throw new Error('此會員尚未啟用 Telegram，已標記為人工例外處理。');
    }

    await fs.setDoc(ref, {
      status: 'pending',
      channel: 'telegram',
      telegramSelfService: true,
      adminManualPasswordDisabled: true,
      routedToTelegramAt: fs.serverTimestamp(),
      routedToTelegramAtMs: Date.now(),
      routedBy: currentAdminId()
    }, { merge: true });

    const outboxRef = fs.doc(fs.collection(db, 'secretg_apps', APP_ID, 'telegram_outbox'));
    await fs.setDoc(outboxRef, {
      accountId,
      category: 'security',
      title: '忘記密碼申請待確認',
      message: '你已在 SecretRoom 平台送出忘記密碼申請。請開啟 Bot，點選「忘記密碼」完成驗證。',
      status: 'pending',
      attemptCount: 0,
      nextAttemptAtMs: 0,
      source: 'admin_route_password_reset',
      requestId,
      buttonText: '開啟 SecretRoom Bot',
      buttonUrl: 'https://t.me/SecretRoomtwBot?start=reset',
      createdAt: fs.serverTimestamp(),
      createdAtMs: Date.now()
    });

    return accountId;
  }

  function overridePasswordResetAction() {
    if (window.completePasswordResetRequest?.__srTelegramPhase6) return;

    const replacement = async function completePasswordResetRequest(requestId) {
      try {
        const accountId = await routePasswordResetToTelegram(requestId);
        toast(`帳號 @${accountId} 已改由 Telegram Bot 自助處理。`, 'success');
      } catch (error) {
        toast(error.message || '無法轉交 Telegram 處理', 'error');
      }
    };
    replacement.__srTelegramPhase6 = true;
    window.completePasswordResetRequest = replacement;
  }

  function patchLabels() {
    document.querySelectorAll('button').forEach(button => {
      const label = String(button.textContent || '').trim();
      if (label === '設定新密碼' || label === '寄出 10 分鐘臨時密碼') {
        button.textContent = '轉交 Telegram 自助處理';
        button.title = '系統不再由管理員手動設定臨時密碼。';
      }
      if (/寄測試信給我/.test(label)) {
        button.textContent = 'Telegram 測試已停用';
        button.disabled = true;
        button.title = 'Email 測試已移除；請使用 Telegram 發送中心檢查紀錄。';
      }
    });

    const filter = qs('filter-status');
    if (filter) {
      const emailOption = [...filter.options].find(option => option.value === 'email_failures');
      if (emailOption) emailOption.textContent = '舊 Email 失敗紀錄（唯讀）';
    }

    document.querySelectorAll('#admin-list > div').forEach(card => {
      if (!/忘記密碼/.test(card.textContent || '') || card.querySelector('.sr-tg-reset-note')) return;
      const note = document.createElement('div');
      note.className = 'sr-tg-reset-note mt-3 rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-3 text-xs leading-relaxed text-cyan-200';
      note.textContent = '標準流程由會員在平台申請後，到 Telegram Bot 自助完成。管理員只處理未綁定 Telegram 或帳號歸屬爭議。';
      card.appendChild(note);
    });
  }

  function ensureMigrationPanel() {
    const main = qs('admin-main');
    if (!main || main.classList.contains('hidden') || qs('sr-telegram-phase6-admin-panel')) return;

    const panel = document.createElement('section');
    panel.id = 'sr-telegram-phase6-admin-panel';
    panel.className = 'mb-8 rounded-3xl border border-cyan-500/15 bg-cyan-500/5 p-5';
    panel.innerHTML = `
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div class="text-xs font-black text-cyan-300"><i class="fa-brands fa-telegram mr-1.5"></i>Telegram 通知系統</div>
          <h2 class="mt-1 text-lg font-black text-white">EmailJS 已切換為 Telegram 相容橋接</h2>
          <p class="mt-1 text-xs leading-relaxed text-slate-500">平台通知仍寫入 notifications；外部通知寫入 telegram_outbox；臨時密碼只由 Bot 直接傳送，不進入佇列。</p>
        </div>
        <button id="sr-open-telegram-delivery" class="min-h-[44px] rounded-xl border border-cyan-500/20 px-4 text-xs font-black text-cyan-300">查看 Telegram 發送中心</button>
      </div>`;
    main.querySelector('header')?.insertAdjacentElement('afterend', panel);
    qs('sr-open-telegram-delivery').onclick = () => {
      const delivery = qs('sr-telegram-delivery-panel');
      if (!delivery) return toast('發送中心正在同步，請稍後再試。', 'info');
      delivery.open = true;
      delivery.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  }

  function apply() {
    queued = false;
    overridePasswordResetAction();
    patchLabels();
    ensureMigrationPanel();
    document.documentElement.dataset.srAdminTelegramPhase6 = VERSION;
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  window.SRAdminTelegramPhase6 = Object.freeze({
    routePasswordResetToTelegram
  });

  window.SRAdminRuntime?.register(schedule);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', schedule, { once: true });
  apply();
})();
