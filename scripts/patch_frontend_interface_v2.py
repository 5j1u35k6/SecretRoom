from pathlib import Path

BUILD='20260717-conversation-ui-v2'
def read(p): return Path(p).read_text(encoding='utf-8').replace('\r\n','\n')
def rep(t,a,b,n):
    if a not in t: raise SystemExit('Missing '+n)
    return t.replace(a,b,1)

html=read('index.html')
html=rep(html,'<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">','<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">','viewport')
old='''<div id="bgm-controller-widget" class="fixed top-4 right-4 md:top-6 md:right-6 z-[99] flex items-center gap-2.5 bg-slate-950/90 border border-amber-500/20 rounded-full px-3.5 py-2 shadow-[0_4px_25px_rgba(212,175,55,0.15)] backdrop-blur-md transition-all duration-300 hover-breath click-press group cursor-pointer">
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
</div>'''
new='''<div id="bgm-controller-widget" class="fixed top-4 right-4 md:top-6 md:right-6 z-[99]">
  <div id="bgm-bars" class="hidden" aria-hidden="true"></div>
  <span id="bgm-status-text" class="sr-only">音樂已關閉</span>
  <button id="bgm-toggle-btn" type="button" class="w-11 h-11 rounded-full bg-slate-950/90 hover:bg-slate-900 flex items-center justify-center border border-amber-500/25 text-amber-500 shadow-[0_4px_20px_rgba(0,0,0,0.35)] backdrop-blur-md transition-all duration-300 click-press" aria-label="播放背景音樂" aria-pressed="false" title="播放背景音樂">
    <i class="fa-solid fa-volume-xmark text-sm" id="bgm-icon" aria-hidden="true"></i>
  </button>
</div>'''
html=rep(html,old,new,'BGM')
html=rep(html,'<div id="toast-container" class="fixed top-6 left-1/2 transform -translate-x-1/2 z-[100] flex flex-col gap-2.5 w-full max-w-xs px-4"></div>','<div id="toast-container" class="fixed top-6 left-1/2 transform -translate-x-1/2 z-[100] flex flex-col gap-2.5 w-full max-w-xs px-4" role="status" aria-live="polite" aria-atomic="true"></div>','toast')
html=rep(html,'<div id="custom-confirm-modal" class="fixed inset-0 bg-black/95 backdrop-blur-md z-[101] flex items-center justify-center p-4 hidden">','<div id="custom-confirm-modal" class="fixed inset-0 bg-black/95 backdrop-blur-md z-[101] flex items-center justify-center p-4 hidden" role="dialog" aria-modal="true" aria-labelledby="custom-confirm-title" aria-describedby="custom-confirm-description" tabindex="-1">','dialog')
html=rep(html,'<h3 class="text-base font-bold text-white mb-2">確認操作？</h3>','<h3 id="custom-confirm-title" class="text-base font-bold text-white mb-2">確認操作？</h3>','dialog title')
html=rep(html,'<p class="text-sm text-slate-400 mb-6 leading-relaxed">此操作完成後無法復原，請再次確認。</p>','<p id="custom-confirm-description" class="text-sm text-slate-400 mb-6 leading-relaxed">此操作完成後無法復原，請再次確認。</p>','dialog description')
html=html.replace('style.css?v=20260717-conversation-ui-v1',f'style.css?v={BUILD}').replace('app.js?v=20260717-conversation-ui-v1',f'app.js?v={BUILD}')
Path('index.html').write_text(html,encoding='utf-8')

app=read('app.js')
if 'window.__SR_CONVERSATION_UI_V1__' not in app: raise SystemExit('Conversation UI missing')
app=rep(app,"if (icon) icon.className = `fa-solid ${isMuted ? 'fa-volume-xmark' : 'fa-play'} text-[9px]`;","if (icon) icon.className = `fa-solid ${isMuted ? 'fa-volume-xmark' : 'fa-play'} text-sm`;",'BGM icon')
app=rep(app,"""    const status = document.getElementById('bgm-status-text');
    if (status) status.textContent = isMuted ? '音樂已關閉' : '背景音樂';
    const bars = document.getElementById('bgm-bars');""","""    const status = document.getElementById('bgm-status-text');
    if (status) status.textContent = isMuted ? '音樂已關閉' : '背景音樂播放中';
    const toggle = document.getElementById('bgm-toggle-btn');
    if (toggle) { const label=isMuted?'播放背景音樂':'關閉背景音樂'; toggle.setAttribute('aria-label',label); toggle.setAttribute('aria-pressed',String(!isMuted)); toggle.title=label; }
    const bars = document.getElementById('bgm-bars');""",'BGM state')
