/* SecretRoom admin bootstrap: warm Firebase modules and expose deterministic load diagnostics. */
;(() => {
  const startedAt = performance.now();
  const setStatus = (text, tone = 'loading') => {
    const el = document.getElementById('connection-status');
    if (!el) return;
    const tones = {
      loading: 'background:#f7f8fa;color:#667085;border:1px solid #e4e7ec',
      success: 'background:#ecfdf3;color:#087443;border:1px solid #abefc6',
      warn: 'background:#fffaeb;color:#b54708;border:1px solid #fedf89',
      error: 'background:#fef3f2;color:#b42318;border:1px solid #fecdca'
    };
    el.style.cssText = `padding:.55rem .8rem;border-radius:999px;font-size:.75rem;display:flex;align-items:center;gap:.45rem;${tones[tone] || tones.loading}`;
    el.innerHTML = `<span aria-hidden="true">●</span> ${text}`;
  };
  const timeout = (promise, ms, label) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} 載入逾時`)), ms))
  ]);
  window.SRAdminBootstrap = Object.freeze({ startedAt, setStatus });
  setStatus('正在準備安全連線…');
  const firebaseAppUrl = 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
  const firestoreUrl = 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
  window.SRAdminFirebaseWarmup = timeout(Promise.all([
    import(firebaseAppUrl),
    import(firestoreUrl)
  ]), 12000, 'Firebase SDK').then(() => {
    setStatus(`安全套件已準備 · ${Math.round(performance.now() - startedAt)}ms`, 'success');
    return true;
  }).catch(error => {
    console.error('[SecretRoom] Firebase warmup failed:', error);
    setStatus('安全套件載入失敗，請重新整理', 'error');
    return false;
  });
  window.addEventListener('offline', () => setStatus('目前離線，無法同步後台資料', 'warn'));
  window.addEventListener('online', () => setStatus('網路已恢復，重新同步中…', 'loading'));
})();