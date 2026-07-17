/**
 * SecretRoom unified Cloudflare Worker.
 * Telegram webhook, Firebase custom auth, privileged Firestore operations,
 * password recovery with rollback, and Telegram queue retry.
 */
const APP_ID = 'secretg-production-node-tw';
const DB_ID = '(default)';
const CUSTOM_TOKEN_AUD = 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';
const OAUTH_SCOPE = 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform';
const encoder = new TextEncoder();
let oauthCache = { token: '', expiresAt: 0 };
let serviceAccountCache = null;
const memoryRate = new Map();

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return corsResponse(request, env, null, 204);
    try {
      if (url.pathname.startsWith('/api/')) {
        const result = await handleApi(request, env, url);
        return corsResponse(request, env, result);
      }
      if (request.method === 'GET') {
        return json({ ok: true, service: 'SecretRoom Telegram + Auth Backend', time: new Date().toISOString() });
      }
      if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
      verifyTelegramSecret(request, env);
      const update = await request.json();
      ctx.waitUntil(handleTelegramUpdate(update, env).catch(error => console.error('Telegram update failed', error)));
      return json({ ok: true });
    } catch (error) {
      console.error('Worker request failed', error);
      const status = Number(error.status || 500);
      return corsResponse(request, env, { ok: false, error: error.message || String(error) }, status);
    }
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(processTelegramQueue(env, 20));
  }
};

async function handleApi(request, env, url) {
  const body = request.method === 'GET' ? {} : await readJson(request);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (url.pathname === '/api/auth/member-login') {
    rateLimit(`member-login:${ip}`, 12, 10 * 60_000);
    return memberLogin(body, env);
  }
  if (url.pathname === '/api/auth/admin-login') {
    rateLimit(`admin-login:${ip}`, 8, 10 * 60_000);
    return adminLogin(body, env);
  }
  if (url.pathname === '/api/auth/register') {
    rateLimit(`register:${ip}`, 5, 60 * 60_000);
    return registerMember(body, env);
  }
  if (url.pathname === '/api/auth/request-password-reset') {
    rateLimit(`reset:${ip}`, 8, 60 * 60_000);
    return createPasswordResetRequest(body, env);
  }

  const identity = await verifyFirebaseIdToken(request, env);
  if (url.pathname === '/api/member/change-password') return changeMemberPassword(identity, body, env);
  if (url.pathname === '/api/member/binding-link') return createBindingLink(identity, env);
  if (url.pathname === '/api/member/preferences') return savePreferences(identity, body, env);
  if (url.pathname === '/api/member/status') return memberStatus(identity, env);
  if (url.pathname === '/api/admin/telegram-notify') return adminTelegramNotify(identity, body, env);
  if (url.pathname === '/api/admin/process-queue') {
    requireAdmin(identity);
    return processTelegramQueue(env, 30);
  }
  if (url.pathname === '/api/admin/migrate-credentials') return migrateCredentials(identity, body, env);
  throw httpError(404, 'Unknown API route');
}

function corsResponse(request, env, payload, status = 200) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || 'https://5j1u35k6.github.io')
    .split(',').map(value => value.trim()).filter(Boolean);
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || 'https://5j1u35k6.github.io';
  const headers = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  };
  return new Response(payload === null ? null : JSON.stringify(payload), { status, headers });
}
function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}
async function readJson(request) {
  try { return await request.json(); } catch { throw httpError(400, 'Invalid JSON body'); }
}
function httpError(status, message) {
  const error = new Error(message); error.status = status; return error;
}
function rateLimit(key, maximum, windowMs) {
  const now = Date.now();
  const item = memoryRate.get(key);
  if (!item || now - item.startedAt > windowMs) {
    memoryRate.set(key, { count: 1, startedAt: now }); return;
  }
  item.count += 1;
  if (item.count > maximum) throw httpError(429, '操作過於頻繁，請稍後再試');
}

