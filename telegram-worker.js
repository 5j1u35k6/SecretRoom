/**
 * SecretRoom Telegram Gateway
 * Cloudflare Worker（免費方案可用）
 *
 * 環境變數／Secrets：
 * TELEGRAM_WEBHOOK_SECRET
 * APPS_SCRIPT_WEBHOOK_URL
 * BOT_BACKEND_SECRET
 * FIREBASE_PROJECT_ID
 * FIREBASE_CLIENT_EMAIL
 * FIREBASE_PRIVATE_KEY
 * SECRETROOM_ORIGIN
 */

const APP_ID = 'secretg-production-node-tw';
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=UTF-8' };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders_(request, env) });
    }

    try {
      if (url.pathname === '/telegram') {
        return handleTelegramWebhook_(request, env, ctx);
      }

      if (url.pathname === '/health') {
        return json_({ ok: true, service: 'SecretRoom Telegram Gateway' }, 200, request, env);
      }

      if (url.pathname === '/api/member/binding/start' && request.method === 'POST') {
        return startBinding_(request, env);
      }

      if (url.pathname === '/api/member/password-reset/request' && request.method === 'POST') {
        return createPasswordResetRequest_(request, env);
      }

      if (url.pathname === '/api/bot/action' && request.method === 'POST') {
        return handleBotAction_(request, env);
      }

      return json_({ ok: false, error: 'Not found' }, 404, request, env);
    } catch (error) {
      console.error('Gateway error:', error);
      return json_({ ok: false, error: error.message || String(error) }, 500, request, env);
    }
  }
};

async function handleTelegramWebhook_(request, env, ctx) {
  if (request.method !== 'POST') {
    return json_({ ok: true, service: 'SecretRoom Telegram Webhook Proxy' });
  }

  const receivedSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
  if (!env.TELEGRAM_WEBHOOK_SECRET || receivedSecret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return json_({ ok: false, error: 'Unauthorized' }, 403);
  }

  const body = await request.text();
  if (!body) return json_({ ok: false, error: 'Empty request body' }, 400);

  ctx.waitUntil(forwardToAppsScript_(body, env));
  return json_({ ok: true });
}

async function forwardToAppsScript_(body, env) {
  if (!env.APPS_SCRIPT_WEBHOOK_URL) throw new Error('尚未設定 APPS_SCRIPT_WEBHOOK_URL');
  const response = await fetch(env.APPS_SCRIPT_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    redirect: 'follow'
  });
  const responseText = await response.text();
  console.log('Apps Script:', response.status, responseText);
  if (!response.ok) throw new Error(`Apps Script 回傳錯誤：${response.status}`);
}

async function startBinding_(request, env) {
  assertOrigin_(request, env);
  const body = await readJson_(request);
  const userId = cleanId_(body.userId);
  const password = String(body.password || '');
  if (!userId || !password) return json_({ ok: false, error: '請輸入帳號與密碼' }, 400, request, env);

  const memberPath = `secretg_apps/${APP_ID}/applications/${userId}`;
  const member = await firestoreGet_(memberPath, env);
  if (!member) return json_({ ok: false, error: '帳號或密碼不正確' }, 401, request, env);
  if (String(member.password || '') !== password) return json_({ ok: false, error: '帳號或密碼不正確' }, 401, request, env);
  if (!['approved', 'active'].includes(String(member.status || '').toLowerCase())) {
    return json_({ ok: false, error: '此帳號目前不能進行 Telegram 綁定' }, 403, request, env);
  }

  const rawToken = randomToken_();
  const tokenHash = await sha256Hex_(rawToken);
  const now = Date.now();
  const expiresAtMs = now + 10 * 60 * 1000;

  await firestoreSet_(`secretg_apps/${APP_ID}/telegram_binding_tokens/${tokenHash}`, {
    userId,
    tokenHash,
    status: 'pending',
    createdAtMs: now,
    expiresAtMs,
    usedAtMs: null
  }, env);

  const botName = String(env.BOT_USERNAME || 'SecretRoomtwBot').replace(/^@/, '');
  return json_({
    ok: true,
    expiresAtMs,
    deepLink: `https://t.me/${botName}?start=bind_${rawToken}`
  }, 200, request, env);
}

