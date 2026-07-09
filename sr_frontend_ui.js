// SecretRoom frontend UI overlay
// Keeps rank rules and lightweight UI refinements in one stable frontend patch.

(() => {
  const VERSION = '20260709-frontend-ui-stable-v4';
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

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const jsString = value => String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  const textOf = el => String(el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
  const timeValue = value => {
    if (value && value.seconds) return value.seconds * 1000;
    if (value && typeof value.toDate === 'function') return value.toDate().getTime() || 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const t = new Date(value).getTime();
      return Number.isNaN(t) ? 0 : t;
    }
    return 0;
  };
  const tierIndex = code => Math.max(0, tiers.findIndex(item => item.code === code));
  const tierByScore = score => tiers.reduce((result, item) => score >= item.promote ? item : result, tiers[0]);
  const floor1 = value => Math.floor((Number(value) || 0) * 10) / 10;

  function weekWindow(base = new Date()) {
    const day = base.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate() + diff, 0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    end.setMilliseconds(-1);
    return { start, end };
  }

  function settlePreview(currentTier, score, postCount) {
    const idx = tierIndex(currentTier.code);
    const next = tiers[Math.min(tiers.length - 1, idx + 1)];
    if (postCount > 0 && idx < tiers.length - 1 && score >= next.promote) return { label: `預估升至 ${next.code}`, tone: 'text-emerald-300', result: next };
    if (score < currentTier.keep && idx > 0) return { label: `保級挑戰：目前可能調整至 ${tiers[idx - 1].code}`, tone: 'text-rose-300', result: tiers[idx - 1] };
    return { label: `預估保留 ${currentTier.code}`, tone: 'text-amber-300', result: currentTier };
  }

  function getWeeklyRankData() {
    const { start, end } = weekWindow();
    const startMs = start.getTime();
    const endMs = end.getTime();
    const posts = (window.state?.posts || []).filter(post => {
      const t = timeValue(post.createdAt || post.createdAtMs || post.timestamp);
      return t >= startMs && t <= endMs;
    });
    const map = new Map();
    posts.forEach(post => {
      const userId = post.userId || 'unknown';
      const profile = (window.state?.activeUsers || []).find(user => user.id === userId) || {};
      if (!map.has(userId)) map.set(userId, { userId, nickname: post.authorName || profile.nickname || userId, avatar: post.authorAvatar || profile.avatar || '', likes: 0, ratingCount: 0, ratingSum: 0, postCount: 0 });
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
      const currentTier = tiers.find(item => item.code === savedTier) || tierByScore(score);
      return { ...entry, avgRating, score, currentTier, preview: settlePreview(currentTier, score, entry.postCount) };
    }).sort((a, b) => b.score - a.score || b.likes - a.likes || b.ratingCount - a.ratingCount);
    return { start, end, posts, members };
  }

  function renderRankRules() {
    const container = document.getElementById('dashboard-tab-content');
    if (!container || window.state?.currentTab !== 'rank' || container.dataset.srRankVersion === VERSION) return;
    const { start, end, posts, members } = getWeeklyRankData();
    const current = members.find(member => member.userId === window.state?.applicationId) || null;
    const currentTier = current ? current.currentTier : tiers[0];
    const currentScore = current ? current.score : 0;
    const currentPreview = current ? current.preview : settlePreview(tiers[0], 0, 0);
    const periodText = `${start.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })}－${end.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })}`;
    container.dataset.srRankVersion = VERSION;
    container.innerHTML = `
      <div class="space-y-5">
        <div class="glass-panel crystal-border rounded-3xl p-5 md:p-7 relative overflow-hidden">
          <div class="text-[10px] text-amber-400/75 font-black tracking-[0.24em] font-luxury">Weekly Game Grade</div>
          <h2 class="text-2xl md:text-3xl font-black text-white font-luxury tracking-wider mt-1">位階</h2>
          <p class="text-xs text-slate-400 mt-2 leading-relaxed max-w-2xl">每週一開始，週日結算。位階分數 = 按讚數 × 0.3 + 評星人數 × 平均星數 × 0.7 + 發文數 × 10。每週最多升 1 階、最多降 1 階；升階需本週至少發布 1 篇貼文。</p>
          <div class="text-xs text-amber-300 mt-3 font-black">本週週期：${periodText}</div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-[1fr_1.25fr] gap-4">
          <div class="glass-panel crystal-border rounded-3xl p-5"><div class="text-xs text-slate-500 font-black tracking-wider mb-2">你的本週位階</div><div class="flex items-center gap-4"><div class="w-20 h-20 rounded-3xl bg-gradient-to-br ${currentTier.tone} text-slate-950 flex items-center justify-center shadow-xl font-black font-luxury text-xl">${currentTier.code}</div><div><div class="text-3xl font-black text-white font-luxury">${currentScore.toFixed(1)}</div><div class="text-xs text-slate-400 mt-1">${current ? `${current.postCount} 篇 · ${current.likes} 讚 · ${current.ratingCount} 位評星` : '本週尚無可計分貼文'}</div><div class="text-[10px] mt-2 font-black ${currentPreview.tone}">${currentPreview.label}</div></div></div></div>
          <div class="glass-panel crystal-border rounded-3xl p-5"><div class="text-xs text-slate-500 font-black tracking-wider mb-3">牌位門檻 / 保級線</div><div class="grid grid-cols-4 gap-2">${tiers.map(tier => `<div class="rounded-2xl border border-amber-500/10 bg-slate-950/45 p-3 text-center"><div class="text-sm font-black text-amber-300 font-luxury">${tier.code}</div><div class="text-[10px] text-slate-500 mt-1">升 ${tier.promote}</div><div class="text-[10px] text-slate-600">保 ${tier.keep}</div></div>`).join('')}</div></div>
        </div>
        <div class="glass-panel crystal-border rounded-3xl p-5 md:p-6"><h3 class="text-lg font-black text-white font-luxury tracking-wider">本週位階榜</h3><p class="text-xs text-slate-500 mt-1 mb-4">共 ${posts.length} 篇貼文納入本週結算。</p><div class="space-y-3">${members.length === 0 ? `<div class="text-center py-12 text-slate-500"><i class="fa-solid fa-ranking-star text-3xl text-amber-500/40 mb-3"></i><div class="font-black text-slate-300">本週尚無位階資料</div><div class="text-xs mt-1">發布貼文並累積按讚、評星後會自動進入週榜。</div></div>` : members.map((entry, index) => `<div class="rounded-3xl border border-amber-500/10 bg-slate-950/35 p-4 flex items-center gap-3 hover-breath click-press cursor-pointer" onclick="viewUserProfile('${jsString(entry.userId)}')"><div class="w-9 text-center font-black text-amber-300 font-luxury">#${index + 1}</div><img src="${entry.avatar || 'Gemini_Generated_Image_e2fxvje2fxvje2fx.jpg?v=2'}" class="w-12 h-12 rounded-2xl object-cover border border-amber-500/20 shrink-0"><div class="min-w-0 flex-1"><div class="flex items-center gap-2 flex-wrap"><span class="font-black text-slate-100 truncate">${esc(entry.nickname)}</span><span class="text-[10px] text-slate-500 font-mono">@${esc(entry.userId)}</span></div><div class="text-[10px] text-slate-500 mt-1">${entry.postCount} 篇 · ${entry.likes} 讚 · ${entry.ratingCount} 位評星 · 均星 ${entry.avgRating.toFixed(1)}</div><div class="text-[10px] ${entry.preview.tone} font-black mt-1">${entry.preview.label}</div></div><div class="text-right shrink-0"><div class="inline-flex items-center justify-center min-w-[4rem] px-3 py-2 rounded-2xl bg-gradient-to-br ${entry.currentTier.tone} text-slate-950 font-black font-luxury">${entry.currentTier.code}</div><div class="text-sm font-black text-white mt-1">${entry.score.toFixed(1)}</div></div></div>`).join('')}</div></div>
      </div>`;
  }

  function applyUI() {
    document.querySelectorAll('#aside-tab-feed,#aside-tab-ranking,#aside-tab-notifications,#aside-tab-spec-vault,#aside-tab-badge-progress').forEach(el => el.classList.add('sr-nav-stable'));
    const badgeTab = document.getElementById('aside-tab-badge-progress');
    badgeTab?.classList.add('sr-nav-badge-item');
    const specTab = document.getElementById('aside-tab-spec-vault');
    specTab?.classList.add('sr-nav-spec-item');
    const filterLabels = { 'filter-btn-recommended': '推薦內容', 'filter-btn-highly-rated': '高評分', 'filter-btn-popular': '最多按讚' };
    Object.entries(filterLabels).forEach(([id, label]) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.classList.add('sr-two-line-pill');
      if (!btn.dataset.srRelabeled) { btn.dataset.srRelabeled = '1'; btn.textContent = label; }
    });
    const filterRoot = document.getElementById('filter-btn-recommended')?.parentElement;
    if (filterRoot && !document.getElementById('sr-feed-filter-hint')) {
      const hint = document.createElement('div');
      hint.id = 'sr-feed-filter-hint';
      hint.className = 'sr-feed-filter-hint';
      hint.textContent = '新會員建議先瀏覽「全部」，熟悉後再依推薦、評分或按讚篩選。';
      filterRoot.insertAdjacentElement('afterend', hint);
    }
    const replacements = [
      ['勾選後，大廳相片將預設以高精度毛玻璃覆蓋，點擊才會手動解密觀看。', '勾選後，照片預設模糊顯示，需點擊後才會開啟。'],
      ['發布近期動態。發布相片時將自動生成淡色、較隱性的「SecretRomm @使用者帳號」滿版 45 度浮水印；若原始圖片本身已有其他浮水印，系統不會自動移除。', '發布近況或相片。上傳圖片會自動加入 SecretRoom 浮水印；原圖既有浮水印不會移除。'],
      ['相片加載後將自動生成淡色、較隱性的「SecretRomm @使用者帳號」滿版 45 度浮水印；若原始圖片本身已有其他浮水印，系統不會自動移除。', '相片上傳後會自動加入 SecretRoom 浮水印；原圖既有浮水印不會移除。']
    ];
    document.querySelectorAll('p,div,span,label').forEach(el => {
      if (el.children.length > 1) return;
      const current = textOf(el);
      const pair = replacements.find(([from]) => current.includes(from));
      if (pair && !el.dataset.srCopyOptimized) { el.dataset.srCopyOptimized = '1'; el.textContent = current.replace(pair[0], pair[1]); }
    });
    document.querySelectorAll('textarea,input[type="text"],input[type="password"],input[type="email"],input:not([type])').forEach(el => el.classList.add('sr-readable-field'));
    document.querySelectorAll('.sr-watermark-grid span').forEach(span => { if (span.textContent.includes('SecretRomm')) span.textContent = span.textContent.replaceAll('SecretRomm', 'SecretRoom'); });
    document.documentElement.dataset.srFrontendUi = VERSION;
  }

  const css = document.createElement('style');
  css.id = 'sr-frontend-ui-style';
  css.textContent = `
    #aside-tab-feed,#aside-tab-ranking,#aside-tab-notifications,#aside-tab-spec-vault,#aside-tab-badge-progress{display:flex!important;flex-direction:row!important;align-items:center!important;white-space:normal!important;justify-content:flex-start!important;gap:.75rem!important;text-align:left!important;}
    #aside-tab-feed>span:first-child,#aside-tab-ranking>span:first-child,#aside-tab-notifications>span:first-child,#aside-tab-spec-vault>span:first-child,#aside-tab-badge-progress>span:first-child{flex:1 1 auto!important;display:flex!important;align-items:center!important;gap:.75rem!important;text-align:left!important;line-height:1.18!important;white-space:normal!important;}
    .sr-nav-badge-item [class*="Badge"],.sr-badge-nav-pill{order:-1!important;margin-left:0!important;margin-right:.35rem!important;text-align:left!important;}
    .sr-two-line-button,.sr-two-line-pill{white-space:normal!important;line-height:1.18!important;min-height:2.65rem!important;text-align:center!important;overflow-wrap:anywhere!important;}
    .sr-feed-filter-hint{margin:.4rem 0 .75rem 0;padding:.55rem .75rem;border:1px solid rgba(245,158,11,.12);border-radius:1rem;background:rgba(245,158,11,.045);color:rgba(226,232,240,.72);font-size:10.5px;line-height:1.45;text-align:left;}
    .sr-readable-field{line-height:1.45!important;}
    @media(max-width:768px){#aside-tab-feed,#aside-tab-ranking,#aside-tab-notifications,#aside-tab-spec-vault,#aside-tab-badge-progress{gap:.55rem!important}.sr-two-line-pill{min-height:2.35rem!important}}
  `;
  document.head.appendChild(css);

  const observer = new MutationObserver(() => { setTimeout(renderRankRules, 0); setTimeout(applyUI, 60); });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  setInterval(renderRankRules, 1200);
  setInterval(applyUI, 1500);
  renderRankRules();
  applyUI();
})();