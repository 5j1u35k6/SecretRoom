// SecretRoom UI regression fixes: scrolling, eligibility and sidebar alignment.
(() => {
  if (window.__SR_UI_REGRESSION_FIXES__) return;
  window.__SR_UI_REGRESSION_FIXES__ = true;

  const VERSION = '20260712-ui-regression-v2';
  let queued = false;
  const qs = id => document.getElementById(id);
  const toast = (message, type = 'info') => window.showToast?.(message, type);

  function numberValue(value) {
    const parsed = Number.parseFloat(String(value ?? '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function specState(user = window.state?.userData || {}) {
    const status = String(user.specEliteStatus || '').toLowerCase();
    const approved = user.isSpecElite === true || ['approved', 'active', 'passed'].includes(status);
    const pending = status === 'pending';
    const eligible = numberValue(user.length) >= 16 && numberValue(user.girth) >= 5;
    return { approved, pending, eligible, canApply: eligible && !approved && !pending };
  }

  window.SRGoldSpecEligibility = user => specState(user);

  function scrollTargets() {
    const candidates = [
      qs('main-content-scroll'),
      document.scrollingElement,
      document.documentElement,
      document.body,
      ...document.querySelectorAll('.sr-dashboard-main .overflow-y-auto, .sr-mobile-menu-sheet')
    ];
    return [...new Set(candidates.filter(Boolean))];
  }

  function currentScrollTop() {
    return scrollTargets().reduce((max, node) => Math.max(max, Number(node.scrollTop || 0)), Number(window.scrollY || 0));
  }

  function syncBackToTop() {
    const button = qs('sr-back-to-top');
    if (!button) return;
    button.classList.toggle('sr-back-to-top-visible', currentScrollTop() > 500);
  }

  function scrollToTop() {
    const behavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    scrollTargets().forEach(node => {
      try { node.scrollTo({ top: 0, left: 0, behavior }); }
      catch (_) { node.scrollTop = 0; }
    });
    try { window.scrollTo({ top: 0, left: 0, behavior }); }
    catch (_) { window.scrollTo(0, 0); }
    requestAnimationFrame(() => {
      scrollTargets().forEach(node => { node.scrollTop = 0; });
      window.scrollTo(0, 0);
      syncBackToTop();
    });
  }

  function repairSpecActions() {
    const state = specState();
    const stepCard = qs('sr-phase3-badge-steps');
    const specButton = stepCard?.querySelector('[data-sr-next="spec"]');
    if (specButton && !state.canApply) specButton.remove();
    if (stepCard) {
      const remaining = stepCard.querySelectorAll('[data-sr-next]').length;
      const heading = stepCard.querySelector('h3');
      if (heading && remaining === 0) heading.textContent = '目前主要項目都完成了';
    }

    if (!state.eligible && !state.approved && !state.pending && window.state?.currentTab === 'badge-progress') {
      document.querySelectorAll('#dashboard-tab-content article').forEach(article => {
        if (!String(article.textContent || '').includes('黃金 Spec 實證認證')) return;
        article.querySelectorAll('div,span,p').forEach(node => {
          if (String(node.textContent || '').trim() === '可於個人主頁申請') {
            node.textContent = '目前身體數據未達申請門檻';
          }
        });
      });
    }
  }

  function repairCompletionCard() {
    const card = qs('sr-profile-completion');
    if (card && /(^|\D)100%(\D|$)/.test(String(card.textContent || ''))) card.remove();
  }

  function alignSidebar() {
    const spec = qs('aside-tab-spec-vault');
    const badge = qs('aside-tab-badge-progress');
    [spec, badge].forEach(tab => {
      if (!tab) return;
      tab.classList.add('sr-sidebar-row-fixed');
      const spans = Array.from(tab.children).filter(node => node.tagName === 'SPAN');
      spans[0]?.classList.add('sr-sidebar-label-fixed');
      spans.at(-1)?.classList.add('sr-sidebar-pill-fixed');
    });
  }

  function installStyles() {
    if (qs('sr-ui-regression-style')) return;
    const style = document.createElement('style');
    style.id = 'sr-ui-regression-style';
    style.textContent = `
      #aside-tab-spec-vault,#aside-tab-badge-progress{
        display:grid!important;
        grid-template-columns:minmax(0,1fr) auto!important;
        align-items:center!important;
        column-gap:.5rem!important;
        padding-left:.75rem!important;
        padding-right:.75rem!important;
      }
      #aside-tab-spec-vault>.sr-sidebar-label-fixed,#aside-tab-badge-progress>.sr-sidebar-label-fixed{
        display:flex!important;
        align-items:center!important;
        gap:.625rem!important;
        min-width:0!important;
        margin:0!important;
        white-space:nowrap!important;
        line-height:1.15!important;
        order:initial!important;
      }
      #aside-tab-spec-vault>.sr-sidebar-label-fixed{font-size:.82rem!important;letter-spacing:-.01em!important}
      #aside-tab-spec-vault>.sr-sidebar-label-fixed i,#aside-tab-badge-progress>.sr-sidebar-label-fixed i{
        width:1.2rem!important;
        min-width:1.2rem!important;
        text-align:center!important;
      }
      #aside-tab-spec-vault>.sr-sidebar-pill-fixed{
        width:auto!important;
        max-width:none!important;
        min-height:2rem!important;
        flex:none!important;
        margin:0!important;
        padding:.38rem .62rem!important;
        white-space:nowrap!important;
        line-height:1!important;
        font-size:8.5px!important;
        order:initial!important;
      }
      #aside-tab-badge-progress>.sr-sidebar-pill-fixed{
        width:auto!important;
        flex:none!important;
        margin:0!important;
        white-space:nowrap!important;
        line-height:1!important;
        order:initial!important;
      }
    `;
    document.head.appendChild(style);
  }

  function apply() {
    queued = false;
    installStyles();
    repairCompletionCard();
    repairSpecActions();
    alignSidebar();
    syncBackToTop();
    document.documentElement.dataset.srUiRegressionFixes = VERSION;
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  document.addEventListener('click', event => {
    const topButton = event.target?.closest?.('#sr-back-to-top');
    if (topButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      scrollToTop();
      return;
    }

    const specButton = event.target?.closest?.('[data-sr-next="spec"],button[onclick*="showSpecApplyModal"]');
    if (specButton && !specState().canApply) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      toast('目前身體數據未達黃金 Spec 申請門檻。', 'info');
    }
  }, true);

  document.addEventListener('scroll', syncBackToTop, true);
  window.addEventListener('scroll', syncBackToTop, { passive: true });
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  apply();
})();

import('./sr_rank_formula_v2.js?v=20260712-v2').catch(error => console.error('位階公式模組載入失敗', error));
