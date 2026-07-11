// SecretRoom phase-one frontend UX improvements.
(() => {
  const VERSION = '20260711-phase1-frontend-v1';
  const APP_ID = 'secretg-production-node-tw';
  const FILTER_KEY = 'sr_feed_filter';
  const SCROLL_KEY = 'sr_feed_scroll_top';
  const DRAFT_KEY = 'sr_post_draft_v1';
  const tiers = [
    { code: 'D.G', promote: 0, keep: 0, tone: 'from-stone-300 via-amber-200 to-stone-500' },
    { code: 'C.G', promote: 120, keep: 60, tone: 'from-slate-200 via-slate-300 to-amber-100' },
    { code: 'B.G', promote: 250, keep: 130, tone: 'from-emerald-200 via-teal-300 to-slate-200' },
    { code: 'A.G', promote: 450, keep: 240, tone: 'from-blue-200 via-cyan-300 to-amber-200' },
    { code: 'S.G', promote: 700, keep: 380, tone: 'from-yellow-200 via-amber-400 to-orange-500' },
    { code: 'S+.G', promote: 1000, keep: 560, tone: 'from-amber-200 via-yellow-300 to-amber-500' },
    { code: 'SSR.G', promote: 1450, keep: 850, tone: 'from-violet-300 via-amber-200 to-rose-200' },
    { code: 'Z.G', promote: 2000, keep: 1200, tone: 'from-fuchsia-300 via-amber-200 to-cyan-200' }
  ];

  const qs = id => document.getElementById(id);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char])); }
  function js(value) { return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r'); }
  function textOf(element) { return String(element?.innerText || element?.textContent || '').replace(/\s+/g, ' ').trim(); }
  function timeValue(value) {
    if (value && value.seconds) return value.seconds * 1000;
    if (value && typeof value.toDate === 'function') return value.toDate().getTime() || 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') { const time = new Date(value).getTime(); return Number.isNaN(time) ? 0 : time; }
    return 0;
  }
  function weekWindow(base = new Date()) {
    const date = new Date(base);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff, 0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    end.setMilliseconds(-1);
    return { start, end };
  }
  function floor1(value) { return Math.floor((Number(value) || 0) * 10) / 10; }
  function tierIndex(code) { return Math.max(0, tiers.findIndex(tier => tier.code === code)); }
  function tierByScore(score) { let result = tiers[0]; for (const tier of tiers) if (score >= tier.promote) result = tier; return result; }

  function getWeeklyRankData() {
    const { start, end } = weekWindow();
    const startMs = start.getTime();
    const endMs = end.getTime();
    const posts = (window.state?.posts || []).filter(post => {
      const created = timeValue(post.createdAt || post.createdAtMs || post.timestamp);
      return created >= startMs && created <= endMs;
    });
    const map = new Map();
    posts.forEach(post => {
      const userId = post.userId || 'unknown';
      const profile = (window.state?.activeUsers || []).find(user => user.id === userId) || {};
      if (!map.has(userId)) map.set(userId, {
        userId,
        nickname: post.authorName || profile.nickname || userId,
        avatar: post.authorAvatar || profile.avatar || '',
        likes: 0,
        ratingCount: 0,
        ratingSum: 0,
        postCount: 0
      });
      const entry = map.get(userId);
      const ratingValues = Object.values(post.ratings || {}).map(Number).filter(value => Number.isFinite(value) && value > 0);
      entry.likes += Number(post.likeCount || Object.keys(post.likes || {}).length || 0);
      entry.ratingCount += ratingValues.length;
      entry.ratingSum += ratingValues.reduce((sum, value) => sum + value, 0);
      entry.postCount += 1;
    });
    const members = Array.from(map.values()).map(entry => {
      const avgRating = entry.ratingCount ? entry.ratingSum / entry.ratingCount : 0;
      const score = floor1(entry.likes * 0.3 + entry.ratingCount * avgRating * 0.7 + entry.postCount * 10);
      const savedTier = (window.state?.activeUsers || []).find(user => user.id === entry.userId)?.rankTier;
      const currentTier = tiers.find(tier => tier.code === savedTier) || tierByScore(score);
      return { ...entry, avgRating, score, currentTier };
    }).sort((a, b) => b.score - a.score || b.likes - a.likes || b.ratingCount - a.ratingCount);
    return { start, end, posts, members };
  }

  function nearbyTierCards(currentTier) {
    const index = tierIndex(currentTier.code);
    const visibleIndexes = [...new Set([Math.max(0, index - 1), index, Math.min(tiers.length - 1, index + 1)])];
    return visibleIndexes.map(position => {
      const tier = tiers[position];
      const stateClass = tier.code === currentTier.code ? 'sr-rank-tier-current' : '';
      return `<div class="sr-rank-tier-card ${stateClass}"><div class="text-sm font-black text-amber-300 font-luxury">${tier.code}</div><div class="text-xs text-slate-400 mt-1">升階 ${tier.promote}</div><div class="text-xs text-slate-500">保級 ${tier.keep}</div></div>`;
    }).join('');
  }

  function rankMemberCard(entry, index, pinned = false) {
    return `<button type="button" class="sr-rank-member ${pinned ? 'sr-rank-member-pinned' : ''}" onclick="viewUserProfile('${js(entry.userId)}')"><span class="w-9 text-center font-black text-amber-300 font-luxury">#${index + 1}</span><img src="${entry.avatar || 'Gemini_Generated_Image_e2fxvje2fxvje2fx.jpg?v=2'}" class="w-12 h-12 rounded-2xl object-cover border border-amber-500/20 shrink-0"><span class="min-w-0 flex-1 text-left"><span class="flex items-center gap-2 flex-wrap"><strong class="text-slate-100 truncate">${esc(entry.nickname)}</strong><span class="text-xs text-slate-500 font-mono">@${esc(entry.userId)}</span></span><span class="block text-xs text-slate-500 mt-1">${entry.postCount} 篇 · ${entry.likes} 讚 · ${entry.ratingCount} 人評星 · 平均 ${entry.avgRating.toFixed(1)} 星</span></span><span class="text-right shrink-0"><span class="inline-flex items-center justify-center min-w-[4rem] px-3 py-2 rounded-2xl bg-gradient-to-br ${entry.currentTier.tone} text-slate-950 font-black font-luxury">${entry.currentTier.code}</span><strong class="block text-sm text-white mt-1">${entry.score.toFixed(1)}</strong></span></button>`;
  }

  function renderRankRules() {
    const container = qs('dashboard-tab-content');
    if (!container || window.state?.currentTab !== 'rank') return;
    if (container.dataset.srRankVersion === VERSION) return;
    const { start, end, posts, members } = getWeeklyRankData();
    const currentIndex = members.findIndex(member => member.userId === window.state?.applicationId);
    const current = currentIndex >= 0 ? members[currentIndex] : null;
    const currentTier = current?.currentTier || tiers[0];
    const currentScore = current?.score || 0;
    const index = tierIndex(currentTier.code);
    const nextTier = tiers[Math.min(tiers.length - 1, index + 1)];
    const atTop = index === tiers.length - 1;
    const range = Math.max(1, nextTier.promote - currentTier.promote);
    const progress = atTop ? 100 : clamp(((currentScore - currentTier.promote) / range) * 100, 0, 100);
    const pointsNeeded = atTop ? 0 : Math.max(0, floor1(nextTier.promote - currentScore));
    const hasPost = (current?.postCount || 0) > 0;
    const periodText = `${start.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })}－${end.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })}`;
    const topTen = members.slice(0, 10);
    const pinnedCurrent = currentIndex >= 10 ? current : null;
    container.dataset.srRankVersion = VERSION;
    container.innerHTML = `<div class="space-y-4"><section class="glass-panel crystal-border rounded-3xl p-5 md:p-6"><div class="flex items-start justify-between gap-4"><div><div class="text-xs text-amber-400/80 font-black tracking-wider">本週位階</div><h2 class="text-2xl font-black text-white mt-1">${currentTier.code}</h2><p class="text-xs text-slate-400 mt-1">${periodText} · 每週日結算</p></div><div class="text-right"><div class="text-3xl font-black text-white">${currentScore.toFixed(1)}</div><div class="text-xs text-slate-500">目前分數</div></div></div><div class="mt-5"><div class="flex items-center justify-between gap-3 text-xs"><span class="text-slate-300">${atTop ? '已到最高位階' : `距離 ${nextTier.code} 還差 ${pointsNeeded.toFixed(1)} 分`}</span><span class="text-amber-300 font-black">${Math.round(progress)}%</span></div><div class="sr-rank-progress mt-2"><span style="width:${progress}%"></span></div><div class="mt-3 flex flex-wrap gap-2"><span class="sr-status-pill ${hasPost ? 'sr-status-good' : 'sr-status-warn'}"><i class="fa-solid ${hasPost ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i>${hasPost ? '本週已符合發文條件' : '本週至少要發 1 篇才能升階'}</span>${current ? `<span class="sr-status-pill">目前第 ${currentIndex + 1} 名</span>` : '<span class="sr-status-pill">發文後開始計分</span>'}</div></div></section><section class="glass-panel crystal-border rounded-3xl p-5"><div class="flex items-center justify-between gap-3 mb-3"><div><h3 class="font-black text-white">位階門檻</h3><p class="text-xs text-slate-500 mt-1">先看上一階、目前和下一階。</p></div><button id="sr-rank-rules-toggle" type="button" class="sr-secondary-button">查看全部</button></div><div class="grid grid-cols-3 gap-2">${nearbyTierCards(currentTier)}</div><div id="sr-rank-all-rules" class="hidden grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">${tiers.map(tier => `<div class="sr-rank-tier-card"><div class="text-sm font-black text-amber-300 font-luxury">${tier.code}</div><div class="text-xs text-slate-400 mt-1">升階 ${tier.promote}</div><div class="text-xs text-slate-500">保級 ${tier.keep}</div></div>`).join('')}</div></section><section class="glass-panel crystal-border rounded-3xl p-5 md:p-6"><div class="flex items-center justify-between gap-3 mb-4"><div><h3 class="text-lg font-black text-white">本週排行榜</h3><p class="text-xs text-slate-500 mt-1">${posts.length} 篇貼文列入計分，先顯示前 10 名。</p></div></div><div class="space-y-3">${topTen.length ? topTen.map((entry, position) => rankMemberCard(entry, position)).join('') : '<div class="text-center py-10 text-slate-500"><i class="fa-solid fa-ranking-star text-3xl text-amber-500/40 mb-3"></i><div class="font-black text-slate-300">這週還沒有人上榜</div><div class="text-xs mt-1">發一篇貼文，拿到讚或評星後就會出現在這裡。</div></div>'}${pinnedCurrent ? `<div class="pt-2 border-t border-amber-500/10"><div class="text-xs text-amber-300 font-black mb-2">你的名次</div>${rankMemberCard(pinnedCurrent, currentIndex, true)}</div>` : ''}</div></section></div>`;
    qs('sr-rank-rules-toggle')?.addEventListener('click', event => {
      const rules = qs('sr-rank-all-rules');
      if (!rules) return;
      const opening = rules.classList.contains('hidden');
      rules.classList.toggle('hidden', !opening);
      event.currentTarget.textContent = opening ? '收起規則' : '查看全部';
    });
  }

  function normalizeBrandAndNav() {
    const specTab = qs('aside-tab-spec-vault');
    if (specTab) {
      const main = specTab.querySelector('span:first-child');
      const pill = Array.from(specTab.querySelectorAll('span')).find(span => span !== main && /黃金|Spec|限定/i.test(textOf(span)));
      pill?.classList.add('sr-spec-nav-pill');
    }
    const badgeTab = qs('aside-tab-badge-progress');
    if (badgeTab) {
      const badge = Array.from(badgeTab.querySelectorAll('span')).find(span => /^Badge$/i.test(textOf(span)) || /徽章|進度/.test(textOf(span)));
      badge?.classList.add('sr-badge-nav-pill');
    }
  }

  function getUnreadCount() {
    const badgeText = textOf(qs('aside-notification-count') || qs('mobile-notification-count'));
    const badgeCount = Number.parseInt(badgeText, 10);
    if (Number.isFinite(badgeCount)) return badgeCount;
    const readSet = (() => {
      try { return new Set(JSON.parse(localStorage.getItem('sr_notifications_read') || '[]').map(String)); }
      catch (_) { return new Set(); }
    })();
    return (window.state?.notifications || []).filter(item => !item.revoked && !readSet.has(String(item.id || item.notificationId || ''))).length;
  }

  function openNotifications() {
    const button = qs('aside-tab-notifications') || qs('mobile-btn-notifications');
    button?.click();
  }

  function enhanceFeedHierarchy() {
    const container = qs('dashboard-tab-content');
    const list = qs('feed-posts-list');
    if (!container || !list || window.state?.currentTab !== 'feed') return;

    if (!qs('sr-feed-compose-card')) {
      const compose = document.createElement('button');
      compose.id = 'sr-feed-compose-card';
      compose.type = 'button';
      compose.dataset.srOpenShare = '1';
      compose.className = 'w-full glass-panel crystal-border rounded-3xl p-4 flex items-center gap-3 text-left';
      compose.innerHTML = `<img src="${window.state?.userData?.avatar || 'Gemini_Generated_Image_e2fxvje2fxvje2fx.jpg?v=2'}" class="w-11 h-11 rounded-full object-cover border border-amber-500/20"><span class="flex-1 min-w-0"><strong class="block text-sm text-slate-200">分享近況</strong><span class="block text-xs text-slate-500 mt-1">寫點文字，或上傳一張照片。</span></span><span class="sr-compose-action"><i class="fa-solid fa-plus"></i></span>`;
      container.insertBefore(compose, container.firstElementChild);
    }

    const unread = getUnreadCount();
    let notice = qs('sr-feed-notice-card');
    if (unread > 0 && !notice) {
      notice = document.createElement('button');
      notice.id = 'sr-feed-notice-card';
      notice.type = 'button';
      notice.className = 'w-full rounded-2xl border border-amber-500/15 bg-amber-500/5 p-3 flex items-center gap-3 text-left';
      const compose = qs('sr-feed-compose-card');
      compose?.insertAdjacentElement('afterend', notice);
    }
    if (notice) {
      notice.classList.toggle('hidden', unread <= 0);
      notice.innerHTML = `<span class="w-9 h-9 rounded-full bg-amber-500/10 text-amber-300 flex items-center justify-center"><i class="fa-solid fa-bell"></i></span><span class="flex-1"><strong class="block text-sm text-slate-200">你有 ${unread} 則未讀通知</strong><span class="block text-xs text-slate-500 mt-0.5">點一下查看審核、檢舉或平台通知。</span></span><i class="fa-solid fa-chevron-right text-amber-300"></i>`;
      notice.onclick = openNotifications;
    }

    if (!qs('sr-feed-list-heading')) {
      const heading = document.createElement('div');
      heading.id = 'sr-feed-list-heading';
      heading.className = 'flex items-center justify-between gap-3 pt-1';
      heading.innerHTML = '<div><h3 class="text-base font-black text-white">最新動態</h3><p class="text-xs text-slate-500 mt-0.5">依目前篩選顯示內容</p></div>';
      list.insertAdjacentElement('beforebegin', heading);
    }

    let loadMore = qs('sr-feed-load-more');
    if (!loadMore) {
      loadMore = document.createElement('button');
      loadMore.id = 'sr-feed-load-more';
      loadMore.type = 'button';
      loadMore.className = 'w-full sr-secondary-button mt-2';
      loadMore.textContent = '載入更多';
      list.insertAdjacentElement('afterend', loadMore);
      loadMore.onclick = () => {
        window.state.visiblePostsCount = Number(window.state.visiblePostsCount || 5) + 5;
        if (typeof window.setGlobalFilterLabel === 'function') window.setGlobalFilterLabel(window.state.currentFilter || 'recommended');
      };
    }
    loadMore.classList.toggle('hidden', Number(window.state?.visiblePostsCount || 5) >= Number(window.state?.posts?.length || 0));
  }

  function enhanceSearch() {
    const input = qs('feed-search-input');
    const overlay = qs('search-results-overlay');
    if (!input || !overlay || window.state?.currentTab !== 'feed') return;
    overlay.classList.add('sr-search-drawer');
    input.placeholder = '搜尋貼文、標籤、暱稱或帳號 ID';
    const searchBar = input.parentElement;
    if (searchBar && !qs('sr-search-clear')) {
      const clear = document.createElement('button');
      clear.id = 'sr-search-clear';
      clear.type = 'button';
      clear.className = 'sr-icon-button hidden';
      clear.setAttribute('aria-label', '清除搜尋');
      clear.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      searchBar.appendChild(clear);
      clear.onclick = () => {
        input.value = '';
        window.state.searchTerm = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        if (typeof window.setGlobalFilterLabel === 'function') window.setGlobalFilterLabel(window.state.currentFilter || 'recommended');
        input.focus();
      };
    }
    qs('sr-search-clear')?.classList.toggle('hidden', !input.value.trim());

    const accountTab = overlay.querySelector(`button[onclick*="setSearchTab('users')"]`);
    if (accountTab) {
      const count = (textOf(accountTab).match(/\d+/) || ['0'])[0];
      accountTab.textContent = `帳號 (${count})`;
    }
    const postTab = overlay.querySelector(`button[onclick*="setSearchTab('posts')"]`);
    if (postTab) {
      const count = (textOf(postTab).match(/\d+/) || ['0'])[0];
      postTab.textContent = `貼文 (${count})`;
    }
    Array.from(overlay.querySelectorAll('div')).forEach(node => {
      if (node.children.length) return;
      const text = textOf(node);
      if (/未尋得相符同好|未尋得相符帳號/.test(text)) node.innerHTML = '<i class="fa-solid fa-user-magnifying-glass block text-xl text-amber-500/50 mb-2"></i><strong class="block text-sm text-slate-300">找不到符合的帳號</strong><span class="block text-xs text-slate-500 mt-1">換個帳號 ID 或暱稱試試。</span>';
      if (/未尋得相符動態貼文/.test(text)) node.innerHTML = '<i class="fa-regular fa-file-lines block text-xl text-amber-500/50 mb-2"></i><strong class="block text-sm text-slate-300">找不到符合的貼文</strong><span class="block text-xs text-slate-500 mt-1">換個關鍵字或標籤試試。</span>';
    });
    if (!overlay.classList.contains('hidden') && !qs('sr-search-toolbar')) {
      const toolbar = document.createElement('div');
      toolbar.id = 'sr-search-toolbar';
      toolbar.className = 'flex items-center justify-between gap-3 rounded-xl border border-amber-500/10 bg-slate-950/45 px-3 py-2';
      toolbar.innerHTML = `<span class="text-xs text-slate-400 truncate">搜尋「<strong class="text-amber-300">${esc(input.value.trim())}</strong>」</span><button type="button" id="sr-search-clear-overlay" class="text-xs text-amber-300 font-black shrink-0">清除</button>`;
      overlay.insertBefore(toolbar, overlay.firstElementChild);
      qs('sr-search-clear-overlay').onclick = () => qs('sr-search-clear')?.click();
    }
  }

  function enhanceFilters() {
    const labels = {
      recommended: '推薦',
      'highly-rated': '高分',
      popular: '最多讚'
    };
    Object.entries(labels).forEach(([key, label]) => {
      const button = qs(`filter-btn-${key}`);
      if (!button) return;
      button.classList.add('sr-filter-button');
      if (!button.dataset.srRelabeled) {
        button.dataset.srRelabeled = '1';
        button.textContent = label;
      }
      if (!button.dataset.srPersistBound) {
        button.dataset.srPersistBound = '1';
        button.addEventListener('click', () => localStorage.setItem(FILTER_KEY, key), true);
      }
    });
    const filterRow = qs('filter-btn-recommended')?.parentElement;
    if (!filterRow) return;
    const saved = localStorage.getItem(FILTER_KEY);
    if (!filterRow.dataset.srFilterRestored) {
      filterRow.dataset.srFilterRestored = '1';
      if (saved && saved !== window.state?.currentFilter && typeof window.setGlobalFilter === 'function') {
        window.setGlobalFilter(saved);
      }
    }
    localStorage.setItem(FILTER_KEY, window.state?.currentFilter || 'recommended');
    if (!qs('sr-active-filter')) {
      const row = document.createElement('div');
      row.id = 'sr-active-filter';
      row.className = 'flex items-center justify-between gap-3 rounded-xl border border-amber-500/10 bg-slate-950/25 px-3 py-2';
      filterRow.insertAdjacentElement('afterend', row);
    }
    const active = window.state?.currentFilter || 'recommended';
    const activeLabel = labels[active] || active;
    qs('sr-active-filter').innerHTML = `<span class="text-xs text-slate-400">目前篩選：<strong class="text-amber-300">${esc(activeLabel)}</strong></span>${active !== 'recommended' ? '<button id="sr-clear-filter" type="button" class="text-xs font-black text-amber-300">清除篩選</button>' : ''}`;
    qs('sr-clear-filter')?.addEventListener('click', () => {
      localStorage.setItem(FILTER_KEY, 'recommended');
      window.setGlobalFilter?.('recommended');
    });
  }

  function enhanceFeedLoading() {
    const list = qs('feed-posts-list');
    if (!list || list.dataset.srSkeleton === '1') return;
    if (!/正在與俱樂部建立通道|正在載入/.test(textOf(list))) return;
    list.dataset.srSkeleton = '1';
    list.innerHTML = Array.from({ length: 2 }, () => '<div class="glass-panel crystal-border rounded-3xl p-5 animate-pulse"><div class="flex items-center gap-3"><div class="w-11 h-11 rounded-full bg-slate-800"></div><div class="flex-1"><div class="h-3 rounded bg-slate-800 w-1/3"></div><div class="h-2 rounded bg-slate-900 w-1/4 mt-2"></div></div></div><div class="h-3 rounded bg-slate-800 mt-5"></div><div class="h-3 rounded bg-slate-800 w-4/5 mt-2"></div><div class="h-40 rounded-2xl bg-slate-900 mt-4"></div></div>').join('');
  }

  function bindFeedScroll() {
    const scroll = qs('main-content-scroll');
    if (!scroll || scroll.dataset.srScrollBound === '1') return;
    scroll.dataset.srScrollBound = '1';
    const saved = Number(sessionStorage.getItem(SCROLL_KEY) || 0);
    if (window.state?.currentTab === 'feed' && saved > 0) requestAnimationFrame(() => { scroll.scrollTop = saved; });
    scroll.addEventListener('scroll', () => {
      if (window.state?.currentTab === 'feed') sessionStorage.setItem(SCROLL_KEY, String(scroll.scrollTop));
      qs('sr-back-to-top')?.classList.toggle('sr-back-to-top-visible', scroll.scrollTop > 500);
    }, { passive: true });
    if (!qs('sr-back-to-top')) {
      const button = document.createElement('button');
      button.id = 'sr-back-to-top';
      button.type = 'button';
      button.className = 'sr-back-to-top';
      button.setAttribute('aria-label', '回到頂端');
      button.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
      document.body.appendChild(button);
      button.onclick = () => scroll.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function draftRead() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); }
    catch (_) { return {}; }
  }
  function draftWrite(value) {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(value)); }
    catch (_) {}
  }

  function processImage(file, watermarkText, onProgress) {
    return new Promise((resolve, reject) => {
      if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return reject(new Error('僅支援 JPG、PNG 或 WebP。'));
      if (file.size > 8 * 1024 * 1024) return reject(new Error('單張圖片不可超過 8MB。'));
      const reader = new FileReader();
      reader.onprogress = event => { if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 45)); };
      reader.onerror = () => reject(new Error('讀取圖片失敗。'));
      reader.onload = event => {
        onProgress?.(55);
        const image = new Image();
        image.onerror = () => reject(new Error('圖片無法開啟。'));
        image.onload = () => {
          try {
            const maxDimension = 800;
            let width = image.width;
            let height = image.height;
            if (width > maxDimension || height > maxDimension) {
              const ratio = Math.min(maxDimension / width, maxDimension / height);
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d');
            context.drawImage(image, 0, 0, width, height);
            onProgress?.(75);
            const fontSize = Math.max(11, Math.round(Math.min(width, height) * 0.03));
            context.save();
            context.translate(width / 2, height / 2);
            context.rotate(Math.PI / 4);
            context.font = `600 ${fontSize}px Cinzel, Inter, sans-serif`;
            context.fillStyle = 'rgba(244,247,251,.045)';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            const stepX = Math.max(170, Math.round(fontSize * 13));
            const stepY = Math.max(110, Math.round(fontSize * 8));
            const span = Math.ceil((width + height) * 1.2);
            for (let y = -span; y <= span; y += stepY) for (let x = -span; x <= span; x += stepX) context.fillText(watermarkText, x, y);
            context.restore();
            onProgress?.(95);
            resolve(canvas.toDataURL('image/jpeg', .76));
            onProgress?.(100);
          } catch (error) { reject(error); }
        };
        image.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function openShareModal() {
    if (qs('sr-share-modal')) return;
    const draft = draftRead();
    let imageData = '';
    let selectedFile = null;
    let processing = false;
    let submitting = false;
    let dirty = !!draft.text;
    const modal = document.createElement('div');
    modal.id = 'sr-share-modal';
    modal.className = 'fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-4 bg-black/92 backdrop-blur-md';
    modal.innerHTML = `<div class="glass-panel crystal-border border border-amber-500/20 rounded-3xl p-5 sm:p-6 w-[96vw] max-w-lg max-h-[94vh] overflow-y-auto relative"><button id="sr-share-close" type="button" class="sr-icon-button absolute top-3 right-3" aria-label="關閉發文"><i class="fa-solid fa-xmark"></i></button><h3 class="text-lg font-black text-white pr-12"><i class="fa-solid fa-feather-pointed text-amber-500 mr-2"></i>分享動態</h3><p class="text-xs text-slate-400 mt-1">文字會自動存成草稿，照片處理完成後才可發布。</p><div class="space-y-4 mt-5"><div><label class="block text-xs font-black text-slate-300 mb-1.5">動態內容</label><textarea id="sr-share-text" rows="4" class="w-full bg-slate-900 border border-amber-500/10 rounded-xl px-3.5 py-3 text-sm text-white focus:outline-none focus:border-amber-500 resize-none" placeholder="分享現在的近況...">${esc(draft.text || '')}</textarea></div><div><div class="flex items-center justify-between gap-3 mb-1.5"><label class="text-xs font-black text-slate-300">照片（選填）</label><button id="sr-share-remove-image" type="button" class="hidden text-xs font-black text-rose-300 min-h-[44px]">移除照片</button></div><button id="sr-share-image-trigger" type="button" class="w-full min-h-[180px] rounded-2xl border border-dashed border-amber-500/25 bg-slate-950/60 flex items-center justify-center overflow-hidden relative"><img id="sr-share-preview" class="hidden absolute inset-0 w-full h-full object-contain"><span id="sr-share-placeholder" class="text-center text-slate-500"><i class="fa-regular fa-image text-3xl text-amber-500/60"></i><strong class="block text-sm text-slate-300 mt-2">選擇照片</strong><small class="block text-xs mt-1">JPG、PNG、WebP，最多 8MB</small></span></button><input id="sr-share-file" type="file" accept="image/jpeg,image/png,image/webp" class="hidden"><div id="sr-share-progress-wrap" class="hidden mt-3"><div class="flex items-center justify-between text-xs"><span id="sr-share-progress-text" class="text-slate-400">正在處理照片...</span><span id="sr-share-progress-number" class="text-amber-300 font-black">0%</span></div><div class="sr-upload-progress mt-2"><span id="sr-share-progress-bar"></span></div><button id="sr-share-retry-image" type="button" class="hidden sr-secondary-button mt-2 w-full">重新處理</button></div><p id="sr-share-image-status" class="text-xs text-slate-500 mt-2">上傳後會自動壓縮並加入 SecretRoom 浮水印。</p></div><label class="flex items-start gap-3 rounded-2xl border border-rose-500/15 bg-rose-500/5 p-3 cursor-pointer"><input id="sr-share-sensitive" type="checkbox" class="mt-1 w-4 h-4 accent-rose-500" ${draft.sensitive ? 'checked' : ''}><span><strong class="block text-xs text-rose-300">這是敏感照片</strong><span class="block text-xs text-slate-500 mt-1">勾選後，照片會先模糊，點一下才會顯示。</span></span></label><div><label class="block text-xs font-black text-slate-300 mb-2">主題標籤（至少一項）</label><div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto rounded-2xl border border-amber-500/10 bg-slate-950/40 p-3">${(window.state?.kinksOptions || []).map(tag => `<label class="flex items-center gap-2 min-h-[44px] rounded-xl px-2 hover:bg-slate-900/60"><input type="checkbox" name="sr-share-tag" value="${esc(tag)}" class="w-4 h-4 accent-amber-500" ${(draft.tags || []).includes(tag) ? 'checked' : ''}><span class="text-xs text-slate-300">${esc(tag)}</span></label>`).join('')}</div></div><button id="sr-share-submit" type="button" class="w-full min-h-[48px] brushed-gold crystal-border rounded-xl text-sm font-black">發布動態</button></div></div>`;
    document.body.appendChild(modal);

    const textInput = qs('sr-share-text');
    const fileInput = qs('sr-share-file');
    const preview = qs('sr-share-preview');
    const placeholder = qs('sr-share-placeholder');
    const removeButton = qs('sr-share-remove-image');
    const submitButton = qs('sr-share-submit');
    const progressWrap = qs('sr-share-progress-wrap');
    const progressText = qs('sr-share-progress-text');
    const progressNumber = qs('sr-share-progress-number');
    const progressBar = qs('sr-share-progress-bar');
    const retryButton = qs('sr-share-retry-image');
    const statusText = qs('sr-share-image-status');

    const updateDraft = () => draftWrite({
      text: textInput.value,
      sensitive: qs('sr-share-sensitive').checked,
      tags: Array.from(document.querySelectorAll('input[name="sr-share-tag"]:checked')).map(input => input.value)
    });
    const updateProgress = percent => {
      progressWrap.classList.remove('hidden');
      progressNumber.textContent = `${percent}%`;
      progressBar.style.width = `${percent}%`;
    };
    const processSelected = async () => {
      if (!selectedFile || processing) return;
      processing = true;
      retryButton.classList.add('hidden');
      progressText.textContent = '正在壓縮並加上浮水印...';
      updateProgress(0);
      try {
        const account = String(window.state?.applicationId || 'account').replace(/^@+/, '');
        imageData = await processImage(selectedFile, `SecretRoom @${account}`, updateProgress);
        preview.src = imageData;
        preview.classList.remove('hidden');
        placeholder.classList.add('hidden');
        removeButton.classList.remove('hidden');
        progressText.textContent = '照片處理完成';
        statusText.textContent = qs('sr-share-sensitive').checked ? '照片會先模糊顯示，並帶有 SecretRoom 浮水印。' : '照片會直接顯示，並帶有 SecretRoom 浮水印。';
        dirty = true;
      } catch (error) {
        console.error(error);
        imageData = '';
        progressText.textContent = error.message || '照片處理失敗';
        progressNumber.textContent = '失敗';
        progressBar.style.width = '0%';
        retryButton.classList.remove('hidden');
        window.showToast?.(error.message || '照片處理失敗，請重試。', 'error');
      } finally {
        processing = false;
      }
    };
    const close = force => {
      if (!force && dirty && !confirm('這篇動態還沒發布，要保留草稿並離開嗎？')) return;
      if (!force) updateDraft();
      window.removeEventListener('beforeunload', beforeUnload);
      modal.remove();
    };
    const beforeUnload = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);

    qs('sr-share-close').onclick = () => close(false);
    modal.addEventListener('click', event => { if (event.target === modal) close(false); });
    qs('sr-share-image-trigger').onclick = () => fileInput.click();
    fileInput.onchange = () => { selectedFile = fileInput.files?.[0] || null; if (selectedFile) processSelected(); };
    retryButton.onclick = processSelected;
    removeButton.onclick = () => {
      selectedFile = null;
      imageData = '';
      fileInput.value = '';
      preview.src = '';
      preview.classList.add('hidden');
      placeholder.classList.remove('hidden');
      removeButton.classList.add('hidden');
      progressWrap.classList.add('hidden');
      statusText.textContent = '上傳後會自動壓縮並加入 SecretRoom 浮水印。';
      dirty = true;
    };
    textInput.addEventListener('input', () => { dirty = true; updateDraft(); });
    qs('sr-share-sensitive').addEventListener('change', () => { dirty = true; updateDraft(); if (imageData) statusText.textContent = qs('sr-share-sensitive').checked ? '照片會先模糊顯示，並帶有 SecretRoom 浮水印。' : '照片會直接顯示，並帶有 SecretRoom 浮水印。'; });
    document.querySelectorAll('input[name="sr-share-tag"]').forEach(input => input.addEventListener('change', () => { dirty = true; updateDraft(); }));

    submitButton.onclick = async () => {
      if (submitting || processing) return;
      const text = textInput.value.trim();
      const tags = Array.from(document.querySelectorAll('input[name="sr-share-tag"]:checked')).map(input => input.value);
      if (!text && !imageData) return window.showToast?.('請輸入文字或選一張照片。', 'error');
      if (!tags.length) return window.showToast?.('請至少選一個主題標籤。', 'error');
      submitting = true;
      submitButton.disabled = true;
      submitButton.classList.add('opacity-60', 'cursor-not-allowed');
      submitButton.textContent = '正在發布...';
      try {
        if (!window.SRP?.tools) throw new Error('資料庫尚未連線。');
        const { db, fs } = await window.SRP.tools();
        const postRef = fs.doc(fs.collection(db, 'secretg_apps', APP_ID, 'posts'));
        await fs.setDoc(postRef, {
          userId: window.state.applicationId,
          authorName: window.state.userData?.nickname || window.state.applicationId,
          authorAvatar: window.state.userData?.avatar || '',
          text,
          image: imageData,
          isSensitive: qs('sr-share-sensitive').checked,
          kinks: tags,
          likes: {},
          likeCount: 0,
          ratings: {},
          comments: {},
          viewCount: 0,
          reports: [],
          reportCount: 0,
          createdAt: fs.serverTimestamp(),
          createdAtMs: Date.now()
        });
        localStorage.removeItem(DRAFT_KEY);
        dirty = false;
        close(true);
        window.showToast?.('動態已發布。', 'success');
      } catch (error) {
        console.error('發布動態失敗:', error);
        window.showToast?.('沒有發布成功：' + error.message, 'error');
        submitButton.disabled = false;
        submitButton.classList.remove('opacity-60', 'cursor-not-allowed');
        submitButton.textContent = '重新發布';
      } finally {
        submitting = false;
      }
    };
  }

  function markNotificationReadLocally(id) {
    if (!id) return;
    let values = [];
    try { values = JSON.parse(localStorage.getItem('sr_notifications_read') || '[]'); }
    catch (_) {}
    const set = new Set(values.map(String));
    set.add(String(id));
    localStorage.setItem('sr_notifications_read', JSON.stringify(Array.from(set).slice(-1000)));
    if (window.state) {
      if (!(window.state.notificationReadSet instanceof Set)) window.state.notificationReadSet = new Set();
      window.state.notificationReadSet.add(String(id));
    }
  }

  function parseDisplayDate(text) {
    const match = String(text || '').match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function notificationGroupLabel(date) {
    if (!date) return '更早';
    const today = new Date();
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diff = Math.round((startToday - startDate) / 86400000);
    if (diff === 0) return '今天';
    if (diff === 1) return '昨天';
    return '更早';
  }

  function enhanceNotifications() {
    const list = qs('notifications-list');
    if (!list || window.state?.currentTab !== 'notifications' || list.dataset.srGrouped === '1') return;
    const cards = Array.from(list.querySelectorAll(':scope > article.notification-item'));
    if (!cards.length) return;
    list.dataset.srGrouped = '1';
    const groups = new Map([['今天', []], ['昨天', []], ['更早', []]]);
    cards.forEach(card => {
      const dateText = textOf(card.querySelector('.font-mono span:first-child') || card.querySelector('.font-mono'));
      groups.get(notificationGroupLabel(parseDisplayDate(dateText))).push(card);
      const id = card.dataset.notificationId;
      const item = (window.state?.notifications || []).find(notification => String(notification.id || notification.notificationId || '') === String(id || ''));
      if (item?.sourceId && !card.querySelector('.sr-notification-action')) {
        const action = document.createElement('button');
        action.type = 'button';
        action.className = 'sr-notification-action sr-secondary-button mt-3';
        action.textContent = item.sourceType === 'post' ? '查看貼文' : '查看內容';
        action.onclick = event => {
          event.preventDefault();
          event.stopPropagation();
          markNotificationReadLocally(id);
          if (item.sourceType === 'post' && typeof window.viewSinglePost === 'function') window.viewSinglePost(item.sourceId);
          else if (String(item.type || '').includes('spec')) (qs('aside-tab-spec-vault') || qs('mobile-menu-spec-vault'))?.click();
          else (qs('aside-profile-trigger') || qs('mobile-tab-profile'))?.click();
        };
        card.querySelector('.min-w-0.flex-1')?.appendChild(action);
      }
    });
    list.innerHTML = '';
    groups.forEach((groupCards, label) => {
      if (!groupCards.length) return;
      const section = document.createElement('section');
      section.className = 'space-y-3';
      section.innerHTML = `<h3 class="text-xs font-black text-slate-400 tracking-wider px-1">${label}</h3>`;
      groupCards.forEach(card => section.appendChild(card));
      list.appendChild(section);
    });
  }

  function improveTextAndForms() {
    const replacements = [
      ['勾選後，大廳相片將預設以高精度毛玻璃覆蓋，點擊才會手動解密觀看。', '勾選後，照片會先模糊，點一下才會顯示。'],
      ['發布近期動態。發布相片時將自動生成淡色、較隱性的「SecretRomm @使用者帳號」滿版 45 度浮水印；若原始圖片本身已有其他浮水印，系統不會自動移除。', '發文或上傳照片時，系統會自動加上 SecretRoom 浮水印；原圖上的浮水印不會被移除。'],
      ['相片加載後將自動生成淡色、較隱性的「SecretRomm @使用者帳號」滿版 45 度浮水印；若原始圖片本身已有其他浮水印，系統不會自動移除。', '照片上傳後會自動加上 SecretRoom 浮水印；原圖上的浮水印不會被移除。']
    ];
    document.querySelectorAll('p,div,span,label').forEach(element => {
      if (element.children.length > 1) return;
      const text = textOf(element);
      const found = replacements.find(([from]) => text.includes(from));
      if (found && !element.dataset.srCopyOptimized) {
        element.dataset.srCopyOptimized = '1';
        element.textContent = text.replace(found[0], found[1]);
      }
    });
    document.querySelectorAll('textarea,input[type="text"],input[type="password"],input[type="email"],input:not([type])').forEach(element => element.classList.add('sr-readable-field'));
    document.querySelectorAll('button').forEach(button => {
      if (!textOf(button) || button.getAttribute('aria-label')) button.classList.add('sr-icon-hit');
    });
    document.querySelectorAll('.sr-watermark-grid span').forEach(span => { if (span.textContent.includes('SecretRomm')) span.textContent = span.textContent.replaceAll('SecretRomm', 'SecretRoom'); });
  }

  function installStyles() {
    if (qs('sr-phase1-frontend-style')) return;
    const style = document.createElement('style');
    style.id = 'sr-phase1-frontend-style';
    style.textContent = `
      #dashboard-tab-content button,.sr-dashboard-left button,.sr-mobile-dashboard-nav button{min-height:44px}.sr-icon-hit,.sr-icon-button{min-width:44px!important;min-height:44px!important;display:inline-flex;align-items:center;justify-content:center;border-radius:999px}.sr-icon-button{color:#cbd5e1;background:rgba(15,23,42,.72);border:1px solid rgba(245,158,11,.15)}
      #dashboard-tab-content .text-\\[9px\\],#dashboard-tab-content .text-\\[10px\\],#dashboard-tab-content .text-\\[11px\\],#search-results-overlay .text-\\[8px\\],#search-results-overlay .text-\\[10px\\],#search-results-overlay .text-\\[11px\\]{font-size:12px!important;line-height:1.45!important}.sr-readable-field{line-height:1.5!important}.text-slate-500{color:#8793a6}
      .sr-secondary-button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:.6rem .9rem;border-radius:.85rem;border:1px solid rgba(245,158,11,.18);background:rgba(15,23,42,.62);color:#fcd34d;font-size:12px;font-weight:900}.sr-status-pill{display:inline-flex;align-items:center;gap:.4rem;min-height:30px;padding:.35rem .65rem;border-radius:999px;border:1px solid rgba(148,163,184,.14);background:rgba(15,23,42,.5);color:#94a3b8;font-size:12px;font-weight:800}.sr-status-good{color:#6ee7b7;border-color:rgba(16,185,129,.2);background:rgba(16,185,129,.06)}.sr-status-warn{color:#fcd34d;border-color:rgba(245,158,11,.2);background:rgba(245,158,11,.06)}
      .sr-rank-progress,.sr-upload-progress{height:.55rem;border-radius:999px;overflow:hidden;background:rgba(15,23,42,.9);border:1px solid rgba(245,158,11,.12)}.sr-rank-progress span,.sr-upload-progress span{display:block;height:100%;width:0;border-radius:999px;background:linear-gradient(90deg,#b7791f,#fcd34d);transition:width .25s ease}.sr-rank-tier-card{padding:.8rem .6rem;border-radius:1rem;text-align:center;border:1px solid rgba(245,158,11,.1);background:rgba(2,6,23,.42)}.sr-rank-tier-current{border-color:rgba(245,158,11,.45);background:rgba(245,158,11,.09);box-shadow:0 0 20px rgba(245,158,11,.08)}.sr-rank-member{width:100%;display:flex;align-items:center;gap:.75rem;padding:.9rem;border-radius:1.25rem;border:1px solid rgba(245,158,11,.1);background:rgba(2,6,23,.35);text-align:left}.sr-rank-member-pinned{border-color:rgba(245,158,11,.35);background:rgba(245,158,11,.06)}
      #sr-feed-compose-card{transition:transform .18s ease,border-color .18s ease}#sr-feed-compose-card:hover{transform:translateY(-1px);border-color:rgba(245,158,11,.32)}.sr-compose-action{display:flex;width:44px;height:44px;align-items:center;justify-content:center;border-radius:999px;background:linear-gradient(135deg,#fcd34d,#b7791f);color:#111827}.sr-filter-button{min-width:84px}.sr-search-drawer{z-index:80!important}.sr-back-to-top{position:fixed;right:1rem;bottom:6.25rem;z-index:95;width:44px;height:44px;border-radius:999px;border:1px solid rgba(245,158,11,.25);background:rgba(2,6,23,.88);color:#fcd34d;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transform:translateY(8px);transition:.2s}.sr-back-to-top-visible{opacity:1;pointer-events:auto;transform:translateY(0)}
      @media(min-width:769px){.sr-back-to-top{bottom:1.5rem;right:22rem}}
      @media(max-width:768px){.sr-search-drawer{position:fixed!important;left:.75rem!important;right:.75rem!important;top:4.5rem!important;bottom:5.25rem!important;max-height:none!important;border-radius:1.5rem!important}.sr-rank-member{padding:.75rem;gap:.55rem}.sr-rank-member img{width:42px;height:42px}}
      @media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}}
    `;
    document.head.appendChild(style);
  }

  function applyUI() {
    scheduled = false;
    installStyles();
    renderRankRules();
    normalizeBrandAndNav();
    enhanceFeedLoading();
    enhanceFeedHierarchy();
    enhanceSearch();
    enhanceFilters();
    bindFeedScroll();
    enhanceNotifications();
    improveTextAndForms();
    document.documentElement.dataset.srFrontendUi = VERSION;
  }

  let scheduled = false;
  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(applyUI);
  }

  document.addEventListener('click', event => {
    const shareButton = event.target?.closest?.('#aside-btn-share,#mobile-btn-share,[data-sr-open-share]');
    if (!shareButton) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openShareModal();
  }, true);

  new MutationObserver(scheduleApply).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', applyUI, { once: true });
  applyUI();
})();