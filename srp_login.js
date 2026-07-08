async function SRP_login(){
  const id = document.getElementById('login-username')?.value.trim();
  const pw = document.getElementById('login-password')?.value || '';
  if (!id || !pw) return SRP.toast('請填寫完整登入資訊！','error');
  try {
    const { db, fs } = await SRP.tools();
    const s = await fs.getDoc(fs.doc(db,'secretg_apps',SRP.app,'applications',id));
    if (!s.exists()) return SRP.toast('該帳號未完成帳號申請。','error');
    const u = s.data();
    const exp = Number(u.tempPasswordExpiresAtMs || u.temporaryCredentialExpiresAtMs || 0);
    if (SRP.need(u) && exp && Date.now() > exp) return SRP.toast('臨時登入憑證已過期，請重新提出忘記密碼申請。','error');
    if (u.password !== pw) return SRP.toast('密碼不正確，請重新檢查。','error');
    if (SRP.need(u)) return window.SRP_force(id,u);
    window.SRP_enter(id);
  } catch(e) {
    console.error(e);
    SRP.toast('登入驗證異常：' + e.message,'error');
  }
}
function SRP_patchLogin(){
  const b = document.getElementById('btn-login-submit');
  if (!b || b.dataset.srp) return;
  b.dataset.srp = '1';
  window.__srHandleLoginSubmit = SRP_login;
  b.onclick = SRP_login;
}
new MutationObserver(SRP_patchLogin).observe(document.documentElement,{childList:true,subtree:true});
setInterval(SRP_patchLogin,800);
import('./sr_language_selector.js?v=20260708-i18n-asia-v7').catch(console.warn);