function serviceAccount(env) {
  if (serviceAccountCache) return serviceAccountCache;
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) throw httpError(500, 'FIREBASE_SERVICE_ACCOUNT_JSON 未設定');
  try {
    const value = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (!value.client_email || !value.private_key) throw new Error('missing fields');
    serviceAccountCache = value;
    return value;
  } catch {
    throw httpError(500, 'FIREBASE_SERVICE_ACCOUNT_JSON 格式錯誤');
  }
}
function projectId(env) {
  return env.FIREBASE_PROJECT_ID || serviceAccount(env).project_id || 'secretroom-ef728';
}
function databaseRoot(env) {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId(env))}/databases/${encodeURIComponent(DB_ID)}`;
}
function documentRoot(env) { return `${databaseRoot(env)}/documents`; }
function encodePath(path) { return String(path).split('/').map(encodeURIComponent).join('/'); }
function documentName(env, path) {
  return `projects/${projectId(env)}/databases/${DB_ID}/documents/${path}`;
}
function appPath(collection, id = '') {
  return `secretg_apps/${APP_ID}/${collection}${id ? `/${id}` : ''}`;
}

async function oauthToken(env) {
  if (oauthCache.token && Date.now() < oauthCache.expiresAt - 60_000) return oauthCache.token;
  const sa = serviceAccount(env);
  const now = Math.floor(Date.now() / 1000);
  const assertion = await signJwt({
    iss: sa.client_email, sub: sa.client_email, scope: OAUTH_SCOPE,
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600
  }, sa.private_key);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion
    })
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw httpError(500, `Google OAuth failed: ${data.error_description || data.error || response.status}`);
  oauthCache = { token: data.access_token, expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000 };
  return oauthCache.token;
}
async function firestoreFetch(env, url, options = {}) {
  const token = await oauthToken(env);
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  if (response.status === 404) return null;
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw httpError(response.status, data.error?.message || `Firestore ${response.status}`);
  return data;
}

function fsValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(fsValue) } };
  const fields = {};
  Object.entries(value).forEach(([key, item]) => { if (item !== undefined) fields[key] = fsValue(item); });
  return { mapValue: { fields } };
}
function fsFields(object) {
  const fields = {};
  Object.entries(object || {}).forEach(([key, value]) => { if (value !== undefined) fields[key] = fsValue(value); });
  return fields;
}
function fromFsValue(value) {
  if (!value) return null;
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fromFsValue);
  if ('mapValue' in value) return fromFsFields(value.mapValue.fields || {});
  return null;
}
function fromFsFields(fields) {
  const object = {};
  Object.entries(fields || {}).forEach(([key, value]) => object[key] = fromFsValue(value));
  return object;
}
function parseDocument(document) {
  if (!document) return null;
  const name = document.name || '';
  return { id: name.split('/').pop(), path: name.split('/documents/')[1] || '', updateTime: document.updateTime || '', data: fromFsFields(document.fields || {}) };
}
async function getDocument(env, path) {
  return parseDocument(await firestoreFetch(env, `${documentRoot(env)}/${encodePath(path)}`));
}
async function createDocument(env, path, data) {
  const result = await firestoreFetch(env, `${documentRoot(env)}/${encodePath(path)}?currentDocument.exists=false`, {
    method: 'PATCH', body: JSON.stringify({ fields: fsFields(data) })
  });
  return parseDocument(result);
}
async function patchDocument(env, path, patch, mask = Object.keys(patch)) {
  const params = new URLSearchParams();
  mask.forEach(field => params.append('updateMask.fieldPaths', field));
  const result = await firestoreFetch(env, `${documentRoot(env)}/${encodePath(path)}?${params}`, {
    method: 'PATCH', body: JSON.stringify({ fields: fsFields(patch) })
  });
  return parseDocument(result);
}
async function commitWrites(env, writes) {
  return firestoreFetch(env, `${databaseRoot(env)}/documents:commit`, {
    method: 'POST', body: JSON.stringify({ writes })
  });
}
function updateWrite(env, path, data, mask = Object.keys(data), precondition = null) {
  const write = { update: { name: documentName(env, path), fields: fsFields(data) }, updateMask: { fieldPaths: mask } };
  if (precondition) write.currentDocument = precondition;
  return write;
}
async function queryCollection(env, collectionId, filters = [], limit = 20) {
  let where = null;
  const clauses = filters.map(filter => ({ fieldFilter: { field: { fieldPath: filter.field }, op: filter.op || 'EQUAL', value: fsValue(filter.value) } }));
  if (clauses.length === 1) where = clauses[0];
  if (clauses.length > 1) where = { compositeFilter: { op: 'AND', filters: clauses } };
  const parent = `${documentRoot(env)}/${encodePath(`secretg_apps/${APP_ID}`)}:runQuery`;
  const rows = await firestoreFetch(env, parent, {
    method: 'POST',
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId }], ...(where ? { where } : {}), limit } })
  }) || [];
  return rows.filter(row => row.document).map(row => parseDocument(row.document));
}
function randomId(prefix = '') {
  return prefix + base64url(crypto.getRandomValues(new Uint8Array(18)));
}

async function hashPassword(password, salt = null, iterations = 160000) {
  const actualSalt = salt ? base64ToBytes(salt) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: actualSalt, iterations }, key, 256);
  return { scheme: 'pbkdf2-sha256', iterations, salt: bytesToBase64(actualSalt), hash: bytesToBase64(new Uint8Array(bits)) };
}
async function verifyHash(password, credential) {
  if (!credential?.hash || !credential?.salt) return false;
  const candidate = await hashPassword(password, credential.salt, Number(credential.iterations || 160000));
  return constantTimeEqual(candidate.hash, credential.hash);
}
function constantTimeEqual(a, b) {
  const aa = encoder.encode(String(a)); const bb = encoder.encode(String(b));
  if (aa.length !== bb.length) return false;
  let diff = 0; for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}

async function memberLogin(body, env) {
  const userId = cleanId(body.userId);
  const password = String(body.password || '');
  if (!userId || !password) throw httpError(400, '請輸入帳號與密碼');
  const member = await getDocument(env, appPath('applications', userId));
  if (!member) throw httpError(401, '帳號或密碼不正確');
  const status = String(member.data.status || '');
  if (!['pending', 'approved', 'active', 'rejected'].includes(status)) throw httpError(403, '帳號狀態不可登入');

  let credential = await getDocument(env, appPath('credentials', userId));
  let valid = false;
  let usedTemporary = false;
  if (credential) {
    valid = await verifyHash(password, credential.data);
    if (!valid && credential.data.temporaryHash && Number(credential.data.temporaryExpiresAtMs || 0) > Date.now()) {
      valid = await verifyHash(password, { hash: credential.data.temporaryHash, salt: credential.data.temporarySalt, iterations: credential.data.temporaryIterations || 160000 });
      usedTemporary = valid;
    }
  } else if (typeof member.data.password === 'string' && constantTimeEqual(member.data.password, password)) {
    const secure = await hashPassword(password);
    await commitWrites(env, [
      updateWrite(env, appPath('credentials', userId), { ...secure, userId, migratedAtMs: Date.now(), updatedAtMs: Date.now() }, ['scheme', 'iterations', 'salt', 'hash', 'userId', 'migratedAtMs', 'updatedAtMs'], { exists: false }),
      updateWrite(env, appPath('applications', userId), { credentialMigrated: true, credentialMigratedAtMs: Date.now() }, ['credentialMigrated', 'credentialMigratedAtMs', 'password'])
    ]);
    valid = true;
  }
  if (!valid) throw httpError(401, '帳號或密碼不正確');
  const mustChange = usedTemporary || member.data.mustChangePassword === true || member.data.passwordChangeRequired === true;
  const customToken = await createFirebaseCustomToken(env, `member:${userId}`, { secretroomUserId: userId, secretroomMember: true, passwordChangeRequired: mustChange });
  return { ok: true, customToken, userId, status, mustChangePassword: mustChange };
}

async function adminLogin(body, env) {
  const adminId = cleanId(body.adminId);
  const password = String(body.password || '');
  if (!adminId || !password) throw httpError(400, '請輸入管理員帳號與密碼');
  const admin = await getDocument(env, appPath('admins', adminId));
  if (!admin || admin.data.enabled === false || !isAdminData(admin.data)) throw httpError(401, '管理員帳號或密碼不正確');
  let credential = await getDocument(env, appPath('admin_credentials', adminId));
  let valid = credential ? await verifyHash(password, credential.data) : false;
  if (!credential && typeof admin.data.password === 'string' && constantTimeEqual(admin.data.password, password)) {
    const secure = await hashPassword(password);
    await commitWrites(env, [
      updateWrite(env, appPath('admin_credentials', adminId), { ...secure, adminId, migratedAtMs: Date.now(), updatedAtMs: Date.now() }, ['scheme', 'iterations', 'salt', 'hash', 'adminId', 'migratedAtMs', 'updatedAtMs'], { exists: false }),
      updateWrite(env, appPath('admins', adminId), { credentialMigrated: true, credentialMigratedAtMs: Date.now() }, ['credentialMigrated', 'credentialMigratedAtMs', 'password'])
    ]);
    valid = true;
  }
  if (!valid) throw httpError(401, '管理員帳號或密碼不正確');
  const customToken = await createFirebaseCustomToken(env, `admin:${adminId}`, { secretroomAdmin: true, secretroomAdminId: adminId });
  return { ok: true, customToken, adminId };
}
function isAdminData(data) {
  return data && (data.role === 'admin' || data.isAdmin === true || data.canAdmin === true || data.adminApproved === true);
}

async function registerMember(body, env) {
  const userId = cleanId(body.userId);
  const password = String(body.password || '');
  if (!/^[A-Za-z0-9_.-]{3,40}$/.test(userId)) throw httpError(400, '帳號格式不正確');
  validatePassword(password);
  if (await getDocument(env, appPath('applications', userId))) throw httpError(409, '該帳號已存在');
  const secure = await hashPassword(password);
  const now = Date.now();
  const application = {
    status: 'pending', nickname: String(body.nickname || '').trim(), email: String(body.email || '').trim(),
    birthYear: String(body.birthYear || ''), birthMonth: String(body.birthMonth || ''), birthDay: String(body.birthDay || ''),
    height: String(body.height || ''), weight: String(body.weight || ''), length: String(body.length || ''), girth: String(body.girth || ''),
    kinks: Array.isArray(body.kinks) ? body.kinks.map(String).slice(0, 30) : [], avatar: String(body.avatar || ''),
    avatarStatus: 'approved', credentialMigrated: true, createdAtMs: now,
    telegramNotificationPreferences: { security: true, review: true, service: true, promotion: false }
  };
  if (!application.nickname || !application.avatar) throw httpError(400, '暱稱與頭像為必填');
  await commitWrites(env, [
    updateWrite(env, appPath('applications', userId), application, Object.keys(application), { exists: false }),
    updateWrite(env, appPath('credentials', userId), { ...secure, userId, createdAtMs: now, updatedAtMs: now }, ['scheme', 'iterations', 'salt', 'hash', 'userId', 'createdAtMs', 'updatedAtMs'], { exists: false })
  ]);
  const customToken = await createFirebaseCustomToken(env, `member:${userId}`, { secretroomUserId: userId, secretroomMember: true, passwordChangeRequired: false });
  return { ok: true, customToken, userId, status: 'pending' };
}

async function createPasswordResetRequest(body, env) {
  const userId = cleanId(body.userId);
  if (!userId) throw httpError(400, '請輸入會員帳號');
  const member = await getDocument(env, appPath('applications', userId));
  if (!member || !['approved', 'active'].includes(String(member.data.status || ''))) return { ok: true, accepted: true };
  const rows = await queryCollection(env, 'password_reset_requests', [{ field: 'userId', value: userId }], 20);
  const existing = rows.find(row => row.data.status === 'pending' && Number(row.data.expiresAtMs || 0) > Date.now());
  if (existing) return { ok: true, accepted: true, reused: true };
  const id = randomId('reset_');
  const now = Date.now();
  await createDocument(env, appPath('password_reset_requests', id), { userId, status: 'pending', channel: 'telegram', requestedFrom: 'platform', createdAtMs: now, expiresAtMs: now + 30 * 60_000 });
  return { ok: true, accepted: true, requestId: id };
}

async function changeMemberPassword(identity, body, env) {
  const userId = requireMember(identity);
  const password = String(body.newPassword || '');
  validatePassword(password);
  const secure = await hashPassword(password);
  const now = Date.now();
  await commitWrites(env, [
    updateWrite(env, appPath('credentials', userId), { ...secure, temporaryHash: null, temporarySalt: null, temporaryIterations: null, temporaryExpiresAtMs: null, updatedAtMs: now }, ['scheme', 'iterations', 'salt', 'hash', 'temporaryHash', 'temporarySalt', 'temporaryIterations', 'temporaryExpiresAtMs', 'updatedAtMs']),
    updateWrite(env, appPath('applications', userId), { mustChangePassword: false, forcePasswordChange: false, tempPasswordActive: false, passwordChangeRequired: false, tempPasswordExpiresAtMs: null, temporaryCredentialExpiresAtMs: null, passwordChangedAtMs: now, lastPasswordChangeMethod: 'telegram_self_service' })
  ]);
  const customToken = await createFirebaseCustomToken(env, `member:${userId}`, { secretroomUserId: userId, secretroomMember: true, passwordChangeRequired: false });
  return { ok: true, customToken };
}

async function createBindingLink(identity, env) {
  const userId = requireMember(identity);
  const token = `bind_${randomId()}`;
  const id = randomId('bind_');
  const now = Date.now();
  await createDocument(env, appPath('telegram_binding_tokens', id), { userId, tokenHash: await sha256Hex(token), status: 'pending', createdAtMs: now, expiresAtMs: now + 10 * 60_000, source: 'platform_authenticated' });
  const bot = env.BOT_USERNAME || 'SecretRoomtwBot';
  return { ok: true, url: `https://t.me/${bot}?start=${encodeURIComponent(token)}`, expiresAtMs: now + 10 * 60_000 };
}
async function savePreferences(identity, body, env) {
  const userId = requireMember(identity);
  const preferences = { security: true, review: body.review !== false, service: body.service !== false, promotion: body.promotion === true, updatedAtMs: Date.now() };
  await patchDocument(env, appPath('applications', userId), { telegramNotificationPreferences: preferences });
  return { ok: true, preferences };
}
async function memberStatus(identity, env) {
  const userId = requireMember(identity);
  const member = await getDocument(env, appPath('applications', userId));
  const [passwords, accounts] = await Promise.all([
    queryCollection(env, 'password_reset_requests', [{ field: 'userId', value: userId }], 20),
    queryCollection(env, 'account_requests', [{ field: 'userId', value: userId }], 20)
  ]);
  const latest = rows => rows.sort((a, b) => Number(b.data.createdAtMs || 0) - Number(a.data.createdAtMs || 0))[0]?.data || null;
  return { ok: true, binding: member?.data.telegramBinding || null, preferences: member?.data.telegramNotificationPreferences || null, passwordReset: latest(passwords), accountRequest: latest(accounts) };
}

