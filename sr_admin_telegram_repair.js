/* SecretRoom Telegram webhook recovery panel. */
;(() => {
  const byId = id => document.getElementById(id);

  function backendUrl() {
    return String(
      window.SecretRoomBackendConfig?.backendUrl ||
      localStorage.getItem('sr_backend_url') ||
      ''
    ).replace(/\/+$/, '');
  }

  async function adminToken() {
    const [appModule, authModule] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js')
    ]);
    const app = appModule.getApps()[0];
    if (!app) throw new Error('Firebase 尚未初始化');
    const user = authModule.getAuth(app).currentUser;
    if (!user) throw new Error('請先完成管理員安全登入');
    return user.getIdToken();
  }

  async function api(path) {
    const response = await fetch(`${backendUrl()}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await adminToken()}`
      },
      body: '{}',
      cache: 'no-store'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `後端錯誤：${response.status}`);
    }
    return data;
  }

  function render(result) {
    const target = byId('sr-telegram-repair-status');
    if (!target) return;
    const bot = result.bot || {};
    const webhook = result.webhook || {};
    const actual = String(webhook.url || '');
    const expected = `${backendUrl()}/`;
    const healthy =
      (actual === expected || actual === backendUrl()) &&
      !webhook.lastErrorMessage;

    target.className = healthy
      ? 'mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-200 whitespace-pre-wrap break-all'
      : 'mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100 whitespace-pre-wrap break-all';

    const lines = [
      healthy ? 'Telegram 連線正常' : 'Telegram 需要修復',
      `Bot：${bot.username ? '@' + bot.username : '未識別'}`,
      `Webhook：${actual || '尚未設定'}`,
      `待處理更新：${Number(webhook.pendingUpdateCount || 0)}`
    ];
    if (webhook.lastErrorMessage) lines.push(`最後錯誤：${webhook.lastErrorMessage}`);
    target.textContent = lines.join('\n');
  }

  async function check() {
    const result = await api('/api/admin/telegram-status');
    render(result);
    return result;
  }

  async function repair() {
    if (!confirm('要重新同步 SecretRoom Telegram Webhook 嗎？')) return;
    await api('/api/admin/telegram-repair-webhook');
    window.showToast?.('Telegram Webhook 已重新同步', 'success');
    return check();
  }

  function bind(button, pendingText, action) {
    button.onclick = async () => {
      const original = button.textContent;
      button.disabled = true;
      button.textContent = pendingText;
      try {
        await action();
      } catch (error) {
        const target = byId('sr-telegram-repair-status');
        if (target) {
          target.className = 'mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-200 whitespace-pre-wrap break-all';
          target.textContent = error.message || String(error);
        }
        window.showToast?.(error.message || String(error), 'error');
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    };
  }

  function install() {
    const main = byId('admin-main');
    if (!main || byId('sr-telegram-repair-panel')) return;

    const panel = document.createElement('section');
    panel.id = 'sr-telegram-repair-panel';
    panel.className = 'mb-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4';
    panel.innerHTML = `
      <div class="text-xs font-black text-cyan-100">Telegram Webhook 管理</div>
      <div class="mt-1 text-xs text-slate-400">檢查 Bot 連線，並使用 Worker 目前的安全設定重新同步 Webhook。</div>
      <div class="mt-3 flex flex-wrap gap-2">
        <button id="sr-telegram-check-button" class="px-3 py-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-200 text-xs font-bold">檢查 Telegram</button>
        <button id="sr-telegram-repair-button" class="px-3 py-2 rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-200 text-xs font-bold">修復 Webhook</button>
      </div>
      <pre id="sr-telegram-repair-status" class="mt-3 rounded-xl border border-slate-700 bg-slate-950/40 p-3 text-xs text-slate-300 whitespace-pre-wrap break-all">尚未檢查</pre>
    `;

    main.insertBefore(panel, main.children[1] || null);
    bind(byId('sr-telegram-check-button'), '檢查中…', check);
    bind(byId('sr-telegram-repair-button'), '修復中…', repair);
    setTimeout(() => check().catch(() => {}), 600);
  }

  const observer = new MutationObserver(install);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', install, { once: true });
  install();

  window.SRTelegramRepair = Object.freeze({ check, repair });
})();
