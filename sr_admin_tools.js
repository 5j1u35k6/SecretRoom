// SecretRoom admin tools overlay
// Merged from sr_admin_recovery.js and sr_admin_improvements.js.

const AID = 'secretg-production-node-tw';
const MAIL = { publicKey: 'XggJY7iHQcZYYhNY7', serviceId: 'service_1ou10mi', templateId: 'template_sr_security' };
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
function C() { return 'SR-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '!'; }
function fmtTime(ms) { return new Date(ms).toLocaleString('zh-TW', { hour12: false }); }
function buildRecoveryMessage(code, expiresAtMs) {
  return [`您的 SecretRoom 臨時密碼為：${code}`, '', '有效期限：10 分鐘。', `失效時間：${fmtTime(expiresAtMs)}`, '', '請使用您的會員帳號與此臨時密碼登入 SecretRoom。', '登入後，系統會要求您立即設定自己的新密碼。', '', '若並非您本人提出忘記密碼申請，請立即聯繫 SecretRoom 管理員。'].join('\n');
}
async function sendRecoveryMail(user, uid, code, expiresAtMs) {
  if (!window.emailjs) throw new Error('EmailJS 尚未載入');
  if (!user.email) throw new Error('此會員沒有綁定通知信箱');
  await emailjs.send(MAIL.serviceId, MAIL.templateId, { to_email: user.email, to_name: user.nickname || uid || 'SecretRoom Member', status_text: 'SecretRoom 忘記密碼臨時密碼', message: buildRecoveryMessage(code, expiresAtMs), email_type: '帳號安全通知', member_id: uid || '' }, { publicKey: MAIL.publicKey });
}
async function restoreUserCredential(userRef, fs, previous) {
  try { await fs.updateDoc(userRef, previous); }
  catch (restoreErr) { console.error('臨時密碼寄送失敗後還原會員密碼狀態失敗:', restoreErr); }
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
    previousCredentialState = { password: user.password || '', mustChangePassword: !!user.mustChangePassword, forcePasswordChange: !!user.forcePasswordChange, tempPasswordActive: !!user.tempPasswordActive, passwordChangeRequired: !!user.passwordChangeRequired, tempPasswordIssuedAtMs: user.tempPasswordIssuedAtMs || null, tempPasswordExpiresAtMs: user.tempPasswordExpiresAtMs || null, temporaryCredentialExpiresAtMs: user.temporaryCredentialExpiresAtMs || null, lastPasswordChangeMethod: user.lastPasswordChangeMethod || null };
    const code = C();
    const now = Date.now();
    const expiresAtMs = now + 10 * 60 * 1000;
    await fs.updateDoc(userRef, { password: code, mustChangePassword: true, forcePasswordChange: true, tempPasswordActive: true, passwordChangeRequired: true, tempPasswordIssuedAtMs: now, tempPasswordExpiresAtMs: expiresAtMs, temporaryCredentialExpiresAtMs: expiresAtMs, passwordChangedAt: fs.serverTimestamp(), passwordChangedAtMs: now, passwordChangedBy: 'admin', lastPasswordChangeMethod: 'admin_temporary_email' });
    try { await sendRecoveryMail(user, uid, code, expiresAtMs); }
    catch (mailErr) {
      await restoreUserCredential(userRef, fs, previousCredentialState);
      await fs.updateDoc(reqRef, { status: 'email_failed', emailSent: false, emailError: mailErr.message || String(mailErr), emailFailedAt: fs.serverTimestamp(), emailFailedAtMs: Date.now() });
      throw mailErr;
    }
    await fs.updateDoc(reqRef, { status: 'completed', completedAt: fs.serverTimestamp(), completedAtMs: Date.now(), temporaryCredentialIssued: true, temporaryCredentialExpiresAtMs: expiresAtMs, emailSent: true, emailSentAt: fs.serverTimestamp(), emailSentAtMs: Date.now() });
    if (window.showToast) showToast('臨時密碼已寄出，有效期限 10 分鐘。', 'success');
  } catch (err) {
    console.error(err);
    if (window.showToast) showToast('臨時密碼寄送失敗：' + err.message, 'error');
  }
};
window.rejectPasswordResetRequest = async function rejectPasswordResetRequest(id) {
  try {
    const { db, fs } = await T();
    await fs.updateDoc(fs.doc(db, 'secretg_apps', AID, 'password_reset_requests', id), { status: 'rejected', rejectedAt: fs.serverTimestamp(), rejectedAtMs: Date.now() });
    if (window.showToast) showToast('忘記密碼申請已拒絕', 'info');
  } catch (err) {
    console.error(err);
    if (window.showToast) showToast('拒絕失敗：' + err.message, 'error');
  }
};

