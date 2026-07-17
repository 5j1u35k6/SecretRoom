import { readFile, writeFile } from 'node:fs/promises';

let source = await readFile(new URL('./cloudflare-worker.js', import.meta.url), 'utf8');

if (!source.includes('legacyAdminCredentialSupported')) {
  const original = `  let credential = await getDocument(env, appPath('admin_credentials', adminId));
  let valid = credential ? await verifyHash(password, credential.data) : false;
  if (!credential && typeof admin.data.password === 'string' && constantTimeEqual(admin.data.password, password)) {
    const secure = await hashPassword(password);
    await commitWrites(env, [
      updateWrite(env, appPath('admin_credentials', adminId), { ...secure, adminId, migratedAtMs: Date.now(), updatedAtMs: Date.now() }, ['scheme', 'iterations', 'salt', 'hash', 'adminId', 'migratedAtMs', 'updatedAtMs'], { exists: false }),
      updateWrite(env, appPath('admins', adminId), { credentialMigrated: true, credentialMigratedAtMs: Date.now() }, ['credentialMigrated', 'credentialMigratedAtMs', 'password'])
    ]);
    valid = true;
  }`;
  const replacement = `  let credential = await getDocument(env, appPath('admin_credentials', adminId));
  let valid = credential ? await verifyHash(password, credential.data) : false;
  const legacyAdminCredentialSupported = true;
  let legacyValid = false;
  if (!credential && typeof admin.data.password === 'string') {
    legacyValid = constantTimeEqual(admin.data.password, password);
  }
  if (!credential && !legacyValid && typeof admin.data.passwordHash === 'string') {
    legacyValid = constantTimeEqual((await sha256Hex(password)).toLowerCase(), admin.data.passwordHash.toLowerCase());
  }
  if (!credential && legacyValid) {
    const secure = await hashPassword(password);
    await commitWrites(env, [
      updateWrite(env, appPath('admin_credentials', adminId), { ...secure, adminId, migratedAtMs: Date.now(), updatedAtMs: Date.now() }, ['scheme', 'iterations', 'salt', 'hash', 'adminId', 'migratedAtMs', 'updatedAtMs'], { exists: false }),
      updateWrite(env, appPath('admins', adminId), { credentialMigrated: true, credentialMigratedAtMs: Date.now() }, ['credentialMigrated', 'credentialMigratedAtMs', 'password', 'passwordHash'])
    ]);
    valid = true;
  }`;
  if (!source.includes(original)) throw new Error('Admin credential migration block was not found');
  source = source.replace(original, replacement);
}

if (!source.includes("'/api/admin/change-password'")) {
  const routeMarker = `  if (url.pathname === '/api/admin/migrate-credentials') return migrateCredentials(identity, body, env);
  throw httpError(404, 'Unknown API route');`;
  const routeReplacement = `  if (url.pathname === '/api/admin/migrate-credentials') return migrateCredentials(identity, body, env);
  if (url.pathname === '/api/admin/change-password') return changeAdminPassword(identity, body, env);
  if (url.pathname === '/api/admin/telegram-status') return telegramAdminStatus(identity, env);
  if (url.pathname === '/api/admin/telegram-repair-webhook') return repairTelegramWebhook(identity, env, url);
  throw httpError(404, 'Unknown API route');`;
  if (!source.includes(routeMarker)) throw new Error('Admin API route marker was not found');
  source = source.replace(routeMarker, routeReplacement);
}

