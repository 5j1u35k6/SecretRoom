// Correct weekly rank scoring: likes × 0.3 + total rating stars.
(() => {
  if (window.__SR_RANK_SCORE_FIX__) return;
  window.__SR_RANK_SCORE_FIX__ = true;
  const V='20260712-rank-score-v3';
  const tiers=[['N.G','No Grade',0],['D.G','Dawn Grade',50],['C.G','Classic Grade',100],['B.G','Brass Grade',150],['A.G','Apex Grade',250],['S.G','Superior Grade',500],['S+.G','Superior Plus Grade',750],['SSR.G','Secret Super Rare Grade',1350],['Z.G','Zenith Grade',1350.1]];
  const floor1=n=>Math.floor((Number(n)||0)*10)/10;
  const tier=n=>tiers.reduce((a,t)=>n>=t[2]?t:a,tiers[0]);
  const tm=v=>v?.toDate?v.toDate().getTime():(v?.seconds?Number(v.seconds)*1000:(Number.isFinite(Number(v))?Number(v):(new Date(v||0).getTime()||0)));
  function scores(){
    const d=new Date(),day=d.getDay(),start=new Date(d.getFullYear(),d.getMonth(),d.getDate()+(day===0?-6:1-day),0,0,0,0),end=new Date(start);end.setDate(start.getDate()+7);end.setMilliseconds(-1);
    const map=new Map();
    (window.state?.posts||[]).filter(p=>{const t=tm(p.createdAt||p.createdAtMs||p.timestamp);return t>=start.getTime()&&t<=end.getTime();}).forEach(p=>{
      const id=String(p.userId||'unknown'),likes=Number(p.likeCount||Object.keys(p.likes||{}).length||0),vals=Object.values(p.ratings||{}).map(Number).filter(n=>Number.isFinite(n)&&n>0),sum=vals.reduce((a,b)=>a+b,0),x=map.get(id)||{score:0,likes:0,count:0,sum:0,posts:0};
      x.score+=floor1(likes*.3+sum);x.likes+=likes;x.count+=vals.length;x.sum+=sum;x.posts++;map.set(id,x);
    });
    map.forEach(x=>{x.score=floor1(x.score);x.avg=x.count?x.sum/x.count:0;x.tier=tier(x.score);});return map;
  }
  function patch(){
    if(window.state?.currentTab!=='rank')return;const box=document.getElementById('dashboard-tab-content');if(!box)return;
    const desc=[...box.querySelectorAll('p')].find(p=>/評星人數|按讚數/.test(p.textContent||''));if(desc&&!/評星總星數/.test(desc.textContent||''))desc.textContent='每週一至週日結算。分數＝按讚數 × 0.3＋評星總星數（評星人數 × 平均星數），最後無條件捨去至小數點後一位。';
    const map=scores(),rows=[...box.querySelectorAll('div[onclick*="viewUserProfile"]')];
    rows.forEach(row=>{const m=(row.textContent||'').match(/@([^\s]+)/),x=m&&map.get(m[1]);if(!x)return;row.dataset.rankScore=String(x.score);const stat=[...row.querySelectorAll('div')].find(n=>/篇.*讚.*評星.*均星/.test(n.textContent||''));if(stat)stat.textContent=`${x.posts} 篇 · ${x.likes} 讚 · ${x.count} 位評星 · 均星 ${x.avg.toFixed(1)}`;const score=[...row.querySelectorAll('div')].find(n=>n.classList.contains('text-sm')&&n.classList.contains('text-white'));if(score)score.textContent=x.score.toFixed(1);const pill=row.querySelector('.inline-flex');if(pill)pill.textContent=x.tier[0];});
    const list=rows[0]?.parentElement;if(list){rows.sort((a,b)=>Number(b.dataset.rankScore||0)-Number(a.dataset.rankScore||0)).forEach((r,i)=>{list.appendChild(r);const pos=r.firstElementChild;if(pos)pos.textContent=`#${i+1}`;});}
    const me=map.get(String(window.state?.applicationId||''));if(me){const card=[...box.querySelectorAll('div')].find(n=>n.textContent?.trim()==='你的本週位階')?.parentElement;if(card){const big=card.querySelector('.text-3xl');if(big)big.textContent=me.score.toFixed(1);const badge=card.querySelector('.w-20.h-20');if(badge)badge.textContent=me.tier[0];}}
    box.dataset.srRankScoreFix=V;
  }
  let q=false;const schedule=()=>{if(!q){q=true;requestAnimationFrame(()=>{q=false;patch();});}};
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});schedule();
})();
