import { readFile, writeFile } from 'node:fs/promises';

const workerUrl = new URL(
  './.generated-worker.js',
  import.meta.url
);

let source = await readFile(
  workerUrl,
  'utf8'
);

/**
 * 顯示被動式密碼重設狀態。
 *
 * 使用者必須先在 SecretRoom 平台提出申請；
 * Telegram 只負責確認身分與繼續處理。
 */
async function showPasswordResetStatus(
  chatId,
  telegramUserId,
  env
) {
  const binding = await bindingByTelegramId(
    telegramUserId,
    env
  );

  if (!binding) {
    return telegramApi(env, 'sendMessage', {
      chat_id: String(chatId),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      text:
        '<b>尚未綁定 SecretRoom 帳號</b>\n\n' +
        '忘記密碼功能需要先完成 Telegram 帳號綁定。',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🔗 前往 SecretRoom 綁定',
              url: env.SECRETROOM_URL || ''
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

  const userId = binding.data.userId;

  const requests = await queryCollection(
    env,
    'password_reset_requests',
    [
      {
        field: 'userId',
        value: userId
      }
    ],
    20
  );

  const now = Date.now();

  const pendingRequest = requests
    .filter(row => {
      return (
        row.data.status === 'pending' &&
        Number(row.data.expiresAtMs || 0) > now
      );
    })
    .sort((left, right) => {
      return (
        Number(right.data.createdAtMs || 0) -
        Number(left.data.createdAtMs || 0)
      );
    })[0];

  if (!pendingRequest) {
    return telegramApi(env, 'sendMessage', {
      chat_id: String(chatId),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      text:
        '<b>目前沒有待處理的密碼重設申請</b>\n\n' +
        '請先前往 SecretRoom 登入頁，點選「忘記密碼」送出申請，再回到這裡重新查詢。',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🌐 前往 SecretRoom',
              url: env.SECRETROOM_URL || ''
            }
          ],
          [
            {
              text: '🔄 我已完成申請',
              callback_data: 'RESET_REFRESH'
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

  const expiresAtMs = Number(
    pendingRequest.data.expiresAtMs || 0
  );

  const remainingMinutes = Math.max(
    1,
    Math.ceil(
      (expiresAtMs - now) / 60_000
    )
  );

  return telegramApi(env, 'sendMessage', {
    chat_id: String(chatId),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    text:
      '<b>🔐 已找到密碼重設申請</b>\n\n' +
      `會員帳號：@${escapeHtml(userId)}\n` +
      `申請時間：${formatTime(
        pendingRequest.data.createdAtMs
      )}\n` +
      `有效期限：約剩 ${remainingMinutes} 分鐘\n\n` +
      '確認繼續後，系統會產生短效臨時密碼。登入 SecretRoom 後必須立即設定新密碼。',
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '取消',
            callback_data: 'MENU'
          },
          {
            text: '確認繼續',
            callback_data: 'RESET_CONFIRM'
          }
        ],
        [
          {
            text: '🔄 重新查詢',
            callback_data: 'RESET_REFRESH'
          }
        ]
      ]
    }
  });
}

if (
  !source.includes(
    'async function showPasswordResetStatus'
  )
) {
  const insertionMarker =
    'async function processTelegramPasswordReset(';

  if (!source.includes(insertionMarker)) {
    throw new Error(
      '找不到密碼重設流程插入位置'
    );
  }

  source = source.replace(
    insertionMarker,
    `${showPasswordResetStatus.toString()}

${insertionMarker}`
  );
}

const originalResetRoute =
  "  if (data === 'RESET') return processTelegramPasswordReset(chatId, telegramUserId, env);";

const upgradedResetRoutes =
  `  if (data === 'RESET') return showPasswordResetStatus(chatId, telegramUserId, env);
  if (data === 'RESET_REFRESH') return showPasswordResetStatus(chatId, telegramUserId, env);
  if (data === 'RESET_CONFIRM') return processTelegramPasswordReset(chatId, telegramUserId, env);`;

if (
  source.includes(originalResetRoute)
) {
  source = source.replace(
    originalResetRoute,
    upgradedResetRoutes
  );
}

if (
  !source.includes(
    "data === 'RESET_CONFIRM'"
  )
) {
  throw new Error(
    '密碼重設確認路由安裝失敗'
  );
}

if (
  !source.includes(
    'showPasswordResetStatus'
  )
) {
  throw new Error(
    '被動式密碼重設畫面安裝失敗'
  );
}

await writeFile(
  workerUrl,
  source,
  'utf8'
);

console.log(
  'Upgraded Telegram reset phase 4'
);
