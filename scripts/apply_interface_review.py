from pathlib import Path

BUILD = '20260717-interface-review-v1'


def read(path):
    return Path(path).read_text(encoding='utf-8').replace('\r\n', '\n')


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'Unable to patch {label}')
    return text.replace(old, new, 1)


# Frontend HTML accessibility and visual simplification.
index = read('index.html')
index = replace_once(
    index,
    '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">',
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
    'mobile viewport scaling',
)
index = replace_once(
    index,
    '''<div id="bgm-controller-widget" class="fixed top-4 right-4 md:top-6 md:right-6 z-[99] flex items-center gap-2.5 bg-slate-950/90 border border-amber-500/20 rounded-full px-3.5 py-2 shadow-[0_4px_25px_rgba(212,175,55,0.15)] backdrop-blur-md transition-all duration-300 hover-breath click-press group cursor-pointer">
  <div class="flex items-center gap-[3px] h-3 w-4" id="bgm-bars">
    <div class="w-[2px] h-1.5 bg-amber-500 rounded-full bgm-bar"></div>
    <div class="w-[2px] h-3 bg-amber-500 rounded-full bgm-bar"></div>
    <div class="w-[2px] h-1 bg-amber-500 rounded-full bgm-bar"></div>
    <div class="w-[2px] h-2 bg-amber-500 rounded-full bgm-bar"></div>
  </div>
  <span class="text-[9px] font-bold text-amber-500/80 tracking-[0.18em] hidden sm:block font-luxury" id="bgm-status-text">Bgm Audio</span>
  <button id="bgm-toggle-btn" class="w-6 h-6 rounded-full bg-amber-500/10 hover:bg-amber-500/20 flex items-center justify-center border border-amber-500/20 text-amber-500 transition-all duration-300">
    <i class="fa-solid fa-play text-[9px]" id="bgm-icon"></i>
  </button>
</div>''',
    '''<div id="bgm-controller-widget" class="fixed top-4 right-4 md:top-6 md:right-6 z-[99]">
  <div id="bgm-bars" class="hidden" aria-hidden="true"></div>
  <span id="bgm-status-text" class="sr-only">音樂已關閉</span>
  <button id="bgm-toggle-btn" type="button" class="w-11 h-11 rounded-full bg-slate-950/90 hover:bg-slate-900 flex items-center justify-center border border-amber-500/25 text-amber-500 shadow-[0_4px_20px_rgba(0,0,0,0.35)] backdrop-blur-md transition-all duration-300 click-press" aria-label="播放背景音樂" aria-pressed="false" title="播放背景音樂">
    <i class="fa-solid fa-volume-xmark text-sm" id="bgm-icon" aria-hidden="true"></i>
  </button>
</div>''',
    'BGM controller',
)
index = replace_once(
    index,
    '<div id="toast-container" class="fixed top-6 left-1/2 transform -translate-x-1/2 z-[100] flex flex-col gap-2.5 w-full max-w-xs px-4"></div>',
    '<div id="toast-container" class="fixed top-6 left-1/2 transform -translate-x-1/2 z-[100] flex flex-col gap-2.5 w-full max-w-xs px-4" role="status" aria-live="polite" aria-atomic="true"></div>',
    'toast live region',
)
index = replace_once(
    index,
    '<div id="custom-confirm-modal" class="fixed inset-0 bg-black/95 backdrop-blur-md z-[101] flex items-center justify-center p-4 hidden">',
    '<div id="custom-confirm-modal" class="fixed inset-0 bg-black/95 backdrop-blur-md z-[101] flex items-center justify-center p-4 hidden" role="dialog" aria-modal="true" aria-labelledby="custom-confirm-title" aria-describedby="custom-confirm-description" tabindex="-1">',
    'confirm dialog semantics',
)
index = replace_once(index, '<h3 class="text-base font-bold text-white mb-2">確認操作？</h3>', '<h3 id="custom-confirm-title" class="text-base font-bold text-white mb-2">確認操作？</h3>', 'confirm dialog title')
index = replace_once(index, '<p class="text-sm text-slate-400 mb-6 leading-relaxed">此操作完成後無法復原，請再次確認。</p>', '<p id="custom-confirm-description" class="text-sm text-slate-400 mb-6 leading-relaxed">此操作完成後無法復原，請再次確認。</p>', 'confirm dialog description')
index = index.replace('style.css?v=20260717-platform-consolidated-v2', f'style.css?v={BUILD}')
index = index.replace('app.js?v=20260717-platform-consolidated-v2', f'app.js?v={BUILD}')
Path('index.html').write_text(index, encoding='utf-8')