(() => {
  const VERSION = '20260709-admin-tools-merged-v3';
  const groups = { member: ['pending','avatar_pending','spec_pending','approved','active','rejected','all'], safety: ['reported_posts','reported_comments'], security: ['password_reset_requests','account_delete_requests','email_failures'], system: ['all'] };
  const labels = { all:'全部資料', pending:'待審核帳號', avatar_pending:'待審核頭像', spec_pending:'待審核 Spec 認證', reported_posts:'被檢舉貼文', reported_comments:'被檢舉留言', account_delete_requests:'帳號刪除申請', password_reset_requests:'忘記密碼申請', email_failures:'Email 發送失敗', approved:'已核准', active:'已啟用', rejected:'已拒絕' };
  const qs = id => document.getElementById(id);
  const tx = v => String(v || '').replace(/\s+/g, ' ').trim();
  const current = () => qs('filter-status')?.value || 'pending';
  const groupOf = v => groups.safety.includes(v) ? 'safety' : groups.security.includes(v) ? 'security' : 'member';
  function sync(value = current()) { document.querySelectorAll('[data-sr-admin-group]').forEach(b => b.classList.toggle('sr-admin-group-active', b.dataset.srAdminGroup === groupOf(value))); }
  function setFilter(value) { const s = qs('filter-status'); if (!s) return; s.value = value; typeof window.filterApplications === 'function' ? window.filterApplications() : s.dispatchEvent(new Event('change', { bubbles:true })); sync(value); }
  function addHeader() {
    const header = document.querySelector('#admin-main header');
    const status = qs('connection-status');
    if (!header || qs('sr-admin-env-badge')) return;
    const box = document.createElement('div');
    box.id = 'sr-admin-env-badge';
    box.className = 'flex flex-wrap items-center gap-2 text-[10px] font-black tracking-wider';
    box.innerHTML = '<span class="px-3 py-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">Production</span><span class="px-3 py-2 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-300">高權限操作需二次確認</span><button id="sr-admin-logout" class="px-3 py-2 rounded-full border border-slate-700 bg-slate-950/70 text-slate-300 hover:text-white hover:border-amber-500/40 transition">登出</button>';
    (status?.parentElement || header).appendChild(box);
    qs('sr-admin-logout').onclick = () => { localStorage.removeItem('sr_admin_id'); location.reload(); };
  }
  function addStatsLabel() {
    const main = qs('admin-main');
    const grid = main?.querySelector('.grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-5') || main?.querySelector('.grid.grid-cols-1');
    if (!grid || qs('sr-admin-stats-label')) return;
    const label = document.createElement('div');
    label.id = 'sr-admin-stats-label';
    label.className = 'mb-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-[10px] font-black tracking-wider text-slate-500';
    label.innerHTML = '<div class="rounded-2xl border border-amber-500/10 bg-slate-950/35 px-4 py-2"><i class="fa-solid fa-list-check text-amber-400 mr-1.5"></i> 待處理任務</div><div class="rounded-2xl border border-rose-500/10 bg-slate-950/35 px-4 py-2"><i class="fa-solid fa-shield-halved text-rose-300 mr-1.5"></i> 安全風險</div><div class="rounded-2xl border border-cyan-500/10 bg-slate-950/35 px-4 py-2"><i class="fa-solid fa-chart-line text-cyan-300 mr-1.5"></i> 營運數據</div>';
    grid.parentElement.insertBefore(label, grid);
  }
  function renderSubs(group, active) {
    const box = qs('sr-admin-subfilters'); if (!box) return;
    box.innerHTML = (groups[group] || groups.member).map(v => `<button type="button" data-filter-value="${v}" class="sr-admin-subfilter ${active === v ? 'sr-admin-subfilter-active' : ''}">${labels[v] || v}</button>`).join('');
    box.querySelectorAll('[data-filter-value]').forEach(btn => btn.onclick = () => { renderSubs(group, btn.dataset.filterValue); setFilter(btn.dataset.filterValue); });
  }
  function addGroups() {
    const select = qs('filter-status'); const search = qs('admin-search');
    if (!select || qs('sr-admin-task-groups')) return;
    if (search) search.placeholder = '搜尋帳號、暱稱、Email、檢舉原因、貼文內容';
    Array.from(select.options).forEach(o => { if (labels[o.value]) o.textContent = labels[o.value]; });
    const wrap = document.createElement('div');
    wrap.id = 'sr-admin-task-groups';
    wrap.className = 'mb-4 p-3 rounded-3xl border border-amber-500/10 bg-slate-950/35';
    wrap.innerHTML = '<div class="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3"><button data-sr-admin-group="member" class="sr-admin-group-btn" type="button"><i class="fa-solid fa-user-check"></i> 會員審核</button><button data-sr-admin-group="safety" class="sr-admin-group-btn" type="button"><i class="fa-solid fa-shield-halved"></i> 內容安全</button><button data-sr-admin-group="security" class="sr-admin-group-btn" type="button"><i class="fa-solid fa-key"></i> 帳號安全</button><button data-sr-admin-group="system" class="sr-admin-group-btn" type="button"><i class="fa-solid fa-bullhorn"></i> 系統通知</button></div><div id="sr-admin-subfilters" class="flex gap-2 overflow-x-auto pb-1"></div>';
    const panel = qs('admin-list')?.parentElement;
    const row = panel?.querySelector('.flex.items-center.justify-between.mb-6');
    row ? row.insertAdjacentElement('afterend', wrap) : select.parentElement?.parentElement?.insertAdjacentElement('afterend', wrap);
    wrap.querySelectorAll('[data-sr-admin-group]').forEach(btn => btn.onclick = () => { const g = btn.dataset.srAdminGroup; const first = g === 'member' ? 'pending' : g === 'safety' ? 'reported_posts' : g === 'security' ? 'password_reset_requests' : 'all'; renderSubs(g, first); setFilter(first); });
    renderSubs(groupOf(current()), current()); sync();
  }
  function improveResetCards() {
    document.querySelectorAll('button').forEach(b => { if (tx(b) === '設定新密碼') b.textContent = '寄出 10 分鐘臨時密碼'; });
    document.querySelectorAll('#admin-list > div').forEach(card => {
      const t = tx(card); if (!t.includes('忘記密碼') || card.querySelector('.sr-reset-flow-note')) return;
      const note = document.createElement('div');
      note.className = 'sr-reset-flow-note text-[10px] text-amber-300/80 mt-2 rounded-xl border border-amber-500/10 bg-amber-500/5 px-3 py-2';
      note.textContent = t.includes('已處理') ? '此申請已處理。請確認會員是否已成功登入並完成新密碼設定。' : '流程：寄出臨時密碼 → 10 分鐘有效 → 會員登入後強制設定新密碼 → 寄出安全提醒。';
      card.querySelector('.space-y-1\\.5, .space-y-2, .space-y-3')?.appendChild(note) || card.appendChild(note);
    });
  }
  function enhanceBroadcast() {
    const title = qs('broadcast-title'), msg = qs('broadcast-message');
    if (title && !title.dataset.srDraft) { title.dataset.srDraft = '1'; title.value = localStorage.getItem('sr_broadcast_draft_title') || title.value; title.addEventListener('input', () => localStorage.setItem('sr_broadcast_draft_title', title.value)); }
    if (msg && !msg.dataset.srDraft) { msg.dataset.srDraft = '1'; msg.value = localStorage.getItem('sr_broadcast_draft_message') || msg.value; msg.addEventListener('input', () => localStorage.setItem('sr_broadcast_draft_message', msg.value)); }
    const sendBtn = Array.from(document.querySelectorAll('button')).find(b => tx(b).includes('發送平台通知'));
    if (sendBtn && !qs('sr-broadcast-preview-btn')) { const p = document.createElement('button'); p.id = 'sr-broadcast-preview-btn'; p.type = 'button'; p.className = 'mr-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition'; p.innerHTML = '<i class="fa-regular fa-eye mr-1.5"></i> 預覽'; p.onclick = () => alert(`通知預覽\n\n標題：${title?.value || '(未填)'}\n\n內容：\n${msg?.value || '(未填)'}`); sendBtn.parentElement.insertBefore(p, sendBtn); }
    if (typeof window.sendPlatformBroadcast === 'function' && !window.sendPlatformBroadcast.__srWrapped) { const original = window.sendPlatformBroadcast; window.sendPlatformBroadcast = async function(...args) { const target = qs('broadcast-target')?.value === 'sg' ? 'S+ . S . G 會員' : '全體會員'; const titleText = qs('broadcast-title')?.value || ''; if (!confirm(`即將發送平台通知給：${target}\n\n標題：${titleText || '(未填標題)'}\n\n確認發送？`)) return; const result = await original.apply(this, args); localStorage.removeItem('sr_broadcast_draft_title'); localStorage.removeItem('sr_broadcast_draft_message'); return result; }; window.sendPlatformBroadcast.__srWrapped = true; }
  }
  function addToolbar() {
    const list = qs('admin-list'); if (!list || qs('sr-admin-list-toolbar')) return;
    const bar = document.createElement('div'); bar.id = 'sr-admin-list-toolbar'; bar.className = 'mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[10px] text-slate-500';
    bar.innerHTML = '<span><i class="fa-solid fa-arrows-rotate text-amber-400 mr-1.5"></i> 即時同步中；優先處理紅色與橘色項目。</span><span>建議排序：時間新 → 風險高 → 待處理。</span>';
    list.parentElement.insertBefore(bar, list);
  }
  function improveCards() {
    document.querySelectorAll('#admin-list > div').forEach(card => {
      if (card.dataset.srCardImproved) return;
      card.dataset.srCardImproved = '1';
      card.classList.add('sr-admin-review-card');
      const t = tx(card);
      if (/檢舉|安全|風險/.test(t)) card.classList.add('sr-admin-risk-card');
      if (/忘記密碼|臨時密碼|Email 發送失敗/.test(t)) card.classList.add('sr-admin-security-card');
      if (/待審核|審查中|申請/.test(t)) card.classList.add('sr-admin-pending-card');
    });
  }
  function apply() { addHeader(); addStatsLabel(); addGroups(); enhanceBroadcast(); addToolbar(); improveResetCards(); improveCards(); sync(); document.documentElement.dataset.srAdminUi = VERSION; }
  const css = document.createElement('style'); css.id = 'sr-admin-tools-style'; css.textContent = `
    #admin-main header{position:sticky;top:0;z-index:35;background:linear-gradient(180deg,rgba(2,2,4,.96),rgba(2,2,4,.78));backdrop-filter:blur(16px);padding-top:.5rem;border-radius:0 0 1.25rem 1.25rem}
    .sr-admin-group-btn{display:flex;align-items:center;justify-content:center;gap:.45rem;min-height:2.75rem;border-radius:1rem;border:1px solid rgba(245,158,11,.12);background:rgba(2,6,23,.45);color:#94a3b8;font-size:11px;font-weight:900;transition:.2s}.sr-admin-group-btn:hover,.sr-admin-group-active{color:#fcd34d;border-color:rgba(245,158,11,.36);background:rgba(245,158,11,.08)}
    .sr-admin-subfilter{flex:0 0 auto;border:1px solid rgba(148,163,184,.16);background:rgba(15,23,42,.55);color:#94a3b8;border-radius:.85rem;padding:.55rem .8rem;font-size:10px;font-weight:800;white-space:nowrap}.sr-admin-subfilter-active{color:#020617;background:linear-gradient(90deg,#f8d36a,#d99a23);border-color:#f8d36a}
    #admin-search,#filter-status{min-height:2.65rem}#admin-list>div{scroll-margin-top:6rem}.admin-stat-mini,#admin-main .grid>div{overflow:hidden}
    #admin-list{display:grid;gap:1rem}.sr-admin-review-card{border-color:rgba(223,183,108,.16)!important;background:linear-gradient(145deg,rgba(15,23,42,.72),rgba(8,10,16,.62))!important;box-shadow:0 18px 45px rgba(0,0,0,.28)}.sr-admin-risk-card{border-left:4px solid rgba(244,63,94,.72)!important}.sr-admin-security-card{border-left:4px solid rgba(251,191,36,.76)!important}.sr-admin-pending-card{border-left:4px solid rgba(34,211,238,.55)!important}
    #broadcast-message{line-height:1.55!important}#broadcast-history{scrollbar-width:thin}.glass-panel h2,.glass-panel h3{letter-spacing:.02em}
    @media(max-width:768px){#sr-admin-env-badge{width:100%}#sr-admin-task-groups{position:sticky;top:.5rem;z-index:30;backdrop-filter:blur(14px)}#admin-main header{position:relative}.flex.items-center.justify-between{align-items:flex-start!important}#admin-search,#filter-status{width:100%!important}}
  `;
  document.head.appendChild(css);
  apply(); new MutationObserver(() => setTimeout(apply, 100)).observe(document.documentElement, { childList:true, subtree:true }); setInterval(apply, 1500);
})();