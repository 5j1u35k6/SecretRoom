from pathlib import Path

path = Path('app.js')
text = path.read_text(encoding='utf-8')

old = """  function ensureCard(snapshot = lastSnapshot) {
    const id = accountId();
    const existing = document.getElementById('sr-telegram-member-card');
    const view = String(window.state?.currentView || '');
    if (!id || !['dashboard', 'pending'].includes(view)) { existing?.remove(); return; }
    const host = view === 'dashboard'
      ? (document.getElementById('dashboard-tab-content') || document.querySelector('#app .overflow-y-auto'))
      : (document.querySelector('#app .overflow-y-auto') || document.querySelector('#app > div'));
    if (!host) return;
    let card = existing;
    if (!card) {
      card = document.createElement('section');
      card.id = 'sr-telegram-member-card';
      card.className = 'sr-tg-member-card';
      host.prepend(card);
    }
    const bound = hasActiveBinding(snapshot);
    const serviceState = telegramServiceState(snapshot);
    const identityVerified = serviceState === 'identity_verified';
    const signature = `${id}|${view}|${serviceState}`;
    if (card.dataset.srTgSignature === signature) return;
    card.dataset.srTgSignature = signature;
    card.innerHTML = `<div><div class="sr-tg-eyebrow"><i class="fa-brands fa-telegram"></i> Telegram</div><div class="text-sm font-black text-white mt-1">${bound ? 'Telegram 通知已啟用' : (identityVerified ? 'Telegram 身分已驗證' : '尚未綁定 Telegram')}</div><div class="text-xs text-slate-400 mt-1">${bound ? '可接收審核、安全與帳號狀態通知。' : (identityVerified ? '只需開啟 Bot 一次即可啟用通知，不必重新驗證身分。' : '綁定 Telegram 身分並啟用 Bot 通知。')}</div></div><button id="sr-tg-open-settings" data-sr-tg-open="1" class="sr-tg-card-button">${bound ? '通知設定' : (identityVerified ? '啟用通知' : '立即綁定')}</button>`;
  }
"""

new = """  const TELEGRAM_HOME_DISMISS_KEY = 'sr_telegram_home_card_dismissed';

  function ensureProfileNotificationAction() {
    const root = String(window.state?.currentTab || '') === 'profile'
      ? document.getElementById('dashboard-tab-content')
      : null;
    const existingAction = document.getElementById('sr-profile-telegram-action');
    if (!root) { existingAction?.remove(); return; }

    const buttons = [...root.querySelectorAll('button')];
    const edit = buttons.find(button => /修改個人資料/.test(button.textContent || ''));
    const exportButton = buttons.find(button => /匯出個人資料/.test(button.textContent || ''));
    const deleteButton = buttons.find(button => /申請刪除帳號/.test(button.textContent || ''));
    if (!edit || !exportButton || !deleteButton) return;

    let grid = document.getElementById('sr-profile-action-grid');
    if (!grid) {
      grid = document.createElement('div');
      grid.id = 'sr-profile-action-grid';
      grid.className = 'grid grid-cols-2 gap-3 mt-4';
      edit.parentElement?.insertBefore(grid, edit);
    }

    [edit, exportButton, deleteButton].forEach(button => {
      if (button.parentElement !== grid) grid.appendChild(button);
      button.style.gridColumn = 'auto';
      button.style.width = '100%';
      button.classList.add('min-h-[64px]');
    });

    let notificationButton = document.getElementById('sr-profile-telegram-action');
    if (!notificationButton) {
      notificationButton = document.createElement('button');
      notificationButton.id = 'sr-profile-telegram-action';
      notificationButton.type = 'button';
      notificationButton.dataset.srTgOpen = '1';
      notificationButton.className = 'min-h-[64px] w-full rounded-2xl border border-cyan-500/25 bg-cyan-500/10 text-cyan-200 font-black transition hover:bg-cyan-500/15';
      notificationButton.innerHTML = '<i class="fa-brands fa-telegram mr-2"></i>通知設定';
      grid.insertBefore(notificationButton, exportButton);
    }
  }

  function ensureCard(snapshot = lastSnapshot) {
    const id = accountId();
    const existing = document.getElementById('sr-telegram-member-card');
    const view = String(window.state?.currentView || '');
    const tab = String(window.state?.currentTab || '');

    ensureProfileNotificationAction();

    const isHome = view === 'dashboard' && tab === 'feed';
    const isPending = view === 'pending';
    if (!id || (!isHome && !isPending) || (isHome && localStorage.getItem(TELEGRAM_HOME_DISMISS_KEY) === '1')) {
      existing?.remove();
      return;
    }

    const host = isHome
      ? (document.getElementById('dashboard-tab-content') || document.querySelector('#app .overflow-y-auto'))
      : (document.querySelector('#app .overflow-y-auto') || document.querySelector('#app > div'));
    if (!host) return;
    let card = existing;
    if (!card) {
      card = document.createElement('section');
      card.id = 'sr-telegram-member-card';
      card.className = 'sr-tg-member-card relative';
      host.prepend(card);
    }
    const bound = hasActiveBinding(snapshot);
    const serviceState = telegramServiceState(snapshot);
    const identityVerified = serviceState === 'identity_verified';
    const signature = `${id}|${view}|${tab}|${serviceState}`;
    if (card.dataset.srTgSignature === signature) return;
    card.dataset.srTgSignature = signature;
    card.innerHTML = `<button type="button" id="sr-tg-dismiss-home-card" class="absolute top-3 right-3 w-10 h-10 rounded-full border border-slate-600/60 bg-slate-950/55 text-slate-300 hover:text-white hover:border-cyan-400/50" aria-label="關閉 Telegram 區塊"><i class="fa-solid fa-xmark"></i></button><div class="pr-12"><div class="sr-tg-eyebrow"><i class="fa-brands fa-telegram"></i> Telegram</div><div class="text-sm font-black text-white mt-1">${bound ? 'Telegram 通知已啟用' : (identityVerified ? 'Telegram 身分已驗證' : '尚未綁定 Telegram')}</div><div class="text-xs text-slate-400 mt-1">${bound ? '可接收審核、安全與帳號狀態通知。' : (identityVerified ? '只需開啟 Bot 一次即可啟用通知，不必重新驗證身分。' : '綁定 Telegram 身分並啟用 Bot 通知。')}</div></div><button id="sr-tg-open-settings" data-sr-tg-open="1" class="sr-tg-card-button">${bound ? '通知設定' : (identityVerified ? '啟用通知' : '立即綁定')}</button>`;
    card.querySelector('#sr-tg-dismiss-home-card')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      localStorage.setItem(TELEGRAM_HOME_DISMISS_KEY, '1');
      card.remove();
    });
  }
"""

if old not in text:
    raise SystemExit('Telegram ensureCard block not found')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
