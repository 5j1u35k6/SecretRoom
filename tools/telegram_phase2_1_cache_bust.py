from pathlib import Path

# Phase 2.1 cache version ensures browsers fetch the repaired app runtime.
path = Path('index.html')
text = path.read_text(encoding='utf-8')
old = 'app.js?v=20260716-telegram-phase2-v1'
new = 'app.js?v=20260716-telegram-phase2-1-v1'
if new not in text:
    if old not in text:
        raise SystemExit('Expected app.js cache version not found')
    text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
