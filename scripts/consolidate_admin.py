from pathlib import Path
import re
import subprocess

BUILD = '20260717-platform-consolidated-v2'
read = lambda p: Path(p).read_text(encoding='utf-8').replace('\r\n', '\n')
core = read('admin.js')
config = read('sr_backend_config.js').strip()
bridge = read('sr_emailjs_telegram_bridge.js').strip()
claim = read('sr_admin_claim_bridge.js').strip()
auth = read('sr_admin_auth.js').strip()
telegram = read('sr_telegram_admin.js').strip()
shell = read('portal_shell.js')

email_config = '''const emailjsConfig = {
  publicKey: "telegram-bridge",
  serviceId: "telegram-backend",
  defaultTemplateId: "telegram-notification",
  templates: {
    registrationApproved: "telegram-notification", registrationRejected: "telegram-notification",
    specApproved: "telegram-notification", specRejected: "telegram-notification",
    avatarApproved: "telegram-notification", avatarRejected: "telegram-notification",
    reportAccepted: "telegram-notification", reportDismissed: "telegram-notification",
    passwordReset: "telegram-security", accountRequest: "telegram-security"
  }
};'''
core, n = re.subn(r'const emailjsConfig\s*=\s*\{[\s\S]*?\n\};', email_config, core, count=1)
if n != 1: raise SystemExit('admin email config mismatch')
core, n = re.subn(r"const MAIL\s*=\s*\{[^;]+\};", "const MAIL = { publicKey: 'telegram-bridge', serviceId: 'telegram-backend', templateId: 'telegram-security' };", core, count=1)
if n != 1: raise SystemExit('admin MAIL mismatch')
core = core.replace('const userData = docSnap.data();', 'const userData = { id: docSnap.id, userId: docSnap.id, ...docSnap.data() };')
core = core.replace('const data = docSnap.data();', 'const data = { id: docSnap.id, userId: docSnap.id, ...docSnap.data() };')

before = """        async function verifyAdminSession(adminId, password) {
            const adminRef = doc(db, 'secretg_apps', appId, 'admins', adminId);"""
after = """        async function verifyAdminSession(adminId, password) {
            const secureAdmin = await window.SRAdminClaimBridge?.verify(adminId);
            if (secureAdmin) {
                currentAdminId = adminId;
                currentAdminSource = 'firebase-custom-token';
                return secureAdmin;
            }
            const adminRef = doc(db, 'secretg_apps', appId, 'admins', adminId);"""
if before in core: core = core.replace(before, after, 1)
elif 'SRAdminClaimBridge?.verify' not in core: raise SystemExit('admin claim hook mismatch')

wrapped = lambda name, source: f"\n/* ===== {name} ===== */\n;(() => {{\n{source}\n}})();\n"
prelude = f'''/* SecretRoom consolidated admin runtime. */
;(() => {{
{config}
}})();
{bridge}
'''
Path('admin.js').write_text(prelude + core.rstrip() + wrapped('Admin Firebase claim bridge', claim) + wrapped('Secure admin authentication', auth) + wrapped('Telegram admin service', telegram), encoding='utf-8')

runner = Path('/tmp/render_portal_shell.cjs')
runner.write_text("global.document={body:{innerHTML:''}};\n" + shell + "\nprocess.stdout.write(document.body.innerHTML);", encoding='utf-8')
rendered = subprocess.run(['node', str(runner)], check=True, capture_output=True, text=True).stdout.strip()
if 'admin-login-modal' not in rendered or '${' in rendered: raise SystemExit('portal render mismatch')
html = f'''<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="Cache-Control" content="no-cache,no-store,must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <title>SecretRoom | 管理後台</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link rel="stylesheet" href="admin.css?v={BUILD}">
</head>
<body class="min-h-screen bg-[#020204] p-4 md:p-8">
{rendered}
<script type="module" src="admin.js?v={BUILD}"></script>
</body>
</html>
'''
Path('portal_sr_x892.html').write_text(html, encoding='utf-8')

for name in ['admin_bootstrap.js','admin_bootstrap_v3.js','portal_shell.js','sr_admin_auth.js','sr_admin_claim_bridge.js','sr_emailjs_telegram_bridge.js','sr_telegram_admin.js']:
    p = Path(name)
    if p.exists(): p.unlink()
