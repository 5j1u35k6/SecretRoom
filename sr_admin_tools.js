// SecretRoom admin helpers and phase-one dashboard UX improvements.
const AID = 'secretg-production-node-tw';
const MAIL = { publicKey: 'XggJY7iHQcZYYhNY7', serviceId: 'service_1ou10mi', templateId: 'template_sr_security' };
let DB, FS;
async function T() {
  if (DB && FS) return { db: DB, fs: FS };
  const appMod = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js');
  const firestoreMod = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
  const apps = appMod.getApps();
  if (!apps.length) throw new Error('Firebase 尚未初始化');
  DB = firestoreMod.getFirestore(apps[0]);
  FS = firestoreMod;
  return { db: DB, fs: FS };
}
function C() { return 'SR-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '!'; }
function fmtTime(ms) { return new Date(ms).toLocaleString('zh-TW', { hour12: false }); }
function buildRecoveryMessage(code, expiresAtMs) {
  return [`你的 SecretRoom 臨時密碼：${code}`, '', '10 分鐘內有效。', `到期時間：${fmtTime(expiresAtMs)}`, '', '請用帳號和這組臨時密碼登入。', '登入後記得立刻換成自己的密碼。', '', '不是你申請的話，請聯絡管理員。'].join('\n');
}
async function sendRecoveryMail(user, uid, code, expiresAtMs) {
  if (!window.emailjs) throw new Error('Email 功能還沒準備好');
  if (!user.email) throw new Error('這個帳號沒有綁定 Email');
  await emailjs.send(MAIL.serviceId, MAIL.templateId, { to_email: user.email, to_name: user.nickname || uid || 'SecretRoom Account', status_text: 'SecretRoom 臨時密碼', message: buildRecoveryMessage(code, expiresAtMs), email_type: '帳號安全提醒', member_id: uid || '' }, { publicKey: MAIL.publicKey });
}
async function restoreUserCredential(userRef, fs, previous) {
  try { await fs.updateDoc(userRef, previous); }
  catch (restoreErr) { console.error('臨時密碼寄送失敗後還原密碼狀態失敗:', restoreErr); }
}
window.completePasswordResetRequest = async function completePasswordResetRequest(id) {
  let userRef = null;
  let previousCredentialState = null;
  try {
    const { db, fs } = await T();
    const reqRef = fs.doc(db, 'secretg_apps', AID, 'password_reset_requests', id);
    const reqSnap = await fs.getDoc(reqRef);
    if (!reqSnap.exists()) throw new Error('找不到這筆忘記密碼申請');
    const req = reqSnap.data() || {};
    const uid = req.userId;
    if (!uid) throw new Error('這筆申請缺少帳號 ID');
    userRef = fs.doc(db, 'secretg_apps', AID, 'applications', uid);
    const userSnap = await fs.getDoc(userRef);
    if (!userSnap.exists()) throw new Error('找不到帳號資料');
    const user = userSnap.data() || {};
    if (!user.email) throw new Error('這個帳號沒有綁定 Email，無法寄出臨時密碼');
    previousCredentialState = { password: user.password || '', mustChangePassword: !!user.mustChangePassword, forcePasswordChange: !!user.forcePasswordChange, tempPasswordActive: !!user.tempPasswordActive, passwordChangeRequired: !!user.passwordChangeRequired, tempPasswordIssuedAtMs: user.tempPasswordIssuedAtMs || null, tempPasswordExpiresAtMs: user.tempPasswordExpiresAtMs || null, temporaryCredentialExpiresAtMs: user.temporaryCredentialExpiresAtMs || null, lastPasswordChangeMethod: user.lastPasswordChangeMethod || null };
    const code = C();
    const now = Date.now();
    const expiresAtMs = now + 10 * 60 * 1000;
    await fs.updateDoc(userRef, { password: code, mustChangePassword: true, forcePasswordChange: true, tempPasswordActive: true, passwordChangeRequired: true, tempPasswordIssuedAtMs: now, tempPasswordExpiresAtMs: expiresAtMs, temporaryCredentialExpiresAtMs: expiresAtMs, passwordChangedAt: fs.serverTimestamp(), passwordChangedAtMs: now, passwordChangedBy: 'admin', lastPasswordChangeMethod: 'admin_temporary_email' });
    try { await sendRecoveryMail(user, uid, code, expiresAtMs); }
    catch (mailErr) {
      await restoreUserCredential(userRef, fs, previousCredentialState);
      await fs.updateDoc(reqRef, { status: 'email_failed', emailSent: false, emailError: mailErr.message || String(mailErr), emailFailedAt: fs.serverTimestamp(), emailFailedAtMs: Date.now() });
      throw mailErr;
    }
    await fs.updateDoc(reqRef, { status: 'completed', completedAt: fs.serverTimestamp(), completedAtMs: Date.now(), temporaryCredentialIssued: true, temporaryCredentialExpiresAtMs: expiresAtMs, emailSent: true, emailSentAt: fs.serverTimestamp(), emailSentAtMs: Date.now() });
    window.showToast?.(`帳號 @${uid} 的臨時密碼已寄出，10 分鐘內有效。`, 'success');
  } catch (err) {
    console.error(err);
    window.showToast?.('臨時密碼沒寄成功：' + err.message, 'error');
  }
};
window.rejectPasswordResetRequest = async function rejectPasswordResetRequest(id) {
  try {
    const { db, fs } = await T();
    const ref = fs.doc(db, 'secretg_apps', AID, 'password_reset_requests', id);
    const snap = await fs.getDoc(ref);
    const uid = snap.exists() ? String(snap.data()?.userId || '') : '';
    await fs.updateDoc(ref, { status: 'rejected', rejectedAt: fs.serverTimestamp(), rejectedAtMs: Date.now() });
    window.showToast?.(uid ? `已拒絕帳號 @${uid} 的忘記密碼申請。` : '已拒絕這筆忘記密碼申請。', 'info');
  } catch (err) {
    console.error(err);
    window.showToast?.('操作失敗：' + err.message, 'error');
  }
};

(() => {
  const VERSION = '20260711-admin-phase1-v1';
  const FILTER_KEY = 'sr_admin_filter';
  const SEARCH_KEY = 'sr_admin_search';
  const SORT_KEY = 'sr_admin_sort';
  const groups = { member: ['pending','avatar_pending','spec_pending','approved','active','rejected','all'], safety: ['reported_posts','reported_comments'], security: ['password_reset_requests','account_delete_requests','email_failures'], system: ['all'] };
  const labels = { all:'全部', pending:'待審核', avatar_pending:'頭像待審', spec_pending:'Spec 待審', reported_posts:'貼文檢舉', reported_comments:'留言檢舉', account_delete_requests:'刪除帳號', password_reset_requests:'忘記密碼', email_failures:'寄信失敗', approved:'已通過', active:'使用中', rejected:'已拒絕' };
  const statFilters = {
    'count-pending': 'pending',
    'count-avatar-pending': 'avatar_pending',
    'count-reports': 'reported_posts',
    'count-total': 'all',
    'count-account-requests': 'account_delete_requests',
    'count-password-reset': 'password_reset_requests'
  };
  const qs = id => document.getElementById(id);
  const tx = value => String(value || '').replace(/\s+/g, ' ').trim();
  const current = () => qs('filter-status')?.value || 'pending';
  const groupOf = value => groups.safety.includes(value) ? 'safety' : groups.security.includes(value) ? 'security' : 'member';
  const isExplicitAdmin = data => !!data && data.enabled !== false && (data.role === 'admin' || data.isAdmin === true || data.canAdmin === true || data.adminApproved === true);
  let scheduled = false;
  let lastMetricAt = 0;
  let lastActionContext = '';
  let actionContextTimer = null;

  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char])); }
  function sync(value = current()) {
    document.querySelectorAll('[data-sr-admin-group]').forEach(button => button.classList.toggle('sr-admin-group-active', button.dataset.srAdminGroup === groupOf(value)));
    document.querySelectorAll('[data-sr-stat-filter]').forEach(card => card.classList.toggle('sr-admin-stat-active', card.dataset.srStatFilter === value));
  }
  function setFilter(value) {
    const select = qs('filter-status');
    if (!select) return;
    select.value = value;
    localStorage.setItem(FILTER_KEY, value);
    typeof window.filterApplications === 'function' ? window.filterApplications() : select.dispatchEvent(new Event('change', { bubbles:true }));
    sync(value);
    scheduleApply();
  }

  async function refreshAdminMetric(force = false) {
    const element = qs('count-admins');
    if (!element || element.dataset.srCounting === '1') return;
    if (!force && Date.now() - lastMetricAt < 30000) return;
    element.dataset.srCounting = '1';
    try {
      const { db, fs } = await T();
      const snapshot = await fs.getDocs(fs.collection(db, 'secretg_apps', AID, 'admins'));
      const active = [];
      snapshot.forEach(documentSnapshot => { const data = documentSnapshot.data() || {}; if (isExplicitAdmin(data)) active.push(documentSnapshot.id); });
      element.textContent = active.length;
      element.title = active.length ? `目前可登入後台：${active.join(', ')}` : '目前沒有可登入的管理員';
      const card = element.closest('.rounded-2xl, .bg-slate-950\/60') || element.parentElement;
      if (card && !card.querySelector('.sr-admin-count-note')) {
        const note = document.createElement('div');
        note.className = 'sr-admin-count-note text-xs text-slate-500 mt-1 leading-snug';
        note.textContent = '只算 admins 名單，帳號資料裡的舊權限不列入。';
        card.appendChild(note);
      }
      lastMetricAt = Date.now();
    } catch (err) {
      console.warn('後台管理員數量更新失敗:', err);
    } finally {
      element.dataset.srCounting = '0';
    }
  }

  function enforceExplicitAdminLogin() {
    const button = qs('admin-login-submit');
    if (!button || button.dataset.srAdminGuard === '1' || typeof button.onclick !== 'function') return;
    const original = button.onclick;
    button.dataset.srAdminGuard = '1';
    button.onclick = async function(event) {
      const adminId = qs('admin-login-id')?.value?.trim();
      if (!adminId) return original.call(this, event);
      try {
        const { db, fs } = await T();
        const snapshot = await fs.getDoc(fs.doc(db, 'secretg_apps', AID, 'admins', adminId));
        if (!snapshot.exists() || !isExplicitAdmin(snapshot.data() || {})) {
          event?.preventDefault?.();
          event?.stopPropagation?.();
          const message = `帳號 ${adminId} 不在 admins 名單內，無法登入後台。`;
          const box = qs('admin-login-error');
          if (box) { box.textContent = message; box.classList.remove('hidden'); }
          window.showToast?.(message, 'error');
          return;
        }
      } catch (err) {
        console.warn('管理員名單檢查失敗，交由原登入流程處理:', err);
      }
      return original.call(this, event);
    };
  }

  function addHeader() {
    const header = document.querySelector('#admin-main header');
    const status = qs('connection-status');
    if (!header || qs('sr-admin-env-badge')) return;
    const box = document.createElement('div');
    box.id = 'sr-admin-env-badge';
    box.className = 'flex flex-wrap items-center gap-2 text-xs font-black tracking-wider';
    box.innerHTML = '<span class="px-3 py-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">Production</span><span class="px-3 py-2 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-300">敏感操作會再次確認</span><button id="sr-admin-logout" class="min-h-[44px] px-3 py-2 rounded-full border border-slate-700 bg-slate-950/70 text-slate-300 hover:text-white hover:border-amber-500/40 transition">登出</button>';
    (status?.parentElement || header).appendChild(box);
    qs('sr-admin-logout').onclick = () => { localStorage.removeItem('sr_admin_id'); location.reload(); };
  }

  function addStatsLabel() {
    const main = qs('admin-main');
    const grid = main?.querySelector('.grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-5') || main?.querySelector('.grid.grid-cols-1');
    if (!grid || qs('sr-admin-stats-label')) return;
    const label = document.createElement('div');
    label.id = 'sr-admin-stats-label';
    label.className = 'mb-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-black tracking-wider text-slate-500';
    label.innerHTML = '<div class="rounded-2xl border border-amber-500/10 bg-slate-950/35 px-4 py-2"><i class="fa-solid fa-list-check text-amber-400 mr-1.5"></i> 待處理</div><div class="rounded-2xl border border-rose-500/10 bg-slate-950/35 px-4 py-2"><i class="fa-solid fa-shield-halved text-rose-300 mr-1.5"></i> 風險項目</div><div class="rounded-2xl border border-cyan-500/10 bg-slate-950/35 px-4 py-2"><i class="fa-solid fa-chart-line text-cyan-300 mr-1.5"></i> 營運概況</div>';
    grid.parentElement.insertBefore(label, grid);
  }

  function bindStatCards() {
    Object.entries(statFilters).forEach(([countId, filter]) => {
      const count = qs(countId);
      const card = count?.closest('.rounded-2xl, .bg-slate-950\/60, .admin-stat-mini') || count?.parentElement;
      if (!card || card.dataset.srStatBound === '1') return;
      card.dataset.srStatBound = '1';
      card.dataset.srStatFilter = filter;
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `查看${labels[filter] || filter}`);
      card.classList.add('sr-admin-stat-card');
      const open = () => {
        const search = qs('admin-search');
        if (search) { search.value = ''; localStorage.removeItem(SEARCH_KEY); }
        setFilter(filter);
        qs('admin-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      card.addEventListener('click', open);
      card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
    });
    sync();
  }

  function renderSubs(group, active) {
    const box = qs('sr-admin-subfilters');
    if (!box) return;
    const renderKey = `${group}:${active}`;
    if (box.dataset.srRenderKey === renderKey) return;
    box.dataset.srRenderKey = renderKey;
    box.innerHTML = (groups[group] || groups.member).map(value => `<button type="button" data-filter-value="${value}" class="sr-admin-subfilter ${active === value ? 'sr-admin-subfilter-active' : ''}">${labels[value] || value}</button>`).join('');
    box.querySelectorAll('[data-filter-value]').forEach(button => button.onclick = () => { renderSubs(group, button.dataset.filterValue); setFilter(button.dataset.filterValue); });
  }

  function addGroups() {
    const select = qs('filter-status');
    const search = qs('admin-search');
    if (!select) return;
    if (search) search.placeholder = '搜尋帳號、暱稱、Email、檢舉原因或貼文';
    Array.from(select.options).forEach(option => { if (labels[option.value]) option.textContent = labels[option.value]; });
    if (!qs('sr-admin-task-groups')) {
      const wrap = document.createElement('div');
      wrap.id = 'sr-admin-task-groups';
      wrap.className = 'mb-4 p-3 rounded-3xl border border-amber-500/10 bg-slate-950/35';
      wrap.innerHTML = '<div class="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3"><button data-sr-admin-group="member" class="sr-admin-group-btn" type="button"><i class="fa-solid fa-user-check"></i> 帳號審核</button><button data-sr-admin-group="safety" class="sr-admin-group-btn" type="button"><i class="fa-solid fa-shield-halved"></i> 內容檢舉</button><button data-sr-admin-group="security" class="sr-admin-group-btn" type="button"><i class="fa-solid fa-key"></i> 帳號處理</button><button data-sr-admin-group="system" class="sr-admin-group-btn" type="button"><i class="fa-solid fa-bullhorn"></i> 平台通知</button></div><div id="sr-admin-subfilters" class="flex gap-2 overflow-x-auto pb-1"></div>';
      const panel = qs('admin-list')?.parentElement;
      const row = panel?.querySelector('.flex.items-center.justify-between.mb-6');
      row ? row.insertAdjacentElement('afterend', wrap) : select.parentElement?.parentElement?.insertAdjacentElement('afterend', wrap);
      wrap.querySelectorAll('[data-sr-admin-group]').forEach(button => button.onclick = () => {
        const group = button.dataset.srAdminGroup;
        const first = group === 'member' ? 'pending' : group === 'safety' ? 'reported_posts' : group === 'security' ? 'password_reset_requests' : 'all';
        renderSubs(group, first);
        setFilter(first);
      });
    }
    renderSubs(groupOf(current()), current());
    sync();
  }

  function restoreFilters() {
    const select = qs('filter-status');
    const search = qs('admin-search');
    if (!select || select.dataset.srRestored === '1') return;
    select.dataset.srRestored = '1';
    const savedFilter = localStorage.getItem(FILTER_KEY);
    const savedSearch = localStorage.getItem(SEARCH_KEY);
    if (savedFilter && Array.from(select.options).some(option => option.value === savedFilter)) select.value = savedFilter;
    if (search && savedSearch) search.value = savedSearch;
    select.addEventListener('change', () => { localStorage.setItem(FILTER_KEY, select.value); sync(select.value); scheduleApply(); });
    if (search && search.dataset.srPersistBound !== '1') {
      search.dataset.srPersistBound = '1';
      search.addEventListener('input', () => { localStorage.setItem(SEARCH_KEY, search.value); scheduleApply(); });
    }
    if ((savedFilter || savedSearch) && typeof window.filterApplications === 'function') window.filterApplications();
  }

  function parseCardTime(card) {
    const text = tx(card);
    const dateMatch = text.match(/(20\d{2})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})(?:日)?(?:\s+|,\s*)(\d{1,2})[:：](\d{2})/);
    if (dateMatch) return new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]), Number(dateMatch[4]), Number(dateMatch[5])).getTime();
    const relative = text.match(/(\d+)\s*(分鐘|小時|天)前/);
    if (relative) {
      const amount = Number(relative[1]);
      const unit = relative[2] === '分鐘' ? 60000 : relative[2] === '小時' ? 3600000 : 86400000;
      return Date.now() - amount * unit;
    }
    return 0;
  }

  function cardRisk(card) {
    const text = tx(card);
    let score = 0;
    if (/檢舉|風險|發送失敗|刪除帳號/.test(text)) score += 3;
    if (/待審核|審查中|申請/.test(text)) score += 2;
    if (/已處理|已通過|已拒絕|補寄成功/.test(text)) score -= 2;
    return score;
  }

  function sortAndCountCards() {
    const list = qs('admin-list');
    const count = qs('sr-admin-result-count');
    if (!list) return;
    const cards = Array.from(list.children).filter(node => node instanceof HTMLElement && !node.classList.contains('sr-admin-empty-state'));
    const reviewCards = cards.filter(card => !/目前沒有|正在讀取|正在檢索/.test(tx(card)));
    const countText = `${reviewCards.length} 筆結果`;
    if (count && count.textContent !== countText) count.textContent = countText;
    const sort = qs('sr-admin-sort')?.value || localStorage.getItem(SORT_KEY) || 'newest';
    const contentKey = reviewCards.map(card => tx(card).slice(0, 240)).sort().join('|');
    const stateKey = `${sort}::${contentKey}`;
    if (list.dataset.srSortKey === stateKey) return;
    const sorted = [...reviewCards].sort((a, b) => {
      if (sort === 'oldest') return parseCardTime(a) - parseCardTime(b);
      if (sort === 'risk') return cardRisk(b) - cardRisk(a) || parseCardTime(b) - parseCardTime(a);
      if (sort === 'waiting') return parseCardTime(a) - parseCardTime(b) || cardRisk(b) - cardRisk(a);
      return parseCardTime(b) - parseCardTime(a);
    });
    sorted.forEach(card => list.appendChild(card));
    list.dataset.srSortKey = stateKey;
    const updated = qs('sr-admin-last-updated');
    if (updated) updated.textContent = `更新於 ${new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  }

  function addToolbar() {
    const list = qs('admin-list');
    if (!list) return;
    if (!qs('sr-admin-list-toolbar')) {
      const bar = document.createElement('div');
      bar.id = 'sr-admin-list-toolbar';
      bar.className = 'mb-3 rounded-2xl border border-slate-800 bg-slate-950/45 p-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3';
      bar.innerHTML = '<div><div id="sr-admin-result-count" class="text-sm font-black text-slate-200">0 筆結果</div><div id="sr-admin-last-updated" class="text-xs text-slate-500 mt-1">資料會即時更新</div></div><div class="flex flex-col sm:flex-row gap-2"><select id="sr-admin-sort" class="min-h-[44px] bg-slate-900 border border-slate-700 rounded-xl px-3 text-xs text-slate-200"><option value="newest">最新優先</option><option value="oldest">最舊優先</option><option value="risk">高風險優先</option><option value="waiting">等待最久優先</option></select><button id="sr-admin-clear-filter" type="button" class="min-h-[44px] px-4 rounded-xl border border-amber-500/20 bg-slate-900 text-amber-300 text-xs font-black">清除篩選</button></div>';
      list.parentElement.insertBefore(bar, list);
      const sort = qs('sr-admin-sort');
      sort.value = localStorage.getItem(SORT_KEY) || 'newest';
      sort.onchange = () => { localStorage.setItem(SORT_KEY, sort.value); sortAndCountCards(); };
      qs('sr-admin-clear-filter').onclick = () => {
        const search = qs('admin-search');
        if (search) search.value = '';
        localStorage.removeItem(SEARCH_KEY);
        localStorage.setItem(FILTER_KEY, 'all');
        setFilter('all');
      };
    }
  }

  function improveResetCards() {
    document.querySelectorAll('button').forEach(button => { if (tx(button) === '設定新密碼') button.textContent = '寄出 10 分鐘臨時密碼'; });
    document.querySelectorAll('#admin-list > div').forEach(card => {
      const text = tx(card);
      if (!text.includes('忘記密碼') || card.querySelector('.sr-reset-flow-note')) return;
      const note = document.createElement('div');
      note.className = 'sr-reset-flow-note text-xs text-amber-300/80 mt-2 rounded-xl border border-amber-500/10 bg-amber-500/5 px-3 py-2';
      note.textContent = text.includes('已處理') ? '這筆已處理，確認帳號能登入並完成換密碼即可。' : '處理方式：寄出臨時密碼（10 分鐘有效），對方登入後會先換成自己的密碼。';
      card.querySelector('.space-y-1\\.5, .space-y-2, .space-y-3')?.appendChild(note) || card.appendChild(note);
    });
  }

  function enhanceBroadcast() {
    const title = qs('broadcast-title');
    const message = qs('broadcast-message');
    if (title && !title.dataset.srDraft) {
      title.dataset.srDraft = '1';
      title.value = localStorage.getItem('sr_broadcast_draft_title') || title.value;
      title.addEventListener('input', () => localStorage.setItem('sr_broadcast_draft_title', title.value));
    }
    if (message && !message.dataset.srDraft) {
      message.dataset.srDraft = '1';
      message.value = localStorage.getItem('sr_broadcast_draft_message') || message.value;
      message.addEventListener('input', () => localStorage.setItem('sr_broadcast_draft_message', message.value));
    }
    const sendButton = Array.from(document.querySelectorAll('button')).find(button => tx(button).includes('發送平台通知'));
    if (sendButton && !qs('sr-broadcast-preview-btn')) {
      const preview = document.createElement('button');
      preview.id = 'sr-broadcast-preview-btn';
      preview.type = 'button';
      preview.className = 'min-h-[44px] mr-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition';
      preview.innerHTML = '<i class="fa-regular fa-eye mr-1.5"></i> 預覽';
      preview.onclick = () => alert(`通知預覽\n\n標題：${title?.value || '還沒填'}\n\n內容：\n${message?.value || '還沒填'}`);
      sendButton.parentElement.insertBefore(preview, sendButton);
    }
    if (typeof window.sendPlatformBroadcast === 'function' && !window.sendPlatformBroadcast.__srWrapped) {
      const original = window.sendPlatformBroadcast;
      window.sendPlatformBroadcast = async function(...args) {
        const target = qs('broadcast-target')?.value === 'sg' ? 'S+ . S . G 帳號' : '所有帳號';
        const titleText = title?.value || '';
        if (!confirm(`要發給：${target}\n\n標題：${titleText || '還沒填標題'}\n\n確定送出嗎？`)) return;
        const result = await original.apply(this, args);
        localStorage.removeItem('sr_broadcast_draft_title');
        localStorage.removeItem('sr_broadcast_draft_message');
        return result;
      };
      window.sendPlatformBroadcast.__srWrapped = true;
    }
  }

  function improveCards() {
    document.querySelectorAll('#admin-list > div').forEach(card => {
      if (card.dataset.srCardImproved === '1') return;
      card.dataset.srCardImproved = '1';
      card.classList.add('sr-admin-review-card');
      const text = tx(card);
      if (/檢舉|安全|風險/.test(text)) card.classList.add('sr-admin-risk-card');
      if (/忘記密碼|臨時密碼|Email 發送失敗/.test(text)) card.classList.add('sr-admin-security-card');
      if (/待審核|審查中|申請/.test(text)) card.classList.add('sr-admin-pending-card');
      card.querySelectorAll('button').forEach(button => button.classList.add('sr-admin-action-button'));
    });
  }

  function setActionContextFromButton(button) {
    const card = button?.closest?.('#admin-list > div');
    if (!card) return;
    const match = tx(card).match(/@([A-Za-z0-9_.-]+)/);
    lastActionContext = match ? `帳號 @${match[1]}` : '';
    clearTimeout(actionContextTimer);
    actionContextTimer = setTimeout(() => { lastActionContext = ''; }, 6000);
  }

  function wrapToast() {
    if (typeof window.showToast !== 'function' || window.showToast.__srContextWrapped) return;
    const original = window.showToast;
    window.showToast = function(message, type = 'info') {
      let next = String(message || '');
      if (type === 'success' && lastActionContext && !next.includes('@') && /完成|成功|已通過|已拒絕|已刪除|已更新|已寄出|已設定|已處理/.test(next)) next = `${lastActionContext}：${next}`;
      return original.call(this, next, type);
    };
    window.showToast.__srContextWrapped = true;
  }

  function showDangerConfirm({ accountId, title, description, actionLabel = '確認永久刪除', onConfirm }) {
    qs('sr-admin-danger-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'sr-admin-danger-modal';
    modal.className = 'fixed inset-0 z-[260] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md';
    modal.innerHTML = `<div class="w-full max-w-md rounded-3xl border border-rose-500/25 bg-slate-950 p-6 shadow-2xl"><div class="w-12 h-12 rounded-full bg-rose-500/10 text-rose-300 flex items-center justify-center mb-4"><i class="fa-solid fa-triangle-exclamation text-xl"></i></div><h3 class="text-lg font-black text-white">${esc(title)}</h3><p class="text-xs text-slate-400 leading-relaxed mt-2">${esc(description)}</p><div class="mt-4 rounded-xl border border-rose-500/15 bg-rose-500/5 p-3 text-xs text-rose-200">將永久移除帳號資料與相關貼文，無法復原。</div><label class="block text-xs font-black text-slate-300 mt-4 mb-1.5">輸入帳號 ID「${esc(accountId)}」確認</label><input id="sr-danger-account" class="w-full min-h-[44px] bg-slate-900 border border-rose-500/20 rounded-xl px-3 text-sm text-white" autocomplete="off"><label class="block text-xs font-black text-slate-300 mt-3 mb-1.5">刪除原因</label><textarea id="sr-danger-reason" class="w-full min-h-[90px] bg-slate-900 border border-rose-500/20 rounded-xl px-3 py-2 text-sm text-white resize-none" placeholder="請說明原因"></textarea><div class="grid grid-cols-2 gap-3 mt-5"><button id="sr-danger-cancel" class="min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 text-slate-300 text-xs font-black">取消</button><button id="sr-danger-confirm" disabled class="min-h-[44px] rounded-xl bg-rose-600 text-white text-xs font-black disabled:opacity-40 disabled:cursor-not-allowed">${esc(actionLabel)}</button></div></div>`;
    document.body.appendChild(modal);
    const accountInput = qs('sr-danger-account');
    const reasonInput = qs('sr-danger-reason');
    const confirmButton = qs('sr-danger-confirm');
    const validate = () => { confirmButton.disabled = accountInput.value.trim() !== accountId || !reasonInput.value.trim(); };
    accountInput.addEventListener('input', validate);
    reasonInput.addEventListener('input', validate);
    qs('sr-danger-cancel').onclick = () => modal.remove();
    modal.addEventListener('click', event => { if (event.target === modal) modal.remove(); });
    confirmButton.onclick = async () => {
      confirmButton.disabled = true;
      confirmButton.textContent = '處理中...';
      try {
        await onConfirm(reasonInput.value.trim());
        modal.remove();
      } catch (error) {
        console.error(error);
        window.showToast?.('操作失敗：' + error.message, 'error');
        confirmButton.disabled = false;
        confirmButton.textContent = actionLabel;
      }
    };
    accountInput.focus();
  }

  function wrapDangerousOperations() {
    if (typeof window.openDeleteModal === 'function' && !window.openDeleteModal.__srWrapped) {
      const originalOpen = window.openDeleteModal;
      window.openDeleteModal = function(userId) {
        originalOpen.call(this, userId);
        requestAnimationFrame(() => {
          const modal = qs('delete-modal');
          const content = qs('delete-modal-content');
          const confirmButton = qs('confirm-delete-btn');
          if (!modal || !content || !confirmButton || confirmButton.dataset.srDangerWrapped === '1') return;
          confirmButton.dataset.srDangerWrapped = '1';
          const originalConfirm = confirmButton.onclick;
          const oldExtra = qs('sr-delete-extra-confirm');
          oldExtra?.remove();
          const extra = document.createElement('div');
          extra.id = 'sr-delete-extra-confirm';
          extra.className = 'mt-4 space-y-3 text-left';
          extra.innerHTML = `<div class="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-200">這會永久刪除帳號 @${esc(userId)} 與相關貼文，無法復原。</div><input id="sr-delete-account-confirm" class="w-full min-h-[44px] bg-slate-900 border border-rose-500/20 rounded-xl px-3 text-sm text-white" placeholder="輸入 ${esc(userId)}"><textarea id="sr-delete-reason-confirm" class="w-full min-h-[80px] bg-slate-900 border border-rose-500/20 rounded-xl px-3 py-2 text-sm text-white resize-none" placeholder="填寫刪除原因"></textarea>`;
          const actions = confirmButton.parentElement;
          content.insertBefore(extra, actions);
          confirmButton.disabled = true;
          const accountInput = qs('sr-delete-account-confirm');
          const reasonInput = qs('sr-delete-reason-confirm');
          const validate = () => { confirmButton.disabled = accountInput.value.trim() !== String(userId) || !reasonInput.value.trim(); };
          accountInput.oninput = validate;
          reasonInput.oninput = validate;
          confirmButton.onclick = async function() {
            if (confirmButton.disabled) return;
            const nativePrompt = window.prompt;
            window.prompt = () => reasonInput.value.trim();
            try { await originalConfirm?.call(this); }
            finally { window.prompt = nativePrompt; }
          };
        });
      };
      window.openDeleteModal.__srWrapped = true;
    }

    if (typeof window.approveAccountDeletionRequest === 'function' && !window.approveAccountDeletionRequest.__srWrapped) {
      const originalApprove = window.approveAccountDeletionRequest;
      window.approveAccountDeletionRequest = async function(requestId) {
        const { db, fs } = await T();
        const snapshot = await fs.getDoc(fs.doc(db, 'secretg_apps', AID, 'account_requests', requestId));
        if (!snapshot.exists()) return window.showToast?.('找不到這筆刪除申請。', 'error');
        const accountId = String(snapshot.data()?.userId || '');
        if (!accountId) return window.showToast?.('這筆申請缺少帳號 ID。', 'error');
        showDangerConfirm({
          accountId,
          title: `永久刪除帳號 @${accountId}？`,
          description: '核准後會刪除帳號資料與該帳號發布的貼文。',
          onConfirm: async reason => {
            const nativeConfirm = window.confirm;
            const nativePrompt = window.prompt;
            window.confirm = () => true;
            window.prompt = () => reason;
            try { await originalApprove.call(this, requestId); }
            finally { window.confirm = nativeConfirm; window.prompt = nativePrompt; }
          }
        });
      };
      window.approveAccountDeletionRequest.__srWrapped = true;
    }
  }

  function connectionState() {
    const status = qs('connection-status');
    if (!status) return;
    if (!qs('sr-admin-reload')) {
      const button = document.createElement('button');
      button.id = 'sr-admin-reload';
      button.type = 'button';
      button.className = 'min-h-[44px] px-3 rounded-full border border-slate-700 bg-slate-950 text-slate-300 text-xs font-black';
      button.innerHTML = '<i class="fa-solid fa-rotate-right mr-1"></i>重新整理';
      status.insertAdjacentElement('afterend', button);
      button.onclick = () => location.reload();
    }
    if (!navigator.onLine) {
      status.className = 'self-start px-4 py-2 rounded-full bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2';
      status.innerHTML = '<i class="fa-solid fa-wifi"></i> 目前離線，資料可能不是最新';
      document.documentElement.dataset.srAdminOffline = '1';
    } else if (document.documentElement.dataset.srAdminOffline === '1') {
      status.className = 'self-start px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2';
      status.innerHTML = '<i class="fa-solid fa-arrows-rotate animate-spin"></i> 網路已恢復，正在同步';
      document.documentElement.dataset.srAdminOffline = '0';
      setTimeout(() => { if (navigator.onLine) { status.className = 'self-start px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2'; status.innerHTML = '<i class="fa-solid fa-circle text-[8px]"></i> 已連線'; } }, 1200);
    }
  }

  function installStyles() {
    if (qs('sr-admin-tools-style')) return;
    const style = document.createElement('style');
    style.id = 'sr-admin-tools-style';
    style.textContent = `
      #admin-main header{position:sticky;top:0;z-index:35;background:linear-gradient(180deg,rgba(2,2,4,.96),rgba(2,2,4,.78));backdrop-filter:blur(16px);padding-top:.5rem;border-radius:0 0 1.25rem 1.25rem}
      #admin-main button,#admin-main select,#admin-main input{min-height:44px}.sr-admin-group-btn{display:flex;align-items:center;justify-content:center;gap:.45rem;min-height:44px;border-radius:1rem;border:1px solid rgba(245,158,11,.12);background:rgba(2,6,23,.45);color:#94a3b8;font-size:12px;font-weight:900;transition:.2s}.sr-admin-group-btn:hover,.sr-admin-group-active{color:#fcd34d;border-color:rgba(245,158,11,.36);background:rgba(245,158,11,.08)}
      .sr-admin-subfilter{flex:0 0 auto;border:1px solid rgba(148,163,184,.16);background:rgba(15,23,42,.55);color:#94a3b8;border-radius:.85rem;padding:.55rem .8rem;font-size:12px;font-weight:800;white-space:nowrap}.sr-admin-subfilter-active{color:#020617;background:linear-gradient(90deg,#f8d36a,#d99a23);border-color:#f8d36a}
      #admin-list{display:grid;gap:1rem}#admin-list>div{scroll-margin-top:6rem}.sr-admin-review-card{border-color:rgba(223,183,108,.16)!important;background:linear-gradient(145deg,rgba(15,23,42,.72),rgba(8,10,16,.62))!important;box-shadow:0 18px 45px rgba(0,0,0,.28)}.sr-admin-risk-card{border-left:4px solid rgba(244,63,94,.72)!important}.sr-admin-security-card{border-left:4px solid rgba(251,191,36,.76)!important}.sr-admin-pending-card{border-left:4px solid rgba(34,211,238,.55)!important}.sr-admin-action-button{min-height:44px!important}
      .sr-admin-stat-card{cursor:pointer;transition:transform .18s ease,border-color .18s ease,background .18s ease}.sr-admin-stat-card:hover{transform:translateY(-2px);border-color:rgba(245,158,11,.32)!important}.sr-admin-stat-active{border-color:rgba(245,158,11,.55)!important;background:rgba(245,158,11,.08)!important;box-shadow:0 0 24px rgba(245,158,11,.08)}
      #broadcast-message{line-height:1.55!important}#broadcast-history{scrollbar-width:thin}.glass-panel h2,.glass-panel h3{letter-spacing:.02em}.sr-admin-count-note{font-weight:700;letter-spacing:.02em}.text-\\[10px\\],.text-\\[11px\\]{font-size:12px!important;line-height:1.45!important}
      @media(max-width:768px){#sr-admin-env-badge{width:100%}#sr-admin-task-groups{position:sticky;top:.5rem;z-index:30;backdrop-filter:blur(14px)}#admin-main header{position:relative}.flex.items-center.justify-between{align-items:flex-start!important}#admin-search,#filter-status{width:100%!important}}
      @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}}
    `;
    document.head.appendChild(style);
  }

  function apply() {
    scheduled = false;
    installStyles();
    wrapToast();
    enforceExplicitAdminLogin();
    addHeader();
    addStatsLabel();
    addGroups();
    restoreFilters();
    bindStatCards();
    enhanceBroadcast();
    addToolbar();
    improveResetCards();
    improveCards();
    wrapDangerousOperations();
    connectionState();
    sortAndCountCards();
    refreshAdminMetric();
    sync();
    document.documentElement.dataset.srAdminUi = VERSION;
  }

  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  }

  document.addEventListener('click', event => {
    const button = event.target?.closest?.('#admin-list button');
    if (button) setActionContextFromButton(button);
  }, true);
  window.addEventListener('online', () => { connectionState(); scheduleApply(); });
  window.addEventListener('offline', connectionState);
  new MutationObserver(scheduleApply).observe(document.documentElement, { childList:true, subtree:true });
  document.addEventListener('DOMContentLoaded', apply, { once:true });
  apply();
})();