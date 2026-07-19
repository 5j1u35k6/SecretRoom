import { readFile, writeFile } from 'node:fs/promises';

const workerUrl = new URL('./.generated-worker.js', import.meta.url);
let source = await readFile(workerUrl, 'utf8');

async function showPasswordResetGuide(chatId, telegramUserId, env) {
  const binding = await bindingByTelegramId(telegramUserId, env);
  if (!binding) return sendAccountStatus(chatId, telegramUserId, env);

  const requests = await queryCollection(
    env,
    'password_reset_requests',
    [{ field: 'userId', value: binding.data.userId }],
    20
  );
  const request = requests
    .filter(row => row.data.status === 'pending' && Number(row.data.expiresAtMs || 0) > Date.now())
    .sort((a, b) => Number(b.data.createdAtMs || 0) - Number(a.data.createdAtMs || 0))[0];

  if (!request) {
    return telegramApi(env, 'sendMessage', {
      chat_id: String(chatId),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      text: '<b>目前沒有待處理的密碼重設申請</b>\n\n請先前往 SecretRoom 登入頁，點選「忘記密碼」送出申請，再回到這裡重新查詢。',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌐 前往 SecretRoom', url: env.SECRETROOM_URL || '' }],
          [{ text: '🔄 我已完成申請', callback_data: 'RESET_RECHECK' }],
          [{ text: '⬅️ 返回主選單', callback_data: 'MENU' }]
        ]
      }
    });
  }

  const minutes = Math.max(
    1,
    Math.ceil((Number(request.data.expiresAtMs || 0) - Date.now()) / 60000)
  );

  return telegramApi(env, 'sendMessage', {
    chat_id: String(chatId),
    parse_mode: 'HTML',
    text: `<b>已找到密碼重設申請</b>\n\n會員帳號：@${escapeHtml(binding.data.userId)}\n申請時間：${formatTime(request.data.createdAtMs)}\n有效期限：約剩 ${minutes} 分鐘\n\n下一步會建立短效臨時登入憑證；登入平台後必須立即設定新密碼。`,
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔐 繼續處理', callback_data: 'RESET_ISSUE' }],
        [{ text: '⬅️ 返回主選單', callback_data: 'MENU' }]
      ]
    }
  });
}

source = source.replace(
  "  if (data === 'RESET') return processTelegramPasswordReset(chatId, telegramUserId, env);",
  "  if (data === 'RESET' || data === 'RESET_RECHECK') return showPasswordResetGuide(chatId, telegramUserId, env);\n  if (data === 'RESET_ISSUE') return processTelegramPasswordReset(chatId, telegramUserId, env);"
);

const marker = 'async function processTelegramPasswordReset(';
const index = source.indexOf(marker);
if (index < 0) throw new Error('Password reset handler was not found');
source = source.slice(0, index) + showPasswordResetGuide.toString() + '\n\n' + source.slice(index);

if (!source.includes("data === 'RESET_ISSUE'")) throw new Error('Password reset guide was not installed');

await writeFile(workerUrl, source, 'utf8');
console.log('Upgraded Telegram password reset phase 4');
