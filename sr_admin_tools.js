// SecretRoom admin tools overlay
// Contains password recovery tools. UI tools are still loaded below.

const AID = 'secretg-production-node-tw';
const MAIL = {
  publicKey: 'XggJY7iHQcZYYhNY7',
  serviceId: 'service_1ou10mi',
  templateId: 'template_sr_security'
};

let DB, FS;

async function T() {
  if (DB && FS) return { db: DB, fs: FS };
  const appMod = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js');
  const firestoreMod = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
  const apps = appMod.getApps();
  if (!apps.length) throw new Error('Firebase 尚未初始化');
  DB = firestoreMod.getFirestore(apps[0]);
  FS = firestoreMod;
  return { db: DB, fs: FS };
}

function C() {
  return 'SR-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '!';
}

function fmtTime(ms) {
  return new Date(ms).toLocaleString('zh-TW', { hour12: false });
}

function buildRecoveryMessage(code, expiresAtMs) {
  return [
    `您的 SecretRoom 臨時密碼為：${code}`,
    '',
    '有效期限：10 分鐘。',
    `失效時間：${fmtTime(expiresAtMs)}`,
    '',
    '請使用您的會員帳號與此臨時密碼登入 SecretRoom。',
    '登入後，系統會要求您立即設定自己的新密碼。',
    '',
    '若並非您本人提出忘記密碼申請，請立即聯繫 SecretRoom 管理員。'
  ].join('\n');
}

async function sendRecoveryMail(user, uid, code, expiresAtMs) {
  if (!window.emailjs) throw new Error('EmailJS 尚未載入');
  if (!user.email) throw new Error('此會員沒有綁定通知信箱');
  await emailjs.send(MAIL.serviceId, MAIL.templateId, {
    to_email: user.email,
    to_name: user.nickname || uid || 'SecretRoom Member',
    status_text: 'SecretRoom 忘記密碼臨時密碼',
    message: buildRecoveryMessage(code, expiresAtMs),
    email_type: '帳號安全通知',
    member_id: uid || ''
  }, { publicKey: MAIL.publicKey });
}

async function restoreUserCredential(userRef, fs, previous) {
  try {
    await fs.updateDoc(userRef, previous);
  } catch (restoreErr) {
    console.error('臨時密碼寄送失敗後還原會員密碼狀態失敗:', restoreErr);
  }
}

window.completePasswordResetRequest = async function completePasswordResetRequest(id) {
  let userRef = null;
  let previousCredentialState = null;

  try {
    const { db, fs } = await T();
    const reqRef = fs.doc(db, 'secretg_apps', AID, 'password_reset_requests', id);
    const reqSnap = await fs.getDoc(reqRef);
    if (!reqSnap.exists()) throw new Error('找不到忘記密碼申請');

    const req = reqSnap.data() || {};
    const uid = req.userId;
    if (!uid) throw new Error('此申請缺少會員 ID');

    userRef = fs.doc(db, 'secretg_apps', AID, 'applications', uid);
    const userSnap = await fs.getDoc(userRef);
    if (!userSnap.exists()) throw new Error('找不到會員資料');

    const user = userSnap.data() || {};
    if (!user.email) throw new Error('此會員沒有綁定通知信箱，無法自動寄出臨時密碼');

    previousCredentialState = {
      password: user.password || '',
      mustChangePassword: !!user.mustChangePassword,
      forcePasswordChange: !!user.forcePasswordChange,
      tempPasswordActive: !!user.tempPasswordActive,
      passwordChangeRequired: !!user.passwordChangeRequired,
      tempPasswordIssuedAtMs: user.tempPasswordIssuedAtMs || null,
      tempPasswordExpiresAtMs: user.tempPasswordExpiresAtMs || null,
      temporaryCredentialExpiresAtMs: user.temporaryCredentialExpiresAtMs || null,
      lastPasswordChangeMethod: user.lastPasswordChangeMethod || null
    };

    const code = C();
    const now = Date.now();
    const expiresAtMs = now + 10 * 60 * 1000;

    await fs.updateDoc(userRef, {
      password: code,
      mustChangePassword: true,
      forcePasswordChange: true,
      tempPasswordActive: true,
      passwordChangeRequired: true,
      tempPasswordIssuedAtMs: now,
      tempPasswordExpiresAtMs: expiresAtMs,
      temporaryCredentialExpiresAtMs: expiresAtMs,
      passwordChangedAt: fs.serverTimestamp(),
      passwordChangedAtMs: now,
      passwordChangedBy: 'admin',
      lastPasswordChangeMethod: 'admin_temporary_email'
    });

    try {
      await sendRecoveryMail(user, uid, code, expiresAtMs);
    } catch (mailErr) {
      await restoreUserCredential(userRef, fs, previousCredentialState);
      await fs.updateDoc(reqRef, {
        status: 'email_failed',
        emailSent: false,
        emailError: mailErr.message || String(mailErr),
        emailFailedAt: fs.serverTimestamp(),
        emailFailedAtMs: Date.now()
      });
      throw mailErr;
    }

    await fs.updateDoc(reqRef, {
      status: 'completed',
      completedAt: fs.serverTimestamp(),
      completedAtMs: Date.now(),
      temporaryCredentialIssued: true,
      temporaryCredentialExpiresAtMs: expiresAtMs,
      emailSent: true,
      emailSentAt: fs.serverTimestamp(),
      emailSentAtMs: Date.now()
    });

    if (window.showToast) showToast('臨時密碼已寄出，有效期限 10 分鐘。', 'success');
  } catch (err) {
    console.error(err);
    if (window.showToast) showToast('臨時密碼寄送失敗：' + err.message, 'error');
  }
};

window.rejectPasswordResetRequest = async function rejectPasswordResetRequest(id) {
  try {
    const { db, fs } = await T();
    await fs.updateDoc(fs.doc(db, 'secretg_apps', AID, 'password_reset_requests', id), {
      status: 'rejected',
      rejectedAt: fs.serverTimestamp(),
      rejectedAtMs: Date.now()
    });
    if (window.showToast) showToast('忘記密碼申請已拒絕', 'info');
  } catch (err) {
    console.error(err);
    if (window.showToast) showToast('拒絕失敗：' + err.message, 'error');
  }
};

import './sr_admin_improvements.js?v=20260708-admin-ui-v1';
