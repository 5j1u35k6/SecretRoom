// SecretRoom DOM stability and phase-one runtime alignment.
(() => {
  if (window.__SR_DOM_STABILITY__) return;
  window.__SR_DOM_STABILITY__ = true;

  const FRONTEND_RANK_VERSION = '20260711-phase1-frontend-v1';
  const thresholds = [
    { code: 'N.G', min: 0 },
    { code: 'D.G', min: 50 },
    { code: 'C.G', min: 100 },
    { code: 'B.G', min: 150 },
    { code: 'A.G', min: 250 },
    { code: 'S.G', min: 500 },
    { code: 'S+.G', min: 750 },
    { code: 'SSR.G', min: 1350 },
    { code: 'Z.G', min: 1350.000001 }
  ];

  function guardSetter(prototype, property) {
    if (!prototype) return;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
    if (!descriptor?.get || !descriptor?.set || descriptor.set.__srGuarded) return;
    const guardedSetter = function(value) {
      const next = value == null ? '' : String(value);
      let current = '';
      try { current = descriptor.get.call(this); } catch (_) {}
      if (current === next) return;
      return descriptor.set.call(this, value);
    };
    guardedSetter.__srGuarded = true;
    Object.defineProperty(prototype, property, {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set: guardedSetter
    });
  }

  guardSetter(window.Node?.prototype, 'textContent');
  guardSetter(window.Element?.prototype, 'innerHTML');

  function tierIndex(code) {
    const index = thresholds.findIndex(item => item.code === code);
    return index < 0 ? 0 : index;
  }

  function installRankStyles() {
    if (document.getElementById('sr-core-rank-style')) return;
    const style = document.createElement('style');
    style.id = 'sr-core-rank-style';
    style.textContent = `
      .sr-core-rank-progress{height:.58rem;border-radius:999px;overflow:hidden;background:rgba(15,23,42,.9);border:1px solid rgba(245,158,11,.12)}
      .sr-core-rank-progress>span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#b7791f,#fcd34d);transition:width .25s ease}
      .sr-core-rank-actions{display:flex;align-items:center;justify-content:flex-end;margin-top:.75rem}
      .sr-core-rank-button{min-height:44px;padding:.55rem .85rem;border-radius:.85rem;border:1px solid rgba(245,158,11,.18);background:rgba(15,23,42,.62);color:#fcd34d;font-size:12px;font-weight:900}
      .sr-core-current-row{border-color:rgba(245,158,11,.4)!important;background:rgba(245,158,11,.07)!important}
      .sr-core-current-label{font-size:12px;font-weight:900;color:#fcd34d;padding-top:.5rem;border-top:1px solid rgba(245,158,11,.12)}
    `;
    document.head.appendChild(style);
  }

  function simplifyCoreRank(container) {
    if (!container || window.state?.currentTab !== 'rank') return;
    container.dataset.srRankVersion = FRONTEND_RANK_VERSION;
    if (container.dataset.srCoreRankSimplified === '1') return;
    if (!container.textContent.includes('Weekly Grade System')) return;

    const root = container.firstElementChild;
    const sections = root ? Array.from(root.children) : [];
    const header = sections[0];
    const overview = sections[1];
    const leaderboard = sections[2];
    if (!header || !overview || !leaderboard) return;

    container.dataset.srCoreRankSimplified = '1';
    installRankStyles();

    const description = header.querySelector('p');
    if (description) description.textContent = '每週一開始、週日結算；分數依本週貼文的按讚與評星計算。';

    const overviewCards = Array.from(overview.children);
    const scoreCard = overviewCards[0];
    const thresholdCard = overviewCards[1];
    const tierCode = scoreCard?.querySelector('.w-20.h-20')?.textContent?.trim() || 'N.G';
    const score = Number.parseFloat(scoreCard?.querySelector('.text-3xl')?.textContent || '0') || 0;
    const currentIndex = tierIndex(tierCode);
    const nextTier = thresholds[currentIndex + 1] || null;
    const currentMin = thresholds[currentIndex]?.min || 0;
    let progress = 100;
    let progressText = '已到最高位階';
    if (nextTier) {
      if (tierCode === 'SSR.G') {
        progress = 99;
        progressText = '分數再增加即可升到 Z.G';
      } else {
        const range = Math.max(.1, nextTier.min - currentMin);
        progress = Math.max(0, Math.min(100, ((score - currentMin) / range) * 100));
        progressText = `距離 ${nextTier.code} 還差 ${Math.max(0, nextTier.min - score).toFixed(1)} 分`;
      }
    }
    if (scoreCard && !document.getElementById('sr-core-rank-progress')) {
      const progressBox = document.createElement('div');
      progressBox.id = 'sr-core-rank-progress';
      progressBox.className = 'mt-4';
      progressBox.innerHTML = `<div class="flex items-center justify-between gap-3 text-xs"><span class="text-slate-300">${progressText}</span><span class="text-amber-300 font-black">${Math.round(progress)}%</span></div><div class="sr-core-rank-progress mt-2"><span style="width:${progress}%"></span></div>`;
      scoreCard.appendChild(progressBox);
    }

    const thresholdGrid = thresholdCard?.querySelector('.grid.grid-cols-4');
    const thresholdItems = thresholdGrid ? Array.from(thresholdGrid.children) : [];
    if (thresholdItems.length && !document.getElementById('sr-rank-threshold-toggle')) {
      const coreCodes = thresholds.slice(1).map(item => item.code);
      const coreIndex = Math.max(0, coreCodes.indexOf(tierCode));
      const keepIndexes = new Set([Math.max(0, coreIndex - 1), coreIndex, Math.min(coreCodes.length - 1, coreIndex + 1)]);
      if (tierCode === 'N.G') keepIndexes.clear(), keepIndexes.add(0), keepIndexes.add(1);
      thresholdItems.forEach((item, index) => item.classList.toggle('hidden', !keepIndexes.has(index)));
      thresholdGrid.classList.remove('grid-cols-4');
      thresholdGrid.classList.add('grid-cols-3');
      const actions = document.createElement('div');
      actions.className = 'sr-core-rank-actions';
      actions.innerHTML = '<button id="sr-rank-threshold-toggle" type="button" class="sr-core-rank-button">查看全部門檻</button>';
      thresholdCard.appendChild(actions);
      document.getElementById('sr-rank-threshold-toggle').onclick = event => {
        const opening = thresholdItems.some(item => item.classList.contains('hidden'));
        thresholdItems.forEach(item => item.classList.toggle('hidden', !opening && !keepIndexes.has(thresholdItems.indexOf(item))));
        thresholdGrid.classList.toggle('grid-cols-3', !opening);
        thresholdGrid.classList.toggle('grid-cols-4', opening);
        event.currentTarget.textContent = opening ? '只看相關門檻' : '查看全部門檻';
      };
    }

    const list = leaderboard.querySelector('.space-y-3');
    const rows = list ? Array.from(list.children).filter(item => item.matches('div[onclick*="viewUserProfile"]')) : [];
    if (rows.length > 10 && !document.getElementById('sr-rank-list-toggle')) {
      const accountId = String(window.state?.applicationId || '');
      const currentRow = rows.find(row => row.textContent.includes(`@${accountId}`));
      rows.forEach((row, index) => row.classList.toggle('hidden', index >= 10 && row !== currentRow));
      if (currentRow && rows.indexOf(currentRow) >= 10) {
        currentRow.classList.add('sr-core-current-row');
        const label = document.createElement('div');
        label.id = 'sr-core-current-label';
        label.className = 'sr-core-current-label';
        label.textContent = '你的名次';
        list.insertBefore(label, currentRow);
      }
      const actions = document.createElement('div');
      actions.className = 'sr-core-rank-actions';
      actions.innerHTML = '<button id="sr-rank-list-toggle" type="button" class="sr-core-rank-button">顯示完整排行榜</button>';
      leaderboard.appendChild(actions);
      document.getElementById('sr-rank-list-toggle').onclick = event => {
        const opening = rows.some((row, index) => index >= 10 && row.classList.contains('hidden'));
        rows.forEach((row, index) => row.classList.toggle('hidden', !opening && index >= 10 && row !== currentRow));
        const label = document.getElementById('sr-core-current-label');
        if (label) label.classList.toggle('hidden', opening);
        event.currentTarget.textContent = opening ? '只看前 10 名' : '顯示完整排行榜';
      };
    }
  }

  document.addEventListener('click', event => {
    const loadMore = event.target?.closest?.('#sr-feed-load-more');
    if (!loadMore) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (!window.state) return;
    window.state.visiblePostsCount = Number(window.state.visiblePostsCount || 5) + 5;
    window.setGlobalFilter?.(window.state.currentFilter || 'recommended');
  }, true);

  let scheduled = false;
  function apply() {
    scheduled = false;
    simplifyCoreRank(document.getElementById('dashboard-tab-content'));
  }
  function schedule() {
    const container = document.getElementById('dashboard-tab-content');
    if (container && window.state?.currentTab === 'rank') container.dataset.srRankVersion = FRONTEND_RANK_VERSION;
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  }

  new MutationObserver(schedule).observe(document.documentElement, { childList:true, subtree:true });
  document.addEventListener('DOMContentLoaded', apply, { once:true });
})();