app=rep(app,"""    if (!id || (!isHome && !isPending) || (isHome && localStorage.getItem(TELEGRAM_HOME_DISMISS_KEY) === '1')) {
      existing?.remove();
      return;
    }

    const host = isHome""","""    if (!id || (!isHome && !isPending) || (isHome && localStorage.getItem(TELEGRAM_HOME_DISMISS_KEY) === '1')) {
      existing?.remove();
      return;
    }

    const bound = hasActiveBinding(snapshot);
    if (bound && isHome) { existing?.remove(); return; }

    const host = isHome""",'Telegram guard')
app=rep(app,"""    const bound = hasActiveBinding(snapshot);
    const serviceState = telegramServiceState(snapshot);
    const identityVerified = serviceState === 'identity_verified';
    const signature = `${id}|${view}|${tab}|${serviceState}`;""","""    const serviceState = telegramServiceState(snapshot);
    const identityVerified = serviceState === 'identity_verified';
    const signature = `${id}|${view}|${tab}|${serviceState}`;""",'bound declaration')
app += r'''

/* ===== Interface accessibility follow-up v2 ===== */
;(()=>{if(window.__SR_DIALOG_A11Y__)return;window.__SR_DIALOG_A11Y__=true;let previous=null;const sel='#custom-confirm-modal,[id$="-modal"],[id*="-modal-"]',focusSel='button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',visible=e=>e&&!e.hidden&&!e.classList.contains('hidden')&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden';function prep(d){if(!(d instanceof HTMLElement))return;d.setAttribute('role',d.getAttribute('role')||'dialog');d.setAttribute('aria-modal','true');if(!d.hasAttribute('tabindex'))d.tabIndex=-1;const h=d.querySelector('h1,h2,h3'),p=d.querySelector('p');if(h&&!d.hasAttribute('aria-labelledby')){if(!h.id)h.id=`${d.id||'sr-dialog'}-title`;d.setAttribute('aria-labelledby',h.id)}if(p&&!d.hasAttribute('aria-describedby')){if(!p.id)p.id=`${d.id||'sr-dialog'}-description`;d.setAttribute('aria-describedby',p.id)}}function active(){return[...document.querySelectorAll(sel)].filter(visible).at(-1)||null}function focus(d){if(!d||d.contains(document.activeElement))return;previous=document.activeElement instanceof HTMLElement?document.activeElement:null;requestAnimationFrame(()=>(d.querySelector(focusSel)||d).focus({preventScroll:true}))}function close(d){const b=d.querySelector('#confirm-modal-cancel,[data-modal-close],[aria-label*="關閉"],button[id*="close"],button[onclick*="close"]');if(b)b.click();else d.click();requestAnimationFrame(()=>previous?.focus?.({preventScroll:true}))}document.addEventListener('keydown',e=>{const d=active();if(!d)return;if(e.key==='Escape'){e.preventDefault();close(d);return}if(e.key!=='Tab')return;const a=[...d.querySelectorAll(focusSel)].filter(visible);if(!a.length){e.preventDefault();d.focus();return}const f=a[0],l=a.at(-1);if(e.shiftKey&&document.activeElement===f){e.preventDefault();l.focus()}else if(!e.shiftKey&&document.activeElement===l){e.preventDefault();f.focus()}},true);const apply=()=>document.querySelectorAll(sel).forEach(d=>{prep(d);if(visible(d))focus(d)});new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','style']});document.addEventListener('DOMContentLoaded',apply,{once:true});apply()})();
'''
card=app[app.index('function ensureCard(snapshot = lastSnapshot)'):app.index('function wrapPasswordSecurityMail()')]
if card.count('bound && isHome')!=1 or card.index('bound && isHome')>card.index('let card = existing'): raise SystemExit('Unsafe Telegram guard')
Path('app.js').write_text(app,encoding='utf-8')
print('Frontend interface patch applied')
