// SecretRoom password-flow overlay
// Merged from srp_core.js, srp_mail.js, srp_force.js, srp_login.js, srp_profile.js.

window.SRP = { app: 'secretg-production-node-tw', db: null, fs: null };

SRP.tools = async () => {
  if (SRP.db) return SRP;
  const appMod = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js');
  const firestoreMod = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
  const app = appMod.getApps()[0];
  if (!app) throw Error('Firebase 尚未初始化');
  SRP.db = firestoreMod.getFirestore(app);
  SRP.fs = firestoreMod;
  return SRP;
};

SRP.valid = p => String(p || '').length >= 8 && /[A-Z]/.test(p || '') && /[!@#$%^&*(),.?":{}|<>]/.test(p || '');
SRP.need = u => !!(u && (u.mustChangePassword || u.forcePasswordChange || u.tempPasswordActive || u.passwordChangeRequired));
SRP.toast = (m, t = 'info') => window.showToast ? showToast(m, t) : console.log(m);

window.SRP.sendMail = async (u, id, msg) => {
  if (!window.emailjs || !u.email) return;
  try {
    await emailjs.send('service_1ou10mi', 'template_sr_security', {
      to_email: u.email,
      to_name: u.nickname || id,
      status_text: 'SecretRoom 密碼已更新',
      message: msg || '你的 SecretRoom 密碼剛剛已更新。不是你本人操作的話，請盡快聯絡管理員。',
      email_type: '帳號安全提醒',
      member_id: id
    }, { publicKey: 'XggJY7iHQcZYYhNY7' });
  } catch (e) {
    console.warn(e);
  }
};

window.SRP_enter = function(id) {
  localStorage.setItem('sr_username', id);
  SRP.toast('登入成功，正在帶你進去。', 'success');
  setTimeout(() => location.reload(), 500);
};

window.SRP_force = function(id, u) {
  if (document.getElementById('sr-force-change')) return;
  const m = document.createElement('div');
  m.id = 'sr-force-change';
  m.className = 'fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md';
  m.innerHTML = `<div class="glass-panel border border-amber-500/25 rounded-3xl p-6 w-[92vw] max-w-sm shadow-2xl relative crystal-border"><h3 class="text-lg font-black text-white mb-1 font-luxury"><i class="fa-solid fa-key text-amber-500 mr-2"></i>換一組新密碼</h3><p class="text-xs text-slate-400 leading-relaxed mb-5">你現在是用臨時密碼登入，先換成自己的密碼就能繼續。</p><div class="space-y-3"><input id="sr-new1" type="password" class="w-full bg-slate-900 border border-amber-500/10 rounded-xl px-3.5 py-3 text-sm text-white" placeholder="新密碼"><input id="sr-new2" type="password" class="w-full bg-slate-900 border border-amber-500/10 rounded-xl px-3.5 py-3 text-sm text-white" placeholder="再輸入一次新密碼"><div class="text-[10px] text-slate-500 leading-relaxed">至少 8 碼，並包含 1 個大寫英文字母和 1 個特殊符號。</div><button id="sr-save-new" class="w-full brushed-gold font-bold text-sm py-3.5 rounded-xl crystal-border hover-breath click-press">換好密碼，繼續登入</button></div></div>`;
  document.body.appendChild(m);
  document.getElementById('sr-save-new').onclick = async () => {
    const p1 = document.getElementById('sr-new1').value;
    const p2 = document.getElementById('sr-new2').value;
    if (!p1 || !p2) return SRP.toast('請把兩個密碼欄位都填好。', 'error');
    if (p1 !== p2) return SRP.toast('兩次輸入不一樣，再確認一下。', 'error');
    if (p1 === u.password) return SRP.toast('新密碼不能和臨時密碼一樣。', 'error');
    if (!SRP.valid(p1)) return SRP.toast('密碼格式不符：至少 8 碼，並包含 1 個大寫英文字母和 1 個特殊符號。', 'error');
    try {
      const { db, fs } = await SRP.tools();
      const up = { password: p1, mustChangePassword: false, forcePasswordChange: false, tempPasswordActive: false, passwordChangeRequired: false, passwordChangedAt: fs.serverTimestamp(), passwordChangedAtMs: Date.now(), passwordChangedBy: 'member', lastPasswordChangeMethod: 'temporary_login' };
      await fs.updateDoc(fs.doc(db, 'secretg_apps', SRP.app, 'applications', id), up);
      if (SRP.sendMail) await SRP.sendMail({ ...u, ...up }, id);
      m.remove();
      window.SRP_enter(id);
    } catch (e) {
      console.error(e);
      SRP.toast('密碼沒換成功：' + e.message, 'error');
    }
  };
};

async function SRP_login() {
  const id = document.getElementById('login-username')?.value.trim();
  const pw = document.getElementById('login-password')?.value || '';
  if (!id || !pw) return SRP.toast('帳號和密碼都要填喔。', 'error');
  try {
    const { db, fs } = await SRP.tools();
    const s = await fs.getDoc(fs.doc(db, 'secretg_apps', SRP.app, 'applications', id));
    if (!s.exists()) return SRP.toast('找不到這個帳號，請先完成申請。', 'error');
    const u = s.data();
    const exp = Number(u.tempPasswordExpiresAtMs || u.temporaryCredentialExpiresAtMs || 0);
    if (SRP.need(u) && exp && Date.now() > exp) return SRP.toast('這組臨時密碼已過期，請重新申請。', 'error');
    if (u.password !== pw) return SRP.toast('密碼不對，再試一次。', 'error');
    if (SRP.need(u)) return window.SRP_force(id, u);
    window.SRP_enter(id);
  } catch (e) {
    console.error(e);
    SRP.toast('登入時出了點問題：' + e.message, 'error');
  }
}

function SRP_patchLogin() {
  const b = document.getElementById('btn-login-submit');
  if (!b || b.dataset.srp) return;
  b.dataset.srp = '1';
  window.__srHandleLoginSubmit = SRP_login;
  b.onclick = SRP_login;
}
new MutationObserver(SRP_patchLogin).observe(document.documentElement, { childList: true, subtree: true });
setInterval(SRP_patchLogin, 800);

function SRP_patchProfile() {
  const btn = document.getElementById('btn-submit-profile-edit');
  if (!btn || document.getElementById('srp-profile-pass')) return;
  const box = document.createElement('div');
  box.id = 'srp-profile-pass';
  box.className = 'p-4 bg-slate-900/40 border border-amber-500/10 rounded-2xl space-y-3';
  box.innerHTML = `<span class="text-xs font-bold text-amber-500 tracking-widest block"><i class="fa-solid fa-key mr-1"></i> 更改登入密碼</span><p class="text-[10px] text-slate-500 leading-relaxed">要換密碼的話，先輸入目前密碼，再設定新密碼。</p><input type="password" id="srp-old" class="w-full bg-slate-900 border border-amber-500/10 rounded-xl px-3.5 py-2.5 text-sm text-white" placeholder="目前密碼"><input type="password" id="srp-newp" class="w-full bg-slate-900 border border-amber-500/10 rounded-xl px-3.5 py-2.5 text-sm text-white" placeholder="新密碼"><input type="password" id="srp-newp2" class="w-full bg-slate-900 border border-amber-500/10 rounded-xl px-3.5 py-2.5 text-sm text-white" placeholder="再輸入一次新密碼"><div class="text-[10px] text-slate-500 leading-relaxed">至少 8 碼，並包含 1 個大寫英文字母和 1 個特殊符號。</div><button type="button" id="srp-save-pass" class="w-full bg-slate-950/60 text-amber-300 font-bold text-xs py-3 px-4 rounded-xl border border-amber-500/15 transition hover-breath click-press">只更新密碼</button>`;
  btn.parentElement.insertBefore(box, btn);
  document.getElementById('srp-save-pass').onclick = async () => {
    const id = localStorage.getItem('sr_username');
    const old = document.getElementById('srp-old').value;
    const p1 = document.getElementById('srp-newp').value;
    const p2 = document.getElementById('srp-newp2').value;
    if (!old || !p1 || !p2) return SRP.toast('目前密碼、新密碼和確認欄位都要填。', 'error');
    if (p1 !== p2) return SRP.toast('兩次輸入不一樣，再確認一下。', 'error');
    if (p1 === old) return SRP.toast('新密碼不能和目前密碼一樣。', 'error');
    if (!SRP.valid(p1)) return SRP.toast('密碼格式不符：至少 8 碼，並包含 1 個大寫英文字母和 1 個特殊符號。', 'error');
    try {
      const { db, fs } = await SRP.tools();
      const ref = fs.doc(db, 'secretg_apps', SRP.app, 'applications', id);
      const s = await fs.getDoc(ref);
      if (!s.exists()) return SRP.toast('找不到你的會員資料。', 'error');
      const u = s.data();
      if (u.password !== old) return SRP.toast('目前密碼不對。', 'error');
      const up = { password: p1, mustChangePassword: false, forcePasswordChange: false, tempPasswordActive: false, passwordChangeRequired: false, passwordChangedAt: fs.serverTimestamp(), passwordChangedAtMs: Date.now(), passwordChangedBy: 'member', lastPasswordChangeMethod: 'profile_edit' };
      await fs.updateDoc(ref, up);
      if (SRP.sendMail) await SRP.sendMail({ ...u, ...up }, id);
      SRP.toast('密碼換好了，安全提醒也寄出了。', 'success');
      ['srp-old', 'srp-newp', 'srp-newp2'].forEach(x => document.getElementById(x).value = '');
    } catch (e) {
      console.error(e);
      SRP.toast('密碼沒換成功：' + e.message, 'error');
    }
  };
}
new MutationObserver(SRP_patchProfile).observe(document.documentElement, { childList: true, subtree: true });
setInterval(SRP_patchProfile, 1200);