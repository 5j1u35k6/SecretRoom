import { readFile, writeFile } from 'node:fs/promises';

const workerUrl = new URL('./.generated-worker.js', import.meta.url);
let source = await readFile(workerUrl, 'utf8');

const SUPPORT_SESSION_MINUTES = 30;
const SUPPORT_DETAIL_LIMIT = 1600;

function supportCategoryLabel(category) {
  const labels = {
    login: '登入問題',
    binding: 'Telegram 綁定',
    notification: '通知問題',
    profile: '帳號資料',
    other: '其他問題'
  };

  return labels[category] || labels.other;
}

function supportSessionPath(telegramUserId) {
  return appPath(
    'telegram_support_sessions',
    String(telegramUserId)
  );
}

async function beginSupportReport(
  chatId,
  telegramUserId,
  category,
  telegramProfile,
  env
) {
  if (!telegramUserId) {
    throw httpError(400, '無法取得 Telegram 使用者身分');
  }

  const supportedCategories = [
    'login',
    'binding',
    'notification',
    'profile',
    'other'
  ];

  const selectedCategory = supportedCategories.includes(category)
    ? category
    : 'other';

  const binding = await bindingByTelegramId(
    telegramUserId,
    env
  );

  const now = Date.now();
  const expiresAtMs =
    now + SUPPORT_SESSION_MINUTES * 60_000;

  await patchDocument(
    env,
    supportSessionPath(telegramUserId),
    {
      telegramUserId: String(telegramUserId),
      telegramChatId: String(chatId),
      telegramUsername:
        String(telegramProfile?.username || ''),
      telegramFirstName:
        String(telegramProfile?.first_name || ''),
      userId: String(binding?.data.userId || ''),
      category: selectedCategory,
      categoryLabel:
        supportCategoryLabel(selectedCategory),
      status: 'awaiting_details',
      details: null,
      ticketId: null,
      createdAtMs: now,
      updatedAtMs: now,
      expiresAtMs,
      submittedAtMs: null,
      cancelledAtMs: null
    }
  );

  return telegramApi(env, 'sendMessage', {
    chat_id: String(chatId),
    parse_mode: 'HTML',
    text:
      `<b>🐞 問題回報</b>\n\n` +
      `問題類型：<b>${escapeHtml(
        supportCategoryLabel(selectedCategory)
      )}</b>\n\n` +
      `請直接輸入問題內容。\n` +
      `請勿提供密碼、臨時密碼、綁定連結或其他驗證資料。\n\n` +
      `本次填寫將在 ${SUPPORT_SESSION_MINUTES} 分鐘後失效。`,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '取消回報',
            callback_data: 'SUPPORT_CANCEL'
          }
        ]
      ]
    }
  });
}

async function consumeSupportDetails(message, env) {
  const telegramUserId = message.from?.id;
  if (!telegramUserId) return false;

  const session = await getDocument(
    env,
    supportSessionPath(telegramUserId)
  );

  if (!session) return false;

  const status = String(
    session.data.status || ''
  );

  if (status !== 'awaiting_details') {
    return false;
  }

  if (
    Number(session.data.expiresAtMs || 0) <=
    Date.now()
  ) {
    await patchDocument(
      env,
      session.path,
      {
        status: 'expired',
        updatedAtMs: Date.now()
      }
    );

    await telegramApi(env, 'sendMessage', {
      chat_id: String(message.chat.id),
      parse_mode: 'HTML',
      text:
        '<b>問題回報已逾時</b>\n\n' +
        '請回到協助中心重新選擇問題類型。',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🛟 協助中心',
              callback_data: 'HELP'
            }
          ]
        ]
      }
    });

    return true;
  }

  const details = String(
    message.text || ''
  ).trim();

  if (details.length < 4) {
    await telegramApi(env, 'sendMessage', {
      chat_id: String(message.chat.id),
      text:
        '問題內容太短，請至少輸入 4 個字。'
    });

    return true;
  }

  if (details.length > SUPPORT_DETAIL_LIMIT) {
    await telegramApi(env, 'sendMessage', {
      chat_id: String(message.chat.id),
      text:
        `問題內容不可超過 ${SUPPORT_DETAIL_LIMIT} 個字。`
    });

    return true;
  }

  await patchDocument(
    env,
    session.path,
    {
      details,
      status: 'awaiting_confirmation',
      updatedAtMs: Date.now()
    }
  );

  return telegramApi(env, 'sendMessage', {
    chat_id: String(message.chat.id),
    parse_mode: 'HTML',
    text:
      `<b>請確認問題回報</b>\n\n` +
      `問題類型：<b>${escapeHtml(
        session.data.categoryLabel ||
        supportCategoryLabel(
          session.data.category
        )
      )}</b>\n\n` +
      `問題內容：\n${escapeHtml(details)}\n\n` +
      `確認後將建立 SecretRoom 服務單。`,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '返回修改',
            callback_data: 'SUPPORT_EDIT'
          },
          {
            text: '確認送出',
            callback_data: 'SUPPORT_SUBMIT'
          }
        ],
        [
          {
            text: '取消回報',
            callback_data: 'SUPPORT_CANCEL'
          }
        ]
      ]
    }
  });
}

