from pathlib import Path
import re

app_path = Path('app.js')
index_path = Path('index.html')
app = app_path.read_text(encoding='utf-8')
index = index_path.read_text(encoding='utf-8')

start = app.find('  function ensureProfileNotificationAction() {')
end = app.find('  function ensureCard(snapshot = lastSnapshot) {', start)
if start < 0 or end < 0:
    raise SystemExit('Profile Telegram action function was not found')

replacement = '''  function ensureProfileNotificationAction() {
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

    const actionHost = edit.parentElement;
    if (!actionHost) return;

    let grid = document.getElementById('sr-profile-action-grid');
    if (!grid) {
      grid = document.createElement('div');
      grid.id = 'sr-profile-action-grid';
      actionHost.insertBefore(grid, edit);
    }
    grid.className = 'grid grid-cols-2 gap-3 w-full mt-4';
    grid.style.width = '100%';
    grid.style.maxWidth = 'none';

    const normalizeActionButton = button => {
      button.classList.remove('min-h-[64px]', 'col-span-2', 'sm:col-span-2', 'md:col-span-2');
      button.classList.add('w-full');
      button.style.gridColumn = '';
      button.style.width = '100%';
      button.style.minHeight = '';
    };

    [edit, exportButton, deleteButton].forEach(button => {
      if (button.parentElement !== grid) grid.appendChild(button);
      normalizeActionButton(button);
    });

    let notificationButton = document.getElementById('sr-profile-telegram-action');
    if (!notificationButton) {
      notificationButton = document.createElement('button');
      notificationButton.id = 'sr-profile-telegram-action';
      notificationButton.type = 'button';
      notificationButton.dataset.srTgOpen = '1';
    }

    notificationButton.className = edit.className;
    notificationButton.classList.remove('col-span-2', 'sm:col-span-2', 'md:col-span-2');
    notificationButton.classList.add('w-full');
    notificationButton.style.gridColumn = '';
    notificationButton.style.width = '100%';
    notificationButton.style.minHeight = '';
    notificationButton.innerHTML = '<i class="fa-brands fa-telegram mr-2 text-sm"></i><span>通知設定</span>';

    [edit, notificationButton, exportButton, deleteButton].forEach(button => {
      if (button.parentElement !== grid) grid.appendChild(button);
      else grid.appendChild(button);
    });
  }

'''
app = app[:start] + replacement + app[end:]

old_close = 'class="absolute top-3 right-3 w-10 h-10 rounded-full border border-slate-600/60 bg-slate-950/55 text-slate-300 hover:text-white hover:border-cyan-400/50"'
new_close = 'class="absolute top-3 right-3 z-20 w-10 h-10 rounded-full border border-slate-600/60 bg-slate-950/55 text-slate-300 hover:text-white hover:border-cyan-400/50"'
if old_close not in app:
    raise SystemExit('Telegram close button class was not found')
app = app.replace(old_close, new_close, 1)

old_action = 'id="sr-tg-open-settings" data-sr-tg-open="1" class="sr-tg-card-button"'
new_action = 'id="sr-tg-open-settings" data-sr-tg-open="1" class="sr-tg-card-button shrink-0" style="margin-right:3.75rem"'
if old_action not in app:
    raise SystemExit('Telegram card action button was not found')
app = app.replace(old_action, new_action, 1)

old_version = 'app.js?v=20260717-profile-telegram-layout-v1'
new_version = 'app.js?v=20260717-profile-telegram-layout-v2'
if old_version not in index:
    raise SystemExit('Expected app cache version was not found')
index = index.replace(old_version, new_version, 1)

app_path.write_text(app, encoding='utf-8')
index_path.write_text(index, encoding='utf-8')
