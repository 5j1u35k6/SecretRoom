await import('./sr_emailjs_telegram_bridge.js?v=20260717-v3');
await import('./sr_admin_claim_bridge.js?v=20260717-v3');

const response = await fetch('admin.js?v=20260717-v3', { cache: 'no-store' });
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

source = source.replaceAll(
  'const userData = docSnap.data();',
  'const userData = { id: docSnap.id, userId: docSnap.id, ...docSnap.data() };'
);
source = source.replaceAll(
  'const data = docSnap.data();',
  'const data = { id: docSnap.id, userId: docSnap.id, ...docSnap.data() };'
);

const before = `        async function verifyAdminSession(adminId, password) {
            const adminRef = doc(db, 'secretg_apps', appId, 'admins', adminId);`;
const after = `        async function verifyAdminSession(adminId, password) {
            const secureAdmin = await window.SRAdminClaimBridge?.verify(adminId);
            if (secureAdmin) {
                currentAdminId = adminId;
                currentAdminSource = 'firebase-custom-token';
                return secureAdmin;
            }
            const adminRef = doc(db, 'secretg_apps', appId, 'admins', adminId);`;

if (!source.includes(before)) throw new Error('管理員驗證器載入失敗');
source = source.replace(before, after);

const blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
try {
  await import(blobUrl);
} finally {
  URL.revokeObjectURL(blobUrl);
}

await import('./sr_admin_auth.js?v=20260717-v3');
await import('./sr_telegram_admin.js?v=20260717-v3');
