// SecretRoom frontend UI overlay
// Merged from sr_rank_rules.js and sr_ui_improvements.js. Multilingual selector removed.

(() => {
  const VERSION = '20260708-frontend-ui-merged-v1';
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

  function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
  function js(v) { return String(v ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r'); }
  function textOf(el) { return String(el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim(); }
  function timeValue(v) {
    if (v && v.seconds) return v.seconds * 1000;
    if (v && typeof v.toDate === 'function') return v.toDate().getTime() || 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') { const t = new Date(v).getTime(); return Number.isNaN(t) ? 0 : t; }
    return 0;
  }
  function weekWindow(base = new Date()) {
    const d = new Date(base);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff, 0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    end.setMilliseconds(-1);
    return { start, end };
  }
  function floor1(n) { return Math.floor((Number(n) || 0) * 10) / 10; }
  function tierIndex(code) { return Math.max(0, tiers.findIndex(t => t.code === code)); }
  function tierByScore(score) { let result = tiers[0]; for (const t of tiers) if (score >= t.promote) result = t; return result; }
  function prevTier(tier) { return tiers[Math.max(0, tierIndex(tier.code) - 1)]; }
  function settlePreview(currentTier, score, postCount) {
    const currentIdx = tierIndex(currentTier.code);
    const next = tiers[Math.min(tiers.length - 1, currentIdx + 1)];
    if (postCount > 0 && currentIdx < tiers.length - 1 && score >= next.promote) return { label: `預估升至 ${next.code}`, tone: 'text-emerald-300', result: next };
    if (score < currentTier.keep && currentIdx > 0) return { label: `保級挑戰：目前可能調整至 ${prevTier(currentTier).code}`, tone: 'text-rose-300', result: prevTier(currentTier) };
    return { label: `預估保留 ${currentTier.code}`, tone: 'text-amber-300', result: currentTier };
  }
  function getWeeklyRankData() {
    const { start, end } = weekWindow();
    const startMs = start.getTime(), endMs = end.getTime();
    const posts = (window.state?.posts || []).filter(p => {
      const t = timeValue(p.createdAt || p.createdAtMs || p.timestamp);
      return t >= startMs && t <= endMs;
    });
    const map = new Map();
    posts.forEach(post => {
      const userId = post.userId || 'unknown';
      const profile = (window.state?.activeUsers || []).find(u => u.id === userId) || {};
      if (!map.has(userId)) map.set(userId, { userId, nickname: post.authorName || profile.nickname || userId, avatar: post.authorAvatar || profile.avatar || '', likes: 0, ratingCount: 0, ratingSum: 0, postCount: 0 });
      const e = map.get(userId);
      const ratingValues = Object.values(post.ratings || {}).map(Number).filter(v => Number.isFinite(v) && v > 0);
      e.likes += Number(post.likeCount || Object.keys(post.likes || {}).length || 0);
      e.ratingCount += ratingValues.length;
      e.ratingSum += ratingValues.reduce((s, v) => s + v, 0);
      e.postCount += 1;
    });
    const members = Array.from(map.values()).map(e => {
      const avgRating = e.ratingCount ? e.ratingSum / e.ratingCount : 0;
      const score = floor1(e.likes * 0.3 + e.ratingCount * avgRating * 0.7 + e.postCount * 10);
      const savedTier = (window.state?.activeUsers || []).find(u => u.id === e.userId)?.rankTier;
      const currentTier = tiers.find(t => t.code === savedTier) || tierByScore(score);
      return { ...e, avgRating, score, currentTier, preview: settlePreview(currentTier, score, e.postCount) };
    }).sort((a, b) => b.score - a.score || b.likes - a.likes || b.ratingCount - a.ratingCount);
    return { start, end, posts, members };
  }
  function renderRankRules() {
    const container = document.getElementById('dashboard-tab-content');
    if (!container || window.state?.currentTab !== 'rank') return;
    if (container.dataset.srRankVersion === VERSION) return;
    const { start, end, posts, members } = getWeeklyRankData();
    const current = members.find(m => m.userId === window.state?.applicationId) || null;
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
          <div class="glass-panel crystal-border rounded-3xl p-5"><div class="text-xs text-slate-500 font-black tracking-wider mb-3">牌位門檻 / 保級線</div><div class="grid grid-cols-4 gap-2">${tiers.map(t => `<div class="rounded-2xl border border-amber-500/10 bg-slate-950/45 p-3 text-center"><div class="text-sm font-black text-amber-300 font-luxury">${t.code}</div><div class="text-[10px] text-slate-500 mt-1">升 ${t.promote}</div><div class="text-[10px] text-slate-600">保 ${t.keep}</div></div>`).join('')}</div></div>
        </div>
        <div class="glass-panel crystal-border rounded-3xl p-5 md:p-6"><h3 class="text-lg font-black text-white font-luxury tracking-wider">本週位階榜</h3><p class="text-xs text-slate-500 mt-1 mb-4">共 ${posts.length} 篇貼文納入本週結算。</p><div class="space-y-3">${members.length === 0 ? `<div class="text-center py-12 text-slate-500"><i class="fa-solid fa-ranking-star text-3xl text-amber-500/40 mb-3"></i><div class="font-black text-slate-300">本週尚無位階資料</div><div class="text-xs mt-1">發布貼文並累積按讚、評星後會自動進入週榜。</div></div>` : members.map((e, i) => `<div class="rounded-3xl border border-amber-500/10 bg-slate-950/35 p-4 flex items-center gap-3 hover-breath click-press cursor-pointer" onclick="viewUserProfile('${js(e.userId)}')"><div class="w-9 text-center font-black text-amber-300 font-luxury">#${i + 1}</div><img src="${e.avatar || 'Gemini_Generated_Image_e2fxvje2fxvje2fx.jpg?v=2'}" class="w-12 h-12 rounded-2xl object-cover border border-amber-500/20 shrink-0"><div class="min-w-0 flex-1"><div class="flex items-center gap-2 flex-wrap"><span class="font-black text-slate-100 truncate">${esc(e.nickname)}</span><span class="text-[10px] text-slate-500 font-mono">@${esc(e.userId)}</span></div><div class="text-[10px] text-slate-500 mt-1">${e.postCount} 篇 · ${e.likes} 讚 · ${e.ratingCount} 位評星 · 均星 ${e.avgRating.toFixed(1)}</div><div class="text-[10px] ${e.preview.tone} font-black mt-1">${e.preview.label}</div></div><div class="text-right shrink-0"><div class="inline-flex items-center justify-center min-w-[4rem] px-3 py-2 rounded-2xl bg-gradient-to-br ${e.currentTier.tone} text-slate-950 font-black font-luxury">${e.currentTier.code}</div><div class="text-sm font-black text-white mt-1">${e.score.toFixed(1)}</div></div></div>`).join('')}</div></div>
      </div>`;
  }

  function normalizeBrandAndNav() {
    const specTab = document.getElementById('aside-tab-spec-vault');
    if (specTab) {
      specTab.classList.add('sr-nav-stable', 'sr-nav-spec-item');
      const main = specTab.querySelector('span:first-child');
      const pill = Array.from(specTab.querySelectorAll('span')).find(s => s !== main && /黃金|Spec|限定/i.test(textOf(s)));
      if (pill) {
        pill.classList.add('sr-spec-nav-pill');
        pill.textContent = '黃金 Spec\n限定';
      }
    }
    const badgeTab = document.getElementById('aside-tab-badge-progress');
    if (badgeTab) {
      badgeTab.classList.add('sr-nav-stable', 'sr-nav-badge-item');
      const badge = Array.from(badgeTab.querySelectorAll('span')).find(s => /^Badge$/i.test(textOf(s)));
      if (badge) badge.classList.add('sr-badge-nav-pill');
    }
  }
  function improveLoginModal() {
    const btn = document.getElementById('btn-login-submit');
    if (!btn) return;
    btn.classList.add('sr-two-line-button');
    const forgot = document.getElementById('btn-forgot-password');
    if (forgot && !forgot.dataset.srImprovedText) {
      forgot.dataset.srImprovedText = '1';
      forgot.textContent = '忘記密碼？取得 10 分鐘臨時登入憑證';
      forgot.classList.add('sr-two-line-button');
    }
    const modal = document.querySelector('#btn-login-submit')?.closest('.fixed');
    if (modal && !document.getElementById('sr-temp-login-hint')) {
      const box = document.createElement('div');
      box.id = 'sr-temp-login-hint';
      box.className = 'mt-3 rounded-2xl border border-amber-500/15 bg-amber-500/5 px-3 py-2 text-[11px] leading-relaxed text-amber-200/85';
      box.innerHTML = '<i class="fa-solid fa-key mr-1.5 text-amber-400"></i> 若使用臨時登入憑證，登入後系統會要求您立即設定新密碼。';
      (forgot?.parentElement || btn.parentElement)?.appendChild(box);
    }
  }
  function improveFeedAndSearch() {
    document.getElementById('search-results-overlay')?.classList.add('sr-search-drawer');
    document.querySelectorAll('#filter-btn-recommended,#filter-btn-highly-rated,#filter-btn-popular,.sub-rank-btn').forEach(btn => btn.classList.add('sr-two-line-pill'));
  }
  function fixWatermarkText() {
    document.querySelectorAll('.sr-watermark-grid span').forEach(s => { if (s.textContent.includes('SecretRomm')) s.textContent = s.textContent.replaceAll('SecretRomm', 'SecretRoom'); });
  }
  function applyUI() {
    normalizeBrandAndNav();
    improveLoginModal();
    improveFeedAndSearch();
    fixWatermarkText();
    document.documentElement.dataset.srFrontendUi = VERSION;
  }

  const css = document.createElement('style');
  css.id = 'sr-frontend-ui-style';
  css.textContent = `
    #aside-tab-feed,#aside-tab-ranking,#aside-tab-notifications,#aside-tab-spec-vault,#aside-tab-badge-progress{display:flex!important;flex-direction:row!important;align-items:center!important;white-space:normal!important;}
    #aside-tab-feed,#aside-tab-ranking{justify-content:flex-start!important;gap:.75rem!important;}
    #aside-tab-notifications,#aside-tab-spec-vault,#aside-tab-badge-progress{justify-content:space-between!important;gap:.75rem!important;}
    #aside-tab-notifications>span:first-child,#aside-tab-spec-vault>span:first-child,#aside-tab-badge-progress>span:first-child{flex:1 1 auto!important;min-width:0!important;display:flex!important;flex-direction:row!important;align-items:center!important;gap:.75rem!important;text-align:left!important;line-height:1.18!important;white-space:normal!important;}
    .sr-spec-nav-pill{flex:0 0 5.65rem!important;width:5.65rem!important;max-width:5.65rem!important;min-height:2.18rem!important;margin-left:.25rem!important;padding:.32rem .45rem!important;white-space:pre-line!important;line-height:1.08!important;font-size:9px!important;text-align:center!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;overflow:hidden!important;}
    .sr-badge-nav-pill{flex:0 0 auto!important;margin-left:.5rem!important;margin-right:0!important;white-space:nowrap!important;text-align:center!important;}
    .sr-two-line-button,.sr-two-line-pill{white-space:normal!important;line-height:1.18!important;min-height:2.65rem!important;text-align:center!important;overflow-wrap:anywhere!important;}
    .sr-search-drawer{position:sticky!important;top:.5rem!important;max-height:min(58vh,450px)!important;z-index:70!important;}
    @media(max-width:768px){.sr-spec-nav-pill{flex-basis:5.2rem!important;width:5.2rem!important;max-width:5.2rem!important;font-size:8.5px!important}.sr-badge-nav-pill{font-size:9px!important}}
  `;
  document.head.appendChild(css);

  const observer = new MutationObserver(() => { setTimeout(renderRankRules, 0); setTimeout(applyUI, 80); });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  setInterval(renderRankRules, 1200);
  setInterval(applyUI, 1500);
  renderRankRules();
  applyUI();
})();
