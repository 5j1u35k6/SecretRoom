// SecretRoom URL-based i18n router
// Routes: /zh/, /zh-CN/, /en/, /ja/, /ko/, /eo/, plus selected Asia routes.

(() => {
  const SUPPORTED = {
    'zh': 'zh-TW', 'zh-TW': 'zh-TW', 'zh-CN': 'zh-CN', 'en': 'en', 'ja': 'ja', 'ko': 'ko', 'eo': 'eo',
    'vi': 'vi', 'th': 'th', 'id': 'id', 'ms': 'ms', 'fil': 'fil',
    'my': 'my', 'km': 'km', 'lo': 'lo', 'ne': 'ne', 'hi': 'hi', 'bn': 'bn', 'ta': 'ta', 'ur': 'ur', 'ar': 'ar', 'fa': 'fa', 'tr': 'tr'
  };
  const LABELS = {
    'zh': '繁體中文', 'zh-CN': '简体中文', 'en': 'English', 'ja': '日本語', 'ko': '한국어', 'eo': 'Esperanto',
    'vi': 'Tiếng Việt', 'th': 'ไทย', 'id': 'Bahasa Indonesia', 'ms': 'Bahasa Melayu', 'fil': 'Filipino',
    'my': 'မြန်မာ', 'km': 'ភាសាខ្មែរ', 'lo': 'ລາວ', 'ne': 'नेपाली', 'hi': 'हिन्दी', 'bn': 'বাংলা', 'ta': 'தமிழ்', 'ur': 'اردو', 'ar': 'العربية', 'fa': 'فارسی', 'tr': 'Türkçe'
  };
  const STORAGE_KEY = 'sr_locale';
  const DEFAULT_LANG = 'zh-TW';
  const ROUTE_CODES = Object.keys(LABELS);
  const MOBILE_QUERY = '(max-width: 768px)';
  const state = { lang: DEFAULT_LANG, dict: {}, keys: [], applying: false };

  const EXTRA = {
    en: {
      'Full Menu': 'Full Menu', '完整功能表': 'Full Menu', '聲音播放': 'Audio Playback', '熱門標籤': 'Popular Tags', 'Bgm Audio': 'BGM Audio', 'Audio Muted': 'Audio Muted', 'Premium Vip Lounge': 'Premium VIP Lounge',
      'Publish Secret': 'Publish Secret', '發布近期動態。發布相片時將自動生成淡色、較隱性的「SecretRomm @使用者帳號」滿版 45 度浮水印；若原始圖片本身已有其他浮水印，系統不會自動移除。': 'Post a recent update. Photos automatically receive a subtle 45-degree full-image watermark. Existing watermarks will not be removed.',
      '動態內容描述 (選填)': 'Post Description (optional)', '分享當下的健美重訓成果 or 私密心情...': 'Share your current training result or private mood...', '加載動態照片 (選填)': 'Upload Post Photo (optional)', '點擊選取相片': 'Tap to choose photo', '相片加載後將自動生成淡色、較隱性的「SecretRomm @使用者帳號」滿版 45 度浮水印；若原始圖片本身已有其他浮水印，系統不會自動移除。': 'After loading, the photo will receive a subtle full-image watermark. Existing watermarks will not be removed.',
      '標記為私密尺度照片 (Nsfw) 🔞': 'Mark as private-scale photo (NSFW) 🔞', '勾選後，大廳相片將預設以高精度毛玻璃覆蓋，點擊才會手動解密觀看。': 'When checked, hall photos are blurred by default and can be manually unlocked by tapping.', '關聯主題標籤 (至少勾選一項)': 'Related Topic Tags (select at least one)', '發布動態': 'Publish Post', '動態已發布': 'Post published', '貼文失敗: ': 'Post failed: ',
      '檢舉此條留言': 'Report this comment', '請選擇檢舉原因：': 'Select a report reason:', '垃圾訊息或惡意洗版': 'Spam or malicious flooding', '騷擾、人身攻擊或謾罵': 'Harassment, personal attack, or abuse', '不當內容或色情言語': 'Inappropriate content or sexual language', '提交檢舉': 'Submit Report', '您已經檢舉過此條留言了！': 'You have already reported this comment.', '留言檢舉已受理': 'Comment report received', '留言檢舉提交成功！': 'Comment report submitted.',
      '檢舉此篇動態': 'Report this post', '請選擇檢舉原因，我們將在後台派專員審核此內容：': 'Select a report reason. Our team will review this content.', '未標記敏感內容 (Nsfw/露骨)': 'Unmarked sensitive content (NSFW/explicit)', '盜用照片、冒充他人身分': 'Photo theft or impersonation', '您已經檢舉過此篇動態了！': 'You have already reported this post.', '貼文檢舉已受理': 'Post report received', '檢舉已提交成功，管理團隊會儘速審查此動態！': 'Report submitted. The admin team will review this post as soon as possible.', '檢舉提交失敗，請重試': 'Report submission failed. Please try again.',
      '請填寫動態內容或選取要發布的照片！': 'Enter post content or choose a photo to publish.', '請至少勾選一項主題標籤！': 'Select at least one topic tag.', '伺服器尚未完成連線，暫時無法發布動態。': 'The server is not ready. Posting is temporarily unavailable.', '伺服器尚未完成連線，暫時無法提交檢舉。': 'The server is not ready. Report submission is temporarily unavailable.', '浮水印注入與圖像優化完成': 'Watermark and image optimization complete.', '動態照片處理失敗，請換一張試試！': 'Post photo processing failed. Try another image.', '單張圖片上限為 8MB。': 'A single image can be up to 8MB.', '僅支援 JPG、PNG、WebP 圖片格式。': 'Only JPG, PNG, and WebP images are supported.'
    },
    'zh-CN': {
      'Full Menu': '完整功能表', '完整功能表': '完整功能表', '聲音播放': '声音播放', '熱門標籤': '热门标签', 'Bgm Audio': '背景音乐', 'Audio Muted': '声音已关闭', 'Premium Vip Lounge': '高级贵宾厅',
      'Publish Secret': '发布 Secret', '發布近期動態。發布相片時將自動生成淡色、較隱性的「SecretRomm @使用者帳號」滿版 45 度浮水印；若原始圖片本身已有其他浮水印，系統不會自動移除。': '发布近期动态。发布相片时会自动生成淡色、较隐性的「SecretRoom @使用者账号」满版 45 度水印；若原始图片已有其他水印，系统不会自动移除。',
      '動態內容描述 (選填)': '动态内容描述（选填）', '分享當下的健美重訓成果 or 私密心情...': '分享当下的健美重训成果或私密心情...', '加載動態照片 (選填)': '加载动态照片（选填）', '點擊選取相片': '点击选取相片', '標記為私密尺度照片 (Nsfw) 🔞': '标记为私密尺度照片 (NSFW) 🔞', '勾選後，大廳相片將預設以高精度毛玻璃覆蓋，點擊才會手動解密觀看。': '勾选后，大厅相片将默认以高精度毛玻璃覆盖，点击才会手动解密观看。', '關聯主題標籤 (至少勾選一項)': '关联主题标签（至少勾选一项）', '發布動態': '发布动态', '動態已發布': '动态已发布', '貼文失敗: ': '贴文失败：',
      '檢舉此條留言': '举报此条留言', '請選擇檢舉原因：': '请选择举报原因：', '垃圾訊息或惡意洗版': '垃圾信息或恶意刷屏', '騷擾、人身攻擊或謾罵': '骚扰、人身攻击或谩骂', '不當內容或色情言語': '不当内容或色情言语', '提交檢舉': '提交举报', '您已經檢舉過此條留言了！': '你已经举报过此条留言了！', '留言檢舉已受理': '留言举报已受理', '留言檢舉提交成功！': '留言举报提交成功！',
      '檢舉此篇動態': '举报此篇动态', '請選擇檢舉原因，我們將在後台派專員審核此內容：': '请选择举报原因，我们将在后台派专员审核此内容：', '未標記敏感內容 (Nsfw/露骨)': '未标记敏感内容 (NSFW/露骨)', '盜用照片、冒充他人身分': '盗用照片、冒充他人身份', '您已經檢舉過此篇動態了！': '你已经举报过此篇动态了！', '貼文檢舉已受理': '贴文举报已受理', '檢舉已提交成功，管理團隊會儘速審查此動態！': '举报已提交成功，管理团队会尽快审核此动态！', '檢舉提交失敗，請重試': '举报提交失败，请重试',
      '請填寫動態內容或選取要發布的照片！': '请填写动态内容或选取要发布的照片！', '請至少勾選一項主題標籤！': '请至少勾选一项主题标签！', '伺服器尚未完成連線，暫時無法發布動態。': '服务器尚未完成连接，暂时无法发布动态。', '伺服器尚未完成連線，暫時無法提交檢舉。': '服务器尚未完成连接，暂时无法提交举报。', '浮水印注入與圖像優化完成': '水印注入与图像优化完成', '動態照片處理失敗，請換一張試試！': '动态照片处理失败，请换一张试试！', '單張圖片上限為 8MB。': '单张图片上限为 8MB。', '僅支援 JPG、PNG、WebP 圖片格式。': '仅支持 JPG、PNG、WebP 图片格式。'
    },
    ja: {
      'Full Menu': 'フルメニュー', '完整功能表': 'フルメニュー', '聲音播放': '音声再生', '熱門標籤': '人気タグ', 'Bgm Audio': 'BGM', 'Audio Muted': '音声オフ', 'Premium Vip Lounge': 'Premium VIP Lounge',
      'Publish Secret': 'Secret を投稿', '發布近期動態。發布相片時將自動生成淡色、較隱性的「SecretRomm @使用者帳號」滿版 45 度浮水印；若原始圖片本身已有其他浮水印，系統不會自動移除。': '最近の投稿を作成します。写真には薄い45度の全面ウォーターマークが自動で追加されます。既存のウォーターマークは削除されません。',
      '動態內容描述 (選填)': '投稿内容（任意）', '分享當下的健美重訓成果 or 私密心情...': 'トレーニング成果やプライベートな気分を共有...', '加載動態照片 (選填)': '投稿写真を追加（任意）', '點擊選取相片': 'タップして写真を選択', '標記為私密尺度照片 (Nsfw) 🔞': 'NSFW写真としてマーク 🔞', '勾選後，大廳相片將預設以高精度毛玻璃覆蓋，點擊才會手動解密觀看。': '選択すると、ホール内の写真は既定で強いぼかし表示になり、タップ後に表示できます。', '關聯主題標籤 (至少勾選一項)': '関連タグ（最低1つ選択）', '發布動態': '投稿する', '動態已發布': '投稿しました', '貼文失敗: ': '投稿に失敗しました：',
      '檢舉此條留言': 'このコメントを通報', '請選擇檢舉原因：': '通報理由を選択してください：', '垃圾訊息或惡意洗版': 'スパムまたは悪質な連投', '騷擾、人身攻擊或謾罵': '嫌がらせ、個人攻撃、暴言', '不當內容或色情言語': '不適切な内容または性的な表現', '提交檢舉': '通報を送信', '您已經檢舉過此條留言了！': 'このコメントはすでに通報済みです。', '留言檢舉已受理': 'コメント通報を受け付けました', '留言檢舉提交成功！': 'コメント通報を送信しました。',
      '檢舉此篇動態': 'この投稿を通報', '請選擇檢舉原因，我們將在後台派專員審核此內容：': '通報理由を選択してください。担当者が内容を審査します。', '未標記敏感內容 (Nsfw/露骨)': '未分類のセンシティブ内容（NSFW/露骨）', '盜用照片、冒充他人身分': '写真の盗用またはなりすまし', '您已經檢舉過此篇動態了！': 'この投稿はすでに通報済みです。', '貼文檢舉已受理': '投稿通報を受け付けました', '檢舉已提交成功，管理團隊會儘速審查此動態！': '通報を送信しました。管理チームが確認します。', '檢舉提交失敗，請重試': '通報の送信に失敗しました。もう一度お試しください。',
      '請填寫動態內容或選取要發布的照片！': '投稿内容を入力するか、写真を選択してください。', '請至少勾選一項主題標籤！': 'タグを最低1つ選択してください。', '伺服器尚未完成連線，暫時無法發布動態。': 'サーバー準備中のため、現在投稿できません。', '伺服器尚未完成連線，暫時無法提交檢舉。': 'サーバー準備中のため、現在通報できません。', '浮水印注入與圖像優化完成': 'ウォーターマークと画像最適化が完了しました', '動態照片處理失敗，請換一張試試！': '投稿写真の処理に失敗しました。別の写真をお試しください。', '單張圖片上限為 8MB。': '画像1枚の上限は8MBです。', '僅支援 JPG、PNG、WebP 圖片格式。': 'JPG、PNG、WebP 画像のみ対応しています。'
    },
    ko: {
      'Full Menu': '전체 메뉴', '完整功能表': '전체 메뉴', '聲音播放': '오디오 재생', '熱門標籤': '인기 태그', 'Bgm Audio': 'BGM', 'Audio Muted': '음소거', 'Premium Vip Lounge': 'Premium VIP Lounge',
      'Publish Secret': 'Secret 게시', '發布近期動態。發布相片時將自動生成淡色、較隱性的「SecretRomm @使用者帳號」滿版 45 度浮水印；若原始圖片本身已有其他浮水印，系統不會自動移除。': '최근 게시물을 작성합니다. 사진에는 은은한 45도 전체 워터마크가 자동으로 추가되며, 기존 워터마크는 제거되지 않습니다.',
      '動態內容描述 (選填)': '게시물 설명(선택)', '分享當下的健美重訓成果 or 私密心情...': '운동 성과나 개인적인 기분을 공유하세요...', '加載動態照片 (選填)': '게시물 사진 추가(선택)', '點擊選取相片': '탭하여 사진 선택', '標記為私密尺度照片 (Nsfw) 🔞': 'NSFW 사진으로 표시 🔞', '勾選後，大廳相片將預設以高精度毛玻璃覆蓋，點擊才會手動解密觀看。': '선택하면 홀 사진은 기본적으로 강한 블러 처리되며 탭해야 볼 수 있습니다.', '關聯主題標籤 (至少勾選一項)': '관련 주제 태그(최소 1개 선택)', '發布動態': '게시', '動態已發布': '게시되었습니다', '貼文失敗: ': '게시 실패: ',
      '檢舉此條留言': '이 댓글 신고', '請選擇檢舉原因：': '신고 사유를 선택하세요:', '垃圾訊息或惡意洗版': '스팸 또는 악성 도배', '騷擾、人身攻擊或謾罵': '괴롭힘, 인신공격 또는 욕설', '不當內容或色情言語': '부적절한 내용 또는 성적 표현', '提交檢舉': '신고 제출', '您已經檢舉過此條留言了！': '이미 이 댓글을 신고했습니다.', '留言檢舉已受理': '댓글 신고가 접수되었습니다', '留言檢舉提交成功！': '댓글 신고가 제출되었습니다.',
      '檢舉此篇動態': '이 게시물 신고', '請選擇檢舉原因，我們將在後台派專員審核此內容：': '신고 사유를 선택하세요. 담당자가 이 내용을 검토합니다.', '未標記敏感內容 (Nsfw/露骨)': '민감한 내용 미표시(NSFW/노골적)', '盜用照片、冒充他人身分': '사진 도용 또는 사칭', '您已經檢舉過此篇動態了！': '이미 이 게시물을 신고했습니다.', '貼文檢舉已受理': '게시물 신고가 접수되었습니다', '檢舉已提交成功，管理團隊會儘速審查此動態！': '신고가 제출되었습니다. 관리팀이 검토합니다.', '檢舉提交失敗，請重試': '신고 제출에 실패했습니다. 다시 시도하세요.',
      '請填寫動態內容或選取要發布的照片！': '게시물 내용을 입력하거나 사진을 선택하세요.', '請至少勾選一項主題標籤！': '주제 태그를 최소 1개 선택하세요.', '伺服器尚未完成連線，暫時無法發布動態。': '서버가 아직 준비되지 않아 게시할 수 없습니다.', '伺服器尚未完成連線，暫時無法提交檢舉。': '서버가 아직 준비되지 않아 신고할 수 없습니다.', '浮水印注入與圖像優化完成': '워터마크와 이미지 최적화 완료', '動態照片處理失敗，請換一張試試！': '게시물 사진 처리에 실패했습니다. 다른 사진을 시도하세요.', '單張圖片上限為 8MB。': '이미지 1장의 최대 크기는 8MB입니다.', '僅支援 JPG、PNG、WebP 圖片格式。': 'JPG, PNG, WebP 이미지 형식만 지원됩니다.'
    }
  };

  function cleanText(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function routeInfo() {
    const parts = location.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex(p => ROUTE_CODES.includes(p) || p === 'zh-TW');
    const route = idx >= 0 ? parts[idx] : '';
    const baseParts = idx >= 0 ? parts.slice(0, idx) : parts;
    const isFile = baseParts[baseParts.length - 1]?.includes('.');
    const base = '/' + (isFile ? baseParts.slice(0, -1) : baseParts).join('/');
    return { route, base: base === '/' ? '' : base };
  }
  function normalizeLang(value) { return SUPPORTED[value] || DEFAULT_LANG; }
  function currentLang() {
    const urlLang = new URL(location.href).searchParams.get('lang');
    if (urlLang && SUPPORTED[urlLang]) return normalizeLang(urlLang);
    const route = routeInfo().route;
    if (route && SUPPORTED[route]) return normalizeLang(route);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && Object.values(SUPPORTED).includes(saved)) return saved;
    return DEFAULT_LANG;
  }
  function routeCode(lang) { return lang === 'zh-TW' ? 'zh' : lang; }
  function routeUrl(code) {
    const info = routeInfo();
    const base = info.base || (location.pathname.startsWith('/SecretRoom') ? '/SecretRoom' : '');
    return `${base}/${code}/`;
  }
  function skipTextParent(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.closest('#sr-i18n-switcher,.notranslate,[translate="no"],script,style,noscript,textarea,select,option,input,svg,canvas,video,audio')) return true;
    if (el.closest('[contenteditable="true"]')) return true;
    if (el.classList && Array.from(el.classList).some(c => c === 'fa' || c.startsWith('fa-'))) return true;
    return false;
  }
  function skipAttrElement(el) {
    if (!el || el.nodeType !== 1) return true;
    if (el.closest('#sr-i18n-switcher,.notranslate,[translate="no"],script,style,noscript,svg,canvas,video,audio')) return true;
    return false;
  }
  function protect(text) {
    const key = cleanText(text);
    return /^SecretRoom$/i.test(key) || /^S\+\s*\.\s*S\s*\.\s*G$/i.test(key) || /^(D\.G|C\.G|B\.G|A\.G|S\.G|S\+\.G|SSR\.G|Z\.G)$/i.test(key);
  }
  function lookup(text) {
    const key = cleanText(text);
    if (!key || protect(key)) return text;
    if (state.dict[key]) return state.dict[key];
    let result = key;
    for (const src of state.keys) {
      if (src.length < 2 || !result.includes(src) || protect(src)) continue;
      result = result.split(src).join(state.dict[src]);
    }
    return result === key ? text : result;
  }
  function translateTextNode(node) {
    if (!node || !node.parentElement || skipTextParent(node.parentElement)) return;
    if (!node.__srOriginalText) node.__srOriginalText = node.nodeValue;
    const raw = node.__srOriginalText;
    const trim = cleanText(raw);
    if (!trim) return;
    node.nodeValue = raw.replace(trim, lookup(trim));
  }
  function dataKeyFor(attr) { return `srI18nOriginal${attr.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase())}`; }
  function translateAttribute(el, attr) {
    if (!el || skipAttrElement(el)) return;
    const value = el.getAttribute(attr);
    if (!value) return;
    const dataKey = dataKeyFor(attr);
    if (el.dataset[dataKey] === undefined) el.dataset[dataKey] = value;
    el.setAttribute(attr, lookup(el.dataset[dataKey]));
  }
  function apply(root = document.body) {
    if (state.applying || !root) return;
    state.applying = true;
    try {
      document.documentElement.lang = state.lang;
      document.documentElement.classList.toggle('sr-i18n-translated', state.lang !== DEFAULT_LANG);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent || skipTextParent(parent)) return NodeFilter.FILTER_REJECT;
          const text = cleanText(node.nodeValue);
          if (!text || text.length > 1400) return NodeFilter.FILTER_REJECT;
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
    } finally { state.applying = false; }
  }
  async function loadDict(lang) {
    if (lang === DEFAULT_LANG) return EXTRA[DEFAULT_LANG] || {};
    const code = routeCode(lang);
    try {
      const response = await fetch(`i18n/${code}.json?v=20260709-i18n-routes-v6`, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { ...(await response.json()), ...(EXTRA[lang] || {}) };
    } catch (error) {
      console.warn('[SecretRoom i18n] dictionary load failed:', error);
      return EXTRA[lang] || {};
    }
  }
  function goToLanguage(code) {
    localStorage.setItem(STORAGE_KEY, normalizeLang(code));
    location.href = routeUrl(code);
  }
  function buildSwitcher() {
    if (document.getElementById('sr-i18n-switcher')) return;
    const wrap = document.createElement('div');
    wrap.id = 'sr-i18n-switcher';
    wrap.className = 'fixed right-4 bottom-4 z-[160] rounded-3xl border border-amber-500/25 bg-slate-950/92 px-4 py-3 shadow-2xl backdrop-blur-md notranslate';
    wrap.setAttribute('translate', 'no');
    wrap.innerHTML = `
      <div class="sr-i18n-title text-[10px] font-black tracking-[0.18em] text-amber-400/80 mb-2"><i class="fa-solid fa-globe text-amber-400 text-xs mr-1.5"></i>Language</div>
      <select id="sr-i18n-select" class="w-full bg-slate-950/70 border border-amber-500/20 rounded-2xl px-3 py-2 text-[12px] font-black text-amber-200 outline-none cursor-pointer">
        ${ROUTE_CODES.map(code => `<option value="${code}">${LABELS[code]}</option>`).join('')}
      </select>
      <button id="sr-i18n-mobile-globe" type="button" aria-label="Language" title="Language"><i class="fa-solid fa-globe"></i></button>
      <div id="sr-i18n-mobile-menu">${ROUTE_CODES.map(code => `<button type="button" data-lang="${code}">${LABELS[code]}</button>`).join('')}</div>`;
    document.body.appendChild(wrap);
    const select = document.getElementById('sr-i18n-select');
    const globe = document.getElementById('sr-i18n-mobile-globe');
    const menu = document.getElementById('sr-i18n-mobile-menu');
    select.value = routeCode(state.lang);
    select.onchange = () => goToLanguage(select.value);
    globe.onclick = (event) => { event.stopPropagation(); wrap.classList.toggle('sr-i18n-open'); };
    menu.querySelectorAll('[data-lang]').forEach(btn => btn.onclick = () => goToLanguage(btn.dataset.lang));
    document.addEventListener('click', event => { if (!wrap.contains(event.target)) wrap.classList.remove('sr-i18n-open'); });
    placeSwitcher();
  }
  function findNotificationTab() {
    return document.getElementById('aside-tab-notifications') || Array.from(document.querySelectorAll('button,a,div')).find(el => cleanText(el).includes('通知') && /bell|notification/i.test(String(el.id || el.className || '')));
  }
  function placeSwitcher() {
    const wrap = document.getElementById('sr-i18n-switcher');
    if (!wrap) return;
    if (window.matchMedia(MOBILE_QUERY).matches) {
      const target = findNotificationTab();
      if (target?.parentElement && wrap.parentElement !== target.parentElement) target.insertAdjacentElement('afterend', wrap);
      wrap.dataset.mobilePlacement = target ? 'notifications' : 'fallback';
    } else {
      if (wrap.parentElement !== document.body) document.body.appendChild(wrap);
      wrap.dataset.mobilePlacement = 'desktop';
      wrap.classList.remove('sr-i18n-open');
    }
  }
  function bgmAudioList() {
    const list = Array.from(document.querySelectorAll('audio'));
    const bgm = window.luxuryBgm?.audio;
    if (bgm && !list.includes(bgm)) list.push(bgm);
    return list.filter(Boolean);
  }
  function bgmMuted() { return localStorage.getItem('sr_bgm_muted') === '1'; }
  function setBgmMuted(muted) {
    localStorage.setItem('sr_bgm_muted', muted ? '1' : '0');
    if (window.luxuryBgm) window.luxuryBgm.isPlaying = !muted;
    bgmAudioList().forEach(audio => {
      try {
        audio.muted = muted;
        audio.volume = muted ? 0 : Math.max(Number(audio.dataset.srVolume || 0.45), 0.25);
        if (muted) { audio.pause(); audio.currentTime = audio.currentTime || 0; }
        else audio.play?.().catch(() => {});
      } catch (_) {}
    });
    const icon = document.getElementById('bgm-icon');
    if (icon) icon.className = `fa-solid ${muted ? 'fa-volume-xmark' : 'fa-play'} text-[9px]`;
    const status = document.getElementById('bgm-status-text');
    if (status) status.textContent = muted ? 'Audio Muted' : 'Bgm Audio';
    const menuText = document.getElementById('mobile-menu-bgm-text');
    if (menuText) menuText.textContent = muted ? 'Audio Muted' : 'Premium Vip Lounge';
    document.getElementById('bgm-controller-widget')?.classList.toggle('sr-bgm-muted', muted);
  }
  function setupBgmFix() {
    document.addEventListener('click', event => {
      const hit = event.target?.closest?.('#bgm-toggle-btn,#bgm-controller-widget,#mobile-menu-bgm-toggle');
      if (!hit) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setBgmMuted(!bgmMuted());
    }, true);
    setInterval(() => { if (bgmMuted()) setBgmMuted(true); }, 900);
    setTimeout(() => setBgmMuted(bgmMuted()), 350);
  }

  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;650;700;800;900&family=Noto+Sans+TC:wght@300;400;500;700;900&family=Noto+Sans+JP:wght@300;400;500;700;900&family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap');
    :root{--sr-i18n-font:Inter,"Noto Sans TC","Noto Sans JP","Noto Sans KR",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
    html.sr-i18n-translated body,html.sr-i18n-translated button,html.sr-i18n-translated input,html.sr-i18n-translated textarea,html.sr-i18n-translated select,html.sr-i18n-translated option,html.sr-i18n-translated p,html.sr-i18n-translated span,html.sr-i18n-translated div,html.sr-i18n-translated h1,html.sr-i18n-translated h2,html.sr-i18n-translated h3,html.sr-i18n-translated h4,html.sr-i18n-translated label{font-family:var(--sr-i18n-font)!important;}
    html.sr-i18n-translated i.fa-solid,html.sr-i18n-translated i.fa-regular,html.sr-i18n-translated i.fa-brands{font-family:"Font Awesome 6 Free","Font Awesome 6 Brands"!important;}
    #sr-i18n-switcher{width:14.75rem!important;font-family:var(--sr-i18n-font)!important;}
    #sr-i18n-switcher *{font-family:inherit!important;}
    #sr-i18n-select option{background:#020204;color:#f8e7b0;}
    #sr-i18n-mobile-globe,#sr-i18n-mobile-menu{display:none;}
    #bgm-controller-widget.sr-bgm-muted{opacity:.72!important;filter:saturate(.72)!important;}
    @media(max-width:768px){
      #sr-i18n-switcher{position:relative!important;right:auto!important;bottom:auto!important;top:auto!important;left:auto!important;z-index:80!important;width:auto!important;min-width:0!important;max-width:none!important;padding:0!important;margin:0!important;border:0!important;background:transparent!important;box-shadow:none!important;backdrop-filter:none!important;}
      #sr-i18n-switcher .sr-i18n-title,#sr-i18n-select{display:none!important;}
      #sr-i18n-mobile-globe{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:2.35rem!important;height:2.35rem!important;border-radius:999px!important;border:1px solid rgba(245,158,11,.22)!important;background:rgba(15,23,42,.72)!important;color:#fbbf24!important;font-size:1rem!important;}
      #sr-i18n-mobile-menu{position:absolute!important;right:0!important;bottom:calc(100% + .5rem)!important;width:12.25rem!important;max-height:16rem!important;overflow:auto!important;padding:.45rem!important;border-radius:1rem!important;border:1px solid rgba(245,158,11,.28)!important;background:rgba(2,6,23,.96)!important;box-shadow:0 18px 45px rgba(0,0,0,.48)!important;z-index:180!important;}
      #sr-i18n-switcher.sr-i18n-open #sr-i18n-mobile-menu{display:grid!important;gap:.25rem!important;}
      #sr-i18n-mobile-menu button{width:100%!important;text-align:left!important;border-radius:.75rem!important;padding:.55rem .65rem!important;color:#f8e7b0!important;font-size:11px!important;font-weight:800!important;background:transparent!important;}
      #sr-i18n-mobile-menu button:hover{background:rgba(245,158,11,.12)!important;}
    }
  `;
  document.head.appendChild(style);

  (async () => {
    state.lang = currentLang();
    localStorage.setItem(STORAGE_KEY, state.lang);
    state.dict = await loadDict(state.lang);
    state.keys = Object.keys(state.dict).sort((a, b) => b.length - a.length);
    buildSwitcher();
    setupBgmFix();
    apply();
    const observer = new MutationObserver(() => { setTimeout(() => apply(), 80); setTimeout(placeSwitcher, 100); });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', placeSwitcher);
    setInterval(() => { apply(); placeSwitcher(); }, 1600);
  })();
})();