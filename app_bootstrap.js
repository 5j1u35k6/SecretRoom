/* SecretRoom secure frontend bootstrap.
 * Loads the consolidated app after removing legacy EmailJS configuration and
 * preserves an authenticated Firebase member session instead of replacing it
 * with an anonymous session.
 */
const appResponse = await fetch('app.js?v=20260717-member-auth-v7', {
  cache: 'no-store'
});

if (!appResponse.ok) {
  throw new Error(`app.js 載入失敗：${appResponse.status}`);
}

let source = await appResponse.text();

source = source.replace(
  /const emailjsConfig\s*=\s*\{[\s\S]*?\n\};/,
  'const emailjsConfig = { publicKey: "", serviceId: "", defaultTemplateId: "", templates: {} };'
);

source = source.replace(
  'await signInAnonymously(auth);',
  `if (typeof auth.authStateReady === 'function') await auth.authStateReady();
                      if (!auth.currentUser) await signInAnonymously(auth);`
);

/* Compatibility only: no request is sent to EmailJS. */
window.emailjs = Object.freeze({
  init() {},
  async send() {
    return { status: 202, text: 'telegram_migration' };
  }
});

const blobUrl = URL.createObjectURL(
  new Blob([source], { type: 'text/javascript' })
);

try {
  await import(blobUrl);
} finally {
  URL.revokeObjectURL(blobUrl);
}

await import('./sr_auth_migration.js?v=20260717-member-auth-v7');
await import('./sr_telegram_platform.js?v=20260717-member-auth-v7');
