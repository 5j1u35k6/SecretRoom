// SecretRoom: replace the retired X badge step with Telegram binding.
(() => {
  if (window.__SR_TELEGRAM_BADGE_PATCH__) return;
  window.__SR_TELEGRAM_BADGE_PATCH__ = true;
  let queued = false;

  function bound() {
    return typeof window.SRTelegramBound === 'function'
      ? window.SRTelegramBound(window.state?.userData || {})
      : Boolean(window.state?.userData?.telegramInfo);
  }

  function patchBadge() {
    const card = document.getElementById('sr-phase3-badge-steps');
    if (!card) return;
    const old = card.querySelector('[data-sr-next="x"], [data-sr-next="telegram"]');
    if (bound()) {
      old?.remove();
    } else if (old) {
      old.dataset.srNext = 'telegram';
      old.textContent = '完成 Telegram 綁定';
      old.onclick = () => window.SROpenTelegramBinding?.();
    }
    const actionButtons = card.querySelectorAll('[data-sr-next]');
    const heading = card.querySelector('h3');
    if (heading && actionButtons.length === 0) heading.textContent = '目前主要項目都完成了';
  }

  function removeXArtifacts() {
    ['sr-x-oauth-modal', 'sr-x-oauth-processing', 'sr-x-modal'].forEach(id => document.getElementById(id)?.remove());
  }

  function apply() {
    queued = false;
    removeXArtifacts();
    patchBadge();
    document.documentElement.dataset.srTelegramRestored = '20260711-v1';
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  apply();
})();
