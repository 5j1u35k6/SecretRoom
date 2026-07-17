/**
 * 一般訊息與指令。
 */
function handleMessage_(message) {
  const chatId = message && message.chat ? message.chat.id : null;
  if (chatId === null || chatId === undefined) {
    throw new Error('Telegram 訊息缺少 chat.id。');
  }

  const text = String(message.text || '').trim();
  const from = message.from || {};

  if (!text) {
    sendMessage_(chatId, '目前暫時只支援文字訊息。');
    return;
  }

  const command = getCommand_(text);
  switch (command) {
    case '/start':
      handleStart_(chatId, from, text);
      return;
    case '/menu':
      showMainMenu_(chatId, from);
      return;
    case '/bind':
      showAccountBinding_(chatId, from);
      return;
    case '/reset':
      showPasswordReset_(chatId, from);
      return;
    case '/settings':
      showTelegramSettings_(chatId, from);
      return;
    case '/requests':
      showRequestProgress_(chatId, from);
      return;
    case '/status':
      showServiceStatus_(chatId);
      return;
    case '/help':
      showHelp_(chatId);
      return;
    default:
      sendMessage_(
        chatId,
        '我已收到你的訊息。請使用下方選單操作 SecretRoom 會員服務。',
        { reply_markup: mainMenuKeyboard_() }
      );
  }
}


function getCommand_(text) {
  if (!String(text).startsWith('/')) return '';
  return String(text).split(/\s+/)[0].split('@')[0].toLowerCase();
}


function getStartParameter_(text) {
  const parts = String(text).trim().split(/\s+/);
  return parts.length >= 2 ? String(parts[1] || '').trim() : '';
}


function handleStart_(chatId, from, originalText) {
  const parameter = getStartParameter_(originalText);

  if (parameter.indexOf('bind_') === 0) {
    const token = parameter.slice(5);
    completeTelegramBinding_(chatId, from, token);
    return;
  }

  if (parameter === 'reset') {
    showPasswordReset_(chatId, from);
    return;
  }

  if (parameter === 'settings') {
    showTelegramSettings_(chatId, from);
    return;
  }

  if (parameter === 'help_reset') {
    sendMessage_(
      chatId,
      '<b>尚未啟用 Telegram 的舊會員</b>\n\n' +
      '請先嘗試在 SecretRoom 會員中心完成 Telegram 綁定。若已無法登入，請聯絡管理員進行帳號歸屬例外驗證。',
      { reply_markup: mainMenuKeyboard_() }
    );
    return;
  }

  showMainMenu_(chatId, from);
}


function mainMenuKeyboard_() {
  return {
    inline_keyboard: [
      [
        { text: '🔗 帳號與綁定', callback_data: 'MENU_BINDING' },
        { text: '🔐 忘記密碼', callback_data: 'MENU_RESET' }
      ],
      [
        { text: '🔔 Telegram 通知設定', callback_data: 'MENU_SETTINGS' }
      ],
      [
        { text: '📋 我的申請進度', callback_data: 'MENU_REQUESTS' }
      ],
      [
        { text: '🌐 開啟 SecretRoom', url: getSecretRoomUrl_() },
        { text: '❓ 使用說明', callback_data: 'MENU_HELP' }
      ]
    ]
  };
}


function showMainMenu_(chatId, from) {
  const name = escapeHtml_(from && from.first_name ? from.first_name : '使用者');
  sendMessage_(
    chatId,
    `嗨，${name}！\n\n` +
    '<b>SecretRoom Telegram 會員服務</b>\n\n' +
    'Telegram 負責帳號綁定、安全驗證與外部通知；平台內通知仍在 SecretRoom 內獨立顯示。',
    { reply_markup: mainMenuKeyboard_() }
  );
}


/**
 * 帳號與綁定。
 */
function showAccountBinding_(chatId, from) {
  const identity = getTelegramIdentity_(from, chatId);
  const accountId = resolveAccountIdByTelegramUser_(identity.telegramUserId);

  if (!accountId) {
    sendMessage_(
      chatId,
      '<b>尚未綁定 SecretRoom 帳號</b>\n\n' +
      '請先登入 SecretRoom，在會員中心產生一次性 Telegram 綁定連結，再回到此處完成綁定。\n\n' +
      'Bot 不會要求你輸入 SecretRoom 密碼。',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '前往 SecretRoom 綁定', url: appendQuery_(getSecretRoomUrl_(), 'telegram=bind') }],
            [{ text: '重新檢查綁定狀態', callback_data: 'MENU_BINDING' }],
            [{ text: '返回主選單', callback_data: 'MENU_HOME' }]
          ]
        }
      }
    );
    return;
  }

  const binding = firestoreGetDocument_('telegram_bindings', accountId) || {};
  const username = binding.telegramUsername
    ? '@' + escapeHtml_(binding.telegramUsername)
    : escapeHtml_(identity.firstName || '已驗證帳號');

  sendMessage_(
    chatId,
    '<b>✅ 已綁定 SecretRoom 帳號</b>\n\n' +
    `會員：@${escapeHtml_(accountId)}\n` +
    `Telegram：${username}\n` +
    `綁定時間：${formatDateTime_(binding.linkedAtMs)}\n\n` +
    '解除綁定需回到 SecretRoom 會員中心操作，避免在 Telegram 誤觸。',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '開啟 SecretRoom', url: getSecretRoomUrl_() }],
          [{ text: 'Telegram 通知設定', callback_data: 'MENU_SETTINGS' }],
          [{ text: '返回主選單', callback_data: 'MENU_HOME' }]
        ]
      }
    }
  );
}


