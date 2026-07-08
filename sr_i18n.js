// SecretRoom URL-based i18n router
// Routes: /zh/, /zh-CN/, /en/, /ja/, /ko/, /eo/, /vi/, /th/, /id/, /ms/, /fil/

(() => {
  const SUPPORTED = {
    'zh': 'zh-TW',
    'zh-TW': 'zh-TW',
    'zh-CN': 'zh-CN',
    'en': 'en',
    'ja': 'ja',
    'ko': 'ko',
    'eo': 'eo',
    'vi': 'vi',
    'th': 'th',
    'id': 'id',
    'ms': 'ms',
    'fil': 'fil'
  };
  const LABELS = {
    'zh': '繁體中文',
    'zh-CN': '简体中文',
    'en': 'English',
    'ja': '日本語',
    'ko': '한국어',
    'eo': 'Esperanto',
    'vi': 'Tiếng Việt',
    'th': 'ไทย',
    'id': 'Bahasa Indonesia',
    'ms': 'Bahasa Melayu',
    'fil': 'Filipino'
  };
  const STORAGE_KEY = 'sr_locale';
  const DEFAULT_LANG = 'zh-TW';
  const ROUTE_CODES = ['zh', 'zh-CN', 'en', 'ja', 'ko', 'eo', 'vi', 'th', 'id', 'ms', 'fil'];
  const BRAND_PATTERNS = [/SecretRoom/i, /S\+\s*\.\s*S\s*\.\s*G/i, /S\+\.S\.G/i, /D\.G|C\.G|B\.G|A\.G|S\.G|S\+\.G|SSR\.G|Z\.G/i];
  const state = { lang: DEFAULT_LANG, dict: {}, applying: false };

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function routeInfo() {
    const parts = location.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex(p => ROUTE_CODES.includes(p) || p === 'zh-TW');
    const route = idx >= 0 ? parts[idx] : '';
    const baseParts = idx >= 0 ? parts.slice(0, idx) : parts;
    const isFile = baseParts[baseParts.length - 1]?.includes('.');
    const base = '/' + (isFile ? baseParts.slice(0, -1) : baseParts).join('/');
    return { route, base: base === '/' ? '' : base };
  }

  function normalizeLang(value) {
    return SUPPORTED[value] || DEFAULT_LANG;
  }

  function currentLang() {
    const url = new URL(location.href);
    const queryLang = url.searchParams.get('lang');
    if (queryLang && SUPPORTED[queryLang]) return normalizeLang(queryLang);
    const route = routeInfo().route;
    if (route && SUPPORTED[route]) return normalizeLang(route);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && Object.values(SUPPORTED).includes(saved)) return saved;
    return DEFAULT_LANG;
  }

  function routeCode(lang) {
    if (lang === 'zh-TW') return 'zh';
    return lang;
  }

  function routeUrl(code) {
    const info = routeInfo();
    const base = info.base || (location.pathname.startsWith('/SecretRoom') ? '/SecretRoom' : '');
    return `${base}/${code}/`;
  }

  function skipElement(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.closest('#sr-i18n-switcher,.notranslate,[translate="no"],script,style,noscript,textarea,select,option,input,svg,canvas,video,audio')) return true;
    if (el.closest('[contenteditable="true"]')) return true;
    if (el.classList && Array.from(el.classList).some(c => c === 'fa' || c.startsWith('fa-'))) return true;
    return false;
  }

  function protect(text) {
    return BRAND_PATTERNS.some(re => re.test(text));
  }

  function lookup(text) {
    const key = cleanText(text);
    if (!key || protect(key)) return text;
    return state.dict[key] || text;
  }

  function translateTextNode(node) {
    if (!node || !node.parentElement || skipElement(node.parentElement)) return;
    if (!node.__srOriginalText) node.__srOriginalText = node.nodeValue;
    const raw = node.__srOriginalText;
    const trim = cleanText(raw);
    if (!trim) return;
    const translated = lookup(trim);
    node.nodeValue = raw.replace(trim, translated);
  }

  function translateAttribute(el, attr) {
    if (!el || skipElement(el)) return;
    const value = el.getAttribute(attr);
    if (!value) return;
    const dataKey = `srI18nOriginal${attr.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase())}`;
    if (el.dataset[dataKey] === undefined) el.dataset[dataKey] = value;
    el.setAttribute(attr, lookup(el.dataset[dataKey]));
  }

  function apply(root = document.body) {
    if (state.applying || !root) return;
    state.applying = true;
    try {
      document.documentElement.lang = state.lang;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent || skipElement(parent)) return NodeFilter.FILTER_REJECT;
          const text = cleanText(node.nodeValue);
          if (!text || text.length > 240) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      const nodes = [];
      let node;
      while ((node = walker.nextNode())) nodes.push(node);
      nodes.forEach(translateTextNode);
      document.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el => {
        translateAttribute(el, 'placeholder');
        translateAttribute(el, 'title');
        translateAttribute(el, 'aria-label');
      });
    } finally {
      state.applying = false;
    }
  }

  async function loadDict(lang) {
    if (lang === DEFAULT_LANG) return {};
    const code = routeCode(lang);
    try {
      const response = await fetch(`i18n/${code}.json?v=20260708-i18n-routes-v2`, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.warn('[SecretRoom i18n] dictionary load failed:', error);
      return {};
    }
  }

  function buildSwitcher() {
    if (document.getElementById('sr-i18n-switcher')) return;
    const wrap = document.createElement('div');
    wrap.id = 'sr-i18n-switcher';
    wrap.className = 'fixed right-4 bottom-4 z-[160] rounded-3xl border border-amber-500/25 bg-slate-950/92 px-4 py-3 shadow-2xl backdrop-blur-md notranslate';
    wrap.setAttribute('translate', 'no');
    wrap.innerHTML = `
      <div class="text-[10px] font-black tracking-[0.18em] text-amber-400/80 mb-2"><i class="fa-solid fa-globe text-amber-400 text-xs mr-1.5"></i>Language</div>
      <select id="sr-i18n-select" class="w-full bg-slate-950/70 border border-amber-500/20 rounded-2xl px-3 py-2 text-[12px] font-black text-amber-200 outline-none cursor-pointer">
        ${ROUTE_CODES.map(code => `<option value="${code}">${LABELS[code]}</option>`).join('')}
      </select>`;
    document.body.appendChild(wrap);
    const select = document.getElementById('sr-i18n-select');
    select.value = routeCode(state.lang);
    select.onchange = () => {
      const code = select.value;
      localStorage.setItem(STORAGE_KEY, normalizeLang(code));
      location.href = routeUrl(code);
    };
  }

  const style = document.createElement('style');
  style.textContent = `
    #sr-i18n-switcher{width:14.75rem!important;font-family:Inter,"Noto Serif TC","Noto Sans TC",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;}
    #sr-i18n-switcher *{font-family:inherit!important;}
    #sr-i18n-select option{background:#020204;color:#f8e7b0;}
    @media(max-width:640px){#sr-i18n-switcher{right:.75rem!important;bottom:.75rem!important;width:12.75rem!important;max-width:calc(100vw - 1.5rem);padding:.65rem .75rem;}#sr-i18n-select{font-size:10px;}}
  `;
  document.head.appendChild(style);

  (async () => {
    state.lang = currentLang();
    localStorage.setItem(STORAGE_KEY, state.lang);
    state.dict = await loadDict(state.lang);
    buildSwitcher();
    apply();
    new MutationObserver(() => setTimeout(() => apply(), 80)).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    setInterval(apply, 1600);
  })();
})();