async function adminTelegramNotify(identity, body, env) {
  const adminId = requireAdmin(identity);
  let userId = cleanId(body.userId);
  if (!userId && body.toEmail) {
    const rows = await queryCollection(env, 'applications', [{ field: 'email', value: String(body.toEmail).trim() }], 3);
    userId = rows[0]?.id || '';
  }
  if (!userId) throw httpError(400, '缺少會員帳號');
  const id = randomId('tgq_');
  const item = { userId, category: String(body.category || 'service'), title: String(body.title || 'SecretRoom 通知').slice(0, 180), message: String(body.message || '').slice(0, 3500), required: body.required === true, status: 'pending', attempts: 0, createdAtMs: Date.now(), source: 'admin', createdBy: adminId };
  await createDocument(env, appPath('telegram_notification_queue', id), item);
  const result = await deliverQueueItem(env, { id, path: appPath('telegram_notification_queue', id), data: item });
  return { ok: true, queueId: id, ...result };
}
async function processTelegramQueue(env, limit = 20) {
  const rows = await queryCollection(env, 'telegram_notification_queue', [{ field: 'status', value: 'pending' }], limit);
  const results = [];
  for (const row of rows) results.push({ id: row.id, ...(await deliverQueueItem(env, row)) });
  return { ok: true, processed: results.length, results };
}
async function deliverQueueItem(env, row) {
  const item = row.data;
  const member = await getDocument(env, appPath('applications', item.userId));
  const binding = member?.data.telegramBinding || member?.data.telegramInfo || {};
  const chatId = binding.telegramChatId || binding.chatId || binding.id || member?.data.telegramUserId;
  const prefs = member?.data.telegramNotificationPreferences || {};
  const enabled = item.required === true || item.category === 'security' || prefs[item.category] !== false;
  if (!chatId || !enabled) {
    await patchDocument(env, row.path, { status: !chatId ? 'unbound' : 'skipped', completedAtMs: Date.now(), lastError: !chatId ? 'member_not_bound' : 'preference_disabled' });
    return { sent: false, reason: !chatId ? 'member_not_bound' : 'preference_disabled' };
  }
  try {
    const sent = await telegramApi(env, 'sendMessage', { chat_id: String(chatId), parse_mode: 'HTML', disable_web_page_preview: true, text: `<b>${escapeHtml(item.title)}</b>\n\n${escapeHtml(item.message)}` });
    await patchDocument(env, row.path, { status: 'sent', attempts: Number(item.attempts || 0) + 1, sentAtMs: Date.now(), telegramMessageId: sent.message_id || null, lastError: '' });
    await createDocument(env, appPath('telegram_delivery_logs', randomId('tgd_')), { queueId: row.id, userId: item.userId, category: item.category, status: 'sent', sentAtMs: Date.now(), telegramMessageId: sent.message_id || null });
    return { sent: true };
  } catch (error) {
    const attempts = Number(item.attempts || 0) + 1;
    await patchDocument(env, row.path, { status: attempts >= 3 ? 'failed' : 'pending', attempts, lastAttemptAtMs: Date.now(), lastError: String(error.message || error).slice(0, 800) });
    return { sent: false, error: error.message || String(error) };
  }
}

