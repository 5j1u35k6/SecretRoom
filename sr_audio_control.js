// SecretRoom early audio/BGM control
// Loaded before app.js so generated audio and WebAudio can be muted before playback starts.
(() => {
  const KEY = 'sr_bgm_muted';
  const contexts = new Set();
  const media = new Set();
  const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
  const NativeOfflineAudioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const nativePlay = window.HTMLMediaElement?.prototype?.play;

  function muted() { return localStorage.getItem(KEY) === '1'; }

  function rememberMedia(el) {
    if (el) media.add(el);
    return el;
  }

  function updateUi(isMuted = muted()) {
    document.documentElement.classList.toggle('sr-bgm-muted', isMuted);
    const widget = document.getElementById('bgm-controller-widget');
    widget?.classList.toggle('sr-bgm-muted', isMuted);
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
    const keys = ['luxuryBgm', 'srBgm', 'bgm', 'audioEngine', 'musicEngine'];
    keys.forEach(key => {
      const obj = window[key];
      if (!obj) return;
      try { obj.isPlaying = !isMuted; } catch (_) {}
      try { obj.enabled = !isMuted; } catch (_) {}
      try { obj.muted = isMuted; } catch (_) {}
      try { obj.volume = isMuted ? 0 : (obj.volume || 0.45); } catch (_) {}
      ['audio', 'music', 'player', 'element'].forEach(k => { if (obj[k]) muteMediaElement(obj[k], isMuted); });
      if (isMuted) ['stop', 'pause', 'mute', 'destroy'].forEach(fn => { try { obj[fn]?.(); } catch (_) {} });
    });
  }

  function applyMuted(isMuted = muted()) {
    localStorage.setItem(KEY, isMuted ? '1' : '0');
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
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;650;700;800;900&family=Noto+Sans+SC:wght@300;400;500;700;900&family=Noto+Sans+TC:wght@300;400;500;700;900&family=Noto+Sans+JP:wght@300;400;500;700;900&family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap');
      html.sr-bgm-muted #bgm-controller-widget{opacity:.72!important;filter:saturate(.7)!important;}
      html.sr-bgm-muted .bgm-bar{animation:none!important;transform:scaleY(.55)!important;}
      html[lang="zh-CN"] body,html[lang="zh-CN"] body *,html[lang="zh-CN"] .font-luxury,html[lang="zh-CN"] .font-serif{font-family:Inter,"Noto Sans SC","Noto Sans TC",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;}
      html[lang="ja"] body,html[lang="ja"] body *,html[lang="ja"] .font-luxury,html[lang="ja"] .font-serif{font-family:Inter,"Noto Sans JP","Noto Sans TC",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;}
      html[lang="ko"] body,html[lang="ko"] body *,html[lang="ko"] .font-luxury,html[lang="ko"] .font-serif{font-family:Inter,"Noto Sans KR","Noto Sans TC",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;}
      html[lang="en"] body,html[lang="en"] body *,html[lang="en"] .font-luxury,html[lang="en"] .font-serif{font-family:Inter,"Noto Sans TC",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;}
      i.fa-solid,i.fa-regular,i.fa-brands{font-family:"Font Awesome 6 Free","Font Awesome 6 Brands"!important;}
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('DOMContentLoaded', () => {
    installStyle();
    applyMuted(muted());
  });

  setInterval(() => { if (muted()) applyMuted(true); }, 500);
  window.SR_AUDIO = { muted, setMuted: applyMuted, contexts, media };
})();
