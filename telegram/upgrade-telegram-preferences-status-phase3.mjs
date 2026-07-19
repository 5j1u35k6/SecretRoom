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

async function sendHelp(chatId, env) {
  return telegramApi(env, 'sendMessage', {
    chat_id: String(chatId),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    text: '<b>🛟 SecretRoom 協助中心</b>\n\n/start－開啟會員服務\n/menu－返回主選單\n/account－我的帳號\n/settings－Telegram 通知設定\n/status－申請進度\n/help－協助中心\n\n帳號綁定與忘記密碼都必須先從 SecretRoom 平台開始。',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🌐 開啟 SecretRoom', url: env.SECRETROOM_URL || '' }],
        [{ text: '⬅️ 返回主選單', callback_data: 'MENU' }]
      ]
    }
  });
}

async function showTelegramPreferences(chatId, telegramUserId, env) {
  const binding = await bindingByTelegramId(telegramUserId, env);
  if (!binding) return sendAccountStatus(chatId, telegramUserId, env);

  const member = await getDocument(env, appPath('applications', binding.data.userId));
  const prefs = member?.data.telegramNotificationPreferences || {
    security: true,
    review: true,
    service: true,
    promotion: false
  };

  const label = value => value !== false ? '開啟 ✅' : '關閉 ❌';
  const promotionLabel = prefs.promotion === true ? '開啟 ✅' : '關閉 ❌';

  return telegramApi(env, 'sendMessage', {
    chat_id: String(chatId),
    parse_mode: 'HTML',
    text: `<b>🔔 Telegram 通知設定</b>\n\n以下設定只影響 Telegram 外部通知，不會改變 SecretRoom 平台內通知。\n\n🔒 帳號安全通知：固定開啟\n${prefs.review !== false ? '✅' : '❌'} 審核結果通知\n${prefs.service !== false ? '✅' : '❌'} 系統與服務通知\n${prefs.promotion === true ? '✅' : '❌'} 活動與公告通知`,
    reply_markup: {
      inline_keyboard: [
        [{ text: `審核結果：${label(prefs.review)}`, callback_data: 'PREF:review' }],
        [{ text: `系統服務：${label(prefs.service)}`, callback_data: 'PREF:service' }],
        [{ text: `活動公告：${promotionLabel}`, callback_data: 'PREF:promotion' }],
        [{ text: '⬅️ 返回主選單', callback_data: 'MENU' }]
      ]
    }
  });
}

async function togglePreference(chatId, telegramUserId, key, env) {
  if (!['review', 'service', 'promotion'].includes(key)) return;
  const binding = await bindingByTelegramId(telegramUserId, env);
  if (!binding) return sendAccountStatus(chatId, telegramUserId, env);

  const member = await getDocument(env, appPath('applications', binding.data.userId));
  if (!member) throw httpError(404, '找不到會員帳號');

  const current = member.data.telegramNotificationPreferences || {
    security: true,
    review: true,
    service: true,
    promotion: false
  };
  current[key] = key === 'promotion' ? current[key] !== true : current[key] === false;
  current.security = true;
  current.updatedAtMs = Date.now();

  await patchDocument(env, member.path, { telegramNotificationPreferences: current });
  return showTelegramPreferences(chatId, telegramUserId, env);
}

async function sendStatus(chatId, telegramUserId, env) {
  const binding = await bindingByTelegramId(telegramUserId, env);
  if (!binding) return sendAccountStatus(chatId, telegramUserId, env);

  const userId = binding.data.userId;
  const member = await getDocument(env, appPath('applications', userId));
  const [passwords, accounts] = await Promise.all([
    queryCollection(env, 'password_reset_requests', [{ field: 'userId', value: userId }], 20),
    queryCollection(env, 'account_requests', [{ field: 'userId', value: userId }], 20)
  ]);

  const latest = rows => rows.sort((a, b) => Number(b.data.createdAtMs || 0) - Number(a.data.createdAtMs || 0))[0]?.data || null;
  const state = value => {
    const labels = {
      pending: '審核中', approved: '已通過', active: '正常', rejected: '未通過',
      completed: '已完成', cancelled: '已取消', issuing: '處理中', inactive: '未啟用'
    };
    const key = String(value || '');
    return labels[key] || key || '無申請';
  };

  const data = member?.data || {};
  const spec = data.isSpecElite === true ? 'approved' : (data.specEliteStatus || 'inactive');

  return telegramApi(env, 'sendMessage', {
    chat_id: String(chatId),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    text: `<b>📋 SecretRoom 申請進度</b>\n\n會員帳號：@${escapeHtml(userId)}\n帳號狀態：${escapeHtml(state(data.status))}\n頭像審核：${escapeHtml(state(data.avatarStatus || 'approved'))}\n黃金 Spec：${escapeHtml(state(spec))}\n忘記密碼：${escapeHtml(state(latest(passwords)?.status))}\n帳號異動：${escapeHtml(state(latest(accounts)?.status))}\nTelegram 綁定：已完成\n\n最後更新：${formatTime(Date.now())}`,
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔄 重新查詢', callback_data: 'STATUS' }],
        [{ text: '🌐 開啟 SecretRoom', url: env.SECRETROOM_URL || '' }],
        [{ text: '⬅️ 返回主選單', callback_data: 'MENU' }]
      ]
    }
  });
}

replaceSection('async function sendHelp(', 'async function bindingByTelegramId(', sendHelp.toString());
replaceSection('async function showTelegramPreferences(', 'async function sendStatus(', [showTelegramPreferences.toString(), togglePreference.toString()].join('\n\n'));
replaceSection('async function sendStatus(', 'function verifyTelegramSecret(', sendStatus.toString());

if (!source.includes('帳號安全通知：固定開啟')) throw new Error('Preference center was not installed');
if (!source.includes('黃金 Spec')) throw new Error('Status card was not installed');

await writeFile(workerUrl, source, 'utf8');
console.log('Upgraded Telegram preferences and status phase 3');
