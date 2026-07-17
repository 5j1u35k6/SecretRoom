/* SecretRoom public runtime bootstrap v10. */
const build = String(window.__SR_BUILD__ || '20260717-member-auth-v10');

function deadline(promise, milliseconds, message) {
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), milliseconds);
    })
  ]);
}

function showLoadFailure(error) {
  console.error('SecretRoom load failed', error);
  const loading = document.getElementById('loading-screen');
  if (!loading) return;
  loading.classList.remove('hidden');
  loading.innerHTML = `
    <div class="max-w-sm px-6 text-center">
      <p class="text-rose-300 text-base font-black mb-3">網站載入未完成</p>
      <p class="text-slate-400 text-xs leading-relaxed mb-5">請重新載入頁面；若持續發生，請回報畫面。</p>
      <button id="sr-retry-load" class="rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-3 text-sm font-black text-amber-300">重新載入</button>
    </div>`;
  document.getElementById('sr-retry-load')?.addEventListener('click', () => location.reload());
}

window.SecretRoomPublicAuth = Object.freeze({
  async ensure(auth, signInAnonymously) {
    if (typeof auth.authStateReady === 'function') {
      await deadline(auth.authStateReady(), 8000, '公開連線初始化逾時');
    }
    if (auth.currentUser?.isAnonymous) return auth.currentUser;
    const credential = await deadline(
      signInAnonymously(auth),
      12000,
      '公開連線建立逾時'
    );
    return credential.user;
  }
});

const watchdog = setTimeout(() => {
  const loading = document.getElementById('loading-screen');
  if (loading && !loading.classList.contains('hidden')) {
    showLoadFailure(new Error('網站初始化超過 20 秒'));
  }
}, 20000);

try {
  const response = await fetch(`app.js?v=${encodeURIComponent(build)}`, {
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(`app.js 載入失敗：${response.status}`);

  let source = await response.text();

  source = source.replace(
    /const emailjsConfig\s*=\s*\{[\s\S]*?\n\};/,
    'const emailjsConfig = { publicKey: "", serviceId: "", defaultTemplateId: "", templates: {} };'
  );

  source = source.replace(
    'app = initializeApp(firebaseConfig || {});',
    "app = initializeApp(firebaseConfig || {}, 'secretroom-public-runtime');"
  );

  source = source.replace(
    /await\s+signInAnonymously\(auth\);/g,
    'await window.SecretRoomPublicAuth.ensure(auth, signInAnonymously);'
  );

  source = source.replace(
    'const docSnap = await getDoc(appRef);',
    "const docSnap = await withTimeout(getDoc(appRef), 12000, '會員資料載入逾時，請重新整理頁面。');"
  );

  source = source.replace(
    "showToast('伺服器連線異常，請稍後重試。', 'error');",
    "showToast(error?.message || '伺服器連線異常，請稍後重試。', 'error'); hideLoading(); navigate('landing');"
  );

  source = source.replaceAll(
    "localStorage.removeItem('sr_username');",
    "localStorage.removeItem('sr_username'); window.SRSecureAuth?.signOutMember?.();"
  );

  window.emailjs = Object.freeze({
    init() {},
    async send() {
      return { status: 202, text: 'telegram_migration' };
    }
  });

  const blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  try {
    await import(blobUrl);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }

  await import(`./sr_auth_migration.js?v=${encodeURIComponent(build)}`);
  await import(`./sr_telegram_platform.js?v=${encodeURIComponent(build)}`);
} catch (error) {
  showLoadFailure(error);
} finally {
  clearTimeout(watchdog);
}
