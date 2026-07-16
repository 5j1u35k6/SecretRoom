from pathlib import Path

path = Path('app.js')
text = path.read_text(encoding='utf-8')

text = text.replace("  let busy = false;\n", "  let busy = false;\n  let modalRequestId = 0;\n")

old = """  async function openModal() {
    try { renderModal(await loadSnapshot(true)); }
    catch (error) { console.error(error); toast('無法讀取 Telegram 設定', 'error'); }
  }
"""
new = """  function modalElement() {
    let modal = document.getElementById('sr-telegram-phase2-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'sr-telegram-phase2-modal';
      modal.className = 'fixed inset-0 z-[260] hidden items-center justify-center bg-black/90 backdrop-blur-md p-4';
      document.body.appendChild(modal);
    }
    return modal;
  }

  function showModalState(title, message, retry = false) {
    const modal = modalElement();
    modal.innerHTML = `<div class="sr-tg-modal-card"><div class="flex items-start justify-between gap-4"><div><div class="sr-tg-eyebrow"><i class="fa-brands fa-telegram"></i> Telegram 會員服務</div><h2 class="text-xl font-black text-white mt-1">${esc(title)}</h2></div><button id="sr-tg-close" class="sr-tg-icon-button" aria-label="關閉"><i class="fa-solid fa-xmark"></i></button></div><div class="sr-tg-status sr-tg-unbound"><strong>${esc(message)}</strong><span>${retry ? '請確認網路與 Firestore 權限後重試。' : '正在同步綁定狀態與通知偏好。'}</span></div>${retry ? '<button id="sr-tg-retry-open" class="sr-tg-primary-button">重新載入</button>' : ''}</div>`;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    const close = () => { modalRequestId += 1; modal.classList.add('hidden'); modal.classList.remove('flex'); };
    modal.querySelector('#sr-tg-close')?.addEventListener('click', close);
    modal.querySelector('#sr-tg-retry-open')?.addEventListener('click', openModal);
    modal.onclick = event => { if (event.target === modal) close(); };
  }

  async function openModal() {
    const requestId = ++modalRequestId;
    showModalState('帳號綁定與通知', '正在載入 Telegram 設定…');
    try {
      const snapshot = await Promise.race([
        loadSnapshot(true),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Telegram 設定讀取逾時')), 10000))
      ]);
      if (requestId !== modalRequestId) return;
      renderModal(snapshot);
    } catch (error) {
      if (requestId !== modalRequestId) return;
      console.error('Telegram 設定載入失敗:', error);
      showModalState('無法載入 Telegram 設定', error?.message || '請稍後重試', true);
      toast('無法讀取 Telegram 設定', 'error');
    }
  }
"""
if old not in text:
    raise SystemExit('openModal block not found')
text = text.replace(old, new, 1)

text = text.replace(
    "      anchor.innerHTML = `<button id=\"sr-tg-open-bind-modal\" class=\"sr-tg-primary-button\"><i class=\"fa-brands fa-telegram\"></i> 產生一次性 Telegram 綁定連結</button>`;\n      anchor.querySelector('#sr-tg-open-bind-modal').onclick = openModal;\n",
    "      anchor.innerHTML = `<button id=\"sr-tg-open-bind-modal\" data-sr-tg-open=\"1\" class=\"sr-tg-primary-button\"><i class=\"fa-brands fa-telegram\"></i> 產生一次性 Telegram 綁定連結</button>`;\n"
)

old_card = """    card.innerHTML = `<div><div class="sr-tg-eyebrow"><i class="fa-brands fa-telegram"></i> Telegram</div><div class="text-sm font-black text-white mt-1">${bound ? '通知服務已綁定' : (view === 'pending' ? '先綁定以接收審核結果' : '完成帳號綁定')}</div><div class="text-xs text-slate-400 mt-1">${bound ? '可接收審核、安全與帳號狀態通知。' : '使用 10 分鐘一次性連結安全綁定。'}</div></div><button id="sr-tg-open-settings" class="sr-tg-card-button">${bound ? '通知設定' : '立即綁定'}</button>`;
    card.querySelector('#sr-tg-open-settings').onclick = openModal;
"""
new_card = """    const signature = `${id}|${view}|${bound ? 'bound' : 'unbound'}`;
    if (card.dataset.srTgSignature === signature) return;
    card.dataset.srTgSignature = signature;
    card.innerHTML = `<div><div class="sr-tg-eyebrow"><i class="fa-brands fa-telegram"></i> Telegram</div><div class="text-sm font-black text-white mt-1">${bound ? '通知服務已綁定' : (view === 'pending' ? '先綁定以接收審核結果' : '完成帳號綁定')}</div><div class="text-xs text-slate-400 mt-1">${bound ? '可接收審核、安全與帳號狀態通知。' : '使用 10 分鐘一次性連結安全綁定。'}</div></div><button id="sr-tg-open-settings" data-sr-tg-open="1" class="sr-tg-card-button">${bound ? '通知設定' : '立即綁定'}</button>`;
"""
if old_card not in text:
    raise SystemExit('Telegram member card block not found')
text = text.replace(old_card, new_card, 1)

marker = "  window.SRTelegramPhase2 = Object.freeze({ open: openModal, createLink: generateBindingLink, unbind: unbindTelegram, refresh: () => loadSnapshot(true), queueSecurityNotification });\n"
delegated = """  document.addEventListener('click', event => {
    const trigger = event.target?.closest?.('[data-sr-tg-open],#sr-tg-open-settings,#sr-tg-open-bind-modal');
    if (!trigger) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openModal();
  }, true);

"""
if marker not in text:
    raise SystemExit('Telegram export marker not found')
text = text.replace(marker, delegated + marker, 1)

path.write_text(text, encoding='utf-8')
