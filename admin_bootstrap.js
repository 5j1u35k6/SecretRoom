/* SecretRoom secure frontend bootstrap.
 * Asset versions come from site-version.json, so users keep using the canonical
 * site URL while the browser automatically loads the newest runtime files.
 */
const build = String(window.__SR_BUILD__ || '20260717-member-auth-v8');

window.SecretRoomPublicAuth = Object.freeze({
  async ensure(auth, signInAnonymously) {
    if (typeof auth.authStateReady === 'function') await auth.authStateReady();
    if (auth.currentUser) return auth.currentUser;
    const credential = await signInAnonymously(auth);
    return credential.user;
  }
});

const appResponse = await fetch(`app.js?v=${encodeURIComponent(build)}`, {
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

let anonymousAuthReplacements = 0;
source = source.replace(
  /await\s+signInAnonymously\(auth\);/g,
  () => {
    anonymousAuthReplacements += 1;
    return 'await window.SecretRoomPublicAuth.ensure(auth, signInAnonymously);';
  }
);

if (!anonymousAuthReplacements) {
  console.warn('SecretRoom anonymous-auth guard was not applied');
}

source = source.replaceAll(
  "localStorage.removeItem('sr_username');",
  "localStorage.removeItem('sr_username'); window.SRSecureAuth?.signOutMember?.();"
);
source = source.replaceAll(
  'localStorage.removeItem("sr_username");',
  'localStorage.removeItem("sr_username"); window.SRSecureAuth?.signOutMember?.();'
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

await import(`./sr_auth_migration.js?v=${encodeURIComponent(build)}`);
await import(`./sr_telegram_platform.js?v=${encodeURIComponent(build)}`);
