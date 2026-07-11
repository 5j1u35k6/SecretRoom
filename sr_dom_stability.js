// SecretRoom DOM stability guard.
// Avoids no-op DOM writes from compatibility overlays, reducing redundant MutationObserver work.
(() => {
  if (window.__SR_DOM_STABILITY__) return;
  window.__SR_DOM_STABILITY__ = true;

  function guardSetter(prototype, property) {
    if (!prototype) return;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
    if (!descriptor?.get || !descriptor?.set || descriptor.set.__srGuarded) return;
    const guardedSetter = function(value) {
      const next = value == null ? '' : String(value);
      let current = '';
      try { current = descriptor.get.call(this); } catch (_) {}
      if (current === next) return;
      return descriptor.set.call(this, value);
    };
    guardedSetter.__srGuarded = true;
    Object.defineProperty(prototype, property, {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set: guardedSetter
    });
  }

  guardSetter(window.Node?.prototype, 'textContent');
  guardSetter(window.Element?.prototype, 'innerHTML');
})();