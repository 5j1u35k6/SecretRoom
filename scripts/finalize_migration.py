from pathlib import Path
import re


def strip_emailjs():
    app = Path('app.js')
    text = app.read_text(encoding='utf-8')
    if 'XggJY7iHQcZYYhNY7' in text:
        text, count = re.subn(
            r'const emailjsConfig\s*=\s*\{[\s\S]*?\n\};',
            'const emailjsConfig = { publicKey: "", serviceId: "", defaultTemplateId: "", templates: {} };',
            text,
            count=1,
        )
        if count != 1:
            raise SystemExit('app.js EmailJS replacement did not match exactly once')
        app.write_text(text, encoding='utf-8')

    admin = Path('admin.js')
    text = admin.read_text(encoding='utf-8')
    if 'XggJY7iHQcZYYhNY7' in text:
        replacement = '''const emailjsConfig = {
            publicKey: "telegram-bridge",
            serviceId: "telegram-backend",
            defaultTemplateId: "telegram-notification",
            templates: {
                registrationApproved: "telegram-notification",
                registrationRejected: "telegram-notification",
                specApproved: "telegram-notification",
                specRejected: "telegram-notification",
                avatarApproved: "telegram-notification",
                avatarRejected: "telegram-notification",
                reportAccepted: "telegram-notification",
                reportDismissed: "telegram-notification",
                passwordReset: "telegram-security",
                accountRequest: "telegram-security"
            }
        };'''
        text, count = re.subn(
            r'const emailjsConfig\s*=\s*\{[\s\S]*?\n\};',
            replacement,
            text,
            count=1,
        )
        if count != 1:
            raise SystemExit('admin.js EmailJS replacement did not match exactly once')
    if 'service_1ou10mi' in text:
        text, count = re.subn(
            r"const MAIL\s*=\s*\{[^;]+service_1ou10mi[^;]+\};",
            "const MAIL = { publicKey: 'telegram-bridge', serviceId: 'telegram-backend', templateId: 'telegram-security' };",
            text,
            count=1,
        )
        if count != 1:
            raise SystemExit('admin.js MAIL replacement did not match exactly once')
    admin.write_text(text, encoding='utf-8')


def harden_worker():
    worker = Path('telegram/cloudflare-worker.js')
    text = worker.read_text(encoding='utf-8')

    if 'legacyAdminCredentialSupported' not in text:
        old = """  let credential = await getDocument(env, appPath('admin_credentials', adminId));
  let valid = credential ? await verifyHash(password, credential.data) : false;
  if (!credential && typeof admin.data.password === 'string' && constantTimeEqual(admin.data.password, password)) {
    const secure = await hashPassword(password);
    await commitWrites(env, [
      updateWrite(env, appPath('admin_credentials', adminId), { ...secure, adminId, migratedAtMs: Date.now(), updatedAtMs: Date.now() }, ['scheme', 'iterations', 'salt', 'hash', 'adminId', 'migratedAtMs', 'updatedAtMs'], { exists: false }),
      updateWrite(env, appPath('admins', adminId), { credentialMigrated: true, credentialMigratedAtMs: Date.now() }, ['credentialMigrated', 'credentialMigratedAtMs', 'password'])
    ]);
    valid = true;
  }"""
        new = """  let credential = await getDocument(env, appPath('admin_credentials', adminId));
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
  }"""
        if old not in text:
            raise SystemExit('Worker admin credential block not found')
        text = text.replace(old, new, 1)

    if 'claimTelegramUpdate(update, env)' not in text:
        old = 'async function handleTelegramUpdate(update, env) {\n  if (update.callback_query)'
        new = 'async function handleTelegramUpdate(update, env) {\n  if (!(await claimTelegramUpdate(update, env))) return;\n  if (update.callback_query)'
        if old not in text:
            raise SystemExit('Worker Telegram handler block not found')
        text = text.replace(old, new, 1)
        marker = 'function verifyTelegramSecret(request, env) {'
        helper = """async function claimTelegramUpdate(update, env) {
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

"""
        if marker not in text:
            raise SystemExit('Worker Telegram secret marker not found')
        text = text.replace(marker, helper + marker, 1)

    old = """  const rows = await queryCollection(env, 'applications', [], limit);
  let migrated = 0;
  for (const row of rows) {"""
    if old in text:
        text = text.replace(old, """  const rows = await queryCollection(env, 'applications', [], 1000);
  let migrated = 0;
  for (const row of rows) {
    if (migrated >= limit) break;""", 1)

    old = '  const previousCredential = credential.data;'
    if old in text:
        text = text.replace(old, """  const previousCredential = {
    ...credential.data,
    temporaryHash: credential.data.temporaryHash ?? null,
    temporarySalt: credential.data.temporarySalt ?? null,
    temporaryIterations: credential.data.temporaryIterations ?? null,
    temporaryExpiresAtMs: credential.data.temporaryExpiresAtMs ?? null
  };""", 1)

    worker.write_text(text, encoding='utf-8')


if __name__ == '__main__':
    strip_emailjs()
    harden_worker()
