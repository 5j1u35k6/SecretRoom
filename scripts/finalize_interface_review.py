from pathlib import Path

path = Path('app.js')
text = path.read_text(encoding='utf-8').replace('\r\n', '\n')

text = text.replace(
    "if (icon) icon.className = `fa-solid ${isMuted ? 'fa-volume-xmark' : 'fa-play'} text-[9px]`;",
    "if (icon) icon.className = `fa-solid ${isMuted ? 'fa-volume-xmark' : 'fa-play'} text-sm`;",
    1,
)

old_entry = '''    if (!id || (!isHome && !isPending) || (isHome && localStorage.getItem(TELEGRAM_HOME_DISMISS_KEY) === '1')) {
      existing?.remove();
      return;
    }

    const host = isHome'''
new_entry = '''    if (!id || (!isHome && !isPending) || (isHome && localStorage.getItem(TELEGRAM_HOME_DISMISS_KEY) === '1')) {
      existing?.remove();
      return;
    }

    const bound = hasActiveBinding(snapshot);
    if (bound && isHome) {
      existing?.remove();
      return;
    }

    const host = isHome'''
if old_entry not in text:
    raise SystemExit('Unable to move Telegram home-card guard before DOM creation')
text = text.replace(old_entry, new_entry, 1)

old_late = '''    const bound = hasActiveBinding(snapshot);
    if (bound && isHome) {
      card.remove();
      return;
    }
    const serviceState = telegramServiceState(snapshot);'''
if old_late not in text:
    raise SystemExit('Late Telegram home-card guard was not found')
text = text.replace(old_late, "    const serviceState = telegramServiceState(snapshot);", 1)

old_close = '''  function closeDialog(dialog) {
    const close = dialog.querySelector('#confirm-modal-cancel,[data-modal-close],[aria-label*="關閉"],button[id*="close"],button[onclick*="close"]');
    close?.click();
    requestAnimationFrame(() => previousFocus?.focus?.({ preventScroll: true }));
  }'''
new_close = '''  function closeDialog(dialog) {
    const close = dialog.querySelector('#confirm-modal-cancel,[data-modal-close],[aria-label*="關閉"],button[id*="close"],button[onclick*="close"]');
    if (close) close.click();
    else dialog.click();
    requestAnimationFrame(() => previousFocus?.focus?.({ preventScroll: true }));
  }'''
if old_close not in text:
    raise SystemExit('Dialog close handler was not found')
text = text.replace(old_close, new_close, 1)

card_start = text.index('  function ensureCard(snapshot = lastSnapshot)')
card_end = text.index('  function wrapPasswordSecurityMail()', card_start)
card = text[card_start:card_end]
if card.count('if (bound && isHome)') != 1:
    raise SystemExit('Telegram home-card guard count is invalid')
if card.index('if (bound && isHome)') > card.index('let card = existing'):
    raise SystemExit('Telegram home-card guard still runs after card creation')
if 'card.remove();\n      return;' in card:
    raise SystemExit('Telegram home-card guard still removes a newly created card')

path.write_text(text, encoding='utf-8')
print('Interface interaction fixes finalized')
