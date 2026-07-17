/**
 * 部署與診斷。
 */
function setupTelegramWebhook() {
  const workerUrl = normalizeHttpsUrl_(
    getRequiredProperty_('CLOUDFLARE_WORKER_URL'),
    'CLOUDFLARE_WORKER_URL'
  );
  const secret = getRequiredProperty_('CLOUDFLARE_WEBHOOK_SECRET');
  validateSecretToken_(secret);

  callTelegramApi_('setWebhook', {
    url: workerUrl,
    secret_token: secret,
    allowed_updates: ['message', 'edited_message', 'callback_query', 'my_chat_member'],
    drop_pending_updates: true
  });

  setupTelegramCommands();
  return getTelegramWebhookInfo();
}


function setupTelegramCommands() {
  return callTelegramApi_('setMyCommands', {
    commands: [
      { command: 'menu', description: '開啟 SecretRoom 會員服務' },
      { command: 'bind', description: '帳號與綁定' },
      { command: 'reset', description: '忘記密碼' },
      { command: 'settings', description: 'Telegram 通知設定' },
      { command: 'requests', description: '我的申請進度' },
      { command: 'help', description: '使用說明' }
    ]
  });
}


function getTelegramWebhookInfo() {
  const result = callTelegramApi_('getWebhookInfo', {});
  console.log(JSON.stringify(result, null, 2));
  return result;
}


function deleteTelegramWebhook() {
  return callTelegramApi_('deleteWebhook', { drop_pending_updates: true });
}


function testTelegramBotConnection() {
  const result = callTelegramApi_('getMe', {});
  console.log(JSON.stringify(result, null, 2));
  return result;
}


function testFirebaseServiceAccount() {
  const projectId = getRequiredProperty_('FIREBASE_PROJECT_ID');
  const response = firestoreFetch_(
    'get',
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(FIRESTORE_DATABASE_ID)}`
  );
  console.log(response.statusCode + ' ' + response.text);
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error('Firebase Service Account 測試失敗。');
  }
  return JSON.parse(response.text);
}


function installTelegramMaintenanceTrigger() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'runTelegramMaintenance') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('runTelegramMaintenance')
    .timeBased()
    .everyMinutes(1)
    .create();

  console.log('已建立每分鐘 Telegram 外送通知維護觸發器。');
}


function removeTelegramMaintenanceTrigger() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'runTelegramMaintenance') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}


function retryFailedTelegramOutbox() {
  const failed = queryDocuments_('telegram_outbox', [
    { field: 'status', op: 'EQUAL', value: 'failed' }
  ]);
  failed.forEach(item => {
    firestoreSetDocument_('telegram_outbox', item.__documentId, {
      status: 'pending',
      attemptCount: 0,
      nextAttemptAtMs: 0,
      lastError: '',
      retriedAtMs: Date.now()
    }, true);
  });
  return failed.length;
}


function checkTelegramConfiguration() {
  const required = [
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_WEBHOOK_KEY',
    'WEB_APP_URL',
    'CLOUDFLARE_WORKER_URL',
    'CLOUDFLARE_WEBHOOK_SECRET',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_APP_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY'
  ];
  const properties = PropertiesService.getScriptProperties().getProperties();
  const result = {};
  required.forEach(name => {
    const value = String(properties[name] || '').trim();
    result[name] = { configured: Boolean(value), length: value.length };
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}


/**
 * 共用小工具。
 */
function getRequiredProperty_(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`尚未設定指令碼屬性：${name}`);
  return normalized;
}


function getOptionalProperty_(name, fallback) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  return String(value || '').trim() || fallback || '';
}


function getSecretRoomUrl_() {
  return normalizeHttpsUrl_(
    getOptionalProperty_('SECRETROOM_URL', 'https://5j1u35k6.github.io/SecretRoom/'),
    'SECRETROOM_URL'
  );
}


function getAdminUrl_() {
  return getSecretRoomUrl_().replace(/\/?$/, '/') + 'portal_sr_x892.html';
}


function getAdminChatIds_() {
  return getOptionalProperty_('TELEGRAM_ADMIN_CHAT_IDS', '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
}


function appendQuery_(url, query) {
  return String(url).indexOf('?') >= 0
    ? String(url) + '&' + query
    : String(url) + '?' + query;
}


function normalizeHttpsUrl_(value, propertyName) {
  const url = String(value || '').trim().replace(/\/+$/, '');
  if (!url.startsWith('https://')) {
    throw new Error(`${propertyName} 必須是 https:// 網址。`);
  }
  return url;
}


function validateSecretToken_(value) {
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(value)) {
    throw new Error('Webhook Secret 只能包含英文字母、數字、底線與連字號。');
  }
}


function formatDateTime_(value) {
  const number = Number(value || 0);
  if (!number) return '未記錄';
  return Utilities.formatDate(new Date(number), 'Asia/Taipei', 'yyyy/MM/dd HH:mm');
}


function escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
