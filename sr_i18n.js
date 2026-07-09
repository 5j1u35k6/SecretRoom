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
  const BRAND_PATTERNS = [/SecretRoom/i, /S\+\s*\.\s*S\s*\.\s*G/i, /S\+\.S\.G/i, /D\.G|C\.G|B\.G|A\.G|S\.G|S\+\.G|SSR\.G|Z\.G/i];
  const MOBILE_QUERY = '(max-width: 768px)';
  const state = { lang: DEFAULT_LANG, dict: {}, keys: [], applying: false };

  const CORE_PATCHES = {
    'zh-CN': {
      '請輸入您的帳號與密碼進行登入': '请输入你的账号与密码进行登录',
      '進入俱樂部': '进入俱乐部',
      '伺服器尚未完成連線，請稍後再登入。': '服务器尚未完成连接，请稍后再登录。',
      '驗證中...': '验证中...',
      '登入驗證逾時，請檢查網路或稍後重試。': '登录验证超时，请检查网络或稍后重试。',
      '登入成功！正在載入俱樂部...': '登录成功！正在载入俱乐部...',
      '帳號狀態尚未啟用，請等待審核。': '账号状态尚未启用，请等待审核。',
      '驗證異常，請稍後重試。': '验证异常，请稍后重试。',
      '返回首頁': '返回首页',
      '請填寫以下註冊資料。我們將人工審查，以保障俱樂部會員隱私與安全。': '请填写以下注册资料。我们将进行人工审核，以保障俱乐部会员隐私与安全。',
      '上傳個人真實頭像照片': '上传个人真实头像照片',
      '僅限 Jpeg/Png，支援最大 10 Mb': '仅限 Jpeg/Png，最大支持 10 MB',
      '選擇檔案': '选择文件',
      '請上傳本人真實正面清晰之照片，嚴禁風景、卡通 or 不合規相片。': '请上传本人真实正面清晰照片，严禁风景、卡通或不合规照片。',
      '帳號密碼設定': '账号密码设置',
      '設定會員帳號 (注意中英數)': '设置会员账号（注意中英数字）',
      '綁定通知信箱': '绑定通知邮箱',
      '審核結果、黃金會員、檢舉處理與頭像更換結果將寄送到此信箱。': '审核结果、黄金会员、举报处理与头像更换结果将寄送到此邮箱。',
      '設定登入密碼': '设置登录密码',
      '密碼設定條件：': '密码设置条件：',
      '密碼長度達 8 個字元以上': '密码长度达到 8 个字符以上',
      '包含至少一個大寫英文字母': '包含至少一个大写英文字母',
      '包含至少一個特殊符號': '包含至少一个特殊符号',
      '會員公開資料': '会员公开资料',
      '俱樂部公開暱稱': '俱乐部公开昵称',
      '出生年月日 (須滿 18 歲)': '出生年月日（须满 18 岁）',
      '個人概要': '个人概要',
      '感興趣的主題與偏好 (至少勾選一項)': '感兴趣的主题与偏好（至少勾选一项）',
      '我們將依此標籤為您進行動態與合適的帳號推薦配對。': '我们将依据这些标签为你推荐动态与合适账号。',
      '送出註冊與會員審核': '送出注册与会员审核',
      '大頭照檔案大小超過 10 Mb 限制！': '大头照文件大小超过 10 MB 限制！',
      '頭像智慧壓縮與優化完成': '头像智能压缩与优化完成',
      '大頭照解析優化失敗，請換一張試試！': '大头照解析优化失败，请换一张试试！',
      '請填寫有效的通知信箱，未來審核與平台通知會寄送到此信箱。': '请填写有效的通知邮箱，未来审核与平台通知会寄送到此邮箱。',
      '密碼未滿足強度條件設定！': '密码未满足强度条件设置！',
      '請上傳個人真實頭像供審核查驗。': '请上传个人真实头像供审核查验。',
      '請至少勾選一項主題偏好！': '请至少勾选一项主题偏好！',
      '伺服器連線超時，暫時無法提交。': '服务器连接超时，暂时无法提交。',
      '該帳號已存在！請更換其他設定帳號。': '该账号已存在！请更换其他设置账号。',
      '申請資料提交成功！請靜待審核查驗。': '申请资料提交成功！请静待审核查验。',
      'SecretRoom 為保障所有帳號的絕對隱私防護，一律採高規格人工手動審核。請您稍後重新整理確認狀態。': 'SecretRoom 为保障所有账号的绝对隐私防护，一律采用高规格人工手动审核。请稍后刷新确认状态。',
      '註冊概要資訊': '注册概要信息',
      '您的帳號:': '你的账号：',
      '您的名稱:': '你的名称：',
      '重新整理確認狀態': '刷新确认状态',
      '很遺憾，您的加入申請未能通過管理審查團隊的查核。': '很遗憾，你的加入申请未能通过管理审查团队的查核。',
      '退件具體理由': '退件具体理由',
      '修正資料並重新提交送審': '修正资料并重新提交送审',
      '為開啟高級警報防護與即時密語傳輸，請在下方透過 Telegram 官方進行安全登入綁定。': '为开启高级警报防护与即时密语传输，请在下方通过 Telegram 官方进行安全登录绑定。',
      '請點擊下方按鈕以安全登入並關聯您的 Telegram 帳號：': '请点击下方按钮以安全登录并关联你的 Telegram 账号：',
      '正在加載官方驗證入口...': '正在加载官方验证入口...',
      'Telegram 授權驗證失敗，請重試！': 'Telegram 授权验证失败，请重试！',
      'Telegram 官方授權與防護網已安全啟用 ✓': 'Telegram 官方授权与防护网已安全启用 ✓',
      '綁定資料傳輸失敗：': '绑定资料传输失败：',
      '線上活躍帳號': '线上活跃账号',
      '正在更新線上帳號...': '正在更新线上账号...',
      '目前尚無其他活躍帳號': '目前暂无其他活跃账号',
      '已安全退出 SecretRoom 俱樂部。': '已安全退出 SecretRoom 俱乐部。',
      '全部類型': '全部类型',
      '官方通知': '官方通知',
      '檢舉進度': '举报进度',
      '頭像審核': '头像审核',
      '帳號安全': '账号安全',
      '系統提醒': '系统提醒',
      '大頭照更換審核中': '大头照更换审核中',
      '大頭照更換已通過': '大头照更换已通过',
      '大頭照更換未通過': '大头照更换未通过',
      '黃金 Spec 認證審核中': '黄金 Spec 认证审核中',
      '黃金 Spec 認證已通過': '黄金 Spec 认证已通过',
      '黃金 Spec 認證未通過': '黄金 Spec 认证未通过',
      '全體會員': '全体会员',
      '個人通知': '个人通知',
      '未讀訊息': '未读消息',
      '已讀訊息': '已读消息',
      '請查看最新平台狀態。': '请查看最新平台状态。',
      '俱樂部成員': '俱乐部成员',
      '未尋得相符動態貼文': '未找到相符动态贴文',
      '未尋得相符同好': '未找到相符同好',
      '發布相片': '发布相片',
      '顯示全體祕密大廳': '显示全体秘密大厅',
      '目前大廳尚無此偏好的祕密動態': '目前大厅暂无此偏好的秘密动态',
      '點擊分享動態，成為第一個探索本主題的創始同好吧！': '点击分享动态，成为第一个探索本主题的创始同好吧！'
    },
    'ja': {
      '請輸入您的帳號與密碼進行登入': 'アカウントとパスワードを入力してログインしてください',
      '進入俱樂部': 'クラブに入る',
      '伺服器尚未完成連線，請稍後再登入。': 'サーバー接続がまだ完了していません。後でもう一度ログインしてください。',
      '驗證中...': '確認中...',
      '登入驗證逾時，請檢查網路或稍後重試。': 'ログイン確認がタイムアウトしました。ネットワークを確認するか、後でもう一度お試しください。',
      '登入成功！正在載入俱樂部...': 'ログインしました。クラブを読み込んでいます...',
      '帳號狀態尚未啟用，請等待審核。': 'アカウントはまだ有効化されていません。審査をお待ちください。',
      '返回首頁': 'ホームに戻る',
      '請填寫以下註冊資料。我們將人工審查，以保障俱樂部會員隱私與安全。': '以下の登録情報を入力してください。会員のプライバシーと安全を守るため、手動で審査します。',
      '上傳個人真實頭像照片': '本人の実際のプロフィール写真をアップロード',
      '選擇檔案': 'ファイルを選択',
      '帳號密碼設定': 'アカウントとパスワード設定',
      '設定會員帳號 (注意中英數)': '会員アカウントを設定（英数字）',
      '綁定通知信箱': '通知メールを連携',
      '設定登入密碼': 'ログインパスワードを設定',
      '密碼設定條件：': 'パスワード条件：',
      '密碼長度達 8 個字元以上': '8文字以上',
      '包含至少一個大寫英文字母': '大文字英字を1文字以上含む',
      '包含至少一個特殊符號': '特殊記号を1文字以上含む',
      '會員公開資料': '公開会員情報',
      '俱樂部公開暱稱': 'クラブ表示名',
      '出生年月日 (須滿 18 歲)': '生年月日（18歳以上）',
      '個人概要': 'プロフィール概要',
      '感興趣的主題與偏好 (至少勾選一項)': '興味のあるテーマと好み（最低1つ選択）',
      '送出註冊與會員審核': '登録と会員審査を送信',
      '大頭照檔案大小超過 10 Mb 限制！': 'プロフィール写真のファイルサイズが10MBを超えています。',
      '頭像智慧壓縮與優化完成': 'プロフィール写真の圧縮と最適化が完了しました',
      '密碼未滿足強度條件設定！': 'パスワードが強度条件を満たしていません。',
      '請至少勾選一項主題偏好！': 'テーマの好みを最低1つ選択してください。',
      '申請資料提交成功！請靜待審核查驗。': '申請情報を送信しました。審査をお待ちください。',
      '註冊概要資訊': '登録概要',
      '重新整理確認狀態': 'ステータスを更新',
      '退件具體理由': '具体的な却下理由',
      '修正資料並重新提交送審': '情報を修正して再送信',
      '線上活躍帳號': 'オンライン中のアカウント',
      '目前尚無其他活躍帳號': '他のアクティブなアカウントはありません',
      '已安全退出 SecretRoom 俱樂部。': 'SecretRoom クラブから安全に退出しました。',
      '全部類型': 'すべての種類',
      '官方通知': '公式通知',
      '檢舉進度': '通報進捗',
      '頭像審核': 'プロフィール画像審査',
      '帳號安全': 'アカウント安全',
      '系統提醒': 'システム通知',
      '未讀訊息': '未読メッセージ',
      '已讀訊息': '既読メッセージ',
      '俱樂部成員': 'クラブメンバー',
      '未尋得相符動態貼文': '一致する投稿が見つかりません',
      '未尋得相符同好': '一致する会員が見つかりません',
      '顯示全體祕密大廳': 'すべての秘密ホールを表示'
    },
    'ko': {
      '請輸入您的帳號與密碼進行登入': '계정과 비밀번호를 입력해 로그인하세요',
      '進入俱樂部': '클럽 입장',
      '伺服器尚未完成連線，請稍後再登入。': '서버 연결이 아직 완료되지 않았습니다. 잠시 후 다시 로그인하세요.',
      '驗證中...': '확인 중...',
      '登入驗證逾時，請檢查網路或稍後重試。': '로그인 확인 시간이 초과되었습니다. 네트워크를 확인하거나 나중에 다시 시도하세요.',
      '登入成功！正在載入俱樂部...': '로그인되었습니다. 클럽을 불러오는 중...',
      '帳號狀態尚未啟用，請等待審核。': '계정이 아직 활성화되지 않았습니다. 검토를 기다려 주세요.',
      '返回首頁': '홈으로 돌아가기',
      '請填寫以下註冊資料。我們將人工審查，以保障俱樂部會員隱私與安全。': '아래 등록 정보를 입력해 주세요. 회원의 개인정보와 안전을 보호하기 위해 수동 검토를 진행합니다.',
      '上傳個人真實頭像照片': '본인의 실제 프로필 사진 업로드',
      '選擇檔案': '파일 선택',
      '帳號密碼設定': '계정 및 비밀번호 설정',
      '設定會員帳號 (注意中英數)': '회원 계정 설정(영문/숫자)',
      '綁定通知信箱': '알림 이메일 연결',
      '設定登入密碼': '로그인 비밀번호 설정',
      '密碼設定條件：': '비밀번호 조건:',
      '密碼長度達 8 個字元以上': '8자 이상',
      '包含至少一個大寫英文字母': '대문자 1개 이상 포함',
      '包含至少一個特殊符號': '특수문자 1개 이상 포함',
      '會員公開資料': '공개 회원 정보',
      '俱樂部公開暱稱': '클럽 표시 닉네임',
      '出生年月日 (須滿 18 歲)': '생년월일(만 18세 이상)',
      '個人概要': '개인 요약',
      '感興趣的主題與偏好 (至少勾選一項)': '관심 주제 및 선호도(최소 1개 선택)',
      '送出註冊與會員審核': '등록 및 회원 검토 제출',
      '大頭照檔案大小超過 10 Mb 限制！': '프로필 사진 파일 크기가 10MB 제한을 초과했습니다.',
      '頭像智慧壓縮與優化完成': '프로필 사진 압축 및 최적화 완료',
      '密碼未滿足強度條件設定！': '비밀번호가 강도 조건을 충족하지 않습니다.',
      '請至少勾選一項主題偏好！': '주제 선호도를 최소 1개 선택하세요.',
      '申請資料提交成功！請靜待審核查驗。': '신청 정보가 제출되었습니다. 검토를 기다려 주세요.',
      '註冊概要資訊': '등록 요약',
      '重新整理確認狀態': '상태 새로고침',
      '退件具體理由': '구체적인 거절 사유',
      '修正資料並重新提交送審': '정보 수정 후 다시 제출',
      '線上活躍帳號': '온라인 활성 계정',
      '目前尚無其他活躍帳號': '아직 다른 활성 계정이 없습니다',
      '已安全退出 SecretRoom 俱樂部。': 'SecretRoom 클럽에서 안전하게 나갔습니다.',
      '全部類型': '모든 유형',
      '官方通知': '공식 알림',
      '檢舉進度': '신고 진행상황',
      '頭像審核': '프로필 사진 검토',
      '帳號安全': '계정 보안',
      '系統提醒': '시스템 알림',
      '未讀訊息': '읽지 않은 메시지',
      '已讀訊息': '읽은 메시지',
      '俱樂部成員': '클럽 회원',
      '未尋得相符動態貼文': '일치하는 게시물을 찾을 수 없습니다',
      '未尋得相符同好': '일치하는 회원을 찾을 수 없습니다',
      '顯示全體祕密大廳': '전체 비밀 홀 보기'
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
    const url = new URL(location.href);
    const queryLang = url.searchParams.get('lang');
    if (queryLang && SUPPORTED[queryLang]) return normalizeLang(queryLang);
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

  function skipElement(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.closest('#sr-i18n-switcher,.notranslate,[translate="no"],script,style,noscript,textarea,select,option,input,svg,canvas,video,audio')) return true;
    if (el.closest('[contenteditable="true"]')) return true;
    if (el.classList && Array.from(el.classList).some(c => c === 'fa' || c.startsWith('fa-'))) return true;
    return false;
  }

  function protect(text) { return BRAND_PATTERNS.some(re => re.test(text)); }

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
    if (!node || !node.parentElement || skipElement(node.parentElement)) return;
    if (!node.__srOriginalText) node.__srOriginalText = node.nodeValue;
    const raw = node.__srOriginalText;
    const trim = cleanText(raw);
    if (!trim) return;
    node.nodeValue = raw.replace(trim, lookup(trim));
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
          if (!text || text.length > 260) return NodeFilter.FILTER_REJECT;
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
    if (lang === DEFAULT_LANG) return CORE_PATCHES[DEFAULT_LANG] || {};
    const code = routeCode(lang);
    try {
      const response = await fetch(`i18n/${code}.json?v=20260709-i18n-routes-v4`, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { ...(await response.json()), ...(CORE_PATCHES[lang] || {}) };
    } catch (error) {
      console.warn('[SecretRoom i18n] dictionary load failed:', error);
      return CORE_PATCHES[lang] || {};
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
    const isMobile = window.matchMedia(MOBILE_QUERY).matches;
    if (isMobile) {
      const target = findNotificationTab();
      if (target?.parentElement && wrap.parentElement !== target.parentElement) target.insertAdjacentElement('afterend', wrap);
      wrap.dataset.mobilePlacement = target ? 'notifications' : 'fallback';
    } else {
      if (wrap.parentElement !== document.body) document.body.appendChild(wrap);
      wrap.dataset.mobilePlacement = 'desktop';
      wrap.classList.remove('sr-i18n-open');
    }
  }

  const style = document.createElement('style');
  style.textContent = `
    #sr-i18n-switcher{width:14.75rem!important;font-family:Inter,"Noto Serif TC","Noto Sans TC",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;}
    #sr-i18n-switcher *{font-family:inherit!important;}
    #sr-i18n-select option{background:#020204;color:#f8e7b0;}
    #sr-i18n-mobile-globe,#sr-i18n-mobile-menu{display:none;}
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
    apply();
    const observer = new MutationObserver(() => { setTimeout(() => apply(), 80); setTimeout(placeSwitcher, 100); });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', placeSwitcher);
    setInterval(() => { apply(); placeSwitcher(); }, 1600);
  })();
})();