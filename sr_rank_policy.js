// SecretRoom rank policy v3. Effective 2026-07-13 00:00 Asia/Taipei.
(() => {
  if (window.__SR_RANK_POLICY_V3__) return;
  window.__SR_RANK_POLICY_V3__ = true;
  const APP='secretg-production-node-tw', VER='20260712-rank-v3', OLD='20260711-phase1-frontend-v1';
  const EFFECTIVE=new Date('2026-07-13T00:00:00+08:00').getTime(), TOP=3, REVIEW_CAP=3;
  const tiers=[
    ['N.G','No Grade',0,'from-slate-500 via-slate-400 to-slate-600'],
    ['D.G','Dawn Grade',50,'from-stone-300 via-amber-200 to-stone-500'],
    ['C.G','Classic Grade',120,'from-slate-200 via-slate-300 to-amber-100'],
    ['B.G','Brass Grade',250,'from-emerald-200 via-teal-300 to-slate-200'],
    ['A.G','Apex Grade',450,'from-blue-200 via-cyan-300 to-amber-200'],
    ['S.G','Superior Grade',700,'from-yellow-200 via-amber-400 to-orange-500'],
    ['S+.G','Superior Plus Grade',1000,'from-amber-200 via-yellow-300 to-amber-500'],
    ['SSR.G','Secret Super Rare Grade',1450,'from-violet-300 via-amber-200 to-rose-200'],
    ['Z.G','Zenith Grade',2000,'from-fuchsia-300 via-amber-200 to-cyan-200']
  ];
  const q=id=>document.getElementById(id), floor=n=>Math.floor((Number(n)||0)*10)/10;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const js=v=>String(v??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n').replace(/\r/g,'\\r');
  const me=()=>String(window.state?.applicationId||localStorage.getItem('sr_username')||'');
  const posts=()=>window.SRPhase2RawPosts?.()||window.state?.posts||[];
  const toast=(m,t='info')=>window.showToast?.(m,t);
  const time=v=>v?.toDate?v.toDate().getTime():(v?.seconds?Number(v.seconds)*1000:(Number.isFinite(Number(v))?Number(v):(new Date(v||0).getTime()||0)));
  const week=(d=new Date())=>{const day=d.getDay(),s=new Date(d.getFullYear(),d.getMonth(),d.getDate()+(day===0?-6:1-day),0,0,0,0),e=new Date(s);e.setDate(s.getDate()+7);e.setMilliseconds(-1);return{s,e}};
  const tier=n=>tiers.reduce((a,t)=>n>=t[2]?t:a,tiers[0]);
  const ratings=p=>Object.entries(p.ratings||{}).flatMap(([id,v])=>{v=Number(v);return id&&id!==String(p.userId||'')&&Number.isInteger(v)&&v>=1&&v<=5?[{id:String(id),v}]:[]});
  const likes=p=>[...new Set(Object.entries(p.likes||{}).filter(([,v])=>!!v).map(([id])=>String(id)).filter(id=>id&&id!==String(p.userId||'')))];

  function data(now=new Date()){
    const {s,e}=week(now), all=posts().filter(p=>{const t=time(p.createdAt||p.createdAtMs||p.timestamp);return t>=s.getTime()&&t<=e.getTime()}), v3=now.getTime()>=EFFECTIVE;
    const groups=new Map, allowed=new Set;
    all.forEach(p=>ratings(p).forEach(r=>{const k=r.id+'\0'+p.userId,a=groups.get(k)||[];a.push({p:String(p.id),r:r.id,v:r.v,t:time(p.createdAt||p.createdAtMs||p.timestamp)});groups.set(k,a)}));
    groups.forEach(a=>a.sort((x,y)=>y.v-x.v||x.t-y.t).slice(0,REVIEW_CAP).forEach(x=>allowed.add(x.p+'\0'+x.r)));
    const profiles=new Map((window.state?.activeUsers||[]).map(u=>[String(u.id),u]));profiles.set(me(),{id:me(),...(window.state?.userData||{})});
    const map=new Map;
    all.forEach(p=>{const id=String(p.userId||'unknown'),u=profiles.get(id)||{},r=ratings(p).filter(x=>!v3||allowed.has(String(p.id)+'\0'+x.id)),sum=r.reduce((n,x)=>n+x.v,0),ls=likes(p),score=floor(v3?ls.length*.3+sum*.7+10:ls.length*.3+sum),x=map.get(id)||{id,name:p.authorName||u.nickname||id,avatar:p.authorAvatar||u.avatar||'',published:0,items:[]};x.published++;x.items.push({score,likes:ls.length,count:r.length,sum});map.set(id,x)});
    const members=[...map.values()].map(x=>{const chosen=[...x.items].sort((a,b)=>b.score-a.score).slice(0,v3?TOP:x.items.length),score=floor(chosen.reduce((n,p)=>n+p.score,0)),likeCount=chosen.reduce((n,p)=>n+p.likes,0),count=chosen.reduce((n,p)=>n+p.count,0),sum=chosen.reduce((n,p)=>n+p.sum,0);return{...x,chosen:chosen.length,score,likes:likeCount,count,sum,avg:count?sum/count:0,tier:tier(score)}}).sort((a,b)=>b.score-a.score||b.likes-a.likes||b.count-a.count||a.id.localeCompare(b.id));
    return{s,e,all,members,v3};
  }

  function card(x,i,pinned,v3){return `<button class="sr-rank-member ${pinned?'sr-rank-member-pinned':''}" onclick="viewUserProfile('${js(x.id)}')"><span class="w-9 text-center font-black text-amber-300 font-luxury">#${i+1}</span><img src="${x.avatar||'Gemini_Generated_Image_e2fxvje2fxvje2fx.jpg?v=2'}" class="w-12 h-12 rounded-2xl object-cover border border-amber-500/20 shrink-0"><span class="min-w-0 flex-1 text-left"><span class="flex items-center gap-2 flex-wrap"><strong class="text-slate-100 truncate">${esc(x.name)}</strong><span class="text-xs text-slate-500 font-mono">@${esc(x.id)}</span></span><span class="block text-xs text-slate-500 mt-1">本週 ${x.published} 篇${v3?` · 取最高 ${x.chosen} 篇`:''} · ${x.likes} 讚 · ${x.count} 人評星 · 平均 ${x.avg.toFixed(1)} 星</span></span><span class="text-right shrink-0"><span class="inline-flex min-w-[4rem] justify-center px-3 py-2 rounded-2xl bg-gradient-to-br ${x.tier[3]} text-slate-950 font-black">${x.tier[0]}</span><strong class="block text-sm text-white mt-1">${x.score.toFixed(1)}</strong></span></button>`}
  function render(){
    if(window.state?.currentTab!=='rank')return;const box=q('dashboard-tab-content');if(!box)return;box.dataset.srRankVersion=OLD;if(box.dataset.srRankPolicy===VER&&box.querySelector('[data-rank-v3]'))return;
    const d=data(),idx=d.members.findIndex(x=>x.id===me()),cur=idx<0?null:d.members[idx],ct=cur?.tier||tiers[0],ci=tiers.indexOf(ct),next=tiers[ci+1],score=cur?.score||0,pct=next?Math.max(0,Math.min(100,(score-ct[2])/(next[2]-ct[2])*100)):100,top=d.members.slice(0,10),pin=idx>=10?cur:null,period=`${d.s.toLocaleDateString('zh-TW',{month:'2-digit',day:'2-digit'})}－${d.e.toLocaleDateString('zh-TW',{month:'2-digit',day:'2-digit'})}`;
    box.dataset.srRankPolicy=VER;box.innerHTML=`<div data-rank-v3 class="space-y-4"><section class="glass-panel crystal-border rounded-3xl p-5 md:p-6"><div class="flex justify-between gap-4"><div><div class="text-xs text-amber-400 font-black">本週位階 · ${d.v3?'Formula v3':'Formula v2'}</div><h2 class="text-2xl font-black text-white mt-1">${ct[0]}</h2><p class="text-xs text-slate-400 mt-1">${period} · 每週一重新計算</p></div><div class="text-right"><div class="text-3xl font-black text-white">${score.toFixed(1)}</div><div class="text-xs text-slate-500">目前分數</div></div></div><p class="text-xs text-slate-300 mt-4">${d.v3?'分數＝讚數 × 0.3＋有效評星總和 × 0.7＋每篇 10 分；每週只取最高 3 篇。':'本週公式＝讚數 × 0.3＋有效評星總和。'}</p>${d.v3?'':'<div class="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-3 text-xs text-cyan-200">新規則將於 2026/07/13（一）00:00 生效，本週不在中途改分。</div>'}<div class="mt-5"><div class="flex justify-between text-xs"><span>${next?`距離 ${next[0]} 還差 ${Math.max(0,floor(next[2]-score)).toFixed(1)} 分`:'已到最高位階'}</span><span>${Math.round(pct)}%</span></div><div class="sr-rank-progress mt-2"><span style="width:${pct}%"></span></div></div></section><section class="glass-panel crystal-border rounded-3xl p-5"><div class="flex justify-between mb-3"><div><h3 class="font-black text-white">位階門檻</h3><p class="text-xs text-slate-500">SSR.G 與 Z.G 已有完整區間。</p></div><button id="rank-all" class="sr-secondary-button">查看全部</button></div><div id="rank-tiers" class="grid grid-cols-3 gap-2">${tiers.map(t=>`<div class="sr-rank-tier-card"><b>${t[0]}</b><div class="text-xs mt-1">${t[2].toLocaleString()} 分</div></div>`).join('')}</div></section><section class="glass-panel crystal-border rounded-3xl p-5"><h3 class="text-lg font-black text-white">本週排行榜</h3><p class="text-xs text-slate-500 mt-1 mb-4">${d.all.length} 篇貼文${d.v3?'；每人最多 3 篇納入。':'。'}</p><div class="space-y-3">${top.length?top.map((x,i)=>card(x,i,false,d.v3)).join(''):'<div class="text-center py-10 text-slate-500">這週還沒有人上榜</div>'}${pin?`<div class="pt-3 border-t border-amber-500/10"><div class="text-xs text-amber-300 mb-2">你的名次</div>${card(pin,idx,true,d.v3)}</div>`:''}</div></section><section class="glass-panel crystal-border rounded-3xl p-5 text-xs text-slate-400"><b class="text-white">防灌水：</b>星數只接受 1～5；不能替自己的貼文評星或按讚；同一評分者對同一作者每週最多 3 篇評星納入；異常值不計分。</section></div>`;
    q('rank-all').onclick=()=>{const g=q('rank-tiers');g.classList.toggle('grid-cols-3');g.classList.toggle('grid-cols-2')};
  }

  async function tools(){for(let i=0;i<60;i++){try{if(window.SRP?.tools)return await window.SRP.tools()}catch(e){if(!/Firebase 尚未初始化|no Firebase App/i.test(String(e?.message||e)))throw e}await new Promise(r=>setTimeout(r,100))}throw Error('資料庫尚未連線')}
  function guards(){
    if(typeof window.ratePost==='function'&&!window.ratePost.__rankV3){const fn=async(id,v)=>{v=Number(v);const p=posts().find(x=>String(x.id)===String(id)),uid=me();if(!p)return;if(!Number.isInteger(v)||v<1||v>5)return toast('評星只接受 1～5 星。','error');if(String(p.userId)===uid)return toast('不能替自己的貼文評星。','info');try{const{db,fs}=await tools(),ref=fs.doc(db,'secretg_apps',APP,'posts',String(id)),ratings={...(p.ratings||{}),[uid]:v};await fs.updateDoc(ref,{ratings,ratingsUpdatedAtMs:Date.now()});p.ratings=ratings;toast(`已評為 ${v} 星；每週對同一作者僅最高 3 篇納入位階。`,'success');schedule()}catch(e){toast('評星失敗：'+e.message,'error')}};fn.__rankV3=1;window.ratePost=fn}
    if(typeof window.toggleLikePost==='function'&&!window.toggleLikePost.__rankV3){const fn=async id=>{const p=posts().find(x=>String(x.id)===String(id)),uid=me();if(!p)return;if(String(p.userId)===uid)return toast('自己的貼文不列入自我按讚。','info');try{const{db,fs}=await tools(),ref=fs.doc(db,'secretg_apps',APP,'posts',String(id)),ls={...(p.likes||{})};ls[uid]?delete ls[uid]:ls[uid]=true;await fs.updateDoc(ref,{likes:ls,likeCount:likes({...p,likes:ls}).length,likesUpdatedAtMs:Date.now()});p.likes=ls;p.likeCount=likes(p).length;schedule()}catch(e){toast('按讚失敗：'+e.message,'error')}};fn.__rankV3=1;window.toggleLikePost=fn}
  }
  let wait=false;function schedule(){if(wait)return;wait=true;requestAnimationFrame(()=>{wait=false;guards();render()})}
  window.SRRankPolicy=Object.freeze({version:'v3',effectiveAt:EFFECTIVE,maxPosts:TOP,maxRatingsPerReviewerAuthor:REVIEW_CAP,tiers,data});
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});schedule();
})();