async function createPasswordResetRequest_(request, env) {
  assertOrigin_(request, env);
  const body = await readJson_(request);
  const userId = cleanId_(body.userId);
  if (!userId) return json_({ ok: false, error: '請輸入會員帳號' }, 400, request, env);

  const member = await firestoreGet_(`secretg_apps/${APP_ID}/applications/${userId}`, env);
  /* 避免帳號枚舉：無論帳號是否存在，都回傳一致訊息。 */
  if (!member || !['approved', 'active'].includes(String(member.status || '').toLowerCase())) {
    return json_({ ok: true, message: '若帳號符合資格，申請已建立。請回 Telegram 繼續。' }, 200, request, env);
  }

  const now = Date.now();
  const requestId = crypto.randomUUID();
  await firestoreSet_(`secretg_apps/${APP_ID}/password_reset_requests/${requestId}`, {
    userId,
    status: 'pending_telegram',
    channel: 'telegram',
    createdAtMs: now,
    expiresAtMs: now + 15 * 60 * 1000,
    consumedAtMs: null
  }, env);

  return json_({ ok: true, message: '申請已建立，請在 15 分鐘內回 Telegram 點選「忘記密碼」。' }, 200, request, env);
}

async function handleBotAction_(request, env) {
  const secret = request.headers.get('X-SecretRoom-Bot-Secret') || '';
  if (!env.BOT_BACKEND_SECRET || secret !== env.BOT_BACKEND_SECRET) {
    return json_({ ok: false, error: 'Unauthorized' }, 403);
  }

  const body = await readJson_(request);
  const action = String(body.action || '');
  const telegramUserId = String(body.telegramUserId || '');
  const telegramChatId = String(body.telegramChatId || '');

  if (action === 'complete_binding') {
    const rawToken = String(body.token || '').replace(/^bind_/, '');
    const tokenHash = await sha256Hex_(rawToken);
    const tokenPath = `secretg_apps/${APP_ID}/telegram_binding_tokens/${tokenHash}`;
    const token = await firestoreGet_(tokenPath, env);
    if (!token || token.status !== 'pending' || Number(token.expiresAtMs || 0) < Date.now()) {
      return json_({ ok: false, error: '綁定連結無效或已過期' }, 400);
    }

    const memberPath = `secretg_apps/${APP_ID}/applications/${token.userId}`;
    const member = await firestoreGet_(memberPath, env);
    if (!member) return json_({ ok: false, error: '找不到會員帳號' }, 404);

    const existing = await findMemberByTelegramId_(telegramUserId, env);
    if (existing && existing.id !== token.userId) {
      return json_({ ok: false, error: '此 Telegram 帳號已綁定其他會員' }, 409);
    }
    if (member.telegramBinding?.telegramUserId && String(member.telegramBinding.telegramUserId) !== telegramUserId) {
      return json_({ ok: false, error: '此會員帳號已綁定其他 Telegram' }, 409);
    }

    const now = Date.now();
    await firestorePatch_(memberPath, {
      telegramBinding: {
        telegramUserId,
        telegramChatId,
        username: String(body.username || ''),
        firstName: String(body.firstName || ''),
        status: 'active',
        boundAtMs: now,
        boundBy: 'telegram_deep_link'
      },
      telegramInfo: {
        id: telegramUserId,
        username: String(body.username || ''),
        first_name: String(body.firstName || '')
      },
      telegramNotificationPreferences: {
        security: true,
        review: true,
        service: true,
        promotion: false,
        updatedAtMs: now
      }
    }, env);
    await firestorePatch_(tokenPath, { status: 'used', usedAtMs: now, usedByTelegramUserId: telegramUserId }, env);
    return json_({ ok: true, userId: token.userId });
  }

  const boundMember = await findMemberByTelegramId_(telegramUserId, env);
  if (!boundMember) return json_({ ok: false, error: '尚未綁定 SecretRoom 帳號' }, 404);

  if (action === 'account_status') {
    return json_({ ok: true, member: safeMember_(boundMember) });
  }

  if (action === 'password_reset_check') {
    const requests = await firestoreQuery_('password_reset_requests', [
      ['userId', 'EQUAL', boundMember.id],
      ['status', 'EQUAL', 'pending_telegram']
    ], env);
    const active = requests.find(item => Number(item.expiresAtMs || 0) >= Date.now());
    return json_({ ok: true, request: active || null });
  }

  if (action === 'password_reset_complete') {
    const requestId = String(body.requestId || '');
    const requestPath = `secretg_apps/${APP_ID}/password_reset_requests/${requestId}`;
    const resetRequest = await firestoreGet_(requestPath, env);
    if (!resetRequest || resetRequest.userId !== boundMember.id || resetRequest.status !== 'pending_telegram') {
      return json_({ ok: false, error: '找不到可處理的忘記密碼申請' }, 404);
    }
    if (Number(resetRequest.expiresAtMs || 0) < Date.now()) {
      return json_({ ok: false, error: '忘記密碼申請已過期' }, 410);
    }

    const now = Date.now();
    const expiresAtMs = now + 10 * 60 * 1000;
    const temporaryPassword = temporaryPassword_();
    await firestorePatch_(`secretg_apps/${APP_ID}/applications/${boundMember.id}`, {
      password: temporaryPassword,
      mustChangePassword: true,
      forcePasswordChange: true,
      tempPasswordActive: true,
      passwordChangeRequired: true,
      tempPasswordIssuedAtMs: now,
      tempPasswordExpiresAtMs: expiresAtMs,
      temporaryCredentialExpiresAtMs: expiresAtMs,
      passwordChangedAtMs: now,
      passwordChangedBy: 'telegram_self_service',
      lastPasswordChangeMethod: 'telegram_self_service'
    }, env);
    await firestorePatch_(requestPath, {
      status: 'completed',
      completedAtMs: now,
      consumedAtMs: now,
      temporaryCredentialIssued: true,
      temporaryCredentialExpiresAtMs: expiresAtMs
    }, env);
    return json_({ ok: true, temporaryPassword, expiresAtMs });
  }

  if (action === 'update_preferences') {
    const preferences = {
      security: true,
      review: body.preferences?.review !== false,
      service: body.preferences?.service !== false,
      promotion: body.preferences?.promotion === true,
      updatedAtMs: Date.now()
    };
    await firestorePatch_(`secretg_apps/${APP_ID}/applications/${boundMember.id}`, {
      telegramNotificationPreferences: preferences
    }, env);
    return json_({ ok: true, preferences });
  }

  if (action === 'request_status') {
    const [passwordRequests, accountRequests] = await Promise.all([
      firestoreQuery_('password_reset_requests', [['userId', 'EQUAL', boundMember.id]], env),
      firestoreQuery_('account_requests', [['userId', 'EQUAL', boundMember.id]], env)
    ]);
    return json_({
      ok: true,
      status: {
        membership: boundMember.status || 'unknown',
        avatar: boundMember.avatarStatus || 'none',
        spec: boundMember.specEliteStatus || 'none',
        passwordReset: newestStatus_(passwordRequests),
        accountRequest: newestStatus_(accountRequests)
      }
    });
  }

  return json_({ ok: false, error: 'Unknown action' }, 400);
}

