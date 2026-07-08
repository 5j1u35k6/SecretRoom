(() => {
  const STORAGE_KEY = 'sr_selected_language';
  const SOURCE_LANG = 'zh-TW';
  const languages = [
    ['zh-TW','繁體中文'],['zh-CN','简体中文'],['en','English'],['eo','Esperanto'],
    ['ja','日本語'],['ko','한국어'],['vi','Tiếng Việt'],['th','ไทย'],['id','Bahasa Indonesia'],['ms','Bahasa Melayu'],['fil','Filipino'],
    ['my','မြန်မာ'],['km','ភាសាខ្មែរ'],['lo','ລາວ'],['ne','नेपाली'],['si','සිංහල'],
    ['hi','हिन्दी'],['ur','اردو'],['bn','বাংলা'],['ta','தமிழ்'],['te','తెలుగు'],['ml','മലയാളം'],['kn','ಕನ್ನಡ'],['mr','मराठी'],['gu','ગુજરાતી'],['pa','ਪੰਜਾਬੀ'],
    ['ar','العربية'],['fa','فارسی'],['he','עברית'],['tr','Türkçe'],['az','Azərbaycanca'],['hy','Հայերեն'],['ka','ქართული'],
    ['kk','Қазақша'],['ky','Кыргызча'],['tg','Тоҷикӣ'],['uz','Oʻzbekcha'],['mn','Монгол'],['ps','پښتو'],['ku','Kurdî'],['ru','Русский']
  ];
  const supported = new Set(languages.map(([code]) => code));
  const regionMap = {TW:'zh-TW',HK:'zh-TW',MO:'zh-TW',CN:'zh-CN',SG:'zh-CN',JP:'ja',KR:'ko',VN:'vi',TH:'th',ID:'id',MY:'ms',BN:'ms',PH:'fil',MM:'my',KH:'km',LA:'lo',NP:'ne',LK:'si',IN:'hi',PK:'ur',BD:'bn',IR:'fa',IL:'he',TR:'tr',AZ:'az',AM:'hy',GE:'ka',KZ:'kk',KG:'ky',TJ:'tg',UZ:'uz',MN:'mn',AF:'ps',SA:'ar',AE:'ar',QA:'ar',KW:'ar',BH:'ar',OM:'ar',JO:'ar',LB:'ar',IQ:'ar',SY:'ar',YE:'ar',RU:'ru'};
  const timeZoneMap = {'Asia/Taipei':'zh-TW','Asia/Hong_Kong':'zh-TW','Asia/Macau':'zh-TW','Asia/Shanghai':'zh-CN','Asia/Singapore':'zh-CN','Asia/Tokyo':'ja','Asia/Seoul':'ko','Asia/Ho_Chi_Minh':'vi','Asia/Bangkok':'th','Asia/Jakarta':'id','Asia/Kuala_Lumpur':'ms','Asia/Manila':'fil','Asia/Yangon':'my','Asia/Phnom_Penh':'km','Asia/Vientiane':'lo','Asia/Kathmandu':'ne','Asia/Colombo':'si','Asia/Kolkata':'hi','Asia/Karachi':'ur','Asia/Dhaka':'bn','Asia/Tehran':'fa','Asia/Jerusalem':'he','Asia/Istanbul':'tr','Asia/Baku':'az','Asia/Yerevan':'hy','Asia/Tbilisi':'ka','Asia/Almaty':'kk','Asia/Astana':'kk','Asia/Bishkek':'ky','Asia/Dushanbe':'tg','Asia/Tashkent':'uz','Asia/Ulaanbaatar':'mn','Asia/Kabul':'ps','Asia/Riyadh':'ar','Asia/Dubai':'ar','Asia/Qatar':'ar','Asia/Kuwait':'ar','Asia/Bahrain':'ar','Asia/Muscat':'ar','Asia/Amman':'ar','Asia/Beirut':'ar','Asia/Baghdad':'ar','Asia/Damascus':'ar','Asia/Aden':'ar'};
  const apiLangMap = { 'zh-TW':'zh-TW', 'zh-CN':'zh-CN', fil:'tl', my:'my', km:'km', lo:'lo', si:'si' };
  const originalText = new WeakMap();
  const attrStoreName = 'srI18nOriginal';
  const cache = new Map();
  let currentLang = '';
  let translating = false;
  let queued = false;
  let observer;

  function apiLang(lang) { return apiLangMap[lang] || lang; }
  function isSupported(lang) { return supported.has(lang); }
  function setCurrentLanguage(lang) {
    const target = isSupported(lang) ? lang : 'en';
    localStorage.setItem(STORAGE_KEY, target);
    currentLang = target;
    document.documentElement.setAttribute('lang', target);
    const select = document.getElementById('sr-language-selector');
    if (select) select.value = target;
    return target;
  }
  function normalizeLocale(locale) {
    const parts = String(locale || '').replace('_','-').split('-');
    const base = (parts[0] || '').toLowerCase();
    const region = (parts[1] || '').toUpperCase();
    if (base === 'zh') return region === 'CN' || region === 'SG' ? 'zh-CN' : 'zh-TW';
    if (isSupported(`${base}-${region}`)) return `${base}-${region}`;
    if (isSupported(base)) return base;
    return regionMap[region] || '';
  }
  function detectLanguage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && isSupported(saved)) return saved;
    const browserLangs = Array.isArray(navigator.languages) && navigator.languages.length ? navigator.languages : [navigator.language];
    for (const lang of browserLangs) {
      const matched = normalizeLocale(lang);
      if (matched) return matched;
    }
    return timeZoneMap[Intl.DateTimeFormat().resolvedOptions().timeZone] || 'en';
  }
  function shouldSkipElement(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.closest('#sr-language-selector-wrap,.notranslate,[translate="no"],script,style,noscript,textarea,select,option,input,svg,canvas,video,audio')) return true;
    if (el.closest('[contenteditable="true"]')) return true;
    if (el.classList && (el.classList.contains('fa') || Array.from(el.classList).some(c => c.startsWith('fa-')))) return true;
    return false;
  }
  function isMostlySymbols(text) {
    const clean = text.replace(/[\s\d\p{P}\p{S}]/gu, '');
    return clean.length === 0;
  }
  function protectBrand(text) {
    return /SecretRoom|S\+\s*\.\s*S\s*\.\s*G|S\+\.S\.G|Badge|黃金\s*Spec|Gold\s*Spec/i.test(text);
  }
  function collectTextNodes(root = document.body) {
    const nodes = [];
    if (!root) return nodes;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || shouldSkipElement(parent)) return NodeFilter.FILTER_REJECT;
        const text = node.nodeValue || '';
        const trim = text.trim();
        if (!trim || trim.length > 420 || isMostlySymbols(trim) || protectBrand(trim)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    return nodes;
  }
  function storeOriginalNode(node) {
    if (!originalText.has(node)) originalText.set(node, node.nodeValue || '');
    return originalText.get(node);
  }
  function restoreTextNodes(root = document.body) {
    collectTextNodes(root).forEach(node => {
      const original = originalText.get(node);
      if (original !== undefined) node.nodeValue = original;
    });
    document.querySelectorAll('[data-sr-i18n-original-placeholder],[data-sr-i18n-original-title],[data-sr-i18n-original-aria-label]').forEach(el => {
      ['placeholder','title','aria-label'].forEach(attr => {
        const key = `srI18nOriginal${attr.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase())}`;
        if (el.dataset[key] !== undefined) el.setAttribute(attr, el.dataset[key]);
      });
    });
  }
  async function translateText(text, target) {
    const raw = String(text || '');
    const trim = raw.trim();
    if (!trim || target === SOURCE_LANG || protectBrand(trim)) return raw;
    const key = `${target}|${trim}`;
    if (cache.has(key)) return raw.replace(trim, cache.get(key));
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(apiLang(target))}&dt=t&q=${encodeURIComponent(trim)}`;
    try {
      const response = await fetch(url, { method: 'GET', mode: 'cors' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const translated = Array.isArray(data?.[0]) ? data[0].map(part => part?.[0] || '').join('') : '';
      const result = translated || trim;
      cache.set(key, result);
      return raw.replace(trim, result);
    } catch (error) {
      console.warn('[SecretRoom i18n] translate failed:', error);
      return raw;
    }
  }
  async function translateNodeList(nodes, target) {
    const list = nodes.slice(0, 260);
    const concurrency = 4;
    let index = 0;
    async function worker() {
      while (index < list.length) {
        const node = list[index++];
        const original = storeOriginalNode(node);
        node.nodeValue = await translateText(original, target);
      }
    }
    await Promise.all(Array.from({ length: concurrency }, worker));
  }
  async function translateAttributes(target) {
    const attrs = ['placeholder','title','aria-label'];
    const elements = Array.from(document.querySelectorAll('[placeholder],[title],[aria-label]')).filter(el => !shouldSkipElement(el));
    const concurrency = 4;
    let index = 0;
    async function worker() {
      while (index < elements.length) {
        const el = elements[index++];
        for (const attr of attrs) {
          const value = el.getAttribute(attr);
          if (!value || value.trim().length > 220 || protectBrand(value)) continue;
          const dataKey = `srI18nOriginal${attr.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase())}`;
          if (el.dataset[dataKey] === undefined) el.dataset[dataKey] = value;
          el.setAttribute(attr, await translateText(el.dataset[dataKey], target));
        }
      }
    }
    await Promise.all(Array.from({ length: concurrency }, worker));
  }
  async function applyLanguage(lang, root = document.body) {
    const target = setCurrentLanguage(lang);
    if (translating) { queued = true; return; }
    translating = true;
    try {
      restoreTextNodes(root);
      if (target !== SOURCE_LANG) {
        await translateNodeList(collectTextNodes(root), target);
        await translateAttributes(target);
      }
    } finally {
      translating = false;
      if (queued) { queued = false; setTimeout(() => applyLanguage(currentLang), 250); }
    }
  }
  function buildUI() {
    if (document.getElementById('sr-language-selector-wrap')) return;
    const wrap = document.createElement('div');
    wrap.id = 'sr-language-selector-wrap';
    wrap.className = 'notranslate fixed z-[160] rounded-3xl border border-amber-500/25 bg-slate-950/92 px-4 py-3 shadow-2xl backdrop-blur-md';
    wrap.setAttribute('translate', 'no');
    wrap.innerHTML = `
      <div class="notranslate flex items-center gap-2 text-[10px] font-black tracking-[0.18em] text-amber-400/80 mb-2" translate="no"><i class="fa-solid fa-globe text-amber-400 text-xs"></i><span>Language</span></div>
      <select id="sr-language-selector" class="notranslate w-full bg-slate-950/70 border border-amber-500/20 rounded-2xl px-3 py-2 text-[12px] font-black text-amber-200 outline-none cursor-pointer" translate="no" aria-label="Language selector">
        ${languages.map(([code,label]) => `<option class="notranslate" translate="no" lang="${code}" value="${code}">${label}</option>`).join('')}
      </select>
      <div id="sr-language-status" class="notranslate mt-2 text-[10px] text-slate-500" translate="no"></div>`;
    document.body.appendChild(wrap);
    const select = document.getElementById('sr-language-selector');
    select.value = currentLang || detectLanguage();
    select.onchange = async () => {
      const status = document.getElementById('sr-language-status');
      if (status) status.textContent = 'Translating...';
      await applyLanguage(select.value);
      if (status) status.textContent = select.value === SOURCE_LANG ? '' : 'Applied';
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
  const css = document.createElement('style');
  css.textContent = `
    :root{--sr-unified-font:"Noto Sans","Noto Sans TC","Noto Sans SC","Noto Sans JP","Noto Sans KR",Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
    body,body *:not(i):not([class^="fa-"]):not([class*=" fa-"]):not(.fa):not(.fa-solid):not(.fa-regular):not(.fa-brands){font-family:var(--sr-unified-font)!important;}
    #sr-language-selector-wrap{right:1.25rem!important;bottom:1.25rem!important;top:auto!important;left:auto!important;width:14.75rem!important;}
    #sr-language-selector-wrap,#sr-language-selector-wrap *{font-family:var(--sr-unified-font)!important;}
    #sr-language-selector option{background:#020204;color:#f8e7b0;font-family:var(--sr-unified-font)!important;}
    @media(max-width:640px){#sr-language-selector-wrap{right:.75rem!important;bottom:.75rem!important;width:12.75rem!important;max-width:calc(100vw - 1.5rem);padding:.65rem .75rem;}#sr-language-selector{font-size:10px;}}
  `;
  document.head.appendChild(css);
  loadFonts();
  buildUI();
  applyLanguage(detectLanguage());
  observer = new MutationObserver(() => {
    if (currentLang && currentLang !== SOURCE_LANG) setTimeout(() => applyLanguage(currentLang), 500);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();