async function editSupportReport(
  chatId,
  telegramUserId,
  env
) {
  const session = await getDocument(
    env,
    supportSessionPath(telegramUserId)
  );

  if (!session) {
    return sendHelp(chatId, env);
  }

  await patchDocument(
    env,
    session.path,
    {
      status: 'awaiting_details',
      details: null,
      updatedAtMs: Date.now(),
      expiresAtMs:
        Date.now() +
        SUPPORT_SESSION_MINUTES * 60_000
    }
  );

  return telegramApi(env, 'sendMessage', {
    chat_id: String(chatId),
    parse_mode: 'HTML',
    text:
      '<b>請重新輸入問題內容</b>\n\n' +
      '新的內容會取代剛才的內容。',
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '取消回報',
            callback_data: 'SUPPORT_CANCEL'
          }
        ]
      ]
    }
  });
}

async function submitSupportReport(
  chatId,
  telegramUserId,
  env
) {
  const session = await getDocument(
    env,
    supportSessionPath(telegramUserId)
  );

  if (
    !session ||
    session.data.status !==
      'awaiting_confirmation'
  ) {
    return telegramApi(env, 'sendMessage', {
      chat_id: String(chatId),
      parse_mode: 'HTML',
      text:
        '<b>找不到可送出的問題回報</b>\n\n' +
        '請回到協助中心重新操作。',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🛟 協助中心',
              callback_data: 'HELP'
            }
          ]
        ]
      }
    });
  }

  if (
    Number(session.data.expiresAtMs || 0) <=
    Date.now()
  ) {
    await patchDocument(
      env,
      session.path,
      {
        status: 'expired',
        updatedAtMs: Date.now()
      }
    );

    return telegramApi(env, 'sendMessage', {
      chat_id: String(chatId),
      text:
        '本次問題回報已逾時，請重新操作。'
    });
  }

  const ticketId = randomId('support_');
  const now = Date.now();

  await createDocument(
    env,
    appPath('support_tickets', ticketId),
    {
      ticketId,
      status: 'open',
      priority: 'normal',
      source: 'telegram',
      category:
        String(session.data.category || 'other'),
      categoryLabel:
        String(
          session.data.categoryLabel ||
          supportCategoryLabel(
            session.data.category
          )
        ),
      details:
        String(session.data.details || ''),
      userId:
        String(session.data.userId || ''),
      telegramUserId:
        String(telegramUserId),
      telegramChatId:
        String(chatId),
      telegramUsername:
        String(
          session.data.telegramUsername || ''
        ),
      telegramFirstName:
        String(
          session.data.telegramFirstName || ''
        ),
      createdAtMs: now,
      updatedAtMs: now,
      createdBy: 'member'
    }
  );

  await patchDocument(
    env,
    session.path,
    {
      status: 'submitted',
      ticketId,
      submittedAtMs: now,
      updatedAtMs: now
    }
  );

  return telegramApi(env, 'sendMessage', {
    chat_id: String(chatId),
    parse_mode: 'HTML',
    text:
      `<b>✅ 問題回報已送出</b>\n\n` +
      `服務單編號：<code>${escapeHtml(
        ticketId
      )}</code>\n` +
      `問題類型：${escapeHtml(
        session.data.categoryLabel ||
        supportCategoryLabel(
          session.data.category
        )
      )}\n\n` +
      `管理員後續可在 SecretRoom 後台資料中查看此服務單。`,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🛟 返回協助中心',
            callback_data: 'HELP'
          }
        ],
        [
          {
            text: '⬅️ 返回主選單',
            callback_data: 'MENU'
          }
        ]
      ]
    }
  });
}

