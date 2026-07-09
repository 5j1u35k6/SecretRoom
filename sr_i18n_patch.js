// SecretRoom extended i18n patch
// Adds a second translation pass for scattered modal/toast strings left in app.js.
(() => {
  const DEFAULT = 'zh-TW';
  const pathLang = location.pathname.split('/').filter(Boolean).find(p => ['zh','zh-CN','en','ja','ko'].includes(p));
  const lang = pathLang === 'zh' ? 'zh-TW' : (pathLang || localStorage.getItem('sr_locale') || DEFAULT);
  if (lang === DEFAULT) return;

  const D = {
    en: {
      '填寫要變更的個人資訊，除頭像變更後需人工審核外，其餘欄位修改儲存後即會自動更新！': 'Edit your profile information. Avatar changes require manual review; other fields update after saving.',
      '變更個人大頭照': 'Change Personal Avatar',
      '變更大頭照需要管理團隊人工二次核定後才予以替換啟用。': 'Avatar changes require secondary manual approval before activation.',
      '個人暱稱': 'Nickname',
      '身體數據密碼規格': 'Private Body Data',
      '感興趣的主題與偏好標籤': 'Interested Topics and Preference Tags',
      '儲存變更': 'Save Changes',
      '新大頭照檔案大小超過 10 Mb 限制！': 'New avatar exceeds the 10 MB limit.',
      '新大頭照優化成功': 'New avatar optimized successfully.',
      '新大頭相片解析失敗！': 'New avatar photo processing failed.',
      '暱稱不能為空！': 'Nickname cannot be empty.',
      '請至少選擇一項感興趣的主題標籤！': 'Select at least one topic tag you are interested in.',
      '大頭照更換已送審': 'Avatar Change Submitted for Review',
      '您的新頭像已提交管理員審核，通過後會自動更新到個人頁面。': 'Your new avatar has been submitted for admin review and will update automatically after approval.',
      '個人資料已成功更新！': 'Profile updated successfully.',
      '更新失敗，請稍後重試: ': 'Update failed. Try again later: ',
      '請上傳帶有清楚尺規參考物（如捲尺、直尺）的實物測量證明照片。系統會自動覆蓋淡色、較隱性的「SecretRomm @使用者帳號」滿版 45 度浮水印；若原始圖片本身已有其他浮水印，系統不會自動移除。若通過黃金Spec認證將會自動開啟S+ . S . G功能，可查看其他通過黃金Spec會員之審核照。': 'Upload a clear measurement proof photo with a ruler or measuring tape. A subtle full-image watermark will be added automatically. Existing watermarks will not be removed. After Gold Spec approval, S+ . S . G access is enabled for approved member proof photos.',
      '點擊選取證明照片': 'Tap to choose proof photo',
      '支援 JPG、PNG、WebP，單張上限 8MB；照片需清晰包含尺規或可驗證參考物。': 'Supports JPG, PNG, and WebP. Max 8 MB per image. The photo must clearly include a ruler or verifiable reference.',
      '我了解若黃金 Spec 認證通過，審核照片將開放給其他已通過黃金 Spec 的 S+ . S . G 會員於站內查看；我也了解平台會加上 NSFW 提醒與 SecretRomm 浮水印，但仍需自行承擔私密照片上傳風險。': 'I understand that if Gold Spec verification is approved, the review photo can be viewed in-site by other Gold Spec approved S+ . S . G members. I also understand the platform adds an NSFW notice and SecretRoom watermark, but private photo upload risk remains my responsibility.',
      '提交規格核查申請': 'Submit Spec Verification',
      '請同意黃金 Spec 照片開放規則後再提交。': 'Agree to the Gold Spec photo access rules before submitting.',
      '請先上傳規格證明照片。': 'Upload a spec proof photo first.',
      '規格證明照片處理完成': 'Spec proof photo processed.',
      '規格證明照片處理失敗，請換一張試試！': 'Spec proof photo processing failed. Try another image.',
      '黃金 Spec 認證申請已送出': 'Gold Spec verification request submitted.',
      '請輸入會員帳號與註冊時綁定的通知信箱。系統會先比對既有會員資料，只有資料相符才會送出重新設定申請。': 'Enter your member account and the notification email used during registration. The system will verify existing member data before submitting the reset request.',
      '會員帳號 ID': 'Member Account ID',
      '註冊綁定信箱': 'Registered Email',
      '送出忘記密碼申請': 'Submit Password Reset Request',
      '請填寫帳號與註冊綁定信箱。': 'Enter your account and registered email.',
      '請輸入有效的 Email 格式。': 'Enter a valid email format.',
      '查無符合的會員帳號或綁定信箱，請確認後再送出。': 'No matching member account or registered email found. Check and submit again.',
      '此帳號尚未通過審核，無法使用忘記密碼功能。': 'This account is not approved yet, so password reset cannot be used.',
      '此帳號已有待處理的忘記密碼申請，請等待處理。': 'This account already has a pending password reset request. Please wait.',
      '忘記密碼申請已送出，請等待管理員處理。': 'Password reset request submitted. Please wait for admin processing.',
      '刪除留言失敗': 'Failed to delete comment',
      '留言已刪除 🔒': 'Comment deleted 🔒',
      '提交留言檢舉失敗': 'Failed to submit comment report',
      '提交檢舉失敗': 'Failed to submit report',
      '審查中': 'Under Review',
      '您提交的留言檢舉已進入安全審查佇列。檢舉原因：': 'Your comment report has entered the safety review queue. Reason: ',
      '您提交的貼文檢舉已進入安全審查佇列。檢舉原因：': 'Your post report has entered the safety review queue. Reason: '
    },
    'zh-CN': {
      '填寫要變更的個人資訊，除頭像變更後需人工審核外，其餘欄位修改儲存後即會自動更新！': '填写要变更的个人信息，除头像变更后需人工审核外，其余字段保存后会自动更新！',
      '變更個人大頭照': '变更个人头像', '變更大頭照需要管理團隊人工二次核定後才予以替換啟用。': '变更头像需要管理团队人工二次核定后才会替换启用。',
      '個人暱稱': '个人昵称', '身體數據密碼規格': '身体数据私密规格', '感興趣的主題與偏好標籤': '感兴趣的主题与偏好标签', '儲存變更': '保存变更',
      '新大頭照檔案大小超過 10 Mb 限制！': '新头像文件大小超过 10 MB 限制！', '新大頭照優化成功': '新头像优化成功', '新大頭相片解析失敗！': '新头像照片解析失败！', '暱稱不能為空！': '昵称不能为空！', '請至少選擇一項感興趣的主題標籤！': '请至少选择一项感兴趣的主题标签！',
      '大頭照更換已送審': '头像更换已送审', '您的新頭像已提交管理員審核，通過後會自動更新到個人頁面。': '你的新头像已提交管理员审核，通过后会自动更新到个人页面。', '個人資料已成功更新！': '个人资料已成功更新！', '更新失敗，請稍後重試: ': '更新失败，请稍后重试：',
      '點擊選取證明照片': '点击选取证明照片', '支援 JPG、PNG、WebP，單張上限 8MB；照片需清晰包含尺規或可驗證參考物。': '支持 JPG、PNG、WebP，单张上限 8MB；照片需清晰包含尺规或可验证参考物。', '提交規格核查申請': '提交规格核查申请', '請同意黃金 Spec 照片開放規則後再提交。': '请同意黄金 Spec 照片开放规则后再提交。', '請先上傳規格證明照片。': '请先上传规格证明照片。', '規格證明照片處理完成': '规格证明照片处理完成', '黃金 Spec 認證申請已送出': '黄金 Spec 认证申请已送出',
      '會員帳號 ID': '会员账号 ID', '註冊綁定信箱': '注册绑定邮箱', '送出忘記密碼申請': '送出忘记密码申请', '請填寫帳號與註冊綁定信箱。': '请填写账号与注册绑定邮箱。', '請輸入有效的 Email 格式。': '请输入有效的 Email 格式。', '查無符合的會員帳號或綁定信箱，請確認後再送出。': '查无符合的会员账号或绑定邮箱，请确认后再送出。', '此帳號尚未通過審核，無法使用忘記密碼功能。': '此账号尚未通过审核，无法使用忘记密码功能。', '此帳號已有待處理的忘記密碼申請，請等待處理。': '此账号已有待处理的忘记密码申请，请等待处理。', '忘記密碼申請已送出，請等待管理員處理。': '忘记密码申请已送出，请等待管理员处理。',
      '刪除留言失敗': '删除留言失败', '留言已刪除 🔒': '留言已删除 🔒', '提交留言檢舉失敗': '提交留言举报失败', '提交檢舉失敗': '提交举报失败', '審查中': '审核中'
    },
    ja: {
      '填寫要變更的個人資訊，除頭像變更後需人工審核外，其餘欄位修改儲存後即會自動更新！': '変更するプロフィール情報を入力してください。プロフィール画像の変更のみ手動審査が必要です。',
      '變更個人大頭照': 'プロフィール画像を変更', '變更大頭照需要管理團隊人工二次核定後才予以替換啟用。': 'プロフィール画像の変更は管理チームの再審査後に有効になります。',
      '個人暱稱': 'ニックネーム', '身體數據密碼規格': '非公開身体データ', '感興趣的主題與偏好標籤': '興味のあるテーマと好みタグ', '儲存變更': '変更を保存',
      '新大頭照檔案大小超過 10 Mb 限制！': '新しいプロフィール画像が10MB制限を超えています。', '新大頭照優化成功': '新しいプロフィール画像の最適化が完了しました', '新大頭相片解析失敗！': '新しいプロフィール画像の処理に失敗しました。', '暱稱不能為空！': 'ニックネームは空にできません。', '請至少選擇一項感興趣的主題標籤！': '興味のあるテーマタグを最低1つ選択してください。',
      '大頭照更換已送審': 'プロフィール画像変更を審査に送信しました', '個人資料已成功更新！': 'プロフィールを更新しました。', '更新失敗，請稍後重試: ': '更新に失敗しました。後でもう一度お試しください：',
      '點擊選取證明照片': 'タップして証明写真を選択', '提交規格核查申請': 'Spec確認申請を送信', '請先上傳規格證明照片。': '先にSpec証明写真をアップロードしてください。', '規格證明照片處理完成': 'Spec証明写真の処理が完了しました', '黃金 Spec 認證申請已送出': 'Gold Spec認証申請を送信しました',
      '會員帳號 ID': '会員アカウントID', '註冊綁定信箱': '登録メール', '送出忘記密碼申請': 'パスワード再設定申請を送信', '請填寫帳號與註冊綁定信箱。': 'アカウントと登録メールを入力してください。', '請輸入有效的 Email 格式。': '有効なメール形式を入力してください。', '查無符合的會員帳號或綁定信箱，請確認後再送出。': '一致する会員アカウントまたは登録メールが見つかりません。', '審查中': '審査中'
    },
    ko: {
      '填寫要變更的個人資訊，除頭像變更後需人工審核外，其餘欄位修改儲存後即會自動更新！': '변경할 프로필 정보를 입력하세요. 프로필 사진 변경만 수동 검토가 필요합니다.',
      '變更個人大頭照': '프로필 사진 변경', '變更大頭照需要管理團隊人工二次核定後才予以替換啟用。': '프로필 사진 변경은 관리팀의 2차 수동 승인 후 적용됩니다.',
      '個人暱稱': '닉네임', '身體數據密碼規格': '비공개 신체 데이터', '感興趣的主題與偏好標籤': '관심 주제 및 선호 태그', '儲存變更': '변경 저장',
      '新大頭照檔案大小超過 10 Mb 限制！': '새 프로필 사진이 10MB 제한을 초과했습니다.', '新大頭照優化成功': '새 프로필 사진 최적화 완료', '新大頭相片解析失敗！': '새 프로필 사진 처리 실패', '暱稱不能為空！': '닉네임은 비워둘 수 없습니다.', '請至少選擇一項感興趣的主題標籤！': '관심 주제 태그를 최소 1개 선택하세요.',
      '大頭照更換已送審': '프로필 사진 변경 검토 제출됨', '個人資料已成功更新！': '프로필이 업데이트되었습니다.', '更新失敗，請稍後重試: ': '업데이트 실패. 나중에 다시 시도하세요: ',
      '點擊選取證明照片': '탭하여 증명 사진 선택', '提交規格核查申請': 'Spec 확인 신청 제출', '請先上傳規格證明照片。': '먼저 Spec 증명 사진을 업로드하세요.', '規格證明照片處理完成': 'Spec 증명 사진 처리 완료', '黃金 Spec 認證申請已送出': 'Gold Spec 인증 신청이 제출되었습니다',
      '會員帳號 ID': '회원 계정 ID', '註冊綁定信箱': '등록 이메일', '送出忘記密碼申請': '비밀번호 재설정 요청 제출', '請填寫帳號與註冊綁定信箱。': '계정과 등록 이메일을 입력하세요.', '請輸入有效的 Email 格式。': '올바른 이메일 형식을 입력하세요.', '查無符合的會員帳號或綁定信箱，請確認後再送出。': '일치하는 회원 계정 또는 등록 이메일을 찾을 수 없습니다.', '審查中': '검토 중'
    }
  };

  const dict = D[lang] || {};
  const keys = Object.keys(dict).sort((a, b) => b.length - a.length);
  const clean = v => String(v || '').replace(/\s+/g, ' ').trim();
  const skip = el => !el || el.closest('#sr-i18n-switcher,.notranslate,[translate="no"],script,style,noscript,svg,canvas,video,audio');
  function tr(text) {
    const key = clean(text);
    if (!key) return text;
    if (dict[key]) return dict[key];
    let out = key;
    for (const k of keys) if (out.includes(k)) out = out.split(k).join(dict[k]);
    return out === key ? text : out;
  }
  function apply(root = document.body) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode(n) { return skip(n.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(n => {
      if (!n.__srPatchOriginal) n.__srPatchOriginal = n.nodeValue;
      const raw = n.__srPatchOriginal;
      const c = clean(raw);
      if (c && c.length < 1600) n.nodeValue = raw.replace(c, tr(c));
    });
    document.querySelectorAll('[placeholder],[title],[aria-label],input[value]').forEach(el => {
      if (skip(el)) return;
      ['placeholder','title','aria-label','value'].forEach(attr => {
        const v = el.getAttribute(attr);
        if (!v || /^\d/.test(v)) return;
        const dataKey = `srPatch${attr.replace(/[^a-z]/gi,'')}`;
        if (el.dataset[dataKey] === undefined) el.dataset[dataKey] = v;
        el.setAttribute(attr, tr(el.dataset[dataKey]));
      });
    });
  }
  setTimeout(apply, 100);
  setTimeout(apply, 600);
  setInterval(apply, 1400);
})();