# Frontend runtime: accessible BGM state, non-duplicated Telegram entry, modal keyboard support.
app = read('app.js')
app = replace_once(
    app,
    '''    const status = document.getElementById('bgm-status-text');
    if (status) status.textContent = isMuted ? '音樂已關閉' : '背景音樂';
    const bars = document.getElementById('bgm-bars');''',
    '''    const status = document.getElementById('bgm-status-text');
    if (status) status.textContent = isMuted ? '音樂已關閉' : '背景音樂播放中';
    const toggle = document.getElementById('bgm-toggle-btn');
    if (toggle) {
      const label = isMuted ? '播放背景音樂' : '關閉背景音樂';
      toggle.setAttribute('aria-label', label);
      toggle.setAttribute('aria-pressed', String(!isMuted));
      toggle.title = label;
    }
    const bars = document.getElementById('bgm-bars');''',
    'BGM accessible state',
)
app = replace_once(
    app,
    '''    const bound = hasActiveBinding(snapshot);
    const serviceState = telegramServiceState(snapshot);''',
    '''    const bound = hasActiveBinding(snapshot);
    if (bound && isHome) {
      card.remove();
      return;
    }
    const serviceState = telegramServiceState(snapshot);''',
    'Telegram duplicate home entry',
)
app += r'''

/* ===== Interface accessibility follow-up ===== */
;(() => {
  if (window.__SR_DIALOG_A11Y__) return;
  window.__SR_DIALOG_A11Y__ = true;
  let previousFocus = null;

  const dialogSelector = '#custom-confirm-modal,[id$="-modal"],[id*="-modal-"]';
  const focusableSelector = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const visible = element => {
    if (!element || element.hidden || element.classList.contains('hidden')) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  };

  function prepare(dialog) {
    if (!(dialog instanceof HTMLElement)) return;
    dialog.setAttribute('role', dialog.getAttribute('role') || 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    if (!dialog.hasAttribute('tabindex')) dialog.tabIndex = -1;
    const heading = dialog.querySelector('h1,h2,h3');
    if (heading && !dialog.hasAttribute('aria-labelledby')) {
      if (!heading.id) heading.id = `${dialog.id || 'sr-dialog'}-title`;
      dialog.setAttribute('aria-labelledby', heading.id);
    }
    const description = dialog.querySelector('p');
    if (description && !dialog.hasAttribute('aria-describedby')) {
      if (!description.id) description.id = `${dialog.id || 'sr-dialog'}-description`;
      dialog.setAttribute('aria-describedby', description.id);
    }
  }

  function activeDialog() {
    return [...document.querySelectorAll(dialogSelector)].filter(visible).at(-1) || null;
  }

  function focusDialog(dialog) {
    if (!dialog || dialog.contains(document.activeElement)) return;
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const target = dialog.querySelector(focusableSelector) || dialog;
    requestAnimationFrame(() => target.focus({ preventScroll: true }));
  }

  function closeDialog(dialog) {
    const close = dialog.querySelector('#confirm-modal-cancel,[data-modal-close],[aria-label*="關閉"],button[id*="close"],button[onclick*="close"]');
    close?.click();
    requestAnimationFrame(() => previousFocus?.focus?.({ preventScroll: true }));
  }

  document.addEventListener('keydown', event => {
    const dialog = activeDialog();
    if (!dialog) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDialog(dialog);
      return;
    }
    if (event.key !== 'Tab') return;
    const items = [...dialog.querySelectorAll(focusableSelector)].filter(visible);
    if (!items.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, true);

  const apply = () => {
    document.querySelectorAll(dialogSelector).forEach(dialog => {
      prepare(dialog);
      if (visible(dialog)) focusDialog(dialog);
    });
  };
  new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
  document.addEventListener('DOMContentLoaded', apply, { once: true });
  apply();
})();
'''
Path('app.js').write_text(app, encoding='utf-8')

