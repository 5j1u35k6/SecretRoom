// SecretRoom rank formula v2: likes x 0.3 + total rating stars.
(() => {
  if (window.__SR_RANK_FORMULA_V2__) return;
  window.__SR_RANK_FORMULA_V2__ = true;

  const VERSION = '20260712-rank-formula-v2';
  const tiers = [
    { code: 'N.G', name: 'No Grade', min: 0, tone: 'from-slate-500 via-slate-400 to-slate-600' },
    { code: 'D.G', name: 'Dawn Grade', min: 50, tone: 'from-stone-300 via-amber-200 to-stone-500' },
    { code: 'C.G', name: 'Classic Grade', min: 100, tone: 'from-slate-200 via-slate-300 to-amber-100' },
    { code: 'B.G', name: 'Brass Grade', min: 150, tone: 'from-emerald-200 via-teal-300 to-slate-200' },
    { code: 'A.G', name: 'Apex Grade', min: 250, tone: 'from-blue-200 via-cyan-300 to-amber-200' },
    { code: 'S.G', name: 'Superior Grade', min: 500, tone: 'from-yellow-200 via-amber-400 to-orange-500' },
    { code: 'S+.G', name: 'Superior Plus Grade', min: 750, tone: 'from-amber-200 via-yellow-300 to-amber-500' },
    { code: 'SSR.G', name: 'Secret Super Rare Grade', min: 1350, tone: 'from-violet-300 via-amber-200 to-rose-200' },
    { code: 'Z.G', name: 'Zenith Grade', min: 1350.1, tone: 'from-fuchsia-300 via-amber-200 to-cyan-200' }
  ];
  let queued = false;

  const qs = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const floor1 = value => Math.floor((Number(value) || 0) * 10) / 10;

  function timeValue(value) {
    if (value && typeof value.toDate === 'function') return value.toDate().getTime() || 0;
    if (value && Number.isFinite(Number(value.seconds))) return Number(value.seconds) * 1000;
    if (Number.isFinite(Number(value))) return Number(value);
    const parsed = new Date(value || 0).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function weekWindow(base = new Date()) {
    const date = new Date(base);
    const day = date.getDay();
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() + (day === 0 ? -6 : 1 - day), 0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    end.setMilliseconds(-1);
    return { start, end };
  }

  function postStats(post = {}) {
    const likes = Number(post.likeCount || Object.keys(post.likes || {}).length || 0);
    const ratings = Object.values(post.ratings || {})
      .map(Number)
      .filter(value => Number.isFinite(value) && value > 0);
    const ratingCount = ratings.length;
    const ratingSum = ratings.reduce((sum, value) => sum + value, 0);
    const avgRating = ratingCount ? ratingSum / ratingCount : 0;
    const score = floor1(likes * 0.3 + ratingSum);
    return { likes, ratingCount, ratingSum, avgRating, score };
  }

  function tierFor(score) {
    const value = Number(score) || 0;
    let result = tiers[0];
    for (const tier of tiers) {
      if (value >= tier.min) result = tier;
    }
    return result;
  }

  function rankData() {
    const { start, end } = weekWindow();
    const profiles = new Map((window.state?.activeUsers || []).map(user => [String(user.id || ''), user]));
    const posts = (window.state?.posts || [])
      .filter(post => {
        const created = timeValue(post.createdAt || post.createdAtMs || post.timestamp);
        return created >= start.getTime() && created <= end.getTime();
      })
      .map(post => ({ ...post, rankStats: postStats(post) }));

    const members = new Map();
    posts.forEach(post => {
      const userId = String(post.userId || 'unknown');
      const profile = profiles.get(userId) || {};
      if (!members.has(userId)) {
        members.set(userId, {
          userId,
          nickname: post.authorName || profile.nickname || userId,
          avatar: post.authorAvatar || profile.avatar || '',
          likes: 0,
          ratingCount: 0,
          ratingSum: 0,
          postCount: 0,
          score: 0
        });
      }
      const entry = members.get(userId);
      entry.likes += post.rankStats.likes;
      entry.ratingCount += post.rankStats.ratingCount;
      entry.ratingSum += post.rankStats.ratingSum;
      entry.postCount += 1;
      entry.score += post.rankStats.score;
    });

    const rows = Array.from(members.values()).map(entry => {
      const score = floor1(entry.score);
      return {
        ...entry,
        score,
        avgRating: entry.ratingCount ? entry.ratingSum / entry.ratingCount : 0,
        tier: tierFor(score)
      };
    }).sort((a, b) => b.score - a.score || b.ratingSum - a.ratingSum || b.likes - a.likes);

    return { start, end, posts, members: rows };
  }

  function progressData(score, tier) {
    const index = tiers.findIndex(item => item.code === tier.code);
    const next = tiers[index + 1] || null;
    if (!next) return { percent: 100, text: '已到最高位階' };
    const range = Math.max(0.1, next.min - tier.min);
    const percent = Math.max(0, Math.min(100, ((score - tier.min) / range) * 100));
    return {
      percent,
      text: `距離 ${next.code} 還差 ${Math.max(0, floor1(next.min - score)).toFixed(1)} 分`
    };
  }

  function memberRow(entry, position, pinned = false) {
    return `<button type="button" data-sr-rank-user="${esc(entry.userId)}" class="w-full rounded-3xl border ${pinned ? 'border-amber-500/40 bg-amber-500/5' : 'border-amber-500/10 bg-slate-950/35'} p-4 flex items-center gap-3 text-left hover-breath click-press"><span class="w-9 text-center font-black text-amber-300 font-luxury">#${position + 1}</span><img src="${esc(entry.avatar || 'Gemini_Generated_Image_e2fxvje2fxvje2fx.jpg?v=2')}" class="w-12 h-12 rounded-2xl object-cover border border-amber-500/20 shrink-0"><span class="min-w-0 flex-1"><span class="flex items-center gap-2 flex-wrap"><strong class="text-slate-100 truncate">${esc(entry.nickname)}</strong><span class="text-[10px] text-slate-500 font-mono">@${esc(entry.userId)}</span></span><span class="block text-[10px] text-slate-500 mt-1">${entry.postCount} 篇 · ${entry.likes} 讚 · ${entry.ratingCount} 位評星 · 均星 ${entry.avgRating.toFixed(1)}</span></span><span class="text-right shrink-0"><span class="inline-flex items-center justify-center min-w-[4rem] px-3 py-2 rounded-2xl bg-gradient-to-br ${entry.tier.tone} text-slate-950 font-black font-luxury">${entry.tier.code}</span><strong class="block text-sm text-white mt-1">${entry.score.toFixed(1)}</strong></span></button>`;
  }

  function render() {
    queued = false;
    if (window.state?.currentTab !== 'rank') return;
    const container = qs('dashboard-tab-content');
    if (!container || container.dataset.srRankFormulaVersion === VERSION) return;

    const { start, end, posts, members } = rankData();
    const currentId = String(window.state?.applicationId || '');
    const currentIndex = members.findIndex(member => member.userId === currentId);
    const current = currentIndex >= 0 ? members[currentIndex] : null;
    const score = current?.score || 0;
    const tier = tierFor(score);
    const progress = progressData(score, tier);
    const topTen = members.slice(0, 10);
    const pinned = currentIndex >= 10 ? current : null;
    const period = `${start.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })}－${end.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })}`;

    container.dataset.srRankFormulaVersion = VERSION;
    container.innerHTML = `<div class="space-y-5"><section class="glass-panel crystal-border rounded-3xl p-5 md:p-7 relative overflow-hidden"><div class="absolute -top-16 -right-16 w-40 h-40 bg-amber-500/10 blur-3xl rounded-full"></div><div class="relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-5"><div><div class="text-[10px] text-amber-400/75 font-black tracking-[0.24em] font-luxury">Weekly Grade System</div><h2 class="text-2xl md:text-3xl font-black text-white font-luxury tracking-wider mt-1">位階</h2><p class="text-xs text-slate-400 mt-2 leading-relaxed max-w-2xl">每週一 00:00 至週日 23:59 結算。分數＝按讚數 × 0.3＋評星總星數；評星越高，分數一定越高，最後無條件捨去至小數點後一位。</p></div><div class="text-right"><div class="text-[10px] text-slate-500 font-black tracking-wider">本週週期</div><div class="text-lg text-amber-300 font-black font-luxury">${period}</div></div></div></section><section class="grid grid-cols-1 md:grid-cols-[1fr_1.25fr] gap-4"><div class="glass-panel crystal-border rounded-3xl p-5"><div class="text-xs text-slate-500 font-black tracking-wider mb-2">你的本週位階</div><div class="flex items-center gap-4"><div class="w-20 h-20 rounded-3xl bg-gradient-to-br ${tier.tone} text-slate-950 flex items-center justify-center shadow-xl font-black font-luxury text-xl">${tier.code}</div><div><div class="text-3xl font-black text-white font-luxury">${score.toFixed(1)}</div><div class="text-xs text-slate-400 mt-1">${current ? `第 ${currentIndex + 1} 名 · ${current.postCount} 篇貼文納入計算` : '本週尚無可計分貼文'}</div><div class="text-[10px] text-amber-300/80 mt-2 font-black">${tier.name}</div></div></div><div class="mt-4"><div class="flex items-center justify-between gap-3 text-xs"><span class="text-slate-300">${progress.text}</span><span class="text-amber-300 font-black">${Math.round(progress.percent)}%</span></div><div class="sr-core-rank-progress mt-2"><span style="width:${progress.percent}%"></span></div></div></div><div class="glass-panel crystal-border rounded-3xl p-5"><div class="flex items-center justify-between gap-3 mb-3"><div><div class="text-xs text-slate-500 font-black tracking-wider">位階門檻</div><div class="text-[10px] text-slate-600 mt-1">分數門檻維持原設定。</div></div><button id="sr-rank-v2-threshold-toggle" type="button" class="sr-core-rank-button">查看全部門檻</button></div><div id="sr-rank-v2-thresholds" class="grid grid-cols-3 gap-2">${tiers.slice(1).map((item, index) => `<div data-threshold-index="${index}" class="rounded-2xl border border-amber-500/10 bg-slate-950/45 p-3 text-center"><div class="text-sm font-black text-amber-300 font-luxury">${item.code}</div><div class="text-[10px] text-slate-500 mt-1">${item.code === 'Z.G' ? '&gt; 1350' : item.min}</div></div>`).join('')}</div></div></section><section class="glass-panel crystal-border rounded-3xl p-5 md:p-6"><div class="flex items-center justify-between gap-3 mb-4"><div><h3 class="text-lg font-black text-white font-luxury tracking-wider">本週位階榜</h3><p class="text-xs text-slate-500 mt-1">共 ${posts.length} 篇貼文納入本週結算。</p></div></div><div class="space-y-3">${topTen.length ? topTen.map((entry, index) => memberRow(entry, index)).join('') : '<div class="text-center py-12 text-slate-500"><i class="fa-solid fa-ranking-star text-3xl text-amber-500/40 mb-3"></i><div class="font-black text-slate-300">本週尚無位階資料</div><div class="text-xs mt-1">發布貼文並累積按讚、評星後會自動進入週榜。</div></div>'}${pinned ? `<div class="pt-3 border-t border-amber-500/10"><div class="text-xs text-amber-300 font-black mb-2">你的名次</div>${memberRow(pinned, currentIndex, true)}</div>` : ''}</div></section></div>`;

    const tierIndex = Math.max(0, tiers.findIndex(item => item.code === tier.code) - 1);
    const visible = new Set([Math.max(0, tierIndex - 1), tierIndex, Math.min(tiers.length - 2, tierIndex + 1)]);
    if (tier.code === 'N.G') { visible.clear(); visible.add(0); visible.add(1); visible.add(2); }
    const thresholdItems = Array.from(container.querySelectorAll('[data-threshold-index]'));
    thresholdItems.forEach((item, index) => item.classList.toggle('hidden', !visible.has(index)));

    qs('sr-rank-v2-threshold-toggle')?.addEventListener('click', event => {
      const opening = thresholdItems.some(item => item.classList.contains('hidden'));
      thresholdItems.forEach((item, index) => item.classList.toggle('hidden', !opening && !visible.has(index)));
      const grid = qs('sr-rank-v2-thresholds');
      grid?.classList.toggle('grid-cols-3', !opening);
      grid?.classList.toggle('sm:grid-cols-4', opening);
      event.currentTarget.textContent = opening ? '只看相關門檻' : '查看全部門檻';
    });

    container.querySelectorAll('[data-sr-rank-user]').forEach(button => {
      button.addEventListener('click', () => window.viewUserProfile?.(button.dataset.srRankUser));
    });
  }

  window.SRRankFormulaV2 = Object.freeze({ postStats, tierFor, rankData });

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(render);
  }

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', schedule, { once: true });
  schedule();
})();
