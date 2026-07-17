from pathlib import Path

path = Path('app.js')
text = path.read_text(encoding='utf-8').replace('\r\n', '\n')

bad = '''    const bound = hasActiveBinding(snapshot);
    if (bound && isHome) {
      card.remove();
      return;
    }
    const serviceState = telegramServiceState(snapshot);'''
correct_plain = '''    const bound = hasActiveBinding(snapshot);
    const serviceState = telegramServiceState(snapshot);'''
if bad not in text:
    raise SystemExit('Misplaced Telegram deduplication block was not found')
text = text.replace(bad, correct_plain, 1)

anchor = '''    const bound = hasActiveBinding(snapshot);
    const serviceState = telegramServiceState(snapshot);
    const identityVerified = serviceState === 'identity_verified';
    const signature = `${id}|${view}|${tab}|${serviceState}`;'''
replacement = '''    const bound = hasActiveBinding(snapshot);
    if (bound && isHome) {
      card.remove();
      return;
    }
    const serviceState = telegramServiceState(snapshot);
    const identityVerified = serviceState === 'identity_verified';
    const signature = `${id}|${view}|${tab}|${serviceState}`;'''
if anchor not in text:
    raise SystemExit('Telegram home card insertion point was not found')
text = text.replace(anchor, replacement, 1)

if text.count('if (bound && isHome)') != 1:
    raise SystemExit('Telegram deduplication block count is invalid')
modal_start = text.index('  function renderModal(snapshot)')
modal_end = text.index('  function modalElement()', modal_start)
if 'bound && isHome' in text[modal_start:modal_end]:
    raise SystemExit('Telegram deduplication remains inside renderModal')
card_start = text.index('  function ensureCard(snapshot = lastSnapshot)')
card_end = text.index('  function wrapPasswordSecurityMail()', card_start)
if 'bound && isHome' not in text[card_start:card_end]:
    raise SystemExit('Telegram deduplication is not inside ensureCard')

path.write_text(text, encoding='utf-8')
print('Telegram deduplication placement fixed')
