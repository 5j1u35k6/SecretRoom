(()=>{
  if(window.__SR_THEME_FINAL__) return;
  window.__SR_THEME_FINAL__=true;
  const style=document.createElement('style');
  style.id='sr-theme-final';
  style.textContent=`
:root{
  --sr-bg:#f4f6f8;
  --sr-surface:#ffffff;
  --sr-surface-soft:#f8fafc;
  --sr-border:#e5e7eb;
  --sr-text:#17202a;
  --sr-muted:#667085;
  --sr-accent:#8a6a2f;
  --sr-accent-soft:#f7f1e3;
  --sr-success:#067647;
  --sr-danger:#b42318;
}
html,body{background:#f4f6f8!important;color:var(--sr-text)!important}
body{font-family:Inter,"Noto Serif TC",system-ui,-apple-system,"Segoe UI",sans-serif!important;overflow:hidden!important}
.club-groove-bg{background:#f4f6f8!important;background-image:none!important}
#app{background:#f4f6f8!important;color:var(--sr-text)!important}
.ambient-spotlight,.ci-lounge-gradient,.club-groove-bg:before,.club-groove-bg:after{display:none!important}
#loading-screen{background:#f4f6f8!important;color:var(--sr-text)!important;backdrop-filter:none!important}
#loading-screen .text-amber-500\/80{color:#8a6a2f!important}
#loading-screen .text-slate-400{color:#667085!important}

/* common surfaces */
.glass-panel,.crystal-border,.architectural-border{
  background:#fff!important;
  color:var(--sr-text)!important;
  border:1px solid var(--sr-border)!important;
  outline:none!important;
  box-shadow:0 8px 28px rgba(16,24,40,.06)!important;
  backdrop-filter:none!important;
}
.glass-panel{border-radius:18px!important}
button{border-radius:10px!important}
input,select,textarea{
  background:#fff!important;
  color:var(--sr-text)!important;
  border:1px solid #d8dee6!important;
  box-shadow:none!important;
}
input::placeholder,textarea::placeholder{color:#98a2b3!important}
select{background-color:#fff!important}

/* authentication */
.sr-auth-card,.sr-flow-shell{
  background:#fff!important;
  color:var(--sr-text)!important;
  border:1px solid var(--sr-border)!important;
  box-shadow:0 16px 40px rgba(16,24,40,.08)!important;
}
.sr-auth-card h1,.sr-auth-card h2,.sr-auth-card h3{color:var(--sr-text)!important}
.sr-auth-card label,.sr-auth-card p{color:var(--sr-muted)!important}
.sr-auth-note,.sr-spec-checklist,.sr-registration-guide{
  background:var(--sr-surface-soft)!important;
  border-color:var(--sr-border)!important;
  color:var(--sr-muted)!important;
}
.sr-registration-guide b{background:var(--sr-accent-soft)!important;color:var(--sr-accent)!important}
.sr-auth-secondary{background:var(--sr-surface-soft)!important;border-color:var(--sr-border)!important;color:var(--sr-accent)!important}

/* responsive workspace / dialogs */
.sr-responsive-workspace{background:rgba(244,246,248,.96)!important;backdrop-filter:blur(8px)!important}
.sr-responsive-workspace-panel,.sr-dialog-telegram .sr-tg-modal-card{
  background:#fff!important;color:var(--sr-text)!important;
  border:1px solid var(--sr-border)!important;
  box-shadow:0 18px 48px rgba(16,24,40,.10)!important;
}
.sr-responsive-workspace-panel h1,.sr-responsive-workspace-panel h2,.sr-responsive-workspace-panel h3,
.sr-tg-modal-card h1,.sr-tg-modal-card h2,.sr-tg-modal-card h3{color:var(--sr-text)!important}
.sr-responsive-workspace-panel p,.sr-responsive-workspace-panel span,.sr-tg-modal-card p{color:var(--sr-muted)}

/* club workspace */
.sr-club-hero,.sr-club-section,.sr-content-intro,.sr-profile-intro,.sr-tab-intro{
  background:#fff!important;color:var(--sr-text)!important;border-color:var(--sr-border)!important;
  box-shadow:0 6px 22px rgba(16,24,40,.05)!important;
}
.sr-status,.sr-service,.sr-principle,.sr-milestone,.sr-preview-card,
.sr-club-standards-card,.sr-content-card{
  background:#f8fafc!important;color:var(--sr-text)!important;border-color:var(--sr-border)!important;
}
.sr-status b,.sr-service b,.sr-principle b,.sr-milestone b,.sr-preview-card b,
.sr-club-hero h1,.sr-club-section h2,.sr-content-intro h2,.sr-profile-intro h2{color:var(--sr-text)!important}
.sr-status span,.sr-service small,.sr-principle span,.sr-milestone span,.sr-preview-card span,
.sr-preview-card p,.sr-content-sort-note{color:var(--sr-muted)!important}
.sr-policy-strip,.sr-member-only-note,.sr-other-profile-note,.sr-no-ranking-note{
  background:#f8fafc!important;border-color:var(--sr-border)!important;color:var(--sr-muted)!important;
}
.sr-eyebrow,.sr-club-standards-card h3{color:var(--sr-accent)!important}
.sr-service i,.sr-milestone i,.sr-standard-row i,.sr-policy-strip i,.sr-member-only-note i{color:var(--sr-accent)!important}
.sr-milestone-state{background:var(--sr-accent-soft)!important;border-color:#eadfca!important;color:var(--sr-accent)!important}

/* navigation */
.sr-dashboard-left,.sr-dashboard-right{color:var(--sr-text)!important}
.sr-dashboard-left nav{background:#fff!important;border:1px solid var(--sr-border)!important;border-radius:16px!important;padding:8px!important}
.sr-nav-label{color:#98a2b3!important}
.sr-club-nav{color:#475467!important}
.sr-club-nav:hover{background:#f8fafc!important;color:var(--sr-text)!important}
.sr-club-nav.active{color:var(--sr-accent)!important;background:var(--sr-accent-soft)!important;border-left:2px solid var(--sr-accent)!important}
.sr-club-nav i{color:var(--sr-accent)!important}

/* buttons */
.bg-gradient-to-r.from-amber-600.to-amber-700,
.brushed-gold{background:#8a6a2f!important;color:#fff!important;box-shadow:none!important;text-shadow:none!important}
.text-amber-500,.text-amber-400,.text-amber-300{color:var(--sr-accent)!important}
.border-amber-500\/20,.border-amber-500\/25,.border-amber-500\/30{border-color:#e5d9bd!important}

/* admin */
#admin-main,.admin-main{background:#f4f6f8!important;color:var(--sr-text)!important}
.admin-topbar,.admin-summary-card,.admin-section-card{background:#fff!important;color:var(--sr-text)!important;border-color:var(--sr-border)!important;box-shadow:0 6px 22px rgba(16,24,40,.05)!important}
.admin-topbar p,.admin-summary-card p,.admin-section-card p{color:var(--sr-muted)!important}

/* remove old visual noise */
#bgm-controller-widget{opacity:.55}
#bgm-toggle-btn{background:#fff!important;color:var(--sr-accent)!important;border-color:#e5d9bd!important;box-shadow:0 4px 14px rgba(16,24,40,.08)!important}
::-webkit-scrollbar-track{background:#f4f6f8!important}
::-webkit-scrollbar-thumb{background:#cbd5e1!important;border:0!important}

@media(max-width:760px){
  .sr-dashboard-left nav{border-radius:14px!important}
  .sr-club-hero,.sr-club-section,.sr-content-intro,.sr-profile-intro,.sr-tab-intro{border-radius:14px!important}
  .glass-panel,.sr-auth-card,.sr-flow-shell{border-radius:16px!important}
}
`;
  document.head.appendChild(style);
})();