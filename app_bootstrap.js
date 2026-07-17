/* SecretRoom secure frontend bootstrap.
 * Loads the existing consolidated app after removing EmailJS credentials
 * and prevents a persisted Firebase custom-auth session from being replaced
 * by a new anonymous session.
 */
const appResponse = await fetch(`app.js?v=20260717-secure-auth-v1`, { cache: 'no-store' });
if (!appResponse.ok) throw new Error(`app.js 載入失敗：${appResponse.status}`);
let source = await appResponse.text();

source = source.replace(
  /const emailjsConfig\s*=\s*\{[\s\S]*?\n\};/,
  `const emailjsConfig = { publicKey: "", serviceId: "", defaultTemplateId: "", templates: {} };`
);
source = source.replace(
  'await signInAnonymously(auth);',
  'if (!auth.currentUser) await signInAnonymously(auth);'
);

/* Compatibility only: no request is sent to EmailJS. */
window.emailjs = Object.freeze({
  init() {},
  async send() {
    console.warn('EmailJS 已停用；外部通知改由 Telegram 後端處理。');
    return { status: 202, text: 'telegram_migration' };
  }
});

const blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
try {
  await import(blobUrl);
} finally {
  URL.revokeObjectURL(blobUrl);
}
await import(`./sr_auth_migration.js?v=20260717-secure-auth-v1`);
await import(`./sr_telegram_platform.js?v=20260717-secure-auth-v1`);
