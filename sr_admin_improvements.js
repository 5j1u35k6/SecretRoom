(() => {
  const VERSION = '20260708-admin-ui-v1';
  const groupMap = {
    member: ['pending', 'avatar_pending', 'spec_pending', 'approved', 'active', 'rejected', 'all'],
    safety: ['reported_posts', 'reported_comments'],
    security: ['password_reset_requests', 'account_delete_requests', 'email_failures'],
    system: ['all']
  };
  const filterLabels = {
    all: '全部資料',
    pending: '待審核帳號',
    avatar_pending: '待審核頭像',
    spec_pending: '待審核 Spec 認證',
    reported_posts: '被檢舉貼文',
    reported_comments: '被檢舉留言',
    account_delete_requests: '帳號刪除申請',
    password_reset_requests: '忘記密碼申請',
    email_failures: 'Email 發送失敗',
    approved: '已核准',
    active: '已啟用',
    rejected: '已拒絕'
  };

  function qs(id) { return document.getElementById(id); }
  function text(v) { return String(v || '').replace(/\s+/g, ' ').trim(); }

  function setFilter(value) {
    const select = qs('filter-status');
    if (!select) return;
    select.value = value;
    if (typeof window.filterApplications === 'function') window.filterApplications();
    else select.dispatchEvent(new Event('change', { bubbles: true }));
    syncGroupTabs(value);
  }

  function currentFilter() { return qs('filter-status')?.value || 'pending'; }
  function activeGroupByFilter(value) {
    if (groupMap.safety.includes(value)) return 'safety';
    if (groupMap.security.includes(value)) return 'security';
    return 'member';
  }

  function syncGroupTabs(value = currentFilter()) {
    const group = activeGroupByFilter(value);
    document.querySelectorAll('[data-sr-admin-group]').forEach(btn => {
      const active = btn.dataset.srAdminGroup === group;
      btn.classList.toggle('sr-admin-group-active', active);
    });
  }

  function addHeaderControls() {
    const header = document.querySelector('#admin-main header');
    const status = qs('connection-status');
    if (!header || qs('sr-admin-env-badge')) return;
    const box = document.createElement('div');
    box.id = 'sr-admin-env-badge';
    box.className = 'flex flex-wrap items-center gap-2 text-[10px] font-black tracking-wider';
    box.innerHTML = `
      <span class="px-3 py-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">Production</span>
      <span class="px-3 py-2 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-300">高權限操作需二次確認</span>
      <button id="sr-admin-logout" class="px-3 py-2 rounded-full border border-slate-700 bg-slate-950/70 text-slate-300 hover:text-white hover:border-amber-500/40 transition">登出</button>
    `;
    (status?.parentElement || header).appendChild(box);
    qs('sr-admin-logout').onclick = () => {
      localStorage.removeItem('sr_admin_id');
      location.reload();
    };
  }

  function groupStats() {
    const main = qs('admin-main');
    const firstGrid = main?.querySelector('.grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-5') || main?.querySelector('.grid.grid-cols-1');
    if (!firstGrid || qs('sr-admin-stats-label')) return;
    const label = document.createElement('div');
    label.id = 'sr-admin-stats-label';
    label.className = 'mb-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-[10px] font-black tracking-wider text-slate-500';
    label.innerHTML = `
      <div class="rounded-2xl border border-amber-500/10 bg-slate-950/35 px-4 py-2"><i class="fa-solid fa-list-check text-amber-400 mr-1.5"></i> 待處理任務</div>
      <div class="rounded-2xl border border-rose-500/10 bg-slate-950/35 px-4 py-2"><i class="fa-solid fa-shield-halved text-rose-300 mr-1.5"></i> 安全風險</div>
      <div class="rounded-2xl border border-cyan-500/10 bg-slate-950/35 px-4 py-2"><i class="fa-solid fa-chart-line text-cyan-300 mr-1.5"></i> 營運數據</div>
    `;
    firstGrid.parentElement.insertBefore(label, firstGrid);
  }

  function addTaskGroups() {
    const select = qs('filter-status');
    const search = qs('admin-search');
    if (!select || qs('sr-admin-task-groups')) return;
    search && (search.placeholder = '搜尋帳號、暱稱、Email、檢舉原因、貼文內容');
    Array.from(select.options).forEach(opt => { if (filterLabels[opt.value]) opt.textContent = filterLabels[opt.value]; });
    const wrap = document.createElement('div');
    wrap.id = 'sr-admin-task-groups';
    wrap.className = 'mb-4 p-3 rounded-3xl border border-amber-500/10 bg-slate-950/35';
    wrap.innerHTML = `
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
        <button data-sr-admin-group="member" class="sr-admin-group-btn" type="button"><i class="fa-solid fa-user-check"></i> 會員審核</button>
        <button data-sr-admin-group="safety" class="sr-admin-group-btn" type="button"><i class="fa-solid fa-shield-halved"></i> 內容安全</button>
        <button data-sr-admin-group="security" class="sr-admin-group-btn" type="button"><i class="fa-solid fa-key"></i> 帳號安全</button>
        <button data-sr-admin-group="system" class="sr-admin-group-btn" type="button"><i class="fa-solid fa-bullhorn"></i> 系統通知</button>
      </div>
      <div id="sr-admin-subfilters" class="flex gap-2 overflow-x-auto pb-1"></div>
    `;
    const panel = qs('admin-list')?.parentElement;
    const titleRow = panel?.querySelector('.flex.items-center.justify-between.mb-6');
    if (titleRow) titleRow.insertAdjacentElement('afterend', wrap);
    else select.parentElement?.parentElement?.insertAdjacentElement('afterend', wrap);

    wrap.querySelectorAll('[data-sr-admin-group]').forEach(btn => {
      btn.onclick = () => {
        const group = btn.dataset.srAdminGroup;
        const first = group === 'member' ? 'pending' : group === 'safety' ? 'reported_posts' : group === 'security' ? 'password_reset_requests' : 'all';
        renderSubFilters(group, first);
        setFilter(first);
      };
    });
    renderSubFilters(activeGroupByFilter(currentFilter()), currentFilter());
    syncGroupTabs();
  }

  function renderSubFilters(group, activeValue) {
    const box = qs('sr-admin-subfilters');
    if (!box) return;
    const values = groupMap[group] || groupMap.member;
    box.innerHTML = values.map(v => `<button type="button" data-filter-value="${v}" class="sr-admin-subfilter ${activeValue === v ? 'sr-admin-subfilter-active' : ''}">${filterLabels[v] || v}</button>`).join('');
    box.querySelectorAll('[data-filter-value]').forEach(btn => btn.onclick = () => {
      renderSubFilters(group, btn.dataset.filterValue);
      setFilter(btn.dataset.filterValue);
    });
  }

  function improvePasswordResetCards() {
    document.querySelectorAll('button').forEach(btn => {
      const t = text(btn);
      if (t === '設定新密碼') btn.textContent = '寄出 10 分鐘臨時密碼';
    });
    document.querySelectorAll('#admin-list > div').forEach(card => {
      const t = text(card);
      if (!t.includes('忘記密碼') || card.querySelector('.sr-reset-flow-note')) return;
      const note = document.createElement('div');
      note.className = 'sr-reset-flow-note text-[10px] text-amber-300/80 mt-2 rounded-xl border border-amber-500/10 bg-amber-500/5 px-3 py-2';
      note.textContent = t.includes('已處理') ? '此申請已處理。請確認會員是否已成功登入並完成新密碼設定。' : '流程：寄出臨時密碼 → 10 分鐘有效 → 會員登入後強制設定新密碼 → 寄出安全提醒。';
      card.querySelector('.space-y-1\.5, .space-y-2, .space-y-3')?.appendChild(note) || card.appendChild(note);
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
    const sendBtn = Array.from(document.querySelectorAll('button')).find(b => text(b).includes('發送平台通知'));
    if (sendBtn && !qs('sr-broadcast-preview-btn')) {
      const preview = document.createElement('button');
      preview.id = 'sr-broadcast-preview-btn';
      preview.type = 'button';
      preview.className = 'mr-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition';
      preview.innerHTML = '<i class="fa-regular fa-eye mr-1.5"></i> 預覽';
      preview.onclick = () => alert(`通知預覽\n\n標題：${title?.value || '(未填)'}\n\n內容：\n${message?.value || '(未填)'}`);
      sendBtn.parentElement.insertBefore(preview, sendBtn);
    }
    if (typeof window.sendPlatformBroadcast === 'function' && !window.sendPlatformBroadcast.__srWrapped) {
      const original = window.sendPlatformBroadcast;
      window.sendPlatformBroadcast = async function(...args) {
        const target = qs('broadcast-target')?.value === 'sg' ? 'S+ . S . G 會員' : '全體會員';
        const titleText = qs('broadcast-title')?.value || '';
        if (!confirm(`即將發送平台通知給：${target}\n\n標題：${titleText || '(未填標題)'}\n\n確認發送？`)) return;
        const result = await original.apply(this, args);
        localStorage.removeItem('sr_broadcast_draft_title');
        localStorage.removeItem('sr_broadcast_draft_message');
        return result;
      };
      window.sendPlatformBroadcast.__srWrapped = true;
    }
  }

  function addListToolbar() {
    const list = qs('admin-list');
    if (!list || qs('sr-admin-list-toolbar')) return;
    const bar = document.createElement('div');
    bar.id = 'sr-admin-list-toolbar';
    bar.className = 'mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[10px] text-slate-500';
    bar.innerHTML = `
      <span><i class="fa-solid fa-arrows-rotate text-amber-400 mr-1.5"></i> 即時同步中；優先處理紅色與橘色項目。</span>
      <span>建議排序：時間新 → 風險高 → 待處理。</span>
    `;
    list.parentElement.insertBefore(bar, list);
  }

  function apply() {
    addHeaderControls();
    groupStats();
    addTaskGroups();
    enhanceBroadcast();
    addListToolbar();
    improvePasswordResetCards();
    syncGroupTabs();
    document.documentElement.dataset.srAdminUi = VERSION;
  }

  const css = document.createElement('style');
  css.id = 'sr-admin-improvements-style';
  css.textContent = `
    .sr-admin-group-btn { display:flex; align-items:center; justify-content:center; gap:.45rem; min-height:2.75rem; border-radius:1rem; border:1px solid rgba(245,158,11,.12); background:rgba(2,6,23,.45); color:#94a3b8; font-size:11px; font-weight:900; transition:.2s; }
    .sr-admin-group-btn:hover, .sr-admin-group-active { color:#fcd34d; border-color:rgba(245,158,11,.36); background:rgba(245,158,11,.08); }
    .sr-admin-subfilter { flex:0 0 auto; border:1px solid rgba(148,163,184,.16); background:rgba(15,23,42,.55); color:#94a3b8; border-radius:.85rem; padding:.55rem .8rem; font-size:10px; font-weight:800; white-space:nowrap; }
    .sr-admin-subfilter-active { color:#020617; background:linear-gradient(90deg,#f8d36a,#d99a23); border-color:#f8d36a; }
    #admin-search, #filter-status { min-height:2.65rem; }
    #admin-list > div { scroll-margin-top: 1rem; }
    .admin-stat-mini, #admin-main .grid > div { overflow:hidden; }
    @media(max-width:768px){ #sr-admin-env-badge{width:100%;} #sr-admin-task-groups{position:sticky;top:.5rem;z-index:20;backdrop-filter:blur(14px);} }
  `;
  document.head.appendChild(css);

  apply();
  new MutationObserver(() => setTimeout(apply, 100)).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(apply, 1500);
})();
