/**
 * Telegram 通知設定。
 */
function ensureTelegramPreferences_(accountId) {
  const existing = firestoreGetDocument_('telegram_preferences', accountId) || {};
  const defaults = {
    accountId,
    securityNotifications: true,
    reviewNotifications: true,
    avatarNotifications: true,
    specNotifications: true,
    passwordNotifications: true,
    accountNotifications: true,
    platformNotifications: true,
    rankNotifications: true,
    socialNotifications: false,
    digestMode: 'instant',
    updatedAtMs: Date.now()
  };
  firestoreSetDocument_('telegram_preferences', accountId, Object.assign(defaults, existing, {
    securityNotifications: true
  }), false);
}


function showTelegramSettings_(chatId, from) {
  const identity = getTelegramIdentity_(from, chatId);
  const accountId = resolveAccountIdByTelegramUser_(identity.telegramUserId);
  if (!accountId) {
    sendMessage_(chatId, '請先完成 SecretRoom 帳號綁定。', { reply_markup: mainMenuKeyboard_() });
    return;
  }

  ensureTelegramPreferences_(accountId);
  const preferences = firestoreGetDocument_('telegram_preferences', accountId) || {};
  const rows = [
    ['reviewNotifications', '會籍審核'],
    ['avatarNotifications', '頭像審核'],
    ['specNotifications', '黃金 Spec'],
    ['accountNotifications', '帳號狀態'],
    ['platformNotifications', '服務與公告'],
    ['rankNotifications', '位階與排名'],
    ['socialNotifications', '按讚與互動']
  ];

  const keyboard = rows.map(item => [{
    text: `${preferences[item[0]] !== false ? '✅' : '⬜'} ${item[1]}`,
    callback_data: `PREF_TOGGLE|${item[0]}`
  }]);
  keyboard.push([{ text: '返回主選單', callback_data: 'MENU_HOME' }]);

  sendMessage_(
    chatId,
    '<b>🔔 Telegram 通知設定</b>\n\n' +
    '帳號安全通知固定開啟，無法關閉。\n平台內通知不會因這裡的設定而停用。',
    { reply_markup: { inline_keyboard: keyboard } }
  );
}


function toggleTelegramPreference_(chatId, from, key) {
  const allowedKeys = [
    'reviewNotifications',
    'avatarNotifications',
    'specNotifications',
    'accountNotifications',
    'platformNotifications',
    'rankNotifications',
    'socialNotifications'
  ];
  if (allowedKeys.indexOf(key) === -1) return;

  const accountId = resolveAccountIdByTelegramUser_(String(from && from.id ? from.id : ''));
  if (!accountId) {
    sendMessage_(chatId, '請先完成 SecretRoom 帳號綁定。');
    return;
  }

  ensureTelegramPreferences_(accountId);
  const preferences = firestoreGetDocument_('telegram_preferences', accountId) || {};
  const next = preferences[key] === false;
  const update = {};
  update[key] = next;
  update.securityNotifications = true;
  update.updatedAtMs = Date.now();
  firestoreSetDocument_('telegram_preferences', accountId, update, true);
  showTelegramSettings_(chatId, from);
}


/**
 * 我的申請進度。
 */
function showRequestProgress_(chatId, from) {
  const accountId = resolveAccountIdByTelegramUser_(String(from && from.id ? from.id : ''));
  if (!accountId) {
    sendMessage_(chatId, '請先完成 SecretRoom 帳號綁定。', { reply_markup: mainMenuKeyboard_() });
    return;
  }

  const member = firestoreGetDocument_('applications', accountId) || {};
  const recoveryRequests = queryDocuments_('password_reset_requests', [
    { field: 'userId', op: 'EQUAL', value: accountId }
  ]);
  const accountRequests = queryDocuments_('account_requests', [
    { field: 'userId', op: 'EQUAL', value: accountId }
  ]);

  const rows = [{
    title: '會員申請',
    status: member.status || 'pending',
    at: member.reviewedAtMs || member.createdAtMs || 0
  }];

  recoveryRequests.forEach(item => rows.push({
    title: '帳號復原',
    status: item.status || 'pending',
    at: item.createdAtMs || 0
  }));

  accountRequests.forEach(item => rows.push({
    title: item.type === 'account_delete' ? '帳號刪除' : '帳號申請',
    status: item.status || 'pending',
    at: item.createdAtMs || 0
  }));

  rows.sort((a, b) => Number(b.at || 0) - Number(a.at || 0));
  const lines = rows.slice(0, 12).map(row =>
    `• ${escapeHtml_(row.title)}：${escapeHtml_(requestStatusLabel_(row.status))}`
  );

  sendMessage_(
    chatId,
    '<b>📋 我的申請進度</b>\n\n' + lines.join('\n'),
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '重新整理', callback_data: 'MENU_REQUESTS' }],
          [{ text: '返回主選單', callback_data: 'MENU_HOME' }]
        ]
      }
    }
  );
}


function requestStatusLabel_(status) {
  const key = String(status || '').toLowerCase();
  return ({
    pending: '等待處理',
    processing: '處理中',
    telegram_verified: 'Telegram 驗證完成，等待設定新憑證',
    completed: '已完成',
    approved: '已核准',
    active: '使用中',
    rejected: '已拒絕',
    invalid: '無效',
    admin_exception_required: '需要人工例外處理'
  })[key] || key || '未知';
}


function showServiceStatus_(chatId) {
  sendMessage_(
    chatId,
    '<b>服務狀態</b>\n\n' +
    '✅ Telegram Webhook：即時接收\n' +
    '✅ Cloudflare Worker：轉送中\n' +
    '✅ 帳號綁定：啟用\n' +
    '✅ 帳號復原：Telegram 驗證與一次性連結\n' +
    '✅ 外部通知：Telegram outbox',
    { reply_markup: mainMenuKeyboard_() }
  );
}


function showHelp_(chatId) {
  sendMessage_(
    chatId,
    '<b>SecretRoom Bot 使用說明</b>\n\n' +
    '/menu－開啟主選單\n' +
    '/bind－帳號與綁定\n' +
    '/reset－忘記密碼\n' +
    '/settings－Telegram 通知設定\n' +
    '/requests－我的申請進度\n\n' +
    'SecretRoom 管理員不會透過 Bot 索取你的平台密碼。',
    { reply_markup: mainMenuKeyboard_() }
  );
}
