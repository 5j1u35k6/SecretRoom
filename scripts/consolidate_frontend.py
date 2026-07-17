from pathlib import Path
import re

BUILD = '20260717-platform-consolidated-v2'
read = lambda p: Path(p).read_text(encoding='utf-8').replace('\r\n', '\n')
core = read('app.js')
config = read('sr_backend_config.js').strip()
auth = read('sr_auth_migration.js').strip()
telegram = read('sr_telegram_platform.js').strip()

core, n = re.subn(r'const emailjsConfig\s*=\s*\{[\s\S]*?\n\};', 'const emailjsConfig = { publicKey: "", serviceId: "", defaultTemplateId: "", templates: {} };', core, count=1)
if n != 1: raise SystemExit('email config mismatch')
if "secretroom-public-runtime" not in core:
    core = core.replace('app = initializeApp(firebaseConfig || {});', "app = initializeApp(firebaseConfig || {}, 'secretroom-public-runtime');", 1)
core, n = re.subn(r'await\s+signInAnonymously\(auth\);', 'await window.SecretRoomPublicAuth.ensure(auth, signInAnonymously);', core)
if n == 0 and 'SecretRoomPublicAuth.ensure' not in core: raise SystemExit('anonymous auth mismatch')
if '會員資料載入逾時' not in core:
    core = core.replace('const docSnap = await getDoc(appRef);', "const docSnap = await withTimeout(getDoc(appRef), 12000, '會員資料載入逾時，請重新整理頁面。');", 1)
core = core.replace("showToast('伺服器連線異常，請稍後重試。', 'error');", "showToast(error?.message || '伺服器連線異常，請稍後重試。', 'error'); hideLoading(); navigate('landing');")
pattern = re.compile(r"window\.onload\s*=\s*function\(\)\s*\{\s*initApp\(\);\s*if\s*\(typeof\s+initBGMController\s*===\s*'function'\)\s*\{\s*initBGMController\(\);\s*\}\s*\};")
startup = """const startSecretRoomApp = () => {
  if (window.__SR_PUBLIC_APP_STARTED__) return;
  window.__SR_PUBLIC_APP_STARTED__ = true;
  initApp();
  if (typeof initBGMController === 'function') initBGMController();
};
if (document.readyState === 'loading') window.addEventListener('load', startSecretRoomApp, { once: true });
else queueMicrotask(startSecretRoomApp);"""
if pattern.search(core): core = pattern.sub(startup, core, count=1)
elif 'startSecretRoomApp' not in core: raise SystemExit('startup mismatch')
for old, new in [("localStorage.removeItem('sr_username');", "localStorage.removeItem('sr_username'); window.SRSecureAuth?.signOutMember?.();"), ('localStorage.removeItem("sr_username");', 'localStorage.removeItem("sr_username"); window.SRSecureAuth?.signOutMember?.();')]:
    if new not in core: core = core.replace(old, new)

prelude = f'''/* SecretRoom consolidated frontend runtime. */
;(() => {{
{config}
  const deadline = (promise, ms, message) => Promise.race([Promise.resolve(promise), new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))]);
  window.SecretRoomPublicAuth = Object.freeze({{ async ensure(auth, signInAnonymously) {{
    if (typeof auth.authStateReady === 'function') await deadline(auth.authStateReady(), 8000, '公開連線初始化逾時');
    if (auth.currentUser?.isAnonymous) return auth.currentUser;
    return (await deadline(signInAnonymously(auth), 12000, '公開連線建立逾時')).user;
  }} }});
  window.emailjs = Object.freeze({{ init() {{}}, async send() {{ return {{ status: 202, text: 'telegram_migration' }}; }} }});
}})();
'''
wrapped = lambda name, source: f"\n/* ===== {name} ===== */\n;(() => {{\n{source}\n}})();\n"
Path('app.js').write_text(prelude + core.rstrip() + wrapped('Secure member authentication', auth) + wrapped('Telegram member service', telegram), encoding='utf-8')

html = read('index.html')
html = re.sub(r'\n?<script src="sr_backend_config\.js[^>]*></script>\n?', '\n', html)
html, n = re.subn(r'\n?<script>\s*\(async \(\) => \{[\s\S]*?\}\)\(\);\s*</script>\n?', f'\n<script type="module" src="app.js?v={BUILD}"></script>\n', html, count=1)
if n != 1: raise SystemExit('index bootstrap mismatch')
html = re.sub(r'style\.css\?v=[^"\']+', f'style.css?v={BUILD}', html)
Path('index.html').write_text(html.rstrip() + '\n', encoding='utf-8')

for name in ['app_bootstrap.js','app_bootstrap_v10.js','sr_backend_config.js','sr_auth_migration.js','sr_telegram_platform.js','site-version.json']:
    p = Path(name)
    if p.exists(): p.unlink()