function safeMember_(member) {
  return {
    id: member.id,
    nickname: member.nickname || '',
    status: member.status || '',
    telegramBinding: member.telegramBinding || null,
    telegramNotificationPreferences: member.telegramNotificationPreferences || null
  };
}

function newestStatus_(items) {
  const sorted = [...items].sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
  return sorted[0]?.status || 'none';
}

async function findMemberByTelegramId_(telegramUserId, env) {
  if (!telegramUserId) return null;
  const results = await firestoreQuery_('applications', [
    ['telegramBinding.telegramUserId', 'EQUAL', telegramUserId]
  ], env);
  return results[0] || null;
}

async function firestoreGet_(path, env) {
  const response = await firestoreFetch_(path, { method: 'GET' }, env);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore GET 失敗：${response.status}`);
  return decodeDocument_(await response.json());
}

async function firestoreSet_(path, data, env) {
  const response = await firestoreFetch_(path, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify({ fields: encodeMap_(data) })
  }, env);
  if (!response.ok) throw new Error(`Firestore SET 失敗：${response.status} ${await response.text()}`);
}

async function firestorePatch_(path, data, env) {
  const masks = Object.keys(data).map(key => `updateMask.fieldPaths=${encodeURIComponent(key)}`).join('&');
  const response = await firestoreFetch_(`${path}?${masks}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify({ fields: encodeMap_(data) })
  }, env);
  if (!response.ok) throw new Error(`Firestore PATCH 失敗：${response.status} ${await response.text()}`);
}

