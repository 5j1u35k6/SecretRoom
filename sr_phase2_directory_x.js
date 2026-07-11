// SecretRoom phase two: complete member directory search and X account linking.
(() => {
  if (window.__SR_PHASE2_DIRECTORY_X__) return;
  window.__SR_PHASE2_DIRECTORY_X__ = true;
  const APP_ID = 'secretg-production-node-tw';
  const VERSION = '20260711-phase2-directory-x-v2';
  const directory = new Map();
  let unsubscribe = null;
  let queued = false;
  const qs = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const currentId = () => String(window.state?.applicationId || localStorage.getItem('sr_username') || '').trim();
  const toast = (m,t='info') => window.showToast?.(m,t);

  async function tools() {
    if (window.SRP?.tools) return window.SRP.tools();
    const appMod = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js');
    const fs = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
    const app = appMod.getApps()[0];
    if (!app) throw new Error('Firebase 尚未初始化');
    return { db: fs.getFirestore(app), fs };
  }

  function minimal(id,data={}) {
    return { id, nickname:data.nickname||data.displayName||id, avatar:data.avatar||'', status:data.status||'', kinks:Array.isArray(data.kinks)?data.kinks:[], isSpecElite:!!data.isSpecElite, role:data.role||'', isAdmin:!!data.isAdmin, xInfo:data.xInfo||null };
  }
  function includeCurrent() { const id=currentId(); if(id) directory.set(id,minimal(id,window.state?.userData||{})); }
  async function syncDirectory() {
    if (unsubscribe || !window.state) return;
    try {
      const {db,fs}=await tools();
      const q=fs.query(fs.collection(db,'secretg_apps',APP_ID,'applications'),fs.where('status','in',['approved','active']));
      unsubscribe=fs.onSnapshot(q,snap=>{ directory.clear(); snap.forEach(d=>directory.set(d.id,minimal(d.id,d.data()||{}))); includeCurrent(); schedule(); },err=>console.warn('帳號目錄同步失敗',err));
    } catch(err) { console.warn('帳號目錄無法啟動',err); includeCurrent(); }
  }
  function matches(member,term) {
    const needle=term.toLocaleLowerCase('zh-TW');
    return [member.id,member.nickname,member.xInfo?.handle,...(member.kinks||[])].filter(Boolean).join(' ').toLocaleLowerCase('zh-TW').includes(needle);
  }
  function memberRow(member,compact=false) {
    return `<button type="button" data-sr-member-id="${esc(member.id)}" class="w-full ${compact?'min-h-[52px] p-2':'min-h-[64px] p-3'} flex items-center justify-between gap-3 bg-slate-900/60 border border-amber-500/10 rounded-2xl text-left"><span class="flex items-center gap-3 min-w-0"><img src="${esc(member.avatar||'Gemini_Generated_Image_e2fxvje2fxvje2fx.jpg?v=2')}" class="${compact?'w-8 h-8':'w-10 h-10'} rounded-full object-cover"><span class="min-w-0"><strong class="block text-sm text-slate-200 truncate">${esc(member.nickname)}</strong><span class="block text-xs text-slate-500 font-mono">@${esc(member.id)}</span>${member.xInfo?.handle?`<span class="block text-[11px] text-sky-300">X @${esc(member.xInfo.handle)}</span>`:''}</span></span><i class="fa-solid fa-chevron-right text-amber-400/70"></i></button>`;
  }
  function renderSearch() {
    const input=qs('feed-search-input'), overlay=qs('search-results-overlay');
    if(!input||!overlay||overlay.classList.contains('hidden')) return;
    const term=input.value.trim(); if(!term) return;
    includeCurrent();
    const rows=Array.from(directory.values()).filter(m=>matches(m,term)).slice(0,40);
    const tab=overlay.querySelector(`button[onclick*="setSearchTab('users')"]`);
    if(tab&&tab.textContent!==`帳號 (${rows.length})`) tab.textContent=`帳號 (${rows.length})`;
    let preview=overlay.querySelector('#sr-account-match-preview');
    if(rows.length){
      if(!preview){preview=document.createElement('section');preview.id='sr-account-match-preview';preview.className='rounded-2xl border border-sky-500/15 bg-sky-500/5 p-3';const tabRow=tab?.parentElement;tabRow?.insertAdjacentElement('afterend',preview);}
      const previewKey=`${term}:${rows.slice(0,3).map(r=>r.id).join('|')}`;
      if(preview.dataset.key!==previewKey){preview.dataset.key=previewKey;preview.innerHTML=`<div class="flex items-center justify-between gap-3 mb-2"><strong class="text-xs text-sky-300">符合的帳號</strong><button type="button" id="sr-view-all-account-results" class="text-xs text-amber-300 font-black">查看全部 ${rows.length} 個</button></div><div class="space-y-2">${rows.slice(0,3).map(m=>memberRow(m,true)).join('')}</div>`;preview.querySelector('#sr-view-all-account-results').onclick=()=>window.setSearchTab?.('users');}
    } else preview?.remove();
    if(window.state?.searchTab!=='users') return;
    const list=overlay.querySelector('.overflow-y-auto'); if(!list) return;
    const key=`${term}:${rows.map(r=>r.id).join('|')}`; if(list.dataset.srDirectoryKey===key) return;
    list.dataset.srDirectoryKey=key;
    list.innerHTML=rows.length?rows.map(m=>memberRow(m)).join(''):'<div class="py-8 text-center text-slate-500"><i class="fa-solid fa-user-magnifying-glass text-2xl text-amber-500/50"></i><strong class="block text-sm text-slate-300 mt-3">找不到符合的帳號</strong><span class="block text-xs mt-1">可搜尋帳號 ID、暱稱或 X 帳號。</span></div>';
  }
  window.SRPhase2OpenProfile=id=>{
    const member=directory.get(String(id));
    if(member&&window.state){const list=Array.isArray(window.state.activeUsers)?[...window.state.activeUsers]:[];if(!list.some(x=>x.id===member.id))list.push(member);window.state.activeUsers=list;}
    window.viewUserProfile?.(String(id));
  };

  async function saveX(handle,gate=false) {
    const h=String(handle||'').trim().replace(/^@+/,'');
    if(!/^[A-Za-z0-9_]{1,30}$/.test(h)) throw new Error('X 帳號只能包含英文字母、數字與底線。');
    const id=currentId(); if(!id) throw new Error('找不到目前登入帳號。');
    const {db,fs}=await tools(), now=Date.now();
    const xInfo={handle:h,profileUrl:`https://x.com/${h}`,verificationStatus:'self_declared',linkedAt:fs.serverTimestamp(),linkedAtMs:now};
    const compatibility={provider:'x-migration-compat',deprecated:true,xHandle:h,migratedAtMs:now};
    await fs.updateDoc(fs.doc(db,'secretg_apps',APP_ID,'applications',id),{xInfo,socialBindingProvider:'x',socialBindingUpdatedAt:fs.serverTimestamp(),socialBindingUpdatedAtMs:now,telegramInfo:compatibility});
    window.state.userData={...(window.state.userData||{}),xInfo,socialBindingProvider:'x',telegramInfo:compatibility};
    includeCurrent(); toast(`X 帳號 @${h} 已連結。`,'success'); if(gate) location.reload();
  }
  function form(gate=false) {
    const h=window.state?.userData?.xInfo?.handle||'';
    return `<div class="glass-panel crystal-border border border-sky-500/20 rounded-3xl p-6 w-[94vw] max-w-md shadow-2xl"><div class="w-12 h-12 rounded-full bg-slate-950 border border-sky-500/25 flex items-center justify-center text-white text-xl font-black mb-4">X</div><div class="text-[10px] text-sky-300 font-black tracking-[.22em]">SOCIAL ACCOUNT</div><h2 class="text-xl font-black text-white mt-1">綁定 X 帳號</h2><p class="text-xs text-slate-400 leading-relaxed mt-2">系統只儲存 X 個人頁連結，不會要求 X 密碼；目前不標示為官方 OAuth 驗證。</p><div class="mt-5 space-y-3"><div class="flex items-center rounded-xl border border-sky-500/20 bg-slate-900 px-3"><span class="text-sky-300 font-black">@</span><input id="sr-x-handle" class="flex-1 min-h-[46px] bg-transparent px-2 text-sm text-white focus:outline-none" value="${esc(h)}" placeholder="例如 abc123"></div><label class="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/45 p-3"><input id="sr-x-consent" type="checkbox" class="mt-1 accent-sky-500"><span class="text-xs text-slate-400">我確認這是本人使用的 X 帳號，並同意顯示此連結。</span></label><button id="sr-x-save" class="w-full min-h-[48px] rounded-xl bg-white text-black font-black text-sm">${gate?'綁定後進入 SecretRoom':'儲存 X 帳號'}</button>${gate?'<button id="sr-x-logout" class="w-full min-h-[44px] rounded-xl border border-slate-700 text-slate-400 text-xs font-black">先登出</button>':''}</div></div>`;
  }
  function bind(root,gate=false,done=null) {
    const btn=root.querySelector('#sr-x-save'); if(!btn)return;
    btn.onclick=async()=>{if(!root.querySelector('#sr-x-consent')?.checked)return toast('請先確認帳號連結聲明。','error');btn.disabled=true;btn.textContent='正在儲存...';try{await saveX(root.querySelector('#sr-x-handle')?.value,gate);done?.();}catch(err){toast(err.message||'X 帳號沒有儲存成功。','error');btn.disabled=false;btn.textContent=gate?'綁定後進入 SecretRoom':'儲存 X 帳號';}};
    root.querySelector('#sr-x-logout')?.addEventListener('click',()=>{localStorage.removeItem('sr_username');location.reload();});
  }
  function renderGate() {
    if(window.state?.currentView!=='telegram-bind')return; const app=qs('app'); if(!app||qs('sr-x-gate'))return;
    app.innerHTML=`<main id="sr-x-gate" class="min-h-[100dvh] w-full flex items-center justify-center p-4">${form(true)}</main>`; bind(qs('sr-x-gate'),true);
  }
  window.SRPhase2OpenXBinding=()=>{qs('sr-x-modal')?.remove();const modal=document.createElement('div');modal.id='sr-x-modal';modal.className='fixed inset-0 z-[180] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md';modal.innerHTML=`<button id="sr-x-close" class="absolute top-4 right-4 w-11 h-11 rounded-full border border-slate-700 bg-slate-950 text-slate-300"><i class="fa-solid fa-xmark"></i></button>${form(false)}`;document.body.appendChild(modal);qs('sr-x-close').onclick=()=>modal.remove();bind(modal,false,()=>{modal.remove();schedule();});};

  function apply(){queued=false;syncDirectory();renderGate();renderSearch();document.documentElement.dataset.srPhase2DirectoryX=VERSION;}
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(app);function app(){apply();}}
  document.addEventListener('click',e=>{const row=e.target?.closest?.('[data-sr-member-id]');if(row){e.preventDefault();e.stopPropagation();window.SRPhase2OpenProfile(row.dataset.srMemberId);}},true);
  document.addEventListener('input',e=>{if(e.target?.id==='feed-search-input')setTimeout(schedule,170);},true);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  apply();
})();