function completeTelegramBinding_(chatId, from, token) {
  if (!token || token.length < 12) {
    sendMessage_(chatId, '綁定連結格式不正確，請回到 SecretRoom 重新產生。');
    return;
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    const tokenDocument = firestoreGetDocument_('telegram_link_tokens', token);
    if (!tokenDocument) throw new Error('找不到這個綁定連結，請回到 SecretRoom 重新產生。');
    if (String(tokenDocument.status || '') !== 'active') throw new Error('這個綁定連結已經使用或失效。');
    if (String(tokenDocument.purpose || '') !== 'telegram_bind') throw new Error('綁定連結用途不正確。');
    if (Number(tokenDocument.expiresAtMs || 0) < Date.now()) throw new Error('這個綁定連結已超過 10 分鐘，請重新產生。');

    const accountId = String(tokenDocument.accountId || '').trim();
    if (!accountId) throw new Error('綁定連結缺少會員帳號。');

    const member = firestoreGetDocument_('applications', accountId);
    if (!member) throw new Error('找不到 SecretRoom 會員資料。');
    const memberStatus = String(member.status || '').toLowerCase();
    if (memberStatus && !['pending', 'approved', 'active'].includes(memberStatus)) {
      throw new Error('目前帳號狀態無法綁定 Telegram。');
    }

    const identity = getTelegramIdentity_(from, chatId);
    const telegramUserDocument = firestoreGetDocument_('telegram_users', identity.telegramUserId);
    if (
      telegramUserDocument &&
      String(telegramUserDocument.status || '').toLowerCase() === 'active' &&
      String(telegramUserDocument.accountId || '') !== accountId
    ) {
      throw new Error('此 Telegram 帳號已綁定其他 SecretRoom 會員。');
    }

    const existingBinding = firestoreGetDocument_('telegram_bindings', accountId);
    if (
      existingBinding &&
      String(existingBinding.status || '').toLowerCase() === 'active' &&
      String(existingBinding.telegramUserId || '') !== identity.telegramUserId
    ) {
      throw new Error('此 SecretRoom 帳號已綁定其他 Telegram 帳號。');
    }

    const now = Date.now();
    const bindingData = {
      accountId,
      telegramUserId: identity.telegramUserId,
      telegramChatId: identity.telegramChatId,
      telegramUsername: identity.username,
      telegramFirstName: identity.firstName,
      telegramLastName: identity.lastName,
      status: 'active',
      linkedAtMs: now,
      linkedBy: 'telegram_deep_link',
      sourceTokenId: token
    };

    firestoreSetDocument_('telegram_bindings', accountId, bindingData, true);
    firestoreSetDocument_('telegram_users', identity.telegramUserId, {
      telegramUserId: identity.telegramUserId,
      accountId,
      status: 'active',
      linkedAtMs: now
    }, true);
    firestoreSetDocument_('applications', accountId, {
      telegramBound: true,
      telegramIdentityVerified: true,
      telegramServiceState: 'active',
      telegramUserId: identity.telegramUserId,
      telegramChatId: identity.telegramChatId,
      telegramUsername: identity.username,
      telegramInfo: {
        id: identity.telegramUserId,
        username: identity.username,
        first_name: identity.firstName,
        last_name: identity.lastName
      },
      telegramLinkedAtMs: now,
      telegramLinkStatus: 'active',
      telegramLastLinkToken: null
    }, true);
    firestoreSetDocument_('telegram_link_tokens', token, {
      status: 'used',
      usedAtMs: now,
      usedByTelegramUserId: identity.telegramUserId,
      usedByTelegramChatId: identity.telegramChatId
    }, true);
    ensureTelegramPreferences_(accountId);

    sendMessage_(
      chatId,
      '<b>✅ Telegram 綁定完成</b>\n\n' +
      `SecretRoom 帳號：@${escapeHtml_(accountId)}\n\n` +
      '你現在可以接收帳號安全、審核結果與服務通知。平台內通知仍會獨立保留。',
      { reply_markup: mainMenuKeyboard_() }
    );

    writeDeliveryLog_({
      accountId,
      category: 'security',
      title: 'Telegram 綁定完成',
      status: 'sent',
      telegramChatId: identity.telegramChatId,
      source: 'binding'
    });
  } catch (error) {
    sendMessage_(
      chatId,
      '<b>無法完成綁定</b>\n\n' + escapeHtml_(error.message || String(error)) + '\n\n請回到 SecretRoom 重新產生一次性連結。',
      { reply_markup: mainMenuKeyboard_() }
    );
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}


function getTelegramIdentity_(from, chatId) {
  return {
    telegramUserId: String(from && from.id ? from.id : ''),
    telegramChatId: String(chatId),
    username: String(from && from.username ? from.username : ''),
    firstName: String(from && from.first_name ? from.first_name : ''),
    lastName: String(from && from.last_name ? from.last_name : '')
  };
}


function resolveAccountIdByTelegramUser_(telegramUserId) {
  if (!telegramUserId) return '';
  const document = firestoreGetDocument_('telegram_users', String(telegramUserId));
  if (!document || String(document.status || '').toLowerCase() !== 'active') return '';
  return String(document.accountId || '').trim();
}
