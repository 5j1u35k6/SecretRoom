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
  const included = languages.map(([code]) => code).join(',');
  const supported = new Set(languages.map(([code]) => code));
  const regionMap = { TW:'zh-TW', HK:'zh-TW', MO:'zh-TW', CN:'zh-CN', SG:'zh-CN', JP:'ja', KR:'ko', VN:'vi', TH:'th', ID:'id', MY:'ms', BN:'ms', PH:'fil', MM:'my', KH:'km', LA:'lo', NP:'ne', LK:'si', IN:'hi', PK:'ur', BD:'bn', IR:'fa', IL:'he', TR:'tr', AZ:'az', AM:'hy', GE:'ka', KZ:'kk', KG:'ky', TJ:'tg', UZ:'uz', MN:'mn', AF:'ps', SA:'ar', AE:'ar', QA:'ar', KW:'ar', BH:'ar', OM:'ar', JO:'ar', LB:'ar', IQ:'ar', SY:'ar', YE:'ar', RU:'ru' };
  const timeZoneMap = { 'Asia/Taipei':'zh-TW','Asia/Hong_Kong':'zh-TW','Asia/Macau':'zh-TW','Asia/Shanghai':'zh-CN','Asia/Singapore':'zh-CN','Asia/Tokyo':'ja','Asia/Seoul':'ko','Asia/Ho_Chi_Minh':'vi','Asia/Bangkok':'th','Asia/Jakarta':'id','Asia/Kuala_Lumpur':'ms','Asia/Manila':'fil','Asia/Yangon':'my','Asia/Phnom_Penh':'km','Asia/Vientiane':'lo','Asia/Kathmandu':'ne','Asia/Colombo':'si','Asia/Kolkata':'hi','Asia/Karachi':'ur','Asia/Dhaka':'bn','Asia/Tehran':'fa','Asia/Jerusalem':'he','Asia/Istanbul':'tr','Asia/Baku':'az','Asia/Yerevan':'hy','Asia/Tbilisi':'ka','Asia/Almaty':'kk','Asia/Astana':'kk','Asia/Bishkek':'ky','Asia/Dushanbe':'tg','Asia/Tashkent':'uz','Asia/Ulaanbaatar':'mn','Asia/Kabul':'ps','Asia/Riyadh':'ar','Asia/Dubai':'ar','Asia/Qatar':'ar','Asia/Kuwait':'ar','Asia/Bahrain':'ar','Asia/Muscat':'ar','Asia/Amman':'ar','Asia/Beirut':'ar','Asia/Baghdad':'ar','Asia/Damascus':'ar','Asia/Aden':'ar' };

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
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && supported.has(saved)) return saved;
    const browserLangs = Array.isArray(navigator.languages) && navigator.languages.length ? navigator.languages : [navigator.language];
    for (const lang of browserLangs) {
      const matched = normalizeLocale(lang);
      if (matched && supported.has(matched)) return matched;
    }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timeZoneMap[tz] || 'en';
  }

  function writeCookie(name, value, maxAge) {
    const encoded = encodeURIComponent(value);
    document.cookie = `${name}=${encoded}; path=/; max-age=${maxAge}`;
    document.cookie = `${name}=${encoded}; path=/SecretRoom/; max-age=${maxAge}`;
    try {
      const host = location.hostname;
      if (host && host.includes('.github.io')) document.cookie = `${name}=${encoded}; domain=.github.io; path=/; max-age=${maxAge}`;
    } catch (_) {}
  }

  function setTranslateLanguage(lang) {
    const target = supported.has(lang) ? lang : 'en';
    localStorage.setItem(STORAGE_KEY, target);
    document.documentElement.setAttribute('lang', target);
    if (target === SOURCE_LANG) {
      writeCookie(COOKIE_NAME, '', 0);
    } else {
      writeCookie(COOKIE_NAME, `/auto/${target}`, 60 * 60 * 24 * 365);
    }
    return target;
  }

  function currentLanguage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && supported.has(saved)) return saved;
    return detectDeviceLanguage();
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
      <div id="google_translate_element" class="notranslate" translate="no"></div>
    `;
    document.body.appendChild(wrap);
    const select = document.getElementById('sr-language-selector');
    const initial = currentLanguage();
    select.value = initial;
    if (!localStorage.getItem(STORAGE_KEY)) setTranslateLanguage(initial);
    select.onchange = () => {
      setTranslateLanguage(select.value);
      window.location.reload();
    };
  }

  function loadFonts() {
    if (document.getElementById('sr-universal-fonts')) return;
    const link = document.createElement('link');
    link.id = 'sr-universal-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700;800;900&family=Noto+Sans+TC:wght@400;500;600;700;800;900&family=Noto+Sans+SC:wght@400;500;600;700;800;900&family=Noto+Sans+JP:wght@400;500;600;700;800;900&family=Noto+Sans+KR:wght@400;500;600;700;800;900&display=swap';
    document.head.appendChild(link);
  }

  window.googleTranslateElementInit = function() {
    if (!window.google || !window.google.translate) return;
    new window.google.translate.TranslateElement({
      pageLanguage: SOURCE_LANG,
      includedLanguages: included,
      autoDisplay: false,
      layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE
    }, 'google_translate_element');
  };

  function loadGoogleTranslate() {
    if (document.getElementById('sr-google-translate-script')) return;
    const script = document.createElement('script');
    script.id = 'sr-google-translate-script';
    script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async = true;
    document.head.appendChild(script);
  }

  const css = document.createElement('style');
  css.textContent = `
    :root{--sr-unified-font:"Noto Sans","Noto Sans TC","Noto Sans SC","Noto Sans JP","Noto Sans KR",Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
    body>.skiptranslate,iframe.goog-te-banner-frame{display:none!important;} body{top:0!important;}
    body,body *:not(i):not([class^="fa-"]):not([class*=" fa-"]):not(.fa):not(.fa-solid):not(.fa-regular):not(.fa-brands){font-family:var(--sr-unified-font)!important;}
    #sr-language-selector-wrap{right:1.25rem!important;bottom:1.25rem!important;top:auto!important;left:auto!important;width:14.75rem!important;}
    #sr-language-selector-wrap,#sr-language-selector-wrap *{font-family:var(--sr-unified-font)!important;}
    #sr-language-selector option{background:#020204;color:#f8e7b0;font-family:var(--sr-unified-font)!important;}
    #google_translate_element{position:absolute!important;left:-9999px!important;top:auto!important;width:1px!important;height:1px!important;overflow:hidden!important;opacity:.01!important;}
    @media(max-width:640px){#sr-language-selector-wrap{right:.75rem!important;bottom:.75rem!important;width:12.75rem!important;max-width:calc(100vw - 1.5rem);padding:.65rem .75rem;}#sr-language-selector{font-size:10px;}}
  `;
  document.head.appendChild(css);

  loadFonts();
  buildSelector();
  loadGoogleTranslate();
})();
