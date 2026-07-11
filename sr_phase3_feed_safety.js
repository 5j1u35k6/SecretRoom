// SecretRoom phase three: feed-only hiding, restore controls and Badge next steps.
(() => {
  if (window.__SR_PHASE3_FEED_SAFETY__) return;
  window.__SR_PHASE3_FEED_SAFETY__ = true;

  const APP_ID = 'secretg-production-node-tw';
  const VERSION = '20260711-phase3-feed-safety-v1';
  let queued = false;
  let normalizedPosts = false;

  const qs = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const toast = (message, type = 'info') => window.showToast?.(message, type);
  const currentId = () => String(window.state?.applicationId || localStorage.getItem('sr_username') || '');

  async function tools() {
    if (window.SRP?.tools) return window.SRP.tools();
    const appMod = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js');
    const fs = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
    const app = appMod.getApps()[0];
    if (!app) throw new Error('Firebase 尚未初始化');
    return { db: fs.getFirestore(app), fs };
  }

  function fullPosts() {
    return Array.isArray(window.state?.posts) ? window.state.posts : [];
  }

  function normalizePostState() {
    if (normalizedPosts || !window.state) return;
    const descriptor = Object.getOwnPropertyDescriptor(window.state, 'posts');
    if (descriptor?.get && typeof window.SRPhase2RawPosts === 'function') {
      const raw = window.SRPhase2RawPosts();
      Object.defineProperty(window.state, 'posts', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: Array.isArray(raw) ? raw : []
      });
    }
    window.SRPhase2RawPosts = () => [...fullPosts()];
    normalizedPosts = true;
  }

  function preferences() {
    const user = window.state?.userData || {};
    return {
      hidden: new Set((user.hiddenPostIds || []).map(String)),
      blocked: new Set((user.blockedUserIds || []).map(String))
    };
  }

  async function saveList(field, value, enabled) {
    const id = currentId();
    if (!id) throw new Error('找不到目前登入帳號。');
    const values = new Set((window.state?.userData?.[field] || []).map(String));
    enabled ? values.add(String(value)) : values.delete(String(value));
    const next = [...values];
    const { db, fs } = await tools();
    await fs.updateDoc(fs.doc(db, 'secretg_apps', APP_ID, 'applications', id), {
      [field]: next,
      safetyUpdatedAt: fs.serverTimestamp(),
      safetyUpdatedAtMs: Date.now()
    });
    window.state.userData = { ...(window.state.userData || {}), [field]: next };
    schedule();
  }

  function postIdFromCard(card) {
    if (card.dataset.postId) return card.dataset.postId;
    const handlers = [...card.querySelectorAll('[onclick]')].map(node => node.getAttribute('onclick') || '').join(' ');
    const match = handlers.match(/(?:viewSinglePost|openReportModal|toggleLike|deleteMyPost|deletePost)\(['"]([^'"]+)['"]/);
    if (match) card.dataset.postId = match[1];
    return match?.[1] || '';
  }

  function suppressDuplicateComposer() {
    const composer = qs('sr-feed-compose-card');
    if (!composer) return;
    composer.classList.add('hidden');
    composer.setAttribute('aria-hidden', 'true');
    composer.tabIndex = -1;
  }

  function applyFeedVisibility() {
    if (window.state?.currentTab !== 'feed') return;
    const prefs = preferences();
    const postMap = new Map(fullPosts().map(post => [String(post.id || ''), post]));
    qs('feed-posts-list')?.querySelectorAll(':scope > article, :scope > div').forEach(card => {
      const postId = postIdFromCard(card);
      if (!postId) return;
      const post = postMap.get(postId);
      const hidden = prefs.hidden.has(postId) || (post && prefs.blocked.has(String(post.userId || '')));
      card.classList.toggle('hidden', hidden);
      card.setAttribute('aria-hidden', hidden ? 'true' : 'false');
    });
  }

  function hiddenPostRows() {
    const prefs = preferences();
    return fullPosts().filter(post => prefs.hidden.has(String(post.id || '')));
  }

  function openManager() {
    qs('sr-safety-manager')?.remove();
    const prefs = preferences();
    const hidden = hiddenPostRows();
    const blocked = [...prefs.blocked];
    const modal = document.createElement('div');
    modal.id = 'sr-safety-manager';
    modal.className = 'fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md';
    modal.innerHTML = `<section class="glass-panel crystal-border w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-amber-500/20 p-5 sm:p-6"><div class="flex items-start justify-between gap-3"><div><div class="text-xs text-amber-300 font-black">內容管理</div><h2 class="text-xl text-white font-black mt-1">隱藏與封鎖</h2><p class="text-xs text-slate-500 mt-1">隱藏只影響你的動態畫面，不會改變位階分數。</p></div><button id="sr-safety-manager-close" class="w-11 h-11 rounded-full border border-slate-700 text-slate-300" aria-label="關閉"><i class="fa-solid fa-xmark"></i></button></div><section class="mt-5"><h3 class="text-sm text-white font-black">已隱藏貼文（${hidden.length}）</h3><div class="space-y-2 mt-3">${hidden.length ? hidden.map(post => `<div class="rounded-2xl border border-slate-800 bg-slate-950/55 p-3 flex items-start justify-between gap-3"><div class="min-w-0"><div class="text-xs text-slate-300 font-black truncate">${esc(post.authorName || post.userId || '帳號')}</div><p class="text-xs text-slate-500 mt-1 line-clamp-2">${esc(post.text || '圖片貼文')}</p></div><button data-restore-post="${esc(post.id)}" class="min-h-[40px] px-3 rounded-xl border border-emerald-500/20 text-emerald-300 text-xs font-black shrink-0">恢復</button></div>`).join('') : '<div class="rounded-2xl border border-slate-800 p-4 text-xs text-slate-500">目前沒有隱藏貼文。</div>'}</div></section><section class="mt-5"><h3 class="text-sm text-white font-black">已封鎖帳號（${blocked.length}）</h3><div class="space-y-2 mt-3">${blocked.length ? blocked.map(id => `<div class="rounded-2xl border border-slate-800 bg-slate-950/55 p-3 flex items-center justify-between gap-3"><span class="text-sm text-slate-300 font-mono">@${esc(id)}</span><button data-unblock-account="${esc(id)}" class="min-h-[40px] px-3 rounded-xl border border-emerald-500/20 text-emerald-300 text-xs font-black">解除封鎖</button></div>`).join('') : '<div class="rounded-2xl border border-slate-800 p-4 text-xs text-slate-500">目前沒有封鎖帳號。</div>'}</div></section></section>`;
    document.body.appendChild(modal);
    qs('sr-safety-manager-close').onclick = () => modal.remove();
    modal.addEventListener('click', event => { if (event.target === modal) modal.remove(); });
    modal.querySelectorAll('[data-restore-post]').forEach(button => button.onclick = async () => {
      button.disabled = true;
      try {
        await saveList('hiddenPostIds', button.dataset.restorePost, false);
        toast('貼文已恢復到動態。', 'success');
        openManager();
        window.setGlobalFilter?.(window.state?.currentFilter || 'recommended');
      } catch (error) {
        toast('無法恢復貼文：' + error.message, 'error');
        button.disabled = false;
      }
    });
    modal.querySelectorAll('[data-unblock-account]').forEach(button => button.onclick = async () => {
      button.disabled = true;
      try {
        await saveList('blockedUserIds', button.dataset.unblockAccount, false);
        toast(`已解除封鎖 @${button.dataset.unblockAccount}`, 'success');
        openManager();
        window.setGlobalFilter?.(window.state?.currentFilter || 'recommended');
      } catch (error) {
        toast('無法解除封鎖：' + error.message, 'error');
        button.disabled = false;
      }
    });
  }

  function addProfileManager() {
    if (window.state?.currentTab !== 'profile') return;
    const root = qs('dashboard-tab-content');
    if (!root || qs('sr-safety-manager-card')) return;
    const prefs = preferences();
    const card = document.createElement('section');
    card.id = 'sr-safety-manager-card';
    card.className = 'glass-panel crystal-border rounded-3xl p-5 border border-slate-700/60 mb-4';
    card.innerHTML = `<div class="flex items-center justify-between gap-4"><div><div class="text-xs text-slate-400 font-black">內容管理</div><h3 class="text-lg text-white font-black mt-1">隱藏與封鎖</h3><p class="text-xs text-slate-500 mt-1">${prefs.hidden.size} 篇隱藏貼文 · ${prefs.blocked.size} 個封鎖帳號</p></div><button id="sr-open-safety-manager" class="min-h-[44px] px-4 rounded-xl border border-amber-500/20 text-amber-300 text-xs font-black">管理</button></div>`;
    root.insertBefore(card, root.firstElementChild);
    qs('sr-open-safety-manager').onclick = openManager;
  }

  function addHideButtons() {
    if (window.state?.currentTab !== 'feed') return;
    qs('feed-posts-list')?.querySelectorAll(':scope > article, :scope > div').forEach(card => {
      if (card.dataset.srPhase3HideAction === '1') return;
      const postId = postIdFromCard(card);
      if (!postId) return;
      card.dataset.srPhase3HideAction = '1';
      const button = document.createElement('button');
      button.className = 'mt-3 min-h-[40px] px-3 rounded-xl border border-slate-700 text-slate-500 text-xs font-black';
      button.innerHTML = '<i class="fa-regular fa-eye-slash mr-1.5"></i>隱藏這篇';
      button.onclick = async event => {
        event.stopPropagation();
        try {
          await saveList('hiddenPostIds', postId, true);
          toast('這篇貼文已隱藏，可從個人頁恢復。', 'success');
          applyFeedVisibility();
        } catch (error) {
          toast('無法隱藏貼文：' + error.message, 'error');
        }
      };
      card.appendChild(button);
    });
  }

  function addBlockButton() {
    if (window.state?.currentTab !== 'other-profile') return;
    const target = String(window.state?.viewTargetUserId || '');
    const root = qs('dashboard-tab-content');
    if (!target || !root || qs('sr-phase3-block-account')) return;
    const blocked = preferences().blocked.has(target);
    const button = document.createElement('button');
    button.id = 'sr-phase3-block-account';
    button.className = `w-full min-h-[44px] rounded-xl border ${blocked ? 'border-emerald-500/20 text-emerald-300' : 'border-rose-500/20 text-rose-300'} text-xs font-black mb-4`;
    button.textContent = blocked ? `解除封鎖 @${target}` : `封鎖 @${target}`;
    root.insertBefore(button, root.firstElementChild);
    button.onclick = async () => {
      try {
        await saveList('blockedUserIds', target, !blocked);
        toast(blocked ? `已解除封鎖 @${target}` : `已封鎖 @${target}`, 'success');
        (qs('aside-tab-feed') || qs('mobile-tab-feed'))?.click();
      } catch (error) {
        toast('封鎖設定失敗：' + error.message, 'error');
      }
    };
  }

  function addBadgeSteps() {
    if (window.state?.currentTab !== 'badge-progress') return;
    const root = qs('dashboard-tab-content');
    if (!root || qs('sr-phase3-badge-steps')) return;
    const user = window.state?.userData || {};
    const ownPosts = fullPosts().filter(post => String(post.userId || '') === currentId());
    const steps = [];
    if (!user.avatar) steps.push(['profile', '補上大頭照']);
    if (user.xInfo?.verificationStatus !== 'oauth_verified') steps.push(['x', '完成 X 官方驗證']);
    if (!ownPosts.length) steps.push(['post', '發布第一篇貼文']);
    if (!user.isSpecElite && user.specEliteStatus !== 'pending') steps.push(['spec', '申請黃金 Spec']);
    const card = document.createElement('section');
    card.id = 'sr-phase3-badge-steps';
    card.className = 'glass-panel crystal-border rounded-3xl p-5 mb-4 border border-amber-500/15';
    card.innerHTML = `<div class="text-xs text-amber-300 font-black">下一步</div><h3 class="text-lg text-white font-black mt-1">${steps.length ? '完成這些項目可解鎖更多功能' : '目前主要項目都完成了'}</h3><div class="flex flex-wrap gap-2 mt-4">${steps.map(([action, label]) => `<button data-sr-next="${action}" class="min-h-[44px] px-4 rounded-xl border border-amber-500/20 text-amber-300 text-xs font-black">${label}</button>`).join('')}</div>`;
    root.insertBefore(card, root.firstElementChild);
    card.querySelectorAll('[data-sr-next]').forEach(button => button.onclick = () => {
      const action = button.dataset.srNext;
      if (action === 'profile') (qs('aside-profile-trigger') || qs('mobile-tab-profile'))?.click();
      if (action === 'x') window.SRPhase3OpenXOAuth?.();
      if (action === 'post') (qs('aside-btn-share') || qs('mobile-btn-share'))?.click();
      if (action === 'spec') window.showSpecApplyModal?.();
    });
  }

  function installStyles() {
    if (qs('sr-phase3-feed-safety-style')) return;
    const style = document.createElement('style');
    style.id = 'sr-phase3-feed-safety-style';
    style.textContent = '#sr-feed-compose-card{display:none!important}';
    document.head.appendChild(style);
  }

  function apply() {
    queued = false;
    installStyles();
    normalizePostState();
    suppressDuplicateComposer();
    addHideButtons();
    applyFeedVisibility();
    addProfileManager();
    addBlockButton();
    addBadgeSteps();
    document.documentElement.dataset.srPhase3FeedSafety = VERSION;
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  apply();
})();