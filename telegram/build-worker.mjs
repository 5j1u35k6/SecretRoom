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
