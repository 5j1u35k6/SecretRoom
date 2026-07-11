// SecretRoom phase two: onboarding and profile completion.
(() => {
  if (window.__SR_PHASE2_ONBOARDING__) return;
  window.__SR_PHASE2_ONBOARDING__ = true;
  const VERSION = '20260711-phase2-onboarding-v2';
  const KEY = 'sr_phase2_onboarding_dismissed';
  let queued = false;
  const qs = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const ownPosts = () => {
    const posts = window.SRPhase2RawPosts?.() || window.state?.posts || [];
    const id = String(window.state?.applicationId || '');
    return posts.filter(post => String(post.userId) === id);
  };

  function progress() {
    const user = window.state?.userData || {};
    const items = [
      ['profile', '基本資料', !!user.nickname && !!user.email && Array.isArray(user.kinks) && user.kinks.length > 0],
      ['avatar', '大頭照', !!user.avatar],
      ['x', 'X 官方驗證', user.xInfo?.verificationStatus === 'oauth_verified'],
      ['post', '第一篇貼文', ownPosts().length > 0],
      ['notifications', '查看通知', localStorage.getItem('sr_phase2_notifications_seen') === '1'],
      ['safety', '安全設定', localStorage.getItem('sr_phase2_safety_seen') === '1']
    ].map(([key, label, done]) => ({ key, label, done }));
    const done = items.filter(item => item.done).length;
    return { items, done, percent: Math.round(done / items.length * 100) };
  }

  function clickFirst(ids) {
    for (const id of ids) {
      const node = qs(id);
      if (node) { node.click(); return; }
    }
  }

  function action(name) {
    if (name === 'profile' || name === 'avatar') clickFirst(['aside-profile-trigger', 'mobile-tab-profile']);
    if (name === 'x') {
      if (typeof window.SRPhase3OpenXOAuth === 'function') window.SRPhase3OpenXOAuth();
      else window.SRPhase2OpenXBinding?.();
    }
    if (name === 'post') clickFirst(['aside-btn-share', 'mobile-btn-share']);
    if (name === 'notifications') {
      localStorage.setItem('sr_phase2_notifications_seen', '1');
      clickFirst(['aside-tab-notifications', 'mobile-btn-notifications']);
    }
    if (name === 'safety') {
      localStorage.setItem('sr_phase2_safety_seen', '1');
      window.showToast?.('可從個人頁的「隱藏與封鎖」管理已隱藏內容。', 'info');
      schedule();
    }
  }

  function renderOnboarding() {
    if (window.state?.currentTab !== 'feed' || localStorage.getItem(KEY) === '1') return;
    const root = qs('dashboard-tab-content');
    if (!root || qs('sr-phase2-onboarding')) return;
    const current = progress();
    if (current.percent === 100) return;
    const card = document.createElement('section');
    card.id = 'sr-phase2-onboarding';
    card.className = 'glass-panel crystal-border rounded-3xl p-5 border border-cyan-500/15';
    card.innerHTML = `<div class="flex items-start justify-between gap-3"><div><div class="text-xs text-cyan-300 font-black">新帳號導覽</div><h3 class="text-lg text-white font-black mt-1">完成你的 SecretRoom 設定</h3><p class="text-xs text-slate-500 mt-1">已完成 ${current.done}/${current.items.length} 項。</p></div><button id="sr-onboarding-dismiss" class="w-10 h-10 rounded-full border border-slate-700 text-slate-400"><i class="fa-solid fa-xmark"></i></button></div><div class="h-2 rounded-full bg-slate-900 overflow-hidden mt-4"><span class="block h-full bg-gradient-to-r from-cyan-500 to-amber-400" style="width:${current.percent}%"></span></div><div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">${current.items.map(item => `<button data-sr-onboard="${item.key}" class="min-h-[44px] rounded-xl border ${item.done ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300' : 'border-slate-800 bg-slate-950/45 text-slate-300'} text-left px-3 text-xs font-black"><i class="fa-solid ${item.done ? 'fa-circle-check' : 'fa-circle'} mr-2"></i>${esc(item.label)}</button>`).join('')}</div>`;
    root.insertBefore(card, root.firstElementChild);
    qs('sr-onboarding-dismiss').onclick = () => { localStorage.setItem(KEY, '1'); card.remove(); };
    card.querySelectorAll('[data-sr-onboard]').forEach(button => button.onclick = () => action(button.dataset.srOnboard));
  }

  function renderProfile() {
    if (window.state?.currentTab !== 'profile') return;
    const root = qs('dashboard-tab-content');
    if (!root || qs('sr-profile-completion')) return;
    const current = progress();
    const verified = window.state?.userData?.xInfo?.verificationStatus === 'oauth_verified';
    const card = document.createElement('section');
    card.id = 'sr-profile-completion';
    card.className = 'glass-panel crystal-border rounded-3xl p-5 border border-cyan-500/15 mb-4';
    card.innerHTML = `<div class="flex items-center justify-between gap-4"><div><div class="text-xs text-cyan-300 font-black">資料完成度</div><div class="text-2xl text-white font-black mt-1">${current.percent}%</div></div><div class="flex gap-2"><button id="sr-profile-edit-shortcut" class="min-h-[44px] px-4 rounded-xl border border-amber-500/20 text-amber-300 text-xs font-black">編輯資料</button><button id="sr-profile-x-shortcut" class="min-h-[44px] px-4 rounded-xl bg-white text-black text-xs font-black">${verified ? '重新驗證 X' : '驗證 X'}</button></div></div><div class="h-2 rounded-full bg-slate-900 overflow-hidden mt-4"><span class="block h-full bg-gradient-to-r from-cyan-500 to-amber-400" style="width:${current.percent}%"></span></div><div class="flex flex-wrap gap-2 mt-3">${current.items.map(item => `<span class="px-2.5 py-1 rounded-full text-[11px] border ${item.done ? 'border-emerald-500/20 text-emerald-300' : 'border-slate-700 text-slate-500'}">${item.done ? '✓' : '○'} ${esc(item.label)}</span>`).join('')}</div>`;
    root.insertBefore(card, root.firstElementChild);
    qs('sr-profile-edit-shortcut').onclick = () => window.showProfileEditModal?.();
    qs('sr-profile-x-shortcut').onclick = () => action('x');
  }

  function style() {
    if (qs('sr-phase2-onboarding-style')) return;
    const sheet = document.createElement('style');
    sheet.id = 'sr-phase2-onboarding-style';
    sheet.textContent = '@media(max-width:640px){#sr-profile-completion>.flex{align-items:flex-start;flex-direction:column}#sr-profile-completion>.flex>div:last-child{width:100%;display:grid;grid-template-columns:1fr 1fr}}';
    document.head.appendChild(sheet);
  }

  function apply() {
    queued = false;
    style();
    renderOnboarding();
    renderProfile();
    if (window.state?.currentTab === 'notifications') localStorage.setItem('sr_phase2_notifications_seen', '1');
    document.documentElement.dataset.srPhase2Onboarding = VERSION;
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  apply();
})();