async function migrateCredentials(identity, body, env) {
  requireAdmin(identity);
  const limit = Math.min(Math.max(Number(body.limit || 50), 1), 200);
  const rows = await queryCollection(env, 'applications', [], limit);
  let migrated = 0;
  for (const row of rows) {
    if (typeof row.data.password !== 'string' || !row.data.password) continue;
    if (await getDocument(env, appPath('credentials', row.id))) continue;
    const secure = await hashPassword(row.data.password);
    await commitWrites(env, [
      updateWrite(env, appPath('credentials', row.id), { ...secure, userId: row.id, migratedAtMs: Date.now(), updatedAtMs: Date.now() }, ['scheme', 'iterations', 'salt', 'hash', 'userId', 'migratedAtMs', 'updatedAtMs'], { exists: false }),
      updateWrite(env, row.path, { credentialMigrated: true, credentialMigratedAtMs: Date.now() }, ['credentialMigrated', 'credentialMigratedAtMs', 'password'])
    ]);
    migrated += 1;
  }
  return { ok: true, scanned: rows.length, migrated };
}

async function handleTelegramUpdate(update, env) {
  if (update.callback_query) return handleCallback(update.callback_query, env);
  const message = update.message || update.edited_message;
  if (!message?.chat?.id) return;
  const text = String(message.text || '').trim();
  const chatId = message.chat.id;
  const firstName = message.from?.first_name || '會員';
  if (text.startsWith('/start')) {
    const parameter = text.split(/\s+/)[1] || '';
    if (parameter.startsWith('bind_')) return bindTelegramAccount(parameter, message, env);
    return sendMainMenu(chatId, firstName, env);
  }
  if (text.startsWith('/settings')) return showTelegramPreferences(chatId, message.from?.id, env);
  if (text.startsWith('/status')) return sendStatus(chatId, message.from?.id, env);
  if (text.startsWith('/help')) return sendHelp(chatId, env);
  return sendMainMenu(chatId, firstName, env);
}
async function handleCallback(callback, env) {
  await telegramApi(env, 'answerCallbackQuery', { callback_query_id: callback.id }).catch(() => {});
  const chatId = callback.message?.chat?.id;
  const telegramUserId = callback.from?.id;
  if (!chatId) return;
  const data = String(callback.data || '');
  if (data === 'MENU') return sendMainMenu(chatId, callback.from?.first_name || '會員', env);
  if (data === 'ACCOUNT') return sendAccountStatus(chatId, telegramUserId, env);
  if (data === 'RESET') return processTelegramPasswordReset(chatId, telegramUserId, env);
  if (data === 'PREFS') return showTelegramPreferences(chatId, telegramUserId, env);
  if (data === 'STATUS') return sendStatus(chatId, telegramUserId, env);
  if (data.startsWith('PREF:')) return togglePreference(chatId, telegramUserId, data.slice(5), env);
}
async function sendMainMenu(chatId, firstName, env) {
  return telegramApi(env, 'sendMessage', {
    chat_id: String(chatId), parse_mode: 'HTML', disable_web_page_preview: true,
    text: `嗨，${escapeHtml(firstName)}！\n\n歡迎使用 <b>SecretRoom Telegram 會員服務</b>。\n平台內通知與 Telegram 外部通知分開管理。`,
    reply_markup: { inline_keyboard: [
      [{ text: '🔗 帳號與綁定', callback_data: 'ACCOUNT' }, { text: '🔐 忘記密碼', callback_data: 'RESET' }],
      [{ text: '🔔 Telegram 通知設定', callback_data: 'PREFS' }],
      [{ text: '📋 我的申請進度', callback_data: 'STATUS' }],
      [{ text: '🌐 開啟 SecretRoom', url: env.SECRETROOM_URL || 'https://5j1u35k6.github.io/SecretRoom/' }]
    ]}
  });
}
async function sendHelp(chatId, env) {
  return telegramApi(env, 'sendMessage', { chat_id: String(chatId), parse_mode: 'HTML', text: '<b>SecretRoom Bot 使用說明</b>\n\n/start－主選單\n/settings－Telegram 通知設定\n/status－申請與綁定狀態\n\n忘記密碼必須先在平台送出申請。', reply_markup: { inline_keyboard: [[{ text: '返回主選單', callback_data: 'MENU' }]] } });
}
async function bindingByTelegramId(telegramUserId, env) {
  return getDocument(env, appPath('telegram_bindings', String(telegramUserId)));
}
async function sendAccountStatus(chatId, telegramUserId, env) {
  const binding = await bindingByTelegramId(telegramUserId, env);
  if (!binding) {
    return telegramApi(env, 'sendMessage', { chat_id: String(chatId), parse_mode: 'HTML', text: '<b>尚未綁定 SecretRoom 帳號</b>\n\n請先登入 SecretRoom，從「Telegram 會員服務」產生一次性綁定連結。', reply_markup: { inline_keyboard: [[{ text: '前往 SecretRoom 綁定', url: env.SECRETROOM_URL || 'https://5j1u35k6.github.io/SecretRoom/' }], [{ text: '返回主選單', callback_data: 'MENU' }]] } });
  }
  return telegramApi(env, 'sendMessage', { chat_id: String(chatId), parse_mode: 'HTML', text: `<b>✅ 已綁定 SecretRoom 帳號</b>\n\n會員：@${escapeHtml(binding.data.userId)}\n綁定時間：${formatTime(binding.data.boundAtMs)}`, reply_markup: { inline_keyboard: [[{ text: 'Telegram 通知設定', callback_data: 'PREFS' }], [{ text: '返回主選單', callback_data: 'MENU' }]] } });
}
async function bindTelegramAccount(token, message, env) {
  const tokenHash = await sha256Hex(token);
  const tokens = await queryCollection(env, 'telegram_binding_tokens', [{ field: 'tokenHash', value: tokenHash }], 5);
  const tokenDoc = tokens.find(row => row.data.status === 'pending');
  if (!tokenDoc || Number(tokenDoc.data.expiresAtMs || 0) <= Date.now()) return sendTelegramError(message.chat.id, '綁定連結已失效，請回到 SecretRoom 重新產生。', env);
  const telegramUserId = String(message.from.id);
  const mappingPath = appPath('telegram_bindings', telegramUserId);
  const existing = await getDocument(env, mappingPath);
  if (existing && existing.data.userId !== tokenDoc.data.userId) return sendTelegramError(message.chat.id, '此 Telegram 帳號已綁定其他會員。', env);
  const memberPath = appPath('applications', tokenDoc.data.userId);
  const member = await getDocument(env, memberPath);
  if (!member) return sendTelegramError(message.chat.id, '找不到會員帳號。', env);
  const currentTg = member.data.telegramBinding?.telegramUserId || member.data.telegramUserId;
  if (currentTg && String(currentTg) !== telegramUserId) return sendTelegramError(message.chat.id, '此會員帳號已綁定其他 Telegram。', env);
  const now = Date.now();
  const binding = { userId: tokenDoc.data.userId, telegramUserId, telegramChatId: String(message.chat.id), username: message.from.username || '', firstName: message.from.first_name || '', status: 'active', boundAtMs: now, boundBy: 'telegram_deep_link' };
  const writes = [];
  writes.push(updateWrite(env, mappingPath, binding, Object.keys(binding), existing ? null : { exists: false }));
  writes.push(updateWrite(env, memberPath, { telegramBinding: binding, telegramBound: true, telegramUserId, telegramInfo: { id: telegramUserId, username: message.from.username || '', first_name: message.from.first_name || '', chatId: String(message.chat.id) }, telegramNotificationPreferences: member.data.telegramNotificationPreferences || { security: true, review: true, service: true, promotion: false } }));
  writes.push(updateWrite(env, tokenDoc.path, { status: 'used', usedAtMs: now, usedByTelegramUserId: telegramUserId }, ['status', 'usedAtMs', 'usedByTelegramUserId'], tokenDoc.updateTime ? { updateTime: tokenDoc.updateTime } : null));
  await commitWrites(env, writes);
  await telegramApi(env, 'sendMessage', { chat_id: String(message.chat.id), parse_mode: 'HTML', text: `<b>✅ 帳號綁定完成</b>\n\nSecretRoom 會員：@${escapeHtml(tokenDoc.data.userId)}\n之後重要外部通知會傳送到這個 Telegram 對話。`, reply_markup: { inline_keyboard: [[{ text: '返回主選單', callback_data: 'MENU' }]] } });
}
async function sendTelegramError(chatId, message, env) {
  await telegramApi(env, 'sendMessage', { chat_id: String(chatId), text: message });
  return { ok: false, error: message };
}
async function processTelegramPasswordReset(chatId, telegramUserId, env) {
  const binding = await bindingByTelegramId(telegramUserId, env);
  if (!binding) return sendAccountStatus(chatId, telegramUserId, env);
  const userId = binding.data.userId;
  const requests = await queryCollection(env, 'password_reset_requests', [{ field: 'userId', value: userId }], 20);
  const request = requests.filter(row => row.data.status === 'pending' && Number(row.data.expiresAtMs || 0) > Date.now()).sort((a, b) => Number(b.data.createdAtMs || 0) - Number(a.data.createdAtMs || 0))[0];
  if (!request) return telegramApi(env, 'sendMessage', { chat_id: String(chatId), parse_mode: 'HTML', text: '<b>目前沒有可處理的忘記密碼申請</b>\n\n請先到 SecretRoom 登入頁送出「忘記密碼」申請，再回來操作。', reply_markup: { inline_keyboard: [[{ text: '前往 SecretRoom', url: env.SECRETROOM_URL || 'https://5j1u35k6.github.io/SecretRoom/' }], [{ text: '返回主選單', callback_data: 'MENU' }]] } });

  let credential = await getDocument(env, appPath('credentials', userId));
  const member = await getDocument(env, appPath('applications', userId));
  if (!credential && typeof member?.data.password === 'string') {
    const permanent = await hashPassword(member.data.password);
    await createDocument(env, appPath('credentials', userId), { ...permanent, userId, migratedAtMs: Date.now(), updatedAtMs: Date.now() });
    await patchDocument(env, appPath('applications', userId), { credentialMigrated: true, credentialMigratedAtMs: Date.now() }, ['credentialMigrated', 'credentialMigratedAtMs', 'password']);
    credential = await getDocument(env, appPath('credentials', userId));
  }
  if (!credential) return sendTelegramError(chatId, '帳號憑證尚未完成遷移，請聯絡管理員。', env);
  const tempPassword = generateTemporaryPassword();
  const tempHash = await hashPassword(tempPassword);
  const now = Date.now();
  const expiresAtMs = now + 10 * 60_000;
  const previousCredential = credential.data;
  const previousFlags = { mustChangePassword: member.data.mustChangePassword || false, forcePasswordChange: member.data.forcePasswordChange || false, tempPasswordActive: member.data.tempPasswordActive || false, passwordChangeRequired: member.data.passwordChangeRequired || false, tempPasswordIssuedAtMs: member.data.tempPasswordIssuedAtMs || null, tempPasswordExpiresAtMs: member.data.tempPasswordExpiresAtMs || null, temporaryCredentialExpiresAtMs: member.data.temporaryCredentialExpiresAtMs || null, lastPasswordChangeMethod: member.data.lastPasswordChangeMethod || null };
  await commitWrites(env, [
    updateWrite(env, credential.path, { temporaryHash: tempHash.hash, temporarySalt: tempHash.salt, temporaryIterations: tempHash.iterations, temporaryExpiresAtMs: expiresAtMs, updatedAtMs: now }),
    updateWrite(env, member.path, { mustChangePassword: true, forcePasswordChange: true, tempPasswordActive: true, passwordChangeRequired: true, tempPasswordIssuedAtMs: now, tempPasswordExpiresAtMs: expiresAtMs, temporaryCredentialExpiresAtMs: expiresAtMs, lastPasswordChangeMethod: 'telegram_self_service' }),
    updateWrite(env, request.path, { status: 'issuing', issuingAtMs: now, channel: 'telegram' }, ['status', 'issuingAtMs', 'channel'], request.updateTime ? { updateTime: request.updateTime } : null)
  ]);
  try {
    await telegramApi(env, 'sendMessage', { chat_id: String(chatId), parse_mode: 'HTML', text: `<b>🔐 SecretRoom 臨時密碼</b>\n\n<code>${escapeHtml(tempPassword)}</code>\n\n有效期限：10 分鐘\n失效時間：${formatTime(expiresAtMs)}\n\n登入後必須立即設定新密碼。請勿將此密碼提供給任何人。`, reply_markup: { inline_keyboard: [[{ text: '前往 SecretRoom 登入', url: env.SECRETROOM_URL || 'https://5j1u35k6.github.io/SecretRoom/' }]] } });
    await patchDocument(env, request.path, { status: 'completed', completedAtMs: Date.now(), temporaryCredentialIssued: true, temporaryCredentialExpiresAtMs: expiresAtMs, telegramSent: true });
  } catch (error) {
    await commitWrites(env, [
      updateWrite(env, credential.path, previousCredential, Object.keys(previousCredential)),
      updateWrite(env, member.path, previousFlags, Object.keys(previousFlags)),
      updateWrite(env, request.path, { status: 'pending', telegramSent: false, lastError: String(error.message || error).slice(0, 800), lastFailedAtMs: Date.now() })
    ]);
    throw error;
  }
}
async function showTelegramPreferences(chatId, telegramUserId, env) {
  const binding = await bindingByTelegramId(telegramUserId, env);
  if (!binding) return sendAccountStatus(chatId, telegramUserId, env);
  const member = await getDocument(env, appPath('applications', binding.data.userId));
  const prefs = member?.data.telegramNotificationPreferences || { security: true, review: true, service: true, promotion: false };
  const mark = value => value !== false ? '✅' : '❌';
  return telegramApi(env, 'sendMessage', { chat_id: String(chatId), parse_mode: 'HTML', text: `<b>🔔 Telegram 通知設定</b>\n\n✅ 帳號安全通知：必要通知\n${mark(prefs.review)} 審核結果通知\n${mark(prefs.service)} 服務與系統通知\n${mark(prefs.promotion)} 活動與公告通知`, reply_markup: { inline_keyboard: [[{ text: `${mark(prefs.review)} 審核結果`, callback_data: 'PREF:review' }], [{ text: `${mark(prefs.service)} 系統服務`, callback_data: 'PREF:service' }], [{ text: `${mark(prefs.promotion)} 活動公告`, callback_data: 'PREF:promotion' }], [{ text: '返回主選單', callback_data: 'MENU' }]] } });
}
async function togglePreference(chatId, telegramUserId, key, env) {
  if (!['review', 'service', 'promotion'].includes(key)) return;
  const binding = await bindingByTelegramId(telegramUserId, env);
  if (!binding) return sendAccountStatus(chatId, telegramUserId, env);
  const member = await getDocument(env, appPath('applications', binding.data.userId));
  const current = member?.data.telegramNotificationPreferences || { security: true, review: true, service: true, promotion: false };
  current[key] = current[key] === false;
  current.security = true;
  current.updatedAtMs = Date.now();
  await patchDocument(env, member.path, { telegramNotificationPreferences: current });
  return showTelegramPreferences(chatId, telegramUserId, env);
}
async function sendStatus(chatId, telegramUserId, env) {
  const binding = await bindingByTelegramId(telegramUserId, env);
  if (!binding) return sendAccountStatus(chatId, telegramUserId, env);
  const userId = binding.data.userId;
  const [passwords, accounts] = await Promise.all([queryCollection(env, 'password_reset_requests', [{ field: 'userId', value: userId }], 20), queryCollection(env, 'account_requests', [{ field: 'userId', value: userId }], 20)]);
  const latestStatus = rows => rows.sort((a, b) => Number(b.data.createdAtMs || 0) - Number(a.data.createdAtMs || 0))[0]?.data.status || '無申請';
  return telegramApi(env, 'sendMessage', { chat_id: String(chatId), parse_mode: 'HTML', text: `<b>📋 我的申請進度</b>\n\n帳號綁定：已完成\n忘記密碼：${escapeHtml(latestStatus(passwords))}\n帳號異動：${escapeHtml(latestStatus(accounts))}`, reply_markup: { inline_keyboard: [[{ text: '返回主選單', callback_data: 'MENU' }]] } });
}

