import { readFile, writeFile } from 'node:fs/promises';

const workerUrl = new URL('./.generated-worker.js', import.meta.url);
let source = await readFile(workerUrl, 'utf8');

function replaceSection(startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Worker section not found: ${startMarker}`);
  }
  source = source.slice(0, start) + replacement.trimEnd() + '\n\n' + source.slice(end);
}

async function bindingByTelegramId(telegramUserId, env) {
  const binding = await getDocument(
    env,
    appPath('telegram_bindings', String(telegramUserId))
  );
  if (!binding || binding.data.status !== 'active') return null;
  return binding;
}

async function sendAccountStatus(chatId, telegramUserId, env) {
  const binding = await bindingByTelegramId(telegramUserId, env);
  if (!binding) {
    return telegramApi(env, 'sendMessage', {
      chat_id: String(chatId),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      text: '<b>尚未綁定 SecretRoom 帳號</b>\n\n請先登入 SecretRoom，從「Telegram 會員服務」產生一次性綁定連結。',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔗 前往 SecretRoom 綁定', url: env.SECRETROOM_URL || '' }],
          [{ text: '⬅️ 返回主選單', callback_data: 'MENU' }]
        ]
      }
    });
  }

  const member = await getDocument(
    env,
    appPath('applications', binding.data.userId)
  );
  const statusMap = {
    pending: '審核中',
    approved: '已通過',
    active: '正常',
    rejected: '未通過',
    suspended: '已停權',
    disabled: '已停用'
  };
  const rawStatus = String(member?.data.status || 'unknown');
  const status = statusMap[rawStatus] || rawStatus;

  return telegramApi(env, 'sendMessage', {
    chat_id: String(chatId),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    text: `<b>👤 我的帳號</b>\n\n會員帳號：@${escapeHtml(binding.data.userId)}\n帳號狀態：${escapeHtml(status)}\nTelegram：已綁定\n綁定時間：${formatTime(binding.data.boundAtMs)}\n\n帳號安全通知固定開啟。`,
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔄 更新帳號狀態', callback_data: 'ACCOUNT_REFRESH' }],
        [{ text: '🔐 帳號安全', callback_data: 'ACCOUNT_SECURITY' }],
        [{ text: '🔓 解除 Telegram 綁定', callback_data: 'UNBIND_CONFIRM' }],
        [{ text: '⬅️ 返回主選單', callback_data: 'MENU' }]
      ]
    }
  });
}

async function showAccountSecurity(chatId, telegramUserId, env) {
  const binding = await bindingByTelegramId(telegramUserId, env);
  if (!binding) return sendAccountStatus(chatId, telegramUserId, env);

  return telegramApi(env, 'sendMessage', {
    chat_id: String(chatId),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    text: '<b>🔐 帳號安全</b>\n\n• 帳號安全通知固定開啟\n• 忘記密碼必須先從 SecretRoom 登入頁送出申請\n• Telegram 不會要求你直接提供永久密碼\n• 臨時密碼使用後必須立即更換\n\n若收到非本人操作的安全通知，請立即聯絡管理員。',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔐 忘記密碼', callback_data: 'RESET' }],
        [{ text: '🌐 開啟 SecretRoom', url: env.SECRETROOM_URL || '' }],
        [{ text: '⬅️ 返回我的帳號', callback_data: 'ACCOUNT' }]
      ]
    }
  });
}

async function showUnbindConfirmation(chatId, telegramUserId, env) {
  const binding = await bindingByTelegramId(telegramUserId, env);
  if (!binding) return sendAccountStatus(chatId, telegramUserId, env);

  return telegramApi(env, 'sendMessage', {
    chat_id: String(chatId),
    parse_mode: 'HTML',
    text: '<b>⚠️ 確定要解除 Telegram 綁定嗎？</b>\n\n解除後將無法收到：\n• 帳號安全通知\n• 審核結果通知\n• 密碼重設通知\n• 系統與服務通知\n\n解除後需要重新從 SecretRoom 產生一次性連結才能再次綁定。',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '取消', callback_data: 'ACCOUNT' },
          { text: '確認解除', callback_data: 'UNBIND_EXECUTE' }
        ]
      ]
    }
  });
}

async function unbindTelegramAccount(chatId, telegramUserId, env) {
  const binding = await bindingByTelegramId(telegramUserId, env);
  if (!binding) return sendAccountStatus(chatId, telegramUserId, env);

  const member = await getDocument(
    env,
    appPath('applications', binding.data.userId)
  );
  if (!member) throw httpError(404, '找不到會員帳號');

  const currentTelegramUserId = String(
    member.data.telegramBinding?.telegramUserId ||
    member.data.telegramUserId ||
    ''
  );
  if (currentTelegramUserId && currentTelegramUserId !== String(telegramUserId)) {
    throw httpError(409, 'Telegram 綁定資料不一致，請聯絡管理員');
  }

  const now = Date.now();
  const eventPath = appPath('telegram_binding_events', randomId('unbind_'));

  await commitWrites(env, [
    updateWrite(
      env,
      binding.path,
      {
        status: 'inactive',
        unboundAtMs: now,
        unboundBy: 'member',
        unboundTelegramUserId: String(telegramUserId)
      },
      ['status', 'unboundAtMs', 'unboundBy', 'unboundTelegramUserId'],
      binding.updateTime ? { updateTime: binding.updateTime } : null
    ),
    updateWrite(
      env,
      member.path,
      {
        telegramBinding: null,
        telegramBound: false,
        telegramUserId: null,
        telegramInfo: null,
        telegramUnboundAtMs: now,
        telegramUnboundBy: 'member',
        telegramUnboundTelegramUserId: String(telegramUserId)
      },
      [
        'telegramBinding',
        'telegramBound',
        'telegramUserId',
        'telegramInfo',
        'telegramUnboundAtMs',
        'telegramUnboundBy',
        'telegramUnboundTelegramUserId'
      ],
      member.updateTime ? { updateTime: member.updateTime } : null
    ),
    updateWrite(
      env,
      eventPath,
      {
        action: 'unbound',
        userId: binding.data.userId,
        telegramUserId: String(telegramUserId),
        telegramChatId: String(chatId),
        initiatedBy: 'member',
        createdAtMs: now
      },
      ['action', 'userId', 'telegramUserId', 'telegramChatId', 'initiatedBy', 'createdAtMs'],
      { exists: false }
    )
  ]);

  return telegramApi(env, 'sendMessage', {
    chat_id: String(chatId),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    text: '<b>✅ Telegram 綁定已解除</b>\n\n這個 Telegram 對話將不再收到 SecretRoom 外部通知。需要重新啟用時，請登入 SecretRoom 再產生一次性綁定連結。',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🌐 開啟 SecretRoom', url: env.SECRETROOM_URL || '' }],
        [{ text: '⬅️ 返回主選單', callback_data: 'MENU' }]
      ]
    }
  });
}

source = source.replace(
  "  if (data === 'ACCOUNT') return sendAccountStatus(chatId, telegramUserId, env);",
  "  if (data === 'ACCOUNT') return sendAccountStatus(chatId, telegramUserId, env);\n  if (data === 'ACCOUNT_REFRESH') return sendAccountStatus(chatId, telegramUserId, env);\n  if (data === 'ACCOUNT_SECURITY') return showAccountSecurity(chatId, telegramUserId, env);\n  if (data === 'UNBIND_CONFIRM') return showUnbindConfirmation(chatId, telegramUserId, env);\n  if (data === 'UNBIND_EXECUTE') return unbindTelegramAccount(chatId, telegramUserId, env);"
);

replaceSection(
  'async function bindingByTelegramId(telegramUserId, env) {',
  'async function sendAccountStatus(',
  bindingByTelegramId.toString()
);

replaceSection(
  'async function sendAccountStatus(',
  'async function bindTelegramAccount(',
  [
    sendAccountStatus.toString(),
    showAccountSecurity.toString(),
    showUnbindConfirmation.toString(),
    unbindTelegramAccount.toString()
  ].join('\n\n')
);

if (!source.includes("data === 'UNBIND_EXECUTE'")) {
  throw new Error('Telegram unbind callback was not installed');
}
if (!source.includes('telegram_binding_events')) {
  throw new Error('Telegram unbind audit log was not installed');
}

await writeFile(workerUrl, source, 'utf8');
console.log('Upgraded Telegram account phase 2');
