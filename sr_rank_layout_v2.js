// SecretRoom rank page layout v2.
(() => {
  if (window.__SR_RANK_LAYOUT_V2__) return;
  window.__SR_RANK_LAYOUT_V2__ = true;

  const VERSION = '20260712-rank-layout-v2';
  let queued = false;
  const q = id => document.getElementById(id);

  function render() {
    const root = document.querySelector('#dashboard-tab-content [data-rank-v3]');
    const policy = window.SRRankPolicy;
    if (!root || !policy || window.state?.currentTab !== 'rank') return;
    if (root.dataset.rankLayoutVersion === VERSION) return;

    const currentData = policy.data();
    const accountId = String(window.state?.applicationId || localStorage.getItem('sr_username') || '');
    const member = currentData.members.find(item => String(item.id) === accountId) || null;
    const tiers = policy.tiers || [];
    const currentTier = member?.tier || tiers[0];
    const currentIndex = Math.max(0, tiers.indexOf(currentTier));
    const nextTier = tiers[currentIndex + 1] || null;
    const score = Number(member?.score || 0);
    const progress = nextTier
      ? Math.max(0, Math.min(100, ((score - Number(currentTier[2] || 0)) / Math.max(1, Number(nextTier[2] || 0) - Number(currentTier[2] || 0))) * 100))
      : 100;
    const period = `${currentData.s.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })}－${currentData.e.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })}`;
    const distance = nextTier
      ? `距離 ${nextTier[0]} 還差 ${Math.max(0, Math.floor((Number(nextTier[2]) - score) * 10) / 10).toFixed(1)} 分`
      : '已到最高位階';

    const sections = Array.from(root.children).filter(node => node.tagName === 'SECTION');
    const overview = sections[0];
    const thresholds = sections[1];

    if (overview) {
      overview.className = 'glass-panel crystal-border rounded-3xl overflow-hidden';
      overview.innerHTML = `
        <div class="p-5 md:p-6">
          <div class="text-xs text-amber-400 font-black">本週位階</div>
          <div class="mt-2 flex items-end justify-between gap-4">
            <div>
              <h2 class="text-3xl font-black text-white">${currentTier?.[0] || 'N.G'}</h2>
              <p class="text-xs text-slate-400 mt-2">${period} · 每週一重新計算</p>
            </div>
            <div class="text-right text-xs text-slate-500">位階依本週貼文互動計算</div>
          </div>
        </div>
        <div class="border-t border-amber-500/10 p-5 md:p-6 bg-slate-950/20">
          <div class="flex items-end justify-between gap-4">
            <div>
              <div class="text-xs text-slate-500">目前分數</div>
              <div class="text-3xl font-black text-white mt-1">${score.toFixed(1)}</div>
            </div>
            <div class="text-right text-sm text-slate-200">${distance}</div>
          </div>
          <div class="mt-4 flex justify-end text-xs text-amber-300 font-black">${Math.round(progress)}%</div>
          <div class="sr-rank-progress mt-2"><span style="width:${progress}%"></span></div>
        </div>
      `;
    }

    if (thresholds) {
      const visible = new Set([currentIndex, currentIndex + 1, currentIndex + 2].filter(index => index < tiers.length));
      thresholds.innerHTML = `
        <div class="flex items-center justify-between gap-3 mb-3">
          <h3 class="font-black text-white">位階門檻</h3>
          <button id="rank-layout-toggle" class="sr-secondary-button">查看全部</button>
        </div>
        <div id="rank-layout-tiers" class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          ${tiers.map((tier, index) => `
            <div data-rank-layout-tier="${index}" class="sr-rank-tier-card ${visible.has(index) ? '' : 'hidden'}">
              <b>${tier[0]}</b>
              <div class="text-xs mt-1">${Number(tier[2]).toLocaleString()} 分</div>
            </div>
          `).join('')}
        </div>
      `;
      q('rank-layout-toggle').onclick = event => {
        const cards = Array.from(q('rank-layout-tiers')?.children || []);
        const opening = cards.some(card => card.classList.contains('hidden'));
        cards.forEach((card, index) => card.classList.toggle('hidden', !opening && !visible.has(index)));
        q('rank-layout-tiers').className = opening
          ? 'grid grid-cols-2 md:grid-cols-3 gap-2'
          : 'grid grid-cols-1 sm:grid-cols-3 gap-2';
        event.currentTarget.textContent = opening ? '只看目前附近' : '查看全部';
      };
    }

    Array.from(root.children).forEach(section => {
      if (section.tagName === 'SECTION' && String(section.textContent || '').includes('防灌水：')) section.remove();
    });

    root.dataset.rankLayoutVersion = VERSION;
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      render();
    });
  }

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  schedule();
})();
