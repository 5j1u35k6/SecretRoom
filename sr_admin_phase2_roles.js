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

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  apply();
})();