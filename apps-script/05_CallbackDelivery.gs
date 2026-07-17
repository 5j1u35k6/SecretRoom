/**
 * Inline Keyboard Callback。
 */
function handleCallbackQuery_(callbackQuery) {
  const callbackId = String(callbackQuery.id || '');
  const data = String(callbackQuery.data || '');
  const message = callbackQuery.message || {};
  const chatId = message.chat ? message.chat.id : null;
  const from = callbackQuery.from || {};

  if (callbackId) answerCallbackQuery_(callbackId);
  if (chatId === null || chatId === undefined) return;

  if (data === 'MENU_HOME') return showMainMenu_(chatId, from);
  if (data === 'MENU_BINDING') return showAccountBinding_(chatId, from);
  if (data === 'MENU_RESET') return showPasswordReset_(chatId, from);
  if (data === 'MENU_SETTINGS') return showTelegramSettings_(chatId, from);
  if (data === 'MENU_REQUESTS') return showRequestProgress_(chatId, from);
  if (data === 'MENU_HELP') return showHelp_(chatId);

  if (data.indexOf('RESET_CONFIRM|') === 0) {
    const requestId = data.split('|')[1] || '';
    return completePasswordReset_(chatId, from, requestId);
  }

  if (data.indexOf('PREF_TOGGLE|') === 0) {
    const key = data.split('|')[1] || '';
    return toggleTelegramPreference_(chatId, from, key);
  }

  sendMessage_(chatId, '這個按鈕目前沒有對應功能。', { reply_markup: mainMenuKeyboard_() });
}


/**
 * Telegram outbox 維護。
 * 這個每分鐘觸發器只處理「外送通知」，不讀取使用者訊息。
 */
function runTelegramMaintenance() {
  processTelegramOutbox_();
  processAdminTelegramOutbox_();
  scanPendingAdminItems_();
}


function processTelegramOutbox_() {
  const pending = queryDocuments_('telegram_outbox', [
    { field: 'status', op: 'EQUAL', value: 'pending' }
  ]).slice(0, TELEGRAM_OUTBOX_BATCH_SIZE);

  pending.forEach(item => {
    const outboxId = String(item.__documentId || '');
    if (!outboxId) return;

    try {
      if (Number(item.nextAttemptAtMs || 0) > Date.now()) return;
      const accountId = String(item.accountId || '').trim();
      if (!accountId) throw new Error('outbox 缺少 accountId');

      const binding = firestoreGetDocument_('telegram_bindings', accountId);
      if (!binding || String(binding.status || '') !== 'active' || !binding.telegramChatId) {
        firestoreSetDocument_('telegram_outbox', outboxId, {
          status: 'skipped',
          lastError: '會員沒有有效的 Telegram 綁定',
          processedAtMs: Date.now()
        }, true);
        return;
      }

      const preferences = firestoreGetDocument_('telegram_preferences', accountId) || {};
      if (!shouldSendCategory_(item.category, preferences)) {
        firestoreSetDocument_('telegram_outbox', outboxId, {
          status: 'skipped',
          skipReason: 'preference_disabled',
          processedAtMs: Date.now()
        }, true);
        return;
      }

      const options = {};
      if (item.buttonText && item.buttonUrl) {
        options.reply_markup = {
          inline_keyboard: [[{
            text: String(item.buttonText),
            url: String(item.buttonUrl)
          }]]
        };
      }

      const sent = sendMessage_(
        String(binding.telegramChatId),
        `<b>${escapeHtml_(item.title || 'SecretRoom 通知')}</b>\n\n${escapeHtml_(item.message || '')}`,
        options
      );

      firestoreSetDocument_('telegram_outbox', outboxId, {
        status: 'sent',
        sentAtMs: Date.now(),
        telegramMessageId: sent && sent.message_id ? sent.message_id : null,
        attemptCount: Number(item.attemptCount || 0) + 1,
        lastError: ''
      }, true);

      writeDeliveryLog_({
        accountId,
        category: item.category || 'notice',
        title: item.title || 'SecretRoom 通知',
        status: 'sent',
        telegramChatId: String(binding.telegramChatId),
        outboxId,
        source: item.source || 'outbox'
      });
    } catch (error) {
      const attempts = Number(item.attemptCount || 0) + 1;
      firestoreSetDocument_('telegram_outbox', outboxId, {
        status: attempts >= 3 ? 'failed' : 'pending',
        attemptCount: attempts,
        nextAttemptAtMs: Date.now() + attempts * 60 * 1000,
        lastError: String(error.message || error).slice(0, 500),
        lastFailedAtMs: Date.now()
      }, true);
    }
  });
}


