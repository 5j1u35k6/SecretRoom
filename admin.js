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
            publicKey: "ZEp9d-hAeYdFujDZy", 
            serviceId: "service_1ou10mi", 
            templateId: "template_25proud" 
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
        let currentAdminId = null;
        let currentAdminSource = null;
        let userIdToDelete = null; 

        async function initAdmin() {
            if (emailjsConfig.publicKey && emailjsConfig.publicKey !== "YOUR_EMAILJS_PUBLIC_KEY") {
                emailjs.init({ publicKey: emailjsConfig.publicKey });
            }

            const firebaseLoaded = await loadFirebaseSDKs();
            const statusEl = document.getElementById('connection-status');

            if (firebaseLoaded) {
                try {
                    const app = initializeApp(firebaseConfig);
                    db = getFirestore(app);
                    statusEl.className = "self-start px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2";
                    statusEl.innerHTML = '<i class="fa-solid fa-circle text-[8px] animate-pulse"></i> 安全連線已建立 - 節點驗證成功 ✓';
                    
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
            let data = null;
            let source = 'admins';

            if (adminSnap.exists()) {
                data = adminSnap.data();
            } else {
                const appRef = doc(db, 'secretg_apps', appId, 'applications', adminId);
                const appSnap = await getDoc(appRef);
                if (!appSnap.exists()) throw new Error('查無此管理員帳號。請先在 Firestore 建立 admins/' + adminId + '，或在 applications/' + adminId + ' 授予管理員權限。');
                data = appSnap.data();
                source = 'applications';
            }

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
            allApplications.filter(app => isAdminAccount(app)).forEach(app => ids.add(app.id));
            const el = document.getElementById('count-admins');
            if (el) el.textContent = ids.size;
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
            setText('count-password-reset', allPasswordResetRequests.filter(r => String(r.status || 'pending') === 'pending').length);
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
            }, (err) => console.warn('密碼重設申請同步失敗:', err));
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

        function renderPasswordResetRequests(listContainer) {
            const searchTerm = (document.getElementById('admin-search')?.value || '').trim().toLowerCase();
            const list = [...allPasswordResetRequests]
                .filter(r => !searchTerm || `${r.userId || ''} ${r.email || ''} ${r.status || ''}`.toLowerCase().includes(searchTerm))
                .sort((a,b) => parseTime(b.createdAt || b.createdAtMs) - parseTime(a.createdAt || a.createdAtMs));
            listContainer.innerHTML = '';
            if (list.length === 0) {
                listContainer.innerHTML = '<div class="text-center py-12 text-slate-500 flex flex-col items-center gap-2"><i class="fa-solid fa-key text-2xl"></i><span>目前沒有密碼重設申請</span></div>';
                return;
            }
            list.forEach(req => {
                const pending = String(req.status || 'pending') === 'pending';
                const card = document.createElement('div');
                card.className = `admin-muted-card p-5 rounded-2xl border ${pending ? 'border-amber-500/20' : 'border-slate-800/80 opacity-75'} flex flex-col md:flex-row md:items-center justify-between gap-4`;
                card.innerHTML = `
                    <div class="space-y-1.5">
                        <div class="text-sm font-black text-slate-200">密碼重設：@${escapeHtml(req.userId || '未填帳號')}</div>
                        <div class="text-xs text-slate-400"><i class="fa-regular fa-envelope"></i> ${escapeHtml(req.email || '未填信箱')}</div>
                        <div class="text-[10px] text-slate-500">${renderRequestTime(req)} · ${requestStatusLabel(req.status)}</div>
                    </div>
                    <div class="flex gap-2 flex-wrap">
                        ${pending ? `
                            <button onclick="completePasswordResetRequest('${req.id}')" class="bg-emerald-600/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/20 text-xs px-4 py-2.5 rounded-xl font-bold">設定臨時密碼</button>
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
                                <span class="text-[11px] text-slate-300">創始元老 🛡️</span>
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
                
                await sendEmailNotification(userData, status);
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
                    await sendEmailNotification(data, 'approved', "黃金 Spec 審核通過", "您的 SecretRoom 黃金 Spec Elite 勳章申請已正式核准，已即刻渲染在您的個人暱稱下方！");
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
                    await sendEmailNotification(data, 'rejected', "黃金 Spec 審核退回", "您申請的 SecretRoom 黃金 Spec Elite 勳章經管理員檢視照片與規格未通過核可。");
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
                
                await sendEmailNotification(userData, status, "會籍申請退回通知", `很抱歉，您的 SecretRoom 會籍申請未通過審核。退件理由：${reason}`);
            } catch (e) {
                console.error("更新狀態失敗:", e);
                showToast('更新失敗: ' + e.message, 'error');
            }
        }

        async function sendEmailNotification(userData, status, title = "審核通知", customMsg = null) {
            if (!emailjsConfig.publicKey || emailjsConfig.publicKey === "YOUR_EMAILJS_PUBLIC_KEY") {
                console.info(`[Email 模擬] 發送郵件給 ${userData.email}`);
                showToast(`[模擬信件] 已寄送審核通知至 ${userData.email}`, "info");
                return;
            }

            const messageText = customMsg || (status === 'approved' 
                ? `恭喜您！您的 SecretRoom 加入申請已通過審核。\n\n請您點擊下方連結重新進入平台，輸入您的帳號密碼進行登入：\nhttps://5j1u35k6.github.io/SecretRoom/`
                : `很抱歉，您的加入申請未通過審核。感謝您的關注。`);

            try {
                await emailjs.send(emailjsConfig.serviceId, emailjsConfig.templateId, {
                    to_email: userData.email,
                    to_name: userData.nickname,
                    status_text: title,
                    message: messageText
                });
                showToast(`真實審核通知信已寄送至 ${userData.email}`, "success");
            } catch (error) {
                console.error("Email 發送失敗:", error);
                showToast("通知信發送失敗，請確認您的 EmailJS 設定", "error");
            }
        }

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
                    showToast("頭像變更已核准啟用！", "success");
                    await sendEmailNotification(data, 'approved', "頭像變更審核通過", "您的 SecretRoom 新頭像更換申請已通過管理員審核，已立刻套用！");
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
                    await sendEmailNotification(data, 'rejected', "頭像變更審核未通過", "您在 SecretRoom 申請更換的新大頭照，未通過管理員審核，已回復原頭像。");
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
                
                showToast(`帳號 @${userId} 及其 ${deletePromises.length} 則分享貼文已安全且徹底永久銷毀`, "success");
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
                await deleteDoc(postRef);
                await writeAdminLog('delete_post', postId, { reason });
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
                if (comments[commentId]) {
                    comments[commentId].reports = [];
                    comments[commentId].reportCount = 0;
                    comments[commentId].reportReviewStatus = 'dismissed';
                    comments[commentId].reportReviewReason = reason;
                    comments[commentId].reportReviewedAtMs = Date.now();
                }
                await updateDoc(postRef, { comments });
                await writeAdminLog('dismiss_comment_reports', commentId, { postId, reason });
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
                delete comments[commentId];
                await updateDoc(postRef, { comments });
                await writeAdminLog('delete_comment', commentId, { postId, reason });
                showToast('留言已刪除', 'success');
            } catch (err) {
                showToast('刪除失敗: ' + err.message, 'error');
            }
        };

        window.completePasswordResetRequest = async function(requestId) {
            if (!db) return;
            const newPassword = prompt('請輸入要設定給會員的臨時密碼（至少 8 碼）：');
            if (!newPassword || newPassword.length < 8) { showToast('臨時密碼至少需要 8 碼', 'error'); return; }
            try {
                const reqRef = doc(db, 'secretg_apps', appId, 'password_reset_requests', requestId);
                const reqSnap = await getDoc(reqRef);
                if (!reqSnap.exists()) { showToast('找不到申請紀錄', 'error'); return; }
                const req = reqSnap.data();
                const userId = req.userId;
                if (!userId) { showToast('申請缺少會員帳號', 'error'); return; }
                const userRef = doc(db, 'secretg_apps', appId, 'applications', userId);
                const userSnap = await getDoc(userRef);
                if (!userSnap.exists()) { showToast('找不到會員帳號', 'error'); return; }
                const userData = userSnap.data();
                await updateDoc(userRef, { password: newPassword, passwordUpdatedAt: serverTimestamp(), passwordUpdatedAtMs: Date.now(), passwordUpdatedBy: currentAdminId });
                await updateDoc(reqRef, { status: 'completed', completedAt: serverTimestamp(), completedAtMs: Date.now(), reviewedBy: currentAdminId });
                await writeAdminLog('complete_password_reset', userId, { requestId });
                await sendEmailNotification({ ...userData, email: req.email || userData.email }, 'approved', 'SecretRoom 密碼重設完成', `您的 SecretRoom 登入密碼已由管理員重設。臨時密碼：${newPassword}。登入後請儘快修改密碼。`);
                showToast('臨時密碼已設定並寄送通知', 'success');
            } catch (err) {
                console.error('密碼重設失敗:', err);
                showToast('操作失敗: ' + err.message, 'error');
            }
        };

        window.rejectPasswordResetRequest = async function(requestId) {
            if (!db) return;
            const reason = prompt('請輸入拒絕原因：') || '資料不符，無法受理密碼重設';
            try {
                const reqRef = doc(db, 'secretg_apps', appId, 'password_reset_requests', requestId);
                await updateDoc(reqRef, { status: 'rejected', rejectionReason: reason, reviewedAt: serverTimestamp(), reviewedAtMs: Date.now(), reviewedBy: currentAdminId });
                await writeAdminLog('reject_password_reset', requestId, { reason });
                showToast('已拒絕密碼重設申請', 'success');
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
