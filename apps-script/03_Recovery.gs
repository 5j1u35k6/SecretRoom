/**
 * 忘記密碼：只能在平台先建立 pending 申請。
 */
function showPasswordReset_(chatId, from) {
  const identity = getTelegramIdentity_(from, chatId);
  const accountId = resolveAccountIdByTelegramUser_(identity.telegramUserId);

  if (!accountId) {
    sendMessage_(
      chatId,
      '<b>尚未綁定 SecretRoom 帳號</b>\n\n' +
      '忘記密碼自助服務只提供給已綁定 Telegram 的會員。若已無法登入且尚未綁定，請聯絡管理員進行例外驗證。',
      { reply_markup: mainMenuKeyboard_() }
    );
    return;
  }

  const requests = queryDocuments_(['password', 'reset', 'requests'].join('_'), [
    { field: 'userId', op: 'EQUAL', value: accountId }
  ]).filter(item => String(item.status || '') === 'pending');

  const request = requests
    .sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0))[0];

  if (!request) {
    sendMessage_(
      chatId,
      '<b>目前沒有可處理的忘記密碼申請</b>\n\n' +
      '基於帳號安全，請先到 SecretRoom 登入頁送出「忘記密碼」申請，再回到 Bot 繼續。',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '前往 SecretRoom 申請', url: getSecretRoomUrl_() }],
            [{ text: '重新檢查', callback_data: 'MENU_RESET' }],
            [{ text: '返回主選單', callback_data: 'MENU_HOME' }]
          ]
        }
      }
    );
    return;
  }

  const requestId = String(request.__documentId || '');
  sendMessage_(
    chatId,
    '<b>已找到忘記密碼申請</b>\n\n' +
    `申請時間：${formatDateTime_(request.createdAtMs)}\n` +
    `會員帳號：@${escapeHtml_(accountId)}\n\n` +
    '確認後系統會建立一個有效 10 分鐘的一次性重設連結，讓你回到 SecretRoom 設定自己的新密碼。',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '確認身分並建立重設連結', callback_data: `RESET_CONFIRM|${requestId}` }],
          [{ text: '取消', callback_data: 'MENU_HOME' }]
        ]
      }
    }
  );
}


function completeAccountRecovery_(chatId, from, requestId) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);
    const identity = getTelegramIdentity_(from, chatId);
    const accountId = resolveAccountIdByTelegramUser_(identity.telegramUserId);
    if (!accountId) throw new Error('Telegram 綁定狀態已失效，請重新綁定。');

    const request = firestoreGetDocument_(['password', 'reset', 'requests'].join('_'), requestId);
    if (!request) throw new Error('找不到忘記密碼申請。');
    if (String(request.userId || '') !== accountId) throw new Error('這筆申請不屬於目前綁定帳號。');
    if (String(request.status || '') !== 'pending') throw new Error('這筆申請已經處理或失效。');

    const member = firestoreGetDocument_('applications', accountId);
    if (!member) throw new Error('找不到會員帳號資料。');
    const status = String(member.status || '').toLowerCase();
    if (status && !['approved', 'active'].includes(status)) throw new Error('目前帳號狀態無法重設密碼。');

    const now = Date.now();
    const expiresAtMs = now + TELEGRAM_RECOVERY_TOKEN_TTL_MS;
    const resetToken = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');

    firestoreSetDocument_('telegram_recovery_tokens', resetToken, {
      token: resetToken,
      accountId,
      requestId,
      telegramUserId: identity.telegramUserId,
      status: 'active',
      createdAtMs: now,
      expiresAtMs,
      usedAtMs: null
    }, false);

    firestoreSetDocument_(['password', 'reset', 'requests'].join('_'), requestId, {
      status: 'telegram_verified',
      verifiedAtMs: now,
      verifiedByTelegramUserId: identity.telegramUserId,
      resetTokenId: resetToken,
      resetTokenExpiresAtMs: expiresAtMs
    }, true);

    const resetUrl = appendQuery_(getSecretRoomUrl_(), 'resetToken=' + encodeURIComponent(resetToken));
    sendMessage_(
      chatId,
      '<b>🔐 身分驗證完成</b>\n\n' +
      '請在 10 分鐘內使用下方按鈕回到 SecretRoom，設定你自己的新密碼。\n\n' +
      `連結失效時間：${formatDateTime_(expiresAtMs)}\n\n` +
      '系統不會在 Telegram 或發送紀錄中保存你的新密碼。',
      {
        protect_content: true,
        reply_markup: {
          inline_keyboard: [[{ text: '設定新密碼', url: resetUrl }]]
        }
      }
    );

    writeDeliveryLog_({
      accountId,
      category: 'security',
      title: '忘記密碼身分驗證完成',
      status: 'sent',
      telegramChatId: identity.telegramChatId,
      source: 'password_reset_link',
      requestId
    });
  } catch (error) {
    sendMessage_(
      chatId,
      '<b>無法建立密碼重設連結</b>\n\n' + escapeHtml_(error.message || String(error)),
      { reply_markup: mainMenuKeyboard_() }
    );
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}


function completePasswordReset_(chatId, from, requestId) {
  return completeAccountRecovery_(chatId, from, requestId);
}
