import { readFile, writeFile } from 'node:fs/promises';

const workerUrl = new URL('./.generated-worker.js', import.meta.url);
let source = await readFile(workerUrl, 'utf8');

function replaceSection(startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) throw new Error(`Worker section not found: ${startMarker}`);
  source = source.slice(0, start) + replacement.trimEnd() + '\n\n' + source.slice(end);
}

async function sendHelp(chatId, env) {
  return telegramApi(env, 'sendMessage', {
    chat_id: String(chatId),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    text: '<b>🛟 SecretRoom 協助中心</b>\n\n請選擇需要的協助。',
    reply_markup: {
      inline_keyboard: [
        [{ text: '📖 使用說明', callback_data: 'HELP_USAGE' }, { text: '🐞 問題回報', callback_data: 'HELP_REPORT' }],
        [{ text: '🛡️ 隱私與安全', callback_data: 'HELP_PRIVACY' }, { text: '💬 聯絡管理員', callback_data: 'CONTACT_ADMIN' }],
        [{ text: '⬅️ 返回主選單', callback_data: 'MENU' }]
      ]
    }
  });
}

async function showUsageGuide(chatId, env) {
  return telegramApi(env, 'sendMessage', {
    chat_id: String(chatId),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    text: '<b>📖 使用說明</b>\n\n/start－開啟會員服務\n/menu－返回主選單\n/account－我的帳號\n/settings－通知設定\n/status－申請進度\n/help－協助中心\n\n綁定與忘記密碼都必須先從 SecretRoom 平台開始。',
    reply_markup: { inline_keyboard: [[{ text: '🌐 開啟 SecretRoom', url: env.SECRETROOM_URL || '' }], [{ text: '⬅️ 返回協助中心', callback_data: 'HELP' }]] }
  });
}

async function showPrivacyGuide(chatId, env) {
  return telegramApi(env, 'sendMessage', {
    chat_id: String(chatId),
    parse_mode: 'HTML',
    text: '<b>🛡️ 隱私與安全</b>\n\n• 機器人不會要求永久密碼\n• 綁定使用一次性短效連結\n• 帳號安全通知固定開啟\n• 臨時登入憑證只有短時間有效\n• 平台通知與 Telegram 外部通知分開管理\n\n請勿轉傳綁定連結或驗證資料。',
    reply_markup: { inline_keyboard: [[{ text: '⬅️ 返回協助中心', callback_data: 'HELP' }]] }
  });
}

async function showSupportCategories(chatId, env) {
  return telegramApi(env, 'sendMessage', {
    chat_id: String(chatId),
    parse_mode: 'HTML',
    text: '<b>🐞 問題回報</b>\n\n請先選擇問題類型。',
    reply_markup: {
      inline_keyboard: [
        [{ text: '登入問題', callback_data: 'REPORT_CATEGORY:login' }, { text: 'Telegram 綁定', callback_data: 'REPORT_CATEGORY:binding' }],
        [{ text: '通知問題', callback_data: 'REPORT_CATEGORY:notification' }, { text: '帳號資料', callback_data: 'REPORT_CATEGORY:profile' }],
        [{ text: '其他問題', callback_data: 'REPORT_CATEGORY:other' }],
        [{ text: '⬅️ 返回協助中心', callback_data: 'HELP' }]
      ]
    }
  });
}

source = source.replace(
  "  if (data === 'HELP') return sendHelp(chatId, env);",
  "  if (data === 'HELP') return sendHelp(chatId, env);\n  if (data === 'HELP_USAGE') return showUsageGuide(chatId, env);\n  if (data === 'HELP_PRIVACY') return showPrivacyGuide(chatId, env);\n  if (data === 'HELP_REPORT') return showSupportCategories(chatId, env);\n  if (data === 'CONTACT_ADMIN') return showSupportCategories(chatId, env);"
);

replaceSection('async function sendHelp(', 'async function bindingByTelegramId(', [sendHelp, showUsageGuide, showPrivacyGuide, showSupportCategories].map(fn => fn.toString()).join('\n\n'));

if (!source.includes('HELP_PRIVACY')) throw new Error('Help center was not installed');

await writeFile(workerUrl, source, 'utf8');
console.log('Upgraded Telegram help center phase 5');
