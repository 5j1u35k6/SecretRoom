// SecretRoom phase two: complete member directory search and Telegram restoration.
(() => {
  if (window.__SR_PHASE2_DIRECTORY_TELEGRAM__) return;
  window.__SR_PHASE2_DIRECTORY_TELEGRAM__ = true;

  const APP_ID = 'secretg-production-node-tw';
  const BOT_NAME = 'SecretRoomtwBot';
  const VERSION = '20260711-phase2-directory-telegram-v3';
  const directory = new Map();
  let unsubscribe = null;
  let queued = false;
  let migrationRunning = false;

  const qs = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const currentId = () => String(window.state?.applicationId || localStorage.getItem('sr_username') || '').trim();
  const toast = (message, type = 'info') => window.showToast?.(message, type);

  async function tools() {
    if (window.SRP?.tools) return window.SRP.tools();
    const appMod = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js');
    const fs = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
    const app = appMod.getApps()[0];
    if (!app) throw new Error('Firebase 尚未初始化');
    return { db: fs.getFirestore(app), fs };
  }

  function isXCompatibility(info) {
    if (!info || typeof info !== 'object') return false;
    const provider = String(info.provider || '').toLowerCase();
    return provider.startsWith('x-') || provider.startsWith('x_') || Boolean(info.xHandle || info.xUserId);
  }

  function telegramInfo(data = {}) {
    const info = data.telegramInfo;
    return info && typeof info === 'object' && !isXCompatibility(info) ? info : null;
  }

  function telegramUsername(data = {}) {
    const info = telegramInfo(data) || {};
    return String(info.username || info.telegramUsername || info.handle || '').replace(/^@+/, '').trim();
  }

  function telegramBound(data = {}) {
    return Boolean(telegramInfo(data));
  }

  function minimal(id, data = {}) {
    return {
      id,
      nickname: data.nickname || data.displayName || id,
      avatar: data.avatar || '',
      status: data.status || '',
      kinks: Array.isArray(data.kinks) ? data.kinks : [],
      isSpecElite: Boolean(data.isSpecElite),
      role: data.role || '',
      isAdmin: Boolean(data.isAdmin),
      telegramInfo: telegramInfo(data)
    };
  }

  function includeCurrent() {
    const id = currentId();
    if (id) directory.set(id, minimal(id, window.state?.userData || {}));
  }

  async function syncDirectory() {
    if (unsubscribe || !window.state) return;
    try {
      const { db, fs } = await tools();
      const q = fs.query(
        fs.collection(db, 'secretg_apps', APP_ID, 'applications'),
        fs.where('status', 'in', ['approved', 'active'])
      );
      unsubscribe = fs.onSnapshot(q, snapshot => {
        directory.clear();
        snapshot.forEach(docSnap => directory.set(docSnap.id, minimal(docSnap.id, docSnap.data() || {})));
        includeCurrent();
        schedule();
      }, error => console.warn('帳號目錄同步失敗', error));
    } catch (error) {
      console.warn('帳號目錄無法啟動', error);
      includeCurrent();
    }
  }

  async function migrateCurrentAccountFromX() {
    if (migrationRunning || !window.state?.applicationId) return;
    const user = window.state.userData || {};
    const legacyTelegram = user.telegramInfo;
    const provider = String(user.socialBindingProvider || '').toLowerCase();
    const hasXResidue = isXCompatibility(legacyTelegram) || Boolean(user.xInfo) || provider.startsWith('x');
    if (!hasXResidue) return;

    migrationRunning = true;
    try {
      const hasRealTelegram = telegramBound(user);
      const { db, fs } = await tools();
      const updates = {
        xInfo: null,
        socialBindingProvider: hasRealTelegram ? 'telegram' : null,
        socialBindingUpdatedAt: fs.serverTimestamp(),
        socialBindingUpdatedAtMs: Date.now()
      };
      if (isXCompatibility(legacyTelegram)) updates.telegramInfo = null;
      await fs.updateDoc(fs.doc(db, 'secretg_apps', APP_ID, 'applications', currentId()), updates);
      window.state.userData = { ...user, ...updates };
      if (isXCompatibility(legacyTelegram)) {
        toast('已改回 Telegram 綁定，請完成 Telegram 驗證。', 'info');
        setTimeout(() => location.reload(), 350);
      }
    } catch (error) {
      console.warn('X 綁定資料清理失敗', error);
      migrationRunning = false;
    }
  }

  function matches(member, term) {
    const needle = term.toLocaleLowerCase('zh-TW');
    const username = telegramUsername(member);
    return [member.id, member.nickname, username, ...(member.kinks || [])]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('zh-TW')
      .includes(needle);
  }

  function memberRow(member, compact = false) {
    const username = telegramUsername(member);
    return `<button type="button" data-sr-member-id="${esc(member.id)}" class="w-full ${compact ? 'min-h-[52px] p-2' : 'min-h-[64px] p-3'} flex items-center justify-between gap-3 bg-slate-900/60 border border-amber-500/10 rounded-2xl text-left"><span class="flex items-center gap-3 min-w-0"><img src="${esc(member.avatar || 'Gemini_Generated_Image_e2fxvje2fxvje2fx.jpg?v=2')}" class="${compact ? 'w-8 h-8' : 'w-10 h-10'} rounded-full object-cover"><span class="min-w-0"><strong class="block text-sm text-slate-200 truncate">${esc(member.nickname)}</strong><span class="block text-xs text-slate-500 font-mono">@${esc(member.id)}</span>${username ? `<span class="block text-[11px] text-sky-300">Telegram @${esc(username)}</span>` : ''}</span></span><i class="fa-solid fa-chevron-right text-amber-400/70"></i></button>`;
  }

  function renderSearch() {
    const input = qs('feed-search-input');
    const overlay = qs('search-results-overlay');
    if (!input || !overlay || overlay.classList.contains('hidden')) return;
    const term = input.value.trim();
    if (!term) return;

    includeCurrent();
    const rows = Array.from(directory.values()).filter(member => matches(member, term)).slice(0, 40);
    const tab = overlay.querySelector(`button[onclick*="setSearchTab('users')"]`);
    if (tab && tab.textContent !== `帳號 (${rows.length})`) tab.textContent = `帳號 (${rows.length})`;

    let preview = overlay.querySelector('#sr-account-match-preview');
    if (rows.length) {
      if (!preview) {
        preview = document.createElement('section');
        preview.id = 'sr-account-match-preview';
        preview.className = 'rounded-2xl border border-sky-500/15 bg-sky-500/5 p-3';
        tab?.parentElement?.insertAdjacentElement('afterend', preview);
      }
      const previewKey = `${term}:${rows.slice(0, 3).map(row => row.id).join('|')}`;
      if (preview.dataset.key !== previewKey) {
        preview.dataset.key = previewKey;
        preview.innerHTML = `<div class="flex items-center justify-between gap-3 mb-2"><strong class="text-xs text-sky-300">符合的帳號</strong><button type="button" id="sr-view-all-account-results" class="text-xs text-amber-300 font-black">查看全部 ${rows.length} 個</button></div><div class="space-y-2">${rows.slice(0, 3).map(member => memberRow(member, true)).join('')}</div>`;
        preview.querySelector('#sr-view-all-account-results').onclick = () => window.setSearchTab?.('users');
      }
    } else {
      preview?.remove();
    }

    if (window.state?.searchTab !== 'users') return;
    const list = overlay.querySelector('.overflow-y-auto');
    if (!list) return;
    const key = `${term}:${rows.map(row => row.id).join('|')}`;
    if (list.dataset.srDirectoryKey === key) return;
    list.dataset.srDirectoryKey = key;
    list.innerHTML = rows.length
      ? rows.map(member => memberRow(member)).join('')
      : '<div class="py-8 text-center text-slate-500"><i class="fa-solid fa-user-magnifying-glass text-2xl text-amber-500/50"></i><strong class="block text-sm text-slate-300 mt-3">找不到符合的帳號</strong><span class="block text-xs mt-1">可搜尋帳號 ID、暱稱或 Telegram 帳號。</span></div>';
  }

  window.SRTelegramBound = data => telegramBound(data || window.state?.userData || {});
  window.SROpenTelegramBinding = () => {
    const user = window.state?.userData || {};
    if (telegramBound(user)) {
      window.open(`https://t.me/${BOT_NAME}`, '_blank', 'noopener,noreferrer');
      return;
    }
    if (window.state) window.state.currentView = 'telegram-bind';
    if (typeof window.renderApp === 'function') window.renderApp();
    else location.reload();
  };

  window.SRPhase2OpenProfile = id => {
    const member = directory.get(String(id));
    if (member && window.state) {
      const list = Array.isArray(window.state.activeUsers) ? [...window.state.activeUsers] : [];
      if (!list.some(item => item.id === member.id)) list.push(member);
      window.state.activeUsers = list;
    }
    window.viewUserProfile?.(String(id));
  };

  function apply() {
    queued = false;
    syncDirectory();
    migrateCurrentAccountFromX();
    renderSearch();
    document.documentElement.dataset.srPhase2DirectoryTelegram = VERSION;
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  document.addEventListener('click', event => {
    const row = event.target?.closest?.('[data-sr-member-id]');
    if (!row) return;
    event.preventDefault();
    event.stopPropagation();
    window.SRPhase2OpenProfile(row.dataset.srMemberId);
  }, true);
  document.addEventListener('input', event => {
    if (event.target?.id === 'feed-search-input') setTimeout(schedule, 170);
  }, true);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  apply();
})();
