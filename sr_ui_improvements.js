(() => {
  const VERSION = '20260708-ui-improve-v1';
  const brandTerms = ['SecretRoom', 'S+ . S . G', 'S+.S.G', 'Gold Spec', 'Golden Spec', '黃金 Spec', '黃金Spec', 'Badge'];

  function textOf(el) {
    return String(el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function markNoTranslate(el) {
    if (!el) return;
    el.classList.add('notranslate');
    el.setAttribute('translate', 'no');
  }

  function normalizeBrandAndNav() {
    document.querySelectorAll('h1,h2,h3,h4,button,span,a,div').forEach(el => {
      const t = textOf(el);
      if (!t || t.length > 90) return;
      const hasBrand = brandTerms.some(term => t.includes(term));
      if (hasBrand) markNoTranslate(el);
    });

    const specTab = document.getElementById('aside-tab-spec-vault');
    if (specTab) {
      markNoTranslate(specTab);
      specTab.classList.add('sr-nav-item-stable', 'sr-nav-spec-item');
      const pill = Array.from(specTab.querySelectorAll('span')).find(s => /黃金|黄金|Spec|spec|Golden|Limigita|Specifo|限定/i.test(textOf(s)) && s !== specTab.querySelector('span'));
      if (pill) {
        pill.classList.add('sr-spec-two-line-pill', 'notranslate');
        pill.setAttribute('translate', 'no');
        if (/黃金/.test(textOf(pill))) pill.textContent = '黃金 Spec 限定';
      }
    }

    const badgeTab = document.getElementById('aside-tab-badge-progress');
    if (badgeTab) {
      badgeTab.classList.add('sr-nav-item-stable');
      const badge = Array.from(badgeTab.querySelectorAll('span')).find(s => /^Badge$/i.test(textOf(s)) || /Insigno/i.test(textOf(s)));
      if (badge) {
        markNoTranslate(badge);
        badge.textContent = 'Badge';
        badge.classList.add('sr-badge-left-pill');
      }
    }

    ['aside-tab-feed','aside-tab-ranking','aside-tab-notifications'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('sr-nav-item-stable');
    });
  }

  function improveLoginModal() {
    const modal = document.getElementById('sr-login-modal') || document.querySelector('#btn-login-submit')?.closest('.fixed');
    const btn = document.getElementById('btn-login-submit');
    if (!btn) return;
    btn.classList.add('sr-two-line-button');

    const forgot = document.getElementById('btn-forgot-password');
    if (forgot && !forgot.dataset.srImprovedText) {
      forgot.dataset.srImprovedText = '1';
      forgot.textContent = '忘記密碼？取得 10 分鐘臨時登入憑證';
      forgot.classList.add('sr-two-line-button');
    }

    if (modal && !document.getElementById('sr-temp-login-hint')) {
      const box = document.createElement('div');
      box.id = 'sr-temp-login-hint';
      box.className = 'mt-3 rounded-2xl border border-amber-500/15 bg-amber-500/5 px-3 py-2 text-[11px] leading-relaxed text-amber-200/85';
      box.innerHTML = '<i class="fa-solid fa-key mr-1.5 text-amber-400"></i> 若使用臨時登入憑證，登入後系統會要求您立即設定新密碼。';
      const forgotParent = forgot?.parentElement || btn.parentElement;
      if (forgotParent && !forgotParent.querySelector('#sr-temp-login-hint')) forgotParent.appendChild(box);
    }

    const errorBox = document.getElementById('login-error-box');
    if (errorBox) errorBox.classList.add('sr-persistent-error-box');
  }

  function improveFeedAndSearch() {
    const searchOverlay = document.getElementById('search-results-overlay');
    if (searchOverlay) searchOverlay.classList.add('sr-search-drawer');
    document.querySelectorAll('#filter-btn-recommended,#filter-btn-highly-rated,#filter-btn-popular,.sub-rank-btn').forEach(btn => {
      btn.classList.add('sr-two-line-pill');
    });
    const rankingTabs = document.getElementById('ranking-sub-tabs');
    if (rankingTabs) rankingTabs.classList.add('sr-collapsible-tag-row');
  }

  function improveRankCopy() {
    document.querySelectorAll('*').forEach(el => {
      const t = textOf(el);
      if (t.startsWith('預估降至')) el.textContent = t.replace('預估降至', '保級挑戰：目前可能調整至');
      if (t.includes('預估降階')) el.textContent = t.replace('預估降階', '保級挑戰中');
    });
  }

  function fixWatermarkText() {
    document.querySelectorAll('.sr-watermark-grid span').forEach(s => {
      if (s.textContent.includes('SecretRomm')) s.textContent = s.textContent.replaceAll('SecretRomm', 'SecretRoom');
    });
  }

  function markSpecCards() {
    document.querySelectorAll('.spec-vault-card, #dashboard-tab-content').forEach(el => {
      if (textOf(el).includes('S+ . S . G')) el.classList.add('sr-spec-content-safe');
    });
  }

  function apply() {
    normalizeBrandAndNav();
    improveLoginModal();
    improveFeedAndSearch();
    improveRankCopy();
    fixWatermarkText();
    markSpecCards();
    document.documentElement.dataset.srUiImprove = VERSION;
  }

  const css = document.createElement('style');
  css.id = 'sr-ui-improvements-style';
  css.textContent = `
    #aside-tab-feed, #aside-tab-ranking, #aside-tab-notifications, #aside-tab-spec-vault, #aside-tab-badge-progress {
      min-height: 4.1rem !important;
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) auto !important;
      align-items: center !important;
      gap: 0.65rem !important;
    }
    #aside-tab-feed, #aside-tab-ranking { grid-template-columns: minmax(0, 1fr) !important; }
    #aside-tab-feed > i, #aside-tab-ranking > i { margin-right: 0.75rem; }
    #aside-tab-notifications > span:first-child, #aside-tab-spec-vault > span:first-child, #aside-tab-badge-progress > span:first-child {
      min-width: 0 !important;
      display: grid !important;
      grid-template-columns: 1.35rem minmax(0,1fr) !important;
      align-items: center !important;
      gap: 0.75rem !important;
      text-align: left !important;
      line-height: 1.16 !important;
      white-space: normal !important;
    }
    .sr-spec-two-line-pill, .sr-badge-left-pill {
      justify-self: start !important;
      align-self: center !important;
      margin-left: 0 !important;
      margin-right: auto !important;
      text-align: center !important;
    }
    .sr-spec-two-line-pill {
      width: 9.4rem !important;
      max-width: 9.4rem !important;
      min-height: 3rem !important;
      white-space: normal !important;
      line-height: 1.08 !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      overflow-wrap: anywhere !important;
      padding: 0.62rem 0.85rem !important;
    }
    .sr-badge-left-pill {
      min-width: 4rem !important;
      white-space: normal !important;
    }
    .sr-two-line-button, .sr-two-line-pill {
      white-space: normal !important;
      line-height: 1.18 !important;
      min-height: 2.65rem !important;
      text-align: center !important;
      overflow-wrap: anywhere !important;
    }
    .sr-search-drawer {
      position: sticky !important;
      top: 0.5rem !important;
      max-height: min(58vh, 450px) !important;
      z-index: 70 !important;
    }
    .sr-collapsible-tag-row { max-height: 4.25rem; }
    .sr-persistent-error-box { display: block; min-height: 0; }
    @media (max-width: 768px) {
      #aside-tab-feed, #aside-tab-ranking, #aside-tab-notifications, #aside-tab-spec-vault, #aside-tab-badge-progress { min-height: 3.65rem !important; }
      .sr-spec-two-line-pill { width: 8.7rem !important; max-width: 8.7rem !important; font-size: 10px !important; }
      #sr-language-selector-wrap { transform: scale(.92); transform-origin: right bottom; }
    }
  `;
  document.head.appendChild(css);

  apply();
  new MutationObserver(() => setTimeout(apply, 80)).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  setInterval(apply, 1500);
})();