function verifyTelegramSecret(request, env) {
  const received = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
  if (!env.TELEGRAM_WEBHOOK_SECRET || received !== env.TELEGRAM_WEBHOOK_SECRET) throw httpError(403, 'Unauthorized');
}
async function telegramApi(env, method, payload) {
  if (!env.TELEGRAM_BOT_TOKEN) throw httpError(500, 'TELEGRAM_BOT_TOKEN 未設定');
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await response.json();
  if (!response.ok || !data.ok) throw httpError(response.status || 500, data.description || `Telegram ${method} failed`);
  return data.result;
}

async function createFirebaseCustomToken(env, uid, claims = {}) {
  const sa = serviceAccount(env);
  const now = Math.floor(Date.now() / 1000);
  return signJwt({ iss: sa.client_email, sub: sa.client_email, aud: CUSTOM_TOKEN_AUD, iat: now, exp: now + 3600, uid, claims }, sa.private_key);
}
async function verifyFirebaseIdToken(request, env) {
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) throw httpError(401, '請重新登入');
  const idToken = authorization.slice(7).trim();
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY || '')}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) });
  const data = await response.json();
  if (!response.ok || !data.users?.[0]) throw httpError(401, '登入驗證已失效');
  const user = data.users[0];
  let claims = {};
  try { claims = JSON.parse(user.customAttributes || '{}'); } catch {}
  return { uid: user.localId, claims, idToken };
}
function requireMember(identity) {
  const userId = cleanId(identity?.claims?.secretroomUserId);
  if (!userId || identity.claims.secretroomMember !== true) throw httpError(403, '需要會員身分');
  return userId;
}
function requireAdmin(identity) {
  const adminId = cleanId(identity?.claims?.secretroomAdminId);
  if (!adminId || identity.claims.secretroomAdmin !== true) throw httpError(403, '需要管理員身分');
  return adminId;
}
async function signJwt(payload, privateKeyPem) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const input = `${base64url(encoder.encode(JSON.stringify(header)))}.${base64url(encoder.encode(JSON.stringify(payload)))}`;
  const key = await crypto.subtle.importKey('pkcs8', pemToBytes(privateKeyPem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(input));
  return `${input}.${base64url(new Uint8Array(signature))}`;
}
function pemToBytes(pem) {
  return base64ToBytes(String(pem).replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, ''));
}
function base64url(bytes) {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function bytesToBase64(bytes) {
  let binary = ''; const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < array.length; i += 0x8000) binary += String.fromCharCode(...array.subarray(i, i + 0x8000));
  return btoa(binary);
}
function base64ToBytes(value) {
  const binary = atob(String(value).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
async function sha256Hex(value) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(String(value))));
  return Array.from(digest).map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function generateTemporaryPassword() {
  const value = base64url(crypto.getRandomValues(new Uint8Array(8))).toUpperCase();
  return `SR-${value.slice(0, 4)}-${value.slice(4, 8)}!`;
}
function validatePassword(password) {
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[!@#$%^&*(),.?":{}|<>]/.test(password)) throw httpError(400, '密碼至少 8 碼，並包含大寫字母與特殊符號');
}
function cleanId(value) { return String(value || '').trim().replace(/^@+/, '').slice(0, 128); }
function escapeHtml(value) { return String(value || '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char])); }
function formatTime(value) {
  return new Date(Number(value || Date.now())).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
