// SecretRoom phase three: make shared Firebase access resilient during initial page load.
(() => {
  if (window.__SR_PHASE3_FIREBASE_READY__) return;
  window.__SR_PHASE3_FIREBASE_READY__ = true;
  if (!window.SRP?.tools || window.SRP.tools.__srReadyWrapped) return;

  const original = window.SRP.tools;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const wrapped = async () => {
    let lastError = null;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      try {
        return await original();
      } catch (error) {
        lastError = error;
        if (!/Firebase 尚未初始化|no Firebase App/i.test(String(error?.message || error))) throw error;
        await wait(100);
      }
    }
    throw lastError || new Error('Firebase 初始化逾時');
  };
  wrapped.__srReadyWrapped = true;
  window.SRP.tools = wrapped;
})();