function shouldSendCategory_(category, preferences) {
  const key = String(category || '').toLowerCase();
  if (key === 'security' || key === 'password') return true;
  const mapping = {
    review: 'reviewNotifications',
    avatar: 'avatarNotifications',
    spec: 'specNotifications',
    account: 'accountNotifications',
    platform: 'platformNotifications',
    rank: 'rankNotifications',
    social: 'socialNotifications'
  };
  const preferenceKey = mapping[key] || 'platformNotifications';
  return preferences[preferenceKey] !== false;
}


function processAdminTelegramOutbox_() {
  const adminChatIds = getAdminChatIds_();
  if (!adminChatIds.length) return;

  const pending = queryDocuments_('telegram_admin_outbox', [
    { field: 'status', op: 'EQUAL', value: 'pending' }
  ]).slice(0, TELEGRAM_OUTBOX_BATCH_SIZE);

  pending.forEach(item => {
    const id = String(item.__documentId || '');
    if (!id) return;
    try {
      if (Number(item.nextAttemptAtMs || 0) > Date.now()) return;
      adminChatIds.forEach(chatId => {
        sendMessage_(
          chatId,
          `<b>🛡️ ${escapeHtml_(item.title || 'SecretRoom 管理提醒')}</b>\n\n${escapeHtml_(item.message || '')}`,
          {
            reply_markup: {
              inline_keyboard: [[{ text: '開啟管理後台', url: getAdminUrl_() }]]
            }
          }
        );
      });
      firestoreSetDocument_('telegram_admin_outbox', id, {
        status: 'sent',
        sentAtMs: Date.now(),
        attemptCount: Number(item.attemptCount || 0) + 1,
        lastError: ''
      }, true);
    } catch (error) {
      const attempts = Number(item.attemptCount || 0) + 1;
      firestoreSetDocument_('telegram_admin_outbox', id, {
        status: attempts >= 3 ? 'failed' : 'pending',
        attemptCount: attempts,
        lastError: String(error.message || error).slice(0, 500),
        lastFailedAtMs: Date.now()
      }, true);
    }
  });
}


function scanPendingAdminItems_() {
  const collections = [
    { collection: 'applications', statusField: 'status', status: 'pending', title: '新會員申請', accountField: '__documentId' },
    { collection: 'password_reset_requests', statusField: 'status', status: 'pending', title: '忘記密碼申請', accountField: 'userId' },
    { collection: 'account_requests', statusField: 'status', status: 'pending', title: '帳號異動申請', accountField: 'userId' }
  ];

  collections.forEach(config => {
    const items = queryDocuments_(config.collection, [
      { field: config.statusField, op: 'EQUAL', value: config.status }
    ]).slice(0, 30);

    items.forEach(item => {
      if (item.adminTelegramNotifiedAtMs) return;
      const id = String(item.__documentId || '');
      const accountId = String(item[config.accountField] || item.__documentId || '');
      const outboxId = Utilities.getUuid();
      firestoreSetDocument_('telegram_admin_outbox', outboxId, {
        category: 'review',
        title: config.title,
        message: `帳號 @${accountId} 有新的待處理項目。`,
        accountId,
        sourceCollection: config.collection,
        sourceDocumentId: id,
        status: 'pending',
        attemptCount: 0,
        nextAttemptAtMs: 0,
        createdAtMs: Date.now()
      }, false);
      firestoreSetDocument_(config.collection, id, {
        adminTelegramNotifiedAtMs: Date.now()
      }, true);
    });
  });
}


function writeDeliveryLog_(payload) {
  const id = Utilities.getUuid();
  const safe = Object.assign({}, payload, {
    createdAtMs: Date.now()
  });
  delete safe.password;
  delete safe.temporaryPassword;
  delete safe.token;
  firestoreSetDocument_('telegram_delivery_logs', id, safe, false);
}
