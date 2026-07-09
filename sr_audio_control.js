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
  const nativeSetItem = window.localStorage?.setItem?.bind(window.localStorage);
  let applyingMuteState = false;
  let luxuryBgmRef = null;

  function muted() {
    const saved = localStorage.getItem(KEY);
    if (saved !== null) return saved !== '0';
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy === 'false') return true;
    if (legacy === 'true') return false;
    return true; // Default to quiet. User can explicitly enable BGM.
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

  function rememberMedia(el) {
    if (el) media.add(el);
    return el;
  }

  function updateUi(isMuted = muted()) {
    document.documentElement.classList.toggle('sr-bgm-muted', isMuted);
    const widget = document.getElementById('bgm-controller-widget');
    widget?.classList.toggle('sr-bgm-muted', isMuted);
    widget?.classList.toggle('bgm-active', !isMuted);
    const icon = document.getElementById('bgm-icon');
    if (icon) icon.className = `fa-solid ${isMuted ? 'fa-volume-xmark' : 'fa-play'} text-[9px]`;
    const status = document.getElementById('bgm-status-text');
    if (status) status.textContent = isMuted ? 'Audio Muted' : 'Bgm Audio';
    const bars = document.getElementById('bgm-bars');
    bars?.classList.toggle('bgm-active', !isMuted);
    const mobileText = document.getElementById('mobile-menu-bgm-text');
    if (mobileText) mobileText.textContent = isMuted ? 'Audio Muted' : 'Premium Vip Lounge';
  }

  function muteMediaElement(el, isMuted = muted()) {
    if (!el) return;
    rememberMedia(el);
    try {
      if (el.dataset && el.dataset.srOriginalVolume === undefined) el.dataset.srOriginalVolume = String(el.volume || 0.45);
      el.muted = isMuted;
      el.defaultMuted = isMuted;
      el.volume = isMuted ? 0 : Math.min(Math.max(Number(el.dataset?.srOriginalVolume || 0.45), 0.18), 0.75);
      if (isMuted) el.pause?.();
    } catch (_) {}
  }

  function stopKnownObjects(isMuted) {
    const objects = [luxuryBgmRef, window.srBgm, window.bgm, window.audioEngine, window.musicEngine].filter(Boolean);
    objects.forEach(obj => {
      try { obj.isPlaying = !isMuted; } catch (_) {}
      try { obj.enabled = !isMuted; } catch (_) {}
      try { obj.muted = isMuted; } catch (_) {}
      try { obj.volume = isMuted ? 0 : (obj.volume || 0.45); } catch (_) {}
      ['audio', 'music', 'player', 'element'].forEach(k => { if (obj[k]) muteMediaElement(obj[k], isMuted); });
      if (isMuted) ['stop', 'pause', 'mute'].forEach(fn => { try { obj[fn]?.(); } catch (_) {} });
    });
  }

  function applyMuted(isMuted = muted()) {
    syncLegacy(isMuted);
    document.querySelectorAll('audio,video').forEach(el => muteMediaElement(el, isMuted));
    media.forEach(el => muteMediaElement(el, isMuted));
    contexts.forEach(ctx => {
      try {
        if (isMuted && ctx.state !== 'closed') ctx.suspend?.();
        if (!isMuted && ctx.state === 'suspended') ctx.resume?.().catch(() => {});
      } catch (_) {}
    });
    stopKnownObjects(isMuted);
    updateUi(isMuted);
  }

  if (nativeSetItem) {
    window.localStorage.setItem = function(key, value) {
      if (!applyingMuteState && key === LEGACY_KEY && String(value) === 'true' && muted()) {
        return nativeSetItem(LEGACY_KEY, 'false');
      }
      return nativeSetItem(key, value);
    };
  }

  try {
    Object.defineProperty(window, 'luxuryBgm', {
      configurable: true,
      get() { return luxuryBgmRef; },
      set(value) {
        luxuryBgmRef = value;
        setTimeout(() => applyMuted(muted()), 0);
      }
    });
  } catch (_) {}

  if (NativeAudioContext) {
    const WrappedAudioContext = function(...args) {
      const ctx = new NativeAudioContext(...args);
      contexts.add(ctx);
      if (muted()) setTimeout(() => { try { ctx.suspend?.(); } catch (_) {} }, 0);
      return ctx;
    };
    WrappedAudioContext.prototype = NativeAudioContext.prototype;
    Object.setPrototypeOf(WrappedAudioContext, NativeAudioContext);
    window.AudioContext = WrappedAudioContext;
    if (window.webkitAudioContext) window.webkitAudioContext = WrappedAudioContext;
  }

  if (NativeOfflineAudioContext) {
    const WrappedOfflineAudioContext = function(...args) {
      const ctx = new NativeOfflineAudioContext(...args);
      contexts.add(ctx);
      return ctx;
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
  });

  setInterval(() => { if (muted()) applyMuted(true); }, 300);
  window.SR_AUDIO = { muted, setMuted: applyMuted, contexts, media };
})();