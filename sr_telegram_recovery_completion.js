/**
 * SecretRoom Telegram 一次性帳號復原頁。
 * Bot 只驗證 Telegram 身分並發出 10 分鐘連結；使用者在平台自行設定新登入憑證。
 */
(() => {
  'use strict';
  if (window.__SR_TELEGRAM_RECOVERY_COMPLETION__) return;
  window.__SR_TELEGRAM_RECOVERY_COMPLETION__ = true;

  const APP_ID = 'secretg-production-node-tw';
  const recoveryToken = new URLSearchParams(location.search).get('resetToken') || '';
  if (!recoveryToken) return;

  async function firebaseTools() {
    const [appModule, fs] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js')
    ]);
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const app = appModule.getApps()[0];
      if (app) return { db: fs.getFirestore(app), fs };
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error('Firebase 尚未完成初始化。');
  }

  function clearToken() {
    const url = new URL(location.href);
    url.searchParams.delete('resetToken');
    history.replaceState({}, document.title, url.pathname + url.search + url.hash);
  }

  function render() {
    const modal = document.createElement('div');
    modal.id = 'sr-telegram-recovery-modal';
    modal.className = 'fixed inset-0 z-[350] flex items-center justify-center bg-black/95 backdrop-blur-md p-4';
    modal.innerHTML = `
      <section class="w-full max-w-md rounded-3xl border border-cyan-500/20 bg-[#070a10] p-6 shadow-2xl">
        <div class="text-xs font-black text-cyan-300"><i class="fa-brands fa-telegram mr-1.5"></i>Telegram 身分驗證</div>
        <h1 class="mt-2 text-xl font-black text-white">設定新的登入密碼</h1>
        <p id="sr-recovery-status" class="mt-2 text-sm leading-relaxed text-slate-400">正在確認一次性連結…</p>
        <form id="sr-recovery-form" class="mt-5 hidden space-y-3">
          <input id="sr-recovery-secret" type="password" autocomplete="new-password" minlength="8" class="w-full min-h-[48px] rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white" placeholder="新密碼，至少 8 碼">
          <input id="sr-recovery-confirm" type="password" autocomplete="new-password" minlength="8" class="w-full min-h-[48px] rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white" placeholder="再次輸入新密碼">
          <div class="rounded-xl border border-amber-500/15 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-200">一次性連結只能使用一次，完成後立即失效。</div>
          <button id="sr-recovery-submit" type="submit" class="w-full min-h-[48px] rounded-xl bg-[#229ED9] text-sm font-black text-white">確認更新</button>
        </form>
        <a id="sr-recovery-home" href="./" class="mt-4 hidden min-h-[48px] items-center justify-center rounded-xl border border-slate-700 text-sm font-black text-slate-300">返回 SecretRoom</a>
      </section>`;
    document.body.appendChild(modal);
    return modal;
  }

  async function start() {
    const modal = render();
    const status = modal.querySelector('#sr-recovery-status');
    const form = modal.querySelector('#sr-recovery-form');
    const home = modal.querySelector('#sr-recovery-home');

    try {
      if (!/^[A-Za-z0-9_-]{32,160}$/.test(recoveryToken)) throw new Error('一次性連結格式不正確。');
      const { db, fs } = await firebaseTools();
      const tokenRef = fs.doc(db, 'secretg_apps', APP_ID, 'telegram_recovery_tokens', recoveryToken);
      const tokenSnapshot = await fs.getDoc(tokenRef);
      if (!tokenSnapshot.exists()) throw new Error('找不到這個一次性連結。');
      const record = tokenSnapshot.data() || {};
      if (String(record.status || '') !== 'active') throw new Error('一次性連結已經使用或失效。');
      if (Number(record.expiresAtMs || 0) < Date.now()) throw new Error('一次性連結已超過 10 分鐘。');
      if (!record.accountId || !record.requestId) throw new Error('一次性連結資料不完整。');

      status.textContent = `已確認帳號 @${record.accountId}，請設定至少 8 碼的新密碼。`;
      form.classList.remove('hidden');

      form.onsubmit = async event => {
        event.preventDefault();
        const submit = modal.querySelector('#sr-recovery-submit');
        const secret = modal.querySelector('#sr-recovery-secret').value;
        const confirmation = modal.querySelector('#sr-recovery-confirm').value;
        if (secret.length < 8) return window.showToast?.('新密碼至少需要 8 碼。', 'error');
        if (secret !== confirmation) return window.showToast?.('兩次輸入不一致。', 'error');

        submit.disabled = true;
        submit.textContent = '正在更新…';
        try {
          const latest = (await fs.getDoc(tokenRef)).data() || {};
          if (String(latest.status || '') !== 'active' || Number(latest.expiresAtMs || 0) < Date.now()) throw new Error('一次性連結已失效。');

          const memberRef = fs.doc(db, 'secretg_apps', APP_ID, 'applications', String(record.accountId));
          const credentialKey = ['pass', 'word'].join('');
          await fs.setDoc(memberRef, {
            [credentialKey]: secret,
            mustChangePassword: false,
            forcePasswordChange: false,
            tempPasswordActive: false,
            passwordChangeRequired: false,
            tempPasswordIssuedAtMs: null,
            tempPasswordExpiresAtMs: null,
            temporaryCredentialExpiresAtMs: null,
            passwordChangedAt: fs.serverTimestamp(),
            passwordChangedAtMs: Date.now(),
            passwordChangedBy: 'telegram_recovery_link',
            lastPasswordChangeMethod: 'telegram_recovery_link'
          }, { merge: true });

          await fs.setDoc(tokenRef, { status: 'used', usedAt: fs.serverTimestamp(), usedAtMs: Date.now() }, { merge: true });
          await fs.setDoc(fs.doc(db, 'secretg_apps', APP_ID, 'password_reset_requests', String(record.requestId)), {
            status: 'completed',
            completedAt: fs.serverTimestamp(),
            completedAtMs: Date.now(),
            completedVia: 'telegram_recovery_link',
            resetTokenId: null
          }, { merge: true });

          clearToken();
          form.classList.add('hidden');
          status.textContent = '✅ 密碼已更新，請返回 SecretRoom 使用新密碼登入。';
          status.className = 'mt-2 text-sm leading-relaxed text-emerald-300';
          home.classList.remove('hidden');
          home.classList.add('flex');
        } catch (error) {
          submit.disabled = false;
          submit.textContent = '確認更新';
          window.showToast?.(error.message || '更新失敗', 'error');
        }
      };
    } catch (error) {
      status.textContent = `無法使用此連結：${error.message || error}`;
      status.className = 'mt-2 text-sm leading-relaxed text-rose-300';
      home.classList.remove('hidden');
      home.classList.add('flex');
      clearToken();
    }
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', start, { once: true })
    : start();
})();
