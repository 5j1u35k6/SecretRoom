// SecretRoom early audio/BGM control
// Loaded before app.js so generated audio and WebAudio can be muted before playback starts.
(() => {
  const KEY = 'sr_bgm_muted';
  const LEGACY_KEY = 'sr_bgm_enabled';
  const contexts = new Set();
  const media = new Set();
  const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
  const NativeOfflineAudioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const nativePlay = window.HTMLMediaElement?.prototype?.play;
  const nativeResume = NativeAudioContext?.prototype?.resume;
  const nativeSetItem = window.localStorage?.setItem?.bind(window.localStorage);
  let applyingMuteState = false;
  let luxuryBgmRef = null;
  let scheduled = false;

  function muted() {
    const saved = localStorage.getItem(KEY);
    if (saved !== null) return saved !== '0';
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy === 'false') return true;
    if (legacy === 'true') return false;
    return true;
  }

  function syncLegacy(isMuted) {
    try {
      applyingMuteState = true;
      nativeSetItem?.(KEY, isMuted ? '1' : '0');
      nativeSetItem?.(LEGACY_KEY, isMuted ? 'false' : 'true');
    } finally {
      applyingMuteState = false;
    }
  }

  function rememberMedia(element) {
    if (element) media.add(element);
    return element;
  }

  function updateUi(isMuted = muted()) {
    document.documentElement.classList.toggle('sr-bgm-muted', isMuted);
    const widget = document.getElementById('bgm-controller-widget');
    widget?.classList.toggle('sr-bgm-muted', isMuted);
    widget?.classList.toggle('bgm-active', !isMuted);
    const icon = document.getElementById('bgm-icon');
    if (icon) icon.className = `fa-solid ${isMuted ? 'fa-volume-xmark' : 'fa-play'} text-[9px]`;
    const status = document.getElementById('bgm-status-text');
    if (status) status.textContent = isMuted ? '音樂已關閉' : '背景音樂';
    const bars = document.getElementById('bgm-bars');
    bars?.classList.toggle('bgm-active', !isMuted);
    const mobileText = document.getElementById('mobile-menu-bgm-text');
    if (mobileText) mobileText.textContent = isMuted ? '音樂已關閉' : '貴賓室音樂';
  }

  function muteMediaElement(element, isMuted = muted()) {
    if (!element) return;
    rememberMedia(element);
    try {
      if (element.dataset && element.dataset.srOriginalVolume === undefined) element.dataset.srOriginalVolume = String(element.volume || 0.45);
      element.muted = isMuted;
      element.defaultMuted = isMuted;
      element.volume = isMuted ? 0 : Math.min(Math.max(Number(element.dataset?.srOriginalVolume || 0.45), 0.18), 0.75);
      if (isMuted) element.pause?.();
    } catch (_) {}
  }

  function stopKnownObjects(isMuted) {
    const objects = [luxuryBgmRef, window.srBgm, window.bgm, window.audioEngine, window.musicEngine].filter(Boolean);
    objects.forEach(object => {
      try { object.isPlaying = !isMuted; } catch (_) {}
      try { object.enabled = !isMuted; } catch (_) {}
      try { object.muted = isMuted; } catch (_) {}
      try { object.volume = isMuted ? 0 : (object.volume || 0.45); } catch (_) {}
      ['audio', 'music', 'player', 'element'].forEach(key => { if (object[key]) muteMediaElement(object[key], isMuted); });
      if (isMuted) ['stop', 'pause', 'mute'].forEach(name => { try { object[name]?.(); } catch (_) {} });
    });
  }

  function applyMuted(isMuted = muted()) {
    syncLegacy(isMuted);
    document.querySelectorAll('audio,video').forEach(element => muteMediaElement(element, isMuted));
    media.forEach(element => muteMediaElement(element, isMuted));
    contexts.forEach(context => {
      try {
        if (isMuted && context.state !== 'closed') context.suspend?.();
        if (!isMuted && context.state === 'suspended') nativeResume?.call(context)?.catch?.(() => {});
      } catch (_) {}
    });
    stopKnownObjects(isMuted);
    updateUi(isMuted);
  }

  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyMuted(muted());
    });
  }

  if (nativeSetItem) {
    window.localStorage.setItem = function(key, value) {
      if (!applyingMuteState && key === LEGACY_KEY && String(value) === 'true' && muted()) {
        scheduleApply();
        return nativeSetItem(LEGACY_KEY, 'false');
      }
      const result = nativeSetItem(key, value);
      if (key === KEY || key === LEGACY_KEY) scheduleApply();
      return result;
    };
  }

  try {
    Object.defineProperty(window, 'luxuryBgm', {
      configurable: true,
      get() { return luxuryBgmRef; },
      set(value) {
        luxuryBgmRef = value;
        scheduleApply();
      }
    });
  } catch (_) {}

  if (NativeAudioContext) {
    const WrappedAudioContext = function(...args) {
      const context = new NativeAudioContext(...args);
      contexts.add(context);
      if (muted()) queueMicrotask(() => { try { context.suspend?.(); } catch (_) {} });
      return context;
    };
    WrappedAudioContext.prototype = NativeAudioContext.prototype;
    Object.setPrototypeOf(WrappedAudioContext, NativeAudioContext);
    window.AudioContext = WrappedAudioContext;
    if (window.webkitAudioContext) window.webkitAudioContext = WrappedAudioContext;

    if (nativeResume && !nativeResume.__srGuarded) {
      const guardedResume = function(...args) {
        contexts.add(this);
        if (muted()) {
          try { this.suspend?.(); } catch (_) {}
          scheduleApply();
          return Promise.resolve();
        }
        return nativeResume.apply(this, args);
      };
      guardedResume.__srGuarded = true;
      NativeAudioContext.prototype.resume = guardedResume;
    }
  }

  if (NativeOfflineAudioContext) {
    const WrappedOfflineAudioContext = function(...args) {
      const context = new NativeOfflineAudioContext(...args);
      contexts.add(context);
      return context;
    };
    WrappedOfflineAudioContext.prototype = NativeOfflineAudioContext.prototype;
    Object.setPrototypeOf(WrappedOfflineAudioContext, NativeOfflineAudioContext);
    window.OfflineAudioContext = WrappedOfflineAudioContext;
    if (window.webkitOfflineAudioContext) window.webkitOfflineAudioContext = WrappedOfflineAudioContext;
  }

  if (nativePlay) {
    window.HTMLMediaElement.prototype.play = function(...args) {
      rememberMedia(this);
      if (muted()) {
        muteMediaElement(this, true);
        return Promise.resolve();
      }
      return nativePlay.apply(this, args);
    };
  }

  document.addEventListener('click', event => {
    const hit = event.target?.closest?.('#bgm-controller-widget,#bgm-toggle-btn,#mobile-menu-bgm-toggle,[data-sr-bgm-toggle]');
    if (!hit) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    applyMuted(!muted());
  }, true);

  function installStyle() {
    if (document.getElementById('sr-audio-control-style')) return;
    const style = document.createElement('style');
    style.id = 'sr-audio-control-style';
    style.textContent = `
      html.sr-bgm-muted #bgm-controller-widget{opacity:.72!important;filter:saturate(.7)!important;}
      html.sr-bgm-muted .bgm-bar{animation:none!important;transform:scaleY(.55)!important;}
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('DOMContentLoaded', () => {
    installStyle();
    applyMuted(muted());
    new MutationObserver(records => {
      if (!muted()) return;
      const relevant = records.some(record => [...record.addedNodes].some(node => node instanceof Element && (node.matches?.('audio,video,#bgm-controller-widget,#mobile-menu-bgm-toggle') || node.querySelector?.('audio,video,#bgm-controller-widget,#mobile-menu-bgm-toggle'))));
      if (relevant) scheduleApply();
    }).observe(document.body, { childList: true, subtree: true });
  });

  window.addEventListener('storage', event => {
    if (event.key === KEY || event.key === LEGACY_KEY) scheduleApply();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleApply(); });
  window.SR_AUDIO = { muted, setMuted: applyMuted, contexts, media };
})();