# Admin login form semantics and wording.
portal = read('portal_sr_x892.html')
old_login = '''<div id="admin-login-modal" class="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
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
new_login = '''<div id="admin-login-modal" class="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="admin-login-title" aria-describedby="admin-login-description">
  <form id="admin-login-form" class="glass-panel border border-amber-500/20 rounded-3xl p-6 w-full max-w-sm shadow-2xl" novalidate>
    <h2 id="admin-login-title" class="text-xl font-extrabold text-white mb-1 flex items-center gap-2"><i class="fa-solid fa-user-shield text-amber-500" aria-hidden="true"></i> 管理員登入</h2>
    <p id="admin-login-description" class="text-xs text-slate-500 mb-5">請用已授權的管理員帳號登入。</p>
    <div id="admin-login-error" class="hidden mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-200 text-xs font-semibold" role="alert" aria-live="assertive"></div>
    <div class="space-y-3">
      <div>
        <label for="admin-login-id" class="sr-only">管理員帳號 ID</label>
        <input id="admin-login-id" name="username" autocomplete="username" required autofocus class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-3 text-sm text-slate-200" placeholder="管理員帳號 ID">
      </div>
      <div>
        <label for="admin-login-password" class="sr-only">管理員密碼</label>
        <input id="admin-login-password" name="password" type="password" autocomplete="current-password" required class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-3 text-sm text-slate-200" placeholder="密碼">
      </div>
      <button id="admin-login-submit" type="submit" class="w-full min-h-[44px] px-5 py-3 bg-amber-600 hover:bg-amber-500 text-slate-950 rounded-xl text-xs font-bold">登入後台</button>
    </div>
  </form>
</div>'''
portal = replace_once(portal, old_login, new_login, 'admin login form')
portal = portal.replace('>舊通知失敗</option>', '>舊 EmailJS 失敗紀錄（唯讀）</option>')
portal = portal.replace('admin.css?v=20260717-platform-consolidated-v2', f'admin.css?v={BUILD}')
portal = portal.replace('admin.js?v=20260717-platform-consolidated-v2', f'admin.js?v={BUILD}')
Path('portal_sr_x892.html').write_text(portal, encoding='utf-8')

admin = read('admin.js')
admin = replace_once(
    admin,
    '''      button.disabled = true;
      button.textContent = '安全驗證中…';''',
    '''      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.textContent = '安全驗證中…';''',
    'admin busy state start',
)
admin = replace_once(
    admin,
    '''      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }''',
    '''      } finally {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.textContent = originalText;
      }''',
    'admin busy state finish',
)
admin += r'''

/* ===== Admin login form accessibility follow-up ===== */
;(() => {
  const form = document.getElementById('admin-login-form');
  const button = document.getElementById('admin-login-submit');
  const modal = document.getElementById('admin-login-modal');
  if (!form || !button || form.dataset.srSubmitBridge === '1') return;
  form.dataset.srSubmitBridge = '1';
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!button.disabled) button.click();
  });
  modal?.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    document.getElementById('admin-login-id')?.focus();
  });
})();
'''
Path('admin.js').write_text(admin, encoding='utf-8')

print('Interface review follow-up applied')