if (!source.includes('async function changeAdminPassword(identity, body, env)')) {
  const helperMarker = 'async function adminTelegramNotify(identity, body, env) {';
  const helpers = `async function changeAdminPassword(identity, body, env) {
  const adminId = requireAdmin(identity);
  const currentPassword = String(body.currentPassword || '');
  const newPassword = String(body.newPassword || '');
  if (!currentPassword) throw httpError(400, '請輸入目前管理員密碼');
  validatePassword(newPassword);
  if (constantTimeEqual(currentPassword, newPassword)) throw httpError(400, '新密碼不可與目前密碼相同');

  const credential = await getDocument(env, appPath('admin_credentials', adminId));
  if (!credential || !(await verifyHash(currentPassword, credential.data))) {
    throw httpError(401, '目前管理員密碼不正確');
  }

  const secure = await hashPassword(newPassword);
  const now = Date.now();
  await commitWrites(env, [
    updateWrite(env, credential.path, { ...secure, updatedAtMs: now, passwordChangedAtMs: now }, ['scheme', 'iterations', 'salt', 'hash', 'updatedAtMs', 'passwordChangedAtMs']),
    updateWrite(env, appPath('admins', adminId), { passwordChangedAtMs: now }, ['passwordChangedAtMs', 'password', 'passwordHash'])
  ]);
  return { ok: true, adminId, passwordChangedAtMs: now };
}

async function telegramAdminStatus(identity, env) {
  requireAdmin(identity);
  const [bot, webhook] = await Promise.all([
    telegramApi(env, 'getMe', {}),
    telegramApi(env, 'getWebhookInfo', {})
  ]);
  return {
    ok: true,
    bot: {
      id: String(bot.id || ''),
      username: bot.username || '',
      firstName: bot.first_name || '',
      canJoinGroups: bot.can_join_groups === true
    },
    webhook: {
      url: webhook.url || '',
      pendingUpdateCount: Number(webhook.pending_update_count || 0),
      lastErrorDate: Number(webhook.last_error_date || 0),
      lastErrorMessage: webhook.last_error_message || '',
      maxConnections: Number(webhook.max_connections || 0),
      allowedUpdates: Array.isArray(webhook.allowed_updates) ? webhook.allowed_updates : []
    }
  };
}

async function repairTelegramWebhook(identity, env, url) {
  const adminId = requireAdmin(identity);
  if (!env.TELEGRAM_WEBHOOK_SECRET) throw httpError(500, 'TELEGRAM_WEBHOOK_SECRET 未設定');
  const webhookUrl = String(url.origin || '').replace(/\\/+$/, '') + '/';
  if (!/^https:\\/\\//.test(webhookUrl)) throw httpError(500, 'Worker 公開網址無效');

  await telegramApi(env, 'setWebhook', {
    url: webhookUrl,
    secret_token: env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ['message', 'edited_message', 'callback_query', 'my_chat_member'],
    drop_pending_updates: false,
    max_connections: 40
  });

  const webhook = await telegramApi(env, 'getWebhookInfo', {});
  return {
    ok: true,
    repairedBy: adminId,
    webhook: {
      url: webhook.url || '',
      pendingUpdateCount: Number(webhook.pending_update_count || 0),
      lastErrorDate: Number(webhook.last_error_date || 0),
      lastErrorMessage: webhook.last_error_message || '',
      allowedUpdates: Array.isArray(webhook.allowed_updates) ? webhook.allowed_updates : []
    }
  };
}

`;
  if (!source.includes(helperMarker)) throw new Error('Telegram admin helper marker was not found');
  source = source.replace(helperMarker, helpers + helperMarker);
}

if (!source.includes('claimTelegramUpdate(update, env)')) {
  const handler = `async function handleTelegramUpdate(update, env) {
  if (update.callback_query)`;
  if (!source.includes(handler)) throw new Error('Telegram update handler was not found');
  source = source.replace(
    handler,
    `async function handleTelegramUpdate(update, env) {
  if (!(await claimTelegramUpdate(update, env))) return;
  if (update.callback_query)`
  );

  const marker = 'function verifyTelegramSecret(request, env) {';
  const helper = `async function claimTelegramUpdate(update, env) {
  if (update?.update_id === undefined || update?.update_id === null) return true;
  const path = appPath('telegram_updates', String(update.update_id));
  try {
    await createDocument(env, path, { updateId: String(update.update_id), claimedAtMs: Date.now() });
    return true;
  } catch (error) {
    if (Number(error.status || 0) === 409) return false;
    throw error;
  }
}

`;
  if (!source.includes(marker)) throw new Error('Telegram verification marker was not found');
  source = source.replace(marker, helper + marker);
}

source = source.replace(
  `  const rows = await queryCollection(env, 'applications', [], limit);
  let migrated = 0;
  for (const row of rows) {`,
  `  const rows = await queryCollection(env, 'applications', [], 1000);
  let migrated = 0;
  for (const row of rows) {
    if (migrated >= limit) break;`
);

source = source.replace(
  '  const previousCredential = credential.data;',
  `  const previousCredential = {
    ...credential.data,
    temporaryHash: credential.data.temporaryHash ?? null,
    temporarySalt: credential.data.temporarySalt ?? null,
    temporaryIterations: credential.data.temporaryIterations ?? null,
    temporaryExpiresAtMs: credential.data.temporaryExpiresAtMs ?? null
  };`
);

await writeFile(new URL('./.generated-worker.js', import.meta.url), source, 'utf8');
console.log('Generated hardened SecretRoom Worker');
