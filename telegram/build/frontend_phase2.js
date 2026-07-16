/* ===== SecretRoom Telegram Phase 2 member integration ===== */
;(() => {
  if (window.__SR_TELEGRAM_PHASE2_MEMBER__) return;
  window.__SR_TELEGRAM_PHASE2_MEMBER__ = true;

  const APP_ID = 'secretg-production-node-tw';
  const BOT_USERNAME = 'SecretRoomtwBot';
  const TOKEN_TTL_MS = 10 * 60 * 1000;
  const REFRESH_MS = 15000;
  const DEFAULT_PREFERENCES = Object.freeze({
    securityNotifications: true,
    reviewNotifications: true,
    avatarNotifications: true,
    specNotifications: true,
    passwordNotifications: true,
    accountNotifications: true,
    platformNotifications: true,
    rankNotifications: true,
    socialNotifications: false,
    digestMode: 'instant'
  });

  let toolsPromise = null;
  let lastSnapshot = null;
  let lastSnapshotAt = 0;
  let pollingTimer = null;
  let wrappedPasswordMail = false;
  let busy = false;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const accountId = () => String(window.state?.applicationId || localStorage.getItem('sr_username') || '').trim();
  const isMemberArea = () => ['pending', 'dashboard', 'telegram-bind'].includes(String(window.state?.currentView || ''));
  const isDashboard = () => String(window.state?.currentView || '') === 'dashboard';
  const isBoundData = data => Boolean(data?.telegramBound === true || data?.telegramInfo?.id || data?.telegramUserId);
  const toast = (message, type = 'info') => window.showToast?.(message, type);

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

  function randomToken() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function preferenceLabel(key) {
    return ({
      reviewNotifications: '會籍審核',
      avatarNotifications: '頭像審核',
      specNotifications: '黃金 Spec',
      passwordNotifications: '密碼與登入',
      accountNotifications: '帳號狀態',
      platformNotifications: '平台公告',
      rankNotifications: '位階與排名',
      socialNotifications: '按讚與互動'
    })[key] || key;
  }

  async function loadSnapshot(force = false) {
    const id = accountId();
    if (!id) return null;
    if (!force && lastSnapshot && Date.now() - lastSnapshotAt < REFRESH_MS) return lastSnapshot;
    const { db, fs } = await tools();
    const [memberSnap, bindingSnap, preferenceSnap] = await Promise.all([
      fs.getDoc(fs.doc(db, 'secretg_apps', APP_ID, 'applications', id)),
      fs.getDoc(fs.doc(db, 'secretg_apps', APP_ID, 'telegram_bindings', id)),
      fs.getDoc(fs.doc(db, 'secretg_apps', APP_ID, 'telegram_preferences', id))
    ]);
    const member = memberSnap.exists() ? memberSnap.data() : {};
    const binding = bindingSnap.exists() ? bindingSnap.data() : null;
    const preferences = { ...DEFAULT_PREFERENCES, ...(preferenceSnap.exists() ? preferenceSnap.data() : {}) };
    lastSnapshot = { id, member, binding, preferences };
    lastSnapshotAt = Date.now();
    return lastSnapshot;
  }

  async function reconcileLegacyFields(snapshot) {
    if (!snapshot?.binding || snapshot.binding.status !== 'active') return;
    const member = snapshot.member || {};
    if (member.telegramInfo?.id && member.telegramBound === true) return;
    const { db, fs } = await tools();
    const telegramInfo = {
      id: String(snapshot.binding.telegramUserId || ''),
      username: String(snapshot.binding.telegramUsername || ''),
      first_name: String(snapshot.binding.telegramFirstName || '')
    };
    await fs.setDoc(fs.doc(db, 'secretg_apps', APP_ID, 'applications', snapshot.id), {
      telegramBound: true,
      telegramUserId: telegramInfo.id,
      telegramChatId: String(snapshot.binding.telegramChatId || ''),
      telegramUsername: telegramInfo.username,
      telegramInfo,
      telegramLinkedAtMs: Number(snapshot.binding.linkedAtMs || Date.now())
    }, { merge: true });
    window.state.userData = { ...(window.state.userData || {}), telegramBound: true, telegramInfo, telegramUserId: telegramInfo.id };
    snapshot.member = window.state.userData;
  }

  async function generateBindingLink() {
    if (busy) return;
    busy = true;
    try {
      const id = accountId();
      if (!id) throw new Error('請先登入 SecretRoom');
      const { db, fs } = await tools();
      const memberRef = fs.doc(db, 'secretg_apps', APP_ID, 'applications', id);
      const memberSnap = await fs.getDoc(memberRef);
      if (!memberSnap.exists()) throw new Error('找不到會員資料');
      const member = memberSnap.data() || {};
      if (!['pending', 'approved', 'active'].includes(String(member.status || '').toLowerCase())) throw new Error('目前帳號狀態無法建立 Telegram 綁定');

      const previousToken = String(member.telegramLastLinkToken || '');
      if (previousToken) {
        try {
          await fs.setDoc(fs.doc(db, 'secretg_apps', APP_ID, 'telegram_link_tokens', previousToken), {
            status: 'revoked', revokedAtMs: Date.now(), revokedBy: id
          }, { merge: true });
        } catch (_) {}
      }

      const token = randomToken();
      const expiresAtMs = Date.now() + TOKEN_TTL_MS;
      await fs.setDoc(fs.doc(db, 'secretg_apps', APP_ID, 'telegram_link_tokens', token), {
        accountId: id,
        status: 'active',
        createdAt: fs.serverTimestamp(),
        createdAtMs: Date.now(),
        expiresAtMs,
        createdByUid: String(window.state?.userId || ''),
        purpose: 'telegram_bind'
      });
      await fs.setDoc(memberRef, {
        telegramLastLinkToken: token,
        telegramLinkStatus: 'active',
        telegramLinkExpiresAtMs: expiresAtMs,
        telegramLinkCreatedAtMs: Date.now()
      }, { merge: true });

      const url = `https://t.me/${BOT_USERNAME}?start=bind_${token}`;
      const field = document.getElementById('sr-tg-link-value');
      if (field) field.value = url;
      const expiry = document.getElementById('sr-tg-link-expiry');
      if (expiry) expiry.textContent = '此連結 10 分鐘內有效，且只能使用一次。';
      window.open(url, '_blank', 'noopener,noreferrer');
      toast('已產生 Telegram 專屬綁定連結', 'success');
      startBindingPoll();
    } catch (error) {
      console.error('Telegram 綁定連結產生失敗:', error);
      toast(error.message || '無法產生綁定連結', 'error');
    } finally {
      busy = false;
    }
  }

  async function copyBindingLink() {
    const value = document.getElementById('sr-tg-link-value')?.value || '';
    if (!value) return toast('請先產生綁定連結', 'info');
    try { await navigator.clipboard.writeText(value); toast('綁定連結已複製', 'success'); }
    catch (_) { toast('無法自動複製，請長按連結複製', 'error'); }
  }

  function startBindingPoll() {
    clearInterval(pollingTimer);
    let attempts = 0;
    pollingTimer = setInterval(async () => {
      attempts += 1;
      try {
        const snapshot = await loadSnapshot(true);
        if (snapshot?.binding?.status === 'active') {
          clearInterval(pollingTimer);
          pollingTimer = null;
          await reconcileLegacyFields(snapshot);
          renderModal(snapshot);
          ensureCard(snapshot);
          toast('Telegram 綁定完成', 'success');
        }
      } catch (_) {}
      if (attempts >= 60) { clearInterval(pollingTimer); pollingTimer = null; }
    }, 3000);
  }

  async function unbindTelegram() {
    const snapshot = await loadSnapshot(true);
    if (!snapshot?.binding || snapshot.binding.status !== 'active') return toast('目前沒有有效的 Telegram 綁定', 'info');
    if (!window.confirm('確定解除 Telegram 綁定？解除後將停止接收 Telegram 通知。')) return;
    const { db, fs } = await tools();
    const now = Date.now();
    const userId = String(snapshot.binding.telegramUserId || '');
    await fs.setDoc(fs.doc(db, 'secretg_apps', APP_ID, 'telegram_bindings', snapshot.id), {
      status: 'revoked', unlinkedAt: fs.serverTimestamp(), unlinkedAtMs: now, unlinkedBy: snapshot.id
    }, { merge: true });
    if (userId) {
      await fs.setDoc(fs.doc(db, 'secretg_apps', APP_ID, 'telegram_users', userId), {
        status: 'revoked', unlinkedAtMs: now
      }, { merge: true });
    }
    await fs.setDoc(fs.doc(db, 'secretg_apps', APP_ID, 'applications', snapshot.id), {
      telegramBound: false,
      telegramInfo: null,
      telegramUserId: null,
      telegramChatId: null,
      telegramUsername: null,
      telegramUnlinkedAtMs: now,
      telegramLinkStatus: 'unbound'
    }, { merge: true });
    window.state.userData = { ...(window.state.userData || {}), telegramBound: false, telegramInfo: null, telegramUserId: null, telegramChatId: null, telegramUsername: null };
    lastSnapshot = null;
    const refreshed = await loadSnapshot(true);
    renderModal(refreshed);
    ensureCard(refreshed);
    toast('Telegram 綁定已解除', 'success');
  }

  async function updatePreference(key, value) {
    if (!(key in DEFAULT_PREFERENCES) || key === 'securityNotifications') return;
    const id = accountId();
    if (!id) return;
    const { db, fs } = await tools();
    await fs.setDoc(fs.doc(db, 'secretg_apps', APP_ID, 'telegram_preferences', id), {
      accountId: id,
      [key]: value,
      securityNotifications: true,
      updatedAt: fs.serverTimestamp(),
      updatedAtMs: Date.now()
    }, { merge: true });
    lastSnapshot = null;
    renderModal(await loadSnapshot(true));
  }

  async function queueSecurityNotification(title, message) {
    const snapshot = await loadSnapshot(true).catch(() => null);
    if (!snapshot?.binding || snapshot.binding.status !== 'active') return;
    const { db, fs } = await tools();
    const ref = fs.doc(fs.collection(db, 'secretg_apps', APP_ID, 'telegram_outbox'));
    await fs.setDoc(ref, {
      accountId: snapshot.id,
      category: 'security',
      title,
      message,
      status: 'pending',
      attemptCount: 0,
      source: 'member_security_event',
      buttonText: '開啟 SecretRoom',
      buttonUrl: location.origin + location.pathname,
      createdAt: fs.serverTimestamp(),
      createdAtMs: Date.now(),
      nextAttemptAtMs: 0
    });
  }

  function renderModal(snapshot) {
    let modal = document.getElementById('sr-telegram-phase2-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'sr-telegram-phase2-modal';
      modal.className = 'fixed inset-0 z-[260] hidden items-center justify-center bg-black/90 backdrop-blur-md p-4';
      document.body.appendChild(modal);
    }
    const bound = snapshot?.binding?.status === 'active' || isBoundData(snapshot?.member);
    const preferences = { ...DEFAULT_PREFERENCES, ...(snapshot?.preferences || {}) };
    const toggles = Object.keys(DEFAULT_PREFERENCES).filter(key => !['securityNotifications', 'digestMode'].includes(key)).map(key => `
      <label class="sr-tg-pref-row">
        <span>${esc(preferenceLabel(key))}</span>
        <input type="checkbox" data-sr-tg-pref="${key}" ${preferences[key] ? 'checked' : ''}>
      </label>`).join('');
    modal.innerHTML = `
      <div class="sr-tg-modal-card">
        <div class="flex items-start justify-between gap-4">
          <div><div class="sr-tg-eyebrow"><i class="fa-brands fa-telegram"></i> Telegram 會員服務</div><h2 class="text-xl font-black text-white mt-1">帳號綁定與通知</h2></div>
          <button id="sr-tg-close" class="sr-tg-icon-button" aria-label="關閉"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="sr-tg-status ${bound ? 'sr-tg-bound' : 'sr-tg-unbound'}">
          <strong>${bound ? '已完成綁定' : '尚未綁定'}</strong>
          <span>${bound ? `Telegram @${esc(snapshot?.binding?.telegramUsername || snapshot?.member?.telegramUsername || '已驗證帳號')}` : '產生短效專屬連結後，至 Telegram 完成一次性驗證。'}</span>
        </div>
        ${bound ? `
          <div class="sr-tg-settings"><div class="sr-tg-section-title">通知偏好</div>
            <label class="sr-tg-pref-row sr-tg-fixed"><span>安全通知</span><span>固定開啟</span></label>${toggles}
          </div>
          <button id="sr-tg-unbind" class="sr-tg-danger-button">解除 Telegram 綁定</button>
        ` : `
          <div class="sr-tg-link-box">
            <input id="sr-tg-link-value" readonly placeholder="按下方按鈕產生 10 分鐘專屬連結">
            <button id="sr-tg-copy" class="sr-tg-secondary-button">複製</button>
          </div>
          <div id="sr-tg-link-expiry" class="text-xs text-slate-500 mt-2">連結尚未產生。</div>
          <button id="sr-tg-generate" class="sr-tg-primary-button"><i class="fa-brands fa-telegram"></i> 產生並開啟綁定連結</button>
        `}
      </div>`;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    modal.querySelector('#sr-tg-close').onclick = () => { modal.classList.add('hidden'); modal.classList.remove('flex'); };
    modal.addEventListener('click', event => { if (event.target === modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); } }, { once: true });
    modal.querySelector('#sr-tg-generate')?.addEventListener('click', generateBindingLink);
    modal.querySelector('#sr-tg-copy')?.addEventListener('click', copyBindingLink);
    modal.querySelector('#sr-tg-unbind')?.addEventListener('click', unbindTelegram);
    modal.querySelectorAll('[data-sr-tg-pref]').forEach(input => input.addEventListener('change', () => updatePreference(input.dataset.srTgPref, input.checked)));
  }

  async function openModal() {
    try { renderModal(await loadSnapshot(true)); }
    catch (error) { console.error(error); toast('無法讀取 Telegram 設定', 'error'); }
  }

  function patchLegacyBindView() {
    if (String(window.state?.currentView || '') !== 'telegram-bind') return;
    const anchor = document.getElementById('telegram-widget-anchor');
    if (!anchor) return;
    if (!anchor.querySelector('#sr-tg-open-bind-modal')) {
      anchor.innerHTML = `<button id="sr-tg-open-bind-modal" class="sr-tg-primary-button"><i class="fa-brands fa-telegram"></i> 產生一次性 Telegram 綁定連結</button>`;
      anchor.querySelector('#sr-tg-open-bind-modal').onclick = openModal;
    }
    const description = anchor.closest('.p-6')?.querySelector('p');
    if (description) description.textContent = '使用 10 分鐘有效的一次性連結完成安全綁定，不需要輸入 Telegram 密碼。';
    window.onTelegramAuth = () => toast('請使用一次性綁定連結完成驗證。', 'info');
  }

  function ensureCard(snapshot = lastSnapshot) {
    const id = accountId();
    const existing = document.getElementById('sr-telegram-member-card');
    const view = String(window.state?.currentView || '');
    if (!id || !['dashboard', 'pending'].includes(view)) { existing?.remove(); return; }
    const host = view === 'dashboard'
      ? (document.getElementById('dashboard-tab-content') || document.querySelector('#app .overflow-y-auto'))
      : (document.querySelector('#app .overflow-y-auto') || document.querySelector('#app > div'));
    if (!host) return;
    let card = existing;
    if (!card) {
      card = document.createElement('section');
      card.id = 'sr-telegram-member-card';
      card.className = 'sr-tg-member-card';
      host.prepend(card);
    }
    const bound = snapshot?.binding?.status === 'active' || isBoundData(snapshot?.member || window.state?.userData);
    card.innerHTML = `<div><div class="sr-tg-eyebrow"><i class="fa-brands fa-telegram"></i> Telegram</div><div class="text-sm font-black text-white mt-1">${bound ? '通知服務已綁定' : (view === 'pending' ? '先綁定以接收審核結果' : '完成帳號綁定')}</div><div class="text-xs text-slate-400 mt-1">${bound ? '可接收審核、安全與帳號狀態通知。' : '使用 10 分鐘一次性連結安全綁定。'}</div></div><button id="sr-tg-open-settings" class="sr-tg-card-button">${bound ? '通知設定' : '立即綁定'}</button>`;
    card.querySelector('#sr-tg-open-settings').onclick = openModal;
  }

  function wrapPasswordSecurityMail() {
    if (wrappedPasswordMail || typeof window.SRP?.sendMail !== 'function') return;
    const original = window.SRP.sendMail;
    wrappedPasswordMail = true;
    window.SRP.sendMail = async function(user, id, message) {
      const result = await original.apply(this, arguments);
      queueSecurityNotification('SecretRoom 密碼已更新', message || '你的 SecretRoom 密碼剛剛已更新。若不是本人操作，請立即聯絡管理員。').catch(error => console.warn('Telegram 密碼通知排隊失敗:', error));
      return result;
    };
  }

  async function apply() {
    wrapPasswordSecurityMail();
    patchLegacyBindView();
    ensureCard();
    if (!accountId() || !isMemberArea()) return;
    if (!lastSnapshot || Date.now() - lastSnapshotAt > REFRESH_MS) {
      try {
        const snapshot = await loadSnapshot();
        if (snapshot?.binding?.status === 'active') await reconcileLegacyFields(snapshot);
        ensureCard(snapshot);
        if (window.state?.currentView === 'telegram-bind' && snapshot?.binding?.status === 'active') {
          setTimeout(() => location.reload(), 250);
        }
      } catch (error) {
        console.warn('Telegram 會員狀態同步失敗:', error);
      }
    }
  }

  window.SRTelegramPhase2 = Object.freeze({ open: openModal, createLink: generateBindingLink, unbind: unbindTelegram, refresh: () => loadSnapshot(true), queueSecurityNotification });
  window.SRRuntime?.register(apply);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { lastSnapshotAt = 0; window.SRRuntime?.schedule?.(); } });
  apply();
})();
