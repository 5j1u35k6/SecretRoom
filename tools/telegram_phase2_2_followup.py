from pathlib import Path

path = Path('app.js')
text = path.read_text(encoding='utf-8')
text = text.replace(
    "if (!snapshot?.binding || snapshot.binding.status !== 'active') return;",
    "if (!hasActiveBinding(snapshot)) return;"
)
text = text.replace(
    "if (window.state?.currentView === 'telegram-bind' && snapshot?.binding?.status === 'active') {",
    "if (window.state?.currentView === 'telegram-bind' && hasActiveBinding(snapshot)) {"
)
text = text.replace(
    "snapshot?.binding?.telegramUsername || snapshot?.member?.telegramUsername || '已驗證帳號'",
    "snapshot?.binding?.telegramUsername || '已驗證帳號'"
)
path.write_text(text, encoding='utf-8')
