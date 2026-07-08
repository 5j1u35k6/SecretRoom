(() => {
  const STORAGE_KEY = 'sr_selected_language';
  const COOKIE_NAME = 'googtrans';
  const SOURCE_LANG = 'zh-TW';
  const languages = [
    ['zh-TW', '繁體中文'], ['zh-CN', '简体中文'], ['en', 'English'], ['eo', 'Esperanto'],
    ['ja', '日本語'], ['ko', '한국어'], ['vi', 'Tiếng Việt'], ['th', 'ไทย'], ['id', 'Bahasa Indonesia'], ['ms', 'Bahasa Melayu'], ['fil', 'Filipino'],
    ['my', 'မြန်မာ'], ['km', 'ភាសាខ្មែរ'], ['lo', 'ລາວ'], ['ne', 'नेपाली'], ['si', 'සිංහල'],
    ['hi', 'हिन्दी'], ['ur', 'اردو'], ['bn', 'বাংলা'], ['ta', 'தமிழ்'], ['te', 'తెలుగు'], ['ml', 'മലയാളം'], ['kn', 'ಕನ್ನಡ'], ['mr', 'मराठी'], ['gu', 'ગુજરાતી'], ['pa', 'ਪੰਜਾਬੀ'],
    ['ar', 'العربية'], ['fa', 'فارسی'], ['he', 'עברית'], ['tr', 'Türkçe'], ['az', 'Azərbaycanca'], ['hy', 'Հայերեն'], ['ka', 'ქართული'],
    ['kk', 'Қазақша'], ['ky', 'Кыргызча'], ['tg', 'Тоҷикӣ'], ['uz', 'Oʻzbekcha'], ['mn', 'Монгол'], ['ps', 'پښتو'], ['ku', 'Kurdî'], ['ru', 'Русский']
  ];
  const supported = new Set(languages.map(item => item[0]));
  const included = languages.map(item => item[0]).join(',');
  const regionMap = { TW:'zh-TW', HK:'zh-TW', MO:'zh-TW', CN:'zh-CN', SG:'zh-CN', JP:'ja', KR:'ko', VN:'vi', TH:'th', ID:'id', MY:'ms', BN:'ms', PH:'fil', MM:'my', KH:'km', LA:'lo', NP:'ne', LK:'si', IN:'hi', PK:'ur', BD:'bn', IR:'fa', IL:'he', TR:'tr', AZ:'az', AM:'hy', GE:'ka', KZ:'kk', KG:'ky', TJ:'tg', UZ:'uz', MN:'mn', AF:'ps', SA:'ar', AE:'ar', QA:'ar', KW:'ar', BH:'ar', OM:'ar', JO:'ar', LB:'ar', IQ:'ar', SY:'ar', YE:'ar', RU:'ru' };
  const timeZoneMap = { 'Asia/Taipei':'zh-TW','Asia/Hong_Kong':'zh-TW','Asia/Macau':'zh-TW','Asia/Shanghai':'zh-CN','Asia/Singapore':'zh-CN','Asia/Tokyo':'ja','Asia/Seoul':'ko','Asia/Ho_Chi_Minh':'vi','Asia/Bangkok':'th','Asia/Jakarta':'id','Asia/Kuala_Lumpur':'ms','Asia/Manila':'fil','Asia/Yangon':'my','Asia/Phnom_Penh':'km','Asia/Vientiane':'lo','Asia/Kathmandu':'ne','Asia/Colombo':'si','Asia/Kolkata':'hi','Asia/Karachi':'ur','Asia/Dhaka':'bn','Asia/Tehran':'fa','Asia/Jerusalem':'he','Asia/Istanbul':'tr','Asia/Baku':'az','Asia/Yerevan':'hy','Asia/Tbilisi':'ka','Asia/Almaty':'kk','Asia/Astana':'kk','Asia/Bishkek':'ky','Asia/Dushanbe':'tg','Asia/Tashkent':'uz','Asia/Ulaanbaatar':'mn','Asia/Kabul':'ps','Asia/Riyadh':'ar','Asia/Dubai':'ar','Asia/Qatar':'ar','Asia/Kuwait':'ar','Asia/Bahrain':'ar','Asia/Muscat':'ar','Asia/Amman':'ar','Asia/Beirut':'ar','Asia/Baghdad':'ar','Asia/Damascus':'ar','Asia/Aden':'ar' };

  function writeTranslateCookie(value, maxAge) {
    document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${maxAge}`;
    document.cookie = `${COOKIE_NAME}=${value}; path=/SecretRoom/; max-age=${maxAge}`;
  }
  function clearTranslateCookie() {
    writeTranslateCookie('', 0);
  }
  function setCookie(lang) {
    const target = supported.has(lang) ? lang : 'en';
    localStorage.setItem(STORAGE_KEY, target);
    document.documentElement.setAttribute('lang', target);
    if (target === SOURCE_LANG) {
      clearTranslateCookie();
      return;
    }
    const maxAge = 60 * 60 * 24 * 365;
    writeTranslateCookie(`/${SOURCE_LANG}/${target}`, maxAge);
  }
  function getCookieLang() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && supported.has(saved)) return saved;
    const cookie = document.cookie.split('; ').find(row => row.startsWith(`${COOKIE_NAME}=`));
    if (!cookie) return '';
    const value = decodeURIComponent(cookie.split('=')[1] || '');
    const parts = value.split('/').filter(Boolean);
    const target = parts.length >= 2 ? parts[1] : '';
    return supported.has(target) ? target : '';
  }
  function normalizeLocale(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const parts = raw.replace('_','-').split('-');
    const base = (parts[0] || '').toLowerCase();
    const region = (parts[1] || '').toUpperCase();
    if (base === 'zh') return region === 'CN' || region === 'SG' ? 'zh-CN' : 'zh-TW';
    const exact = `${base}-${region}`;
    if (supported.has(exact)) return exact;
    if (supported.has(base)) return base;
    return regionMap[region] || '';
  }
  function detectDeviceLanguage() {
    const saved = localStorage.getItem(STORAGE_KEY) || getCookieLang();
    if (saved && supported.has(saved)) return saved;
    const browserLangs = Array.isArray(navigator.languages) && navigator.languages.length ? navigator.languages : [navigator.language];
    for (const lang of browserLangs) {
      const matched = normalizeLocale(lang);
      if (matched && supported.has(matched)) return matched;
    }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && timeZoneMap[tz]) return timeZoneMap[tz];
    return 'en';
  }
  function ensureInitialLanguage() {
    const saved = localStorage.getItem(STORAGE_KEY) || getCookieLang();
    const lang = saved && supported.has(saved) ? saved : detectDeviceLanguage();
    setCookie(lang);
    return lang;
  }
  function applyGoogleCombo(lang, attempt = 0) {
    const target = supported.has(lang) ? lang : 'en';
    const combo = document.querySelector('select.goog-te-combo');
    if (!combo) {
      if (attempt < 40) setTimeout(() => applyGoogleCombo(target, attempt + 1), 250);
      return;
    }
    if (target === SOURCE_LANG) {
      combo.value = '';
      combo.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    if (combo.value !== target) {
      combo.value = target;
      combo.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  function buildSelector() {
    if (document.getElementById('sr-language-selector-wrap')) return;
    const wrap = document.createElement('div');
    wrap.id = 'sr-language-selector-wrap';
    wrap.className = 'notranslate fixed z-[160] rounded-3xl border border-amber-500/25 bg-slate-950/92 px-4 py-3 shadow-2xl backdrop-blur-md';
    wrap.setAttribute('translate', 'no');
    wrap.innerHTML = `
      <div class="notranslate flex items-center gap-2 text-[10px] font-black tracking-[0.18em] text-amber-400/80 mb-2" translate="no">
        <i class="fa-solid fa-globe text-amber-400 text-xs"></i>
        <span>Language</span>
      </div>
      <select id="sr-language-selector" class="notranslate w-full bg-slate-950/70 border border-amber-500/20 rounded-2xl px-3 py-2 text-[12px] font-black text-amber-200 outline-none cursor-pointer" translate="no" aria-label="Language selector">
        ${languages.map(([code, label]) => `<option class="notranslate" translate="no" lang="${code}" value="${code}">${label}</option>`).join('')}
      </select>
      <div id="google_translate_element" class="hidden"></div>
    `;
    document.body.appendChild(wrap);
    const select = document.getElementById('sr-language-selector');
    select.value = ensureInitialLanguage();
    select.onchange = () => {
      const lang = select.value;
      setCookie(lang);
      applyGoogleCombo(lang);
      if (lang === SOURCE_LANG) setTimeout(() => window.location.reload(), 300);
    };
  }
  function loadGoogleTranslate() {
    if (document.getElementById('sr-google-translate-script')) return;
    const script = document.createElement('script');
    script.id = 'sr-google-translate-script';
    script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async = true;
    document.head.appendChild(script);
  }
  function loadUniversalFonts() {
    if (document.getElementById('sr-universal-fonts')) return;
    const link = document.createElement('link');
    link.id = 'sr-universal-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700;800;900&family=Noto+Sans+TC:wght@400;500;600;700;800;900&family=Noto+Sans+SC:wght@400;500;600;700;800;900&family=Noto+Sans+JP:wght@400;500;600;700;800;900&family=Noto+Sans+KR:wght@400;500;600;700;800;900&display=swap';
    document.head.appendChild(link);
  }
  function applyTranslatedLayoutFixes() {
    document.querySelectorAll('.sr-spec-two-line-pill').forEach(el => {
      if (el.closest('#aside-tab-spec-vault, #aside-tab-badge-progress, aside')) el.classList.remove('sr-spec-two-line-pill');
    });
    const nodes = document.querySelectorAll('button, a, span, div');
    nodes.forEach(el => {
      if (el.id === 'sr-language-selector-wrap' || el.closest('#sr-language-selector-wrap')) return;
      if (el.closest('#aside-tab-spec-vault, #aside-tab-badge-progress, aside')) return;
      const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 70) return;
      const isGoldSpec = /黃金|黄金|Spec|spec|Specifo|Golden|Limigita|限定|認證|认证/i.test(text);
      const looksLikePill = /rounded|brushed-gold|amber|gold|crystal-border/i.test(String(el.className || ''));
      if (isGoldSpec && looksLikePill) el.classList.add('sr-spec-two-line-pill');
    });
  }
  window.googleTranslateElementInit = function() {
    if (!window.google || !window.google.translate) return;
    new window.google.translate.TranslateElement({ pageLanguage: SOURCE_LANG, includedLanguages: included, autoDisplay: false, layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE }, 'google_translate_element');
    setTimeout(() => applyGoogleCombo(getCookieLang() || ensureInitialLanguage()), 500);
  };

  const css = document.createElement('style');
  css.textContent = `
    :root { --sr-unified-font: "Noto Sans", "Noto Sans TC", "Noto Sans SC", "Noto Sans JP", "Noto Sans KR", Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body > .skiptranslate, iframe.goog-te-banner-frame { display: none !important; }
    body { top: 0 !important; }
    body, body *:not(i):not([class^="fa-"]):not([class*=" fa-"]):not(.fa):not(.fa-solid):not(.fa-regular):not(.fa-brands) { font-family: var(--sr-unified-font) !important; }
    .font-luxury, .font-serif, .tracking-widest, .tracking-\[0\.18em\], .tracking-\[0\.2em\], .tracking-\[0\.24em\] { font-family: var(--sr-unified-font) !important; }
    font, .VIpgJd-yAWNEb-VIpgJd-fmcmS-sn54Q { font-family: var(--sr-unified-font) !important; }
    #sr-language-selector-wrap { right: 1.25rem !important; bottom: 1.25rem !important; top: auto !important; left: auto !important; width: 14.75rem !important; }
    #sr-language-selector-wrap, #sr-language-selector-wrap * { font-family: var(--sr-unified-font) !important; }
    #sr-language-selector { letter-spacing: 0.02em; }
    #sr-language-selector option { background: #020204; color: #f8e7b0; font-family: var(--sr-unified-font) !important; }
    .sr-spec-two-line-pill { width: 9.75rem !important; max-width: 9.75rem !important; min-height: 3.15rem !important; white-space: normal !important; overflow: visible !important; text-overflow: clip !important; line-height: 1.12 !important; text-align: center !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; flex-wrap: wrap !important; word-break: normal !important; overflow-wrap: anywhere !important; padding-left: 0.9rem !important; padding-right: 0.9rem !important; }
    aside .sr-spec-two-line-pill, #aside-tab-spec-vault .sr-spec-two-line-pill, #aside-tab-badge-progress .sr-spec-two-line-pill { width: auto !important; max-width: none !important; min-height: unset !important; padding: inherit !important; }
    @media (max-width: 640px) {
      #sr-language-selector-wrap { right: 0.75rem !important; bottom: 0.75rem !important; width: 12.75rem !important; max-width: calc(100vw - 1.5rem); padding: 0.65rem 0.75rem; }
      #sr-language-selector { font-size: 10px; }
      .sr-spec-two-line-pill { width: 8.9rem !important; max-width: 8.9rem !important; min-height: 3rem !important; font-size: 10px !important; }
    }
  `;
  document.head.appendChild(css);

  loadUniversalFonts();
  buildSelector();
  loadGoogleTranslate();
  applyTranslatedLayoutFixes();
  new MutationObserver(() => setTimeout(applyTranslatedLayoutFixes, 120)).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  setInterval(applyTranslatedLayoutFixes, 1500);
})();
