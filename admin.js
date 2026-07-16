/* SecretRoom admin consolidated runtime.
 * Generated from the previously separated runtime modules in their original execution order.
 * Admin login is fail-closed when the explicit admins collection cannot be verified.
 */

/* ===== Integrated admin runtime coordinator ===== */
;(() => {
  if (window.__SR_ADMIN_RUNTIME__) return;
  const tasks = new Set();
  let queued = false;
  const run = () => {
    queued = false;
    tasks.forEach(task => {
      try { task(); } catch (error) { console.error('Admin runtime task failed:', error); }
    });
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(run);
  };
  window.__SR_ADMIN_RUNTIME__ = true;
  window.SRAdminRuntime = Object.freeze({
    register(task) { if (typeof task === 'function') tasks.add(task); schedule(); return () => tasks.delete(task); },
    schedule
  });
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', schedule, { once: true });
})();

/* ===== Consolidated source: admin.js ===== */
;(() => {
let initializeApp, getFirestore, doc, collection, onSnapshot, updateDoc, getDoc, deleteDoc, query, where, getDocs, setDoc, serverTimestamp;

        const appId = 'secretg-production-node-tw';
        const firebaseConfig = {
            apiKey: "AIzaSyCNgJxYjC90DjtvTSaze5CREJf1Vt32aYQ",
            authDomain: "secretroom-ef728.firebaseapp.com",
            projectId: "secretroom-ef728",
            storageBucket: "secretroom-ef728.firebasestorage.app",
            messagingSenderId: "22006617218",
            appId: "1:22006617218:web:9e9af5c6558ea57dcb109b"
        };

        const emailjsConfig = {
    publicKey: "XggJY7iHQcZYYhNY7",
    serviceId: "service_1ou10mi",
    defaultTemplateId: "template_sr_notice",
    templates: {
        registrationApproved: "template_sr_notice",
        registrationRejected: "template_sr_notice",
        specApproved: "template_sr_notice",
        specRejected: "template_sr_notice",
        avatarApproved: "template_sr_notice",
        avatarRejected: "template_sr_notice",
        reportAccepted: "template_sr_notice",
        reportDismissed: "template_sr_notice",
        passwordReset: "template_sr_security",
        accountRequest: "template_sr_security"
    }
};

        async function loadFirebaseSDKs() {
            try {
                const [appMod, firestoreMod] = await Promise.all([
                    import("https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js"),
                    import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js")
                ]);

                initializeApp = appMod.initializeApp;
                getFirestore = firestoreMod.getFirestore;
                doc = firestoreMod.doc;
                collection = firestoreMod.collection;
                onSnapshot = firestoreMod.onSnapshot;
                updateDoc = firestoreMod.updateDoc;
                getDoc = firestoreMod.getDoc;
                deleteDoc = firestoreMod.deleteDoc; 
                query = firestoreMod.query;
                where = firestoreMod.where;
                getDocs = firestoreMod.getDocs;
                setDoc = firestoreMod.setDoc;
                serverTimestamp = firestoreMod.serverTimestamp;

                return true;
            } catch (e) {
                console.error("無法同步伺服器安全套件:", e);
                return false;
            }
        }

        let db;
        let allApplications = [];
        let allAdmins = [];
        let allPosts = [];
        let allNotifications = [];
        let allPasswordResetRequests = [];
        let allAccountRequests = [];
        let allEmailFailures = [];
        let currentAdminId = null;
        let currentAdminSource = null;
        let userIdToDelete = null; 

        async function initAdmin() {
            if (emailjsConfig.publicKey && emailjsConfig.publicKey !== "YOUR_EMAILJS_PUBLIC_KEY") {
                emailjs.init({ publicKey: emailjsConfig.publicKey, blockHeadless: false });
            }

            const firebaseLoaded = await loadFirebaseSDKs();
            const statusEl = document.getElementById('connection-status');

            if (firebaseLoaded) {
                try {
                    const app = initializeApp(firebaseConfig);
                    db = getFirestore(app);
                    statusEl.className = "self-start px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2";
                    statusEl.innerHTML = '<i class="fa-solid fa-circle text-[8px] animate-pulse"></i> 安全連線已建立 ✓';
                    
                    initAdminGate();
                } catch (error) {
                    console.error("資料庫通訊協定錯誤:", error);
                    statusEl.className = "self-start px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center gap-2";
                    statusEl.innerHTML = '<i class="fa-solid fa-circle text-[8px]"></i> 連線超時';
                    showMockDataInfo();
                }
            } else {
                statusEl.className = "self-start px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 flex items-center gap-2";
                statusEl.innerHTML = '<i class="fa-solid fa-circle text-[8px]"></i> 離線安全沙盒環境';
                showMockDataInfo();
            }
        }

        function isAdminAccount(data) {
            return !!data && data.enabled !== false && (data.role === 'admin' || data.isAdmin === true || data.canAdmin === true || data.adminApproved === true);
        }

        function showAdminLoginError(message) {
            const box = document.getElementById('admin-login-error');
            if (box) {
                box.textContent = message;
                box.classList.remove('hidden');
            }
            showToast(message, 'error');
        }

        async function sha256Hex(text) {
            const bytes = new TextEncoder().encode(text);
            const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
            return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        }

        async function verifyAdminSession(adminId, password) {
            const adminRef = doc(db, 'secretg_apps', appId, 'admins', adminId);
            const adminSnap = await getDoc(adminRef);
            if (!adminSnap.exists()) throw new Error('查無此管理員帳號。請在 admins/' + adminId + ' 建立並啟用管理員文件。');
            const data = adminSnap.data();
            const source = 'admins';

            if (data.enabled === false) throw new Error('此管理員帳號已停用');
            if (!password) throw new Error('請重新輸入管理員密碼');
            if (data.passwordHash) {
                const inputHash = await sha256Hex(password);
                if (inputHash !== data.passwordHash) throw new Error('密碼不正確');
            } else if (data.password !== password) {
                throw new Error('密碼不正確');
            }
            if (!isAdminAccount(data)) throw new Error('此帳號沒有後台權限');
            currentAdminId = adminId;
            currentAdminSource = source;
            return data;
        }

        function showAdminApp() {
            const login = document.getElementById('admin-login-modal');
            const main = document.getElementById('admin-main');
            if (login) login.classList.add('hidden');
            if (main) main.classList.remove('hidden');
            listenToApplications();
            listenToAdmins();
            listenToPosts();
            listenToNotifications();
            listenToPasswordResetRequests();
            listenToAccountRequests();
            listenToEmailFailures();
        }

        function initAdminGate() {
            localStorage.removeItem('sr_admin_id');
            const btn = document.getElementById('admin-login-submit');
            if (!btn) return;
            btn.onclick = async () => {
                const adminId = document.getElementById('admin-login-id').value.trim();
                const password = document.getElementById('admin-login-password').value;
                if (!adminId || !password) { showAdminLoginError('請輸入管理員帳號與密碼'); return; }
                btn.disabled = true;
                btn.textContent = '驗證中...';
                try {
                    await verifyAdminSession(adminId, password);
                    await writeAdminLog('admin_login', adminId, { targetType: 'admin' });
                    showToast('管理員驗證成功', 'success');
                    showAdminApp();
                } catch (err) {
                    showAdminLoginError(err.message || '管理員驗證失敗');
                } finally {
                    btn.disabled = false;
                    btn.textContent = '登入後台';
                }
            };
        }

        async function writeAdminLog(action, targetId = '', details = {}) {
            if (!db) return;
            try {
                const logRef = doc(collection(db, 'secretg_apps', appId, 'admin_logs'));
                await setDoc(logRef, {
                    action,
                    targetId,
                    details,
                    adminId: currentAdminId || localStorage.getItem('sr_admin_id') || 'unknown',
                    adminSource: currentAdminSource || 'unknown',
                    createdAt: serverTimestamp(),
                    createdAtMs: Date.now()
                });
            } catch (err) {
                console.warn('寫入管理紀錄失敗:', err);
            }
        }

        function listenToNotifications() {
            const q = collection(db, 'secretg_apps', appId, 'notifications');
            onSnapshot(q, (querySnapshot) => {
                allNotifications = [];
                querySnapshot.forEach((docSnap) => allNotifications.push({ id: docSnap.id, ...docSnap.data() }));
                renderNotificationHistory();
            }, (err) => console.error('通知紀錄同步失敗:', err));
        }

        function listenToEmailFailures() {
            const q = collection(db, 'secretg_apps', appId, 'email_failures');
            onSnapshot(q, (querySnapshot) => {
                allEmailFailures = [];
                querySnapshot.forEach((docSnap) => allEmailFailures.push({ id: docSnap.id, ...docSnap.data() }));
                const filter = document.getElementById('filter-status');
                if (filter && filter.value === 'email_failures') renderApplications();
            }, (err) => console.error('Email 失敗紀錄同步失敗:', err));
        }

        function parseTime(value) {
            if (value && value.seconds) return value.seconds * 1000;
            if (typeof value === 'number') return value;
            const t = value ? new Date(value).getTime() : 0;
            return Number.isNaN(t) ? 0 : t;
        }

        function formatTime(value) {
            const t = parseTime(value);
            if (!t) return '—';
            return new Date(t).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
        }

        function renderNotificationHistory() {
            const box = document.getElementById('broadcast-history');
            const count = document.getElementById('broadcast-history-count');
            if (!box) return;
            const list = [...allNotifications].filter(n => n.type === 'platform' || n.category === 'platform').sort((a,b) => parseTime(b.createdAt || b.createdAtMs) - parseTime(a.createdAt || a.createdAtMs));
            if (count) count.textContent = `${list.length} 則紀錄`;
            if (list.length === 0) {
                box.innerHTML = '<div class="text-xs text-slate-500 py-4 text-center border border-slate-800 rounded-xl">尚無平台通知紀錄</div>';
                return;
            }
            box.innerHTML = list.map(n => `
                <div class="admin-muted-card rounded-xl p-3 ${n.revoked ? 'opacity-50' : ''}">
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <div class="text-sm text-slate-200 font-bold truncate">${escapeHtml(n.title || '未命名通知')}</div>
                            <div class="text-[10px] text-slate-500 mt-1">${formatTime(n.createdAt || n.createdAtMs)} · ${n.target === 'sg' ? 'S+ . S . G' : '全體會員'} · ${n.revoked ? '已撤回' : '有效'}</div>
                            <p class="text-xs text-slate-400 mt-2 leading-relaxed line-clamp-2">${escapeHtml(n.message || '')}</p>
                        </div>
                        ${n.revoked ? '' : `<button onclick="revokePlatformNotification('${n.id}')" class="text-[10px] text-rose-400 border border-rose-500/20 px-2 py-1 rounded-lg hover:bg-rose-500/10">撤回</button>`}
                    </div>
                </div>
            `).join('');
        }

        window.revokePlatformNotification = async function(notificationId) {
            if (!db) return;
            const reason = prompt('請輸入撤回原因：') || '管理員撤回通知';
            try {
                await updateDoc(doc(db, 'secretg_apps', appId, 'notifications', notificationId), { revoked: true, revokedAt: serverTimestamp(), revokedAtMs: Date.now(), revokedBy: currentAdminId, revokeReason: reason });
                await writeAdminLog('revoke_notification', notificationId, { reason });
                showToast('平台通知已撤回', 'success');
            } catch (err) {
                showToast('撤回失敗: ' + err.message, 'error');
            }
        };

        function escapeHtml(value) {
            return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        }


        function updateAdminCount() {
            const ids = new Set();
            allAdmins.filter(admin => isAdminAccount(admin)).forEach(admin => ids.add(admin.id));
            const el = document.getElementById('count-admins');
            if (el) {
                el.textContent = ids.size;
                el.title = ids.size ? `admins 名單內目前啟用：${[...ids].sort().join(', ')}` : 'admins 名單內目前沒有啟用的管理員';
            }
        }

        function isTimeToday(value) {
            const t = parseTime(value);
            if (!t) return false;
            const d = new Date(t);
            const n = new Date();
            return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
        }

        function isTimeWithinDays(value, days) {
            const t = parseTime(value);
            if (!t) return false;
            return Date.now() - t <= days * 24 * 60 * 60 * 1000;
        }

        function isGoldSpecApproved(user) {
            if (!user) return false;
            const status = String(user.specEliteStatus || '').toLowerCase();
            return user.isSpecElite === true || status === 'approved' || status === 'active' || status === 'passed';
        }

        function setText(id, value) {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        }

        function updateOperationalStats() {
            const createdTime = (item) => item.createdAt || item.createdAtMs || item.submittedAt || item.updatedAt;
            setText('count-today-users', allApplications.filter(a => isTimeToday(createdTime(a))).length);
            setText('count-week-users', allApplications.filter(a => isTimeWithinDays(createdTime(a), 7)).length);
            setText('count-spec-users', allApplications.filter(isGoldSpecApproved).length);
            setText('count-ssg-users', allApplications.filter(isGoldSpecApproved).length);
            setText('count-today-posts', allPosts.filter(p => isTimeToday(p.createdAt || p.createdAtMs)).length);
            setText('count-account-requests', allAccountRequests.filter(r => String(r.status || 'pending') === 'pending').length);
            setText('count-password-reset', allPasswordResetRequests.filter(isValidForgotPasswordRequest).length);
        }

        function listenToAdmins() {
            const q = collection(db, 'secretg_apps', appId, 'admins');
            onSnapshot(q, (querySnapshot) => {
                allAdmins = [];
                querySnapshot.forEach((docSnap) => allAdmins.push({ id: docSnap.id, ...docSnap.data() }));
                updateAdminCount();
            }, (error) => {
                console.warn('管理員名錄同步失敗:', error);
                updateAdminCount();
            });
        }

        function listenToApplications() {
            const q = collection(db, 'secretg_apps', appId, 'applications');
            onSnapshot(q, (querySnapshot) => {
                allApplications = [];
                let pendingCount = 0;
                let avatarPendingCount = 0;

                querySnapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    allApplications.push({ id: docSnap.id, ...data });

                    if (data.status === 'pending') pendingCount++;
                    if (data.avatarStatus === 'pending' || data.specEliteStatus === 'pending') avatarPendingCount++;
                });

                document.getElementById('count-pending').textContent = pendingCount;
                document.getElementById('count-avatar-pending').textContent = avatarPendingCount;
                updateAdminCount();
                document.getElementById('count-total').textContent = allApplications.length;
                updateOperationalStats();

                renderApplications();
            }, (error) => {
                console.error("監聽名單同步失敗:", error);
                showToast("同步資料失敗，請檢查權限通道", "error");
            });
        }

        function listenToPosts() {
            const q = collection(db, 'secretg_apps', appId, 'posts');
            onSnapshot(q, (querySnapshot) => {
                allPosts = [];
                let reportedCount = 0;
                let reportedCommentCount = 0;

                querySnapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    allPosts.push({ id: docSnap.id, ...data });
                    if (data.reportCount && data.reportCount > 0) {
                        reportedCount++;
                    }
                    const comments = data.comments || {};
                    Object.values(comments).forEach(comment => {
                        if (comment && comment.reportCount && comment.reportCount > 0) reportedCommentCount++;
                    });
                });

                document.getElementById('count-reports').textContent = reportedCount + reportedCommentCount;
                updateOperationalStats();
                renderApplications(); 
            });
        }

        function listenToPasswordResetRequests() {
            const q = collection(db, 'secretg_apps', appId, 'password_reset_requests');
            onSnapshot(q, (querySnapshot) => {
                allPasswordResetRequests = [];
                querySnapshot.forEach((docSnap) => allPasswordResetRequests.push({ id: docSnap.id, ...docSnap.data() }));
                updateOperationalStats();
                renderApplications();
            }, (err) => console.warn('忘記密碼申請同步失敗:', err));
        }

        function listenToAccountRequests() {
            const q = collection(db, 'secretg_apps', appId, 'account_requests');
            onSnapshot(q, (querySnapshot) => {
                allAccountRequests = [];
                querySnapshot.forEach((docSnap) => allAccountRequests.push({ id: docSnap.id, ...docSnap.data() }));
                updateOperationalStats();
                renderApplications();
            }, (err) => console.warn('帳號申請同步失敗:', err));
        }

        function showMockDataInfo() {
            const listContainer = document.getElementById('admin-list');
            listContainer.innerHTML = `
                <div class="bg-slate-900/80 p-6 rounded-2xl border border-slate-800 text-center flex flex-col items-center justify-center gap-4">
                    <div class="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 text-xl">
                        <i class="fa-solid fa-circle-info"></i>
                    </div>
                    <div>
                        <h4 class="font-bold text-slate-200">安全網路診斷：本機加密沙盒已啟用</h4>
                        <p class="text-xs text-slate-500 mt-1">提示：本機目前處於隔離測試狀態，如需對接正式資料庫，請於程式碼部署正式 Config 安全密鑰。</p>
                    </div>
                </div>
            `;
            document.getElementById('count-pending').textContent = '0';
            document.getElementById('count-avatar-pending').textContent = '0';
            document.getElementById('count-admins').textContent = '0';
            document.getElementById('count-total').textContent = '0';
            updateOperationalStats();
        }

        window.zoomImage = function(src) {
            const modal = document.getElementById('zoom-modal');
            const img = document.getElementById('zoom-modal-img');
            if (modal && img) {
                img.src = src;
                modal.classList.remove('hidden');
                setTimeout(() => modal.classList.remove('opacity-0'), 50);
            }
        }

        window.closeZoomModal = function() {
            const modal = document.getElementById('zoom-modal');
            if (modal) {
                modal.classList.add('opacity-0');
                setTimeout(() => modal.classList.add('hidden'), 300);
            }
        }

        function renderRequestTime(item) {
            return formatTime(item.createdAt || item.createdAtMs || item.updatedAt || item.updatedAtMs);
        }

        function requestStatusLabel(status) {
            const value = String(status || 'pending');
            if (value === 'completed') return '已完成';
            if (value === 'rejected') return '已拒絕';
            if (value === 'approved') return '已核准';
            return '待處理';
        }

        function normalizeEmail(value) {
            return String(value || '').trim().toLowerCase();
        }

        function getApplicationById(userId) {
            const id = String(userId || '').trim();
            if (!id) return null;
            return allApplications.find(app => String(app.id || '').trim() === id) || null;
        }

        function getBoundEmailFromMember(member) {
            return normalizeEmail(member && (member.email || member.boundEmail || member.notificationEmail));
        }

        function isActiveMemberForForgotPassword(member) {
            if (!member) return false;
            const status = String(member.status || '').toLowerCase();
            return !status || status === 'approved' || status === 'active';
        }

        function isValidForgotPasswordRequest(req) {
            if (!req || String(req.status || 'pending') !== 'pending') return false;
            const member = getApplicationById(req.userId);
            if (!isActiveMemberForForgotPassword(member)) return false;
            const requestEmail = normalizeEmail(req.email);
            const memberEmail = getBoundEmailFromMember(member);
            return !!requestEmail && !!memberEmail && requestEmail === memberEmail;
        }

        function getVisibleForgotPasswordRequests() {
            return allPasswordResetRequests.filter(req => {
                const status = String(req.status || 'pending');
                if (status !== 'pending') return true;
                return isValidForgotPasswordRequest(req);
            });
        }

        function renderPasswordResetRequests(listContainer) {
            const searchTerm = (document.getElementById('admin-search')?.value || '').trim().toLowerCase();
            const list = getVisibleForgotPasswordRequests()
                .filter(r => !searchTerm || `${r.userId || ''} ${r.email || ''} ${r.status || ''}`.toLowerCase().includes(searchTerm))
                .sort((a,b) => parseTime(b.createdAt || b.createdAtMs) - parseTime(a.createdAt || a.createdAtMs));
            listContainer.innerHTML = '';
            if (list.length === 0) {
                listContainer.innerHTML = '<div class="text-center py-12 text-slate-500 flex flex-col items-center gap-2"><i class="fa-solid fa-key text-2xl"></i><span>目前沒有忘記密碼申請</span></div>';
                return;
            }
            list.forEach(req => {
                const pending = String(req.status || 'pending') === 'pending';
                const card = document.createElement('div');
                card.className = `admin-muted-card p-5 rounded-2xl border ${pending ? 'border-amber-500/20' : 'border-slate-800/80 opacity-75'} flex flex-col md:flex-row md:items-center justify-between gap-4`;
                card.innerHTML = `
                    <div class="space-y-1.5">
                        <div class="text-sm font-black text-slate-200">忘記密碼：@${escapeHtml(req.userId || '未填帳號')}</div>
                        <div class="text-xs text-slate-400"><i class="fa-regular fa-envelope"></i> ${escapeHtml(req.email || '未填信箱')}</div>
                        <div class="text-[10px] text-slate-500">${renderRequestTime(req)} · ${requestStatusLabel(req.status)}</div>
                    </div>
                    <div class="flex gap-2 flex-wrap">
                        ${pending ? `
                            <button onclick="completePasswordResetRequest('${req.id}')" class="bg-emerald-600/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/20 text-xs px-4 py-2.5 rounded-xl font-bold">設定新密碼</button>
                            <button onclick="rejectPasswordResetRequest('${req.id}')" class="bg-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-300 border border-slate-700 text-xs px-4 py-2.5 rounded-xl font-bold">拒絕</button>
                        ` : '<span class="text-xs text-slate-500 px-3 py-2">已處理</span>'}
                    </div>`;
                listContainer.appendChild(card);
            });
        }

        function renderAccountDeletionRequests(listContainer) {
            const searchTerm = (document.getElementById('admin-search')?.value || '').trim().toLowerCase();
            const list = [...allAccountRequests]
                .filter(r => String(r.type || '') === 'account_delete')
                .filter(r => !searchTerm || `${r.userId || ''} ${r.email || ''} ${r.nickname || ''} ${r.reason || ''} ${r.status || ''}`.toLowerCase().includes(searchTerm))
                .sort((a,b) => parseTime(b.createdAt || b.createdAtMs) - parseTime(a.createdAt || a.createdAtMs));
            listContainer.innerHTML = '';
            if (list.length === 0) {
                listContainer.innerHTML = '<div class="text-center py-12 text-slate-500 flex flex-col items-center gap-2"><i class="fa-solid fa-user-slash text-2xl"></i><span>目前沒有帳號刪除申請</span></div>';
                return;
            }
            list.forEach(req => {
                const pending = String(req.status || 'pending') === 'pending';
                const card = document.createElement('div');
                card.className = `admin-muted-card p-5 rounded-2xl border ${pending ? 'border-rose-500/25' : 'border-slate-800/80 opacity-75'} flex flex-col md:flex-row md:items-start justify-between gap-4`;
                card.innerHTML = `
                    <div class="space-y-2 flex-1">
                        <div class="text-sm font-black text-slate-200">刪除帳號申請：${escapeHtml(req.nickname || '')} <span class="font-mono text-slate-500">@${escapeHtml(req.userId || '')}</span></div>
                        <div class="text-xs text-slate-400"><i class="fa-regular fa-envelope"></i> ${escapeHtml(req.email || '未填信箱')}</div>
                        <div class="text-xs text-slate-300 bg-slate-950/45 border border-slate-800 rounded-xl p-3">${escapeHtml(req.reason || '未填寫原因')}</div>
                        <div class="text-[10px] text-slate-500">${renderRequestTime(req)} · ${requestStatusLabel(req.status)}</div>
                    </div>
                    <div class="flex gap-2 flex-wrap">
                        ${pending ? `
                            <button onclick="approveAccountDeletionRequest('${req.id}')" class="bg-red-600/80 hover:bg-red-500 text-white text-xs px-4 py-2.5 rounded-xl font-bold">核准並刪除</button>
                            <button onclick="rejectAccountDeletionRequest('${req.id}')" class="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs px-4 py-2.5 rounded-xl font-bold">拒絕</button>
                        ` : '<span class="text-xs text-slate-500 px-3 py-2">已處理</span>'}
                    </div>`;
                listContainer.appendChild(card);
            });
        }

        function emailFailureStatusLabel(status) {
            const value = String(status || 'failed');
            if (value === 'sent') return '補寄成功';
            if (value === 'handled') return '已手動處理';
            return '發送失敗';
        }

        function buildEmailFailureText(item) {
            return [
                `To: ${item.toName || item.memberId || 'SecretRoom Member'} <${item.toEmail || ''}>`,
                `Subject: ${item.title || 'SecretRoom 通知'}`,
                '',
                item.message || ''
            ].join('\n');
        }

        function renderEmailFailures(listContainer) {
            const searchTerm = (document.getElementById('admin-search')?.value || '').trim().toLowerCase();
            const list = [...allEmailFailures]
                .filter(item => !searchTerm || `${item.memberId || ''} ${item.toEmail || ''} ${item.toName || ''} ${item.title || ''} ${item.templateKey || ''} ${item.status || ''} ${item.errorMessage || ''}`.toLowerCase().includes(searchTerm))
                .sort((a,b) => parseTime(b.createdAt || b.createdAtMs || b.lastFailedAtMs) - parseTime(a.createdAt || a.createdAtMs || a.lastFailedAtMs));
            listContainer.innerHTML = '';
            if (list.length === 0) {
                listContainer.innerHTML = '<div class="text-center py-12 text-slate-500 flex flex-col items-center gap-2"><i class="fa-solid fa-envelope-circle-check text-2xl text-emerald-400"></i><span>目前沒有 Email 發送失敗紀錄</span></div>';
                return;
            }
            list.forEach(item => {
                const status = String(item.status || 'failed');
                const canRetry = status !== 'sent';
                const card = document.createElement('div');
                card.className = `admin-muted-card p-5 rounded-2xl border ${status === 'sent' ? 'border-emerald-500/20 opacity-75' : 'border-rose-500/25'} flex flex-col md:flex-row md:items-start justify-between gap-4`;
                card.innerHTML = `
                    <div class="space-y-2 flex-1 min-w-0">
                        <div class="text-sm font-black text-slate-200">Email 發送失敗：${escapeHtml(item.title || 'SecretRoom 通知')}</div>
                        <div class="text-xs text-slate-400"><i class="fa-regular fa-envelope"></i> ${escapeHtml(item.toEmail || '未記錄信箱')}</div>
                        <div class="text-xs text-slate-500">會員：@${escapeHtml(item.memberId || '')} · 類型：${escapeHtml(item.templateKey || 'notice')} · ${emailFailureStatusLabel(status)}</div>
                        <div class="text-xs text-rose-300 bg-rose-950/20 border border-rose-500/10 rounded-xl p-3 leading-relaxed break-words">${escapeHtml(item.errorMessage || item.lastError || '未記錄錯誤訊息')}</div>
                        <div class="text-xs text-slate-300 bg-slate-950/45 border border-slate-800 rounded-xl p-3 leading-relaxed whitespace-pre-wrap">${escapeHtml(item.message || '')}</div>
                        <div class="text-[10px] text-slate-500">${formatTime(item.createdAt || item.createdAtMs || item.lastFailedAtMs)} · 重試 ${Number(item.retryCount || 0)} 次</div>
                    </div>
                    <div class="flex gap-2 flex-wrap shrink-0">
                        ${canRetry ? `<button onclick="retryEmailFailure('${item.id}')" class="bg-emerald-600/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/20 text-xs px-4 py-2.5 rounded-xl font-bold">重新寄送</button>` : ''}
                        <button onclick="copyEmailFailureMessage('${item.id}')" class="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs px-4 py-2.5 rounded-xl font-bold">複製內容</button>
                        ${status !== 'handled' ? `<button onclick="markEmailFailureHandled('${item.id}')" class="bg-slate-800 hover:bg-amber-950/40 text-slate-400 hover:text-amber-300 border border-slate-700 text-xs px-4 py-2.5 rounded-xl font-bold">標記已處理</button>` : ''}
                    </div>`;
                listContainer.appendChild(card);
            });
        }

        window.renderApplications = function() {
            const listContainer = document.getElementById('admin-list');
            const filterValue = document.getElementById('filter-status').value;

            if (filterValue === 'password_reset_requests') {
                renderPasswordResetRequests(listContainer);
                return;
            }

            if (filterValue === 'account_delete_requests') {
                renderAccountDeletionRequests(listContainer);
                return;
            }

            if (filterValue === 'email_failures') {
                renderEmailFailures(listContainer);
                return;
            }

            if (filterValue === 'reported_comments') {
                const reportedComments = [];
                allPosts.forEach(post => {
                    const comments = post.comments || {};
                    Object.entries(comments).forEach(([commentId, comment]) => {
                        if (comment && comment.reportCount && comment.reportCount > 0) reportedComments.push({ post, comment: { id: comment.id || commentId, ...comment } });
                    });
                });
                listContainer.innerHTML = '';
                if (reportedComments.length === 0) {
                    listContainer.innerHTML = `<div class="text-center py-12 text-slate-500 flex flex-col items-center gap-2"><i class="fa-solid fa-circle-check text-2xl text-emerald-500"></i><span>目前沒有任何被檢舉留言</span></div>`;
                    return;
                }
                reportedComments.forEach(({ post, comment }) => {
                    const card = document.createElement('div');
                    const reasons = (comment.reports || []).map(r => `<div class="text-xs bg-rose-950/20 text-rose-400 p-2 rounded-lg border border-rose-500/10 mb-1"><span class="font-bold">檢舉原因:</span> ${escapeHtml(r.reason || '')}</div>`).join('');
                    card.className = 'bg-slate-900/60 p-5 rounded-2xl border border-rose-500/20 hover:border-rose-500/40 transition flex flex-col md:flex-row gap-5 items-start justify-between';
                    card.innerHTML = `
                        <div class="flex-1 space-y-3">
                            <div class="text-[10px] text-slate-500">貼文 ID: ${escapeHtml(post.id)} · 留言者 @${escapeHtml(comment.userId || '')}</div>
                            <p class="text-xs text-slate-300 leading-relaxed border border-slate-800 rounded-xl p-3 bg-slate-950/50">${escapeHtml(comment.text || '')}</p>
                            <div class="text-[10px] text-slate-500 font-bold mb-1.5"><i class="fa-solid fa-flag text-rose-500"></i> 檢舉清單（共 ${comment.reportCount} 次）</div>
                            ${reasons}
                        </div>
                        <div class="flex gap-2 shrink-0 flex-wrap">
                            <button onclick="dismissCommentReports('${post.id}', '${comment.id}')" class="bg-emerald-600/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/20 text-xs px-4 py-2.5 rounded-xl transition font-semibold"><i class="fa-solid fa-shield-heart"></i> 駁回檢舉</button>
                            <button onclick="deleteSingleComment('${post.id}', '${comment.id}')" class="bg-red-650 hover:bg-red-500 text-white text-xs px-4 py-2.5 rounded-xl transition font-semibold"><i class="fa-solid fa-trash-can"></i> 刪除留言</button>
                        </div>`;
                    listContainer.appendChild(card);
                });
                return;
            }

            if (filterValue === 'reported_posts') {
                const reportedPosts = allPosts.filter(p => p.reportCount && p.reportCount > 0);
                listContainer.innerHTML = '';

                if (reportedPosts.length === 0) {
                    listContainer.innerHTML = `
                        <div class="text-center py-12 text-slate-500 flex flex-col items-center gap-2">
                            <i class="fa-solid fa-circle-check text-2xl text-emerald-500"></i>
                            <span>目前社群中沒有任何被檢舉的貼文</span>
                        </div>
                    `;
                    return;
                }

                reportedPosts.forEach(post => {
                    const card = document.createElement('div');
                    card.className = 'bg-slate-900/60 p-5 rounded-2xl border border-rose-500/20 hover:border-rose-500/40 transition flex flex-col md:flex-row gap-5 items-start justify-between';
                    
                    const reportReasonsHtml = post.reports ? post.reports.map(r => `
                        <div class="text-xs bg-rose-950/20 text-rose-400 p-2 rounded-lg border border-rose-500/10 mb-1 leading-relaxed">
                            <span class="font-bold">檢舉原因:</span> ${r.reason}
                        </div>
                    `).join('') : '';

                    card.innerHTML = `
                        <div class="flex-1 space-y-3">
                            <div class="flex items-center gap-3">
                                <img src="${post.authorAvatar}" class="w-8 h-8 rounded-full object-cover cursor-zoom-in" onclick="zoomImage('${post.authorAvatar}')">
                                <div>
                                    <h4 class="font-bold text-xs text-slate-200">${post.authorName} <span class="text-slate-500 font-mono">(@${post.userId})</span></h4>
                                    <p class="text-[10px] text-slate-500">貼文 ID: ${post.id}</p>
                                </div>
                            </div>
                            <p class="text-xs text-slate-300 leading-relaxed font-light">${post.text}</p>
                            <img src="${post.image}" class="w-24 h-auto rounded-xl border border-slate-800 max-h-36 object-cover cursor-zoom-in hover:scale-105 transition" onclick="zoomImage('${post.image}')">
                            
                            <div class="mt-2">
                                <div class="text-[10px] text-slate-500 font-bold mb-1.5 uppercase"><i class="fa-solid fa-flag text-rose-500"></i> 檢舉清單 (共 ${post.reportCount} 次檢舉)</div>
                                ${reportReasonsHtml}
                            </div>
                        </div>

                        <div class="flex gap-2 shrink-0 flex-wrap">
                            <button onclick="dismissReports('${post.id}')" class="bg-emerald-600/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/20 text-xs px-4 py-2.5 rounded-xl transition font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-950/10">
                                <i class="fa-solid fa-shield-heart"></i> 反駁檢舉 / 駁回
                            </button>
                            <button onclick="deleteSinglePost('${post.id}')" class="bg-red-650 hover:bg-red-500 text-white text-xs px-4 py-2.5 rounded-xl transition font-semibold shadow-lg shadow-red-950/20 flex items-center gap-1.5">
                                <i class="fa-solid fa-trash-can"></i> 下架並刪除貼文
                            </button>
                        </div>
                    `;
                    listContainer.appendChild(card);
                });
                return;
            }

            const searchTerm = (document.getElementById('admin-search')?.value || '').trim().toLowerCase();
            const filteredApps = allApplications.filter(app => {
                const haystack = [app.id, app.nickname, app.email, app.telegramInfo?.username, app.telegramInfo?.id].filter(Boolean).join(' ').toLowerCase();
                if (searchTerm && !haystack.includes(searchTerm)) return false;
                if (filterValue === 'all') return true;
                if (filterValue === 'avatar_pending') return app.avatarStatus === 'pending';
                if (filterValue === 'spec_pending') return app.specEliteStatus === 'pending';
                return app.status === filterValue;
            });

            listContainer.innerHTML = '';

            if (filteredApps.length === 0) {
                listContainer.innerHTML = `
                    <div class="text-center py-12 text-slate-500 flex flex-col items-center gap-2">
                        <i class="fa-solid fa-folder-open text-2xl"></i>
                        <span>無符合條件的申請資料</span>
                    </div>
                `;
                return;
            }

            filteredApps.forEach((appData) => {
                const card = document.createElement('div');
                card.className = 'bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 hover:border-slate-700/60 transition flex flex-col md:flex-row md:items-center justify-between gap-4';
                
                let kinksStr = appData.kinks && appData.kinks.length > 0 ? appData.kinks.join(', ') : '無';
                if (appData.otherKink) kinksStr += ` (其他: ${appData.otherKink})`;

                const statusColors = {
                    pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                    approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                    active: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                    rejected: 'bg-red-500/10 text-red-400 border-red-500/20'
                };
                const currentStatusColor = statusColors[appData.status] || 'bg-slate-800 text-slate-400 border-slate-700';

                let tgInfoHtml = '';
                if (appData.telegramInfo) {
                    tgInfoHtml = `
                        <div class="mt-2 pt-2 border-t border-slate-800/60 text-xs text-blue-400 flex items-center gap-1.5">
                            <i class="fa-brands fa-telegram text-sm"></i>
                            <span>已成功綁定：@${appData.telegramInfo.username || appData.telegramInfo.first_name} (ID: ${appData.telegramInfo.id})</span>
                        </div>
                    `;
                }

                let avatarReviewHtml = '';
                if (appData.avatarStatus === 'pending' && appData.avatarPending) {
                    avatarReviewHtml = `
                        <div class="mt-4 p-3 bg-purple-950/20 border border-purple-500/20 rounded-xl space-y-2">
                            <span class="text-xs text-purple-400 font-bold block"><i class="fa-solid fa-camera"></i> 變更頭像審查 (點擊可放大)：</span>
                            <div class="flex items-center gap-4">
                                <div class="text-center cursor-zoom-in" onclick="zoomImage('${appData.avatar}')">
                                    <img src="${appData.avatar}" class="w-14 h-14 rounded-full object-cover border border-slate-700 hover:opacity-80 transition">
                                    <span class="text-[9px] text-slate-500 block mt-1">目前原頭像</span>
                                </div>
                                <i class="fa-solid fa-arrow-right text-slate-600"></i>
                                <div class="text-center cursor-zoom-in" onclick="zoomImage('${appData.avatarPending}')">
                                    <img src="${appData.avatarPending}" class="w-14 h-14 rounded-full object-cover border-2 border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.3)] hover:opacity-80 transition">
                                    <span class="text-[9px] text-purple-400 font-bold block mt-1">申請新頭像</span>
                                </div>
                            </div>
                            <div class="flex gap-2 mt-2 pt-1">
                                <button onclick="approveAvatarChange('${appData.id}')" class="bg-purple-600 hover:bg-purple-500 text-white text-[10px] px-3 py-1.5 rounded-lg transition font-semibold">核准新頭像</button>
                                <button onclick="rejectAvatarChange('${appData.id}')" class="bg-slate-800 hover:bg-slate-750 text-slate-400 text-[10px] px-3 py-1.5 rounded-lg border border-slate-700 transition font-semibold">拒絕</button>
                            </div>
                        </div>
                    `;
                } else {
                    avatarReviewHtml = `
                        <div class="flex items-center gap-3">
                            <div class="cursor-zoom-in" onclick="zoomImage('${appData.avatar || 'Gemini_Generated_Image_e2fxvje2fxvje2fx.jpg?v=2'}')">
                                <img src="${appData.avatar || 'Gemini_Generated_Image_e2fxvje2fxvje2fx.jpg?v=2'}" class="w-12 h-12 rounded-full object-cover border-2 border-indigo-500/20 shadow hover:opacity-80 transition">
                            </div>
                            <span class="text-xs text-slate-500 font-medium">個人大頭照 (點擊可放大)</span>
                        </div>
                    `;
                }

                let specReviewHtml = '';
                if (appData.specEliteStatus === 'pending' && appData.specImage) {
                    specReviewHtml = `
                        <div class="mt-4 p-4 bg-amber-950/20 border border-amber-500/20 rounded-xl space-y-3 text-left">
                            <span class="text-xs text-amber-400 font-bold block"><i class="fa-solid fa-lock"></i> 收到黃金 Spec Elite 徽章申請 (獨立審核區)：</span>
                            <p class="text-[11px] text-slate-400">申報規格：長度 <strong class="text-slate-200">${appData.length}cm</strong> / 粗度 <strong class="text-slate-200">${appData.girth}cm</strong></p>
                            
                            <div class="relative w-32 h-32 rounded-lg overflow-hidden border border-slate-800 bg-slate-950 group cursor-zoom-in" onclick="zoomImage('${appData.specImage}')">
                                <img src="${appData.specImage}" class="w-full h-full object-cover group-hover:scale-105 transition">
                                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-[10px] text-white gap-1">
                                    <i class="fa-solid fa-magnifying-glass-plus"></i> 點擊放大驗證
                                </div>
                            </div>

                            <div class="flex gap-2 mt-1">
                                <button onclick="approveSpecElite('${appData.id}')" class="bg-amber-600 hover:bg-amber-500 text-slate-950 text-[10px] px-3 py-1.5 rounded-lg transition font-bold shadow-md">核發黃金 Spec 徽章</button>
                                <button onclick="rejectSpecElite('${appData.id}')" class="bg-slate-800 hover:bg-slate-750 text-slate-400 text-[10px] px-3 py-1.5 rounded-lg border border-slate-700 transition font-semibold">拒絕</button>
                            </div>
                        </div>
                    `;
                } else if (appData.isSpecElite) {
                    specReviewHtml = `
                        <div class="mt-4 p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl text-left flex justify-between items-center">
                            <div class="flex items-center gap-2">
                                <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 text-slate-950 shadow-yellow-500/25 animate-pulse">
                                    <i class="fa-solid fa-medal text-[10px]"></i>
                                </span>
                                <span class="text-xs text-slate-300 font-semibold">已取得黃金 Spec 認證 🔒</span>
                            </div>
                            <button onclick="toggleManualBadge('${appData.id}', 'isSpecElite', false)" class="text-[10px] text-red-400 hover:text-red-300 border border-red-500/10 hover:border-red-500/30 bg-red-500/5 px-2.5 py-1 rounded-lg transition font-semibold">
                                收回認證
                            </button>
                        </div>
                    `;
                }

                let badgeManagementHtml = `
                    <div class="mt-4 pt-3 border-t border-slate-800/50 flex flex-wrap gap-4 items-center justify-between">
                        <span class="text-[10px] text-slate-500 font-bold uppercase"><i class="fa-solid fa-ribbon"></i> 特權徽章手動授予：</span>
                        <div class="flex items-center gap-4">
                            <label class="flex items-center gap-1.5 cursor-pointer">
                                <input type="checkbox" onchange="toggleManualBadge('${appData.id}', 'isAdmin', this.checked)" ${appData.role === 'admin' || appData.isAdmin ? 'checked' : ''} class="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500">
                                <span class="text-[11px] text-slate-300">管理員 👑</span>
                            </label>
                            <label class="flex items-center gap-1.5 cursor-pointer">
                                <input type="checkbox" onchange="toggleManualBadge('${appData.id}', 'isPioneer', this.checked)" ${appData.isPioneer ? 'checked' : ''} class="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500">
                                <span class="text-[11px] text-slate-300">創始會員 🛡️</span>
                            </label>
                        </div>
                    </div>
                `;

                let actionButtons = '';
                if (appData.status === 'pending') {
                    actionButtons = `
                        <div class="flex gap-2 shrink-0 flex-wrap">
                            <button onclick="updateStatus('${appData.id}', 'approved')" class="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-lg shadow-emerald-950/20">
                                <i class="fa-solid fa-check mr-1"></i> 核准加入
                            </button>
                            <button onclick="openRejectReasonModal('${appData.id}')" class="bg-red-650 hover:bg-red-500 active:scale-95 text-red-400 border border-red-500/20 text-xs px-4 py-2.5 rounded-xl transition font-semibold">
                                <i class="fa-solid fa-xmark mr-1"></i> 拒絕
                            </button>
                            <button onclick="openDeleteModal('${appData.id}')" class="bg-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 border border-slate-700/80 hover:border-red-500/20 text-xs px-3 py-2.5 rounded-xl transition font-semibold">
                                <i class="fa-regular fa-trash-can"></i>
                            </button>
                        </div>
                    `;
                } else {
                    actionButtons = `
                        <div class="flex items-center gap-3 shrink-0 flex-wrap">
                            <div class="text-xs text-slate-500 font-medium bg-slate-950/40 px-3 py-2.5 rounded-xl border border-slate-900">
                                已於 ${appData.createdAt ? new Date(appData.createdAt.seconds * 1000).toLocaleDateString() : '未知時間'} 處理
                            </div>
                            <button onclick="openDeleteModal('${appData.id}')" class="bg-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 border border-slate-700/80 hover:border-red-500/20 text-xs px-3 py-2.5 rounded-xl transition font-semibold" title="刪除帳號">
                                <i class="fa-regular fa-trash-can"></i> 刪除帳號
                            </button>
                        </div>
                    `;
                }

                card.innerHTML = `
                    <div class="space-y-1.5 flex-1 text-left">
                        <div class="flex items-center gap-3 flex-wrap">
                            <h4 class="font-bold text-base text-slate-200">${appData.nickname || '未填'} <span class="text-xs text-slate-500 font-normal">(@${appData.id})</span></h4>
                            <span class="px-2.5 py-0.5 text-xs font-medium rounded-full border ${currentStatusColor}">
                                ${appData.status === 'pending' ? '待審核' : appData.status === 'approved' ? '已核准' : appData.status === 'active' ? '已啟用' : '已拒絕'}
                            </span>
                        </div>
                        <p class="text-xs text-slate-400 flex items-center gap-1"><i class="fa-regular fa-envelope"></i> 通知信箱：<span class="text-slate-300 font-mono">${appData.email}</span></p>
                        <div class="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-400 mt-2 pb-2">
                            <div><span class="text-slate-500">身高體重：</span>${appData.height} cm / ${appData.weight} kg</div>
                            <div><span class="text-slate-500">身體密碼：</span>長 ${appData.length} cm / 粗 ${appData.girth} cm</div>
                            <div class="col-span-2 mt-1"><span class="text-slate-500">主題偏好：</span><span class="text-slate-300">${kinksStr}</span></div>
                        </div>
                        ${avatarReviewHtml}
                        ${specReviewHtml}
                        ${badgeManagementHtml}
                        ${tgInfoHtml}
                    </div>
                    ${actionButtons}
                `;
                listContainer.appendChild(card);
            });
        }

        window.sendPlatformBroadcast = async function() {
            if (!db) {
                showToast("資料庫尚未完成連線，無法發送通知", "error");
                return;
            }
            const target = document.getElementById('broadcast-target').value;
            const title = document.getElementById('broadcast-title').value.trim();
            const message = document.getElementById('broadcast-message').value.trim();
            if (!title || !message) {
                showToast("請填寫通知標題與內容", "error");
                return;
            }
            if (!confirm(`即將發送給：${target === 'sg' ? 'S+ . S . G 會員' : '全體會員'}
標題：${title}

是否確認？`)) return;
            try {
                const notifRef = doc(collection(db, 'secretg_apps', appId, 'notifications'));
                await setDoc(notifRef, {
                    target,
                    type: 'platform',
                    category: 'platform',
                    tone: 'platform',
                    title,
                    message,
                    status: target === 'sg' ? 'S+ . S . G 專屬' : '全體會員公告',
                    createdAt: serverTimestamp(),
                    createdAtMs: Date.now(),
                    createdBy: currentAdminId || 'admin',
                    revoked: false
                });
                await writeAdminLog('send_broadcast', notifRef.id, { target, title });
                document.getElementById('broadcast-title').value = '';
                document.getElementById('broadcast-message').value = '';
                showToast(target === 'sg' ? '已發送給 S+ . S . G 會員' : '已發送給全體會員', 'success');
            } catch (err) {
                console.error("平台通知發送失敗:", err);
                showToast("發送失敗: " + err.message, "error");
            }
        }

        window.filterApplications = function() {
            renderApplications();
        }

        window.updateStatus = async function(userId, status) {
            if (!db) {
                showToast("目前處於本機加密沙盒，無法儲存狀態", "error");
                return;
            }

            try {
                const docRef = doc(db, 'secretg_apps', appId, 'applications', userId);
                const docSnap = await getDoc(docRef);
                
                if (!docSnap.exists()) {
                    showToast("找不到該筆申請資料", "error");
                    return;
                }
                
                const userData = docSnap.data();
                await updateDoc(docRef, { status: status, reviewedAt: serverTimestamp(), reviewedAtMs: Date.now(), reviewedBy: currentAdminId });
                await writeAdminLog('update_status', userId, { status });
                showToast('已將狀態更新為 ' + (status === 'approved' ? '已核准' : '已拒絕'), 'success');
                
                await sendEmailNotification(userData, status, status === 'approved' ? '會籍申請審核通過' : '會籍申請審核更新', null, status === 'approved' ? 'registrationApproved' : 'registrationRejected');
            } catch (e) {
                console.error("更新狀態失敗:", e);
                showToast('更新失敗: ' + e.message, 'error');
            }
        };

        window.toggleManualBadge = async function(userId, badgeField, isChecked) {
            if (!db) return;
            try {
                const docRef = doc(db, 'secretg_apps', appId, 'applications', userId);
                const updates = {};
                updates[badgeField] = isChecked;
                updates.updatedAt = serverTimestamp();
                updates.updatedAtMs = Date.now();
                updates.updatedBy = currentAdminId;
                await updateDoc(docRef, updates);
                await writeAdminLog('toggle_badge', userId, { badgeField, isChecked });
                showToast(`已成功${isChecked ? '發放' : '收回'}該項手動社群徽章！`, "success");
            } catch (err) {
                console.error("手動徽章異動失敗:", err);
                showToast("變更失敗", "error");
            }
        }

        window.approveSpecElite = async function(userId) {
            if (!db) return;
            try {
                const docRef = doc(db, 'secretg_apps', appId, 'applications', userId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    await updateDoc(docRef, {
                        isSpecElite: true,
                        specEliteStatus: 'approved',
                        specReviewedAt: serverTimestamp(),
                        specApprovedAt: serverTimestamp(),
                        specUpdatedAt: serverTimestamp(),
                        specReviewedAtMs: Date.now(),
                        specReviewedBy: currentAdminId
                    });
                    await writeAdminLog('approve_spec', userId, { length: data.length, girth: data.girth });
                    showToast("Spec Elite 徽章核准完成！", "success");
                    await sendEmailNotification(data, 'approved', "黃金 Spec 審核通過", "您的 SecretRoom 黃金 Spec Elite 勳章申請已正式核准", 'specApproved');
                }
            } catch (err) {
                console.error("核發失敗:", err);
            }
        }

        window.rejectSpecElite = async function(userId) {
            if (!db) return;
            try {
                const docRef = doc(db, 'secretg_apps', appId, 'applications', userId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    await updateDoc(docRef, {
                        specEliteStatus: 'rejected',
                        specImage: '',
                        specReviewedAt: serverTimestamp(),
                        specRejectedAt: serverTimestamp(),
                        specUpdatedAt: serverTimestamp(),
                        specReviewedAtMs: Date.now(),
                        specReviewedBy: currentAdminId,
                        specRejectionReason: prompt('請輸入黃金 Spec 拒絕原因：') || '照片或規格未通過官方核查'
                    });
                    await writeAdminLog('reject_spec', userId, { reason: 'spec_rejected' });
                    showToast("Spec Elite 申請已被退回。", "info");
                    await sendEmailNotification(data, 'rejected', "黃金 Spec 審核退回", "您申請的 SecretRoom 黃金 Spec Elite 勳章經管理員檢視照片或其他因素未通過。", 'specRejected');
                }
            } catch (err) {
                console.error("拒絕出錯:", err);
            }
        }

        let userIdToReject = null;
        window.openRejectReasonModal = function(userId) {
            userIdToReject = userId;
            const modal = document.getElementById('reject-reason-modal');
            const content = document.getElementById('reject-reason-content');
            modal.classList.remove('hidden');
            setTimeout(() => {
                modal.classList.remove('opacity-0');
                content.classList.remove('scale-95');
            }, 50);

            document.getElementById('confirm-reject-btn').onclick = async function() {
                const checkedRadio = document.querySelector('input[name="rejection-reason"]:checked');
                if (!checkedRadio) {
                    showToast("請選擇拒絕原因", "error");
                    return;
                }
                const reason = checkedRadio.value;
                await updateStatusWithReason(userIdToReject, 'rejected', reason);
                closeRejectReasonModal();
            };
        }

        window.closeRejectReasonModal = function() {
            const modal = document.getElementById('reject-reason-modal');
            const content = document.getElementById('reject-reason-content');
            modal.classList.add('opacity-0');
            content.classList.add('scale-95');
            setTimeout(() => {
                modal.classList.add('hidden');
                userIdToReject = null;
            }, 300);
        }

        async function updateStatusWithReason(userId, status, reason) {
            if (!db) {
                showToast("目前處於本機加密沙盒，無法儲存狀態", "error");
                return;
            }

            try {
                const docRef = doc(db, 'secretg_apps', appId, 'applications', userId);
                const docSnap = await getDoc(docRef);
                
                if (!docSnap.exists()) {
                    showToast("找不到該筆申請資料", "error");
                    return;
                }
                
                const userData = docSnap.data();
                await updateDoc(docRef, { 
                    status: status,
                    rejectionReason: reason,
                    reviewedAt: serverTimestamp(),
                    reviewedAtMs: Date.now(),
                    reviewedBy: currentAdminId 
                });
                await writeAdminLog('reject_application', userId, { reason });
                showToast('已退回會籍申請', 'success');
                
                await sendEmailNotification(userData, status, "會籍申請退回通知", `很抱歉，您的 SecretRoom 會籍申請未通過審核。退件理由：${reason}`, 'registrationRejected');
            } catch (e) {
                console.error("更新狀態失敗:", e);
                showToast('更新失敗: ' + e.message, 'error');
            }
        }

        function inferEmailTemplateKey(status, title, explicitKey = null) {
            if (explicitKey) return explicitKey;
            const text = `${title || ''} ${status || ''}`.toLowerCase();
            if (text.includes('黃金') || text.includes('spec')) return String(status).toLowerCase() === 'rejected' ? 'specRejected' : 'specApproved';
            if (text.includes('頭像')) return String(status).toLowerCase() === 'rejected' ? 'avatarRejected' : 'avatarApproved';
            if (text.includes('檢舉') || text.includes('貼文') || text.includes('留言')) return text.includes('駁回') || text.includes('未成立') || text.includes('dismiss') ? 'reportDismissed' : 'reportAccepted';
            if (text.includes('密碼')) return 'passwordReset';
            if (text.includes('刪除') || text.includes('帳號')) return 'accountRequest';
            return String(status).toLowerCase() === 'rejected' ? 'registrationRejected' : 'registrationApproved';
        }

        function getEmailTemplateId(templateKey) {
            const templates = emailjsConfig.templates || {};
            return templates[templateKey] || emailjsConfig.templateId || emailjsConfig.defaultTemplateId;
        }

        function getEmailTypeLabel(templateKey) {
            const labels = {
                registrationApproved: '會籍審核通過',
                registrationRejected: '會籍申請退回',
                specApproved: '黃金 Spec 認證通過',
                specRejected: '黃金 Spec 認證退回',
                avatarApproved: '大頭照更換通過',
                avatarRejected: '大頭照更換退回',
                reportAccepted: '內容審查處理',
                reportDismissed: '檢舉審查結果',
                passwordReset: '忘記密碼',
                accountRequest: '帳號異動'
            };
            return labels[templateKey] || '會員通知';
        }

        function formatEmailError(error) {
            if (!error) return '未知錯誤';
            if (typeof error === 'string') return error;
            const status = error.status || error.code || '';
            const text = error.text || error.message || error.name || '';
            const combined = `${status} ${text}`.trim();
            if (combined) return combined;
            try {
                return JSON.stringify(error).slice(0, 600);
            } catch (err) {
                return String(error).slice(0, 600);
            }
        }

        async function writeEmailFailure(error, context = {}) {
            if (!db) return;
            try {
                const userData = context.userData || {};
                const failureRef = doc(collection(db, 'secretg_apps', appId, 'email_failures'));
                await setDoc(failureRef, {
                    status: 'failed',
                    toEmail: context.targetEmail || userData.email || '',
                    toName: userData.nickname || userData.userId || 'SecretRoom Member',
                    memberId: userData.id || userData.userId || context.memberId || '',
                    title: context.title || 'SecretRoom 通知',
                    message: context.messageText || '',
                    templateKey: context.templateKey || '',
                    templateId: context.templateId || '',
                    emailType: getEmailTypeLabel(context.templateKey || ''),
                    errorMessage: formatEmailError(error),
                    errorRaw: (() => { try { return JSON.stringify(error).slice(0, 1200); } catch (err) { return String(error).slice(0, 1200); } })(),
                    retryCount: 0,
                    createdAt: serverTimestamp(),
                    createdAtMs: Date.now(),
                    createdBy: currentAdminId || 'admin'
                });
                await writeAdminLog('email_failure_recorded', userData.id || userData.userId || context.memberId || failureRef.id, { failureId: failureRef.id, templateKey: context.templateKey || '', error: formatEmailError(error) });
            } catch (err) {
                console.warn('寫入 Email 失敗紀錄失敗:', err);
            }
        }

        async function sendEmailNotification(userData, status, title = "審核通知", customMsg = null, templateKey = null) {
            const targetEmail = String(userData && userData.email ? userData.email : '').trim();
            if (!targetEmail) {
                console.info('[Email 略過] 會員未綁定通知信箱');
                return;
            }
            if (!emailjsConfig.publicKey || emailjsConfig.publicKey === "YOUR_EMAILJS_PUBLIC_KEY") {
                console.info(`[Email 模擬] 發送郵件給 ${targetEmail}`);
                showToast(`[模擬信件] 已寄送通知至 ${targetEmail}`, "info");
                return;
            }

            const messageText = customMsg || (status === 'approved' 
                ? `恭喜您！您的 SecretRoom 加入申請已通過審核。\n\n請您點擊下方連結重新進入平台，輸入您的帳號密碼進行登入：\nhttps://5j1u35k6.github.io/SecretRoom/`
                : `很抱歉，您的加入申請未通過審核。感謝您的關注。`);
            const resolvedTemplateKey = inferEmailTemplateKey(status, title, templateKey);
            const resolvedTemplateId = getEmailTemplateId(resolvedTemplateKey);

            try {
                await emailjs.send(emailjsConfig.serviceId, resolvedTemplateId, {
                    to_email: targetEmail,
                    to_name: userData.nickname || userData.userId || 'SecretRoom Member',
                    status_text: title,
                    message: messageText,
                    email_type: getEmailTypeLabel(resolvedTemplateKey),
                    member_id: userData.id || userData.userId || ''
                }, { publicKey: emailjsConfig.publicKey });
                showToast(`Email 通知已寄送至 ${targetEmail}`, "success");
            } catch (error) {
                console.error("Email 發送失敗:", error);
                await writeEmailFailure(error, {
                    userData,
                    status,
                    title,
                    messageText,
                    templateKey: resolvedTemplateKey,
                    templateId: resolvedTemplateId,
                    targetEmail
                });
                showToast("通知信發送失敗，已記錄於 Email 失敗清單", "error");
            }
        }

        async function getApplicationDataById(userId) {
            if (!db || !userId) return null;
            try {
                const userRef = doc(db, 'secretg_apps', appId, 'applications', userId);
                const userSnap = await getDoc(userRef);
                return userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null;
            } catch (err) {
                console.warn('讀取會員信箱資料失敗:', err);
                return null;
            }
        }

        async function sendEmailToUserId(userId, status, title, message, templateKey) {
            const userData = await getApplicationDataById(userId);
            if (!userData) return;
            await sendEmailNotification(userData, status, title, message, templateKey);
        }

        async function sendReportEmailsToReporters(reports, title, message, templateKey) {
            const ids = Array.from(new Set((reports || []).map(r => r && r.reporterId).filter(Boolean)));
            for (const reporterId of ids) {
                await sendEmailToUserId(reporterId, 'approved', title, message, templateKey);
            }
        }

        window.retryEmailFailure = async function(failureId) {
            const item = allEmailFailures.find(f => f.id === failureId);
            if (!item) { showToast('找不到該筆 Email 失敗紀錄', 'error'); return; }
            if (!emailjsConfig.publicKey || emailjsConfig.publicKey === "YOUR_EMAILJS_PUBLIC_KEY") { showToast('EmailJS 尚未設定完成', 'error'); return; }
            const templateKey = item.templateKey || 'registrationApproved';
            const templateId = item.templateId || getEmailTemplateId(templateKey);
            try {
                await emailjs.send(emailjsConfig.serviceId, templateId, {
                    to_email: item.toEmail,
                    to_name: item.toName || item.memberId || 'SecretRoom Member',
                    status_text: item.title || 'SecretRoom 通知',
                    message: item.message || '',
                    email_type: item.emailType || getEmailTypeLabel(templateKey),
                    member_id: item.memberId || ''
                }, { publicKey: emailjsConfig.publicKey });
                await updateDoc(doc(db, 'secretg_apps', appId, 'email_failures', failureId), {
                    status: 'sent',
                    sentAt: serverTimestamp(),
                    sentAtMs: Date.now(),
                    retriedAt: serverTimestamp(),
                    retriedAtMs: Date.now(),
                    retriedBy: currentAdminId || 'admin',
                    retryCount: Number(item.retryCount || 0) + 1,
                    lastError: ''
                });
                await writeAdminLog('retry_email_success', failureId, { memberId: item.memberId || '', toEmail: item.toEmail || '', templateKey });
                showToast('Email 已重新寄送成功', 'success');
            } catch (error) {
                const message = formatEmailError(error);
                await updateDoc(doc(db, 'secretg_apps', appId, 'email_failures', failureId), {
                    status: 'failed',
                    lastError: message,
                    lastFailedAt: serverTimestamp(),
                    lastFailedAtMs: Date.now(),
                    retryCount: Number(item.retryCount || 0) + 1
                });
                await writeAdminLog('retry_email_failed', failureId, { memberId: item.memberId || '', toEmail: item.toEmail || '', error: message });
                showToast('補寄失敗，已更新失敗原因', 'error');
            }
        };

        window.markEmailFailureHandled = async function(failureId) {
            if (!db) return;
            try {
                await updateDoc(doc(db, 'secretg_apps', appId, 'email_failures', failureId), {
                    status: 'handled',
                    handledAt: serverTimestamp(),
                    handledAtMs: Date.now(),
                    handledBy: currentAdminId || 'admin'
                });
                await writeAdminLog('mark_email_failure_handled', failureId, {});
                showToast('已標記為手動處理', 'success');
            } catch (error) {
                showToast('更新失敗: ' + error.message, 'error');
            }
        };

        window.copyEmailFailureMessage = async function(failureId) {
            const item = allEmailFailures.find(f => f.id === failureId);
            if (!item) { showToast('找不到該筆 Email 失敗紀錄', 'error'); return; }
            const text = buildEmailFailureText(item);
            try {
                await navigator.clipboard.writeText(text);
                showToast('已複製信件內容', 'success');
            } catch (error) {
                prompt('請手動複製以下信件內容：', text);
            }
        };

        window.approveAvatarChange = async function(userId) {
            if (!db) return;
            try {
                const docRef = doc(db, 'secretg_apps', appId, 'applications', userId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const newAvatar = data.avatarPending;
                    await updateDoc(docRef, {
                        avatar: newAvatar,
                        avatarPending: '',
                        avatarStatus: 'approved',
                        avatarReviewedAt: serverTimestamp(),
                        avatarApprovedAt: serverTimestamp(),
                        avatarUpdatedAt: serverTimestamp(),
                        avatarReviewedAtMs: Date.now(),
                        avatarReviewedBy: currentAdminId
                    });
                    await writeAdminLog('approve_avatar', userId, {});
                    showToast("頭像變更已通過！", "success");
                    await sendEmailNotification(data, 'approved', "頭像變更審核通過", "您的 SecretRoom 新頭像更換申請已通過管理員審核，已更新！", 'avatarApproved');
                }
            } catch (err) {
                console.error("核准頭像出錯:", err);
                showToast("操作失敗", "error");
            }
        }

        window.rejectAvatarChange = async function(userId) {
            if (!db) return;
            try {
                const docRef = doc(db, 'secretg_apps', appId, 'applications', userId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    await updateDoc(docRef, {
                        avatarPending: '',
                        avatarStatus: 'rejected',
                        avatarReviewedAt: serverTimestamp(),
                        avatarRejectedAt: serverTimestamp(),
                        avatarUpdatedAt: serverTimestamp(),
                        avatarReviewedAtMs: Date.now(),
                        avatarReviewedBy: currentAdminId,
                        avatarRejectionReason: prompt('請輸入頭像拒絕原因：') || '頭像未通過官方審核'
                    });
                    await writeAdminLog('reject_avatar', userId, {});
                    showToast("頭像變更申請已拒絕。", "info");
                    await sendEmailNotification(data, 'rejected', "頭像變更審核未通過", "您在 SecretRoom 申請更換的新大頭照，未通過管理員審核，已回復原頭像。", 'avatarRejected');
                }
            } catch (err) {
                console.error("拒絕頭像出錯:", err);
                showToast("操作失敗", "error");
            }
        }

        window.openDeleteModal = function(userId) {
            userIdToDelete = userId;
            const modal = document.getElementById('delete-modal');
            const content = document.getElementById('delete-modal-content');
            
            modal.classList.remove('hidden');
            setTimeout(() => {
                modal.classList.remove('opacity-0');
                content.classList.remove('scale-95');
            }, 50);

            document.getElementById('confirm-delete-btn').onclick = async function() {
                await executeDelete(userIdToDelete);
                closeDeleteModal();
            };
        }

        window.closeDeleteModal = function() {
            const modal = document.getElementById('delete-modal');
            const content = document.getElementById('delete-modal-content');
            
            modal.classList.add('opacity-0');
            content.classList.add('scale-95');
            setTimeout(() => {
                modal.classList.add('hidden');
                userIdToDelete = null;
            }, 300);
        }

        async function executeDelete(userId, reasonOverride = null) {
            if (!db) {
                showToast("離線沙盒模式下無法執行真實刪除", "error");
                return;
            }

            try {
                const postsRef = collection(db, 'secretg_apps', appId, 'posts');
                const q = query(postsRef, where('userId', '==', userId));
                const querySnapshot = await getDocs(q);
                
                const deletePromises = [];
                querySnapshot.forEach((postDoc) => {
                    const postDocRef = doc(db, 'secretg_apps', appId, 'posts', postDoc.id);
                    deletePromises.push(deleteDoc(postDocRef));
                });
                
                await Promise.all(deletePromises);

                const docRef = doc(db, 'secretg_apps', appId, 'applications', userId);
                const reason = reasonOverride || prompt('請輸入刪除帳號原因：') || '管理員刪除帳號';
                await deleteDoc(docRef);
                await writeAdminLog('delete_account', userId, { reason, deletedPosts: deletePromises.length });
                
                showToast(`帳號 @${userId} 及其 ${deletePromises.length} 則分享貼文已永久刪除`, "success");
            } catch (err) {
                console.error("刪除失敗:", err);
                showToast("刪除失敗: " + err.message, "error");
            }
        }

        window.dismissReports = async function(postId) {
            if (!db) return;
            try {
                const postRef = doc(db, 'secretg_apps', appId, 'posts', postId);
                const reason = prompt('請輸入駁回貼文檢舉原因：') || '經審查未違反社群規範';
                const snap = await getDoc(postRef);
                const postData = snap.exists() ? snap.data() : {};
                const reportList = postData.reports || [];
                await updateDoc(postRef, {
                    reports: [],
                    reportCount: 0,
                    reportReviewStatus: 'dismissed',
                    reportReviewReason: reason,
                    reportReviewedAt: serverTimestamp(),
                    reportReviewedAtMs: Date.now(),
                    reportReviewedBy: currentAdminId
                });
                await writeAdminLog('dismiss_post_reports', postId, { reason });
                await sendReportEmailsToReporters(reportList, '貼文檢舉審查結果', `您提交的貼文檢舉已完成審查。處理結果：檢舉未成立。原因：${reason}`, 'reportDismissed');
                showToast("已成功反駁該貼文的所有檢舉！", "success");
            } catch (err) {
                console.error("反駁失敗:", err);
                showToast("操作失敗", "error");
            }
        }

        window.deleteSinglePost = async function(postId) {
            if (!db) return;
            try {
                const postRef = doc(db, 'secretg_apps', appId, 'posts', postId);
                const reason = prompt('請輸入刪除貼文原因：') || '貼文違反社群規範';
                const snap = await getDoc(postRef);
                const postData = snap.exists() ? snap.data() : {};
                await deleteDoc(postRef);
                await writeAdminLog('delete_post', postId, { reason });
                if (postData.userId) await sendEmailToUserId(postData.userId, 'rejected', '貼文審查處理通知', `您的貼文經審查後已由管理員下架。處理原因：${reason}`, 'reportAccepted');
                await sendReportEmailsToReporters(postData.reports || [], '貼文檢舉審查結果', `您提交的貼文檢舉已完成審查。處理結果：檢舉成立，該貼文已下架。`, 'reportAccepted');
                showToast("貼文已成功安全下架銷毀！", "success");
            } catch (err) {
                console.error("刪除失敗:", err);
                showToast("操作失敗", "error");
            }
        }

        window.dismissCommentReports = async function(postId, commentId) {
            if (!db) return;
            const reason = prompt('請輸入駁回留言檢舉原因：') || '經審查未違反社群規範';
            try {
                const postRef = doc(db, 'secretg_apps', appId, 'posts', postId);
                const snap = await getDoc(postRef);
                if (!snap.exists()) return;
                const data = snap.data();
                const comments = data.comments || {};
                const originalComment = comments[commentId] ? { ...comments[commentId] } : null;
                if (comments[commentId]) {
                    comments[commentId].reports = [];
                    comments[commentId].reportCount = 0;
                    comments[commentId].reportReviewStatus = 'dismissed';
                    comments[commentId].reportReviewReason = reason;
                    comments[commentId].reportReviewedAtMs = Date.now();
                }
                await updateDoc(postRef, { comments });
                await writeAdminLog('dismiss_comment_reports', commentId, { postId, reason });
                if (originalComment) await sendReportEmailsToReporters(originalComment.reports || [], '留言檢舉審查結果', `您提交的留言檢舉已完成審查。處理結果：檢舉未成立。原因：${reason}`, 'reportDismissed');
                showToast('已駁回留言檢舉', 'success');
            } catch (err) {
                showToast('操作失敗: ' + err.message, 'error');
            }
        };

        window.deleteSingleComment = async function(postId, commentId) {
            if (!db) return;
            const reason = prompt('請輸入刪除留言原因：') || '留言違反社群規範';
            if (!confirm('確認刪除此留言？')) return;
            try {
                const postRef = doc(db, 'secretg_apps', appId, 'posts', postId);
                const snap = await getDoc(postRef);
                if (!snap.exists()) return;
                const data = snap.data();
                const comments = data.comments || {};
                const originalComment = comments[commentId] ? { ...comments[commentId] } : null;
                delete comments[commentId];
                await updateDoc(postRef, { comments });
                await writeAdminLog('delete_comment', commentId, { postId, reason });
                if (originalComment && originalComment.userId) await sendEmailToUserId(originalComment.userId, 'rejected', '留言審查處理通知', `您的留言經審查後已由管理員刪除。處理原因：${reason}`, 'reportAccepted');
                if (originalComment) await sendReportEmailsToReporters(originalComment.reports || [], '留言檢舉審查結果', `您提交的留言檢舉已完成審查。處理結果：檢舉成立，該留言已刪除。`, 'reportAccepted');
                showToast('留言已刪除', 'success');
            } catch (err) {
                showToast('刪除失敗: ' + err.message, 'error');
            }
        };

        window.completePasswordResetRequest = async function(requestId) {
            if (!db) return;
            try {
                const reqRef = doc(db, 'secretg_apps', appId, 'password_reset_requests', requestId);
                const reqSnap = await getDoc(reqRef);
                if (!reqSnap.exists()) { showToast('找不到申請紀錄', 'error'); return; }
                const req = { id: reqSnap.id, ...reqSnap.data() };
                const userId = req.userId;
                if (!userId) { showToast('申請缺少會員帳號', 'error'); return; }
                const userRef = doc(db, 'secretg_apps', appId, 'applications', userId);
                const userSnap = await getDoc(userRef);
                if (!userSnap.exists()) { showToast('找不到會員帳號，已略過此筆申請', 'error'); return; }
                const userData = userSnap.data() || {};
                const requestEmail = normalizeEmail(req.email);
                const memberEmail = getBoundEmailFromMember(userData);
                if (!requestEmail || !memberEmail || requestEmail !== memberEmail || !isActiveMemberForForgotPassword(userData)) {
                    await updateDoc(reqRef, { status: 'invalid', invalidReason: '會員帳號或綁定信箱不符', reviewedAt: serverTimestamp(), reviewedAtMs: Date.now(), reviewedBy: currentAdminId });
                    await writeAdminLog('invalid_forgot_password_request', userId, { requestId, requestEmail });
                    showToast('會員帳號或綁定信箱不符，已標記為無效申請', 'error');
                    return;
                }
                const newPassword = prompt('請輸入要設定給會員的新臨時密碼（至少 8 碼）：');
                if (!newPassword || newPassword.length < 8) { showToast('新臨時密碼至少需要 8 碼', 'error'); return; }
                await updateDoc(userRef, { password: newPassword, passwordUpdatedAt: serverTimestamp(), passwordUpdatedAtMs: Date.now(), passwordUpdatedBy: currentAdminId });
                await updateDoc(reqRef, { status: 'completed', completedAt: serverTimestamp(), completedAtMs: Date.now(), reviewedBy: currentAdminId });
                await writeAdminLog('complete_forgot_password', userId, { requestId });
                await sendEmailNotification({ ...userData, id: userId, userId, email: requestEmail }, 'approved', 'SecretRoom 忘記密碼處理完成', `已為您的 SecretRoom 帳號設定新的臨時登入密碼：${newPassword}。登入後請儘快修改為您自己的密碼。`, 'passwordReset');
                showToast('新臨時密碼已設定並寄送通知', 'success');
            } catch (err) {
                console.error('忘記密碼處理失敗:', err);
                showToast('操作失敗: ' + err.message, 'error');
            }
        };

        window.rejectPasswordResetRequest = async function(requestId) {
            if (!db) return;
            const reason = prompt('請輸入拒絕原因：') || '資料不符，無法受理忘記密碼申請';
            try {
                const reqRef = doc(db, 'secretg_apps', appId, 'password_reset_requests', requestId);
                await updateDoc(reqRef, { status: 'rejected', rejectionReason: reason, reviewedAt: serverTimestamp(), reviewedAtMs: Date.now(), reviewedBy: currentAdminId });
                await writeAdminLog('reject_forgot_password', requestId, { reason });
                showToast('已拒絕忘記密碼申請', 'success');
            } catch (err) {
                showToast('操作失敗: ' + err.message, 'error');
            }
        };

        window.approveAccountDeletionRequest = async function(requestId) {
            if (!db) return;
            if (!confirm('這會刪除會員帳號及其貼文，確認繼續？')) return;
            const reason = prompt('請輸入核准刪除原因：') || '依使用者申請刪除帳號';
            try {
                const reqRef = doc(db, 'secretg_apps', appId, 'account_requests', requestId);
                const reqSnap = await getDoc(reqRef);
                if (!reqSnap.exists()) { showToast('找不到申請紀錄', 'error'); return; }
                const req = reqSnap.data();
                await updateDoc(reqRef, { status: 'approved', approvedAt: serverTimestamp(), approvedAtMs: Date.now(), reviewedBy: currentAdminId, reviewReason: reason });
                await executeDelete(req.userId, reason);
                await updateDoc(reqRef, { status: 'completed', completedAt: serverTimestamp(), completedAtMs: Date.now() });
                await writeAdminLog('approve_account_deletion_request', req.userId, { requestId, reason });
                showToast('帳號刪除申請已完成', 'success');
            } catch (err) {
                console.error('帳號刪除申請處理失敗:', err);
                showToast('操作失敗: ' + err.message, 'error');
            }
        };

        window.rejectAccountDeletionRequest = async function(requestId) {
            if (!db) return;
            const reason = prompt('請輸入拒絕原因：') || '本次刪除申請未通過審核';
            try {
                const reqRef = doc(db, 'secretg_apps', appId, 'account_requests', requestId);
                const reqSnap = await getDoc(reqRef);
                if (!reqSnap.exists()) { showToast('找不到申請紀錄', 'error'); return; }
                const req = reqSnap.data();
                await updateDoc(reqRef, { status: 'rejected', rejectionReason: reason, reviewedAt: serverTimestamp(), reviewedAtMs: Date.now(), reviewedBy: currentAdminId });
                if (req.userId) {
                    const userRef = doc(db, 'secretg_apps', appId, 'applications', req.userId);
                    await updateDoc(userRef, { accountDeletionStatus: 'rejected', accountDeletionRejectedAt: serverTimestamp(), accountDeletionRejectedAtMs: Date.now(), accountDeletionRejectionReason: reason });
                }
                await writeAdminLog('reject_account_deletion_request', req.userId || requestId, { requestId, reason });
                showToast('已拒絕帳號刪除申請', 'success');
            } catch (err) {
                showToast('操作失敗: ' + err.message, 'error');
            }
        };

        window.showToast = function(message, type = 'info') {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            const bgColors = {
                error: 'bg-red-500/95 border-red-400',
                success: 'bg-emerald-500/95 border-emerald-400',
                info: 'bg-indigo-600/95 border-indigo-500/40'
            };
            toast.className = `${bgColors[type]} text-white px-5 py-3.5 rounded-xl shadow-lg border text-sm font-medium transition-all duration-300 opacity-0 transform -translate-y-4 backdrop-blur-xl flex items-center gap-3`;
            const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
            toast.innerHTML = `<i class="fa-solid ${icon} text-lg"></i> <span>${message}</span>`;
            
            container.appendChild(toast);
            requestAnimationFrame(() => toast.classList.remove('opacity-0', '-translate-y-4'));
            setTimeout(() => {
                toast.classList.add('opacity-0', '-translate-y-4');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        initAdmin();

})();

/* ===== Consolidated source: sr_admin_tools.js ===== */
;(() => {
// SecretRoom admin helpers and phase-one dashboard UX improvements.
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
  return [`你的 SecretRoom 臨時密碼：${code}`, '', '10 分鐘內有效。', `到期時間：${fmtTime(expiresAtMs)}`, '', '請用帳號和這組臨時密碼登入。', '登入後記得立刻換成自己的密碼。', '', '不是你申請的話，請聯絡管理員。'].join('\n');
}
async function sendRecoveryMail(user, uid, code, expiresAtMs) {
  if (!window.emailjs) throw new Error('Email 功能還沒準備好');
  if (!user.email) throw new Error('這個帳號沒有綁定 Email');
  await emailjs.send(MAIL.serviceId, MAIL.templateId, { to_email: user.email, to_name: user.nickname || uid || 'SecretRoom Account', status_text: 'SecretRoom 臨時密碼', message: buildRecoveryMessage(code, expiresAtMs), email_type: '帳號安全提醒', member_id: uid || '' }, { publicKey: MAIL.publicKey });
}
async function restoreUserCredential(userRef, fs, previous) {
  try { await fs.updateDoc(userRef, previous); }
  catch (restoreErr) { console.error('臨時密碼寄送失敗後還原密碼狀態失敗:', restoreErr); }
}
window.completePasswordResetRequest = async function completePasswordResetRequest(id) {
  let userRef = null;
  let previousCredentialState = null;
  try {
    const { db, fs } = await T();
    const reqRef = fs.doc(db, 'secretg_apps', AID, 'password_reset_requests', id);
    const reqSnap = await fs.getDoc(reqRef);
    if (!reqSnap.exists()) throw new Error('找不到這筆忘記密碼申請');
    const req = reqSnap.data() || {};
    const uid = req.userId;
    if (!uid) throw new Error('這筆申請缺少帳號 ID');
    userRef = fs.doc(db, 'secretg_apps', AID, 'applications', uid);
    const userSnap = await fs.getDoc(userRef);
    if (!userSnap.exists()) throw new Error('找不到帳號資料');
    const user = userSnap.data() || {};
    if (!user.email) throw new Error('這個帳號沒有綁定 Email，無法寄出臨時密碼');
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
    window.showToast?.(`帳號 @${uid} 的臨時密碼已寄出，10 分鐘內有效。`, 'success');
  } catch (err) {
    console.error(err);
    window.showToast?.('臨時密碼沒寄成功：' + err.message, 'error');
  }
};
window.rejectPasswordResetRequest = async function rejectPasswordResetRequest(id) {
  try {
    const { db, fs } = await T();
    const ref = fs.doc(db, 'secretg_apps', AID, 'password_reset_requests', id);
    const snap = await fs.getDoc(ref);
    const uid = snap.exists() ? String(snap.data()?.userId || '') : '';
    await fs.updateDoc(ref, { status: 'rejected', rejectedAt: fs.serverTimestamp(), rejectedAtMs: Date.now() });
    window.showToast?.(uid ? `已拒絕帳號 @${uid} 的忘記密碼申請。` : '已拒絕這筆忘記密碼申請。', 'info');
  } catch (err) {
    console.error(err);
    window.showToast?.('操作失敗：' + err.message, 'error');
  }
};

(() => {
  const VERSION = '20260711-admin-phase1-v1';
  const FILTER_KEY = 'sr_admin_filter';
  const SEARCH_KEY = 'sr_admin_search';
  const SORT_KEY = 'sr_admin_sort';
  const groups = { member: ['pending','avatar_pending','spec_pending','approved','active','rejected','all'], safety: ['reported_posts','reported_comments'], security: ['password_reset_requests','account_delete_requests','email_failures'], system: ['all'] };
  const labels = { all:'全部', pending:'待審核', avatar_pending:'頭像待審', spec_pending:'Spec 待審', reported_posts:'貼文檢舉', reported_comments:'留言檢舉', account_delete_requests:'刪除帳號', password_reset_requests:'忘記密碼', email_failures:'寄信失敗', approved:'已通過', active:'使用中', rejected:'已拒絕' };
  const statFilters = {
    'count-pending': 'pending',
    'count-avatar-pending': 'avatar_pending',
    'count-reports': 'reported_posts',
    'count-total': 'all',
    'count-account-requests': 'account_delete_requests',
    'count-password-reset': 'password_reset_requests'
  };
  const qs = id => document.getElementById(id);
  const tx = value => String(value || '').replace(/\s+/g, ' ').trim();
  const current = () => qs('filter-status')?.value || 'pending';
  const groupOf = value => groups.safety.includes(value) ? 'safety' : groups.security.includes(value) ? 'security' : 'member';
  const isExplicitAdmin = data => !!data && data.enabled !== false && (data.role === 'admin' || data.isAdmin === true || data.canAdmin === true || data.adminApproved === true);
  let scheduled = false;
  let lastMetricAt = 0;
  let lastActionContext = '';
  let actionContextTimer = null;

  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char])); }
  function sync(value = current()) {
    document.querySelectorAll('[data-sr-admin-group]').forEach(button => button.classList.toggle('sr-admin-group-active', button.dataset.srAdminGroup === groupOf(value)));
    document.querySelectorAll('[data-sr-stat-filter]').forEach(card => card.classList.toggle('sr-admin-stat-active', card.dataset.srStatFilter === value));
  }
  function setFilter(value) {
    const select = qs('filter-status');
    if (!select) return;
    select.value = value;
    localStorage.setItem(FILTER_KEY, value);
    typeof window.filterApplications === 'function' ? window.filterApplications() : select.dispatchEvent(new Event('change', { bubbles:true }));
    sync(value);
    scheduleApply();
  }

  async function refreshAdminMetric(force = false) {
    const element = qs('count-admins');
    if (!element || element.dataset.srCounting === '1') return;
    if (!force && Date.now() - lastMetricAt < 30000) return;
    element.dataset.srCounting = '1';
    try {
      const { db, fs } = await T();
      const snapshot = await fs.getDocs(fs.collection(db, 'secretg_apps', AID, 'admins'));
      const active = [];
      snapshot.forEach(documentSnapshot => { const data = documentSnapshot.data() || {}; if (isExplicitAdmin(data)) active.push(documentSnapshot.id); });
      element.textContent = active.length;
      element.title = active.length ? `目前可登入後台：${active.join(', ')}` : '目前沒有可登入的管理員';
      const card = element.closest('.rounded-2xl, .bg-slate-950\/60') || element.parentElement;
      if (card && !card.querySelector('.sr-admin-count-note')) {
        const note = document.createElement('div');
        note.className = 'sr-admin-count-note text-xs text-slate-500 mt-1 leading-snug';
        note.textContent = '只算 admins 名單，帳號資料裡的舊權限不列入。';
        card.appendChild(note);
      }
      lastMetricAt = Date.now();
    } catch (err) {
      console.warn('後台管理員數量更新失敗:', err);
    } finally {
      element.dataset.srCounting = '0';
    }
  }

  function enforceExplicitAdminLogin() {
    const button = qs('admin-login-submit');
    if (!button || button.dataset.srAdminGuard === '1' || typeof button.onclick !== 'function') return;
    const original = button.onclick;
    button.dataset.srAdminGuard = '1';
    button.onclick = async function(event) {
      const adminId = qs('admin-login-id')?.value?.trim();
      if (!adminId) return original.call(this, event);
      try {
        const { db, fs } = await T();
        const snapshot = await fs.getDoc(fs.doc(db, 'secretg_apps', AID, 'admins', adminId));
        if (!snapshot.exists() || !isExplicitAdmin(snapshot.data() || {})) {
          event?.preventDefault?.();
          event?.stopPropagation?.();
          const message = `帳號 ${adminId} 不在 admins 名單內，無法登入後台。`;
          const box = qs('admin-login-error');
          if (box) { box.textContent = message; box.classList.remove('hidden'); }
          window.showToast?.(message, 'error');
          return;
        }
      } catch (err) {
        console.error('管理員名單檢查失敗，為安全起見拒絕登入:', err);
        event?.preventDefault?.();
        event?.stopPropagation?.();
        const message = '無法驗證管理員名單，為安全起見已拒絕登入。請確認網路後重試。';
        const box = qs('admin-login-error');
        if (box) { box.textContent = message; box.classList.remove('hidden'); }
        window.showToast?.(message, 'error');
        return;
      }
      return original.call(this, event);
    };
  }

  function addHeader() {
    const header = document.querySelector('#admin-main header');
    const status = qs('connection-status');
    if (!header || qs('sr-admin-env-badge')) return;
    const box = document.createElement('div');
    box.id = 'sr-admin-env-badge';
    box.className = 'flex flex-wrap items-center gap-2 text-xs font-black tracking-wider';
    box.innerHTML = '<span class="px-3 py-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">Production</span><span class="px-3 py-2 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-300">敏感操作會再次確認</span><button id="sr-admin-logout" class="min-h-[44px] px-3 py-2 rounded-full border border-slate-700 bg-slate-950/70 text-slate-300 hover:text-white hover:border-amber-500/40 transition">登出</button>';
    (status?.parentElement || header).appendChild(box);
    qs('sr-admin-logout').onclick = () => { localStorage.removeItem('sr_admin_id'); location.reload(); };
  }

  function addStatsLabel() {
    const main = qs('admin-main');
    const grid = main?.querySelector('.grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-5') || main?.querySelector('.grid.grid-cols-1');
    if (!grid || qs('sr-admin-stats-label')) return;
    const label = document.createElement('div');
    label.id = 'sr-admin-stats-label';
    label.className = 'mb-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-black tracking-wider text-slate-500';
    label.innerHTML = '<div class="rounded-2xl border border-amber-500/10 bg-slate-950/35 px-4 py-2"><i class="fa-solid fa-list-check text-amber-400 mr-1.5"></i> 待處理</div><div class="rounded-2xl border border-rose-500/10 bg-slate-950/35 px-4 py-2"><i class="fa-solid fa-shield-halved text-rose-300 mr-1.5"></i> 風險項目</div><div class="rounded-2xl border border-cyan-500/10 bg-slate-950/35 px-4 py-2"><i class="fa-solid fa-chart-line text-cyan-300 mr-1.5"></i> 營運概況</div>';
    grid.parentElement.insertBefore(label, grid);
  }

  function bindStatCards() {
    Object.entries(statFilters).forEach(([countId, filter]) => {
      const count = qs(countId);
      const card = count?.closest('.rounded-2xl, .admin-stat-mini') || count?.parentElement;
      if (!card || card.dataset.srStatBound === '1') return;
      card.dataset.srStatBound = '1';
      card.dataset.srStatFilter = filter;
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `查看${labels[filter] || filter}`);
      card.classList.add('sr-admin-stat-card');
      const open = () => {
        const search = qs('admin-search');
        if (search) { search.value = ''; localStorage.removeItem(SEARCH_KEY); }
        setFilter(filter);
        qs('admin-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      card.addEventListener('click', open);
      card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
    });
    sync();
  }

  function renderSubs(group, active) {
    const box = qs('sr-admin-subfilters');
    if (!box) return;
    const renderKey = `${group}:${active}`;
    if (box.dataset.srRenderKey === renderKey) return;
    box.dataset.srRenderKey = renderKey;
    box.innerHTML = (groups[group] || groups.member).map(value => `<button type="button" data-filter-value="${value}" class="sr-admin-subfilter ${active === value ? 'sr-admin-subfilter-active' : ''}">${labels[value] || value}</button>`).join('');
    box.querySelectorAll('[data-filter-value]').forEach(button => button.onclick = () => { renderSubs(group, button.dataset.filterValue); setFilter(button.dataset.filterValue); });
  }

  function addGroups() {
    const select = qs('filter-status');
    const search = qs('admin-search');
    if (!select) return;
    if (search) search.placeholder = '搜尋帳號、暱稱、Email、檢舉原因或貼文';
    Array.from(select.options).forEach(option => { if (labels[option.value]) option.textContent = labels[option.value]; });
    if (!qs('sr-admin-task-groups')) {
      const wrap = document.createElement('div');
      wrap.id = 'sr-admin-task-groups';
      wrap.className = 'mb-4 p-3 rounded-3xl border border-amber-500/10 bg-slate-950/35';
      wrap.innerHTML = '<div class="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3"><button data-sr-admin-group="member" class="sr-admin-group-btn" type="button"><i class="fa-solid fa-user-check"></i> 帳號審核</button><button data-sr-admin-group="safety" class="sr-admin-group-btn" type="button"><i class="fa-solid fa-shield-halved"></i> 內容檢舉</button><button data-sr-admin-group="security" class="sr-admin-group-btn" type="button"><i class="fa-solid fa-key"></i> 帳號處理</button><button data-sr-admin-group="system" class="sr-admin-group-btn" type="button"><i class="fa-solid fa-bullhorn"></i> 平台通知</button></div><div id="sr-admin-subfilters" class="flex gap-2 overflow-x-auto pb-1"></div>';
      const panel = qs('admin-list')?.parentElement;
      const row = panel?.querySelector('.flex.items-center.justify-between.mb-6');
      row ? row.insertAdjacentElement('afterend', wrap) : select.parentElement?.parentElement?.insertAdjacentElement('afterend', wrap);
      wrap.querySelectorAll('[data-sr-admin-group]').forEach(button => button.onclick = () => {
        const group = button.dataset.srAdminGroup;
        const first = group === 'member' ? 'pending' : group === 'safety' ? 'reported_posts' : group === 'security' ? 'password_reset_requests' : 'all';
        renderSubs(group, first);
        setFilter(first);
      });
    }
    renderSubs(groupOf(current()), current());
    sync();
  }

  function restoreFilters() {
    const select = qs('filter-status');
    const search = qs('admin-search');
    if (!select || select.dataset.srRestored === '1') return;
    select.dataset.srRestored = '1';
    const savedFilter = localStorage.getItem(FILTER_KEY);
    const savedSearch = localStorage.getItem(SEARCH_KEY);
    if (savedFilter && Array.from(select.options).some(option => option.value === savedFilter)) select.value = savedFilter;
    if (search && savedSearch) search.value = savedSearch;
    select.addEventListener('change', () => { localStorage.setItem(FILTER_KEY, select.value); sync(select.value); scheduleApply(); });
    if (search && search.dataset.srPersistBound !== '1') {
      search.dataset.srPersistBound = '1';
      search.addEventListener('input', () => { localStorage.setItem(SEARCH_KEY, search.value); scheduleApply(); });
    }
    if ((savedFilter || savedSearch) && typeof window.filterApplications === 'function') window.filterApplications();
  }

  function parseCardTime(card) {
    const text = tx(card);
    const dateMatch = text.match(/(20\d{2})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})(?:日)?(?:\s+|,\s*)(\d{1,2})[:：](\d{2})/);
    if (dateMatch) return new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]), Number(dateMatch[4]), Number(dateMatch[5])).getTime();
    const relative = text.match(/(\d+)\s*(分鐘|小時|天)前/);
    if (relative) {
      const amount = Number(relative[1]);
      const unit = relative[2] === '分鐘' ? 60000 : relative[2] === '小時' ? 3600000 : 86400000;
      return Date.now() - amount * unit;
    }
    return 0;
  }

  function cardRisk(card) {
    const text = tx(card);
    let score = 0;
    if (/檢舉|風險|發送失敗|刪除帳號/.test(text)) score += 3;
    if (/待審核|審查中|申請/.test(text)) score += 2;
    if (/已處理|已通過|已拒絕|補寄成功/.test(text)) score -= 2;
    return score;
  }

  function sortAndCountCards() {
    const list = qs('admin-list');
    const count = qs('sr-admin-result-count');
    if (!list) return;
    const cards = Array.from(list.children).filter(node => node instanceof HTMLElement && !node.classList.contains('sr-admin-empty-state'));
    const reviewCards = cards.filter(card => !/目前沒有|正在讀取|正在檢索/.test(tx(card)));
    const countText = `${reviewCards.length} 筆結果`;
    if (count && count.textContent !== countText) count.textContent = countText;
    const sort = qs('sr-admin-sort')?.value || localStorage.getItem(SORT_KEY) || 'newest';
    const contentKey = reviewCards.map(card => tx(card).slice(0, 240)).sort().join('|');
    const stateKey = `${sort}::${contentKey}`;
    if (list.dataset.srSortKey === stateKey) return;
    const sorted = [...reviewCards].sort((a, b) => {
      if (sort === 'oldest') return parseCardTime(a) - parseCardTime(b);
      if (sort === 'risk') return cardRisk(b) - cardRisk(a) || parseCardTime(b) - parseCardTime(a);
      if (sort === 'waiting') return parseCardTime(a) - parseCardTime(b) || cardRisk(b) - cardRisk(a);
      return parseCardTime(b) - parseCardTime(a);
    });
    sorted.forEach(card => list.appendChild(card));
    list.dataset.srSortKey = stateKey;
    const updated = qs('sr-admin-last-updated');
    if (updated) updated.textContent = `更新於 ${new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  }

  function addToolbar() {
    const list = qs('admin-list');
    if (!list) return;
    if (!qs('sr-admin-list-toolbar')) {
      const bar = document.createElement('div');
      bar.id = 'sr-admin-list-toolbar';
      bar.className = 'mb-3 rounded-2xl border border-slate-800 bg-slate-950/45 p-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3';
      bar.innerHTML = '<div><div id="sr-admin-result-count" class="text-sm font-black text-slate-200">0 筆結果</div><div id="sr-admin-last-updated" class="text-xs text-slate-500 mt-1">資料會即時更新</div></div><div class="flex flex-col sm:flex-row gap-2"><select id="sr-admin-sort" class="min-h-[44px] bg-slate-900 border border-slate-700 rounded-xl px-3 text-xs text-slate-200"><option value="newest">最新優先</option><option value="oldest">最舊優先</option><option value="risk">高風險優先</option><option value="waiting">等待最久優先</option></select><button id="sr-admin-clear-filter" type="button" class="min-h-[44px] px-4 rounded-xl border border-amber-500/20 bg-slate-900 text-amber-300 text-xs font-black">清除篩選</button></div>';
      list.parentElement.insertBefore(bar, list);
      const sort = qs('sr-admin-sort');
      sort.value = localStorage.getItem(SORT_KEY) || 'newest';
      sort.onchange = () => { localStorage.setItem(SORT_KEY, sort.value); sortAndCountCards(); };
      qs('sr-admin-clear-filter').onclick = () => {
        const search = qs('admin-search');
        if (search) search.value = '';
        localStorage.removeItem(SEARCH_KEY);
        localStorage.setItem(FILTER_KEY, 'all');
        setFilter('all');
      };
    }
  }

  function improveResetCards() {
    document.querySelectorAll('button').forEach(button => { if (tx(button) === '設定新密碼') button.textContent = '寄出 10 分鐘臨時密碼'; });
    document.querySelectorAll('#admin-list > div').forEach(card => {
      const text = tx(card);
      if (!text.includes('忘記密碼') || card.querySelector('.sr-reset-flow-note')) return;
      const note = document.createElement('div');
      note.className = 'sr-reset-flow-note text-xs text-amber-300/80 mt-2 rounded-xl border border-amber-500/10 bg-amber-500/5 px-3 py-2';
      note.textContent = text.includes('已處理') ? '這筆已處理，確認帳號能登入並完成換密碼即可。' : '處理方式：寄出臨時密碼（10 分鐘有效），對方登入後會先換成自己的密碼。';
      card.querySelector('.space-y-1\\.5, .space-y-2, .space-y-3')?.appendChild(note) || card.appendChild(note);
    });
  }

  function enhanceBroadcast() {
    const title = qs('broadcast-title');
    const message = qs('broadcast-message');
    if (title && !title.dataset.srDraft) {
      title.dataset.srDraft = '1';
      title.value = localStorage.getItem('sr_broadcast_draft_title') || title.value;
      title.addEventListener('input', () => localStorage.setItem('sr_broadcast_draft_title', title.value));
    }
    if (message && !message.dataset.srDraft) {
      message.dataset.srDraft = '1';
      message.value = localStorage.getItem('sr_broadcast_draft_message') || message.value;
      message.addEventListener('input', () => localStorage.setItem('sr_broadcast_draft_message', message.value));
    }
    const sendButton = Array.from(document.querySelectorAll('button')).find(button => tx(button).includes('發送平台通知'));
    if (sendButton && !qs('sr-broadcast-preview-btn')) {
      const preview = document.createElement('button');
      preview.id = 'sr-broadcast-preview-btn';
      preview.type = 'button';
      preview.className = 'min-h-[44px] mr-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition';
      preview.innerHTML = '<i class="fa-regular fa-eye mr-1.5"></i> 預覽';
      preview.onclick = () => alert(`通知預覽\n\n標題：${title?.value || '還沒填'}\n\n內容：\n${message?.value || '還沒填'}`);
      sendButton.parentElement.insertBefore(preview, sendButton);
    }
    if (typeof window.sendPlatformBroadcast === 'function' && !window.sendPlatformBroadcast.__srWrapped) {
      const original = window.sendPlatformBroadcast;
      window.sendPlatformBroadcast = async function(...args) {
        const target = qs('broadcast-target')?.value === 'sg' ? 'S+ . S . G 帳號' : '所有帳號';
        const titleText = title?.value || '';
        if (!confirm(`要發給：${target}\n\n標題：${titleText || '還沒填標題'}\n\n確定送出嗎？`)) return;
        const result = await original.apply(this, args);
        localStorage.removeItem('sr_broadcast_draft_title');
        localStorage.removeItem('sr_broadcast_draft_message');
        return result;
      };
      window.sendPlatformBroadcast.__srWrapped = true;
    }
  }

  function improveCards() {
    document.querySelectorAll('#admin-list > div').forEach(card => {
      if (card.dataset.srCardImproved === '1') return;
      card.dataset.srCardImproved = '1';
      card.classList.add('sr-admin-review-card');
      const text = tx(card);
      if (/檢舉|安全|風險/.test(text)) card.classList.add('sr-admin-risk-card');
      if (/忘記密碼|臨時密碼|Email 發送失敗/.test(text)) card.classList.add('sr-admin-security-card');
      if (/待審核|審查中|申請/.test(text)) card.classList.add('sr-admin-pending-card');
      card.querySelectorAll('button').forEach(button => button.classList.add('sr-admin-action-button'));
    });
  }

  function setActionContextFromButton(button) {
    const card = button?.closest?.('#admin-list > div');
    if (!card) return;
    const match = tx(card).match(/@([A-Za-z0-9_.-]+)/);
    lastActionContext = match ? `帳號 @${match[1]}` : '';
    clearTimeout(actionContextTimer);
    actionContextTimer = setTimeout(() => { lastActionContext = ''; }, 6000);
  }

  function wrapToast() {
    if (typeof window.showToast !== 'function' || window.showToast.__srContextWrapped) return;
    const original = window.showToast;
    window.showToast = function(message, type = 'info') {
      let next = String(message || '');
      if (type === 'success' && lastActionContext && !next.includes('@') && /完成|成功|已通過|已拒絕|已刪除|已更新|已寄出|已設定|已處理/.test(next)) next = `${lastActionContext}：${next}`;
      return original.call(this, next, type);
    };
    window.showToast.__srContextWrapped = true;
  }

  function showDangerConfirm({ accountId, title, description, actionLabel = '確認永久刪除', onConfirm }) {
    qs('sr-admin-danger-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'sr-admin-danger-modal';
    modal.className = 'fixed inset-0 z-[260] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md';
    modal.innerHTML = `<div class="w-full max-w-md rounded-3xl border border-rose-500/25 bg-slate-950 p-6 shadow-2xl"><div class="w-12 h-12 rounded-full bg-rose-500/10 text-rose-300 flex items-center justify-center mb-4"><i class="fa-solid fa-triangle-exclamation text-xl"></i></div><h3 class="text-lg font-black text-white">${esc(title)}</h3><p class="text-xs text-slate-400 leading-relaxed mt-2">${esc(description)}</p><div class="mt-4 rounded-xl border border-rose-500/15 bg-rose-500/5 p-3 text-xs text-rose-200">將永久移除帳號資料與相關貼文，無法復原。</div><label class="block text-xs font-black text-slate-300 mt-4 mb-1.5">輸入帳號 ID「${esc(accountId)}」確認</label><input id="sr-danger-account" class="w-full min-h-[44px] bg-slate-900 border border-rose-500/20 rounded-xl px-3 text-sm text-white" autocomplete="off"><label class="block text-xs font-black text-slate-300 mt-3 mb-1.5">刪除原因</label><textarea id="sr-danger-reason" class="w-full min-h-[90px] bg-slate-900 border border-rose-500/20 rounded-xl px-3 py-2 text-sm text-white resize-none" placeholder="請說明原因"></textarea><div class="grid grid-cols-2 gap-3 mt-5"><button id="sr-danger-cancel" class="min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 text-slate-300 text-xs font-black">取消</button><button id="sr-danger-confirm" disabled class="min-h-[44px] rounded-xl bg-rose-600 text-white text-xs font-black disabled:opacity-40 disabled:cursor-not-allowed">${esc(actionLabel)}</button></div></div>`;
    document.body.appendChild(modal);
    const accountInput = qs('sr-danger-account');
    const reasonInput = qs('sr-danger-reason');
    const confirmButton = qs('sr-danger-confirm');
    const validate = () => { confirmButton.disabled = accountInput.value.trim() !== accountId || !reasonInput.value.trim(); };
    accountInput.addEventListener('input', validate);
    reasonInput.addEventListener('input', validate);
    qs('sr-danger-cancel').onclick = () => modal.remove();
    modal.addEventListener('click', event => { if (event.target === modal) modal.remove(); });
    confirmButton.onclick = async () => {
      confirmButton.disabled = true;
      confirmButton.textContent = '處理中...';
      try {
        await onConfirm(reasonInput.value.trim());
        modal.remove();
      } catch (error) {
        console.error(error);
        window.showToast?.('操作失敗：' + error.message, 'error');
        confirmButton.disabled = false;
        confirmButton.textContent = actionLabel;
      }
    };
    accountInput.focus();
  }

  function wrapDangerousOperations() {
    if (typeof window.openDeleteModal === 'function' && !window.openDeleteModal.__srWrapped) {
      const originalOpen = window.openDeleteModal;
      window.openDeleteModal = function(userId) {
        originalOpen.call(this, userId);
        requestAnimationFrame(() => {
          const modal = qs('delete-modal');
          const content = qs('delete-modal-content');
          const confirmButton = qs('confirm-delete-btn');
          if (!modal || !content || !confirmButton || confirmButton.dataset.srDangerWrapped === '1') return;
          confirmButton.dataset.srDangerWrapped = '1';
          const originalConfirm = confirmButton.onclick;
          const oldExtra = qs('sr-delete-extra-confirm');
          oldExtra?.remove();
          const extra = document.createElement('div');
          extra.id = 'sr-delete-extra-confirm';
          extra.className = 'mt-4 space-y-3 text-left';
          extra.innerHTML = `<div class="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-200">這會永久刪除帳號 @${esc(userId)} 與相關貼文，無法復原。</div><input id="sr-delete-account-confirm" class="w-full min-h-[44px] bg-slate-900 border border-rose-500/20 rounded-xl px-3 text-sm text-white" placeholder="輸入 ${esc(userId)}"><textarea id="sr-delete-reason-confirm" class="w-full min-h-[80px] bg-slate-900 border border-rose-500/20 rounded-xl px-3 py-2 text-sm text-white resize-none" placeholder="填寫刪除原因"></textarea>`;
          const actions = confirmButton.parentElement;
          content.insertBefore(extra, actions);
          confirmButton.disabled = true;
          const accountInput = qs('sr-delete-account-confirm');
          const reasonInput = qs('sr-delete-reason-confirm');
          const validate = () => { confirmButton.disabled = accountInput.value.trim() !== String(userId) || !reasonInput.value.trim(); };
          accountInput.oninput = validate;
          reasonInput.oninput = validate;
          confirmButton.onclick = async function() {
            if (confirmButton.disabled) return;
            const nativePrompt = window.prompt;
            window.prompt = () => reasonInput.value.trim();
            try { await originalConfirm?.call(this); }
            finally { window.prompt = nativePrompt; }
          };
        });
      };
      window.openDeleteModal.__srWrapped = true;
    }

    if (typeof window.approveAccountDeletionRequest === 'function' && !window.approveAccountDeletionRequest.__srWrapped) {
      const originalApprove = window.approveAccountDeletionRequest;
      window.approveAccountDeletionRequest = async function(requestId) {
        const { db, fs } = await T();
        const snapshot = await fs.getDoc(fs.doc(db, 'secretg_apps', AID, 'account_requests', requestId));
        if (!snapshot.exists()) return window.showToast?.('找不到這筆刪除申請。', 'error');
        const accountId = String(snapshot.data()?.userId || '');
        if (!accountId) return window.showToast?.('這筆申請缺少帳號 ID。', 'error');
        showDangerConfirm({
          accountId,
          title: `永久刪除帳號 @${accountId}？`,
          description: '核准後會刪除帳號資料與該帳號發布的貼文。',
          onConfirm: async reason => {
            const nativeConfirm = window.confirm;
            const nativePrompt = window.prompt;
            window.confirm = () => true;
            window.prompt = () => reason;
            try { await originalApprove.call(this, requestId); }
            finally { window.confirm = nativeConfirm; window.prompt = nativePrompt; }
          }
        });
      };
      window.approveAccountDeletionRequest.__srWrapped = true;
    }
  }

  function connectionState() {
    const status = qs('connection-status');
    if (!status) return;
    if (!qs('sr-admin-reload')) {
      const button = document.createElement('button');
      button.id = 'sr-admin-reload';
      button.type = 'button';
      button.className = 'min-h-[44px] px-3 rounded-full border border-slate-700 bg-slate-950 text-slate-300 text-xs font-black';
      button.innerHTML = '<i class="fa-solid fa-rotate-right mr-1"></i>重新整理';
      status.insertAdjacentElement('afterend', button);
      button.onclick = () => location.reload();
    }
    if (!navigator.onLine) {
      status.className = 'self-start px-4 py-2 rounded-full bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2';
      status.innerHTML = '<i class="fa-solid fa-wifi"></i> 目前離線，資料可能不是最新';
      document.documentElement.dataset.srAdminOffline = '1';
    } else if (document.documentElement.dataset.srAdminOffline === '1') {
      status.className = 'self-start px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2';
      status.innerHTML = '<i class="fa-solid fa-arrows-rotate animate-spin"></i> 網路已恢復，正在同步';
      document.documentElement.dataset.srAdminOffline = '0';
      setTimeout(() => { if (navigator.onLine) { status.className = 'self-start px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2'; status.innerHTML = '<i class="fa-solid fa-circle text-[8px]"></i> 已連線'; } }, 1200);
    }
  }

  function installStyles() {
    if (qs('sr-admin-tools-style')) return;
    const style = document.createElement('style');
    style.id = 'sr-admin-tools-style';
    style.textContent = `
      #admin-main header{position:sticky;top:0;z-index:35;background:linear-gradient(180deg,rgba(2,2,4,.96),rgba(2,2,4,.78));backdrop-filter:blur(16px);padding-top:.5rem;border-radius:0 0 1.25rem 1.25rem}
      #admin-main button,#admin-main select,#admin-main input{min-height:44px}.sr-admin-group-btn{display:flex;align-items:center;justify-content:center;gap:.45rem;min-height:44px;border-radius:1rem;border:1px solid rgba(245,158,11,.12);background:rgba(2,6,23,.45);color:#94a3b8;font-size:12px;font-weight:900;transition:.2s}.sr-admin-group-btn:hover,.sr-admin-group-active{color:#fcd34d;border-color:rgba(245,158,11,.36);background:rgba(245,158,11,.08)}
      .sr-admin-subfilter{flex:0 0 auto;border:1px solid rgba(148,163,184,.16);background:rgba(15,23,42,.55);color:#94a3b8;border-radius:.85rem;padding:.55rem .8rem;font-size:12px;font-weight:800;white-space:nowrap}.sr-admin-subfilter-active{color:#020617;background:linear-gradient(90deg,#f8d36a,#d99a23);border-color:#f8d36a}
      #admin-list{display:grid;gap:1rem}#admin-list>div{scroll-margin-top:6rem}.sr-admin-review-card{border-color:rgba(223,183,108,.16)!important;background:linear-gradient(145deg,rgba(15,23,42,.72),rgba(8,10,16,.62))!important;box-shadow:0 18px 45px rgba(0,0,0,.28)}.sr-admin-risk-card{border-left:4px solid rgba(244,63,94,.72)!important}.sr-admin-security-card{border-left:4px solid rgba(251,191,36,.76)!important}.sr-admin-pending-card{border-left:4px solid rgba(34,211,238,.55)!important}.sr-admin-action-button{min-height:44px!important}
      .sr-admin-stat-card{cursor:pointer;transition:transform .18s ease,border-color .18s ease,background .18s ease}.sr-admin-stat-card:hover{transform:translateY(-2px);border-color:rgba(245,158,11,.32)!important}.sr-admin-stat-active{border-color:rgba(245,158,11,.55)!important;background:rgba(245,158,11,.08)!important;box-shadow:0 0 24px rgba(245,158,11,.08)}
      #broadcast-message{line-height:1.55!important}#broadcast-history{scrollbar-width:thin}.glass-panel h2,.glass-panel h3{letter-spacing:.02em}.sr-admin-count-note{font-weight:700;letter-spacing:.02em}.text-\\[10px\\],.text-\\[11px\\]{font-size:12px!important;line-height:1.45!important}
      @media(max-width:768px){#sr-admin-env-badge{width:100%}#sr-admin-task-groups{position:sticky;top:.5rem;z-index:30;backdrop-filter:blur(14px)}#admin-main header{position:relative}.flex.items-center.justify-between{align-items:flex-start!important}#admin-search,#filter-status{width:100%!important}}
      @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}}
    `;
    document.head.appendChild(style);
  }

  function apply() {
    scheduled = false;
    installStyles();
    wrapToast();
    enforceExplicitAdminLogin();
    addHeader();
    addStatsLabel();
    addGroups();
    restoreFilters();
    bindStatCards();
    enhanceBroadcast();
    addToolbar();
    improveResetCards();
    improveCards();
    wrapDangerousOperations();
    connectionState();
    sortAndCountCards();
    refreshAdminMetric();
    sync();
    document.documentElement.dataset.srAdminUi = VERSION;
  }

  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  }

  document.addEventListener('click', event => {
    const button = event.target?.closest?.('#admin-list button');
    if (button) setActionContextFromButton(button);
  }, true);
  window.addEventListener('online', () => { connectionState(); scheduleApply(); });
  window.addEventListener('offline', connectionState);
  window.SRAdminRuntime?.register(scheduleApply);
  document.addEventListener('DOMContentLoaded', apply, { once:true });
  apply();
})();
})();

/* ===== Consolidated source: sr_admin_phase2_roles.js ===== */
;(() => {
// SecretRoom admin phase two: role-aware controls, role management and authoritative admin count.
(() => {
  if (window.__SR_ADMIN_PHASE2_ROLES__) return;
  window.__SR_ADMIN_PHASE2_ROLES__ = true;

  const APP_ID = 'secretg-production-node-tw';
  const VERSION = '20260715-admin-phase2-roles-v3';
  const SESSION = 'sr_admin_session_id_v2';

  let adminId = '';
  let adminData = null;
  let queued = false;
  let adminCountUnsubscribe = null;
  let adminCountStarting = false;
  let explicitAdminIds = null;

  const qs = id => document.getElementById(id);
  const toast = (message, type = 'info') => window.showToast?.(message, type);
  const tx = value => String(value || '').replace(/\s+/g, ' ').trim();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  async function tools() {
    const appModule = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js');
    const firestore = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
    const app = appModule.getApps()[0];
    if (!app) throw new Error('Firebase 尚未初始化');
    return { db: firestore.getFirestore(app), fs: firestore };
  }

  function capture() {
    const value = qs('admin-login-id')?.value.trim();
    if (value) sessionStorage.setItem(SESSION, value);
    adminId = sessionStorage.getItem(SESSION) || value || '';
    window.SRAdminPhase2 = window.SRAdminPhase2 || {};
    window.SRAdminPhase2.adminId = adminId;
  }

  function role() {
    const value = String(adminData?.adminRole || adminData?.role || '').toLowerCase();
    if (['owner', 'manager', 'reviewer', 'viewer'].includes(value)) return value;
    return adminData?.role === 'admin' || adminData?.isAdmin ? 'owner' : 'viewer';
  }

  function label(value = role()) {
    return ({ owner: 'Owner', manager: 'Manager', reviewer: 'Reviewer', viewer: 'Viewer' })[value] || 'Viewer';
  }

  function can(action) {
    const currentRole = role();
    if (currentRole === 'owner') return true;
    if (currentRole === 'manager') return action !== 'manage_roles';
    if (currentRole === 'reviewer') return ['view', 'review', 'assign_self', 'note', 'image_review'].includes(action);
    return action === 'view';
  }

  function action(button) {
    const text = tx(button);
    if (/永久刪除|核准並刪除|刪除帳號/.test(text)) return 'delete_account';
    if (/刪除貼文|刪除留言|下架/.test(text)) return 'delete_content';
    if (/發送平台通知|重新寄送|寄出 10 分鐘臨時密碼/.test(text)) return 'send';
    if (/通過|核准|拒絕|駁回|設定新密碼|標記已處理/.test(text)) return 'review';
    return 'view';
  }

  function renderAdminCount() {
    if (!Array.isArray(explicitAdminIds)) return;
    const element = qs('count-admins');
    if (!element) return;
    const next = String(explicitAdminIds.length);
    if (element.textContent !== next) element.textContent = next;
    element.title = explicitAdminIds.length
      ? `admins 名單內目前啟用：${explicitAdminIds.join(', ')}`
      : 'admins 名單內目前沒有啟用的管理員';
  }

  async function startAdminCountSync() {
    if (adminCountUnsubscribe) {
      renderAdminCount();
      return;
    }
    if (adminCountStarting) return;
    adminCountStarting = true;
    try {
      const { db, fs } = await tools();
      adminCountUnsubscribe = fs.onSnapshot(
        fs.collection(db, 'secretg_apps', APP_ID, 'admins'),
        snapshot => {
          const ids = [];
          snapshot.forEach(documentSnapshot => {
            const data = documentSnapshot.data() || {};
            if (data.enabled !== false && data.deleted !== true) ids.push(documentSnapshot.id);
          });
          explicitAdminIds = [...new Set(ids)].sort((a, b) => a.localeCompare(b));
          renderAdminCount();
        },
        error => {
          console.warn('管理員數量同步失敗', error);
          adminCountUnsubscribe = null;
        }
      );
    } catch (error) {
      console.warn('管理員數量初始化失敗', error);
    } finally {
      adminCountStarting = false;
    }
  }

  async function load() {
    capture();
    if (!adminId || adminData) return;
    try {
      const { db, fs } = await tools();
      const snapshot = await fs.getDoc(fs.doc(db, 'secretg_apps', APP_ID, 'admins', adminId));
      adminData = snapshot.exists()
        ? { id: snapshot.id, ...snapshot.data() }
        : { id: adminId, adminRole: 'viewer' };
      window.SRAdminPhase2 = {
        ...(window.SRAdminPhase2 || {}),
        adminId,
        adminData,
        role: role(),
        can
      };
      renderBadge();
      renderManager();
      schedule();
    } catch (error) {
      console.warn('管理員角色讀取失敗', error);
    }
  }

  function renderBadge() {
    const header = document.querySelector('#admin-main header');
    if (!header || !adminData) return;
    let badge = qs('sr-admin-role-badge-v2');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'sr-admin-role-badge-v2';
      badge.className = 'self-start px-3 py-2 rounded-full border border-violet-500/20 bg-violet-500/10 text-violet-200 text-xs font-black';
      header.appendChild(badge);
    }
    badge.textContent = `${adminId} · ${label()}`;
    badge.title = '介面角色限制需搭配 Firestore Security Rules 才是完整安全控制。';
  }

  async function renderManager() {
    const main = qs('admin-main');
    if (!main || !adminData || qs('sr-role-manager-v2')) return;

    const panel = document.createElement('section');
    panel.id = 'sr-role-manager-v2';
    panel.className = 'mb-8 rounded-3xl border border-violet-500/15 bg-violet-500/5 p-5';
    panel.innerHTML = `
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-xs text-violet-300 font-black">後台角色</div>
          <h2 class="text-lg text-white font-black mt-1">權限與分工</h2>
          <p class="text-xs text-slate-500 mt-1">Owner 可調整角色；Manager 管理案件；Reviewer 審核內容；Viewer 僅檢視。</p>
        </div>
        <button id="sr-role-toggle" class="min-h-[44px] px-4 rounded-xl border border-violet-500/20 text-violet-300 text-xs font-black">
          ${can('manage_roles') ? '管理角色' : label()}
        </button>
      </div>
      <div id="sr-role-list" class="hidden grid grid-cols-1 md:grid-cols-2 gap-3 mt-4"></div>
    `;
    main.querySelector('header')?.insertAdjacentElement('afterend', panel);

    qs('sr-role-toggle').onclick = async () => {
      if (!can('manage_roles')) return toast('只有 Owner 可以調整後台角色。', 'info');
      const list = qs('sr-role-list');
      list.classList.toggle('hidden');
      if (list.dataset.loaded === '1') return;

      try {
        const { db, fs } = await tools();
        const snapshot = await fs.getDocs(fs.collection(db, 'secretg_apps', APP_ID, 'admins'));
        const rows = [];
        snapshot.forEach(documentSnapshot => rows.push({ id: documentSnapshot.id, ...documentSnapshot.data() }));
        list.innerHTML = rows.map(item => `
          <div class="rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
            <div class="text-sm text-slate-200 font-black">${esc(item.id)}</div>
            <select data-admin-role="${esc(item.id)}" class="w-full min-h-[44px] mt-3 rounded-xl bg-slate-900 border border-slate-700 px-3 text-xs text-slate-200">
              <option value="owner">Owner</option>
              <option value="manager">Manager</option>
              <option value="reviewer">Reviewer</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
        `).join('');

        rows.forEach(item => {
          const select = list.querySelector(`[data-admin-role="${CSS.escape(item.id)}"]`);
          select.value = item.adminRole || (item.role === 'admin' ? 'owner' : 'viewer');
          select.onchange = async () => {
            try {
              await fs.updateDoc(fs.doc(db, 'secretg_apps', APP_ID, 'admins', item.id), {
                adminRole: select.value,
                roleUpdatedBy: adminId,
                roleUpdatedAt: fs.serverTimestamp(),
                roleUpdatedAtMs: Date.now()
              });
              toast(`${item.id} 已改為 ${label(select.value)}。`, 'success');
            } catch (error) {
              toast('角色更新失敗：' + error.message, 'error');
            }
          };
        });
        list.dataset.loaded = '1';
      } catch (error) {
        toast('角色清單讀取失敗：' + error.message, 'error');
      }
    };
  }

  function guard() {
    document.querySelectorAll('#admin-list button,#sr-notification-scheduler-v2 button').forEach(button => {
      const allowed = can(action(button));
      button.classList.toggle('sr-role-disabled', !allowed);
      button.setAttribute('aria-disabled', allowed ? 'false' : 'true');
      if (!allowed) button.title = `${label()} 無法執行這個操作`;
    });
  }

  function style() {
    if (qs('sr-admin-phase2-roles-style')) return;
    const stylesheet = document.createElement('style');
    stylesheet.id = 'sr-admin-phase2-roles-style';
    stylesheet.textContent = '.sr-role-disabled{opacity:.42!important;filter:grayscale(.35);cursor:not-allowed!important}';
    document.head.appendChild(stylesheet);
  }

  function apply() {
    queued = false;
    style();
    capture();
    load();
    startAdminCountSync();
    renderAdminCount();
    renderBadge();
    renderManager();
    guard();
    document.documentElement.dataset.srAdminPhase2Roles = VERSION;
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  document.addEventListener('click', event => {
    if (event.target?.closest?.('#admin-login-submit')) capture();
    const blocked = event.target?.closest?.('.sr-role-disabled');
    if (blocked) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      toast(`${label()} 無法執行這個操作。`, 'error');
    }
  }, true);

  window.SRAdminRuntime?.register(schedule);
  apply();
})();
})();

/* ===== Consolidated source: sr_admin_phase2_case_list.js ===== */
;(() => {
// SecretRoom admin phase two: case assignments, selections and My Tasks.
(() => {
  if(window.__SR_ADMIN_PHASE2_CASE_LIST__)return;
  window.__SR_ADMIN_PHASE2_CASE_LIST__=true;
  const APP_ID='secretg-production-node-tw',VERSION='20260711-admin-phase2-case-list-v1',SESSION='sr_admin_session_id_v2';
  const assignments=new Map(),selected=new Map();
  let unsub=null,queued=false,myOnly=false;
  const qs=id=>document.getElementById(id),tx=v=>String(v||'').replace(/\s+/g,' ').trim(),toast=(m,t='info')=>window.showToast?.(m,t);
  async function tools(){const a=await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),fs=await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'),app=a.getApps()[0];if(!app)throw Error('Firebase 尚未初始化');return{db:fs.getFirestore(app),fs};}
  const adminId=()=>window.SRAdminPhase2?.adminId||sessionStorage.getItem(SESSION)||qs('admin-login-id')?.value.trim()||'';
  const can=a=>window.SRAdminPhase2?.can?window.SRAdminPhase2.can(a):a==='view';
  function caseId(card){const attrs=[...card.querySelectorAll('[onclick]')].map(n=>n.getAttribute('onclick')||'').join(' '),quoted=attrs.match(/\(['"]([^'"]+)['"]/),account=tx(card).match(/@([A-Za-z0-9_.-]+)/)?.[1],post=tx(card).match(/貼文 ID[:：]\s*([^\s·]+)/)?.[1];return quoted?.[1]||post||account||tx(card).slice(0,80);}
  function caseKey(card){return`${qs('filter-status')?.value||'all'}:${caseId(card)}`;}
  function hash(v){let h=5381;for(let i=0;i<v.length;i++)h=((h<<5)+h)^v.charCodeAt(i);return`case_${(h>>>0).toString(36)}`;}
  async function assign(key,to){if(!can('assign_self'))throw Error('你的角色不能指派案件。');const{db,fs}=await tools();await fs.setDoc(fs.doc(db,'secretg_apps',APP_ID,'admin_case_assignments',hash(key)),{caseKey:key,assignedTo:to,assignedBy:adminId(),status:to?'assigned':'unassigned',updatedAt:fs.serverTimestamp(),updatedAtMs:Date.now()},{merge:true});}
  async function sync(){if(unsub)return;try{const{db,fs}=await tools();unsub=fs.onSnapshot(fs.collection(db,'secretg_apps',APP_ID,'admin_case_assignments'),s=>{assignments.clear();s.forEach(d=>{const x=d.data()||{};if(x.caseKey)assignments.set(x.caseKey,{id:d.id,...x});});schedule();},e=>console.warn('案件指派同步失敗',e));}catch(e){console.warn(e);}}
  function decorate(card){if(card.dataset.srPhase2Selectable==='1'||/目前沒有|正在讀取|正在檢索/.test(tx(card)))return;card.dataset.srPhase2Selectable='1';const key=caseKey(card);card.dataset.srCaseKey=key;card.style.position='relative';card.style.paddingLeft='3.2rem';const label=document.createElement('label');label.className='sr-case-checkbox absolute top-3 left-3 w-8 h-8 rounded-lg border border-slate-700 bg-slate-950/90 flex items-center justify-center z-10';label.innerHTML='<input type="checkbox" class="accent-amber-500">';card.appendChild(label);const input=label.querySelector('input');input.checked=selected.has(key);input.onchange=()=>{input.checked?selected.set(key,card):selected.delete(key);update();};const a=assignments.get(key);if(a?.assignedTo&&!card.querySelector('.sr-case-assignee')){const tag=document.createElement('div');tag.className='sr-case-assignee absolute top-3 right-3 text-[11px] px-2 py-1 rounded-full border border-cyan-500/20 bg-cyan-500/5 text-cyan-300 font-black';tag.textContent=a.assignedTo===adminId()?'我的案件':`負責：${a.assignedTo}`;card.appendChild(tag);}}
  function toolbar(){const list=qs('admin-list');if(!list||qs('sr-admin-batch-v2'))return;const bar=document.createElement('div');bar.id='sr-admin-batch-v2';bar.className='mb-3 rounded-2xl border border-violet-500/15 bg-violet-500/5 p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3';bar.innerHTML='<div><strong id="sr-batch-count" class="text-sm text-slate-200">已選 0 筆</strong><div class="text-xs text-slate-500 mt-1">批次操作只提供指派與匯出，不直接批次刪除或核准。</div></div><div class="flex flex-wrap gap-2"><button id="sr-batch-myself" class="min-h-[44px] px-4 rounded-xl bg-violet-600 text-white text-xs font-black">指派給我</button><button id="sr-batch-export" class="min-h-[44px] px-4 rounded-xl border border-slate-700 text-slate-300 text-xs font-black">匯出選取內容</button><button id="sr-my-tasks-toggle" class="min-h-[44px] px-4 rounded-xl border border-cyan-500/20 text-cyan-300 text-xs font-black">只看我的待辦</button></div>';list.parentElement.insertBefore(bar,list);qs('sr-batch-myself').onclick=async()=>{if(!selected.size)return toast('請先選取案件。','info');try{for(const key of selected.keys())await assign(key,adminId());selected.clear();document.querySelectorAll('.sr-case-checkbox input').forEach(i=>i.checked=false);update();toast('已把選取案件指派給你。','success');}catch(e){toast(e.message,'error');}};qs('sr-batch-export').onclick=()=>{if(!selected.size)return toast('請先選取案件。','info');const data=[...selected].map(([key,card])=>({caseKey:key,text:tx(card)})),blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`secretroom_admin_cases_${Date.now()}.json`;a.click();URL.revokeObjectURL(url);};qs('sr-my-tasks-toggle').onclick=()=>{myOnly=!myOnly;schedule();};}
  function update(){if(qs('sr-batch-count'))qs('sr-batch-count').textContent=`已選 ${selected.size} 筆`;if(qs('sr-my-tasks-toggle'))qs('sr-my-tasks-toggle').textContent=myOnly?'顯示全部案件':'只看我的待辦';document.querySelectorAll('#admin-list>[data-sr-case-key]').forEach(card=>{const to=assignments.get(card.dataset.srCaseKey)?.assignedTo||'';card.classList.toggle('hidden',myOnly&&to!==adminId());});}
  function style(){if(qs('sr-admin-phase2-case-list-style'))return;const s=document.createElement('style');s.id='sr-admin-phase2-case-list-style';s.textContent='.sr-case-checkbox{opacity:.72}.sr-case-checkbox:hover{opacity:1}@media(max-width:640px){.sr-case-assignee{position:static!important;display:inline-flex;margin-bottom:.5rem}}';document.head.appendChild(s);}
  function apply(){queued=false;style();sync();toolbar();document.querySelectorAll('#admin-list>div').forEach(decorate);update();window.SRAdminCaseWorkspace={...(window.SRAdminCaseWorkspace||{}),assignments,selected,caseId,caseKey,assign,hash,tools};document.documentElement.dataset.srAdminPhase2CaseList=VERSION;}
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(apply);}
  window.SRAdminRuntime?.register(schedule);apply();
})();

})();

/* ===== Consolidated source: sr_admin_phase2_case_drawer.js ===== */
;(() => {
// SecretRoom admin phase two: master-detail case drawer, notes, audit trail and image review checklist.
(() => {
  if(window.__SR_ADMIN_PHASE2_CASE_DRAWER__)return;
  window.__SR_ADMIN_PHASE2_CASE_DRAWER__=true;
  const APP_ID='secretg-production-node-tw',VERSION='20260716-admin-cases-v2',SESSION='sr_admin_session_id_v2';let activeDrawerUnsubscribe=null;
  const qs=id=>document.getElementById(id),tx=v=>String(v||'').replace(/\s+/g,' ').trim(),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),toast=(m,t='info')=>window.showToast?.(m,t);
  const adminId=()=>window.SRAdminPhase2?.adminId||sessionStorage.getItem(SESSION)||'';
  const can=a=>window.SRAdminPhase2?.can?window.SRAdminPhase2.can(a):a==='view';
  async function tools(){if(window.SRAdminCaseWorkspace?.tools)return window.SRAdminCaseWorkspace.tools();const a=await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),fs=await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'),app=a.getApps()[0];if(!app)throw Error('Firebase 尚未初始化');return{db:fs.getFirestore(app),fs};}
  function fallbackCaseId(card){const attrs=[...card.querySelectorAll('[onclick]')].map(n=>n.getAttribute('onclick')||'').join(' ');return attrs.match(/\(['"]([^'"]+)['"]/)?.[1]||tx(card).match(/@([A-Za-z0-9_.-]+)/)?.[1]||tx(card).slice(0,80);}
  function fallbackCaseKey(card){return`${qs('filter-status')?.value||'all'}:${fallbackCaseId(card)}`;}
  function hash(v){let h=5381;for(let i=0;i<v.length;i++)h=((h<<5)+h)^v.charCodeAt(i);return`case_${(h>>>0).toString(36)}`;}
  async function writeNote(key,note){if(!can('note'))throw Error('你的角色不能新增內部備註。');const{db,fs}=await tools(),ref=fs.doc(fs.collection(db,'secretg_apps',APP_ID,'admin_case_notes'));await fs.setDoc(ref,{caseKey:key,note,author:adminId(),createdAt:fs.serverTimestamp(),createdAtMs:Date.now()});}
  async function saveReview(key,data){if(!can('image_review'))throw Error('你的角色不能儲存圖片審核。');const{db,fs}=await tools();await fs.setDoc(fs.doc(db,'secretg_apps',APP_ID,'admin_case_reviews',hash(key)),{caseKey:key,...data,reviewedBy:adminId(),reviewedAt:fs.serverTimestamp(),reviewedAtMs:Date.now()},{merge:true});}
  async function open(card){const w=window.SRAdminCaseWorkspace||{},key=card.dataset.srCaseKey||w.caseKey?.(card)||fallbackCaseKey(card),target=w.caseId?.(card)||fallbackCaseId(card),assignment=w.assignments?.get(key),images=[...card.querySelectorAll('img')].map(i=>i.src).filter(Boolean).slice(0,4);activeDrawerUnsubscribe?.();activeDrawerUnsubscribe=null;qs('sr-case-drawer')?.remove();const d=document.createElement('aside');d.id='sr-case-drawer';d.className='fixed inset-y-0 right-0 z-[240] w-full max-w-xl bg-[#05070c] border-l border-amber-500/15 shadow-2xl overflow-y-auto p-5 sm:p-6';d.innerHTML=`<div class="flex items-start justify-between gap-3"><div><div class="text-xs text-amber-300 font-black">案件詳細資料</div><h2 class="text-xl text-white font-black mt-1">${esc(target)}</h2><p class="text-xs text-slate-500 mt-1 font-mono break-all">${esc(key)}</p></div><button id="sr-case-close" class="w-11 h-11 rounded-full border border-slate-700 text-slate-300"><i class="fa-solid fa-xmark"></i></button></div><section class="mt-5 rounded-2xl border border-slate-800 bg-slate-950/55 p-4"><h3 class="text-xs text-slate-400 font-black">原始案件內容</h3><p class="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed mt-3">${esc(tx(card))}</p>${images.length?`<div class="grid grid-cols-2 gap-2 mt-4">${images.map(src=>`<button data-review-image="${esc(src)}" class="rounded-xl overflow-hidden border border-slate-800"><img src="${esc(src)}" class="w-full h-32 object-cover"></button>`).join('')}</div>`:''}</section><section class="mt-4 rounded-2xl border border-cyan-500/15 bg-cyan-500/5 p-4"><div class="flex items-center justify-between gap-3"><div><h3 class="text-sm text-white font-black">案件負責人</h3><p id="sr-case-assignee-text" class="text-xs text-slate-500 mt-1">${esc(assignment?.assignedTo||'尚未指派')}</p></div><button id="sr-case-assign-me" class="min-h-[44px] px-4 rounded-xl border border-cyan-500/20 text-cyan-300 text-xs font-black">指派給我</button></div></section><section class="mt-4 rounded-2xl border border-amber-500/15 bg-amber-500/5 p-4"><h3 class="text-sm text-white font-black">圖片審核檢查</h3><div class="space-y-2 mt-3"><label class="flex gap-3 text-xs text-slate-300"><input id="sr-review-clear" type="checkbox" class="accent-amber-500">圖片清楚可辨識</label><label class="flex gap-3 text-xs text-slate-300"><input id="sr-review-context" type="checkbox" class="accent-amber-500">內容與申請項目一致</label><label class="flex gap-3 text-xs text-slate-300"><input id="sr-review-consent" type="checkbox" class="accent-amber-500">已確認分享／審核同意</label></div><button id="sr-review-save" class="w-full min-h-[44px] mt-4 rounded-xl bg-amber-600 text-slate-950 text-xs font-black">儲存檢查結果</button></section><section class="mt-4 rounded-2xl border border-violet-500/15 bg-violet-500/5 p-4"><h3 class="text-sm text-white font-black">內部備註</h3><textarea id="sr-case-note" class="w-full min-h-[90px] mt-3 rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white" placeholder="只有管理員可見"></textarea><button id="sr-case-note-save" class="w-full min-h-[44px] mt-3 rounded-xl bg-violet-600 text-white text-xs font-black">新增備註</button><div id="sr-case-notes" class="space-y-2 mt-4"><div class="text-xs text-slate-500">正在讀取備註...</div></div></section><section class="mt-4 rounded-2xl border border-slate-800 bg-slate-950/55 p-4"><h3 class="text-sm text-white font-black">管理紀錄</h3><div id="sr-case-logs" class="space-y-2 mt-3"><div class="text-xs text-slate-500">正在讀取紀錄...</div></div></section>`;document.body.appendChild(d);qs('sr-case-close').onclick=()=>{activeDrawerUnsubscribe?.();activeDrawerUnsubscribe=null;d.remove();};d.querySelectorAll('[data-review-image]').forEach(b=>b.onclick=()=>window.zoomImage?.(b.dataset.reviewImage));qs('sr-case-assign-me').onclick=async()=>{try{if(!w.assign)throw Error('案件指派功能尚未準備好。');await w.assign(key,adminId());qs('sr-case-assignee-text').textContent=adminId();toast('案件已指派給你。','success');}catch(e){toast(e.message,'error');}};qs('sr-review-save').onclick=async()=>{try{await saveReview(key,{imageClear:qs('sr-review-clear').checked,contextMatches:qs('sr-review-context').checked,consentConfirmed:qs('sr-review-consent').checked});toast('圖片審核檢查已儲存。','success');}catch(e){toast(e.message,'error');}};qs('sr-case-note-save').onclick=async()=>{const note=qs('sr-case-note').value.trim();if(!note)return toast('請先輸入備註。','info');try{await writeNote(key,note);qs('sr-case-note').value='';toast('內部備註已新增。','success');}catch(e){toast(e.message,'error');}};try{const{db,fs}=await tools();activeDrawerUnsubscribe=fs.onSnapshot(fs.query(fs.collection(db,'secretg_apps',APP_ID,'admin_case_notes'),fs.where('caseKey','==',key)),s=>{const rows=[];s.forEach(x=>rows.push(x.data()||{}));rows.sort((a,b)=>Number(b.createdAtMs||0)-Number(a.createdAtMs||0));if(qs('sr-case-notes'))qs('sr-case-notes').innerHTML=rows.length?rows.map(n=>`<div class="rounded-xl border border-slate-800 bg-slate-950/70 p-3"><div class="text-xs text-slate-200 whitespace-pre-wrap">${esc(n.note)}</div><div class="text-[11px] text-slate-600 mt-2">${esc(n.author||'admin')} · ${n.createdAtMs?new Date(n.createdAtMs).toLocaleString('zh-TW',{hour12:false}):''}</div></div>`).join(''):'<div class="text-xs text-slate-500">尚無備註</div>';});const logs=await fs.getDocs(fs.query(fs.collection(db,'secretg_apps',APP_ID,'admin_logs'),fs.where('targetId','==',target))),rows=[];logs.forEach(x=>rows.push(x.data()||{}));rows.sort((a,b)=>Number(b.createdAtMs||0)-Number(a.createdAtMs||0));if(qs('sr-case-logs'))qs('sr-case-logs').innerHTML=rows.length?rows.slice(0,30).map(x=>`<div class="rounded-xl border border-slate-800 p-3"><div class="text-xs text-slate-300 font-black">${esc(x.action||'操作')}</div><div class="text-[11px] text-slate-600 mt-1">${esc(x.adminId||'')} · ${x.createdAtMs?new Date(x.createdAtMs).toLocaleString('zh-TW',{hour12:false}):''}</div></div>`).join(''):'<div class="text-xs text-slate-500">查無管理紀錄</div>';}catch(e){console.warn('案件詳細資料讀取失敗',e);}}
  function style(){if(qs('sr-admin-phase2-drawer-style'))return;const s=document.createElement('style');s.id='sr-admin-phase2-drawer-style';s.textContent='#sr-case-drawer{animation:srDrawerIn .2s ease-out}@keyframes srDrawerIn{from{transform:translateX(24px);opacity:.5}to{transform:none;opacity:1}}';document.head.appendChild(s);}
  document.addEventListener('click',e=>{const card=e.target?.closest?.('#admin-list>div[data-sr-case-key]');if(card&&!e.target.closest('button,input,select,textarea,label,a'))open(card);},true);style();document.documentElement.dataset.srAdminPhase2CaseDrawer=VERSION;
})();

})();

/* ===== Consolidated source: sr_admin_phase2_notifications.js ===== */
;(() => {
// SecretRoom admin phase two: notification test send and scheduling queue.
(() => {
  if(window.__SR_ADMIN_PHASE2_NOTIFICATIONS__)return;
  window.__SR_ADMIN_PHASE2_NOTIFICATIONS__=true;
  const APP_ID='secretg-production-node-tw',VERSION='20260711-admin-phase2-notifications-v1';
  let queued=false,unsub=null;
  const qs=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),toast=(m,t='info')=>window.showToast?.(m,t);
  async function tools(){const a=await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),fs=await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'),app=a.getApps()[0];if(!app)throw Error('Firebase 尚未初始化');return{db:fs.getFirestore(app),fs};}
  const admin=()=>window.SRAdminPhase2?.adminId||sessionStorage.getItem('sr_admin_session_id_v2')||'';
  const data=()=>window.SRAdminPhase2?.adminData||{};
  const can=a=>window.SRAdminPhase2?.can?window.SRAdminPhase2.can(a):a==='view';
  async function create(payload){if(!can('send'))throw Error('你的角色不能建立通知排程。');const{db,fs}=await tools(),ref=fs.doc(fs.collection(db,'secretg_apps',APP_ID,'scheduled_notifications'));await fs.setDoc(ref,{...payload,status:'pending',createdBy:admin(),createdAt:fs.serverTimestamp(),createdAtMs:Date.now()});}
  async function send(item){if(!can('send'))throw Error('你的角色不能發送通知。');const{db,fs}=await tools(),ref=fs.doc(fs.collection(db,'secretg_apps',APP_ID,'notifications'));await fs.setDoc(ref,{type:'platform',category:'platform',tone:'platform',title:item.title,message:item.message,target:item.target||'all',status:'已發送',revoked:false,createdBy:admin(),createdAt:fs.serverTimestamp(),createdAtMs:Date.now(),scheduledSourceId:item.id||''});if(item.id)await fs.updateDoc(fs.doc(db,'secretg_apps',APP_ID,'scheduled_notifications',item.id),{status:'sent',sentAt:fs.serverTimestamp(),sentAtMs:Date.now(),sentBy:admin()});}
  async function render(){const target=qs('broadcast-target'),title=qs('broadcast-title'),message=qs('broadcast-message');if(!target||!title||!message||qs('sr-notification-scheduler-v2'))return;const panel=target.closest('.glass-panel')||target.parentElement?.parentElement;if(!panel)return;const box=document.createElement('section');box.id='sr-notification-scheduler-v2';box.className='mt-5 rounded-2xl border border-cyan-500/15 bg-cyan-500/5 p-4';box.innerHTML='<div><h3 class="text-sm text-white font-black">通知測試與排程</h3><p class="text-xs text-slate-500 mt-1">排程會寫入佇列，可手動立即送出；正式無人值守排程仍需 Cloud Function。</p></div><div class="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 mt-4"><input id="sr-notification-time" type="datetime-local" class="min-h-[44px] rounded-xl bg-slate-900 border border-slate-700 px-3 text-xs text-slate-200"><button id="sr-notification-test" class="min-h-[44px] px-4 rounded-xl border border-sky-500/20 text-sky-300 text-xs font-black">寄測試信給我</button><button id="sr-notification-schedule" class="min-h-[44px] px-4 rounded-xl bg-cyan-600 text-white text-xs font-black">儲存排程</button></div><div id="sr-scheduled-list" class="space-y-2 mt-4"></div>';panel.appendChild(box);qs('sr-notification-schedule').onclick=async()=>{const ms=new Date(qs('sr-notification-time').value).getTime();if(!title.value.trim()||!message.value.trim())return toast('請先填寫通知標題與內容。','info');if(!ms||ms<=Date.now())return toast('請選擇未來的排程時間。','info');try{await create({title:title.value.trim(),message:message.value.trim(),target:target.value,scheduledAtMs:ms,scheduledAt:new Date(ms).toISOString()});toast('通知已加入排程佇列。','success');}catch(e){toast(e.message,'error');}};qs('sr-notification-test').onclick=async()=>{const email=data().email;if(!email)return toast('管理員帳號沒有設定測試信箱。','info');if(!window.emailjs)return toast('Email 功能尚未準備好。','error');try{await emailjs.send('service_1ou10mi','template_sr_notice',{to_email:email,to_name:admin(),status_text:`[測試] ${title.value||'SecretRoom 通知'}`,message:message.value||'這是一封測試通知。',email_type:'平台通知測試',member_id:admin()},{publicKey:'XggJY7iHQcZYYhNY7'});toast(`測試信已寄到 ${email}。`,'success');}catch(e){toast('測試信寄送失敗：'+e.message,'error');}};try{const{db,fs}=await tools();unsub=fs.onSnapshot(fs.collection(db,'secretg_apps',APP_ID,'scheduled_notifications'),s=>{const rows=[];s.forEach(d=>rows.push({id:d.id,...d.data()}));rows.sort((a,b)=>Number(a.scheduledAtMs||0)-Number(b.scheduledAtMs||0));const list=qs('sr-scheduled-list');if(!list)return;const pending=rows.filter(x=>x.status==='pending').slice(0,20);list.innerHTML=pending.length?pending.map(x=>`<div class="rounded-xl border border-slate-800 bg-slate-950/55 p-3 flex items-start justify-between gap-3"><div><div class="text-xs text-slate-200 font-black">${esc(x.title||'未命名通知')}</div><div class="text-[11px] text-slate-500 mt-1">${x.scheduledAtMs?new Date(x.scheduledAtMs).toLocaleString('zh-TW',{hour12:false}):'未設定時間'} · ${esc(x.target||'all')}</div></div><button data-send-scheduled="${esc(x.id)}" class="min-h-[40px] px-3 rounded-xl border border-cyan-500/20 text-cyan-300 text-xs font-black">立即送出</button></div>`).join(''):'<div class="text-xs text-slate-500">目前沒有待發送排程</div>';list.querySelectorAll('[data-send-scheduled]').forEach(b=>b.onclick=async()=>{const item=rows.find(x=>x.id===b.dataset.sendScheduled);if(!item)return;try{await send(item);toast('排程通知已立即送出。','success');}catch(e){toast(e.message,'error');}});},e=>console.warn('通知排程同步失敗',e));}catch(e){console.warn(e);}}
  function apply(){queued=false;render();document.documentElement.dataset.srAdminPhase2Notifications=VERSION;}
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(apply);}
  window.SRAdminRuntime?.register(schedule);apply();
})();

})();

/* ===== SecretRoom Telegram Phase 2 delivery console ===== */
;(() => {
  if (window.__SR_TELEGRAM_DELIVERY_CONSOLE__) return;
  window.__SR_TELEGRAM_DELIVERY_CONSOLE__ = true;
  const A='secretg-production-node-tw'; let P=null,started=false,items=[];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const toast=(m,t='info')=>window.showToast?.(m,t);
  async function T(){return P||(P=Promise.all([import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js')]).then(([a,fs])=>({db:fs.getFirestore(a.getApps()[0]),fs})));}
  function host(){const list=document.getElementById('admin-list');if(!list)return null;let p=document.getElementById('sr-telegram-delivery-panel');if(!p){p=document.createElement('section');p.id='sr-telegram-delivery-panel';p.className='sr-tg-admin-panel';list.parentElement?.parentElement?.insertBefore(p,list.parentElement);}return p;}
  function when(v){const n=v?.toDate?v.toDate().getTime():Number(v||0);return n?new Date(n).toLocaleString('zh-TW',{hour12:false}):'尚未處理';}
  function render(){const p=host();if(!p)return;const a=[...items].sort((x,y)=>Number(y.createdAtMs||0)-Number(x.createdAtMs||0)),c=a.reduce((o,x)=>(o[x.status||'pending']=(o[x.status||'pending']||0)+1,o),{});p.innerHTML=`<div class="sr-tg-admin-header"><div><div class="sr-tg-admin-eyebrow"><i class="fa-brands fa-telegram"></i> Telegram 發送中心</div><h2>通知紀錄與失敗重送</h2></div><button id="sr-tg-retry-all" class="sr-tg-admin-button" ${c.failed?'':'disabled'}>重送全部失敗</button></div><div class="sr-tg-admin-stats"><span>待送 ${c.pending||0}</span><span>成功 ${c.sent||0}</span><span>失敗 ${c.failed||0}</span><span>略過 ${c.skipped||0}</span></div><details class="sr-tg-admin-details"><summary>查看最近 ${Math.min(a.length,40)} 筆紀錄</summary><div class="sr-tg-admin-list">${a.slice(0,40).map(x=>`<article class="sr-tg-log-card sr-tg-log-${esc(x.status||'pending')}"><div class="sr-tg-log-main"><strong>${esc(x.title||'SecretRoom 通知')}</strong><span>@${esc(x.accountId||'')} · ${esc(x.category||'notice')} · ${esc(x.status||'pending')}</span><p>${esc(x.message||'')}</p>${x.lastError?`<code>${esc(x.lastError)}</code>`:''}<small>${when(x.sentAt||x.sentAtMs||x.createdAt||x.createdAtMs)} · 嘗試 ${Number(x.attemptCount||0)} 次</small></div>${x.status==='failed'?`<button data-tg-retry="${esc(x.id)}" class="sr-tg-admin-button">重新傳送</button>`:''}</article>`).join('')||'<div class="text-xs text-slate-500 py-4">尚無 Telegram 發送紀錄</div>'}</div></details>`;p.querySelectorAll('[data-tg-retry]').forEach(b=>b.onclick=()=>retry(b.dataset.tgRetry));p.querySelector('#sr-tg-retry-all')?.addEventListener('click',retryAll);}
  async function retry(id){const{db,fs}=await T();await fs.setDoc(fs.doc(db,'secretg_apps',A,'telegram_outbox',id),{status:'pending',attemptCount:0,nextAttemptAtMs:0,lastError:'',forceSend:true,retriedAt:fs.serverTimestamp(),retriedAtMs:Date.now()},{merge:true});toast('Telegram 通知已排入重送','success');}
  async function retryAll(){const a=items.filter(x=>x.status==='failed');if(!a.length||!confirm(`確定重送 ${a.length} 筆 Telegram 失敗通知？`))return;for(const x of a)await retry(x.id);}
  async function start(){if(started||document.getElementById('admin-main')?.classList.contains('hidden'))return;started=true;const{db,fs}=await T();fs.onSnapshot(fs.collection(db,'secretg_apps',A,'telegram_outbox'),s=>{items=[];s.forEach(x=>items.push({id:x.id,...(x.data()||{})}));render();},e=>console.warn('Telegram outbox listener failed',e));}
  function apply(){if(!document.getElementById('admin-main')?.classList.contains('hidden'))start();if(started)render();}
  window.SRTelegramDeliveryConsole=Object.freeze({retry,retryAll,refresh:render});window.SRAdminRuntime?.register(apply);apply();
})();
