(() => {
  const VERSION = '20260708-ui-improve-v2';
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
      if (brandTerms.some(term => t.includes(term))) markNoTranslate(el);
    });

    const specTab = document.getElementById('aside-tab-spec-vault');
    if (specTab) {
      markNoTranslate(specTab);
      specTab.classList.add('sr-nav-stable', 'sr-nav-spec-item');
      const main = specTab.querySelector('span:first-child');
      if (main) markNoTranslate(main);
      const pill = Array.from(specTab.querySelectorAll('span')).find(s => s !== main && /黃金|黄金|Spec|spec|Golden|Limigita|Specifo|限定/i.test(textOf(s)));
      if (pill) {
        markNoTranslate(pill);
        pill.classList.remove('sr-spec-two-line-pill');
        pill.classList.add('sr-spec-nav-pill');
        pill.textContent = '黃金 Spec\n限定';
      }
    }

    const badgeTab = document.getElementById('aside-tab-badge-progress');
    if (badgeTab) {
      badgeTab.classList.add('sr-nav-stable', 'sr-nav-badge-item');
      const main = badgeTab.querySelector('span:first-child');
      if (main) main.classList.add('sr-nav-main-label');
      const badge = Array.from(badgeTab.querySelectorAll('span')).find(s => /^Badge$/i.test(textOf(s)) || /Insigno/i.test(textOf(s)));
      if (badge) {
        markNoTranslate(badge);
        badge.textContent = 'Badge';
        badge.classList.remove('sr-badge-left-pill');
        badge.classList.add('sr-badge-nav-pill');
      }
    }

    ['aside-tab-feed','aside-tab-ranking','aside-tab-notifications'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('sr-nav-stable');
    });
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
      const forgotParent = forgot?.parentElement || btn.parentElement;
      if (forgotParent && !forgotParent.querySelector('#sr-temp-login-hint')) forgotParent.appendChild(box);
    }

    document.getElementById('login-error-box')?.classList.add('sr-persistent-error-box');
  }

  function improveFeedAndSearch() {
    document.getElementById('search-results-overlay')?.classList.add('sr-search-drawer');
    document.querySelectorAll('#filter-btn-recommended,#filter-btn-highly-rated,#filter-btn-popular,.sub-rank-btn').forEach(btn => btn.classList.add('sr-two-line-pill'));
    document.getElementById('ranking-sub-tabs')?.classList.add('sr-collapsible-tag-row');
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

  function apply() {
    normalizeBrandAndNav();
    improveLoginModal();
    improveFeedAndSearch();
    improveRankCopy();
    fixWatermarkText();
    document.documentElement.dataset.srUiImprove = VERSION;
  }

  const css = document.createElement('style');
  css.id = 'sr-ui-improvements-style';
  css.textContent = `
    #aside-tab-feed, #aside-tab-ranking, #aside-tab-notifications, #aside-tab-spec-vault, #aside-tab-badge-progress {
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      min-height: unset !important;
      white-space: normal !important;
    }
    #aside-tab-feed, #aside-tab-ranking {
      justify-content: flex-start !important;
      gap: .75rem !important;
    }
    #aside-tab-notifications, #aside-tab-spec-vault, #aside-tab-badge-progress {
      justify-content: space-between !important;
      gap: .75rem !important;
    }
    #aside-tab-notifications > span:first-child,
    #aside-tab-spec-vault > span:first-child,
    #aside-tab-badge-progress > span:first-child {
      flex: 1 1 auto !important;
      min-width: 0 !important;
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      gap: .75rem !important;
      text-align: left !important;
      line-height: 1.18 !important;
      white-space: normal !important;
    }
    #aside-tab-notifications > span:first-child i,
    #aside-tab-spec-vault > span:first-child i,
    #aside-tab-badge-progress > span:first-child i {
      width: 1.25rem !important;
      min-width: 1.25rem !important;
      text-align: center !important;
    }
    .sr-spec-nav-pill {
      flex: 0 0 5.65rem !important;
      width: 5.65rem !important;
      max-width: 5.65rem !important;
      min-height: 2.18rem !important;
      margin-left: .25rem !important;
      padding: .32rem .45rem !important;
      white-space: pre-line !important;
      line-height: 1.08 !important;
      font-size: 9px !important;
      text-align: center !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      overflow: hidden !important;
      text-overflow: clip !important;
    }
    .sr-badge-nav-pill {
      flex: 0 0 auto !important;
      margin-left: .5rem !important;
      margin-right: 0 !important;
      white-space: nowrap !important;
      text-align: center !important;
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
      top: .5rem !important;
      max-height: min(58vh, 450px) !important;
      z-index: 70 !important;
    }
    .sr-collapsible-tag-row { max-height: 4.25rem; }
    .sr-persistent-error-box { display: block; min-height: 0; }
    @media (max-width: 768px) {
      #sr-language-selector-wrap { transform: scale(.92); transform-origin: right bottom; }
      .sr-spec-nav-pill { flex-basis: 5.2rem !important; width: 5.2rem !important; max-width: 5.2rem !important; font-size: 8.5px !important; }
      .sr-badge-nav-pill { font-size: 9px !important; }
    }
  `;
  document.head.appendChild(css);

  apply();
  new MutationObserver(() => setTimeout(apply, 80)).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  setInterval(apply, 1500);
})();
