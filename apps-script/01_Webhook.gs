/**
 * 瀏覽器健康檢查。
 */
function doGet() {
  return jsonResponse_({
    ok: true,
    service: 'SecretRoom Telegram Bot',
    mode: 'cloudflare-worker-webhook',
    phase: '1-6',
    timestamp: new Date().toISOString()
  });
}


/**
 * Cloudflare Worker 轉送 Telegram Update 的入口。
 */
function doPost(e) {
  const requestId = Utilities.getUuid().slice(0, 8);
  let cacheKey = '';

  try {
    console.log(`[${requestId}] ① doPost 開始`);
    validateWebhookRequest_(e);

    const update = parseUpdate_(e);
    const updateId = getUpdateId_(update);
    console.log(`[${requestId}] ② update_id：${updateId || '無'}`);
    console.log(`[${requestId}] ③ 類型：${getUpdateType_(update)}`);

    cacheKey = beginUpdate_(update);
    if (cacheKey === null) {
      console.log(`[${requestId}] ④ 忽略重複 Update`);
      return jsonResponse_({ ok: true, duplicate: true, request_id: requestId });
    }

    handleUpdate_(update);
    finishUpdate_(cacheKey);
    console.log(`[${requestId}] ⑤ Update 處理完成`);

    return jsonResponse_({ ok: true, handled: true, request_id: requestId });
  } catch (error) {
    rollbackUpdate_(cacheKey);
    console.error(
      `[${requestId}] ❌ ` +
      (error && error.stack ? error.stack : String(error))
    );

    return jsonResponse_({
      ok: true,
      handled: false,
      request_id: requestId,
      error: String(error && error.message ? error.message : error)
    });
  }
}


/**
 * 驗證 Cloudflare Worker 轉送網址上的 ?key=。
 */
function validateWebhookRequest_(e) {
  const savedKey = getRequiredProperty_('TELEGRAM_WEBHOOK_KEY');
  const receivedKey = String(
    e && e.parameter && e.parameter.key
      ? e.parameter.key
      : ''
  ).trim();

  if (!receivedKey) {
    throw new Error('Webhook 缺少 key。請檢查 Cloudflare 的 APPS_SCRIPT_WEBHOOK_URL。');
  }

  if (receivedKey !== savedKey) {
    throw new Error('Webhook Key 不相符。');
  }

  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Webhook POST 內容為空。');
  }
}


function parseUpdate_(e) {
  try {
    const update = JSON.parse(e.postData.contents);
    if (!update || typeof update !== 'object') throw new Error('Update 不是物件。');
    return update;
  } catch (error) {
    throw new Error('Telegram Update JSON 解析失敗：' + String(error.message || error));
  }
}


function getUpdateId_(update) {
  return update && update.update_id !== undefined
    ? String(update.update_id)
    : '';
}


function getUpdateType_(update) {
  const types = ['message', 'edited_message', 'callback_query', 'my_chat_member'];
  for (const type of types) {
    if (update && update[type]) return type;
  }
  return 'unsupported';
}


function beginUpdate_(update) {
  const updateId = getUpdateId_(update);
  if (!updateId) return '';

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    const cache = CacheService.getScriptCache();
    const cacheKey = TELEGRAM_UPDATE_CACHE_PREFIX + updateId;
    if (cache.get(cacheKey)) return null;
    cache.put(cacheKey, 'processing', 120);
    return cacheKey;
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}


function finishUpdate_(cacheKey) {
  if (!cacheKey) return;
  CacheService.getScriptCache().put(
    cacheKey,
    'done',
    TELEGRAM_UPDATE_CACHE_SECONDS
  );
}


function rollbackUpdate_(cacheKey) {
  if (!cacheKey) return;
  CacheService.getScriptCache().remove(cacheKey);
}


/**
 * Telegram Update 分流。
 */
function handleUpdate_(update) {
  if (update.callback_query) {
    handleCallbackQuery_(update.callback_query);
    return;
  }

  if (update.message) {
    handleMessage_(update.message);
    return;
  }

  if (update.edited_message) {
    handleMessage_(update.edited_message);
    return;
  }

  if (update.my_chat_member) {
    console.log('Bot 聊天成員狀態更新：' + JSON.stringify(update.my_chat_member));
    return;
  }

  console.log('未處理的 Update：' + JSON.stringify(update));
}