async function cancelSupportReport(
  chatId,
  telegramUserId,
  env
) {
  const session = telegramUserId
    ? await getDocument(
        env,
        supportSessionPath(telegramUserId)
      )
    : null;

  if (session) {
    await patchDocument(
      env,
      session.path,
      {
        status: 'cancelled',
        cancelledAtMs: Date.now(),
        updatedAtMs: Date.now()
      }
    );
  }

  return telegramApi(env, 'sendMessage', {
    chat_id: String(chatId),
    parse_mode: 'HTML',
    text:
      '<b>問題回報已取消</b>\n\n' +
      '尚未建立服務單。',
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🛟 返回協助中心',
            callback_data: 'HELP'
          }
        ],
        [
          {
            text: '⬅️ 返回主選單',
            callback_data: 'MENU'
          }
        ]
      ]
    }
  });
}

if (
  !source.includes(
    'async function beginSupportReport'
  )
) {
  const helperMarker =
    'function verifyTelegramSecret(request, env) {';

  if (!source.includes(helperMarker)) {
    throw new Error(
      'Telegram helper insertion marker was not found'
    );
  }

  const helpers = [
    supportCategoryLabel,
    supportSessionPath,
    beginSupportReport,
    consumeSupportDetails,
    editSupportReport,
    submitSupportReport,
    cancelSupportReport
  ]
    .map(fn => fn.toString())
    .join('\n\n');

  source = source.replace(
    helperMarker,
    `${helpers}\n\n${helperMarker}`
  );
}

const reportRoute =
  "  if (data === 'HELP_REPORT') return showSupportCategories(chatId, env);";

if (
  !source.includes(
    "data.startsWith('REPORT_CATEGORY:')"
  )
) {
  if (!source.includes(reportRoute)) {
    throw new Error(
      'Help report callback marker was not found'
    );
  }

  source = source.replace(
    reportRoute,
    `${reportRoute}
  if (data.startsWith('REPORT_CATEGORY:')) return beginSupportReport(chatId, telegramUserId, data.slice(16), callback.from, env);
  if (data === 'SUPPORT_EDIT') return editSupportReport(chatId, telegramUserId, env);
  if (data === 'SUPPORT_SUBMIT') return submitSupportReport(chatId, telegramUserId, env);
  if (data === 'SUPPORT_CANCEL') return cancelSupportReport(chatId, telegramUserId, env);`
  );
}

source = source.replace(
  "  if (data === 'CONTACT_ADMIN') return showSupportCategories(chatId, env);",
  "  if (data === 'CONTACT_ADMIN') return beginSupportReport(chatId, telegramUserId, 'other', callback.from, env);"
);

const messageMarker =
  `  if (command === '/help') return sendHelp(chatId, env);
  return sendMainMenu(chatId, telegramUserId, firstName, env, true);`;

if (
  !source.includes(
    "command === '/cancel'"
  )
) {
  if (!source.includes(messageMarker)) {
    throw new Error(
      'Telegram message routing marker was not found'
    );
  }

  source = source.replace(
    messageMarker,
    `  if (command === '/cancel') return cancelSupportReport(chatId, telegramUserId, env);
  if (command === '/help') return sendHelp(chatId, env);
  if (!command.startsWith('/') && await consumeSupportDetails(message, env)) return;
  return sendMainMenu(chatId, telegramUserId, firstName, env, true);`
  );
}

source = source.replace(
  '/help－協助中心\\n\\n綁定與忘記密碼',
  '/help－協助中心\\n/cancel－取消問題回報\\n\\n綁定與忘記密碼'
);

if (
  !source.includes(
    'telegram_support_sessions'
  )
) {
  throw new Error(
    'Telegram support session flow was not installed'
  );
}

if (
  !source.includes(
    "appPath('support_tickets', ticketId)"
  )
) {
  throw new Error(
    'Telegram support ticket flow was not installed'
  );
}

await writeFile(
  workerUrl,
  source,
  'utf8'
);

console.log(
  'Upgraded Telegram support tickets phase 6'
);
