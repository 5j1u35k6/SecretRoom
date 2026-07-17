/* SecretRoom secure admin bootstrap.
 * Removes EmailJS credentials from the runtime source and loads the existing
 * consolidated admin application with the local Telegram compatibility bridge.
 */
await import(`./sr_emailjs_telegram_bridge.js?v=20260717-secure-auth-v2`);

const response = await fetch(`admin.js?v=20260717-secure-auth-v2`, { cache: 'no-store' });
if (!response.ok) throw new Error(`admin.js 載入失敗：${response.status}`);
let source = await response.text();

source = source.replace(
  /const emailjsConfig\s*=\s*\{[\s\S]*?\n\};/,
  `const emailjsConfig = {
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
  };`
);
source = source.replace(
  /const MAIL\s*=\s*\{[^;]+service_1ou10mi[^;]+\};/,
  `const MAIL = { publicKey: 'telegram-bridge', serviceId: 'telegram-backend', templateId: 'telegram-security' };`
);

/*
 * 舊後台在部分審核流程只取 docSnap.data()，沒有保留文件 ID。
 * Telegram 通知需要會員 ID，因此在載入前補上 id/userId。
 */
source = source.replaceAll(
  'const userData = docSnap.data();',
  'const userData = { id: docSnap.id, userId: docSnap.id, ...docSnap.data() };'
);
source = source.replaceAll(
  'const data = docSnap.data();',
  'const data = { id: docSnap.id, userId: docSnap.id, ...docSnap.data() };'
);

const blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
try {
  await import(blobUrl);
} finally {
  URL.revokeObjectURL(blobUrl);
}
await import(`./sr_admin_auth.js?v=20260717-secure-auth-v2`);
await import(`./sr_telegram_admin.js?v=20260717-secure-auth-v2`);
