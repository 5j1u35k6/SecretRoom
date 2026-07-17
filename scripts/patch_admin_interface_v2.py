from pathlib import Path

BUILD='20260717-conversation-ui-v2'
def read(p): return Path(p).read_text(encoding='utf-8').replace('\r\n','\n')
def rep(t,a,b,n):
    if a not in t: raise SystemExit('Missing '+n)
    return t.replace(a,b,1)

portal=read('portal_sr_x892.html')
old='''<div id="admin-login-modal" class="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
  <div class="glass-panel border border-amber-500/20 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
    <h2 class="text-xl font-extrabold text-white mb-1 flex items-center gap-2"><i class="fa-solid fa-user-shield text-amber-500"></i> 管理員登入</h2>
    <p class="text-xs text-slate-500 mb-5">請用已授權的管理員帳號登入。</p>
    <div id="admin-login-error" class="hidden mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-200 text-xs font-semibold"></div>
    <div class="space-y-3">
      <input id="admin-login-id" class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-3 text-sm text-slate-200" placeholder="管理員帳號 ID">
      <input id="admin-login-password" type="password" class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-3 text-sm text-slate-200" placeholder="密碼">
      <button id="admin-login-submit" class="w-full px-5 py-3 bg-amber-600 hover:bg-amber-500 text-slate-950 rounded-xl text-xs font-bold">登入後台</button>
    </div>
  </div>
</div>'''
new='''<div id="admin-login-modal" class="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="admin-login-title" aria-describedby="admin-login-description">
  <form id="admin-login-form" class="glass-panel border border-amber-500/20 rounded-3xl p-6 w-full max-w-sm shadow-2xl" novalidate>
    <h2 id="admin-login-title" class="text-xl font-extrabold text-white mb-1 flex items-center gap-2"><i class="fa-solid fa-user-shield text-amber-500" aria-hidden="true"></i> 管理員登入</h2>
    <p id="admin-login-description" class="text-xs text-slate-500 mb-5">請用已授權的管理員帳號登入。</p>
    <div id="admin-login-error" class="hidden mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-200 text-xs font-semibold" role="alert" aria-live="assertive"></div>
    <div class="space-y-3">
      <div><label for="admin-login-id" class="sr-only">管理員帳號 ID</label><input id="admin-login-id" name="username" autocomplete="username" required autofocus class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-3 text-sm text-slate-200" placeholder="管理員帳號 ID"></div>
      <div><label for="admin-login-password" class="sr-only">管理員密碼</label><input id="admin-login-password" name="password" type="password" autocomplete="current-password" required class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-3 text-sm text-slate-200" placeholder="密碼"></div>
      <button id="admin-login-submit" type="submit" class="w-full min-h-[44px] px-5 py-3 bg-amber-600 hover:bg-amber-500 text-slate-950 rounded-xl text-xs font-bold">登入後台</button>
    </div>
  </form>
</div>'''
portal=rep(portal,old,new,'login form')
portal=portal.replace('>舊通知失敗</option>','>舊 EmailJS 失敗紀錄（唯讀）</option>')
portal=rep(portal,'<div id="toast-container" class="fixed top-5 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-xs px-4"></div>','<div id="toast-container" class="fixed top-5 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-xs px-4" role="status" aria-live="polite" aria-atomic="true"></div>','toast')
portal=portal.replace('admin.css?v=20260717-platform-consolidated-v2',f'admin.css?v={BUILD}').replace('admin.js?v=20260717-platform-consolidated-v2',f'admin.js?v={BUILD}')
Path('portal_sr_x892.html').write_text(portal,encoding='utf-8')

admin=read('admin.js')
admin=rep(admin,"""      button.disabled = true;
      button.textContent = '安全驗證中…';""","""      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.textContent = '安全驗證中…';""",'busy start')
admin=rep(admin,"""      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }""","""      } finally {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.textContent = originalText;
      }""",'busy finish')
admin += r'''

/* ===== Admin login form accessibility follow-up v2 ===== */
;(()=>{const f=document.getElementById('admin-login-form'),b=document.getElementById('admin-login-submit');if(!f||!b||f.dataset.srSubmitBridge==='1')return;f.dataset.srSubmitBridge='1';f.addEventListener('submit',e=>{e.preventDefault();if(!b.disabled)b.click()})})();
'''
Path('admin.js').write_text(admin,encoding='utf-8')
print('Admin interface patch applied')
