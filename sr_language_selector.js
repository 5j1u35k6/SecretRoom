(() => {
  const STORAGE_KEY = 'sr_selected_language';
  const COOKIE_NAME = 'googtrans';
  const languages = [
    ['zh-TW', '繁體中文'], ['zh-CN', '简体中文'], ['en', 'English'], ['eo', 'Esperanto'],
    ['ja', '日本語'], ['ko', '한국어'], ['vi', 'Tiếng Việt'], ['th', 'ไทย'], ['id', 'Bahasa Indonesia'], ['ms', 'Bahasa Melayu'], ['fil', 'Filipino'],
    ['my', 'မြန်မာ'], ['km', 'ភាសាខ្មែរ'], ['lo', 'ລາວ'], ['ne', 'नेपाली'], ['si', 'සිංහල'],
    ['hi', 'हिन्दी'], ['ur', 'اردو'], ['bn', 'বাংলা'], ['ta', 'தமிழ்'], ['te', 'తెలుగు'], ['ml', 'മലയാളം'], ['kn', 'ಕನ್ನಡ'], ['mr', 'मराठी'], ['gu', 'ગુજરાતી'], ['pa', 'ਪੰਜਾਬੀ'],
    ['ar', 'العربية'], ['fa', 'فارسی'], ['he', 'עברית'], ['tr', 'Türkçe'], ['az', 'Azərbaycanca'], ['hy', 'Հայերեն'], ['ka', 'ქართული'],
    ['kk', 'Қазақша'], ['ky', 'Кыргызча'], ['tg', 'Тоҷикӣ'], ['uz', 'Oʻzbekcha'], ['mn', 'Монгол'], ['ps', 'پښتو'], ['ku', 'Kurdî'], ['ru', 'Русский']
  ];
  const included = languages.map(item => item[0]).join(',');

  function setCookie(lang) {
    const value = lang === 'zh-TW' ? '/auto/zh-TW' : `/auto/${lang}`;
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${maxAge}`;
    document.cookie = `${COOKIE_NAME}=${value}; path=/SecretRoom/; max-age=${maxAge}`;
    localStorage.setItem(STORAGE_KEY, lang);
  }

  function getCookieLang() {
    const cookie = document.cookie.split('; ').find(row => row.startsWith(`${COOKIE_NAME}=`));
    if (!cookie) return localStorage.getItem(STORAGE_KEY) || 'zh-TW';
    const value = decodeURIComponent(cookie.split('=')[1] || '');
    const parts = value.split('/').filter(Boolean);
    return parts[1] || localStorage.getItem(STORAGE_KEY) || 'zh-TW';
  }

  function buildSelector() {
    if (document.getElementById('sr-language-selector-wrap')) return;
    const wrap = document.createElement('div');
    wrap.id = 'sr-language-selector-wrap';
    wrap.className = 'notranslate fixed z-[160] flex items-center gap-2 rounded-full border border-amber-500/20 bg-slate-950/90 px-3 py-2 shadow-2xl backdrop-blur-md';
    wrap.setAttribute('translate', 'no');
    wrap.innerHTML = `
      <i class="fa-solid fa-globe text-amber-400 text-xs"></i>
      <select id="sr-language-selector" class="notranslate bg-transparent text-[11px] font-black text-amber-200 outline-none max-w-[150px] cursor-pointer" translate="no" aria-label="Language selector">
        ${languages.map(([code, label]) => `<option class="notranslate" translate="no" lang="${code}" value="${code}">${label}</option>`).join('')}
      </select>
      <div id="google_translate_element" class="hidden"></div>
    `;
    document.body.appendChild(wrap);
    const select = document.getElementById('sr-language-selector');
    select.value = getCookieLang();
    select.onchange = () => {
      const lang = select.value;
      setCookie(lang);
      window.location.reload();
    };
  }

  window.googleTranslateElementInit = function() {
    if (!window.google || !window.google.translate) return;
    new window.google.translate.TranslateElement({
      pageLanguage: 'zh-TW',
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
    body > .skiptranslate, iframe.goog-te-banner-frame { display: none !important; }
    body { top: 0 !important; }
    #sr-language-selector-wrap {
      top: 8.75rem !important;
      left: 2.5rem !important;
      bottom: auto !important;
      right: auto !important;
      width: 16.5rem !important;
      justify-content: center !important;
      font-family: Inter, "Noto Serif TC", "Noto Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
    }
    #sr-language-selector {
      width: 12.25rem !important;
      font-family: Inter, "Noto Serif TC", "Noto Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      letter-spacing: 0.02em;
    }
    #sr-language-selector option {
      background: #020204;
      color: #f8e7b0;
      font-family: Inter, "Noto Serif TC", "Noto Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
    }
    @media (max-width: 640px) {
      #sr-language-selector-wrap {
        top: 8.15rem !important;
        left: 1.45rem !important;
        width: 14rem !important;
        max-width: calc(100vw - 2.9rem);
        padding-left: 0.65rem;
        padding-right: 0.65rem;
      }
      #sr-language-selector { width: 10.5rem !important; max-width: 10.5rem; font-size: 10px; }
    }
  `;
  document.head.appendChild(css);

  buildSelector();
  loadGoogleTranslate();
})();