async function firestoreQuery_(collectionId, filters, env) {
  const structuredQuery = {
    from: [{ collectionId }],
    where: filters.length === 1
      ? fieldFilter_(filters[0])
      : { compositeFilter: { op: 'AND', filters: filters.map(f => ({ fieldFilter: fieldFilter_(f).fieldFilter })) } }
  };
  const token = await getGoogleAccessToken_(env);
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/secretg_apps/${APP_ID}:runQuery`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { ...JSON_HEADERS, Authorization: `Bearer ${token}` },
    body: JSON.stringify({ structuredQuery })
  });
  if (!response.ok) throw new Error(`Firestore QUERY 失敗：${response.status} ${await response.text()}`);
  const rows = await response.json();
  return rows.filter(row => row.document).map(row => decodeDocument_(row.document));
}

function fieldFilter_([fieldPath, op, value]) {
  return { fieldFilter: { field: { fieldPath }, op, value: encodeValue_(value) } };
}

async function firestoreFetch_(path, init, env) {
  const token = await getGoogleAccessToken_(env);
  const separator = path.includes('?') ? '&' : '?';
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}${separator}alt=json`;
  return fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } });
}

let cachedGoogleToken_ = null;
async function getGoogleAccessToken_(env) {
  if (cachedGoogleToken_ && cachedGoogleToken_.expiresAt > Date.now() + 60000) return cachedGoogleToken_.token;
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url_(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64Url_(JSON.stringify({
    iss: env.FIREBASE_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));
  const signingInput = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    'pkcs8', pemToArrayBuffer_(env.FIREBASE_PRIVATE_KEY),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  const assertion = `${signingInput}.${base64UrlBytes_(new Uint8Array(signature))}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion })
  });
  if (!response.ok) throw new Error(`Google OAuth 失敗：${response.status} ${await response.text()}`);
  const result = await response.json();
  cachedGoogleToken_ = { token: result.access_token, expiresAt: Date.now() + Number(result.expires_in || 3600) * 1000 };
  return result.access_token;
}

function encodeMap_(object) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, encodeValue_(value)]));
}
function encodeValue_(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue_) } };
  return { mapValue: { fields: encodeMap_(value) } };
}
function decodeDocument_(document) {
  const fields = decodeFields_(document.fields || {});
  fields.id = document.name.split('/').pop();
  return fields;
}
function decodeFields_(fields) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue_(value)]));
}
function decodeValue_(value) {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return value.timestampValue;
  if ('mapValue' in value) return decodeFields_(value.mapValue.fields || {});
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue_);
  return null;
}

function assertOrigin_(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.SECRETROOM_ORIGIN || '').replace(/\/$/, '');
  if (!allowed || origin !== allowed) throw new Error('Origin not allowed');
}
function corsHeaders_(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.SECRETROOM_ORIGIN || '').replace(/\/$/, '');
  return {
    'Access-Control-Allow-Origin': origin === allowed ? origin : allowed,
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-SecretRoom-Bot-Secret',
    'Vary': 'Origin'
  };
}
function json_(data, status = 200, request = null, env = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...(request && env ? corsHeaders_(request, env) : {}) }
  });
}
async function readJson_(request) {
  try { return await request.json(); } catch { throw new Error('JSON 格式不正確'); }
}
function cleanId_(value) { return String(value || '').trim().replace(/^@/, '').slice(0, 80); }
function randomToken_() { return base64UrlBytes_(crypto.getRandomValues(new Uint8Array(32))); }
function temporaryPassword_() {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return `SR-${base64UrlBytes_(bytes).slice(0, 4).toUpperCase()}-${base64UrlBytes_(bytes).slice(4, 8).toUpperCase()}!`;
}
async function sha256Hex_(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function base64Url_(text) { return base64UrlBytes_(new TextEncoder().encode(text)); }
function base64UrlBytes_(bytes) {
  let binary = ''; bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function pemToArrayBuffer_(pem) {
  const normalized = String(pem || '').replace(/\\n/g, '\n');
  const base64 = normalized.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const binary = atob(base64);
  return Uint8Array.from(binary, char => char.charCodeAt(0)).buffer;
}
