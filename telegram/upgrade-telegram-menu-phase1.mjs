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

async function handleTelegramUpdate(update, env) {
  if (!(await claimTelegramUpdate(update, env))) return;
  if (update.callback_query) return handleCallback(update.callback_query, env);
  const message = update.message || update.edited_message;
  if (!message?.chat?.id) return;
  const text = String(message.text || '').trim();
  const command = text.split(/\s+/)[0].toLowerCase().replace(/@[^\s]+$/, '');
  const chatId = message.chat.id;
  const telegramUserId = message.from?.id;
  const firstName = message.from?.first_name || '會員';
  if (command === '/start') {
    const parameter = text.split(/\s+/)[1] || '';
    if (parameter.startsWith('bind_')) return bindTelegramAccount(parameter, message, env);
    return sendMainMenu(chatId, telegramUserId, firstName, env);
  }
  if (command === '/menu') return sendMainMenu(chatId, telegramUserId, firstName, env);
  if (command === '/account') return sendAccountStatus(chatId, telegramUserId, env);
  if (command === '/settings') return showTelegramPreferences(chatId, telegramUserId, env);
  if (command === '/status') return sendStatus(chatId, telegramUserId, env);
  if (command === '/help') return sendHelp(chatId, env);
  return sendMainMenu(chatId, telegramUserId, firstName, env, true);
}

async function handleCallback(callback, env) {
  await telegramApi(env, 'answerCallbackQuery', { callback_query_id: callback.id }).catch(() => {});
  const chatId = callback.message?.chat?.id;
  const telegramUserId = callback.from?.id;
  if (!chatId) return;
  const data = String(callback.data || '');
  if (data === 'MENU') return sendMainMenu(chatId, telegramUserId, callback.from?.first_name || '會員', env);
  if (data === 'ACCOUNT') return sendAccountStatus(chatId, telegramUserId, env);
  if (data === 'RESET') return processTelegramPasswordReset(chatId, telegramUserId, env);
  if (data === 'PREFS') return showTelegramPreferences(chatId, telegramUserId, env);
  if (data === 'STATUS') return sendStatus(chatId, telegramUserId, env);
  if (data === 'HELP') return sendHelp(chatId, env);
  if (data.startsWith('PREF:')) return togglePreference(chatId, telegramUserId, data.slice(5), env);
}

async function sendMainMenu(chatId, telegramUserId, firstName, env, unknownInput = false) {
  const binding = telegramUserId ? await bindingByTelegramId(telegramUserId, env) : null;
  const siteUrl = env.SECRETROOM_URL || '';
  if (!binding) {
    const note = unknownInput ? '我目前只能處理 SecretRoom 會員服務操作。\n\n' : '';
    return telegramApi(env, 'sendMessage', {
      chat_id: String(chatId), parse_mode: 'HTML', disable_web_page_preview: true,
      text: `${note}<b>SecretRoom Telegram 會員服務</b>\n\n嗨，${escapeHtml(firstName)}！\n目前狀態：<b>尚未綁定 SecretRoom 帳號</b>\n\n請先登入 SecretRoom，從平台產生一次性綁定連結。`,
      reply_markup: { inline_keyboard: [
        [{ text: '🔗 綁定帳號', url: siteUrl }, { text: '🔐 忘記密碼', callback_data: 'RESET' }],
        [{ text: '📋 申請進度', callback_data: 'STATUS' }, { text: '🌐 開啟 SecretRoom', url: siteUrl }],
        [{ text: '🛟 使用說明', callback_data: 'HELP' }]
      ]}
    });
  }
  const member = await getDocument(env, appPath('applications', binding.data.userId));
  const rawStatus = String(member?.data.status || 'unknown');
  const labels = { pending: '審核中', approved: '已通過', active: '正常', rejected: '未通過', suspended: '已停權' };
  const status = labels[rawStatus] || rawStatus;
  const note = unknownInput ? '我目前只能處理 SecretRoom 會員服務操作。\n\n' : '';
  return telegramApi(env, 'sendMessage', {
    chat_id: String(chatId), parse_mode: 'HTML', disable_web_page_preview: true,
    text: `${note}<b>SecretRoom 會員中心</b>\n\n歡迎回來，@${escapeHtml(binding.data.userId)}\n帳號狀態：<b>${escapeHtml(status)}</b>\nTelegram 通知：<b>已啟用</b>\n\n平台內通知與 Telegram 外部通知分開管理。`,
    reply_markup: { inline_keyboard: [
      [{ text: '👤 我的帳號', callback_data: 'ACCOUNT' }, { text: '🔔 通知設定', callback_data: 'PREFS' }],
      [{ text: '📋 申請進度', callback_data: 'STATUS' }, { text: '🌐 開啟 SecretRoom', url: siteUrl }],
      [{ text: '🛟 協助中心', callback_data: 'HELP' }]
    ]}
  });
}

replaceSection('async function handleTelegramUpdate(update, env) {', 'async function handleCallback(callback, env) {', handleTelegramUpdate.toString());
replaceSection('async function handleCallback(callback, env) {', 'async function sendMainMenu(', handleCallback.toString());
replaceSection('async function sendMainMenu(', 'async function sendHelp(', sendMainMenu.toString());

if (!source.includes("command === '/menu'")) throw new Error('Telegram /menu command was not installed');
if (!source.includes('SecretRoom 會員中心')) throw new Error('State-aware Telegram menu was not installed');

await writeFile(workerUrl, source, 'utf8');
console.log('Upgraded Telegram menu phase 1');
