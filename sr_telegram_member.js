/* SecretRoom Telegram 會員服務模組 */
;(() => {
  const API_BASE = 'https://REPLACE_WITH_YOUR_WORKER.workers.dev';
  const state = { open: false };

  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  }

  async function post(path, body) {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) throw new Error(result.error || '服務暫時無法使用');
    return result;
  }

  function toast(message, type = 'info') {
    if (typeof window.showToast === 'function') return window.showToast(message, type);
    alert(message);
  }

  function ensureUi() {
    if (document.getElementById('sr-telegram-service-button')) return;
    const button = document.createElement('button');
    button.id = 'sr-telegram-service-button';
    button.type = 'button';
    button.className = 'fixed bottom-5 right-5 z-[98] px-4 py-3 rounded-full bg-[#229ED9] text-white font-bold text-sm shadow-2xl border border-white/20';
    button.innerHTML = '<i class="fa-brands fa-telegram mr-2"></i>Telegram 會員服務';
    button.onclick = openPanel;
    document.body.appendChild(button);

    const modal = document.createElement('div');
    modal.id = 'sr-telegram-service-modal';
    modal.className = 'fixed inset-0 z-[120] hidden bg-black/85 backdrop-blur-md p-4 items-center justify-center';
    modal.innerHTML = `
      <div class="w-full max-w-md rounded-3xl border border-sky-500/20 bg-[#080b12] p-6 shadow-2xl">
        <div class="flex items-start justify-between gap-3 mb-5">
          <div><h2 class="text-xl font-black text-white"><i class="fa-brands fa-telegram text-sky-400 mr-2"></i>Telegram 會員服務</h2><p class="text-xs text-slate-400 mt-1">平台通知與 Telegram 外部提醒分開管理。</p></div>
          <button id="sr-tg-close" class="text-slate-400 text-xl">×</button>
        </div>
        <div class="grid gap-3">
          <button data-sr-tg-view="binding" class="sr-tg-action">🔗 綁定帳號</button>
          <button data-sr-tg-view="password" class="sr-tg-action">🔐 忘記密碼申請</button>
          <a href="https://t.me/SecretRoomtwBot" target="_blank" rel="noopener" class="sr-tg-action text-center">🤖 開啟 SecretRoom Bot</a>
        </div>
        <div id="sr-tg-content" class="mt-5"></div>
      </div>`;
    document.body.appendChild(modal);

    const style = document.createElement('style');
    style.textContent = '.sr-tg-action{display:block;width:100%;padding:13px 16px;border-radius:14px;background:#111827;border:1px solid rgba(56,189,248,.18);color:#e5e7eb;font-weight:800;text-align:left}.sr-tg-action:hover{background:#172033}.sr-tg-input{width:100%;padding:12px 14px;border-radius:12px;background:#0f172a;border:1px solid #334155;color:white}.sr-tg-primary{width:100%;padding:12px 14px;border-radius:12px;background:#229ED9;color:white;font-weight:900}';
    document.head.appendChild(style);

    document.getElementById('sr-tg-close').onclick = closePanel;
    modal.addEventListener('click', event => { if (event.target === modal) closePanel(); });
    modal.querySelectorAll('[data-sr-tg-view]').forEach(item => item.onclick = () => renderView(item.dataset.srTgView));
  }

  function openPanel() {
    ensureUi();
    const modal = document.getElementById('sr-telegram-service-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    state.open = true;
  }

  function closePanel() {
    const modal = document.getElementById('sr-telegram-service-modal');
    modal?.classList.add('hidden');
    modal?.classList.remove('flex');
    state.open = false;
  }

  function renderView(view) {
    const box = document.getElementById('sr-tg-content');
    if (!box) return;
    if (view === 'binding') {
      box.innerHTML = `
        <div class="space-y-3"><div class="text-sm font-black text-white">綁定 SecretRoom 帳號</div>
        <p class="text-xs text-slate-400 leading-relaxed">請在平台驗證帳號密碼後產生一次性 Telegram 連結。Bot 不會要求你在聊天中輸入平台密碼。</p>
        <input id="sr-tg-bind-id" class="sr-tg-input" placeholder="SecretRoom 帳號">
        <input id="sr-tg-bind-password" type="password" class="sr-tg-input" placeholder="平台密碼">
        <button id="sr-tg-bind-submit" class="sr-tg-primary">產生一次性綁定連結</button></div>`;
      document.getElementById('sr-tg-bind-submit').onclick = startBinding;
      return;
    }
    box.innerHTML = `
      <div class="space-y-3"><div class="text-sm font-black text-white">忘記密碼申請</div>
      <p class="text-xs text-slate-400 leading-relaxed">必須先在平台建立申請，再回 Telegram Bot 完成。管理員不需要手動產生密碼。</p>
      <input id="sr-tg-reset-id" class="sr-tg-input" placeholder="SecretRoom 帳號">
      <button id="sr-tg-reset-submit" class="sr-tg-primary">建立 Telegram 密碼救援申請</button></div>`;
    document.getElementById('sr-tg-reset-submit').onclick = startPasswordReset;
  }

  async function startBinding() {
    const button = document.getElementById('sr-tg-bind-submit');
    const userId = document.getElementById('sr-tg-bind-id')?.value.trim();
    const password = document.getElementById('sr-tg-bind-password')?.value || '';
    if (!userId || !password) return toast('請輸入帳號與密碼', 'error');
    button.disabled = true; button.textContent = '建立安全連結中...';
    try {
      const result = await post('/api/member/binding/start', { userId, password });
      location.href = result.deepLink;
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      button.disabled = false; button.textContent = '產生一次性綁定連結';
    }
  }

  async function startPasswordReset() {
    const button = document.getElementById('sr-tg-reset-submit');
    const userId = document.getElementById('sr-tg-reset-id')?.value.trim();
    if (!userId) return toast('請輸入會員帳號', 'error');
    button.disabled = true; button.textContent = '建立申請中...';
    try {
      const result = await post('/api/member/password-reset/request', { userId });
      toast(result.message, 'success');
      setTimeout(() => { location.href = 'https://t.me/SecretRoomtwBot'; }, 1000);
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      button.disabled = false; button.textContent = '建立 Telegram 密碼救援申請';
    }
  }

  window.SecretRoomTelegram = Object.freeze({ open: openPanel, close: closePanel });
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', ensureUi) : ensureUi();
})();
