/* SecretRoom consolidated frontend runtime. */
;(() => {
/* SecretRoom backend runtime configuration. */
window.SecretRoomBackendConfig = Object.freeze({
  backendUrl: ['https://secretroom-telegram-webhook', 'max19450', 'workers.dev'].join('.'),
  strictAuth: false
});
  const deadline = (promise, ms, message) => Promise.race([Promise.resolve(promise), new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))]);
  window.SecretRoomPublicAuth = Object.freeze({ async ensure(auth, signInAnonymously) {
    if (typeof auth.authStateReady === 'function') await deadline(auth.authStateReady(), 8000, '公開連線初始化逾時');
    if (auth.currentUser?.isAnonymous) return auth.currentUser;
    return (await deadline(signInAnonymously(auth), 12000, '公開連線建立逾時')).user;
  } });
  window.emailjs = Object.freeze({ init() {}, async send() { return { status: 202, text: 'telegram_migration' }; } });
})();
/* SecretRoom frontend consolidated runtime.
 * Generated from the previously separated runtime modules in their original execution order.
 * Keep feature sections isolated with IIFEs to preserve their former module scopes.
 */

/* ===== Integrated frontend runtime coordinator ===== */
;(() => {
  if (window.__SR_RUNTIME__) return;
  const tasks = new Set();
  let queued = false;
  const run = () => {
    queued = false;
    tasks.forEach(task => {
      try { task(); } catch (error) { console.error('Frontend runtime task failed:', error); }
    });
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(run);
  };
  window.__SR_RUNTIME__ = true;
  window.SRRuntime = Object.freeze({
    register(task) { if (typeof task === 'function') tasks.add(task); schedule(); return () => tasks.delete(task); },
    schedule
  });
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', schedule, { once: true });

  document.addEventListener('click', event => {
    const button = event.target?.closest?.('#sr-feed-load-more');
    if (!button || !window.state) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    window.state.visiblePostsCount = Number(window.state.visiblePostsCount || 5) + 5;
    window.setGlobalFilter?.(window.state.currentFilter || 'recommended');
  }, true);
})();

/* ===== Consolidated source: sr_audio_control.js ===== */
;(() => {
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
    if (icon) icon.className = `fa-solid ${isMuted ? 'fa-volume-xmark' : 'fa-play'} text-sm`;
    const status = document.getElementById('bgm-status-text');
    if (status) status.textContent = isMuted ? '音樂已關閉' : '背景音樂播放中';
    const toggle = document.getElementById('bgm-toggle-btn');
    if (toggle) { const label=isMuted?'播放背景音樂':'關閉背景音樂'; toggle.setAttribute('aria-label',label); toggle.setAttribute('aria-pressed',String(!isMuted)); toggle.title=label; }
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
})();

/* ===== Consolidated source: app.js ===== */
;(() => {
let initializeApp, getAuth, signInAnonymously, onAuthStateChanged;
        let getFirestore, doc, setDoc, getDoc, collection, query, onSnapshot, updateDoc, getDocs, where, deleteDoc, serverTimestamp;
  
        const appId = 'secretg-production-node-tw'; 
        
        const firebaseConfig = {
            apiKey: "AIzaSyCNgJxYjC90DjtvTSaze5CREJf1Vt32aYQ",
            authDomain: "secretroom-ef728.firebaseapp.com",
            projectId: "secretroom-ef728",
            storageBucket: "secretroom-ef728.firebasestorage.app",
            messagingSenderId: "22006617218",
            appId: "1:22006617218:web:9e9af5c6558ea57dcb109b"
        };
  
        const emailjsConfig = { publicKey: "", serviceId: "", defaultTemplateId: "", templates: {} };
  
        const telegramBotName = "SecretRoomtwBot"; 

        async function processAndCompressImageFile(file, maxDim = 300, quality = 0.7, addWatermarkText = null) {
            if (!file || !/^image\/(jpeg|png|webp)$/i.test(file.type || '')) throw new Error('僅支援 JPG、PNG 或 WebP 圖片格式。');
            if (file.size > 8 * 1024 * 1024) throw new Error('單張圖片不可超過 8MB。');
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onerror = () => reject(new Error("File reading failed"));
                reader.onload = (e) => {
                    const img = new Image();
                    img.onerror = () => reject(new Error("Image loading failed"));
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let w = img.width;
                        let h = img.height;
                        if (w > maxDim || h > maxDim) {
                            if (w > h) {
                                h = Math.round((h * maxDim) / w);
                                w = maxDim;
                            } else {
                                w = Math.round((w * maxDim) / h);
                                h = maxDim;
                            }
                        }
                        canvas.width = w;
                        canvas.height = h;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, w, h);

                        if (addWatermarkText) {
                            const watermarkText = String(addWatermarkText || '').trim() || getWatermarkText();
                            const fontSize = Math.max(10, Math.round(Math.min(w, h) * 0.028));
                            const stepX = Math.max(170, Math.round(fontSize * 13.5));
                            const stepY = Math.max(118, Math.round(fontSize * 9.2));

                            ctx.save();
                            ctx.translate(w / 2, h / 2);
                            ctx.rotate(Math.PI / 4);
                            ctx.font = `600 ${fontSize}px Cinzel, Inter, sans-serif`;
                            ctx.fillStyle = "rgba(244, 247, 251, 0.028)";
                            ctx.textAlign = "center";
                            ctx.textBaseline = "middle";
                            ctx.shadowColor = "rgba(0, 0, 0, 0.10)";
                            ctx.shadowBlur = Math.max(1, Math.round(fontSize * 0.04));

                            const spanX = Math.ceil((w + h) * 1.15);
                            const spanY = Math.ceil((w + h) * 1.15);
                            for (let yPos = -spanY; yPos <= spanY; yPos += stepY) {
                                for (let xPos = -spanX; xPos <= spanX; xPos += stepX) {
                                    ctx.fillText(watermarkText, xPos, yPos);
                                }
                            }
                            ctx.restore();
                        }

                        resolve(canvas.toDataURL('image/jpeg', quality));
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            });
        }
  
        async function loadFirebaseSDKs() {
            try {
                const [appMod, authMod, firestoreMod] = await Promise.all([
                    import("https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js"),
                    import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js"),
                    import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js")
                ]);
  
                initializeApp = appMod.initializeApp;
                getAuth = authMod.getAuth;
                signInAnonymously = authMod.signInAnonymously;
                onAuthStateChanged = authMod.onAuthStateChanged;
  
                getFirestore = firestoreMod.getFirestore;
                doc = firestoreMod.doc;
                setDoc = firestoreMod.setDoc;
                getDoc = firestoreMod.getDoc;
                collection = firestoreMod.collection;
                query = firestoreMod.query;
                onSnapshot = firestoreMod.onSnapshot;
                updateDoc = firestoreMod.updateDoc;
                getDocs = firestoreMod.getDocs;
                where = firestoreMod.where;
                deleteDoc = firestoreMod.deleteDoc;
                serverTimestamp = firestoreMod.serverTimestamp;
  
                return true;
            } catch (e) {
                console.error("無法與伺服器取得連線", e);
                return false;
            }
        }
  
        let app, db, auth;
  
        window.state = {
            currentView: 'landing',
            currentTab: 'feed', 
            currentFilter: 'recommended', 
            currentRankTag: null, 
            userId: null,
            applicationId: null,
            unsubscribeListener: null,
            unsubscribeUsersListener: null, 
            unsubscribeVisitorsListener: null,
            visiblePostsCount: 5,
            openComments: {}, 
            unlockedNsfwPosts: {},
            unlockedSpecVaultImages: {}, 
            visitors: [], 
            visitedProfilesInSession: {}, 
            viewedPostsInSession: {}, 
            searchTab: 'posts', 
            singlePostFocusId: null, 
            userData: {
                nickname: '', birthYear: '', birthMonth: '', birthDay: '',
                height: '', weight: '', length: '', girth: '', kinks: [], email: '', avatar: ''
            },
            kinksOptions: [
                "性愛偏好｜角色定位", "Bdsm｜繩縛", "制服愛好｜皮革/膠衣", "心理角色｜Daddy/Boy", "自我管理｜健身/健美", 
                "友善社交｜約會/派對", "體型美學｜壯碩/熊系", "特殊癖好｜穿戴玩物", "旅遊休閒｜友善旅遊", "數位社交｜交友軟體"
            ],
            posts: [], 
            activeUsers: [], 
            notifications: [],
            notificationInboxTab: 'unread',
            notificationTypeFilter: 'all',
            notificationReadSet: new Set(),
            searchTerm: '',
            searchTimeout: null,
            unsubscribeNotificationsListener: null,
            unsubscribeNotificationReadsListener: null
        };
  
        const appContainer = document.getElementById('app');

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                window.state.unlockedNsfwPosts = {};
                window.state.unlockedSpecVaultImages = {};
            }
        });

        function escapeHtml(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function escapeJsString(value) {
            return String(value ?? '')
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'")
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r');
        }

        function getWatermarkText(userId = window.state.applicationId) {
            const account = String(userId || 'member').replace(/^@+/, '').trim() || 'member';
            return `SecretRomm @${account}`;
        }

        function renderWatermarkOverlay(userId = window.state.applicationId, opacity = 0.055, compact = false) {
            const safeText = escapeHtml(getWatermarkText(userId));
            const items = Array.from({ length: compact ? 24 : 42 }, () => `<span>${safeText}</span>`).join('');
            return `<div class="sr-watermark-grid ${compact ? 'sr-watermark-compact' : ''}" style="--wm-opacity:${opacity};">${items}</div>`;
        }

        function showToast(message, type = 'info') {
            const container = document.getElementById('toast-container');
            if (!container) return;
            const toast = document.createElement('div');
            const bgColors = {
                error: 'bg-red-500/95 border-red-400',
                success: 'bg-emerald-600/95 border-emerald-400',
                info: 'bg-amber-600/95 border-amber-500'
            };
            toast.className = `${bgColors[type] || bgColors.info} text-white px-5 py-3.5 rounded-xl shadow-lg border border-white/10 text-sm font-semibold transition-all duration-300 opacity-0 transform -translate-y-4 backdrop-blur-xl flex items-center gap-3 pointer-events-auto shadow-[0_4px_25px_rgba(212,175,55,0.08)]`;
            const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
            toast.innerHTML = `<i class="fa-solid ${icon} text-lg text-white"></i> <span>${escapeHtml(message)}</span>`;
            container.appendChild(toast);
            requestAnimationFrame(() => toast.classList.remove('opacity-0', '-translate-y-4'));
            setTimeout(() => {
                toast.classList.add('opacity-0', '-translate-y-4');
                setTimeout(() => toast.remove(), 300);
            }, 3200);
        }
        window.showToast = showToast;

        function withTimeout(promise, ms = 12000, message = '操作逾時，請檢查網路後再試一次。') {
            let timer;
            const timeout = new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error(message)), ms);
            });
            return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
        }

        window.addEventListener('error', (event) => {
            console.error('Global runtime error:', event.error || event.message);
            if (window.showToast) window.showToast('操作未完成，請重新整理後再試一次。', 'error');
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            if (window.showToast) window.showToast('操作未完成，請稍後再試。', 'error');
        });

        document.addEventListener('click', (event) => {
            const target = event.target && event.target.closest ? event.target.closest('button, [role="button"], [onclick]') : null;
            if (!target) return;

            if (target.id === 'btn-login-submit' && typeof window.__srHandleLoginSubmit === 'function') {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                window.__srHandleLoginSubmit();
                return;
            }

            const inlineClick = target.getAttribute('onclick') || '';
            const deletePostMatch = inlineClick.match(/deleteMyPost\('([^']+)'\)/);
            if (deletePostMatch && typeof window.deleteMyPost === 'function') {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                window.deleteMyPost(deletePostMatch[1]);
            }
        }, true);

        function isGoldSpecApproved(user) {
            if (!user) return false;
            const status = String(user.specEliteStatus || '').toLowerCase();
            return user.isSpecElite === true || status === 'approved' || status === 'active' || status === 'passed';
        }

        function canAccessSpecVault() {
            return isGoldSpecApproved(window.state.userData || {});
        }

        function getNotificationReadSet() {
            const cloudSet = window.state.notificationReadSet instanceof Set ? window.state.notificationReadSet : new Set();
            try {
                const raw = localStorage.getItem('sr_notifications_read');
                const localSet = new Set(raw ? JSON.parse(raw) : []);
                return new Set([...localSet, ...cloudSet]);
            } catch (_) {
                return new Set(cloudSet);
            }
        }

        async function saveNotificationReadSet(readSet) {
            const values = Array.from(readSet).slice(-1000);
            window.state.notificationReadSet = new Set(values);
            try {
                localStorage.setItem('sr_notifications_read', JSON.stringify(values));
            } catch (_) {}
            if (!db || !window.state.applicationId) return;
            try {
                const readRef = doc(db, 'secretg_apps', appId, 'notification_reads', window.state.applicationId);
                await setDoc(readRef, { userId: window.state.applicationId, readIds: values, updatedAt: serverTimestamp(), updatedAtMs: Date.now() }, { merge: true });
            } catch (err) {
                console.warn('通知已讀狀態同步失敗:', err);
            }
        }

        function startNotificationReadSync() {
            if (!db || !window.state.applicationId || window.state.unsubscribeNotificationReadsListener) return;
            const readRef = doc(db, 'secretg_apps', appId, 'notification_reads', window.state.applicationId);
            window.state.unsubscribeNotificationReadsListener = onSnapshot(readRef, (snap) => {
                if (snap.exists()) {
                    const ids = Array.isArray(snap.data().readIds) ? snap.data().readIds : [];
                    window.state.notificationReadSet = new Set(ids.map(String));
                    try { localStorage.setItem('sr_notifications_read', JSON.stringify(ids.map(String).slice(-1000))); } catch (_) {}
                    updateNotificationIndicators();
                }
            }, (err) => console.warn('通知已讀狀態讀取失敗:', err));
        }

        function parseNotificationTimeValue(value) {
            if (value && value.seconds) return value.seconds * 1000;
            if (value && typeof value.toDate === 'function') {
                const d = value.toDate();
                return d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
            }
            if (typeof value === 'number') return value;
            if (typeof value === 'string') {
                const t = new Date(value).getTime();
                return Number.isNaN(t) ? 0 : t;
            }
            return 0;
        }

        function getStableLocalNotificationTime(id, fallbackValue) {
            const key = 'sr_notifications_fixed_times';
            const fallback = parseNotificationTimeValue(fallbackValue) || Date.now();
            try {
                const raw = localStorage.getItem(key);
                const map = raw ? JSON.parse(raw) : {};
                if (!map[id]) {
                    map[id] = fallback;
                    localStorage.setItem(key, JSON.stringify(map));
                }
                return map[id];
            } catch (_) {
                return fallback;
            }
        }

        function notificationTimeValue(item) {
            return parseNotificationTimeValue(item.createdAt || item.sentAt || item.createdAtMs || item.timestamp || item.updatedAt || item.reviewedAt);
        }

        function formatNotificationTime(value) {
            try {
                const timeValue = parseNotificationTimeValue(value);
                if (!timeValue) return '—';
                const date = new Date(timeValue);
                return date.toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
            } catch (_) {
                return '—';
            }
        }

        function notificationSortValue(item) {
            return notificationTimeValue(item);
        }

        function getNotificationTypeKey(item) {
            const raw = String(item.type || item.category || item.kind || '').toLowerCase();
            if (raw.includes('avatar')) return 'avatar';
            if (raw.includes('spec')) return 'spec';
            if (raw.includes('report')) return 'report';
            if (raw.includes('password')) return 'account';
            if (raw.includes('account')) return 'account';
            if (raw.includes('system')) return 'system';
            if (raw.includes('platform') || raw.includes('notice') || raw.includes('broadcast')) return 'platform';
            return 'platform';
        }

        function getNotificationTypeLabel(typeKey) {
            const labels = {
                all: '全部類型',
                platform: '官方通知',
                report: '檢舉進度',
                spec: '黃金 Spec',
                avatar: '頭像審核',
                account: '帳號安全',
                system: '系統提醒'
            };
            return labels[typeKey] || labels.platform;
        }

        function localStatusTimeFallback(user, keys) {
            for (const key of keys) {
                const value = user[key];
                const parsed = parseNotificationTimeValue(value);
                if (parsed) return parsed;
            }
            return Date.now();
        }

        function getLocalStatusNotifications() {
            const user = window.state.userData || {};
            const items = [];
            const avatarStatus = String(user.avatarStatus || '').toLowerCase();
            const specStatus = String(user.specEliteStatus || '').toLowerCase();
            const pushLocal = (item, fallbackKeys) => {
                const fallback = localStatusTimeFallback(user, fallbackKeys);
                items.push({ ...item, createdAtMs: getStableLocalNotificationTime(item.id, fallback) });
            };
            if (avatarStatus === 'pending') pushLocal({ id: `avatar-${window.state.applicationId}-pending`, type: 'avatar', tone: 'pending', title: '大頭照更換審核中', message: '新的個人大頭照已送交管理員審核，通過後會自動套用。' }, ['avatarSubmittedAt', 'avatarPendingAt', 'avatarUpdatedAt', 'updatedAt', 'createdAt']);
            else if (avatarStatus === 'approved') pushLocal({ id: `avatar-${window.state.applicationId}-approved`, type: 'avatar', tone: 'success', title: '大頭照更換已通過', message: '您的新頭像已完成審核並正式啟用。' }, ['avatarReviewedAt', 'avatarApprovedAt', 'avatarUpdatedAt', 'updatedAt', 'createdAt']);
            else if (avatarStatus === 'rejected') pushLocal({ id: `avatar-${window.state.applicationId}-rejected`, type: 'avatar', tone: 'error', title: '大頭照更換未通過', message: '本次大頭照更換未通過審核，您可以重新提交清晰且符合規範的照片。' }, ['avatarReviewedAt', 'avatarRejectedAt', 'avatarUpdatedAt', 'updatedAt', 'createdAt']);
            if (specStatus === 'pending') pushLocal({ id: `spec-${window.state.applicationId}-pending`, type: 'spec', tone: 'pending', title: '黃金 Spec 認證審核中', message: '您的黃金 Spec 認證照片已送出，管理員將依據規格證明進行人工核查。' }, ['specSubmittedAt', 'specEliteSubmittedAt', 'specUpdatedAt', 'updatedAt', 'createdAt']);
            else if (isGoldSpecApproved(user)) pushLocal({ id: `spec-${window.state.applicationId}-approved`, type: 'spec', tone: 'success', title: '黃金 Spec 認證已通過', message: '您已取得黃金 Spec 認證，S+ . S . G 功能已自動開啟。' }, ['specReviewedAt', 'specEliteReviewedAt', 'specApprovedAt', 'specUpdatedAt', 'updatedAt', 'createdAt']);
            else if (specStatus === 'rejected') pushLocal({ id: `spec-${window.state.applicationId}-rejected`, type: 'spec', tone: 'error', title: '黃金 Spec 認證未通過', message: '本次黃金 Spec 認證未通過，請確認照片清晰度與尺規參考後再重新申請。' }, ['specReviewedAt', 'specEliteReviewedAt', 'specRejectedAt', 'specUpdatedAt', 'updatedAt', 'createdAt']);
            return items;
        }

        function notificationMatchesCurrentUser(item) {
            if (!item) return false;
            const target = String(item.target || item.audience || '').toLowerCase();
            if (target === 'all' || target === 'everyone' || target === '全體會員') return true;
            if ((target === 'sg' || target === 's_plus_s_g' || target === 's.s+.g' || target === 's+ . s . g') && canAccessSpecVault()) return true;
            if (target === 'user' && String(item.recipientId || item.userId || '') === String(window.state.applicationId || '')) return true;
            if (!target && String(item.recipientId || '') === String(window.state.applicationId || '')) return true;
            return false;
        }

        function getNotificationItems() {
            const remoteItems = (window.state.notifications || []).filter(item => !item.revoked).filter(notificationMatchesCurrentUser);
            return [...remoteItems, ...getLocalStatusNotifications()].map(item => ({ ...item, id: String(item.id || item.notificationId || `${item.type || 'notice'}-${notificationSortValue(item)}`) })).sort((a, b) => notificationSortValue(b) - notificationSortValue(a));
        }

        function getUnreadNotificationCount() {
            const readSet = getNotificationReadSet();
            return getNotificationItems().filter(item => !readSet.has(item.id)).length;
        }

        function updateNotificationIndicators() {
            const count = getUnreadNotificationCount();
            ['aside-notification-count', 'mobile-notification-count'].forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                if (count > 0) {
                    el.textContent = count > 99 ? '99+' : String(count);
                    el.classList.remove('hidden');
                } else {
                    el.textContent = '';
                    el.classList.add('hidden');
                }
            });
            const tabContentContainer = document.getElementById('dashboard-tab-content');
            if (window.state.currentTab === 'notifications' && tabContentContainer) renderNotificationsTab(tabContentContainer);
        }

        async function createUserNotification(payload) {
            if (!db || !window.state.applicationId) return;
            try {
                const notifRef = doc(collection(db, 'secretg_apps', appId, 'notifications'));
                await setDoc(notifRef, { target: 'user', recipientId: window.state.applicationId, createdAt: serverTimestamp(), createdAtMs: Date.now(), ...payload });
            } catch (err) {
                console.warn('通知寫入失敗:', err);
            }
        }

        class LuxuryBgmPlayer {
            constructor() {
                this.tracks = {
                    mysterious: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3", 
                    lounge: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3"       
                };
                this.audio = null;
                this.currentTrack = null;
                this.isPlaying = false;
                this.fadeTimer = null;
            }

            init() {
                if (this.audio) return;
                this.audio = new Audio();
                this.audio.loop = true;
                this.audio.volume = 0; 

                this.audio.addEventListener('play', () => {
                    window.syncBGM();
                });
                this.audio.addEventListener('playing', () => {
                    window.syncBGM();
                });
                this.audio.addEventListener('pause', () => {
                    window.syncBGM();
                });
            }

            start(trackName) {
                this.init();
                const targetUrl = this.tracks[trackName];
                if (!targetUrl) return;

                if (this.currentTrack && this.currentTrack !== trackName) {
                    this.fadeSwitch(targetUrl, trackName);
                    return;
                }

                this.currentTrack = trackName;
                this.isPlaying = true;

                if (this.audio.src !== targetUrl) {
                    this.audio.src = targetUrl;
                    this.audio.load();
                }

                this.audio.play()
                    .then(() => {
                        this.fadeIn();
                        window.syncBGM();
                    })
                    .catch(err => {
                        console.warn("Autoplay deferred until first user interaction", err);
                        window.syncBGM();
                    });
            }

            stop() {
                this.isPlaying = false;
                if (this.audio) {
                    this.fadeOut(() => {
                        this.audio.pause();
                        window.syncBGM();
                    });
                }
            }

            fadeIn() {
                if (!this.audio) return;
                clearInterval(this.fadeTimer);
                
                let vol = this.audio.volume;
                this.fadeTimer = setInterval(() => {
                    if (!this.isPlaying) {
                        clearInterval(this.fadeTimer);
                        return;
                    }
                    vol += 0.02;
                    if (vol >= 0.35) { 
                        this.audio.volume = 0.35;
                        clearInterval(this.fadeTimer);
                    } else {
                        this.audio.volume = vol;
                    }
                }, 40);
            }

            fadeOut(callback) {
                if (!this.audio) {
                    if (callback) callback();
                    return;
                }
                clearInterval(this.fadeTimer);
                
                let vol = this.audio.volume;
                this.fadeTimer = setInterval(() => {
                    vol -= 0.02;
                    if (vol <= 0.01) {
                        this.audio.volume = 0;
                        clearInterval(this.fadeTimer);
                        if (callback) callback();
                    } else {
                        this.audio.volume = vol;
                    }
                }, 40);
            }

            fadeSwitch(newUrl, trackName) {
                this.fadeOut(() => {
                    this.currentTrack = trackName;
                    this.audio.src = newUrl;
                    this.audio.load();
                    if (this.isPlaying) {
                        this.audio.play()
                            .then(() => {
                                this.fadeIn();
                                window.syncBGM();
                            })
                            .catch(err => {
                                window.syncBGM();
                            });
                    }
                });
            }
        }

        window.luxuryBgm = new LuxuryBgmPlayer();

        localStorage.setItem('sr_bgm_enabled', 'true');
        window.luxuryBgm.isPlaying = true;

        window.togglePasswordVisibility = function(inputId, btn) {
            const input = document.getElementById(inputId);
            const icon = btn.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.className = 'fa-solid fa-eye text-xs text-amber-500';
            } else {
                input.type = 'password';
                icon.className = 'fa-solid fa-eye-slash text-xs text-slate-400';
            }
        };

        window.toggleBGMState = function() {
            if (!window.luxuryBgm) return;
            window.luxuryBgm.init();
            
            const isActuallyPlaying = window.luxuryBgm.audio && !window.luxuryBgm.audio.paused && window.luxuryBgm.isPlaying;

            if (isActuallyPlaying) {
                window.luxuryBgm.stop();
                localStorage.setItem('sr_bgm_enabled', 'false');
                showToast('背景音樂已靜音 🔇', 'info');
            } else {
                localStorage.setItem('sr_bgm_enabled', 'true');
                window.luxuryBgm.isPlaying = true; 
                window.syncBGM();
                const view = window.state.currentView;
                const wantsTrack = (view === 'dashboard') ? 'lounge' : 'mysterious';
                window.luxuryBgm.start(wantsTrack);
                showToast('背景音樂已開啟 🔊', 'success');
            }
        };

        window.syncBGM = function() {
            if (!window.luxuryBgm) return;
            const view = window.state.currentView;
            const wantsTrack = (view === 'dashboard') ? 'lounge' : 'mysterious';
            
            const widget = document.getElementById('bgm-controller-widget');
            const icon = document.getElementById('bgm-icon');
            const statusText = document.getElementById('bgm-status-text');

            if (widget) {
                if (view === 'dashboard') {
                    widget.classList.add('hidden');
                } else {
                    widget.classList.remove('hidden');
                }
            }

            const isActuallyPlaying = window.luxuryBgm.audio && !window.luxuryBgm.audio.paused && window.luxuryBgm.isPlaying;

            if (isActuallyPlaying) {
                if (widget) {
                    widget.classList.add('bgm-active');
                    if (icon) icon.className = 'fa-solid fa-pause text-[9px]';
                    if (statusText) statusText.textContent = (wantsTrack === 'lounge') ? 'Premium Vip Lounge' : 'Mystique Seclusion';
                }
            } else {
                if (widget) {
                    widget.classList.remove('bgm-active');
                    if (icon) icon.className = 'fa-solid fa-play text-[9px]';
                    if (statusText) statusText.textContent = 'Audio Muted';
                }
            }

            const sidebarBtn = document.getElementById('sidebar-bgm-btn');
            const sidebarBars = document.getElementById('sidebar-bgm-bars');
            const sidebarText = document.getElementById('sidebar-bgm-text');
            const sidebarIcon = document.getElementById('sidebar-bgm-icon');

            if (sidebarBtn) {
                if (isActuallyPlaying) {
                    sidebarBtn.classList.add('bgm-active');
                    if (sidebarBars) sidebarBars.classList.add('bgm-active');
                    if (sidebarText) sidebarText.textContent = 'Premium Vip Lounge';
                    if (sidebarIcon) sidebarIcon.className = 'fa-solid fa-pause text-[9px]';
                } else {
                    sidebarBtn.classList.remove('bgm-active');
                    if (sidebarBars) sidebarBars.classList.remove('bgm-active');
                    if (sidebarText) sidebarText.textContent = 'Audio Muted';
                    if (sidebarIcon) sidebarIcon.className = 'fa-solid fa-play text-[9px]';
                }
            }

            const mobileBgmText = document.getElementById('mobile-menu-bgm-text');
            const mobileBgmBtn = document.getElementById('mobile-menu-bgm-toggle');
            if (mobileBgmText) mobileBgmText.textContent = isActuallyPlaying ? 'Premium Vip Lounge' : 'Audio Muted';
            if (mobileBgmBtn) {
                const icon = mobileBgmBtn.querySelector('i');
                if (icon) icon.className = `fa-solid ${isActuallyPlaying ? 'fa-volume-high' : 'fa-volume-xmark'} text-amber-400`;
            }
        };

        const initBGMController = () => {
            const widget = document.getElementById('bgm-controller-widget');
            if (!widget) return;

            widget.onclick = (e) => {
                e.stopPropagation();
                window.toggleBGMState();
            };

            const autoStartOnInteraction = () => {
                if (localStorage.getItem('sr_bgm_enabled') !== 'false') {
                    localStorage.setItem('sr_bgm_enabled', 'true');
                    window.luxuryBgm.isPlaying = true;
                    const view = window.state.currentView;
                    const wantsTrack = (view === 'dashboard') ? 'lounge' : 'mysterious';
                    window.luxuryBgm.start(wantsTrack);
                }
                ['click', 'touchstart', 'mousedown', 'keydown'].forEach(evtName => {
                    window.removeEventListener(evtName, autoStartOnInteraction);
                    document.removeEventListener(evtName, autoStartOnInteraction);
                });
            };

            ['click', 'touchstart', 'mousedown', 'keydown'].forEach(evtName => {
                window.addEventListener(evtName, autoStartOnInteraction, { passive: true });
                document.addEventListener(evtName, autoStartOnInteraction, { passive: true });
            });
        };
  
        async function initApp() {
            if (emailjsConfig.publicKey && emailjsConfig.publicKey !== "YOUR_EMAILJS_PUBLIC_KEY") {
                emailjs.init({ publicKey: emailjsConfig.publicKey });
            }
  
            const firebaseLoaded = await loadFirebaseSDKs();
            
            if (firebaseLoaded) {
                try {
                    app = initializeApp(firebaseConfig || {}, 'secretroom-public-runtime');
                    db = getFirestore(app);
                    auth = getAuth(app);
  
                    await window.SecretRoomPublicAuth.ensure(auth, signInAnonymously);
                    onAuthStateChanged(auth, (user) => {
                        if (user) {
                            window.state.userId = user.uid;
                            checkExistingApplication();
                        }
                    });
                } catch (error) {
                    console.error("連線超時:", error);
                    showToast(error?.message || '伺服器連線異常，請稍後重試。', 'error'); hideLoading(); navigate('landing');
                }
            } else {
                showToast('無法建立通訊協定', 'error');
            }
        }
  
        async function checkExistingApplication() {
            if(!db) { hideLoading(); navigate('landing'); return; }
            try {
                const cachedUser = localStorage.getItem('sr_username');
                if (cachedUser) {
                    const appRef = doc(db, 'secretg_apps', appId, 'applications', cachedUser);
                    const docSnap = await withTimeout(getDoc(appRef), 12000, '會員資料載入逾時，請重新整理頁面。');
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        window.state.userData = data;
                        window.state.applicationId = cachedUser;
                        
                        if (data.status === 'pending') navigate('pending');
                        else if (data.status === 'rejected') navigate('rejected');
                        else if (data.status === 'approved' || data.status === 'active') {
                            if (!data.telegramInfo && data.telegramBound !== true && !data.telegramUserId) navigate('telegram-bind');
                            else navigate('dashboard');
                        }
                        hideLoading();
                        return;
                    }
                }
                hideLoading();
                navigate('landing');
            } catch (e) {
                console.error(e);
                hideLoading();
                navigate('landing');
            }
        }
  
        function hideLoading() {
            const ls = document.getElementById('loading-screen');
            if (ls) ls.classList.add('hidden');
        }
  
        function showLoading() {
            const ls = document.getElementById('loading-screen');
            if (ls) ls.classList.remove('hidden');
        }
  
        function navigate(viewName) {
            window.state.currentView = viewName;
            
            if (viewName !== 'dashboard') {
                if (window.state.unsubscribeListener) {
                    window.state.unsubscribeListener();
                    window.state.unsubscribeListener = null;
                }
                if (window.state.unsubscribeUsersListener) {
                    window.state.unsubscribeUsersListener();
                    window.state.unsubscribeUsersListener = null;
                }
                if (window.state.unsubscribeVisitorsListener) {
                    window.state.unsubscribeVisitorsListener();
                    window.state.unsubscribeVisitorsListener = null;
                }
                if (window.state.unsubscribeNotificationsListener) {
                    window.state.unsubscribeNotificationsListener();
                    window.state.unsubscribeNotificationsListener = null;
                }
            }
  
            if (window.syncBGM) {
                window.syncBGM();
                if (localStorage.getItem('sr_bgm_enabled') !== 'false' && window.luxuryBgm && window.luxuryBgm.isPlaying) {
                    const wantsTrack = (viewName === 'dashboard') ? 'lounge' : 'mysterious';
                    window.luxuryBgm.start(wantsTrack);
                }
            }

            renderView();
        }
  
        function renderView() {
            const view = window.state.currentView;
            appContainer.innerHTML = '';
  
            const transitionContainer = document.createElement('div');
            if (view === 'register') {
                transitionContainer.className = 'w-full h-full overflow-y-auto scrollbar-hide fade-enter-active';
            } else {
                transitionContainer.className = 'w-full h-full fade-enter-active';
            }
            appContainer.appendChild(transitionContainer);
  
            if (view === 'landing') {
                renderLanding(transitionContainer);
            } else if (view === 'register') {
                renderRegister(transitionContainer);
            } else if (view === 'pending') {
                renderPending(transitionContainer);
            } else if (view === 'rejected') {
                renderRejected(transitionContainer);
            } else if (view === 'telegram-bind') {
                renderTelegramBind(transitionContainer);
            } else if (view === 'dashboard') {
                renderDashboard(transitionContainer);
            }
        }
  
        function renderLanding(container) {
            container.innerHTML = `
                
                <div class="flex flex-col items-center justify-center min-h-[100dvh] w-full px-6 py-6 relative bg-transparent overflow-y-auto scrollbar-hide">
                    
                    <div class="z-10 max-w-sm w-full flex flex-col items-center">
                        <div class="w-36 h-36 md:w-40 md:h-40 rounded-full border border-amber-500/30 flex items-center justify-center p-2.5 bg-slate-950/90 shadow-[0_0_60px_rgba(223,183,108,0.22)] mb-8 animate-gentle-logo overflow-hidden">
                            <img src="Gemini_Generated_Image_e2fxvje2fxvje2fx.jpg?v=2" class="w-full h-full rounded-full object-cover">
                        </div>
                        
                        <div class="px-5 py-1.5 rounded-full bg-amber-500/5 border border-amber-500/20 mb-3">
                            
                            <span class="text-[10px] font-bold text-amber-500/80 tracking-[0.25em] font-luxury">Established Seclusion</span>
                        </div>
                        
                        <h1 class="text-4xl md:text-5xl font-black tracking-[0.28em] text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-200 to-amber-500 font-luxury mb-2.5 select-none italic text-center">SecretRoom</h1>
                        <p class="text-amber-500/95 text-xs font-extrabold tracking-[0.4em] text-center">頂級會員制 · 私生活交流俱樂部</p>
                        
                        <div class="flex items-center gap-4 w-44 my-10">
                            <div class="h-[1px] flex-1 bg-gradient-to-r from-transparent via-amber-500/20 to-amber-500/50"></div>
                            <div class="w-2 h-2 bg-amber-500/60 rotate-45 border border-white/20"></div>
                            <div class="h-[1px] flex-1 bg-gradient-to-l from-transparent via-amber-500/20 to-amber-500/50"></div>
                        </div>
  
                        <p class="text-slate-300 text-sm md:text-base text-center font-light leading-relaxed tracking-wider px-2">
                            探入深暖胡桃木與剔透水晶之境，褪去外界喧囂，與極致高規格同好在此坦誠相見。
                        </p>
  
                        <div class="w-full space-y-4 mt-12">
                            
                            <button id="btn-goto-apply" class="w-full brushed-gold font-bold text-sm py-4 px-6 rounded-2xl transition-all duration-300 tracking-[0.18em] crystal-border hover-breath click-press">
                                申請會員 / Apply
                            </button>
                            <button id="btn-goto-login" class="w-full bg-slate-950/95 text-amber-500 font-semibold text-sm py-4 px-6 rounded-2xl border border-amber-500/30 transition-all duration-300 tracking-wider flex items-center justify-center gap-2 hover-breath click-press">
                                <i class="fa-solid fa-key text-xs text-amber-500/70"></i>
                                <span>已是會員？點此登入</span>
                            </button>
                        </div>
  
                        <div class="mt-12 px-5 py-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-xs text-amber-400/80 font-bold tracking-wider flex items-center gap-2 shadow-sm">
                            <i class="fa-solid fa-shield-halved text-amber-500"></i>
                            <span>人工審核驗證 · 滿 18 歲即可申請進入</span>
                        </div>
                    </div>
                </div>
            `;
  
            document.getElementById('btn-goto-apply').onclick = () => {
                navigate('register');
            };
  
            document.getElementById('btn-goto-login').onclick = () => {
                showLoginModal();
            };
        }
  
        function showLoginModal() {
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md';
            
            modal.innerHTML = `
                
                <div class="glass-panel border border-amber-500/30 rounded-3xl p-6 sm:p-8 w-[92vw] max-w-sm relative crystal-border">
                    <button id="close-login" class="absolute top-4 right-4 text-slate-550 hover:text-white text-2xl transition hover-breath click-press">&times;</button>
                    
                    <h3 class="text-sm font-bold text-white mb-1.5 flex items-center gap-2 font-luxury tracking-widest">
                        <i class="fa-solid fa-lock text-amber-500"></i> Member Verification
                    </h3>
                    <p class="text-xs text-slate-400 mb-5 leading-relaxed font-light">請輸入您的帳號與密碼進行登入</p>
                    <div id="login-error-box" class="hidden mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-400/25 text-red-200 text-xs font-bold leading-relaxed"></div>
                    
                    <div class="space-y-4">
                        <div>
                            
                            <label class="block text-xs font-bold text-slate-400 mb-1.5 tracking-wider">帳號</label>
                            <input type="text" id="login-username" class="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3.5 py-3 text-sm text-white focus:outline-none focus:border-amber-500 transition" required>
                        </div>
                        <div>
                            
                            <label class="block text-xs font-bold text-slate-400 mb-1.5 tracking-wider">密碼</label>
                            <div class="relative">
                                <input type="password" id="login-password" class="w-full bg-slate-900/60 border border-slate-800 rounded-xl pl-3.5 pr-10 py-3 text-sm text-white focus:outline-none focus:border-amber-500 transition" required>
                                <button type="button" onclick="togglePasswordVisibility('login-password', this)" class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-amber-500 transition focus:outline-none">
                                    <i class="fa-solid fa-eye-slash text-xs"></i>
                                </button>
                            </div>
                        </div>
                        
                        <button id="btn-login-submit" class="w-full brushed-gold font-bold text-sm py-4 rounded-xl transition tracking-wider crystal-border hover-breath click-press">
                            進入俱樂部
                        </button>
                        <button type="button" id="btn-forgot-password" class="w-full text-xs text-slate-400 hover:text-amber-300 transition font-bold py-1.5 click-press">
                            忘記密碼
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
  
            document.getElementById('close-login').onclick = () => modal.remove();
            const forgotBtn = document.getElementById('btn-forgot-password');
            if (forgotBtn) forgotBtn.onclick = () => showPasswordResetRequestModal(modal);
  
            const loginSubmitBtn = document.getElementById('btn-login-submit');
            const showLoginError = (message) => {
                showToast(message, 'error');
                const errorBox = document.getElementById('login-error-box');
                if (errorBox) {
                    errorBox.textContent = message;
                    errorBox.classList.remove('hidden');
                }
            };
            const handleLoginSubmit = async () => {
                const usernameInput = document.getElementById('login-username').value.trim();
                const passwordInput = document.getElementById('login-password').value;
  
                if (!usernameInput || !passwordInput) {
                    showLoginError('請填寫完整登入資訊！');
                    return;
                }
  
                if (!db) {
                    showLoginError('伺服器尚未完成連線，請稍後再登入。');
                    return;
                }
  
                loginSubmitBtn.disabled = true;
                loginSubmitBtn.classList.add('opacity-60', 'cursor-not-allowed');
                const originalText = loginSubmitBtn.innerHTML;
                loginSubmitBtn.innerHTML = '驗證中...';
                showLoading();
                try {
                    const appRef = doc(db, 'secretg_apps', appId, 'applications', usernameInput);
                    const docSnap = await withTimeout(getDoc(appRef), 12000, '登入驗證逾時，請檢查網路或稍後重試。');
  
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        if (data.password === passwordInput) {
                            window.state.userData = data;
                            window.state.applicationId = usernameInput;
                            localStorage.setItem('sr_username', usernameInput);
                            
                            modal.remove();
                            showToast('登入成功！正在載入俱樂部...', 'success');
  
                            if (data.status === 'pending') navigate('pending');
                            else if (data.status === 'rejected') navigate('rejected');
                            else if (data.status === 'approved' || data.status === 'active') {
                                if (!data.telegramInfo && data.telegramBound !== true && !data.telegramUserId) navigate('telegram-bind');
                                else navigate('dashboard');
                            } else {
                                showLoginError('帳號狀態尚未啟用，請等待審核。');
                            }
                        } else {
                            showLoginError('密碼不正確，請重新檢查。');
                        }
                    } else {
                        showLoginError('該帳號未完成帳號申請。');
                    }
                } catch (err) {
                    console.error("登入驗證錯誤:", err);
                    showLoginError(err.message || '驗證異常，請稍後重試。');
                } finally {
                    hideLoading();
                    if (document.body.contains(loginSubmitBtn)) {
                        loginSubmitBtn.disabled = false;
                        loginSubmitBtn.classList.remove('opacity-60', 'cursor-not-allowed');
                        loginSubmitBtn.innerHTML = originalText;
                    }
                }
            };
            loginSubmitBtn.onclick = handleLoginSubmit;
            window.__srHandleLoginSubmit = handleLoginSubmit;
            ['login-username', 'login-password'].forEach((id) => {
                const input = document.getElementById(id);
                if (input) input.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        handleLoginSubmit();
                    }
                });
            });
        }
  
        function renderRegister(container) {
            container.innerHTML = `
                
                <div class="w-full bg-transparent px-3 sm:px-4 py-6 md:py-8 flex flex-col items-center h-full overflow-y-auto pb-24 md:pb-8">
                    
                    <div class="w-[92vw] max-w-4xl glass-panel rounded-3xl p-5 sm:p-8 md:p-10 relative mb-12 crystal-border">
                        
                        <button id="btn-back-landing" class="absolute top-6 left-6 text-slate-400 hover:text-white transition text-sm flex items-center gap-2 font-semibold hover-breath click-press">
                            <i class="fa-solid fa-arrow-left text-amber-500"></i> 返回首頁
                        </button>
                        
                        <div class="text-center mt-8 mb-10">
                            
                            <h2 class="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-200 to-amber-400 tracking-wider font-luxury">SecretRoom Acquisition</h2>
                            <p class="text-sm text-slate-400 mt-2.5 leading-relaxed">請填寫以下註冊資料。我們將人工審查，以保障俱樂部會員隱私與安全。</p>
                        </div>
  
                        <form id="apply-form" class="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8" onsubmit="return false;">
                            
                            <div class="space-y-6">
                                <div class="bg-slate-900/40 p-5 border border-amber-500/10 rounded-2xl flex flex-col items-center justify-center text-center">
                                    
                                    <span class="text-sm font-bold text-slate-300 mb-3 tracking-wider block">
                                        <span class="text-red-500">*</span> 上傳個人真實頭像照片
                                        <span class="text-amber-500 font-normal text-xs block mt-1">(僅限 Jpeg/Png，支援最大 10 Mb)</span>
                                    </span>
                                    <div class="relative w-28 h-28 rounded-full border border-dashed border-amber-500/30 transition cursor-pointer flex flex-col items-center justify-center bg-slate-950/80 overflow-hidden group shadow-[0_0_20px_rgba(223,183,108,0.1)] hover-breath click-press" id="avatar-trigger">
                                        <img id="avatar-preview" class="absolute inset-0 w-full h-full object-cover hidden">
                                        <div class="z-10 flex flex-col items-center text-slate-550 group-hover:text-amber-500 transition" id="avatar-placeholder">
                                            <i class="fa-solid fa-camera text-2xl mb-1.5"></i>
                                            
                                            <span class="text-xs font-bold tracking-wider">選擇檔案</span>
                                        </div>
                                    </div>
                                    <input type="file" id="register-avatar-file" accept="image/jpeg,image/png,image/webp" class="hidden">
                                    <span class="text-xs text-slate-400 mt-3 block leading-relaxed max-w-[240px]">請上傳本人真實正面清晰之照片，嚴禁風景、卡通 or 不合規相片。</span>
                                </div>
  
                                <div class="p-5 bg-slate-900/40 border border-amber-500/10 rounded-2xl space-y-4">
                                    
                                    <span class="text-sm font-bold text-amber-500 tracking-widest block"><i class="fa-solid fa-lock mr-1.5"></i> 帳號密碼設定</span>
                                    <div>
                                        
                                        <label class="block text-xs font-bold text-slate-400 mb-1.5 tracking-wider"><span class="text-red-500">*</span> 設定會員帳號 (注意中英數)</label>
                                        <input type="text" id="reg-username" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition" required>
                                    </div>

                                    <div>
                                        <label class="block text-xs font-bold text-slate-400 mb-1.5 tracking-wider"><span class="text-red-500">*</span> 綁定通知信箱</label>
                                        <input type="email" id="reg-email" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition" placeholder="example@email.com" required>
                                        <p class="text-[10px] text-slate-500 mt-1.5 leading-relaxed">審核結果、黃金會員、檢舉處理與頭像更換結果將寄送到此信箱。</p>
                                    </div>
                                    
                                    <div>
                                        
                                        <label class="block text-xs font-bold text-slate-400 mb-1.5 tracking-wider"><span class="text-red-500">*</span> 設定登入密碼</label>
                                        <div class="relative">
                                            <input type="password" id="reg-password" class="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition" required>
                                            <button type="button" onclick="togglePasswordVisibility('reg-password', this)" class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-amber-500 transition focus:outline-none">
                                                <i class="fa-solid fa-eye-slash text-xs"></i>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div class="text-xs space-y-1.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                                        
                                        <span class="text-slate-400 font-bold tracking-wider block mb-1">密碼設定條件：</span>
                                        <div id="pwd-rule-len" class="flex items-center gap-1.5 text-slate-500 transition">
                                            <i class="fa-solid fa-circle-notch text-xs"></i> <span>密碼長度達 8 個字元以上</span>
                                        </div>
                                        <div id="pwd-rule-upper" class="flex items-center gap-1.5 text-slate-500 transition">
                                            <i class="fa-solid fa-circle-notch text-xs"></i> <span>包含至少一個大寫英文字母</span>
                                        </div>
                                        <div id="pwd-rule-spec" class="flex items-center gap-1.5 text-slate-500 transition">
                                            <i class="fa-solid fa-circle-notch text-xs"></i> <span>包含至少一個特殊符號</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
  
                            <div class="space-y-6">
                                <div class="p-5 bg-slate-900/40 border border-amber-500/10 rounded-2xl space-y-4">
                                    
                                    <span class="text-sm font-bold text-amber-500 tracking-widest block"><i class="fa-solid fa-user mr-1.5"></i> 會員公開資料</span>
                                    <div>
                                        
                                        <label class="block text-xs font-bold text-slate-400 mb-1.5 tracking-wider"><span class="text-red-500">*</span> 俱樂部公開暱稱</label>
                                        <input type="text" id="reg-nickname" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition" required>
                                    </div>
  
                                    <div>
                                        
                                        <label class="block text-xs font-bold text-slate-400 mb-1.5 tracking-wider"><span class="text-red-500">*</span> 出生年月日 (須滿 18 歲)</label>
                                        <div class="grid grid-cols-3 gap-2">
                                            <select id="reg-year" class="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl pl-3 pr-8 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition hover-breath click-press"></select>
                                            <select id="reg-month" class="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl pl-3 pr-8 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition hover-breath click-press"></select>
                                            <select id="reg-day" class="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl pl-3 pr-8 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition hover-breath click-press"></select>
                                        </div>
                                    </div>
                                </div>
  
                                <div class="p-5 bg-slate-900/40 border border-amber-500/10 rounded-2xl space-y-4">
                                    
                                    <span class="text-sm font-bold text-amber-500 tracking-widest block"><i class="fa-solid fa-user-check mr-1.5"></i>個人概要</span>
                                    
                                    <div class="grid grid-cols-2 gap-3">
                                        <div>
                                            <label class="block text-xs font-bold text-slate-500 mb-1">身高 (cm)</label>
                                            <input type="number" id="reg-height" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition" required>
                                        </div>
                                        <div>
                                            <label class="block text-xs font-bold text-slate-500 mb-1">體重 (kg)</label>
                                            <input type="number" id="reg-weight" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition" required>
                                        </div>
                                    </div>
                                    
                                    <div class="grid grid-cols-2 gap-3">
                                        <div>
                                            <label class="block text-xs font-bold text-slate-500 mb-1">勃起長度 (cm)</label>
                                            <input type="number" id="reg-length" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition" required>
                                        </div>
                                        <div>
                                            <label class="block text-xs font-bold text-slate-500 mb-1">勃起粗度圍 (cm)</label>
                                            <input type="number" id="reg-girth" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition" required>
                                        </div>
                                    </div>
                                </div>
                            </div>
  
                            <div class="md:col-span-2 space-y-2 mt-4 pt-4 border-t border-amber-500/10">
                                
                                <label class="block text-sm font-bold text-slate-300 mb-1 tracking-wider"><span class="text-red-500">*</span> 感興趣的主題與偏好 (至少勾選一項)</label>
                                <span class="text-xs text-slate-400 block mb-3 leading-relaxed">我們將依此標籤為您進行動態與合適的帳號推薦配對。</span>
                                
                                <div class="grid grid-cols-2 md:grid-cols-5 gap-3 bg-slate-950/40 p-4 border border-amber-500/10 rounded-2xl" id="register-kinks-box">
                                    ${window.state.kinksOptions.map((k) => `
                                        <label class="flex items-center gap-2 cursor-pointer hover:bg-slate-900/60 p-2.5 rounded-xl transition border border-transparent hover:border-amber-500/10 hover-breath click-press">
                                            <input type="checkbox" name="reg-kink" value="${k}" class="rounded border-amber-500/30 bg-slate-950 text-amber-500 focus:ring-amber-500 w-4 h-4">
                                            <span class="text-[11px] sm:text-xs text-slate-300 font-semibold leading-tight select-none">${k}</span>
                                        </label>
                                    `).join('')}
                                </div>
                            </div>
  
                            <div class="md:col-span-2 pt-4">
                                
                                <button type="submit" id="apply-submit" class="w-full brushed-gold font-bold text-sm py-4 px-6 rounded-2xl transition duration-300 tracking-wider crystal-border hover-breath click-press">
                                    送出註冊與會員審核
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
  
            const yearSelect = document.getElementById('reg-year');
            const monthSelect = document.getElementById('reg-month');
            const daySelect = document.getElementById('reg-day');
  
            const currentYear = new Date().getFullYear();
            for (let y = currentYear - 18; y >= currentYear - 80; y--) {
                yearSelect.options.add(new Option(`${y} 年`, y));
            }
            for (let m = 1; m <= 12; m++) {
                monthSelect.options.add(new Option(`${m} 月`, m));
            }
            for (let d = 1; d <= 31; d++) {
                daySelect.options.add(new Option(`${d} 日`, d));
            }
  
            const avatarTrigger = document.getElementById('avatar-trigger');
            const fileInput = document.getElementById('register-avatar-file');
            const previewImg = document.getElementById('avatar-preview');
            const placeholderBox = document.getElementById('avatar-placeholder');
            let base64Avatar = '';
  
            avatarTrigger.onclick = () => fileInput.click();
  
            fileInput.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 10 * 1024 * 1024) {
                        showToast('大頭照檔案大小超過 10 Mb 限制！', 'error');
                        return;
                    }
                    showLoading();
                    try {
                        base64Avatar = await processAndCompressImageFile(file, 240, 0.75);
                        previewImg.src = base64Avatar;
                        previewImg.classList.remove('hidden');
                        placeholderBox.classList.add('hidden');
                        showToast('頭像智慧壓縮與優化完成', 'success');
                    } catch (err) {
                        console.error(err);
                        showToast('大頭照解析優化失敗，請換一張試試！', 'error');
                    } finally {
                        hideLoading();
                    }
                }
            };
  
            document.getElementById('btn-back-landing').onclick = () => navigate('landing');
  
            const pwdInput = document.getElementById('reg-password');
            const ruleLen = document.getElementById('pwd-rule-len');
            const ruleUpper = document.getElementById('pwd-rule-upper');
            const ruleSpec = document.getElementById('pwd-rule-spec');
  
            pwdInput.oninput = () => {
                const val = pwdInput.value;
                
                if (val.length >= 8) {
                    ruleLen.className = "flex items-center gap-1.5 text-emerald-400 font-semibold";
                    ruleLen.querySelector('i').className = "fa-solid fa-circle-check text-xs text-emerald-400";
                } else {
                    ruleLen.className = "flex items-center gap-1.5 text-slate-500";
                    ruleLen.querySelector('i').className = "fa-solid fa-circle-notch text-xs";
                }
  
                if (/[A-Z]/.test(val)) {
                    ruleUpper.className = "flex items-center gap-1.5 text-emerald-400 font-semibold";
                    ruleUpper.querySelector('i').className = "fa-solid fa-circle-check text-xs text-emerald-400";
                } else {
                    ruleUpper.className = "flex items-center gap-1.5 text-slate-500";
                    ruleUpper.querySelector('i').className = "fa-solid fa-circle-notch text-xs";
                }
  
                if (/[!@#$%^&*(),.?":{}|<>]/.test(val)) {
                    ruleSpec.className = "flex items-center gap-1.5 text-emerald-400 font-semibold";
                    ruleSpec.querySelector('i').className = "fa-solid fa-circle-check text-xs text-emerald-400";
                } else {
                    ruleSpec.className = "flex items-center gap-1.5 text-slate-500";
                    ruleSpec.querySelector('i').className = "fa-solid fa-circle-notch text-xs";
                }
            };
  
            document.getElementById('apply-form').onsubmit = async (e) => {
                e.preventDefault();
  
                const username = document.getElementById('reg-username').value.trim();
                const password = document.getElementById('reg-password').value;
                const email = document.getElementById('reg-email').value.trim();
                const nickname = document.getElementById('reg-nickname').value.trim();
                const year = yearSelect.value;
                const month = monthSelect.value;
                const day = daySelect.value;
                const height = document.getElementById('reg-height').value;
                const weight = document.getElementById('reg-weight').value;
                const length = document.getElementById('reg-length').value;
                const girth = document.getElementById('reg-girth').value;
  
                const selectedKinks = [];
                document.querySelectorAll('input[name="reg-kink"]:checked').forEach((cb) => {
                    selectedKinks.push(cb.value);
                });
  
                const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
                if (!isEmailValid) {
                    showToast('請填寫有效的通知信箱，未來審核與平台通知會寄送到此信箱。', 'error');
                    return;
                }

                const isLenMet = password.length >= 8;
                const isUpperMet = /[A-Z]/.test(password);
                const isSpecMet = /[!@#$%^&*(),.?":{}|<>].*/.test(password);
                if (!isLenMet || !isUpperMet || !isSpecMet) {
                    showToast('密碼未滿足強度條件設定！', 'error');
                    return;
                }
  
                if (!base64Avatar) {
                    showToast('請上傳個人真實頭像供審核查驗。', 'error');
                    return;
                }
  
                if (selectedKinks.length === 0) {
                    showToast('請至少勾選一項主題偏好！', 'error');
                    return;
                }
  
                if (!db) {
                    showToast('伺服器連線超時，暫時無法提交。', 'error');
                    return;
                }
  
                showLoading();
                try {
                    const checkRef = doc(db, 'secretg_apps', appId, 'applications', username);
                    const checkSnap = await getDoc(checkRef);
                    if (checkSnap.exists()) {
                        showToast('該帳號已存在！請更換其他設定帳號。', 'error');
                        hideLoading();
                        return;
                    }
  
                    const appPayload = {
                        status: 'pending',
                        password,
                        nickname,
                        email, 
                        birthYear: year,
                        birthMonth: month,
                        birthDay: day,
                        height,
                        weight,
                        length,
                        girth,
                        kinks: selectedKinks,
                        avatar: base64Avatar,
                        avatarStatus: 'approved', 
                        createdAt: serverTimestamp()
                    };
  
                    await setDoc(checkRef, appPayload);
  
                    window.state.userData = appPayload;
                    window.state.applicationId = username;
                    localStorage.setItem('sr_username', username);
  
                    showToast('申請資料提交成功！請靜待審核查驗。', 'success');
                    navigate('pending');
                } catch (err) {
                    console.error("資料寫入錯誤:", err);
                    showToast('寫入失敗: ' + err.message, 'error');
                } finally {
                    hideLoading();
                }
            };
        }
  
        function renderPending(container) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center min-h-[100dvh] w-full px-6 bg-transparent">
                    
                    <div class="w-[92vw] max-w-md glass-panel rounded-3xl p-8 relative text-center space-y-6 crystal-border">
                        
                        <button id="btn-pending-back" class="absolute top-5 left-5 text-slate-400 hover:text-white transition text-xs font-semibold flex items-center gap-1 hover-breath click-press">
                            <i class="fa-solid fa-arrow-left text-amber-500"></i> 返回首頁
                        </button>
                        
                        <div class="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 text-3xl mx-auto shadow-[0_0_20px_rgba(245,158,11,0.15)] animate-pulse border border-amber-500/20 mt-4">
                            <i class="fa-solid fa-hourglass-half animate-spin"></i>
                        </div>
                        <div class="space-y-2.5">
                            
                            <h2 class="text-xl font-bold text-white tracking-wide font-luxury">Application Pending</h2>
                            <p class="text-sm text-slate-300 leading-relaxed px-4">
                                SecretRoom 為保障所有帳號的絕對隱私防護，一律採高規格人工手動審核。請您稍後重新整理確認狀態。
                            </p>
                        </div>
  
                        <div class="bg-slate-900/40 border border-amber-500/10 p-4 rounded-2xl text-left space-y-2">
                            
                            <span class="text-xs font-bold text-amber-500 tracking-wider block font-luxury">註冊概要資訊</span>
                            <p class="text-sm text-slate-300"><span class="text-amber-500/70 font-medium">您的帳號:</span> @${window.state.applicationId}</p>
                            <p class="text-sm text-slate-300"><span class="text-amber-500/70 font-medium">您的名稱:</span> ${window.state.userData.nickname}</p>
                        </div>
  
                        <div class="pt-2">
                            
                            <button id="btn-pending-refresh" class="w-full brushed-gold font-bold text-sm py-3.5 rounded-xl transition crystal-border hover-breath click-press">
                                重新整理確認狀態
                            </button>
                        </div>
                    </div>
                </div>
            `;
  
            document.getElementById('btn-pending-refresh').onclick = () => {
                showLoading();
                checkExistingApplication();
            };

            document.getElementById('btn-pending-back').onclick = () => {
                localStorage.removeItem('sr_username'); window.SRSecureAuth?.signOutMember?.();
                window.state.userData = {};
                window.state.applicationId = null;
                navigate('landing');
            };
        }
  
        function renderRejected(container) {
            const reason = window.state.userData.rejectionReason || "未遵守安全上傳規範（例如頭像模糊、非本人等）。";
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center min-h-[100dvh] w-full px-6 bg-transparent">
                    
                    <div class="w-[92vw] max-w-md glass-panel rounded-3xl p-8 text-center space-y-6 crystal-border">
                        <div class="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 text-3xl mx-auto shadow-[0_0_20px_rgba(239,68,68,0.15)] border border-red-500/20">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                        </div>
                        <div class="space-y-2">
                            
                            <h2 class="text-xl font-bold text-white tracking-wide font-luxury">Application Rejected</h2>
                            <p class="text-sm text-slate-300 leading-relaxed px-4 font-light">很遺憾，您的加入申請未能通過管理審查團隊的查核。</p>
                        </div>
  
                        <div class="bg-red-550/5 border border-red-500/15 p-4 rounded-2xl text-left space-y-2">
                            
                            <span class="text-xs font-bold text-red-400 tracking-wider block">退件具體理由</span>
                            <p class="text-sm text-slate-300 leading-relaxed font-light">${reason}</p>
                        </div>
  
                        <div class="pt-2 space-y-3">
                            
                            <button id="btn-reapply-edit" class="w-full brushed-gold font-bold text-sm py-3.5 rounded-xl transition crystal-border hover-breath click-press">
                                修正資料並重新提交送審
                            </button>
                            <button id="btn-reapply-logout" class="w-full bg-slate-900 text-slate-400 font-semibold text-sm py-3.5 rounded-xl transition border border-slate-800 hover-breath click-press">
                                登出當前帳號
                            </button>
                        </div>
                    </div>
                </div>
            `;
  
            document.getElementById('btn-reapply-logout').onclick = () => {
                localStorage.removeItem('sr_username'); window.SRSecureAuth?.signOutMember?.();
                window.state.userData = {};
                window.state.applicationId = null;
                navigate('landing');
            };
  
            document.getElementById('btn-reapply-edit').onclick = () => {
                const draft = { ...window.state.userData };
                navigate('register');
                
                setTimeout(() => {
                    const uInput = document.getElementById('reg-username');
                    const nInput = document.getElementById('reg-nickname');
                    const hInput = document.getElementById('reg-height');
                    const wInput = document.getElementById('reg-weight');
                    const lInput = document.getElementById('reg-length');
                    const gInput = document.getElementById('reg-girth');
  
                    if (uInput) { uInput.value = window.state.applicationId; uInput.disabled = true; }
                    if (nInput) nInput.value = draft.nickname || '';
                    if (hInput) hInput.value = draft.height || '';
                    if (wInput) wInput.value = draft.weight || '';
                    if (lInput) lInput.value = draft.length || '';
                    if (gInput) gInput.value = draft.girth || '';
  
                    if (draft.birthYear) document.getElementById('reg-year').value = draft.birthYear;
                    if (draft.birthMonth) document.getElementById('reg-month').value = draft.birthMonth;
                    if (draft.birthDay) document.getElementById('reg-day').value = draft.birthDay;
  
                    if (draft.kinks && draft.kinks.length > 0) {
                        draft.kinks.forEach(k => {
                            const cb = document.querySelector(`input[name="reg-kink"][value="${k}"]`);
                            if (cb) cb.checked = true;
                        });
                    }
                }, 100);
            };
        }

        function renderTelegramBind(container) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center min-h-[100dvh] w-full px-6 bg-transparent">
                    
                    <div class="w-[92vw] max-w-md glass-panel rounded-3xl p-8 relative text-center space-y-6 crystal-border">
                        
                        <button id="btn-bind-cancel" class="absolute top-5 left-5 text-slate-400 hover:text-white transition text-xs font-semibold flex items-center gap-1 hover-breath click-press">
                            <i class="fa-solid fa-arrow-left text-amber-500"></i> 返回首頁
                        </button>

                        <div class="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-400 text-3xl mx-auto border border-blue-500/20 animate-pulse mt-4">
                            <i class="fa-brands fa-telegram"></i>
                        </div>
                        <div class="space-y-2.5">
                            
                            <h2 class="text-xl font-bold text-white font-luxury">Telegram Binding</h2>
                            <p class="text-sm text-slate-300 leading-relaxed px-4">
                                為開啟高級警報防護與即時密語傳輸，請在下方透過 Telegram 官方進行安全登入綁定。
                            </p>
                        </div>
                        
                        <div class="p-6 bg-slate-900/40 border border-amber-500/10 rounded-2xl flex flex-col items-center justify-center space-y-4">
                            <p class="text-xs text-slate-400 leading-relaxed text-center">請點擊下方按鈕以安全登入並關聯您的 Telegram 帳號：</p>
                            <div id="telegram-widget-anchor" class="min-h-[44px] flex items-center justify-center transition duration-300">
                                <span class="text-xs text-amber-500/50 flex items-center gap-1.5 animate-pulse">
                                    <i class="fa-solid fa-circle-notch text-amber-500 animate-spin"></i> 正在加載官方驗證入口...
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.getElementById('btn-bind-cancel').onclick = () => {
                localStorage.removeItem('sr_username'); window.SRSecureAuth?.signOutMember?.();
                window.state.userData = {};
                window.state.applicationId = null;
                navigate('landing');
            };

            setTimeout(() => {
                const anchor = document.getElementById('telegram-widget-anchor');
                if (anchor) {
                    anchor.innerHTML = ''; 
                    const script = document.createElement('script');
                    script.async = true;
                    script.src = "https://telegram.org/js/telegram-widget.js?22";
                    script.setAttribute('data-telegram-login', telegramBotName);
                    script.setAttribute('data-size', 'large');
                    script.setAttribute('data-radius', '12');
                    script.setAttribute('data-userpic', 'true');
                    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
                    script.setAttribute('data-request-access', 'write');
                    anchor.appendChild(script);
                }
            }, 300);

            window.onTelegramAuth = async function(user) {
                if (!user) {
                    showToast('Telegram 授權驗證失敗，請重試！', 'error');
                    return;
                }
                showLoading();
                try {
                    if (db) {
                        const appsRef = collection(db, 'secretg_apps', appId, 'applications');
                        const querySnapshot = await getDocs(appsRef);
                        
                        let isAlreadyBound = false;
                        let boundUserNickname = '';
                        
                        querySnapshot.forEach((docSnap) => {
                            const data = docSnap.data();
                            if (docSnap.id !== window.state.applicationId && data.telegramInfo && String(data.telegramInfo.id) === String(user.id)) {
                                isAlreadyBound = true;
                                boundUserNickname = data.nickname || docSnap.id;
                            }
                        });

                        if (isAlreadyBound) {
                            showToast(`此 Telegram 帳號已被使用者 @${boundUserNickname} 綁定，無法重複綁定！`, 'error');
                            hideLoading();
                            return;
                        }

                        const appRef = doc(db, 'secretg_apps', appId, 'applications', window.state.applicationId);
                        const telegramPayload = {
                            id: user.id,
                            first_name: user.first_name || '',
                            last_name: user.last_name || '',
                            username: user.username || '',
                            photo_url: user.photo_url || '',
                            auth_date: user.auth_date || 0,
                            hash: user.hash || ''
                        };

                        await updateDoc(appRef, {
                            telegramInfo: telegramPayload
                        });

                        window.state.userData.telegramInfo = telegramPayload;
                        showToast('Telegram 官方授權與防護網已安全啟用 ✓', 'success');
                        navigate('dashboard');
                    }
                } catch (err) {
                    console.error("更新 Telegram 綁定失敗:", err);
                    showToast('綁定資料傳輸失敗：' + err.message, 'error');
                } finally {
                    hideLoading();
                }
            };
        }
  
        function renderMobileFeatureMenuHtml() {
            const users = (window.state.activeUsers || [])
                .filter(u => u && u.id && u.id !== window.state.applicationId)
                .slice(0, 8);
            const bgmEnabled = !!(window.luxuryBgm && window.luxuryBgm.audio && !window.luxuryBgm.audio.paused && window.luxuryBgm.isPlaying);
            const tagButtons = window.state.kinksOptions.slice(0, 10).map(k => `
                <button onclick="mobileSelectTag('${escapeJsString(k)}')" class="text-[11px] font-bold bg-slate-950/55 border border-amber-500/15 px-3 py-2 rounded-full text-slate-300 transition hover-breath click-press">
                    # ${escapeHtml(k)}
                </button>
            `).join('');
            const userCards = users.length === 0 ? `
                <div class="text-xs text-slate-500 py-3 text-center border border-amber-500/10 rounded-2xl bg-slate-950/35">目前尚無其他活躍帳號</div>
            ` : users.map(user => `
                <button onclick="mobileOpenUserProfile('${escapeJsString(user.id)}')" class="w-full flex items-center justify-between p-2.5 bg-slate-950/45 rounded-2xl border border-amber-500/10 transition hover-breath click-press">
                    <span class="flex items-center gap-2.5 min-w-0 text-left">
                        <img src="${user.avatar || 'Gemini_Generated_Image_e2fxvje2fxvje2fx.jpg?v=2'}" class="w-8 h-8 rounded-full object-cover border border-amber-500/20 shrink-0">
                        <span class="min-w-0">
                            <span class="block text-sm font-black text-slate-200 truncate">${escapeHtml(user.nickname || user.id)}</span>
                            <span class="block text-[10px] text-slate-500 font-mono truncate">@${escapeHtml(user.id)}</span>
                        </span>
                    </span>
                    <i class="fa-solid fa-chevron-right text-[10px] text-amber-400/70"></i>
                </button>
            `).join('');

            return `
                <div id="mobile-feature-menu" class="sr-mobile-menu-panel hidden md:hidden">
                    <div id="mobile-feature-menu-backdrop" class="sr-mobile-menu-backdrop"></div>
                    <section class="sr-mobile-menu-sheet glass-panel crystal-border rounded-3xl">
                        <div class="flex items-center justify-between gap-3 mb-4">
                            <div>
                                <div class="text-[10px] text-amber-400/75 font-black tracking-[0.24em] font-luxury">Full Menu</div>
                                <h3 class="text-lg font-black text-white tracking-widest font-luxury mt-1">完整功能表</h3>
                            </div>
                            <button id="mobile-feature-menu-close" class="w-9 h-9 rounded-full border border-amber-500/20 bg-slate-950/55 text-slate-300 flex items-center justify-center click-press" aria-label="關閉功能表">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <div class="grid grid-cols-1 gap-2.5 mb-5">
                            <button id="mobile-menu-bgm-toggle" class="sr-mobile-menu-item">
                                <span class="flex items-center gap-3"><i class="fa-solid ${bgmEnabled ? 'fa-volume-high' : 'fa-volume-xmark'} text-amber-400"></i><span>聲音播放</span></span>
                                <span id="mobile-menu-bgm-text" class="text-[10px] text-amber-300/80 font-luxury">${bgmEnabled ? 'Premium Vip Lounge' : 'Audio Muted'}</span>
                            </button>
                            <button id="mobile-menu-spec-vault" class="sr-mobile-menu-item">
                                <span class="flex items-center gap-3"><i class="fa-solid fa-medal text-amber-400"></i><span>S+ . S . G</span></span>
                                <span class="text-[10px] text-amber-300/80">黃金Spec限定</span>
                            </button>
                            <button id="mobile-menu-badge-progress" class="sr-mobile-menu-item">
                                <span class="flex items-center gap-3"><i class="fa-solid fa-award text-amber-400"></i><span>徽章進度</span></span>
                                <span class="text-[10px] text-slate-500">Badge</span>
                            </button>
                        </div>

                        <div class="space-y-3 mb-5">
                            <h4 class="text-xs font-black text-amber-400 flex items-center gap-2 tracking-wider font-luxury"><i class="fa-solid fa-tags"></i> 熱門標籤</h4>
                            <div class="flex flex-wrap gap-2">${tagButtons}</div>
                        </div>

                        <div class="space-y-3">
                            <h4 class="text-xs font-black text-amber-400 flex items-center gap-2 tracking-wider font-luxury"><i class="fa-solid fa-user-group"></i> 線上活躍帳號</h4>
                            <div id="mobile-active-users-list" class="space-y-2.5">${userCards}</div>
                        </div>
                    </section>
                </div>
            `;
        }

        function renderDashboard(container) {
            container.innerHTML = `
                
                <div class="sr-dashboard-shell w-full h-[100dvh] md:h-screen flex flex-row overflow-hidden relative bg-transparent ambient-spotlight">

                    <aside class="sr-dashboard-left flex flex-col justify-between w-64 border-r border-amber-500/15 glass-panel p-5 shrink-0 select-none rounded-r-3xl my-3 ml-3">
                        <div class="space-y-8">
                            <div class="flex items-center gap-3 hover-breath cursor-pointer" onclick="backToFeed()">
                                <img src="Gemini_Generated_Image_e2fxvje2fxvje2fx.jpg?v=2" class="w-10 h-10 rounded-full border border-amber-500/30 object-cover animate-gentle-logo shadow-[0_0_15px_rgba(223,183,108,0.15)]">
                                <div>
                                    <h2 class="text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-amber-400 tracking-widest italic font-luxury">SecretRoom</h2>
                                    
                                    <span class="text-[10px] text-amber-500/60 font-bold tracking-[0.2em] block font-luxury">Private Club</span>
                                </div>
                            </div>
  
                            <nav class="space-y-2.5">
                                <button id="aside-tab-feed" class="w-full text-left px-4 py-3.5 rounded-2xl flex items-center gap-3 text-sm transition-all duration-300 font-bold hover-breath click-press ${window.state.currentTab === 'feed' ? 'bg-gradient-to-r from-amber-500/15 to-transparent text-amber-400 border-l-2 border-amber-500 shadow-[0_0_20px_rgba(223,183,108,0.1)]' : 'text-slate-400 hover:bg-slate-900/40 hover:text-white'}">
                                    <i class="fa-solid fa-house-chimney text-amber-500/80"></i> 首頁
                                </button>
                                <button id="aside-tab-ranking" class="w-full text-left px-4 py-3.5 rounded-2xl flex items-center gap-3 text-sm transition-all duration-300 font-bold hover-breath click-press ${window.state.currentTab === 'rank' ? 'bg-gradient-to-r from-amber-500/15 to-transparent text-amber-400 border-l-2 border-amber-500 shadow-[0_0_20px_rgba(223,183,108,0.1)]' : 'text-slate-400 hover:bg-slate-900/40 hover:text-white'}">
                                    <i class="fa-solid fa-ranking-star text-amber-500/80"></i> 位階
                                </button>
                                <button id="aside-tab-notifications" class="w-full text-left px-4 py-3.5 rounded-2xl flex items-center justify-between gap-3 text-sm transition-all duration-300 font-bold hover-breath click-press ${window.state.currentTab === 'notifications' ? 'bg-gradient-to-r from-amber-500/15 to-transparent text-amber-400 border-l-2 border-amber-500 shadow-[0_0_20px_rgba(223,183,108,0.1)]' : 'text-slate-400 hover:bg-slate-900/40 hover:text-white'}">
                                    <span class="flex items-center gap-3"><i class="fa-solid fa-bell text-amber-500/80"></i> 通知</span>
                                    <span id="aside-notification-count" class="hidden min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow-[0_0_12px_rgba(239,68,68,0.5)]"></span>
                                </button>
                                <button id="aside-tab-spec-vault" class="w-full text-left px-4 py-3.5 rounded-2xl flex items-center justify-between gap-3 text-sm transition-all duration-300 font-bold hover-breath click-press ${window.state.currentTab === 'spec-vault' ? 'bg-gradient-to-r from-amber-500/15 to-transparent text-amber-400 border-l-2 border-amber-500 shadow-[0_0_20px_rgba(223,183,108,0.1)]' : 'text-slate-400 hover:bg-slate-900/40 hover:text-white'}">
                                    <span class="flex items-center gap-3"><i class="fa-solid fa-medal text-amber-500/80"></i> S+ . S . G</span>
                                    <span class="text-[9px] px-2 py-1 rounded-full brushed-gold crystal-border shrink-0">黃金Spec限定</span>
                                </button>
                                <button id="aside-tab-badge-progress" class="w-full text-left px-4 py-3.5 rounded-2xl flex items-center justify-between gap-3 text-sm transition-all duration-300 font-bold hover-breath click-press ${window.state.currentTab === 'badge-progress' ? 'bg-gradient-to-r from-amber-500/15 to-transparent text-amber-400 border-l-2 border-amber-500 shadow-[0_0_20px_rgba(223,183,108,0.1)]' : 'text-slate-400 hover:bg-slate-900/40 hover:text-white'}">
                                    <span class="flex items-center gap-3"><i class="fa-solid fa-award text-amber-500/80"></i> 徽章進度</span>
                                    <span class="text-[9px] px-2 py-1 rounded-full border border-amber-500/20 text-amber-300/80 shrink-0">Badge</span>
                                </button>
                            </nav>

                            <button id="aside-btn-share" class="w-full brushed-gold font-bold text-sm py-3.5 px-4 rounded-2xl transition duration-300 flex items-center justify-center gap-2 crystal-border hover-breath click-press">
                                <i class="fa-solid fa-circle-plus"></i> 分享動態
                            </button>
                        </div>
  
                        <div class="space-y-4">
                            
                            <div id="aside-profile-trigger" class="flex items-center gap-3 p-3 bg-slate-900/40 border ${window.state.currentTab === 'profile' ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_15px_rgba(223,183,108,0.15)]' : 'border-amber-500/15'} rounded-2xl relative overflow-hidden cursor-pointer transition-all duration-300 hover-breath click-press">
                                <div class="absolute top-0 right-0 w-2 h-2 bg-emerald-500 rounded-full m-2 shadow-[0_0_8px_#10b981]"></div>
                                <img src="${window.state.userData.avatar || 'Gemini_Generated_Image_e2fxvje2fxvje2fx.jpg?v=2'}" class="w-9 h-9 rounded-full object-cover border border-amber-500/30">
                                <div class="overflow-hidden">
                                    <div class="flex items-center gap-1">
                                        <h4 class="font-bold text-sm ${window.state.currentTab === 'profile' ? 'text-amber-400' : 'text-slate-200'} truncate">${window.state.userData.nickname}</h4>
                                    </div>
                                    <p class="text-[10px] text-slate-400 truncate font-mono mt-0.5">@${window.state.applicationId}</p>
                                </div>
                            </div>

                            <div id="sidebar-bgm-btn" class="flex items-center justify-between bg-slate-950/60 border border-amber-500/20 rounded-2xl p-3 md:p-3.5 transition duration-300 cursor-pointer shadow-[0_4px_25px_rgba(212,175,55,0.05)] backdrop-blur-md group hover-breath click-press">
                                <div class="flex items-center gap-2">
                                    <div class="flex items-center gap-[3px] h-3 w-4" id="sidebar-bgm-bars">
                                        <div class="w-[2px] h-1.5 bg-amber-500 rounded-full bgm-bar"></div>
                                        <div class="w-[2px] h-3 bg-amber-500 rounded-full bgm-bar"></div>
                                        <div class="w-[2px] h-1 bg-amber-500 rounded-full bgm-bar"></div>
                                        <div class="w-[2px] h-2 bg-amber-500 rounded-full bgm-bar"></div>
                                    </div>
                                    
                                    <span class="text-[10px] font-bold text-amber-500/80 tracking-wider font-luxury select-none" id="sidebar-bgm-text">
                                        Bgm Audio
                                    </span>
                                </div>
                                <button class="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-500 transition-all duration-300">
                                    <i class="fa-solid fa-play text-[9px]" id="sidebar-bgm-icon"></i>
                                </button>
                            </div>

                            <button id="aside-btn-logout" class="w-full bg-red-950/10 text-red-400 border border-red-500/10 font-bold text-sm py-3.5 px-4 rounded-2xl transition flex items-center justify-center gap-2 shadow-sm hover-breath click-press">
                                <i class="fa-solid fa-power-off"></i> 登出俱樂部
                            </button>
                        </div>
                    </aside>
  
                    <main class="sr-dashboard-main flex-1 h-full flex flex-col bg-transparent overflow-hidden">

                        <header class="sr-mobile-dashboard-header flex md:hidden items-center justify-between px-4 py-3 border-b border-amber-500/15 glass-panel shrink-0">
                            <div class="flex items-center gap-2.5">
                                <img src="Gemini_Generated_Image_e2fxvje2fxvje2fx.jpg?v=2" class="w-8 h-8 rounded-full border border-amber-500/30 object-cover animate-gentle-logo">
                                <h1 class="text-lg font-black text-white tracking-[0.15em] italic font-luxury">SecretRoom</h1>
                            </div>
                            
                            <div class="flex items-center gap-2">
                                <button id="mobile-btn-notifications" class="w-9 h-9 bg-slate-950/55 border border-amber-500/25 text-amber-300 font-bold rounded-full flex items-center justify-center shadow-lg transition click-press hover-breath relative" aria-label="開啟通知">
                                    <i class="fa-solid fa-bell text-sm"></i>
                                    <span id="mobile-notification-count" class="hidden absolute -top-1 -right-1 min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center shadow-[0_0_10px_rgba(239,68,68,0.55)]"></span>
                                </button>
                                <button id="mobile-btn-menu" class="w-9 h-9 bg-slate-950/55 border border-amber-500/25 text-amber-300 font-bold rounded-full flex items-center justify-center shadow-lg transition click-press hover-breath" aria-label="開啟完整功能表">
                                    <i class="fa-solid fa-bars text-sm"></i>
                                </button>
                            </div>
                        </header>

                        ${renderMobileFeatureMenuHtml()}
  
                        <div class="flex-1 overflow-y-auto scrollbar-hide px-3 md:px-6 py-4 md:py-5" id="main-content-scroll">
                            <div class="max-w-2xl mx-auto w-full space-y-4 md:space-y-6" id="dashboard-tab-content">
                            </div>
                        </div>

                        <nav class="sr-mobile-dashboard-nav flex md:hidden items-center justify-around border-t border-amber-500/15 glass-panel p-2.5 pb-safe-bottom shrink-0 select-none rounded-t-3xl">
                            <button id="mobile-tab-feed" class="flex flex-col items-center gap-1 transition-all click-press ${window.state.currentTab === 'feed' ? 'text-amber-500 scale-105 font-bold' : 'text-slate-500'}">
                                <i class="fa-solid fa-house-chimney text-sm"></i>
                                <span class="text-[10px] font-bold tracking-wider">首頁</span>
                            </button>
                            <button id="mobile-tab-ranking" class="flex flex-col items-center gap-1 transition-all click-press ${window.state.currentTab === 'rank' ? 'text-amber-500 scale-105 font-bold' : 'text-slate-500'}">
                                <i class="fa-solid fa-trophy text-sm"></i>
                                <span class="text-[10px] font-bold tracking-wider">位階</span>
                            </button>
                            <button id="mobile-btn-share" class="sr-mobile-menu-create-button brushed-gold crystal-border shadow-xl transition-all click-press" aria-label="新增貼文">
                                <i class="fa-solid fa-plus text-lg"></i>
                            </button>
                            <button id="mobile-tab-profile" class="flex flex-col items-center gap-1 transition-all click-press ${window.state.currentTab === 'profile' ? 'text-amber-500 scale-105 font-bold' : 'text-slate-500'}">
                                <i class="fa-solid fa-user-circle text-sm"></i>
                                <span class="text-[10px] font-bold tracking-wider">個人主頁</span>
                            </button>
                            <button id="mobile-btn-logout" class="flex flex-col items-center gap-1 text-slate-600 hover:text-red-400 transition-all click-press">
                                <i class="fa-solid fa-power-off text-sm"></i>
                                <span class="text-[10px] font-bold tracking-wider">登出</span>
                            </button>
                        </nav>
                    </main>

                    <aside class="sr-dashboard-right flex flex-col gap-6 w-80 border-l border-amber-500/15 glass-panel p-5 shrink-0 overflow-y-auto select-none rounded-l-3xl my-3 mr-3">
                        
                        <div class="bg-slate-900/40 border border-amber-500/15 p-5 rounded-3xl space-y-3.5 relative overflow-hidden">
                            <div class="absolute -top-6 -right-6 w-16 h-16 bg-amber-500/5 rounded-full blur-xl"></div>
                            
                            <h3 class="text-xs font-bold text-amber-500 flex items-center gap-2 tracking-wider font-luxury">
                                <i class="fa-solid fa-compass text-xs"></i> 熱門主題探索
                            </h3>
                            <div class="flex flex-wrap gap-2">
                                ${window.state.kinksOptions.slice(0, 6).map((k) => `
                                    <button onclick="setGlobalFilter('${k}')" class="text-xs font-bold bg-slate-950/40 border border-amber-500/10 px-3 py-2 rounded-full text-slate-400 transition duration-300 hover-breath click-press">
                                        # ${k}
                                    </button>
                                `).join('')}
                            </div>
                        </div>
  
                        <div class="bg-slate-900/40 border border-amber-500/15 p-5 rounded-3xl space-y-4">
                            
                            <h3 class="text-xs font-bold text-amber-500 flex items-center gap-2 tracking-wider font-luxury">
                                <i class="fa-solid fa-user-group text-xs"></i> 線上活躍帳號
                            </h3>
                            <div class="space-y-3.5" id="active-users-list-aside">
                                <div class="text-xs text-slate-400 text-center py-4 font-light">正在更新線上帳號...</div>
                            </div>
                        </div>
                    </aside>
  
                </div>
            `;
  
            const bindTabEvents = (id, tabName, filterName = null) => {
                const el = document.getElementById(id);
                if (el) el.onclick = () => { 
                    window.state.currentTab = tabName; 
                    if (filterName) {
                        window.state.currentFilter = filterName;
                        if (filterName === 'elite-ranking' && !window.state.currentRankTag) {
                            window.state.currentRankTag = window.state.kinksOptions[0];
                        }
                    } else if (tabName === 'feed') {
                        window.state.currentFilter = 'recommended';
                        window.state.currentRankTag = null;
                    }
                    window.state.singlePostFocusId = null; 
                    renderDashboard(container); 
                };
            };
  
            bindTabEvents('aside-tab-feed', 'feed', 'recommended');
            bindTabEvents('aside-tab-notifications', 'notifications');
            bindTabEvents('aside-tab-ranking', 'rank');
            bindTabEvents('aside-tab-spec-vault', 'spec-vault');
            bindTabEvents('aside-tab-badge-progress', 'badge-progress');
            bindTabEvents('mobile-tab-feed', 'feed', 'recommended');
            bindTabEvents('mobile-tab-ranking', 'rank');
            bindTabEvents('mobile-tab-profile', 'profile');
            bindTabEvents('mobile-btn-notifications', 'notifications');
  
            const logoutAction = () => {
                localStorage.removeItem('sr_username'); window.SRSecureAuth?.signOutMember?.();
                window.state.userData = {};
                window.state.applicationId = null;
                showToast('已安全退出 SecretRoom 俱樂部。', 'info');
                navigate('landing');
            };
  
            const logoutBtnAside = document.getElementById('aside-btn-logout');
            if (logoutBtnAside) logoutBtnAside.onclick = logoutAction;
  
            const logoutBtnMobile = document.getElementById('mobile-btn-logout');
            if (logoutBtnMobile) logoutBtnMobile.onclick = logoutAction;
  
            const shareBtnAside = document.getElementById('aside-btn-share');
            if (shareBtnAside) shareBtnAside.onclick = () => showSharePostModal();
  
            const shareBtnMobile = document.getElementById('mobile-btn-share');
            if (shareBtnMobile) shareBtnMobile.onclick = () => showSharePostModal();

            const mobileMenuBtn = document.getElementById('mobile-btn-menu');
            const mobileMenu = document.getElementById('mobile-feature-menu');
            const mobileMenuBackdrop = document.getElementById('mobile-feature-menu-backdrop');
            const mobileMenuClose = document.getElementById('mobile-feature-menu-close');
            const mobileMenuBgm = document.getElementById('mobile-menu-bgm-toggle');
            const mobileMenuSpec = document.getElementById('mobile-menu-spec-vault');
            const mobileMenuBadge = document.getElementById('mobile-menu-badge-progress');
            const closeMobileFeatureMenu = () => { if (mobileMenu) mobileMenu.classList.add('hidden'); };
            if (mobileMenuBtn) mobileMenuBtn.onclick = () => { if (mobileMenu) mobileMenu.classList.toggle('hidden'); };
            if (mobileMenuBackdrop) mobileMenuBackdrop.onclick = closeMobileFeatureMenu;
            if (mobileMenuClose) mobileMenuClose.onclick = closeMobileFeatureMenu;
            if (mobileMenuBgm) mobileMenuBgm.onclick = (e) => { e.stopPropagation(); window.toggleBGMState(); };
            if (mobileMenuSpec) mobileMenuSpec.onclick = () => { closeMobileFeatureMenu(); window.state.currentTab = 'spec-vault'; window.state.singlePostFocusId = null; renderDashboard(container); };
            if (mobileMenuBadge) mobileMenuBadge.onclick = () => { closeMobileFeatureMenu(); window.state.currentTab = 'badge-progress'; window.state.singlePostFocusId = null; renderDashboard(container); };

            const sidebarBgmBtn = document.getElementById('sidebar-bgm-btn');
            if (sidebarBgmBtn) {
                sidebarBgmBtn.onclick = (e) => {
                    e.stopPropagation();
                    window.toggleBGMState();
                };
            }

            const profileTrigger = document.getElementById('aside-profile-trigger');
            if (profileTrigger) {
                profileTrigger.onclick = () => {
                    window.state.currentTab = 'profile';
                    renderDashboard(container);
                };
            }
  
            const tabContentContainer = document.getElementById('dashboard-tab-content');
            if (window.state.currentTab === 'feed') {
                renderFeedTab(tabContentContainer);
            } else if (window.state.currentTab === 'rank') {
                renderRankTab(tabContentContainer);
            } else if (window.state.currentTab === 'notifications') {
                renderNotificationsTab(tabContentContainer);
            } else if (window.state.currentTab === 'profile') {
                renderProfileTab(tabContentContainer, window.state.applicationId);
            } else if (window.state.currentTab === 'spec-vault') {
                renderSpecVaultTab(tabContentContainer);
            } else if (window.state.currentTab === 'badge-progress') {
                renderBadgeProgressTab(tabContentContainer);
            } else if (window.state.currentTab === 'other-profile') {
                renderProfileTab(tabContentContainer, window.state.viewTargetUserId);
            }
  
            startRealtimeSnapshotSync();
        }
  
        function markNotificationAsRead(notificationId, silent = false) {
            if (!notificationId) return;
            const nextReadSet = getNotificationReadSet();
            const beforeSize = nextReadSet.size;
            nextReadSet.add(String(notificationId));
            saveNotificationReadSet(nextReadSet);
            updateNotificationIndicators();
            if (!silent && nextReadSet.size !== beforeSize) showToast('已標記為已讀。', 'success');
        }

        function renderNotificationsTab(container) {
            const items = getNotificationItems();
            const readSet = getNotificationReadSet();
            const unreadItems = items.filter(item => !readSet.has(item.id));
            const readItems = items.filter(item => readSet.has(item.id));
            const unreadCount = unreadItems.length;
            const activeInboxTab = window.state.notificationInboxTab === 'read' ? 'read' : 'unread';
            const activeTypeFilter = window.state.notificationTypeFilter || 'all';
            const baseDisplayItems = activeInboxTab === 'read' ? readItems : unreadItems;
            const displayItems = activeTypeFilter === 'all' ? baseDisplayItems : baseDisplayItems.filter(item => getNotificationTypeKey(item) === activeTypeFilter);
            const typeOptions = ['all', 'platform', 'report', 'spec', 'avatar', 'account', 'system'];
            const toneMap = {
                success: { icon: 'fa-circle-check', color: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5' },
                error: { icon: 'fa-circle-exclamation', color: 'text-red-400', border: 'border-red-500/20', bg: 'bg-red-500/5' },
                pending: { icon: 'fa-hourglass-half', color: 'text-amber-400', border: 'border-amber-500/20', bg: 'bg-amber-500/5' },
                platform: { icon: 'fa-bullhorn', color: 'text-amber-300', border: 'border-amber-500/20', bg: 'bg-amber-500/5' },
                report: { icon: 'fa-flag', color: 'text-rose-400', border: 'border-rose-500/20', bg: 'bg-rose-500/5' },
                account: { icon: 'fa-user-lock', color: 'text-cyan-300', border: 'border-cyan-500/20', bg: 'bg-cyan-500/5' },
                system: { icon: 'fa-gear', color: 'text-slate-300', border: 'border-slate-500/20', bg: 'bg-slate-500/5' }
            };
            const tabButtonClass = (tabName) => tabName === activeInboxTab
                ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 border-amber-200 shadow-[0_0_22px_rgba(223,183,108,0.28)]'
                : 'bg-slate-950/45 text-slate-400 border-amber-500/15 hover:text-amber-200';
            const renderNotificationCard = (item) => {
                const toneKey = item.tone || getNotificationTypeKey(item);
                const tone = toneMap[toneKey] || toneMap[getNotificationTypeKey(item)] || toneMap.platform;
                const isUnread = !readSet.has(item.id);
                const audience = String(item.target || item.audience || '').toLowerCase();
                const audienceText = audience === 'all' || audience === 'everyone' || audience === '全體會員' ? '全體會員' : (audience === 'sg' || audience === 's_plus_s_g' || audience === 's.s+.g' || audience === 's+ . s . g' ? 'S+ . S . G' : '個人通知');
                return `
                    <article data-notification-id="${escapeHtml(item.id)}" class="notification-item glass-panel crystal-border rounded-3xl p-4 md:p-5 border ${tone.border} ${tone.bg} relative overflow-hidden cursor-pointer hover-breath click-press transition ${isUnread ? 'ring-1 ring-red-500/15' : 'opacity-85'}">
                        ${isUnread ? '<div class="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.65)]"></div>' : ''}
                        <div class="flex gap-3.5 pr-5">
                            <div class="w-10 h-10 rounded-2xl bg-slate-950/70 border border-amber-500/15 flex items-center justify-center shrink-0 ${tone.color}"><i class="fa-solid ${tone.icon}"></i></div>
                            <div class="min-w-0 flex-1">
                                <div class="flex items-center gap-2 flex-wrap mb-1"><h3 class="text-sm md:text-base font-black text-slate-100">${escapeHtml(item.title || '平台通知')}</h3><span class="text-[9px] px-2 py-1 rounded-full border border-cyan-500/15 bg-slate-950/45 text-cyan-200/80 font-black">${getNotificationTypeLabel(getNotificationTypeKey(item))}</span><span class="text-[9px] px-2 py-1 rounded-full border border-amber-500/15 bg-slate-950/45 text-amber-300/80 font-black">${audienceText}</span>${isUnread ? '<span class="text-[9px] px-2 py-1 rounded-full border border-red-500/20 bg-red-500/10 text-red-300 font-black">未讀</span>' : '<span class="text-[9px] px-2 py-1 rounded-full border border-slate-700/60 bg-slate-950/35 text-slate-500 font-black">已讀</span>'}</div>
                                <p class="text-xs md:text-sm text-slate-400 leading-relaxed">${escapeHtml(item.message || item.body || '請查看最新平台狀態。')}</p>
                                <div class="mt-3 flex items-center justify-between gap-3 text-[10px] text-slate-500 font-mono"><span>${formatNotificationTime(item.createdAt || item.sentAt || item.createdAtMs || item.timestamp || item.updatedAt || item.reviewedAt)}</span>${item.status ? `<span class="font-black text-amber-300/80">${escapeHtml(item.status)}</span>` : ''}</div>
                            </div>
                        </div>
                    </article>`;
            };
            container.innerHTML = `
                <div class="space-y-5">
                    <div class="glass-panel crystal-border rounded-3xl p-5 md:p-6 relative overflow-hidden">
                        <div class="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-amber-500/10 blur-3xl"></div>
                        <div class="relative flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                            <div>
                                <div class="text-[10px] text-amber-400/75 font-black tracking-[0.26em] font-luxury">Notification Center</div>
                                <h2 class="text-2xl font-black text-white font-luxury tracking-wider mt-1">通知</h2>
                                <p class="text-xs text-slate-400 mt-2 leading-relaxed">集中查看檢舉進度、黃金 Spec 認證、大頭照更換，以及官方平台通知。訊息時間以發送或審核完成時間固定顯示。</p>
                            </div>
                            <button id="btn-mark-notifications-read" class="shrink-0 px-3.5 py-2 rounded-xl border border-amber-500/20 bg-slate-950/55 text-xs font-black text-amber-300 hover-breath click-press">全部已讀</button>
                        </div>
                        <div class="relative mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-amber-500/12 bg-slate-950/35 p-1.5">
                            <button id="btn-notification-tab-unread" class="px-3 py-2.5 rounded-xl border text-xs font-black transition ${tabButtonClass('unread')}">未讀訊息 <span class="font-mono">${unreadItems.length}</span></button>
                            <button id="btn-notification-tab-read" class="px-3 py-2.5 rounded-xl border text-xs font-black transition ${tabButtonClass('read')}">已讀訊息 <span class="font-mono">${readItems.length}</span></button>
                        </div>
                        <div class="relative mt-3 flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                            ${typeOptions.map(typeKey => {
                                const active = typeKey === activeTypeFilter;
                                const count = typeKey === 'all' ? baseDisplayItems.length : baseDisplayItems.filter(item => getNotificationTypeKey(item) === typeKey).length;
                                return `<button type="button" data-notification-type="${typeKey}" class="shrink-0 px-3 py-2 rounded-xl border text-[10px] font-black transition ${active ? 'bg-amber-500 text-slate-950 border-amber-200' : 'bg-slate-950/45 text-slate-400 border-amber-500/15'}">${getNotificationTypeLabel(typeKey)} <span class="font-mono">${count}</span></button>`;
                            }).join('')}
                        </div>
                    </div>
                    <div id="notifications-list" class="space-y-3">
                        ${displayItems.length === 0 ? `
                            <div class="glass-panel crystal-border rounded-3xl p-8 text-center">
                                <div class="w-14 h-14 rounded-full bg-slate-950/70 border border-amber-500/15 flex items-center justify-center mx-auto mb-4 text-amber-400"><i class="fa-regular fa-bell text-xl"></i></div>
                                <h3 class="font-black text-slate-200 mb-1">${activeInboxTab === 'read' ? '目前沒有已讀通知' : '目前沒有未讀通知'}${activeTypeFilter !== 'all' ? `（${getNotificationTypeLabel(activeTypeFilter)}）` : ''}</h3>
                                <p class="text-xs text-slate-500">${activeInboxTab === 'read' ? '點擊未讀通知後，該通知會移入已讀訊息。' : '有新的審核、檢舉或官方訊息時，會自動出現在這裡。'}</p>
                            </div>
                        ` : displayItems.map(renderNotificationCard).join('')}
                    </div>
                </div>`;
            const readBtn = document.getElementById('btn-mark-notifications-read');
            if (readBtn) {
                readBtn.onclick = () => {
                    const nextReadSet = getNotificationReadSet();
                    getNotificationItems().forEach(item => nextReadSet.add(item.id));
                    saveNotificationReadSet(nextReadSet);
                    window.state.notificationInboxTab = 'read';
                    updateNotificationIndicators();
                    showToast(unreadCount > 0 ? '通知已全部標記為已讀。' : '目前沒有未讀通知。', 'success');
                };
            }
            const unreadTabBtn = document.getElementById('btn-notification-tab-unread');
            const readTabBtn = document.getElementById('btn-notification-tab-read');
            if (unreadTabBtn) unreadTabBtn.onclick = () => { window.state.notificationInboxTab = 'unread'; renderNotificationsTab(container); };
            if (readTabBtn) readTabBtn.onclick = () => { window.state.notificationInboxTab = 'read'; renderNotificationsTab(container); };
            document.querySelectorAll('[data-notification-type]').forEach(btn => {
                btn.onclick = () => {
                    window.state.notificationTypeFilter = btn.getAttribute('data-notification-type') || 'all';
                    renderNotificationsTab(container);
                };
            });
            document.querySelectorAll('.notification-item[data-notification-id]').forEach(card => {
                card.onclick = () => {
                    const id = card.getAttribute('data-notification-id');
                    if (!getNotificationReadSet().has(id)) {
                        markNotificationAsRead(id, true);
                        window.state.notificationInboxTab = 'read';
                        const tabContentContainer = document.getElementById('dashboard-tab-content');
                        if (tabContentContainer) renderNotificationsTab(tabContentContainer);
                    }
                };
            });
        }

        function renderBadgeProgressTab(container) {
            const user = { id: window.state.applicationId, ...(window.state.userData || {}) };
            const userPosts = window.state.posts.filter(p => p.userId === window.state.applicationId);
            const totalLikes = userPosts.reduce((sum, p) => sum + (p.likeCount || 0), 0);
            const createdSecs = user.createdAt ? user.createdAt.seconds : 0;
            const nowSecs = Date.now() / 1000;
            const isNewThisWeek = !!(createdSecs && (nowSecs - createdSecs) <= (168 * 3600));
            const perfectPosts = userPosts.filter(p => {
                const ratings = p.ratings ? Object.values(p.ratings) : [];
                const avg = ratings.length > 0 ? (ratings.reduce((a,b)=>a+b, 0) / ratings.length) : 0;
                return avg === 5.0 && ratings.length >= 500;
            });
            const perfectAll = userPosts.length >= 50 && perfectPosts.length === userPosts.length;
            const specApproved = isGoldSpecApproved(user);
            const specPending = String(user.specEliteStatus || '').toLowerCase() === 'pending';

            const progressItems = [
                {
                    icon: 'fa-crown',
                    title: '官方最高權限治理者',
                    desc: '授予負責平台治理、會員安全與重大決策的最高管理身分。此徽章不開放一般申請。',
                    unlocked: user.role === 'admin' || user.isAdmin === true,
                    note: (user.role === 'admin' || user.isAdmin === true) ? '已啟用' : '官方授權限定'
                },
                {
                    icon: 'fa-seedling',
                    title: '本週新進之尊貴仕紳',
                    desc: '加入俱樂部七日內自動顯示，象徵新會員完成入駐並進入社群禮遇期。',
                    unlocked: isNewThisWeek,
                    note: isNewThisWeek ? '禮遇期內' : '入會七日內限定'
                },
                {
                    icon: 'fa-shield-halved',
                    title: '創始階段終身元老',
                    desc: '保留給平台早期即入駐、共同奠定俱樂部文化與社群秩序的創始會員。',
                    unlocked: user.isPioneer === true,
                    note: user.isPioneer === true ? '已取得' : '創始會員限定'
                },
                {
                    icon: 'fa-medal',
                    title: '黃金 Spec 實證認證',
                    desc: '通過官方審核的身體規格實證認證。通過後將同步開啟 S+ . S . G 專區權限。',
                    unlocked: specApproved,
                    note: specApproved ? '已通過' : (specPending ? '審核中' : '可於個人主頁申請')
                },
                {
                    icon: 'fa-fire',
                    title: '社群人氣王',
                    desc: '累計獲得超過一千次按讚，代表作品在俱樂部內具備高度關注與互動聲量。',
                    unlocked: totalLikes >= 1000,
                    note: `${totalLikes} / 1000 讚`
                },
                {
                    icon: 'fa-star',
                    title: '無瑕滿分典藏',
                    desc: '多篇作品維持滿分評價，且累積足夠評分數後解鎖，象徵內容品質穩定受到肯定。',
                    unlocked: perfectAll,
                    note: perfectAll ? '已達成' : `${perfectPosts.length} 篇符合滿分門檻`
                },
                {
                    icon: 'fa-camera',
                    title: '百篇動態創作者',
                    desc: '累計發布上百篇動態作品，代表長期穩定創作、分享與維持社群活躍。',
                    unlocked: userPosts.length >= 100,
                    note: `${userPosts.length} / 100 篇`
                }
            ];

            container.innerHTML = `
                <div class="space-y-5">
                    <div class="glass-panel crystal-border rounded-3xl p-5 md:p-6 relative overflow-hidden">
                        <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-[10px] font-black text-amber-300 tracking-widest mb-3">
                            <i class="fa-solid fa-award"></i> Badge Progress
                        </div>
                        <h2 class="text-2xl md:text-3xl font-black text-white font-luxury tracking-widest">徽章進度</h2>
                        <p class="text-sm text-slate-300 mt-2 leading-relaxed">
                            這裡整理目前所有榮譽徽章的解鎖條件與你的完成狀態。徽章會依照帳號權限、入會時間、黃金 Spec 審核、作品數量、按讚與評價表現自動更新。
                        </p>
                    </div>
                    <div class="grid grid-cols-1 gap-4">
                        ${progressItems.map(item => `
                            <article class="glass-panel crystal-border rounded-3xl p-4 md:p-5 flex items-start gap-4">
                                <div class="w-11 h-11 rounded-2xl ${item.unlocked ? 'brushed-gold text-slate-950' : 'bg-slate-900/70 text-slate-500 border border-amber-500/15'} flex items-center justify-center shrink-0">
                                    <i class="fa-solid ${item.icon}"></i>
                                </div>
                                <div class="min-w-0 flex-1">
                                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                                        <h3 class="text-sm font-black ${item.unlocked ? 'text-white' : 'text-slate-300'}">${item.title}</h3>
                                        <span class="text-[10px] px-2.5 py-1 rounded-full ${item.unlocked ? 'bg-emerald-500/12 border border-emerald-400/25 text-emerald-300' : 'bg-slate-900/70 border border-amber-500/15 text-slate-400'} font-bold shrink-0">${item.unlocked ? '已解鎖' : '未解鎖'}</span>
                                    </div>
                                    <p class="text-xs text-slate-400 mt-2 leading-relaxed">${item.desc}</p>
                                    <div class="text-[10px] text-amber-300/80 mt-3 font-bold tracking-wider">${item.note}</div>
                                </div>
                            </article>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        function renderSpecVaultTab(container) {
            const isAuthorized = canAccessSpecVault();
            const selfUser = window.state.applicationId ? { id: window.state.applicationId, ...window.state.userData } : null;
            const merged = [];
            const seen = new Set();
            [selfUser, ...window.state.activeUsers].forEach((user) => {
                if (!user || !user.id || seen.has(user.id)) return;
                seen.add(user.id);
                merged.push(user);
            });

            const specApplicants = merged
                .filter(user => user.id !== window.state.applicationId)
                .filter(user => user.specImage && isGoldSpecApproved(user))
                .sort((a, b) => String(a.nickname || a.id || '').localeCompare(String(b.nickname || b.id || ''), 'zh-Hant'));

            if (!isAuthorized) {
                container.innerHTML = `
                    <div class="glass-panel crystal-border rounded-3xl p-6 md:p-8 space-y-6 text-center">
                        <div class="mx-auto w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 text-2xl">
                            <i class="fa-solid fa-user-shield"></i>
                        </div>
                        <div>
                            <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full brushed-gold crystal-border text-[10px] font-black tracking-wider mb-4">黃金Spec限定</div>
                            <h2 class="text-2xl font-black text-white font-luxury tracking-widest">S+ . S . G</h2>
                            <p class="text-sm text-slate-300 mt-3 leading-relaxed">
                                此區僅供已申請並通過黃金 Spec 認證的會員進入。通過後可查看其他已通過黃金 Spec 會員當初申請認證時提交的審核照片。
                            </p>
                        </div>
                        <div class="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-left">
                            <h3 class="text-sm font-bold text-rose-300 flex items-center gap-2"><i class="fa-solid fa-eye-slash"></i> NSFW Gold Spec Gate</h3>
                            <p class="text-xs text-slate-400 mt-2 leading-relaxed">為避免私密照片外流，未通過黃金 Spec 認證的會員無法進入本區。若符合身長與粗度門檻，可先至個人檔案申請黃金 Spec 認證。</p>
                        </div>
                    </div>
                `;
                return;
            }

            container.innerHTML = `
                <div class="space-y-5">
                    <div class="glass-panel crystal-border rounded-3xl p-5 md:p-6 relative overflow-hidden">
                        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative z-10">
                            <div>
                                <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full brushed-gold crystal-border text-[10px] font-black tracking-wider mb-3">黃金Spec限定</div>
                                <h2 class="text-2xl md:text-3xl font-black text-white font-luxury tracking-widest">S+ . S . G</h2>
                                <p class="text-sm text-slate-300 mt-2 leading-relaxed">集中檢視其他已通過黃金 Spec 會員當初申請認證時提交的私密審核照片。所有照片均覆蓋 NSFW 提醒與滿版 SecretRomm 浮水印。</p>
                            </div>
                            <div class="text-right">
                                <div class="text-3xl font-black text-amber-300 font-luxury">${specApplicants.length}</div>
                                <div class="text-[10px] text-slate-400 tracking-widest">Approved Member Photos</div>
                            </div>
                        </div>
                    </div>

                    <div class="p-4 rounded-3xl bg-rose-500/10 border border-rose-500/25 crystal-border">
                        <h3 class="text-sm font-black text-rose-300 flex items-center gap-2"><i class="fa-solid fa-triangle-exclamation"></i> NSFW 審核提醒</h3>
                        <p class="text-xs text-slate-300 mt-2 leading-relaxed">本區包含通過黃金 Spec 會員之私密審核照片，僅供 S+ . S . G 會員於站內查看。請勿截圖、轉傳、下載或外流。</p>
                    </div>

                    <div id="spec-vault-list" class="grid grid-cols-1 gap-5">
                        ${specApplicants.length === 0 ? `
                            <div class="glass-panel crystal-border rounded-3xl p-8 text-center text-slate-400">
                                <i class="fa-solid fa-folder-open text-2xl text-amber-500/70 mb-3"></i>
                                <div class="font-bold text-sm">目前沒有其他已通過黃金 Spec 的審核照片</div>
                                <div class="text-xs mt-1 text-slate-500">當其他會員通過黃金 Spec 認證後，會在此區出現。</div>
                            </div>
                        ` : specApplicants.map(user => renderSpecApplicantCard(user)).join('')}
                    </div>
                </div>
            `;
        }

        function renderSpecApplicantCard(user) {
            const safeUserId = escapeHtml(user.id);
            const jsUserId = escapeJsString(user.id);
            const safeNickname = escapeHtml(user.nickname || user.id || 'Unknown Member');
            const status = escapeHtml(isGoldSpecApproved(user) ? 'approved' : (user.specEliteStatus || 'pending'));
            const isUnlocked = window.state.unlockedSpecVaultImages[user.id] || false;
            const length = escapeHtml(user.length || '-');
            const girth = escapeHtml(user.girth || '-');
            const imgSrc = user.specImage || '';

            const imageHtml = isUnlocked ? `
                <div class="relative w-full rounded-2xl overflow-hidden border border-amber-500/20 bg-slate-950 flex items-center justify-center min-h-[260px] max-h-[620px] select-none">
                    <img src="${imgSrc}" class="w-full h-auto max-h-[600px] object-contain pointer-events-none" draggable="false" oncontextmenu="return false;">
                    ${renderWatermarkOverlay(user.id, 0.055)}
                    <div class="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-rose-950/80 border border-rose-400/30 text-rose-200 text-[10px] font-black tracking-widest backdrop-blur-md z-20">NSFW</div>
                </div>
            ` : `
                <div class="relative w-full rounded-2xl overflow-hidden border border-rose-500/20 bg-slate-950 h-72 sm:h-96 group cursor-pointer click-press select-none" onclick="unlockSpecVaultImage('${jsUserId}')">
                    <img src="${imgSrc}" class="w-full h-full object-cover filter blur-3xl opacity-35 pointer-events-none" draggable="false" oncontextmenu="return false;">
                    ${renderWatermarkOverlay(user.id, 0.045, true)}
                    <div class="absolute inset-0 bg-[#0c0a08]/88 backdrop-blur-md flex flex-col items-center justify-center text-center p-5 z-20">
                        <div class="w-12 h-12 bg-rose-500/15 rounded-full flex items-center justify-center text-rose-300 text-xl mb-3 shadow-lg shadow-rose-950/20 border border-rose-500/25">
                            <i class="fa-solid fa-eye-slash"></i>
                        </div>
                        <h5 class="text-sm font-black text-rose-300 tracking-widest">NSFW 黃金 Spec 審核照</h5>
                        <p class="text-xs text-slate-400 mt-2 leading-relaxed">點擊後僅於本機臨時解鎖顯示，照片仍會保留 SecretRomm 滿版浮水印。</p>
                    </div>
                </div>
            `;

            return `
                <article class="spec-vault-card glass-panel crystal-border rounded-3xl p-4 md:p-5 space-y-4 overflow-hidden">
                    <div class="flex items-center justify-between gap-3">
                        <div class="flex items-center gap-3 min-w-0">
                            <img src="${user.avatar || 'Gemini_Generated_Image_e2fxvje2fxvje2fx.jpg?v=2'}" class="w-10 h-10 rounded-full object-cover border border-amber-500/30 shrink-0">
                            <div class="min-w-0">
                                <h3 class="font-black text-white text-sm truncate">${safeNickname}</h3>
                                <p class="text-[10px] text-slate-400 font-mono truncate">@${safeUserId}</p>
                            </div>
                        </div>
                        <div class="flex flex-col items-end gap-1 shrink-0">
                            <span class="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-[10px] font-black text-amber-300">${status}</span>
                            <span class="text-[10px] text-slate-500">${length} cm / ${girth} cm</span>
                        </div>
                    </div>
                    ${imageHtml}
                </article>
            `;
        }

        window.unlockSpecVaultImage = function(userId) {
            if (!canAccessSpecVault()) {
                showToast('此區僅限已通過黃金 Spec 認證的會員查看。', 'error');
                return;
            }
            window.state.unlockedSpecVaultImages[userId] = true;
            const tabContentContainer = document.getElementById('dashboard-tab-content');
            if (tabContentContainer) renderSpecVaultTab(tabContentContainer);
        };

        function startRealtimeSnapshotSync() {
            if (!db || window.state.unsubscribeListener) return;
  
            const postsQuery = query(collection(db, 'secretg_apps', appId, 'posts'));
            window.state.unsubscribeListener = onSnapshot(postsQuery, (snapshot) => {
                const fetchedPosts = [];
                snapshot.forEach((docSnap) => {
                    fetchedPosts.push({ id: docSnap.id, ...docSnap.data() });
                });
                window.state.posts = fetchedPosts;
                updateSearchAndFeedUI();
            }, (err) => console.error("Snapshot error:", err));
  
            const usersQuery = query(collection(db, 'secretg_apps', appId, 'applications'), where('status', '==', 'active'));
            window.state.unsubscribeUsersListener = onSnapshot(usersQuery, (snapshot) => {
                const fetchedUsers = [];
                snapshot.forEach((docSnap) => {
                    fetchedUsers.push({ id: docSnap.id, ...docSnap.data() });
                });
                window.state.activeUsers = fetchedUsers;
                renderActiveUsersAside();
                updateNotificationIndicators();
                if (window.state.currentTab === 'spec-vault') {
                    const tabContentContainer = document.getElementById('dashboard-tab-content');
                    if (tabContentContainer) renderSpecVaultTab(tabContentContainer);
                }
            }, (err) => console.error("Users Snapshot error:", err));

            startNotificationReadSync();

            const notificationsQuery = query(collection(db, 'secretg_apps', appId, 'notifications'));
            window.state.unsubscribeNotificationsListener = onSnapshot(notificationsQuery, (snapshot) => {
                const fetchedNotifications = [];
                snapshot.forEach((docSnap) => {
                    fetchedNotifications.push({ id: docSnap.id, ...docSnap.data() });
                });
                window.state.notifications = fetchedNotifications;
                updateNotificationIndicators();
            }, (err) => console.error("Notifications Snapshot error:", err));
        }
  
        function renderMobileActiveUsersList() {
            const listContainer = document.getElementById('mobile-active-users-list');
            if (!listContainer) return;
            listContainer.innerHTML = '';
            const showList = (window.state.activeUsers || [])
                .filter(u => u && u.id && u.id !== window.state.applicationId)
                .slice(0, 8);

            if (showList.length === 0) {
                listContainer.innerHTML = '<div class="text-xs text-slate-500 py-3 text-center border border-amber-500/10 rounded-2xl bg-slate-950/35">目前尚無其他活躍帳號</div>';
                return;
            }

            showList.forEach((user) => {
                const card = document.createElement('button');
                card.type = 'button';
                card.className = 'w-full flex items-center justify-between p-2.5 bg-slate-950/45 rounded-2xl border border-amber-500/10 transition hover-breath click-press';
                card.onclick = () => window.mobileOpenUserProfile(user.id);
                card.innerHTML = `
                    <span class="flex items-center gap-2.5 min-w-0 text-left">
                        <img src="${user.avatar || 'Gemini_Generated_Image_e2fxvje2fxvje2fx.jpg?v=2'}" class="w-8 h-8 rounded-full object-cover border border-amber-500/20 shrink-0">
                        <span class="min-w-0">
                            <span class="block text-sm font-black text-slate-200 truncate">${escapeHtml(user.nickname || user.id)}</span>
                            <span class="block text-[10px] text-slate-500 font-mono truncate">@${escapeHtml(user.id)}</span>
                        </span>
                    </span>
                    <i class="fa-solid fa-chevron-right text-[10px] text-amber-400/70"></i>
                `;
                listContainer.appendChild(card);
            });
        }

        function renderActiveUsersAside() {
            renderMobileActiveUsersList();
            const listContainer = document.getElementById('active-users-list-aside');
            if (!listContainer) return;
  
            listContainer.innerHTML = '';
            const showList = window.state.activeUsers
                .filter(u => u.id !== window.state.applicationId)
                .slice(0, 4);
  
            if (showList.length === 0) {
                listContainer.innerHTML = '<div class="text-xs text-slate-500 py-3 text-center">目前尚無其他活躍同好</div>';
                return;
            }
  
            showList.forEach((user) => {
                const card = document.createElement('div');
                card.className = 'flex items-center justify-between p-2.5 bg-slate-900/60 rounded-2xl border border-amber-500/10 cursor-pointer transition duration-300 shadow-md hover-breath click-press';
                card.onclick = () => viewUserProfile(user.id);
                card.innerHTML = `
                    <div class="flex items-center gap-2.5 overflow-hidden">
                        <img src="${user.avatar || 'Gemini_Generated_Image_e2fxvje2fxvje2fx.jpg?v=2'}" class="w-8 h-8 rounded-full object-cover border border-amber-500/20">
                        <div class="overflow-hidden">
                            <div class="flex items-center gap-1.5">
                                <h4 class="font-bold text-sm text-slate-300 truncate">${user.nickname}</h4>
                            </div>
                            <span class="text-[10px] text-slate-550 block truncate font-mono mt-0.5">@${user.id}</span>
                        </div>
                    </div>
                    <i class="fa-solid fa-chevron-right text-xs text-amber-500/60"></i>
                `;
                listContainer.appendChild(card);
            });
        }
  

        function parsePostTimeValue(value) {
            if (value && value.seconds) return value.seconds * 1000;
            if (value && typeof value.toDate === 'function') {
                const d = value.toDate();
                return d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
            }
            if (typeof value === 'number') return value;
            if (typeof value === 'string') {
                const t = new Date(value).getTime();
                return Number.isNaN(t) ? 0 : t;
            }
            return 0;
        }

        function getWeeklyRankWindow(baseDate = new Date()) {
            const current = new Date(baseDate);
            const day = current.getDay();
            const diffToMonday = day === 0 ? -6 : 1 - day;
            const start = new Date(current.getFullYear(), current.getMonth(), current.getDate() + diffToMonday, 0, 0, 0, 0);
            const end = new Date(start);
            end.setDate(start.getDate() + 7);
            end.setMilliseconds(-1);
            return { start, end };
        }

        function floorOneDecimal(value) {
            return Math.floor((Number(value) || 0) * 10) / 10;
        }

        function getPostRankStats(post) {
            const likes = Number(post.likeCount || Object.keys(post.likes || {}).length || 0);
            const ratingValues = Object.values(post.ratings || {}).map(Number).filter(v => Number.isFinite(v) && v > 0);
            const ratingCount = ratingValues.length;
            const ratingSum = ratingValues.reduce((sum, value) => sum + value, 0);
            const avgRating = ratingCount > 0 ? ratingSum / ratingCount : 0;
            const ratingComponent = avgRating > 0 ? ratingCount / avgRating : 0;
            const score = floorOneDecimal((likes * 0.3) + ratingComponent);
            return { likes, ratingCount, ratingSum, avgRating, ratingComponent, score };
        }

        function getRankTier(score) {
            const value = Number(score) || 0;
            if (value > 1350) return { code: 'Z.G', name: 'Zenith Grade', min: 1350, tone: 'from-fuchsia-300 via-amber-200 to-cyan-200', note: '超越 1350' };
            if (value >= 1350) return { code: 'SSR.G', name: 'Secret Super Rare Grade', min: 1350, tone: 'from-violet-300 via-amber-200 to-rose-200', note: '1350' };
            if (value >= 750) return { code: 'S+.G', name: 'Superior Plus Grade', min: 750, tone: 'from-amber-200 via-yellow-300 to-amber-500', note: '750' };
            if (value >= 500) return { code: 'S.G', name: 'Superior Grade', min: 500, tone: 'from-yellow-200 via-amber-400 to-orange-500', note: '500' };
            if (value >= 250) return { code: 'A.G', name: 'Apex Grade', min: 250, tone: 'from-blue-200 via-cyan-300 to-amber-200', note: '250' };
            if (value >= 150) return { code: 'B.G', name: 'Brass Grade', min: 150, tone: 'from-emerald-200 via-teal-300 to-slate-200', note: '150' };
            if (value >= 100) return { code: 'C.G', name: 'Classic Grade', min: 100, tone: 'from-slate-200 via-slate-300 to-amber-100', note: '100' };
            if (value >= 50) return { code: 'D.G', name: 'Dawn Grade', min: 50, tone: 'from-stone-300 via-amber-200 to-stone-500', note: '50' };
            return { code: 'N.G', name: 'No Grade', min: 0, tone: 'from-slate-500 via-slate-400 to-slate-600', note: '未達 50' };
        }

        function getWeeklyRankData() {
            const { start, end } = getWeeklyRankWindow();
            const startMs = start.getTime();
            const endMs = end.getTime();
            const weeklyPosts = (window.state.posts || []).filter(post => {
                const t = parsePostTimeValue(post.createdAt || post.createdAtMs || post.timestamp);
                return t >= startMs && t <= endMs;
            }).map(post => ({ ...post, rankStats: getPostRankStats(post) }));
            const memberMap = new Map();
            weeklyPosts.forEach(post => {
                const userId = post.userId || 'unknown';
                const userProfile = (window.state.activeUsers || []).find(u => u.id === userId) || {};
                if (!memberMap.has(userId)) {
                    memberMap.set(userId, {
                        userId,
                        nickname: post.authorName || userProfile.nickname || userId,
                        avatar: post.authorAvatar || userProfile.avatar || '',
                        score: 0,
                        likes: 0,
                        ratingCount: 0,
                        ratingSum: 0,
                        posts: [],
                        topPost: null
                    });
                }
                const entry = memberMap.get(userId);
                entry.score += post.rankStats.score;
                entry.likes += post.rankStats.likes;
                entry.ratingCount += post.rankStats.ratingCount;
                entry.ratingSum += post.rankStats.ratingSum;
                entry.posts.push(post);
                if (!entry.topPost || post.rankStats.score > entry.topPost.rankStats.score) entry.topPost = post;
            });
            const members = Array.from(memberMap.values()).map(entry => ({
                ...entry,
                score: floorOneDecimal(entry.score),
                avgRating: entry.ratingCount > 0 ? entry.ratingSum / entry.ratingCount : 0,
                tier: getRankTier(floorOneDecimal(entry.score))
            })).sort((a, b) => b.score - a.score || b.likes - a.likes || b.ratingCount - a.ratingCount);
            return { start, end, weeklyPosts, members };
        }

        function renderRankTab(container) {
            window.SRRankPolicy?.render?.();
        }

        function renderFeedTab(container) {
            container.innerHTML = `
                <div class="relative w-full z-20">
                    <div class="flex items-center bg-slate-900/60 border border-amber-500/20 rounded-2xl px-4 py-3 shadow-lg backdrop-blur-md">
                        <i class="fa-solid fa-magnifying-glass text-amber-500/70 text-sm mr-3"></i>
                        <input type="text" id="feed-search-input" class="w-full bg-transparent text-sm text-white focus:outline-none" placeholder="搜尋動態、標籤、暱稱或帳號 Id" value="${window.state.searchTerm}">
                    </div>
                    
                    <div id="search-results-overlay" class="absolute left-0 right-0 top-14 bg-slate-900/95 border border-amber-500/20 rounded-3xl p-4 shadow-2xl hidden flex flex-col gap-3 max-h-[450px] overflow-hidden z-50 backdrop-blur-xl crystal-border">
                    </div>
                </div>
  
                <div class="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
                    
                    <button onclick="setGlobalFilter('recommended')" id="filter-btn-recommended" class="shrink-0 text-[11px] sm:text-xs font-bold tracking-widest px-4 py-2.5 sm:px-6 sm:py-3.5 rounded-full border transition-all duration-300 hover-breath click-press ${window.state.currentFilter === 'recommended' ? 'brushed-gold crystal-border' : 'bg-slate-950/40 text-slate-400 border-amber-500/10'}">
                        <i class="fa-solid fa-wand-magic-sparkles mr-1"></i>智慧推薦
                    </button>
                    <button onclick="setGlobalFilter('highly-rated')" id="filter-btn-highly-rated" class="shrink-0 text-[11px] sm:text-xs font-bold tracking-widest px-4 py-2.5 sm:px-6 sm:py-3.5 rounded-full border transition-all duration-300 hover-breath click-press ${window.state.currentFilter === 'highly-rated' ? 'brushed-gold crystal-border' : 'bg-slate-950/40 text-slate-400 border-amber-500/10'}">
                        <i class="fa-solid fa-star mr-1"></i>高分評分
                    </button>
                    <button onclick="setGlobalFilter('popular')" id="filter-btn-popular" class="shrink-0 text-[11px] sm:text-xs font-bold tracking-widest px-4 py-2.5 sm:px-6 sm:py-3.5 rounded-full border transition-all duration-300 hover-breath click-press ${window.state.currentFilter === 'popular' ? 'brushed-gold crystal-border' : 'bg-slate-950/40 text-slate-400 border-amber-500/10'}">
                        <i class="fa-solid fa-fire-flame-curved mr-1"></i>人氣按讚
                    </button>
                </div>
  
                <div id="ranking-sub-tabs" class="hidden flex items-center gap-2 overflow-x-auto scrollbar-hide py-2 border-t border-b border-amber-500/10">
                    
                    <span class="shrink-0 text-xs font-bold text-amber-500 tracking-widest mr-1">排名分類:</span>
                    ${window.state.kinksOptions.map((k) => `
                        <button onclick="setRankingTag('${k}')" class="sub-rank-btn shrink-0 text-xs font-bold px-4 py-2 rounded-full border transition duration-300 hover-breath click-press ${window.state.currentRankTag === k ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-slate-950/30 text-slate-500 border-amber-500/10'}" data-tag="${k}">
                            # ${k}
                        </button>
                    `).join('')}
                </div>
  
                <div class="space-y-4" id="feed-posts-list">
                    <div class="text-center py-12 text-slate-400 flex flex-col items-center gap-2">
                        <i class="fa-solid fa-circle-notch animate-spin text-2xl text-amber-500"></i>
                        <span>正在與俱樂部建立通道...</span>
                    </div>
                </div>
            `;
  
            const searchInput = document.getElementById('feed-search-input');
            searchInput.oninput = (e) => {
                window.state.searchTerm = e.target.value;
                clearTimeout(window.state.searchTimeout);
                window.state.searchTimeout = setTimeout(() => {
                    updateSearchAndFeedUI();
                }, 150);
            };
  
            const mainScroll = document.getElementById('main-content-scroll');
            if (mainScroll) {
                mainScroll.onscroll = () => {
                    if (mainScroll.scrollTop + mainScroll.clientHeight >= mainScroll.scrollHeight - 60) {
                        window.state.visiblePostsCount += 5;
                        updateSearchAndFeedUI();
                    }
                };
            }
  
            updateSearchAndFeedUI();
        }
  
        window.setGlobalFilter = function(filterName) {
            window.state.currentFilter = filterName;
            window.state.singlePostFocusId = null; 
            
            if (filterName !== 'elite-ranking') {
                window.state.currentRankTag = null;
            } else if (!window.state.currentRankTag) {
                window.state.currentRankTag = window.state.kinksOptions[0];
            }
            
            const tabs = ['recommended', 'highly-rated', 'popular'];
            tabs.forEach(t => {
                const btn = document.getElementById(`filter-btn-${t}`);
                if (btn) {
                    if (t === filterName) {
                        btn.className = "shrink-0 text-[11px] sm:text-xs font-bold tracking-widest px-4 py-2.5 sm:px-6 sm:py-3.5 rounded-full border transition-all duration-300 brushed-gold crystal-border hover-breath click-press";
                    } else {
                        btn.className = "shrink-0 text-[11px] sm:text-xs font-bold tracking-widest px-4 py-2.5 sm:px-6 sm:py-3.5 rounded-full border transition-all duration-300 bg-slate-950/40 text-slate-400 border-amber-500/10 hover-breath click-press";
                    }
                }
            });
  
            const subTabsContainer = document.getElementById('ranking-sub-tabs');
            if (subTabsContainer) {
                if (filterName === 'elite-ranking') {
                    subTabsContainer.classList.remove('hidden');
                } else {
                    subTabsContainer.classList.add('hidden');
                }
            }
  
            updateSearchAndFeedUI();
        };
  
        window.setRankingTag = function(kinkTag) {
            window.state.currentRankTag = kinkTag;
            window.state.singlePostFocusId = null; 
            
            document.querySelectorAll('.sub-rank-btn').forEach(btn => {
                const dataTag = btn.getAttribute('data-tag');
                if (dataTag === kinkTag) {
                    btn.className = "sub-rank-btn shrink-0 text-xs font-bold px-4 py-2 rounded-full border transition duration-300 bg-amber-500/10 text-amber-400 border-amber-500/30 click-press";
                } else {
                    btn.className = "sub-rank-btn shrink-0 text-xs font-bold px-4 py-2 rounded-full border border-amber-500/10 bg-slate-950/30 text-slate-500 transition duration-300 hover-breath click-press";
                }
            });
  
            updateSearchAndFeedUI();
        };
  
        window.setSearchTab = function(tabName) {
            window.state.searchTab = tabName;
            updateSearchAndFeedUI();
        };
  
        window.viewSinglePost = function(postId) {
            window.state.currentTab = 'feed';
            window.state.singlePostFocusId = postId;
            window.state.searchTerm = ''; 
            const searchInput = document.getElementById('feed-search-input');
            if (searchInput) searchInput.value = '';
            const searchOverlay = document.getElementById('search-results-overlay');
            if (searchOverlay) searchOverlay.classList.add('hidden');
            
            if (!window.state.viewedPostsInSession[postId]) {
                window.state.viewedPostsInSession[postId] = true;
                incrementPostViewCount(postId);
            }
            
            renderDashboard(appContainer);
        };
  
        window.clearSinglePostFocus = function() {
            window.state.singlePostFocusId = null;
            updateSearchAndFeedUI();
        };
  
        function updateSearchAndFeedUI() {
            const listContainer = document.getElementById('feed-posts-list');
            if (!listContainer) return;
  
            const term = window.state.searchTerm.toLowerCase().trim();
            const searchOverlay = document.getElementById('search-results-overlay');
  
            if (searchOverlay) {
                if (term) {
                    searchOverlay.classList.remove('hidden');
                    
                    const matchedUsers = window.state.activeUsers.filter(u => 
                        u.id.toLowerCase().includes(term) || u.nickname.toLowerCase().includes(term)
                    );
  
                    const matchedPosts = window.state.posts.filter(post => 
                        (post.text && post.text.toLowerCase().includes(term)) || 
                        post.authorName.toLowerCase().includes(term) ||
                        post.userId.toLowerCase().includes(term) ||
                        (post.kinks && post.kinks.some(k => k.toLowerCase().includes(term)))
                    );
  
                    searchOverlay.innerHTML = `
                        <div class="flex border-b border-amber-500/10 pb-2">
                            
                            <button onclick="setSearchTab('posts')" class="flex-1 text-center py-2 text-sm font-bold tracking-wider transition click-press ${window.state.searchTab === 'posts' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-500 hover:text-slate-300'}">
                                動態貼文 (${matchedPosts.length})
                            </button>
                            <button onclick="setSearchTab('users')" class="flex-1 text-center py-2 text-sm font-bold tracking-wider transition click-press ${window.state.searchTab === 'users' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-500 hover:text-slate-300'}">
                                俱樂部成員 (${matchedUsers.length})
                            </button>
                        </div>
                        
                        <div class="overflow-y-auto pr-1 flex-1 space-y-2 max-h-[350px]">
                            ${window.state.searchTab === 'posts' ? 
                                (matchedPosts.length === 0 ? 
                                    `\<div class="text-[10px] text-slate-550 py-6 text-center font-light"\>未尋得相符動態貼文\</div\>` :
                                    matchedPosts.map(post => `
                                        <div class="p-2 bg-slate-900/60 border border-amber-500/10 rounded-xl transition cursor-pointer hover-breath click-press" onclick="viewSinglePost('${post.id}')">
                                            <div class="flex items-center gap-1.5 mb-1">
                                                <img src="${post.authorAvatar || 'Gemini_Generated_Image_e2fxvje2fxvje2fx.jpg?v=2'}" class="w-5 h-5 rounded-full object-cover">
                                                <div>
                                                    <span class="text-[11px] font-bold text-slate-300 block leading-tight">${post.authorName}</span>
                                                    <span class="text-[8px] text-slate-550 font-mono block">@${post.userId}</span>
                                                </div>
                                            </div>
                                            <p class="text-[10px] text-slate-400 truncate">${post.text || '(發布相片)'}</p>
                                        </div>
                                    `).join('')
                                ) :
                                (matchedUsers.length === 0 ? 
                                    `\<div class="text-[10px] text-slate-555 py-6 text-center font-light"\>未尋得相符同好\</div\>` :
                                    matchedUsers.map(u => `
                                        <div onclick="viewUserProfile('${u.id}')" class="flex items-center justify-between p-1.5 bg-slate-900/60 border border-amber-500/10 rounded-xl transition cursor-pointer hover-breath click-press">
                                            <div class="flex items-center gap-2 overflow-hidden">
                                                <img src="${u.avatar || 'Gemini_Generated_Image_e2fxvje2fxvje2fx.jpg?v=2'}" class="w-6 h-6 rounded-full object-cover border border-amber-500/10">
                                                <div class="overflow-hidden">
                                                    <div class="flex items-center gap-1">
                                                        <span class="text-[11px] font-bold text-slate-200 truncate">${u.nickname}</span>
                                                        ${getBadgeHTML(u)}
                                                    </div>
                                                    <span class="text-[8px] text-slate-555 block">@${u.id}</span>
                                                </div>
                                            </div>
                                            <i class="fa-solid fa-chevron-right text-[10px] text-amber-500/50"></i>
                                        </div>
                                    `).join('')
                                )
                            }
                        </div>
                    `;
                } else {
                    searchOverlay.classList.add('hidden');
                }
            }
  
            let list = [...window.state.posts];
            let isFocusedMode = false;
  
            if (window.state.singlePostFocusId) {
                list = list.filter(post => post.id === window.state.singlePostFocusId);
                isFocusedMode = true;
            } else {
                if (term) {
                    list = list.filter(post => 
                        (post.text && post.text.toLowerCase().includes(term)) || 
                        post.authorName.toLowerCase().includes(term) ||
                        post.userId.toLowerCase().includes(term) ||
                        (post.kinks && post.kinks.some(k => k.toLowerCase().includes(term)))
                    );
                }
  
                const f = window.state.currentFilter;
                
                if (f === 'highly-rated') {
                    list = list.map(post => {
                        const ratings = post.ratings ? Object.values(post.ratings) : [];
                        const avg = ratings.length > 0 ? (ratings.reduce((a,b)=>a+b, 0) / ratings.length) : 0.0;
                        return { ...post, tempAvg: avg };
                    }).filter(p => p.tempAvg >= 4.0).sort((a,b) => b.tempAvg - a.tempAvg);
  
                } else if (f === 'popular') {
                    list = list.sort((a,b) => (b.likeCount || 0) - (a.likeCount || 0));
  
                } else if (f === 'elite-ranking') {
                    const targetTag = window.state.currentRankTag;
                    if (targetTag) {
                        list = list.filter(post => {
                            if (!post.kinks) return false;
                            return post.kinks.some(pk => pk === targetTag);
                        });
                    }
  
                    list = list.map(post => {
                        const views = post.viewCount || 0;
                        const likes = post.likeCount || 0;
                        const ratingSum = post.ratings ? Object.values(post.ratings).reduce((a,b)=>a+b, 0) : 0;
                        const score = (views * 0.05) + (likes * 0.45) + (ratingSum * 0.5);
                        return { ...post, rankScore: score };
                    }).sort((a,b) => b.rankScore - a.rankScore);
  
                } else if (f !== 'recommended' && f) {
                    list = list.filter(post => {
                        if (!post.kinks) return false;
                        return post.kinks.some(pk => {
                            const target = f.split('｜').pop().split('/').pop();
                            return pk.includes(target);
                        });
                    });
                }
            }
  
            const totalCount = list.length;
            const slicedList = list.slice(0, window.state.visiblePostsCount);
  
            listContainer.innerHTML = '';
  
            if (isFocusedMode) {
                const backBtnWrapper = document.createElement('div');
                backBtnWrapper.className = 'mb-4';
                backBtnWrapper.innerHTML = `
                    <button onclick="clearSinglePostFocus()" class="bg-slate-900 text-amber-500 font-bold text-xs py-2.5 px-4 rounded-xl border border-amber-500/20 flex items-center gap-2 transition shadow-md hover-breath click-press">
                        <i class="fa-solid fa-arrow-left text-amber-500"></i> 顯示全體祕密大廳
                    </button>
                `;
                listContainer.appendChild(backBtnWrapper);
            }
  
            if (slicedList.length === 0) {
                const emptyCard = document.createElement('div');
                emptyCard.className = 'text-center py-16 bg-slate-900/10 border border-amber-500/10 rounded-3xl p-6 flex flex-col items-center justify-center gap-3';
                emptyCard.innerHTML = `
                    <div class="w-14 h-14 bg-slate-900/60 rounded-full flex items-center justify-center text-slate-500 text-xl border border-amber-500/10">
                        <i class="fa-solid fa-folder-open text-amber-500/60"></i>
                    </div>
                    <div>
                        <h4 class="font-bold text-slate-400 text-sm">目前大廳尚無此偏好的祕密動態</h4>
                        <p class="text-xs text-slate-505 mt-1">點擊分享動態，成為第一個探索本主題的創始同好吧！</p>
                    </div>
                `;
                listContainer.appendChild(emptyCard);
                return;
            }
            
            slicedList.forEach((post, index) => {
                const card = document.createElement('div');
                card.className = 'glass-panel rounded-3xl p-3.5 sm:p-5 transition duration-300 relative space-y-3 sm:space-y-4 crystal-border hover-breath';
                
                if (!window.state.viewedPostsInSession[post.id]) {
                    window.state.viewedPostsInSession[post.id] = true;
                    incrementPostViewCount(post.id);
                }
  
                let rankingCrownHtml = '';
                if (window.state.currentFilter === 'elite-ranking' && !isFocusedMode) {
                    const rank = index + 1;
                    const colors = {
                        1: 'brushed-gold shadow-amber-950/20 text-slate-950',
                        2: 'from-slate-300 via-slate-100 to-slate-500 shadow-slate-950/15 text-slate-950',
                        3: 'from-amber-600 via-orange-650 to-amber-800 shadow-orange-950/15 text-white'
                    };
                    const badgeText = rank === 1 ? '🥇 1st' : rank === 2 ? '🥈 2nd' : rank === 3 ? '🥉 3rd' : `🏆 ${rank}th`;
                    const currentBg = colors[rank] || 'from-slate-900 via-slate-950 to-black text-slate-500 border border-slate-800';
                    
                    rankingCrownHtml = `
                        
                        <div class="absolute -top-2.5 -left-2.5 bg-gradient-to-r ${currentBg} text-[10px] font-extrabold px-3 py-1.5 rounded-full shadow-lg z-10 flex items-center gap-1.5 tracking-wider font-luxury crystal-border">
                            <span>${badgeText}</span>
                            <span class="text-[8px] font-light opacity-75 font-sans">Score: ${post.rankScore ? post.rankScore.toFixed(1) : 0}</span>
                        </div>
                    `;
                }
  
                const authorBadgeHtml = getUserBadgeHTMLForPost(post);
                const ratings = post.ratings ? Object.values(post.ratings) : [];
                const averageRating = ratings.length > 0 ? (ratings.reduce((a,b)=>a+b, 0) / ratings.length) : 0.0;
                const userLiked = post.likes && post.likes[window.state.applicationId];
                const commentCount = post.comments ? Object.keys(post.comments).length : 0;
  
                let imageHtml = '';
                if (post.image) {
                    const isNsfw = post.isSensitive;
                    const isUnlocked = window.state.unlockedNsfwPosts[post.id] || false;
                    
                    if (isNsfw && !isUnlocked) {
                        imageHtml = `
                            <div class="relative w-full rounded-2xl overflow-hidden border border-[#1a140f] bg-slate-950 h-52 sm:h-56 group cursor-pointer click-press" onclick="unlockNsfw('${post.id}')">
                                <img src="${post.image}" class="w-full h-full object-cover filter blur-3xl opacity-35 pointer-events-none" draggable="false" oncontextmenu="return false;">
                                ${renderWatermarkOverlay(post.userId || window.state.applicationId, 0.04, true)}
                                <div class="absolute inset-0 bg-[#0c0a08]/90 backdrop-blur-md flex flex-col items-center justify-center text-center p-4 z-20">
                                    <div class="w-10 h-10 sm:w-11 sm:h-11 bg-rose-500/15 rounded-full flex items-center justify-center text-rose-400 text-base sm:text-lg mb-2 shadow-lg shadow-rose-950/20 border border-rose-500/20">
                                        <i class="fa-solid fa-eye-slash"></i>
                                    </div>
                                    <h5 class="text-xs sm:text-sm font-bold text-rose-455">成人尺度照片 (Nsfw)</h5>
                                    <p class="text-[10px] sm:text-xs text-slate-400 mt-1 sm:mt-1.5">此照片被發布者標記為敏感照片，點擊解鎖 🔒</p>
                                </div>
                            </div>
                        `;
                    } else {
                        imageHtml = `
                            <div class="relative w-full rounded-2xl overflow-hidden border border-[#1a140f] bg-slate-950 max-h-[420px] group select-none flex justify-center items-center">
                                <img src="${post.image}" class="w-full h-auto object-contain max-h-[400px] pointer-events-none rounded-xl" draggable="false" oncontextmenu="return false;">
                                ${renderWatermarkOverlay(post.userId || window.state.applicationId, 0.055)}
                            </div>
                        `;
                    }
                }
  
                let actionBtnHtml = '';
                if (post.userId === window.state.applicationId) {
                    actionBtnHtml = `
                        <button onclick="deleteMyPost('${post.id}')" class="text-slate-550 hover:text-red-400 transition text-xs sm:text-sm click-press" title="刪除此動態">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                    `;
                } else {
                    actionBtnHtml = `
                        <button onclick="openReportModal('${post.id}')" class="text-slate-550 hover:text-rose-455 transition text-xs sm:text-sm click-press" title="檢舉此內容">
                            <i class="fa-regular fa-flag"></i>
                        </button>
                    `;
                }
  
                const peachEggplantHtml = userLiked ? `
                    <button onclick="toggleLikePost('${post.id}')" class="flex items-center gap-1 sm:gap-1.5 text-purple-400 font-bold transition duration-300 click-press">
                        <svg class="w-4 h-4 sm:w-5 sm:h-5 text-purple-400 fill-current animate-pulse" viewBox="0 0 64 64" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M16 48C12 40 18 20 38 12C54 6 58 18 54 30C50 42 32 54 16 48Z" />
                            <path d="M34 16C32 10 26 12 28 16C30 20 36 16 36 16Z" fill="#d4af37" stroke="#d4af37" />
                        </svg>
                        <span>${post.likeCount || 0} 個讚</span>
                    </button>
                ` : `
                    <button onclick="toggleLikePost('${post.id}')" class="flex items-center gap-1 sm:gap-1.5 text-slate-400 hover:text-amber-500 transition duration-300 click-press">
                        <svg class="w-4 h-4 sm:w-5 sm:h-5 text-rose-300 fill-none transition-all" viewBox="0 0 64 64" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M32 54C18 54 10 44 10 30C10 16 18 8 32 8C46 8 54 16 54 30C54 44 46 54 32 54Z" />
                            <path d="M32 8C32 18 38 30 32 54" />
                            <path d="M32 8C28 2 20 4 22 10C24 16 32 8 32 8Z" fill="#aa771c" stroke="#aa771c" />
                        </svg>
                        <span>${post.likeCount || 0} 個讚</span>
                    </button>
                `;
  
                card.innerHTML = `
                    ${rankingCrownHtml}
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2 sm:gap-3 cursor-pointer hover-breath" onclick="viewUserProfile('${post.userId}')">
                            <img src="${post.authorAvatar || 'Gemini_Generated_Image_e2fxvje2fxvje2fx.jpg?v=2'}" class="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-[#1a140f]">
                            <div>
                                <div class="flex flex-wrap items-center gap-1 sm:gap-2">
                                    <h4 class="font-bold text-xs sm:text-sm text-slate-200">${post.authorName}</h4>
                                    <div class="flex items-center gap-0.5">${authorBadgeHtml}</div>
                                </div>
                                <span class="text-[9px] sm:text-[10px] text-slate-550 block font-mono">@${post.userId}</span>
                            </div>
                        </div>
                        ${actionBtnHtml}
                    </div>
  
                    <p class="text-xs sm:text-sm text-slate-300 leading-relaxed font-light whitespace-pre-line">${post.text}</p>
  
                    ${imageHtml}
  
                    ${post.kinks && post.kinks.length > 0 ? `
                        <div class="flex flex-wrap gap-1 sm:gap-1.5">
                            ${post.kinks.map(k => `
                                <span class="text-[10px] sm:text-[11px] font-bold text-amber-500/90 bg-amber-500/5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full border border-amber-500/15"># ${k}</span>
                            `).join('')}
                        </div>
                    ` : ''}
  
                    <div class="pt-3 border-t border-amber-500/10 flex flex-wrap gap-2 items-center justify-between text-slate-400 text-xs sm:text-sm">
                        
                        ${peachEggplantHtml}
  
                        <button onclick="toggleCommentsSection('${post.id}')" class="flex items-center gap-1 sm:gap-1.5 hover:text-amber-500 transition click-press">
                            <i class="fa-regular fa-comments"></i>
                            <span>${commentCount} 則留言</span>
                        </button>
  
                        <div class="flex items-center gap-1.5">
                            <div class="flex items-center gap-0.5 text-slate-600">
                                ${[1, 2, 3, 4, 5].map(star => {
                                    const ratingVal = post.ratings && post.ratings[window.state.applicationId];
                                    const activeColor = ratingVal && ratingVal >= star ? 'text-amber-500' : 'text-slate-700 hover:text-amber-400';
                                    return `<i onclick="ratePost('${post.id}', ${star})" class="fa-solid fa-star cursor-pointer transition text-[10px] sm:text-xs click-press ${activeColor}"></i>`;
                                }).join('')}
                            </div>
                            <span class="text-[10px] sm:text-[11px] text-amber-500 font-bold bg-slate-950/80 px-1.5 sm:px-2.5 py-0.5 rounded-md border border-amber-500/10">${averageRating.toFixed(1)}</span>
                        </div>
                    </div>
  
                    <div id="comments-box-${post.id}" class="${window.state.openComments[post.id] ? '' : 'hidden'} mt-4 pt-4 border-t border-amber-500/10 space-y-3">
                        <div class="flex gap-2">
                            <input type="text" id="comment-input-${post.id}" class="w-full bg-slate-950 border border-amber-500/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 transition" placeholder="與兄弟低聲交流...">
                            <button onclick="submitComment('${post.id}')" class="brushed-gold font-bold text-xs px-4 rounded-xl transition shrink-0 shadow-md click-press">送出</button>
                        </div>
                        <div class="space-y-2.5 max-h-48 overflow-y-auto pr-1" id="comments-list-${post.id}">
                            ${post.comments ? Object.values(post.comments).map(c => {
                                let commentActionHtml = '';
                                if (c.userId === window.state.applicationId || post.userId === window.state.applicationId) {
                                    commentActionHtml = `
                                        <button onclick="deleteComment('${post.id}', '${c.id}')" class="text-slate-600 hover:text-red-400 transition text-[10px] click-press" title="刪除此留言">
                                            <i class="fa-regular fa-trash-can"></i>
                                        </button>
                                    `;
                                } else {
                                    commentActionHtml = `
                                        <button onclick="openCommentReportModal('${post.id}', '${c.id}')" class="text-slate-600 hover:text-rose-455 transition text-[10px] click-press" title="檢舉此留言">
                                            <i class="fa-regular fa-flag"></i>
                                        </button>
                                    `;
                                }
                                return `
                                    <div class="bg-[#050403]/90 p-2.5 rounded-xl border border-amber-500/5 text-xs">
                                        <div class="flex items-center justify-between mb-1.5">
                                            <span class="font-bold text-amber-500/70">@${escapeHtml(c.userId)}</span>
                                            <div class="flex items-center gap-2">
                                                <span class="text-[9px] text-slate-555 font-mono">${new Date(c.time).toLocaleDateString()}</span>
                                                ${commentActionHtml}
                                            </div>
                                        </div>
                                        <p class="text-slate-300 font-light leading-relaxed">${escapeHtml(c.text)}</p>
                                    </div>
                                `;
                            }).reverse().join('') : `<div class="text-[10px] text-slate-600 text-center py-2">目前尚無任何交流...</div>`}
                        </div>
                    </div>
                `;
                listContainer.appendChild(card);
            });
  
            if (totalCount > window.state.visiblePostsCount && !isFocusedMode) {
                const loadMoreEl = document.createElement('div');
                loadMoreEl.className = 'text-center py-4 text-xs text-slate-500 animate-pulse';
                loadMoreEl.textContent = '往下滾動載入更多內容... 🔑';
                listContainer.appendChild(loadMoreEl);
            } else if (!isFocusedMode) {
                const finishedEl = document.createElement('div');
                finishedEl.className = 'text-center py-6 text-xs text-slate-600 border-t border-amber-500/10 mt-4';
                finishedEl.innerHTML = '已看完俱樂部最新動態 🔒';
                listContainer.appendChild(finishedEl);
            }
        }
  
        function renderProfileTab(container, profileUserId) {
            const isMe = profileUserId === window.state.applicationId;
            const profileUser = isMe ? window.state.userData : window.state.activeUsers.find(u => u.id === profileUserId);
  
            if (!profileUser) {
                container.innerHTML = `
                    <div class="text-center py-12 text-slate-500">
                        <i class="fa-solid fa-circle-exclamation text-2xl mb-2 text-rose-500"></i>
                        <p class="text-sm">無法讀取該會員的個人檔案。</p>
                        <button onclick="backToFeed()" class="text-sm text-amber-500 mt-2 hover:underline click-press">返回首頁</button>
                    </div>
                `;
                return;
            }
  
            if (!isMe) {
                addVisitorRecord(profileUserId);
            }
  
            const kinksStr = profileUser.kinks && profileUser.kinks.length > 0 ? profileUser.kinks.map(k=>`# ${k}`).join(', ') : '無選定標籤';
  
            let specApplyBtnHtml = '';
            const specLength = parseFloat(profileUser.length || 0);
            const specGirth = parseFloat(profileUser.girth || 0);
  
            if (specLength >= 16 && specGirth >= 5) {
                if (profileUser.isSpecElite) {
                    specApplyBtnHtml = '';
                } else if (profileUser.specEliteStatus === 'pending') {
                    specApplyBtnHtml = `
                        <button class="w-full bg-slate-900/50 border border-amber-500/20 text-amber-500/70 font-semibold text-xs py-3.5 px-4 rounded-xl mt-3 flex items-center justify-center gap-1.5 select-none animate-pulse">
                            <i class="fa-solid fa-spinner animate-spin"></i> 黃金 Spec 認證審查中...
                        </button>
                    `;
                } else if (isMe) {
                    specApplyBtnHtml = `
                        
                        <button onclick="showSpecApplyModal()" class="w-full brushed-gold font-bold text-xs py-3.5 px-4 rounded-xl shadow-lg shadow-amber-950/15 transition mt-3 flex items-center justify-center gap-1.5 crystal-border hover-breath click-press">
                            <i class="fa-solid fa-lock"></i> 申請黃金 Spec 認證勳章
                        </button>
                    `;
                }
            }
  
            let visitorsHtml = '';
            if (isMe) {
                const myVisitors = window.state.visitors || [];
                visitorsHtml = `
                    <div class="bg-slate-900/60 border border-amber-500/15 p-5 rounded-3xl space-y-4 animate-fade-in shadow-xl shadow-black/40">
                        
                        <span class="text-xs font-bold text-slate-300 tracking-widest block"><i class="fa-regular fa-eye text-amber-500 mr-1"></i> 最近訪客足跡：</span>
                        <div class="flex items-center gap-4 overflow-x-auto scrollbar-hide py-1">
                            ${myVisitors.length === 0 ? `
                                <div class="text-xs text-slate-500 py-1 font-light">目前尚無訪問足跡...</div>
                            ` : myVisitors.map(v => `
                                <div onclick="viewUserProfile('${v.from}')" class="flex flex-col items-center shrink-0 cursor-pointer group hover-breath click-press">
                                    <img src="${v.avatar || 'Gemini_Generated_Image_e2fxvje2fxvje2fx.jpg?v=2'}" class="w-10 h-10 rounded-full object-cover border border-amber-500/10 group-hover:border-amber-500 transition duration-300 shadow">
                                    <span class="text-[10px] text-slate-400 mt-2 truncate max-w-[55px] font-mono group-hover:text-amber-500 transition">@${v.from}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
  
            container.innerHTML = `
                
                <div class="glass-panel border border-amber-500/15 rounded-3xl p-6 relative flex flex-col items-center text-center space-y-5 crystal-border">
                    
                    ${!isMe ? `
                        <button onclick="backToFeed()" class="absolute top-5 left-5 text-slate-400 hover:text-white transition text-xs font-semibold flex items-center gap-1 hover-breath click-press">
                            <i class="fa-solid fa-arrow-left text-amber-500"></i> 返回首頁
                        </button>
                    ` : ''}
  
                    <div class="relative w-24 h-24 rounded-full p-1 bg-slate-950 border border-amber-500/20 shadow-2xl select-none hover-breath cursor-pointer">
                        <img src="${profileUser.avatar || 'Gemini_Generated_Image_e2fxvje2fxvje2fx.jpg?v=2'}" class="w-full h-full rounded-full object-cover">
                    </div>
  
                    <div class="space-y-1.5 pt-1 flex flex-col items-center">
                        <h2 class="text-xl font-bold text-white tracking-wide flex items-center gap-1.5 justify-center">
                            <span>${profileUser.nickname}</span>
                        </h2>
                        <span class="text-sm text-slate-550 block font-mono">@${profileUserId}</span>
                        
                        <div class="flex items-center justify-center gap-2 mt-4.5 flex-wrap">
                            ${getBadgeHTML(profileUser, true)}
                        </div>
                    </div>
  
                    <div class="grid grid-cols-2 gap-3 w-full bg-slate-950/60 p-4 border border-amber-500/10 rounded-2xl text-sm text-left text-slate-300 shadow-inner">
                        <div><span class="text-slate-500 font-semibold mr-1">身高體重:</span> <span class="text-amber-500 font-bold">${profileUser.height} cm / ${profileUser.weight} kg</span></div>
                        <div><span class="text-slate-500 font-semibold mr-1">私密數字:</span> <span class="text-amber-500 font-bold">長 ${profileUser.length} cm / 粗 ${profileUser.girth} cm</span></div>
                        <div class="col-span-2 pt-2 border-t border-amber-500/10 mt-2">
                            <span class="text-slate-500 font-semibold">偏好主題:</span>
                            <p class="text-slate-200 mt-1.5 text-xs leading-relaxed font-semibold">${kinksStr}</p>
                        </div>
                    </div>
  
                    ${isMe && profileUser.avatarStatus === 'pending' ? `
                        <div class="w-full p-3 bg-purple-500/5 border border-purple-500/10 rounded-xl text-xs text-purple-400 font-bold flex items-center justify-center gap-1.5 select-none animate-pulse">
                            <i class="fa-solid fa-camera"></i> 新大頭相片正在背景人工審核中... (暫以原頭像顯示)
                        </div>
                    ` : ''}
  
                    ${specApplyBtnHtml}
  
                    ${isMe ? `
                        <button onclick="showEditProfileModal()" class="w-full bg-slate-900 text-slate-300 font-semibold text-xs py-3 px-4 rounded-xl border border-slate-800 transition duration-300 hover-breath click-press">
                            修改個人資料
                        </button>
                        <div class="w-full grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button onclick="exportMyData()" class="w-full bg-slate-950/60 text-slate-400 font-semibold text-xs py-3 px-4 rounded-xl border border-amber-500/10 transition duration-300 hover-breath click-press">
                                匯出個人資料
                            </button>
                            ${profileUser.accountDeletionStatus === 'pending' ? `
                                <button class="w-full bg-rose-500/5 text-rose-300/70 font-bold text-xs py-3 px-4 rounded-xl border border-rose-500/15 cursor-not-allowed">刪除申請審核中</button>
                            ` : `
                                <button onclick="showAccountDeletionRequestModal()" class="w-full bg-rose-500/5 text-rose-300 font-bold text-xs py-3 px-4 rounded-xl border border-rose-500/20 transition duration-300 hover-breath click-press">
                                    申請刪除帳號
                                </button>
                            `}
                        </div>
                    ` : ''}
                </div>
  
                ${visitorsHtml}
            `;
  
            if (isMe) {
                listenToMyVisitors();
            }
        }
  
        async function addVisitorRecord(targetUserId) {
            if (!db || targetUserId === window.state.applicationId) return;
            try {
                const vId = `${window.state.applicationId}_to_${targetUserId}`;
                const visitorRef = doc(db, 'secretg_apps', appId, 'visitors', vId);
                await setDoc(visitorRef, {
                    from: window.state.applicationId,
                    to: targetUserId,
                    avatar: window.state.userData.avatar || '',
                    timestamp: serverTimestamp()
                });
            } catch (err) {
                console.error("訪客紀錄同步異常:", err);
            }
        }
  
        function listenToMyVisitors() {
            if (!db || window.state.unsubscribeVisitorsListener) return;
            const q = query(
                collection(db, 'secretg_apps', appId, 'visitors'), 
                where('to', '==', window.state.applicationId)
            );
            window.state.unsubscribeVisitorsListener = onSnapshot(q, (snapshot) => {
                const list = [];
                snapshot.forEach((docSnap) => {
                    list.push(docSnap.data());
                });
                window.state.visitors = list.slice(0, 10);
                
                const scrollContainer = document.getElementById('dashboard-tab-content');
                if (window.state.currentTab === 'profile') {
                    renderProfileTab(scrollContainer, window.state.applicationId);
                }
            }, (err) => console.error("Visitors listener error:", err));
        }
  
        window.viewUserProfile = function(targetUserId) {
            if (targetUserId === window.state.applicationId) {
                window.state.currentTab = 'profile';
            } else {
                window.state.currentTab = 'other-profile';
                window.state.viewTargetUserId = targetUserId;
            }
            renderDashboard(appContainer);
        };
  
        window.backToFeed = function() {
            window.state.currentTab = 'feed';
            window.state.currentFilter = 'recommended';
            window.state.singlePostFocusId = null; 
            renderDashboard(appContainer);
        };
  
        window.mobileSelectTag = function(filterName) {
            const menu = document.getElementById('mobile-feature-menu');
            if (menu) menu.classList.add('hidden');
            window.state.currentTab = 'feed';
            window.state.currentFilter = filterName;
            window.state.currentRankTag = null;
            window.state.singlePostFocusId = null;
            renderDashboard(appContainer);
        };

        window.mobileOpenUserProfile = function(userId) {
            const menu = document.getElementById('mobile-feature-menu');
            if (menu) menu.classList.add('hidden');
            window.viewUserProfile(userId);
        };

        window.toggleLikePost = async function(postId) {
            if (!db) { showToast('伺服器尚未完成連線，暫時無法按讚。', 'error'); return; }
            const post = window.state.posts.find(p => p.id === postId);
            if (!post) return;
  
            const myId = window.state.applicationId;
            const likes = post.likes || {};
            const liked = likes[myId];
  
            if (liked) {
                delete likes[myId];
            } else {
                likes[myId] = true;
            }
  
            const likeCount = Object.keys(likes).length;
  
            try {
                const postRef = doc(db, 'secretg_apps', appId, 'posts', postId);
                await updateDoc(postRef, {
                    likes: likes,
                    likeCount: likeCount
                });
            } catch (err) {
                console.error("按讚同步失敗:", err);
            }
        };
  
        window.setGlobalFilterLabel = function(label) {
            window.state.currentFilter = label;
            updateSearchAndFeedUI();
        };
  
        window.ratePost = async function(postId, ratingValue) {
            if (!db) { showToast('伺服器尚未完成連線，暫時無法評分。', 'error'); return; }
            const post = window.state.posts.find(p => p.id === postId);
            if (!post) return;
  
            const myId = window.state.applicationId;
            const ratings = post.ratings || {};
            ratings[myId] = ratingValue;
  
            try {
                const postRef = doc(db, 'secretg_apps', appId, 'posts', postId);
                await updateDoc(postRef, { ratings: ratings });
                showToast(`你已評分此動態 ${ratingValue} 星！`, 'success');
            } catch (err) {
                console.error("評分同步出錯:", err);
            }
        };
  
        window.toggleCommentsSection = function(postId) {
            window.state.openComments[postId] = !window.state.openComments[postId];
            const box = document.getElementById(`comments-box-${postId}`);
            if (box) {
                if (window.state.openComments[postId]) {
                    box.classList.remove('hidden');
                    if (!window.state.viewedPostsInSession[postId]) {
                        window.state.viewedPostsInSession[postId] = true;
                        incrementPostViewCount(postId);
                    }
                }
                else box.classList.add('hidden');
            }
        };
  
        window.submitComment = async function(postId) {
            const input = document.getElementById(`comment-input-${postId}`);
            if (!input) return;
  
            const text = input.value.trim();
            if (!text) return;
  
            if (!db) { showToast('伺服器尚未完成連線，暫時無法留言。', 'error'); return; }
            showLoading();
  
            try {
                const post = window.state.posts.find(p => p.id === postId);
                const comments = post.comments || {};
                const cId = `c_${Date.now()}`;
                
                comments[cId] = {
                    id: cId,
                    userId: window.state.applicationId,
                    text: text,
                    time: Date.now()
                };
  
                const postRef = doc(db, 'secretg_apps', appId, 'posts', postId);
                await updateDoc(postRef, { comments: comments });
                
                input.value = '';
                showToast('回覆發布完成', 'success');
            } catch (err) {
                console.error("發布留言出錯:", err);
                showToast('回覆發布失敗', 'error');
            } finally {
                hideLoading();
            }
        };

        window.deleteComment = function(postId, commentId) {
            const modal = document.getElementById('custom-confirm-modal');
            if (!modal) return;
            
            const modalTitle = modal.querySelector('h3');
            const modalDesc = modal.querySelector('p');
            const originalTitle = modalTitle.textContent;
            const originalDesc = modalDesc.textContent;
            
            modalTitle.textContent = "確定刪除此留言？";
            modalDesc.textContent = "此留言將從本貼文中永久徹底移除，此操作無法撤回！";
            
            modal.classList.remove('hidden');

            document.getElementById('confirm-modal-cancel').onclick = () => {
                modal.classList.add('hidden');
                modalTitle.textContent = originalTitle;
                modalDesc.textContent = originalDesc;
            };

            document.getElementById('confirm-modal-ok').onclick = async () => {
                modal.classList.add('hidden');
                modalTitle.textContent = originalTitle;
                modalDesc.textContent = originalDesc;
                
                if (!db) { showToast('伺服器尚未完成連線，暫時無法刪除留言。', 'error'); return; }
                showLoading();
                try {
                    const post = window.state.posts.find(p => p.id === postId);
                    if (post && post.comments) {
                        const updatedComments = { ...post.comments };
                        delete updatedComments[commentId];
                        
                        const postRef = doc(db, 'secretg_apps', appId, 'posts', postId);
                        await updateDoc(postRef, { comments: updatedComments });
                        showToast('留言已刪除 🔒', 'success');
                    }
                } catch (err) {
                    console.error("刪除留言失敗:", err);
                    showToast('刪除留言失敗', 'error');
                } finally {
                    hideLoading();
                }
            };
        };

        window.openCommentReportModal = function(postId, commentId) {
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 z-[105] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md';
            modal.innerHTML = `
                <div class="bg-[#0c0a08] border border-amber-500/20 rounded-3xl p-6 w-[92vw] max-w-sm shadow-[0_0_50px_rgba(0,0,0,0.95)] relative crystal-border">
                    <button id="close-comment-report" class="absolute top-4 right-4 text-slate-555 hover:text-white text-2xl click-press">&times;</button>
                    <h3 class="text-base font-bold text-white mb-2 flex items-center gap-2 font-luxury">
                        <i class="fa-solid fa-triangle-exclamation text-amber-500"></i> 檢舉此條留言
                    </h3>
                    <p class="text-sm text-slate-400 mb-4 leading-relaxed">請選擇檢舉原因：</p>
                    <div class="space-y-2 mb-6">
                        <label class="flex items-center gap-2.5 cursor-pointer p-2.5 bg-[#0a0806] border border-amber-500/10 rounded-xl transition hover-breath">
                            <input type="radio" name="comment-report-reason" value="垃圾訊息或惡意洗版" class="accent-amber-500" checked>
                            <span class="text-xs text-slate-300 font-semibold">垃圾訊息或惡意洗版</span>
                        </label>
                        <label class="flex items-center gap-2.5 cursor-pointer p-2.5 bg-[#0a0806] border border-amber-500/10 rounded-xl transition hover-breath">
                            <input type="radio" name="comment-report-reason" value="騷擾、人身攻擊或謾罵" class="accent-amber-500">
                            <span class="text-xs text-slate-300 font-semibold">騷擾、人身攻擊或謾罵</span>
                        </label>
                        <label class="flex items-center gap-2.5 cursor-pointer p-2.5 bg-[#0a0806] border border-amber-500/10 rounded-xl transition hover-breath">
                            <input type="radio" name="comment-report-reason" value="不當內容或色情言語" class="accent-amber-500">
                            <span class="text-xs text-slate-300 font-semibold">不當內容或色情言語</span>
                        </label>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <button id="btn-comment-report-cancel" class="bg-slate-900 text-slate-300 font-bold text-xs py-2.5 rounded-xl transition click-press">取消</button>
                        <button id="btn-comment-report-submit" class="bg-amber-600 text-slate-950 font-bold text-xs py-2.5 rounded-xl transition shadow-md click-press">提交檢舉</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('close-comment-report').onclick = () => modal.remove();
            document.getElementById('btn-comment-report-cancel').onclick = () => modal.remove();
            document.getElementById('btn-comment-report-submit').onclick = async () => {
                const selectedReason = document.querySelector('input[name="comment-report-reason"]:checked').value;
                await submitCommentReport(postId, commentId, selectedReason);
                modal.remove();
            };
        };

        window.submitCommentReport = async function(postId, commentId, reason) {
            if (!db) { showToast('伺服器尚未完成連線，暫時無法提交檢舉。', 'error'); return; }
            showLoading();
            try {
                const postRef = doc(db, 'secretg_apps', appId, 'posts', postId);
                const postSnap = await getDoc(postRef);
                if (postSnap.exists()) {
                    const postData = postSnap.data();
                    const comments = postData.comments || {};
                    if (comments[commentId]) {
                        const comment = comments[commentId];
                        const currentReports = comment.reports || [];
                        const reporterId = window.state.applicationId;

                        if (currentReports.some(r => r.reporterId === reporterId)) {
                            showToast('您已經檢舉過此條留言了！', 'info');
                            hideLoading();
                            return;
                        }

                        const updatedReports = [...currentReports, {
                            reason: reason,
                            reporterId: reporterId,
                            timestamp: Date.now()
                        }];

                        comment.reports = updatedReports;
                        comment.reportCount = updatedReports.length;
                        comments[commentId] = comment;

                        await updateDoc(postRef, { comments: comments });
                        await createUserNotification({
                            type: 'report',
                            category: 'report',
                            tone: 'report',
                            title: '留言檢舉已受理',
                            message: `您提交的留言檢舉已進入安全審查佇列。檢舉原因：${reason}`,
                            status: '審查中',
                            sourceType: 'comment',
                            sourceId: postId
                        });
                        showToast('留言檢舉提交成功！', 'success');
                    }
                }
            } catch (err) {
                console.error("提交留言檢舉失敗:", err);
                showToast('提交檢舉失敗', 'error');
            } finally {
                hideLoading();
            }
        };
  
        async function incrementPostViewCount(postId) {
            if (!db) return;
            try {
                const postRef = doc(db, 'secretg_apps', appId, 'posts', postId);
                const postSnap = await getDoc(postRef);
                if (postSnap.exists()) {
                    const data = postSnap.data();
                    const currentViews = data.viewCount || 0;
                    await updateDoc(postRef, { viewCount: currentViews + 1 });
                }
            } catch (err) {
                console.error("累計觀看失敗:", err);
            }
        }
  
        window.unlockNsfw = function(postId) {
            window.state.unlockedNsfwPosts[postId] = true;
            updateSearchAndFeedUI();
            showToast('已完成端對端解密，解鎖私密圖片觀看 🔞', 'success');
        };
  
        window.openReportModal = function(postId) {
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 z-[105] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md';
            modal.innerHTML = `
                <div class="bg-[#0c0a08] border border-amber-500/20 rounded-3xl p-6 w-[92vw] max-w-sm shadow-[0_0_50px_rgba(0,0,0,0.95)] relative crystal-border">
                    <button id="close-report-modal" class="absolute top-4 right-4 text-slate-555 hover:text-white text-2xl click-press">&times;</button>
                    <h3 class="text-base font-bold text-white mb-2 flex items-center gap-2 font-luxury">
                        <i class="fa-solid fa-triangle-exclamation text-amber-500"></i> 檢舉此篇動態
                    </h3>
                    <p class="text-sm text-slate-400 mb-4 leading-relaxed">請選擇檢舉原因，我們將在後台派專員審核此內容：</p>
                    <div class="space-y-2 mb-6">
                        <label class="flex items-center gap-2.5 cursor-pointer p-2.5 bg-[#0a0806] border border-amber-500/10 rounded-xl transition hover-breath">
                            <input type="radio" name="report-reason" value="垃圾訊息或惡意洗版" class="accent-amber-500" checked>
                            <span class="text-xs text-slate-300 font-semibold">垃圾訊息或惡意洗版</span>
                        </label>
                        <label class="flex items-center gap-2.5 cursor-pointer p-2.5 bg-[#0a0806] border border-amber-500/10 rounded-xl transition hover-breath">
                            <input type="radio" name="report-reason" value="未標記敏感內容 (Nsfw/露骨)" class="accent-amber-500">
                            <span class="text-xs text-slate-300 font-semibold">未標記敏感內容 (Nsfw/露骨)</span>
                        </label>
                        <label class="flex items-center gap-2.5 cursor-pointer p-2.5 bg-[#0a0806] border border-amber-500/10 rounded-xl transition hover-breath">
                            <input type="radio" name="report-reason" value="騷擾、人身攻擊或謾罵" class="accent-amber-500">
                            <span class="text-xs text-slate-300 font-semibold">騷擾、人身攻擊或謾罵</span>
                        </label>
                        <label class="flex items-center gap-2.5 cursor-pointer p-2.5 bg-[#0a0806] border border-amber-500/10 rounded-xl transition hover-breath">
                            <input type="radio" name="report-reason" value="盜用照片、冒充他人身分" class="accent-amber-500">
                            <span class="text-xs text-slate-300 font-semibold">盜用照片、冒充他人身分</span>
                        </label>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <button id="btn-report-cancel" class="bg-slate-900 text-slate-300 font-bold text-xs py-2.5 rounded-xl transition click-press">取消</button>
                        <button id="btn-report-submit" class="bg-amber-600 text-slate-950 font-bold text-xs py-2.5 rounded-xl transition shadow-md click-press">提交檢舉</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
  
            document.getElementById('close-report-modal').onclick = () => modal.remove();
            document.getElementById('btn-report-cancel').onclick = () => modal.remove();
            document.getElementById('btn-report-submit').onclick = async () => {
                const selectedReason = document.querySelector('input[name="report-reason"]:checked').value;
                await submitPostReport(postId, selectedReason);
                modal.remove();
            };
        };
  
        window.submitPostReport = async function(postId, reason) {
            if (!db) { showToast('伺服器尚未完成連線，暫時無法提交檢舉。', 'error'); return; }
            showLoading();
            try {
                const postRef = doc(db, 'secretg_apps', appId, 'posts', postId);
                const postSnap = await getDoc(postRef);
                if (postSnap.exists()) {
                    const postData = postSnap.data();
                    const currentReports = postData.reports || [];
                    const reporterId = window.state.applicationId;
  
                    if (currentReports.some(r => r.reporterId === reporterId)) {
                        showToast('您已經檢舉過此篇動態了！', 'info');
                        hideLoading();
                        return;
                    }
  
                    const updatedReports = [...currentReports, {
                        reason: reason,
                        reporterId: reporterId,
                        timestamp: Date.now()
                    }];
  
                    await updateDoc(postRef, {
                        reports: updatedReports,
                        reportCount: updatedReports.length
                    });

                    await createUserNotification({
                        type: 'report',
                        category: 'report',
                        tone: 'report',
                        title: '貼文檢舉已受理',
                        message: `您提交的貼文檢舉已進入安全審查佇列。檢舉原因：${reason}`,
                        status: '審查中',
                        sourceType: 'post',
                        sourceId: postId
                    });
  
                    showToast('檢舉已提交成功，管理團隊會儘速審查此動態！', 'success');
                }
            } catch (err) {
                console.error("提交檢舉異常:", err);
                showToast('檢舉提交失敗，請重試', 'error');
            } finally {
                hideLoading();
            }
        };
  
        function showSharePostModal() {
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md';
            modal.innerHTML = `
                
                <div class="glass-panel sr-stable-modal-panel border border-amber-500/20 rounded-3xl p-6 w-[92vw] max-w-md shadow-2xl relative overflow-y-auto max-h-[90vh] crystal-border">
                    <button id="close-share" class="absolute top-4 right-4 text-slate-500 hover:text-white text-2xl transition hover-breath click-press">&times;</button>
                    
                    <h3 class="text-lg font-bold text-white mb-1.5 flex items-center gap-2 font-luxury">
                        <i class="fa-solid fa-feather-pointed text-amber-500"></i> Publish Secret
                    </h3>
                    <p class="text-xs text-slate-400 mb-5 leading-relaxed">發布近期動態。發布相片時將自動生成淡色、較隱性的「SecretRomm @使用者帳號」滿版 45 度浮水印；若原始圖片本身已有其他浮水印，系統不會自動移除。</p>
  
                    <div class="space-y-4">
                        <div>
                            
                            <label class="block text-xs font-bold text-slate-555 mb-1.5 tracking-wider">動態內容描述 (選填)</label>
                            <textarea id="share-text" rows="3" class="w-full bg-slate-900 border border-amber-500/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 resize-none transition" placeholder="分享當下的健美重訓成果 or 私密心情..."></textarea>
                        </div>
  
                        <div>
                            
                            <label class="block text-xs font-bold text-slate-555 mb-1.5 tracking-wider">加載動態照片 (選填)</label>
                            <div class="border border-amber-500/10 rounded-2xl p-4 flex flex-col items-center justify-center bg-slate-900/10 text-center">
                                <div id="share-img-trigger" class="relative w-full h-40 rounded-xl border border-dashed border-amber-500/30 flex flex-col items-center justify-center cursor-pointer overflow-hidden bg-slate-950 transition hover-breath click-press">
                                    <img id="share-preview" class="absolute inset-0 w-full h-full object-contain hidden">
                                    <div id="share-placeholder" class="text-slate-550 flex flex-col items-center gap-1.5 transition">
                                        <i class="fa-regular fa-image text-2xl text-amber-500/70"></i>
                                        <span class="text-xs font-bold">點擊選取相片</span>
                                    </div>
                                </div>
                                <input type="file" id="share-file" accept="image/jpeg,image/png,image/webp" class="hidden">
                                <span class="text-[10px] text-slate-555 mt-2 block">相片加載後將自動生成淡色、較隱性的「SecretRomm @使用者帳號」滿版 45 度浮水印；若原始圖片本身已有其他浮水印，系統不會自動移除。</span>
                            </div>
                        </div>
  
                        <div class="p-3 bg-rose-500/5 border border-rose-500/20 rounded-2xl">
                            <label class="flex items-center gap-3 cursor-pointer hover-breath">
                                <input type="checkbox" id="share-nsfw-cb" class="rounded border-amber-500/30 bg-slate-950 text-rose-650 focus:ring-rose-550 w-4 h-4">
                                <div>
                                    
                                    <span class="text-xs text-rose-455 font-bold block">標記為私密尺度照片 (Nsfw) 🔞</span>
                                    <p class="text-[10px] text-slate-555 mt-0.5 leading-relaxed">勾選後，大廳相片將預設以高精度毛玻璃覆蓋，點擊才會手動解密觀看。</p>
                                </div>
                            </label>
                        </div>
  
                        <div>
                            
                            <label class="block text-xs font-bold text-slate-555 mb-1.5 tracking-wider">關聯主題標籤 (至少勾選一項)</label>
                            <div class="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto bg-slate-950/60 p-3 border border-amber-500/10 rounded-2xl" id="share-kinks-container">
                                ${window.state.kinksOptions.map(k => `
                                    <label class="flex items-center gap-2.5 cursor-pointer p-1 rounded hover:bg-slate-900/60 transition hover-breath">
                                        <input type="checkbox" name="share-kink" value="${k}" class="rounded border-amber-500/30 bg-slate-950 text-amber-500 w-3.5 h-3.5">
                                        <span class="text-xs text-slate-300 font-semibold">${k}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>

                        <button id="btn-submit-post" class="w-full brushed-gold font-bold text-sm py-3.5 rounded-xl transition tracking-wider crystal-border hover-breath click-press">
                            發布動態
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
  
            document.getElementById('close-share').onclick = () => modal.remove();
  
            const fileInput = document.getElementById('share-file');
            const previewImg = document.getElementById('share-preview');
            const placeholder = document.getElementById('share-placeholder');
            let bakedBase64 = '';
  
            document.getElementById('share-img-trigger').onclick = () => fileInput.click();
  
            fileInput.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { showToast('僅支援 JPG、PNG、WebP 圖片格式。', 'error'); return; }
                    if (file.size > 8 * 1024 * 1024) { showToast('單張圖片上限為 8MB。', 'error'); return; }
                    showLoading();
                    try {
                        bakedBase64 = await processAndCompressImageFile(file, 800, 0.75, getWatermarkText());
                        previewImg.src = bakedBase64;
                        previewImg.classList.remove('hidden');
                        placeholder.classList.add('hidden');
                        showToast('浮水印注入與圖像優化完成', 'success');
                    } catch (err) {
                        console.error(err);
                        showToast('動態照片處理失敗，請換一張試試！', 'error');
                    } finally {
                        hideLoading();
                    }
                }
            };
  
            document.getElementById('btn-submit-post').onclick = async () => {
                const text = document.getElementById('share-text').value.trim();
                const isNsfw = document.getElementById('share-nsfw-cb').checked;
  
                const selectedKinks = [];
                document.querySelectorAll('input[name="share-kink"]:checked').forEach(cb => {
                    selectedKinks.push(cb.value);
                });
  
                if (!text && !bakedBase64) {
                    showToast('請填寫動態內容或選取要發布的照片！', 'error');
                    return;
                }
                if (selectedKinks.length === 0) {
                    showToast('請至少勾選一項主題標籤！', 'error');
                    return;
                }
  
                if (!db) { showToast('伺服器尚未完成連線，暫時無法發布動態。', 'error'); return; }
                showLoading();
  
                try {
                    const postRef = doc(collection(db, 'secretg_apps', appId, 'posts'));
                    await setDoc(postRef, {
                        userId: window.state.applicationId,
                        authorName: window.state.userData.nickname,
                        authorAvatar: window.state.userData.avatar || '',
                        text: text,
                        image: bakedBase64,
                        isSensitive: isNsfw,
                        kinks: selectedKinks,
                        likes: {},
                        likeCount: 0,
                        ratings: {},
                        comments: {},
                        viewCount: 0,
                        reports: [],
                        reportCount: 0,
                        createdAt: serverTimestamp()
                    });
  
                    modal.remove();
                    showToast('動態已發布', 'success');
                } catch (err) {
                    console.error("貼文失敗:", err);
                    showToast('貼文失敗: ' + err.message, 'error');
                } finally {
                    hideLoading();
                }
            };
        }
  
        window.showPasswordResetRequestModal = function(previousModal = null) {
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md';
            modal.innerHTML = `
                <div class="glass-panel border border-amber-500/20 rounded-3xl p-6 w-[92vw] max-w-sm shadow-2xl relative crystal-border">
                    <button id="close-reset-request" class="absolute top-4 right-4 text-slate-550 hover:text-white text-2xl transition hover-breath click-press">&times;</button>
                    <h3 class="text-lg font-black text-white mb-1 font-luxury"><i class="fa-solid fa-user-lock text-amber-500 mr-2"></i>忘記密碼</h3>
                    <p class="text-xs text-slate-400 leading-relaxed mb-5">請輸入會員帳號與註冊時綁定的通知信箱。系統會先比對既有會員資料，只有資料相符才會送出重新設定申請。</p>
                    <div class="space-y-3">
                        <input id="reset-request-id" class="w-full bg-slate-900 border border-amber-500/10 rounded-xl px-3.5 py-3 text-sm text-white focus:outline-none focus:border-amber-500" placeholder="會員帳號 ID">
                        <input id="reset-request-email" type="email" class="w-full bg-slate-900 border border-amber-500/10 rounded-xl px-3.5 py-3 text-sm text-white focus:outline-none focus:border-amber-500" placeholder="註冊綁定信箱">
                        <button id="btn-submit-reset-request" class="w-full brushed-gold font-bold text-sm py-3.5 rounded-xl crystal-border hover-breath click-press">送出忘記密碼申請</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            document.getElementById('close-reset-request').onclick = () => modal.remove();
            document.getElementById('btn-submit-reset-request').onclick = async () => {
                const userId = document.getElementById('reset-request-id').value.trim();
                const email = document.getElementById('reset-request-email').value.trim().toLowerCase();
                if (!userId || !email) { showToast('請填寫帳號與註冊綁定信箱。', 'error'); return; }
                if (!/^\S+@\S+\.\S+$/.test(email)) { showToast('請輸入有效的 Email 格式。', 'error'); return; }
                if (!db) { showToast('伺服器尚未完成連線，請稍後再試。', 'error'); return; }
                showLoading();
                try {
                    const userRef = doc(db, 'secretg_apps', appId, 'applications', userId);
                    const userSnap = await getDoc(userRef);
                    if (!userSnap.exists()) {
                        showToast('查無符合的會員帳號或綁定信箱，請確認後再送出。', 'error');
                        return;
                    }
                    const userData = userSnap.data() || {};
                    const boundEmail = String(userData.email || userData.boundEmail || userData.notificationEmail || '').trim().toLowerCase();
                    if (!boundEmail || boundEmail !== email) {
                        showToast('查無符合的會員帳號或綁定信箱，請確認後再送出。', 'error');
                        return;
                    }
                    const memberStatus = String(userData.status || '').toLowerCase();
                    if (memberStatus && !['approved', 'active'].includes(memberStatus)) {
                        showToast('此帳號尚未通過審核，無法使用忘記密碼功能。', 'error');
                        return;
                    }
                    const existingQuery = query(collection(db, 'secretg_apps', appId, 'password_reset_requests'), where('userId', '==', userId), where('status', '==', 'pending'));
                    const existingSnap = await getDocs(existingQuery);
                    if (!existingSnap.empty) {
                        showToast('此帳號已有待處理的忘記密碼申請，請等待處理。', 'info');
                        modal.remove();
                        if (previousModal && previousModal.remove) previousModal.remove();
                        return;
                    }
                    const reqRef = doc(collection(db, 'secretg_apps', appId, 'password_reset_requests'));
                    await setDoc(reqRef, {
                        userId,
                        email,
                        status: 'pending',
                        type: 'forgot_password',
                        verifiedMember: true,
                        userDisplayName: userData.nickname || userData.displayName || userId,
                        memberStatus: userData.status || '',
                        createdAt: serverTimestamp(),
                        createdAtMs: Date.now(),
                        userAgent: navigator.userAgent || ''
                    });
                    modal.remove();
                    if (previousModal && previousModal.remove) previousModal.remove();
                    showToast('忘記密碼申請已送出，請等待管理員協助設定新密碼。', 'success');
                } catch (err) {
                    console.error('忘記密碼申請失敗:', err);
                    showToast('申請送出失敗：' + err.message, 'error');
                } finally {
                    hideLoading();
                }
            };
        };

        window.exportMyData = function() {
            const payload = {
                exportedAt: new Date().toISOString(),
                userId: window.state.applicationId,
                profile: window.state.userData || {},
                posts: (window.state.posts || []).filter(p => p.userId === window.state.applicationId),
                notifications: getNotificationItems()
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `secretroom_${window.state.applicationId || 'member'}_data.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            showToast('個人資料匯出檔已建立。', 'success');
        };

        window.showAccountDeletionRequestModal = function() {
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md';
            modal.innerHTML = `
                <div class="glass-panel border border-rose-500/20 rounded-3xl p-6 w-[92vw] max-w-sm shadow-2xl relative crystal-border">
                    <button id="close-delete-request" class="absolute top-4 right-4 text-slate-550 hover:text-white text-2xl transition hover-breath click-press">&times;</button>
                    <h3 class="text-lg font-black text-white mb-1 font-luxury"><i class="fa-solid fa-user-slash text-rose-400 mr-2"></i>申請刪除帳號</h3>
                    <p class="text-xs text-slate-400 leading-relaxed mb-5">送出後將由管理員審核。審核通過後，帳號、貼文與相關資料可能被永久移除；正式刪除前請先匯出個人資料。</p>
                    <textarea id="delete-request-reason" class="w-full min-h-[110px] bg-slate-900 border border-rose-500/15 rounded-2xl px-3.5 py-3 text-sm text-white focus:outline-none focus:border-rose-400 resize-none" placeholder="請簡述刪除原因"></textarea>
                    <input id="delete-request-confirm" class="w-full mt-3 bg-slate-950 border border-rose-500/15 rounded-xl px-3.5 py-3 text-sm text-white focus:outline-none focus:border-rose-400" placeholder="請輸入你的帳號 ID 以確認">
                    <button id="btn-submit-delete-request" class="w-full mt-4 bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm py-3.5 rounded-xl transition hover-breath click-press">送出刪除申請</button>
                </div>
            `;
            document.body.appendChild(modal);
            document.getElementById('close-delete-request').onclick = () => modal.remove();
            document.getElementById('btn-submit-delete-request').onclick = async () => {
                const reason = document.getElementById('delete-request-reason').value.trim();
                const confirmText = document.getElementById('delete-request-confirm').value.trim();
                if (confirmText !== window.state.applicationId) { showToast('確認帳號 ID 不一致。', 'error'); return; }
                if (!db) { showToast('伺服器尚未完成連線，請稍後再試。', 'error'); return; }
                showLoading();
                try {
                    const reqRef = doc(collection(db, 'secretg_apps', appId, 'account_requests'));
                    await setDoc(reqRef, {
                        type: 'account_delete',
                        userId: window.state.applicationId,
                        email: window.state.userData.email || '',
                        nickname: window.state.userData.nickname || '',
                        reason: reason || '使用者未填寫原因',
                        status: 'pending',
                        createdAt: serverTimestamp(),
                        createdAtMs: Date.now()
                    });
                    const userRef = doc(db, 'secretg_apps', appId, 'applications', window.state.applicationId);
                    await updateDoc(userRef, { accountDeletionStatus: 'pending', accountDeletionRequestedAt: serverTimestamp(), accountDeletionRequestedAtMs: Date.now() });
                    await createUserNotification({ type: 'account', tone: 'account', title: '帳號刪除申請已送出', message: '您的帳號刪除申請已送交管理員審核。處理完成前，帳號仍可登入使用。', status: '審查中' });
                    window.state.userData.accountDeletionStatus = 'pending';
                    modal.remove();
                    showToast('帳號刪除申請已送出。', 'success');
                    renderDashboard(appContainer);
                } catch (err) {
                    console.error('帳號刪除申請失敗:', err);
                    showToast('申請送出失敗：' + err.message, 'error');
                } finally {
                    hideLoading();
                }
            };
        };

        window.showEditProfileModal = function() {
            const user = window.state.userData;
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md';
            modal.innerHTML = `
                
                <div class="glass-panel border border-amber-500/20 rounded-3xl p-6 w-[92vw] max-w-md shadow-2xl relative overflow-y-auto max-h-[90vh] crystal-border">
                    <button id="close-edit" class="absolute top-4 right-4 text-slate-550 hover:text-white text-2xl transition hover-breath click-press">&times;</button>
                    
                    <h3 class="text-lg font-bold text-white mb-1.5 flex items-center gap-2 font-luxury">
                        <i class="fa-solid fa-user-gear text-amber-500"></i> Edit Profile
                    </h3>
                    <p class="text-xs text-slate-400 mb-5 leading-relaxed">填寫要變更的個人資訊，除頭像變更後需人工審核外，其餘欄位修改儲存後即會自動更新！</p>
  
                    <div class="space-y-4">
                        
                        <div class="bg-slate-900/40 p-4 border border-amber-500/10 rounded-2xl flex items-center justify-between">
                            <div class="text-left max-w-[210px]">
                                
                                <span class="text-xs font-bold text-slate-300 tracking-wider block">變更個人大頭照</span>
                                <span class="text-[10px] text-amber-500/80 font-semibold block mt-1 leading-normal"><i class="fa-solid fa-camera"></i> 變更大頭照需要管理團隊人工二次核定後才予以替換啟用。</span>
                            </div>
                            <div class="relative w-14 h-14 rounded-full border border-amber-500/30 cursor-pointer overflow-hidden shadow-md hover-breath click-press" id="edit-avatar-trigger">
                                <img src="${user.avatar || 'Gemini_Generated_Image_e2fxvje2fxvje2fx.jpg?v=2'}" id="edit-avatar-preview" class="w-full h-full object-cover">
                            </div>
                            <input type="file" id="edit-avatar-file" accept="image/jpeg,image/png,image/webp" class="hidden">
                        </div>
  
                        <div>
                            
                            <label class="block text-xs font-bold text-slate-400 mb-1.5 tracking-wider">個人暱稱</label>
                            <input type="text" id="edit-nickname" value="${user.nickname || ''}" class="w-full bg-slate-900 border border-amber-500/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition" required>
                        </div>
  
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                
                                <label class="block text-xs font-bold text-slate-400 mb-1.5 tracking-wider">身高 (cm)</label>
                                <input type="number" id="edit-height" value="${user.height || ''}" class="w-full bg-slate-900 border border-amber-500/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition" required>
                            </div>
                            <div>
                                
                                <label class="block text-xs font-bold text-slate-400 mb-1.5 tracking-wider">體重 (kg)</label>
                                <input type="number" id="edit-weight" value="${user.weight || ''}" class="w-full bg-slate-900 border border-amber-500/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition" required>
                            </div>
                        </div>
  
                        <div class="p-4 bg-slate-900/40 border border-amber-500/10 rounded-2xl">
                            
                            <span class="text-xs font-bold text-amber-500 tracking-widest block mb-2"><i class="fa-solid fa-lock mr-1"></i> 身體數據密碼規格</span>
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-xs font-bold text-slate-555 mb-1">勃起長度 (cm)</label>
                                    <input type="number" id="edit-length" value="${user.length || ''}" class="w-full bg-slate-900 border border-amber-500/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition" required>
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-slate-555 mb-1">勃起粗度圍 (cm)</label>
                                    <input type="number" id="edit-girth" value="${user.girth || ''}" class="w-full bg-slate-900 border border-amber-500/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition" required>
                                </div>
                            </div>
                        </div>
  
                        <div>
                            
                            <label class="block text-xs font-bold text-slate-400 mb-1.5 tracking-wider">感興趣的主題與偏好標籤</label>
                            <div class="grid grid-cols-2 gap-2 bg-slate-950/40 p-3.5 border border-amber-500/15 rounded-2xl">
                                ${window.state.kinksOptions.map(k => `
                                    <label class="flex items-center gap-2 cursor-pointer hover:bg-slate-900/60 p-2 rounded-xl transition border border-transparent hover:border-amber-500/10 hover-breath">
                                        <input type="checkbox" name="edit-kink" value="${k}" ${user.kinks && user.kinks.includes(k) ? 'checked' : ''} class="rounded border-amber-500/30 bg-slate-950 text-amber-500 focus:ring-amber-500 w-4 h-4">
                                        <span class="text-[11px] sm:text-xs text-slate-300 font-semibold leading-tight select-none">${k}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>

                        <button id="btn-submit-profile-edit" class="w-full brushed-gold font-bold text-sm py-3.5 rounded-xl transition tracking-wider crystal-border hover-breath click-press">
                            儲存變更
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
  
            document.getElementById('close-edit').onclick = () => modal.remove();
  
            const fileInput = document.getElementById('edit-avatar-file');
            const previewImg = document.getElementById('edit-avatar-preview');
            let pendingBase64 = '';
  
            document.getElementById('edit-avatar-trigger').onclick = () => fileInput.click();
  
            fileInput.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 10 * 1024 * 1024) {
                        showToast('新大頭照檔案大小超過 10 Mb 限制！', 'error');
                        return;
                    }
                    showLoading();
                    try {
                        pendingBase64 = await processAndCompressImageFile(file, 240, 0.75);
                        previewImg.src = pendingBase64;
                        showToast('新大頭照優化成功', 'success');
                    } catch (err) {
                        console.error(err);
                        showToast('新大頭相片解析失敗！', 'error');
                    } finally {
                        hideLoading();
                    }
                }
            };

            document.getElementById('btn-submit-profile-edit').onclick = async () => {
                const nickname = document.getElementById('edit-nickname').value.trim();
                const height = document.getElementById('edit-height').value;
                const weight = document.getElementById('edit-weight').value;
                const length = document.getElementById('edit-length').value;
                const girth = document.getElementById('edit-girth').value;

                const selectedKinks = [];
                document.querySelectorAll('input[name="edit-kink"]:checked').forEach(cb => {
                    selectedKinks.push(cb.value);
                });

                if (!nickname) {
                    showToast('暱稱不能為空！', 'error');
                    return;
                }
                if (selectedKinks.length === 0) {
                    showToast('請至少選擇一項感興趣的主題標籤！', 'error');
                    return;
                }

                showLoading();
                try {
                    const userRef = doc(db, 'secretg_apps', appId, 'applications', window.state.applicationId);
                    const updates = {
                        nickname,
                        height,
                        weight,
                        length,
                        girth,
                        kinks: selectedKinks
                    };

                    if (pendingBase64) {
                        updates.avatarPending = pendingBase64;
                        updates.avatarStatus = 'pending';
                    }

                    await updateDoc(userRef, updates);
                    if (pendingBase64) {
                        await createUserNotification({
                            type: 'avatar',
                            tone: 'pending',
                            title: '大頭照更換已送審',
                            message: '您的新頭像已提交管理員審核，通過後會自動更新到個人頁面。',
                            status: '審查中'
                        });
                    }

                    window.state.userData = { ...window.state.userData, ...updates };
                    if (pendingBase64) {
                        window.state.userData.avatarPending = pendingBase64;
                        window.state.userData.avatarStatus = 'pending';
                    }

                    modal.remove();
                    showToast('個人資料已成功更新！', 'success');
                    renderDashboard(appContainer);
                } catch (err) {
                    console.error("更新檔案失敗:", err);
                    showToast('更新失敗，請稍後重試: ' + err.message, 'error');
                } finally {
                    hideLoading();
                }
            };
        };

        window.showSpecApplyModal = () => {
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md';
            modal.innerHTML = `
                
                <div class="glass-panel border border-amber-500/20 rounded-3xl p-6 w-[92vw] max-w-sm shadow-2xl relative crystal-border">
                    <button id="close-spec" class="absolute top-4 right-4 text-slate-550 hover:text-white text-2xl transition hover-breath click-press">&times;</button>
                    
                    <h3 class="text-sm font-bold text-white mb-1.5 flex items-center gap-2 font-luxury">
                        <i class="fa-solid fa-medal text-amber-500"></i> Gold Spec Elite
                    </h3>
                    <p class="text-xs text-slate-400 mb-5 leading-relaxed">請上傳帶有清楚尺規參考物（如捲尺、直尺）的實物測量證明照片。系統會自動覆蓋淡色、較隱性的「SecretRomm @使用者帳號」滿版 45 度浮水印；若原始圖片本身已有其他浮水印，系統不會自動移除。若通過黃金Spec認證將會自動開啟S+ . S . G功能，可查看其他通過黃金Spec會員之審核照。</p>
                    <div class="space-y-4">
                        <div class="border border-amber-500/10 rounded-2xl p-4 flex flex-col items-center justify-center bg-slate-900/20 text-center">
                            <div id="spec-img-trigger" class="relative w-full h-40 rounded-xl border border-dashed border-amber-500/30 flex flex-col items-center justify-center cursor-pointer overflow-hidden bg-slate-950 transition hover-breath click-press">
                                <img id="spec-preview" class="absolute inset-0 w-full h-full object-contain hidden">
                                <div id="spec-placeholder" class="text-slate-550 flex flex-col items-center gap-1.5 transition">
                                    <i class="fa-solid fa-cloud-arrow-up text-2xl text-amber-500/70"></i>
                                    <span class="text-xs font-bold">點擊選取證明照片</span>
                                </div>
                            </div>
                            <input type="file" id="spec-file" accept="image/jpeg,image/png,image/webp" class="hidden">
                            <p class="text-[10px] text-slate-500 mt-3 leading-relaxed">支援 JPG、PNG、WebP，單張上限 8MB；照片需清晰包含尺規或可驗證參考物。</p>
                        </div>
                        <label class="flex items-start gap-3 rounded-2xl border border-amber-500/15 bg-slate-950/55 p-3 text-left cursor-pointer">
                            <input type="checkbox" id="spec-share-consent" class="mt-1 accent-amber-500">
                            <span class="text-[11px] text-slate-300 leading-relaxed">我了解若黃金 Spec 認證通過，審核照片將開放給其他已通過黃金 Spec 的 S+ . S . G 會員於站內查看；我也了解平台會加上 NSFW 提醒與 SecretRomm 浮水印，但仍需自行承擔私密照片上傳風險。</span>
                        </label>
                        
                        <button id="btn-submit-spec" class="w-full brushed-gold font-bold text-sm py-3 rounded-xl transition tracking-wider crystal-border hover-breath click-press">
                            提交規格核查申請
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('close-spec').onclick = () => modal.remove();

            const fileInput = document.getElementById('spec-file');
            const previewImg = document.getElementById('spec-preview');
            const placeholder = document.getElementById('spec-placeholder');
            let specBase64 = '';

            document.getElementById('spec-img-trigger').onclick = () => fileInput.click();

            fileInput.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    showLoading();
                    try {
                        specBase64 = await processAndCompressImageFile(file, 800, 0.75, getWatermarkText());
                        previewImg.src = specBase64;
                        previewImg.classList.remove('hidden');
                        placeholder.classList.add('hidden');
                        showToast('證明相片優化處理成功', 'success');
                    } catch (err) {
                        console.error(err);
                        showToast('證明照片載入錯誤', 'error');
                    } finally {
                        hideLoading();
                    }
                }
            };

            document.getElementById('btn-submit-spec').onclick = async () => {
                if (!specBase64) {
                    showToast('請先上傳實物證明照片！', 'error');
                    return;
                }
                const consentBox = document.getElementById('spec-share-consent');
                if (!consentBox || !consentBox.checked) {
                    showToast('請先勾選黃金 Spec 審核照片分享同意聲明。', 'error');
                    return;
                }

                if (!db) { showToast('伺服器尚未完成連線，暫時無法提交認證。', 'error'); return; }
                showLoading();

                try {
                    const userRef = doc(db, 'secretg_apps', appId, 'applications', window.state.applicationId);
                    await updateDoc(userRef, {
                        specEliteStatus: 'pending',
                        specImage: specBase64,
                        specShareConsent: true,
                        specSubmittedAt: serverTimestamp(),
                        specUpdatedAt: serverTimestamp(),
                        specSubmittedAtMs: Date.now(),
                        specUpdatedAtMs: Date.now()
                    });
                    await createUserNotification({
                        type: 'spec',
                        tone: 'pending',
                        title: '黃金 Spec 認證已送審',
                        message: '您的規格證明照片已送交官方審核，審核完成後會在通知更新狀態。',
                        status: '審查中'
                    });

                    window.state.userData.specEliteStatus = 'pending';
                    modal.remove();
                    showToast('規格核查照片已送出，請耐心等待審查結果！', 'success');
                    renderDashboard(appContainer);
                } catch (err) {
                    console.error("提交規格審核錯誤:", err);
                    showToast('提交失敗，請重試: ' + err.message, 'error');
                } finally {
                    hideLoading();
                }
            };
        };
  
        window.getBadgeHTML = function(user, isBig = false) {
            const badges = [];
  
            if (user.role === 'admin' || user.isAdmin) {
                badges.push({ 
                    icon: 'fa-crown', 
                    color: 'from-amber-400 via-yellow-200 to-amber-600 shadow-yellow-500/20 border-amber-400/30', 
                    tooltip: '官方最高權限治理者'
                });
            }
            const createdSecs = user.createdAt ? user.createdAt.seconds : 0;
            const nowSecs = Date.now() / 1000;
            if (createdSecs && (nowSecs - createdSecs) <= (168 * 3600)) {
                badges.push({ 
                    icon: 'fa-seedling', 
                    color: 'from-emerald-400 via-green-200 to-teal-600 shadow-emerald-500/20 border-emerald-500/30', 
                    tooltip: '本週新進之尊貴仕紳'
                });
            }
            if (user.isPioneer) {
                badges.push({ 
                    icon: 'fa-shield-halved', 
                    color: 'from-amber-600 to-orange-700 shadow-orange-500/10 border-orange-500/20', 
                    tooltip: '創始階段即入駐的終身元老'
                });
            }
            if (user.isSpecElite) {
                badges.push({ 
                    icon: 'fa-medal', 
                    color: 'from-amber-300 via-yellow-200 to-yellow-650 shadow-amber-500/35 border-amber-300/30 animate-pulse', 
                    tooltip: '通過官方生殖規格實證認證'
                });
            }
  
            const userPosts = window.state.posts.filter(p => p.userId === user.id);
            const totalLikes = userPosts.reduce((sum, p) => sum + (p.likeCount || 0), 0);
  
            if (totalLikes >= 1000) {
                badges.push({ 
                    icon: 'fa-fire', 
                    color: 'from-orange-500 to-rose-600 shadow-orange-500/20 border-orange-500/25', 
                    tooltip: '獲得超過千次按讚之社群人氣王'
                });
            }
  
            const perfectPosts = userPosts.filter(p => {
                const ratings = p.ratings ? Object.values(p.ratings) : [];
                const avg = ratings.length > 0 ? (ratings.reduce((a,b)=>a+b, 0) / ratings.length) : 0;
                return avg === 5.0 && ratings.length >= 500;
            });
            if (userPosts.length >= 50 && perfectPosts.length === userPosts.length) {
                badges.push({ 
                    icon: 'fa-star', 
                    color: 'from-amber-400 to-yellow-500 shadow-amber-400/20 border-amber-400/25', 
                    tooltip: '多篇作品榮獲無瑕滿分評價'
                });
            }
  
            if (userPosts.length >= 100) {
                badges.push({ 
                    icon: 'fa-camera', 
                    color: 'from-violet-500 to-purple-700 shadow-violet-500/20 border-purple-500/25', 
                    tooltip: '累計發布上百篇動態作品'
                });
            }
  
            return badges.map(b => {
                const sizeClass = isBig ? 'w-8 h-8 text-sm' : 'w-6 h-6 text-xs';
                return `
                    <span class="inline-flex items-center justify-center ${sizeClass} rounded-full bg-gradient-to-r ${b.color} text-slate-950 shadow-md badge-glow pointer-events-auto select-none brass-badge cursor-default hover-breath" aria-label="${b.tooltip}">
                        <i class="fa-solid ${b.icon}"></i>
                    </span>
                `;
            }).join('');
        };
  
        window.getUserBadgeHTMLForPost = function(post) {
            let authorUser = window.state.activeUsers.find(u => u.id === post.userId);
            if (!authorUser && post.userId === window.state.applicationId) {
                authorUser = window.state.userData;
            }
            if (authorUser) {
                return getBadgeHTML(authorUser, false);
            }
            const simulatedUser = {
                id: post.userId,
                createdAt: post.createdAt || { seconds: Date.now() / 1000 },
                role: post.userId === 'gentleman_alpha' ? 'admin' : 'user',
                isSpecElite: post.isSpecElite || false
            };
            return getBadgeHTML(simulatedUser, false);
        };
  
        window.deleteMyPost = function(postId) {
            const modal = document.getElementById('custom-confirm-modal');
            const cancelBtn = document.getElementById('confirm-modal-cancel');
            const okBtn = document.getElementById('confirm-modal-ok');
            if (!modal || !cancelBtn || !okBtn) {
                showToast('刪除確認視窗載入失敗，請重新整理後再試。', 'error');
                return;
            }
            modal.classList.remove('hidden');

            cancelBtn.onclick = () => {
                modal.classList.add('hidden');
            };

            okBtn.onclick = async () => {
                if (!db) {
                    modal.classList.add('hidden');
                    showToast('伺服器尚未完成連線，暫時無法刪除。', 'error');
                    return;
                }
                okBtn.disabled = true;
                okBtn.classList.add('opacity-60', 'cursor-not-allowed');
                const originalText = okBtn.innerHTML;
                okBtn.innerHTML = '刪除中...';
                showLoading();
                try {
                    await withTimeout(deleteDoc(doc(db, 'secretg_apps', appId, 'posts', postId)), 12000, '刪除逾時，請稍後重試。');
                    modal.classList.add('hidden');
                    showToast('該條分享動態已刪除 🔒', 'success');
                } catch (err) {
                    console.error("刪除失敗:", err);
                    showToast(err.message || '銷毀失敗', 'error');
                } finally {
                    hideLoading();
                    okBtn.disabled = false;
                    okBtn.classList.remove('opacity-60', 'cursor-not-allowed');
                    okBtn.innerHTML = originalText;
                }
            };
        };

        window.showToast = showToast;
  
        const startSecretRoomApp = () => {
  if (window.__SR_PUBLIC_APP_STARTED__) return;
  window.__SR_PUBLIC_APP_STARTED__ = true;
  initApp();
  if (typeof initBGMController === 'function') initBGMController();
};
if (document.readyState === 'loading') window.addEventListener('load', startSecretRoomApp, { once: true });
else queueMicrotask(startSecretRoomApp);

})();

/* ===== Consolidated source: sr_password_flow.js ===== */
;(() => {
// SecretRoom password and account-recovery helpers.
(() => {
  const VERSION = '20260711-phase1-auth-v1';
  const APP_ID = 'secretg-production-node-tw';
  const LAST_LOGIN_KEY = 'sr_last_login_id';
  const RESET_EMAIL_KEY = 'sr_last_reset_email';

  window.SRP = window.SRP || { app: APP_ID, db: null, fs: null };
  SRP.app = APP_ID;

  SRP.tools = async () => {
    if (SRP.db && SRP.fs) return SRP;
    const appMod = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js');
    const firestoreMod = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
    const app = appMod.getApps()[0];
    if (!app) throw new Error('Firebase 尚未初始化');
    SRP.db = firestoreMod.getFirestore(app);
    SRP.fs = firestoreMod;
    return SRP;
  };

  SRP.valid = password => String(password || '').length >= 8 && /[A-Z]/.test(password || '') && /[!@#$%^&*(),.?":{}|<>]/.test(password || '');
  SRP.need = user => !!(user && (user.mustChangePassword || user.forcePasswordChange || user.tempPasswordActive || user.passwordChangeRequired));
  SRP.toast = (message, type = 'info') => window.showToast ? window.showToast(message, type) : console.log(message);

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function setButtonBusy(button, busy, busyText = '處理中...') {
    if (!button) return;
    if (busy) {
      if (!button.dataset.srOriginalText) button.dataset.srOriginalText = button.innerHTML;
      button.disabled = true;
      button.classList.add('opacity-60', 'cursor-not-allowed');
      button.textContent = busyText;
    } else {
      button.disabled = false;
      button.classList.remove('opacity-60', 'cursor-not-allowed');
      button.innerHTML = button.dataset.srOriginalText || '登入';
    }
  }

  function showLoginError(message) {
    const box = document.getElementById('login-error-box');
    if (box) {
      box.textContent = message;
      box.classList.remove('hidden');
    }
    SRP.toast(message, 'error');
  }

  function clearLoginError() {
    const box = document.getElementById('login-error-box');
    if (box) {
      box.textContent = '';
      box.classList.add('hidden');
    }
  }

  window.SRP.sendMail = async (user, id, message) => {
    if (!window.emailjs || !user?.email) return;
    try {
      await emailjs.send('service_1ou10mi', 'template_sr_security', {
        to_email: user.email,
        to_name: user.nickname || id,
        status_text: 'SecretRoom 密碼已更新',
        message: message || '你的 SecretRoom 密碼剛剛已更新。不是你本人操作的話，請盡快聯絡管理員。',
        email_type: '帳號安全提醒',
        member_id: id
      }, { publicKey: 'XggJY7iHQcZYYhNY7' });
    } catch (error) {
      console.warn('密碼安全提醒寄送失敗:', error);
    }
  };

  window.SRP_enter = function(id) {
    localStorage.setItem('sr_username', id);
    localStorage.setItem(LAST_LOGIN_KEY, id);
    SRP.toast('登入成功，正在帶你進去。', 'success');
    setTimeout(() => location.reload(), 450);
  };

  function passwordFieldHtml(id, placeholder) {
    return `<div class="relative"><input id="${id}" type="password" class="w-full bg-slate-900 border border-amber-500/10 rounded-xl pl-3.5 pr-11 py-3 text-sm text-white focus:outline-none focus:border-amber-500" placeholder="${placeholder}"><button type="button" data-sr-toggle-password="${id}" class="absolute inset-y-0 right-0 min-w-[44px] flex items-center justify-center text-slate-400 hover:text-amber-300" aria-label="顯示或隱藏密碼"><i class="fa-solid fa-eye-slash text-xs"></i></button></div>`;
  }

  function bindPasswordToggles(root = document) {
    root.querySelectorAll('[data-sr-toggle-password]').forEach(button => {
      if (button.dataset.srBound === '1') return;
      button.dataset.srBound = '1';
      button.onclick = () => {
        const input = document.getElementById(button.dataset.srTogglePassword || '');
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
        const icon = button.querySelector('i');
        if (icon) icon.className = `fa-solid ${input.type === 'password' ? 'fa-eye-slash' : 'fa-eye'} text-xs`;
      };
    });
  }

  window.SRP_force = function(id, user) {
    if (document.getElementById('sr-force-change')) return;
    const modal = document.createElement('div');
    modal.id = 'sr-force-change';
    modal.className = 'fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md';
    modal.innerHTML = `<div class="glass-panel border border-amber-500/25 rounded-3xl p-6 w-[92vw] max-w-sm shadow-2xl relative crystal-border"><div class="text-[10px] text-amber-300 font-black mb-2">最後一步</div><h3 class="text-lg font-black text-white mb-1 font-luxury"><i class="fa-solid fa-key text-amber-500 mr-2"></i>換一組新密碼</h3><p class="text-xs text-slate-400 leading-relaxed mb-5">你現在是用臨時密碼登入，先換成自己的密碼就能繼續。</p><div class="space-y-3">${passwordFieldHtml('sr-new1', '新密碼')}${passwordFieldHtml('sr-new2', '再輸入一次新密碼')}<div class="text-xs text-slate-500 leading-relaxed">至少 8 碼，並包含 1 個大寫英文字母和 1 個特殊符號。</div><button id="sr-save-new" class="w-full min-h-[44px] brushed-gold font-bold text-sm py-3.5 rounded-xl crystal-border hover-breath click-press">換好密碼，繼續登入</button></div></div>`;
    document.body.appendChild(modal);
    bindPasswordToggles(modal);
    document.getElementById('sr-save-new').onclick = async () => {
      const saveButton = document.getElementById('sr-save-new');
      const first = document.getElementById('sr-new1').value;
      const second = document.getElementById('sr-new2').value;
      if (!first || !second) return SRP.toast('請把兩個密碼欄位都填好。', 'error');
      if (first !== second) return SRP.toast('兩次輸入不一樣，再確認一下。', 'error');
      if (first === user.password) return SRP.toast('新密碼不能和臨時密碼一樣。', 'error');
      if (!SRP.valid(first)) return SRP.toast('密碼格式不符：至少 8 碼，並包含 1 個大寫英文字母和 1 個特殊符號。', 'error');
      setButtonBusy(saveButton, true, '正在更新...');
      try {
        const { db, fs } = await SRP.tools();
        const updates = {
          password: first,
          mustChangePassword: false,
          forcePasswordChange: false,
          tempPasswordActive: false,
          passwordChangeRequired: false,
          passwordChangedAt: fs.serverTimestamp(),
          passwordChangedAtMs: Date.now(),
          passwordChangedBy: 'member',
          lastPasswordChangeMethod: 'temporary_login'
        };
        await fs.updateDoc(fs.doc(db, 'secretg_apps', SRP.app, 'applications', id), updates);
        await SRP.sendMail({ ...user, ...updates }, id);
        modal.remove();
        window.SRP_enter(id);
      } catch (error) {
        console.error(error);
        SRP.toast('密碼沒換成功：' + error.message, 'error');
        setButtonBusy(saveButton, false);
      }
    };
  };

  async function SRP_login() {
    const idInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const button = document.getElementById('btn-login-submit');
    const id = idInput?.value.trim() || '';
    const password = passwordInput?.value || '';
    clearLoginError();
    if (!id || !password) return showLoginError('帳號和密碼都要填。');
    if (button?.dataset.srBusy === '1') return;
    if (button) button.dataset.srBusy = '1';
    localStorage.setItem(LAST_LOGIN_KEY, id);
    setButtonBusy(button, true, '登入中...');
    try {
      const { db, fs } = await SRP.tools();
      const snapshot = await fs.getDoc(fs.doc(db, 'secretg_apps', SRP.app, 'applications', id));
      if (!snapshot.exists()) return showLoginError('找不到這個帳號，請先完成申請。');
      const user = snapshot.data() || {};
      const expiresAt = Number(user.tempPasswordExpiresAtMs || user.temporaryCredentialExpiresAtMs || 0);
      if (SRP.need(user) && expiresAt && Date.now() > expiresAt) return showLoginError('這組臨時密碼已過期，請重新申請。');
      if (user.password !== password) return showLoginError('密碼不對，再試一次。');
      if (SRP.need(user)) return window.SRP_force(id, user);
      window.SRP_enter(id);
    } catch (error) {
      console.error(error);
      showLoginError('登入時出了點問題：' + error.message);
    } finally {
      if (button) button.dataset.srBusy = '0';
      if (document.body.contains(button)) setButtonBusy(button, false);
    }
  }

  function renderResetStep(modal, step, content) {
    const steps = modal.querySelectorAll('[data-sr-reset-step]');
    steps.forEach(node => {
      const value = Number(node.dataset.srResetStep || 0);
      node.classList.toggle('sr-reset-step-active', value === step);
      node.classList.toggle('sr-reset-step-done', value < step);
    });
    const body = modal.querySelector('#sr-reset-flow-body');
    if (body) body.innerHTML = content;
  }

  function openLoginFromReset(modal, accountId) {
    modal.remove();
    const existingLogin = document.getElementById('login-username');
    if (existingLogin) {
      existingLogin.value = accountId || existingLogin.value;
      localStorage.setItem(LAST_LOGIN_KEY, existingLogin.value.trim());
      document.getElementById('login-password')?.focus();
      return;
    }
    document.getElementById('btn-goto-login')?.click();
    setTimeout(() => {
      const input = document.getElementById('login-username');
      if (input) input.value = accountId || localStorage.getItem(LAST_LOGIN_KEY) || '';
      document.getElementById('login-password')?.focus();
    }, 80);
  }

  window.SRP_showResetFlow = function(previousModal = null) {
    document.getElementById('sr-reset-flow')?.remove();
    const loginId = document.getElementById('login-username')?.value.trim() || localStorage.getItem(LAST_LOGIN_KEY) || '';
    const savedEmail = localStorage.getItem(RESET_EMAIL_KEY) || '';
    const modal = document.createElement('div');
    modal.id = 'sr-reset-flow';
    modal.className = 'fixed inset-0 z-[125] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md';
    modal.innerHTML = `<div class="glass-panel border border-amber-500/25 rounded-3xl p-5 sm:p-6 w-[94vw] max-w-md shadow-2xl relative crystal-border"><button id="sr-reset-close" type="button" class="absolute top-3 right-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white text-xl" aria-label="關閉忘記密碼流程"><i class="fa-solid fa-xmark"></i></button><h3 class="text-lg font-black text-white font-luxury pr-10"><i class="fa-solid fa-key text-amber-500 mr-2"></i>忘記密碼</h3><p class="text-xs text-slate-400 mt-1">照著三個步驟，就能重新登入。</p><div class="sr-reset-steps grid grid-cols-3 gap-2 my-5"><div data-sr-reset-step="1" class="sr-reset-step sr-reset-step-active"><span>1</span><small>送出申請</small></div><div data-sr-reset-step="2" class="sr-reset-step"><span>2</span><small>收到臨時密碼</small></div><div data-sr-reset-step="3" class="sr-reset-step"><span>3</span><small>登入並換密碼</small></div></div><div id="sr-reset-flow-body"></div></div>`;
    document.body.appendChild(modal);
    document.getElementById('sr-reset-close').onclick = () => modal.remove();
    modal.addEventListener('click', event => { if (event.target === modal) modal.remove(); });

    const stepOne = `<div class="space-y-3"><div><label class="block text-xs font-bold text-slate-300 mb-1.5">帳號</label><input id="sr-reset-id" class="w-full bg-slate-900 border border-amber-500/10 rounded-xl px-3.5 py-3 text-sm text-white focus:outline-none focus:border-amber-500" value="${esc(loginId)}" autocomplete="username"></div><div><label class="block text-xs font-bold text-slate-300 mb-1.5">註冊信箱</label><input id="sr-reset-email" type="email" class="w-full bg-slate-900 border border-amber-500/10 rounded-xl px-3.5 py-3 text-sm text-white focus:outline-none focus:border-amber-500" value="${esc(savedEmail)}" autocomplete="email"></div><p class="text-xs text-slate-500 leading-relaxed">送出後，管理員會寄一組 10 分鐘有效的臨時密碼到你的信箱。</p><button id="sr-reset-submit" class="w-full min-h-[44px] brushed-gold font-bold text-sm py-3.5 rounded-xl crystal-border">送出申請</button></div>`;
    renderResetStep(modal, 1, stepOne);

    document.getElementById('sr-reset-submit').onclick = async () => {
      const button = document.getElementById('sr-reset-submit');
      const userId = document.getElementById('sr-reset-id').value.trim();
      const email = document.getElementById('sr-reset-email').value.trim().toLowerCase();
      if (!userId || !email) return SRP.toast('帳號和註冊信箱都要填。', 'error');
      if (!/^\S+@\S+\.\S+$/.test(email)) return SRP.toast('請確認信箱格式。', 'error');
      localStorage.setItem(LAST_LOGIN_KEY, userId);
      localStorage.setItem(RESET_EMAIL_KEY, email);
      setButtonBusy(button, true, '正在送出...');
      try {
        const { db, fs } = await SRP.tools();
        const userRef = fs.doc(db, 'secretg_apps', SRP.app, 'applications', userId);
        const userSnapshot = await fs.getDoc(userRef);
        if (!userSnapshot.exists()) throw new Error('帳號或註冊信箱不相符。');
        const user = userSnapshot.data() || {};
        const boundEmail = String(user.email || user.boundEmail || user.notificationEmail || '').trim().toLowerCase();
        if (!boundEmail || boundEmail !== email) throw new Error('帳號或註冊信箱不相符。');
        const status = String(user.status || '').toLowerCase();
        if (status && !['approved', 'active'].includes(status)) throw new Error('這個帳號尚未通過審核。');
        const pendingQuery = fs.query(
          fs.collection(db, 'secretg_apps', SRP.app, 'password_reset_requests'),
          fs.where('userId', '==', userId),
          fs.where('status', '==', 'pending')
        );
        const pendingSnapshot = await fs.getDocs(pendingQuery);
        if (pendingSnapshot.empty) {
          const requestRef = fs.doc(fs.collection(db, 'secretg_apps', SRP.app, 'password_reset_requests'));
          await fs.setDoc(requestRef, {
            userId,
            email,
            status: 'pending',
            type: 'forgot_password',
            verifiedMember: true,
            userDisplayName: user.nickname || user.displayName || userId,
            memberStatus: user.status || '',
            createdAt: fs.serverTimestamp(),
            createdAtMs: Date.now(),
            userAgent: navigator.userAgent || ''
          });
        }
        renderResetStep(modal, 2, `<div class="text-center py-2"><div class="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center justify-center mx-auto mb-4"><i class="fa-solid fa-check text-xl"></i></div><h4 class="text-base font-black text-white">申請已送出</h4><p class="text-xs text-slate-400 leading-relaxed mt-2">臨時密碼會寄到 <span class="text-amber-300">${esc(email.replace(/(^.).*(@.*$)/, '$1***$2'))}</span>。收到後，請在 10 分鐘內回來登入。</p><div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-5"><button id="sr-reset-wait" class="min-h-[44px] bg-slate-900 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold">先關閉</button><button id="sr-reset-received" class="min-h-[44px] brushed-gold rounded-xl text-xs font-black crystal-border">我已收到臨時密碼</button></div></div>`);
        document.getElementById('sr-reset-wait').onclick = () => modal.remove();
        document.getElementById('sr-reset-received').onclick = () => {
          renderResetStep(modal, 3, `<div class="text-center py-2"><div class="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center justify-center mx-auto mb-4"><i class="fa-solid fa-right-to-bracket text-xl"></i></div><h4 class="text-base font-black text-white">用臨時密碼登入</h4><p class="text-xs text-slate-400 leading-relaxed mt-2">登入後，系統會請你立刻換成自己的新密碼。</p><button id="sr-reset-back-login" class="w-full min-h-[44px] brushed-gold rounded-xl text-sm font-black crystal-border mt-5">回到登入</button></div>`);
          document.getElementById('sr-reset-back-login').onclick = () => openLoginFromReset(modal, userId);
        };
        previousModal?.remove?.();
      } catch (error) {
        console.error('忘記密碼申請失敗:', error);
        SRP.toast(error.message || '申請沒有送出，請稍後再試。', 'error');
        setButtonBusy(button, false);
      }
    };
  };

  window.showPasswordResetRequestModal = window.SRP_showResetFlow;

  function patchLogin() {
    const button = document.getElementById('btn-login-submit');
    const idInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const forgot = document.getElementById('btn-forgot-password');
    if (!button || !idInput || !passwordInput) return;

    button.textContent = '登入';
    button.classList.add('min-h-[44px]');
    window.__srHandleLoginSubmit = SRP_login;
    button.onclick = SRP_login;

    if (!idInput.dataset.srLoginBound) {
      idInput.dataset.srLoginBound = '1';
      if (!idInput.value) idInput.value = localStorage.getItem(LAST_LOGIN_KEY) || '';
      idInput.addEventListener('input', () => localStorage.setItem(LAST_LOGIN_KEY, idInput.value.trim()));
    }

    if (!passwordInput.dataset.srCapsBound) {
      passwordInput.dataset.srCapsBound = '1';
      const hint = document.createElement('div');
      hint.id = 'sr-caps-lock-hint';
      hint.className = 'hidden mt-1.5 text-xs text-amber-300';
      hint.textContent = 'Caps Lock 已開啟';
      passwordInput.closest('div')?.parentElement?.appendChild(hint);
      const updateCaps = event => hint.classList.toggle('hidden', !event.getModifierState?.('CapsLock'));
      passwordInput.addEventListener('keydown', updateCaps);
      passwordInput.addEventListener('keyup', updateCaps);
      passwordInput.addEventListener('blur', () => hint.classList.add('hidden'));
    }

    if (forgot) {
      forgot.textContent = '忘記密碼？';
      forgot.classList.add('min-h-[44px]');
      forgot.onclick = event => {
        event.preventDefault();
        window.SRP_showResetFlow(forgot.closest('.fixed'));
      };
    }
    bindPasswordToggles(document);
    document.documentElement.dataset.srAuthUi = VERSION;
  }

  function patchProfile() {
    const submitButton = document.getElementById('btn-submit-profile-edit');
    if (!submitButton || document.getElementById('srp-profile-pass')) return;
    const box = document.createElement('div');
    box.id = 'srp-profile-pass';
    box.className = 'p-4 bg-slate-900/40 border border-amber-500/10 rounded-2xl space-y-3';
    box.innerHTML = `<span class="text-xs font-bold text-amber-500 tracking-widest block"><i class="fa-solid fa-key mr-1"></i> 更改登入密碼</span><p class="text-xs text-slate-500 leading-relaxed">先輸入目前密碼，再設定新密碼。</p>${passwordFieldHtml('srp-old', '目前密碼')}${passwordFieldHtml('srp-newp', '新密碼')}${passwordFieldHtml('srp-newp2', '再輸入一次新密碼')}<div class="text-xs text-slate-500 leading-relaxed">至少 8 碼，並包含 1 個大寫英文字母和 1 個特殊符號。</div><button type="button" id="srp-save-pass" class="w-full min-h-[44px] bg-slate-950/60 text-amber-300 font-bold text-xs py-3 px-4 rounded-xl border border-amber-500/15 transition hover-breath click-press">更新密碼</button>`;
    submitButton.parentElement.insertBefore(box, submitButton);
    bindPasswordToggles(box);
    document.getElementById('srp-save-pass').onclick = async () => {
      const saveButton = document.getElementById('srp-save-pass');
      const id = localStorage.getItem('sr_username');
      const oldPassword = document.getElementById('srp-old').value;
      const first = document.getElementById('srp-newp').value;
      const second = document.getElementById('srp-newp2').value;
      if (!oldPassword || !first || !second) return SRP.toast('目前密碼、新密碼和確認欄位都要填。', 'error');
      if (first !== second) return SRP.toast('兩次輸入不一樣，再確認一下。', 'error');
      if (first === oldPassword) return SRP.toast('新密碼不能和目前密碼一樣。', 'error');
      if (!SRP.valid(first)) return SRP.toast('密碼格式不符：至少 8 碼，並包含 1 個大寫英文字母和 1 個特殊符號。', 'error');
      setButtonBusy(saveButton, true, '正在更新...');
      try {
        const { db, fs } = await SRP.tools();
        const ref = fs.doc(db, 'secretg_apps', SRP.app, 'applications', id);
        const snapshot = await fs.getDoc(ref);
        if (!snapshot.exists()) throw new Error('找不到你的帳號資料。');
        const user = snapshot.data() || {};
        if (user.password !== oldPassword) throw new Error('目前密碼不對。');
        const updates = {
          password: first,
          mustChangePassword: false,
          forcePasswordChange: false,
          tempPasswordActive: false,
          passwordChangeRequired: false,
          passwordChangedAt: fs.serverTimestamp(),
          passwordChangedAtMs: Date.now(),
          passwordChangedBy: 'member',
          lastPasswordChangeMethod: 'profile_edit'
        };
        await fs.updateDoc(ref, updates);
        await SRP.sendMail({ ...user, ...updates }, id);
        SRP.toast('密碼換好了，安全提醒也寄出了。', 'success');
        ['srp-old', 'srp-newp', 'srp-newp2'].forEach(fieldId => { const field = document.getElementById(fieldId); if (field) field.value = ''; });
      } catch (error) {
        console.error(error);
        SRP.toast('密碼沒換成功：' + error.message, 'error');
      } finally {
        setButtonBusy(saveButton, false);
      }
    };
  }

  function installStyles() {
    if (document.getElementById('sr-auth-phase1-style')) return;
    const style = document.createElement('style');
    style.id = 'sr-auth-phase1-style';
    style.textContent = `
      .sr-reset-step{display:flex;flex-direction:column;align-items:center;gap:.35rem;padding:.65rem .25rem;border:1px solid rgba(148,163,184,.12);border-radius:.9rem;color:#64748b;background:rgba(15,23,42,.35);text-align:center}.sr-reset-step span{display:flex;width:1.55rem;height:1.55rem;border-radius:999px;align-items:center;justify-content:center;border:1px solid rgba(148,163,184,.18);font-size:.7rem;font-weight:900}.sr-reset-step small{font-size:.62rem;line-height:1.2;font-weight:800}.sr-reset-step-active{color:#fcd34d;border-color:rgba(245,158,11,.28);background:rgba(245,158,11,.07)}.sr-reset-step-done{color:#6ee7b7;border-color:rgba(16,185,129,.22);background:rgba(16,185,129,.06)}
      @media(max-width:480px){.sr-reset-step small{font-size:.58rem}}
    `;
    document.head.appendChild(style);
  }

  let scheduled = false;
  function apply() {
    scheduled = false;
    installStyles();
    patchLogin();
    patchProfile();
  }
  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  }

  window.SRRuntime?.register(scheduleApply);
  document.addEventListener('DOMContentLoaded', apply, { once: true });
  apply();
})();
})();

/* ===== Consolidated source: sr_ui_regression_fixes.js ===== */
;(() => {
// SecretRoom frontend UI runtime: readiness, scrolling, eligibility and sidebar alignment.
(() => {
  if (window.__SR_UI_REGRESSION_FIXES__) return;
  window.__SR_UI_REGRESSION_FIXES__ = true;

  const VERSION = '20260712-ui-regression-v4';
  let queued = false;
  const qs = id => document.getElementById(id);
  const toast = (message, type = 'info') => window.showToast?.(message, type);

  function installFirebaseReadinessGuard() {
    const original = window.SRP?.tools;
    if (!original || original.__srReadyWrapped) return;
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const wrapped = async () => {
      let lastError = null;
      for (let attempt = 0; attempt < 60; attempt += 1) {
        try { return await original(); }
        catch (error) {
          lastError = error;
          if (!/Firebase 尚未初始化|no Firebase App/i.test(String(error?.message || error))) throw error;
          await wait(100);
        }
      }
      throw lastError || new Error('Firebase 初始化逾時');
    };
    wrapped.__srReadyWrapped = true;
    window.SRP.tools = wrapped;
  }

  function numberValue(value) {
    const parsed = Number.parseFloat(String(value ?? '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function specState(user = window.state?.userData || {}) {
    const status = String(user.specEliteStatus || '').toLowerCase();
    const approved = user.isSpecElite === true || ['approved', 'active', 'passed'].includes(status);
    const pending = status === 'pending';
    const eligible = numberValue(user.length) >= 16 && numberValue(user.girth) >= 5;
    return { approved, pending, eligible, canApply: eligible && !approved && !pending };
  }

  window.SRGoldSpecEligibility = user => specState(user);

  function scrollTargets() {
    const candidates = [
      qs('main-content-scroll'),
      document.scrollingElement,
      document.documentElement,
      document.body,
      ...document.querySelectorAll('.sr-dashboard-main .overflow-y-auto, .sr-mobile-menu-sheet')
    ];
    return [...new Set(candidates.filter(Boolean))];
  }

  function currentScrollTop() {
    return scrollTargets().reduce((max, node) => Math.max(max, Number(node.scrollTop || 0)), Number(window.scrollY || 0));
  }

  function syncBackToTop() {
    const button = qs('sr-back-to-top');
    if (!button) return;
    button.classList.toggle('sr-back-to-top-visible', currentScrollTop() > 500);
  }

  function scrollToTop() {
    const behavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    scrollTargets().forEach(node => {
      try { node.scrollTo({ top: 0, left: 0, behavior }); }
      catch (_) { node.scrollTop = 0; }
    });
    try { window.scrollTo({ top: 0, left: 0, behavior }); }
    catch (_) { window.scrollTo(0, 0); }
    requestAnimationFrame(() => {
      scrollTargets().forEach(node => { node.scrollTop = 0; });
      window.scrollTo(0, 0);
      syncBackToTop();
    });
  }

  function repairSpecActions() {
    const state = specState();
    const stepCard = qs('sr-phase3-badge-steps');
    const specButton = stepCard?.querySelector('[data-sr-next="spec"]');
    if (specButton && !state.canApply) specButton.remove();
    if (stepCard) {
      const remaining = stepCard.querySelectorAll('[data-sr-next]').length;
      const heading = stepCard.querySelector('h3');
      if (heading && remaining === 0) heading.textContent = '目前主要項目都完成了';
    }

    if (!state.eligible && !state.approved && !state.pending && window.state?.currentTab === 'badge-progress') {
      document.querySelectorAll('#dashboard-tab-content article').forEach(article => {
        if (!String(article.textContent || '').includes('黃金 Spec 實證認證')) return;
        article.querySelectorAll('div,span,p').forEach(node => {
          if (String(node.textContent || '').trim() === '可於個人主頁申請') {
            node.textContent = '目前身體數據未達申請門檻';
          }
        });
      });
    }
  }

  function repairCompletionCard() {
    const card = qs('sr-profile-completion');
    if (card && /(^|\D)100%(\D|$)/.test(String(card.textContent || ''))) card.remove();
  }

  function alignSidebar() {
    const spec = qs('aside-tab-spec-vault');
    const badge = qs('aside-tab-badge-progress');
    [spec, badge].forEach(tab => {
      if (!tab) return;
      tab.classList.add('sr-sidebar-row-fixed');
      const spans = Array.from(tab.children).filter(node => node.tagName === 'SPAN');
      spans[0]?.classList.add('sr-sidebar-label-fixed');
      spans.at(-1)?.classList.add('sr-sidebar-pill-fixed');
    });
  }

  function installStyles() {
    if (qs('sr-ui-regression-style')) return;
    const style = document.createElement('style');
    style.id = 'sr-ui-regression-style';
    style.textContent = `
      #aside-tab-spec-vault,#aside-tab-badge-progress{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:center!important;column-gap:.5rem!important;padding-left:.75rem!important;padding-right:.75rem!important}
      #aside-tab-spec-vault>.sr-sidebar-label-fixed,#aside-tab-badge-progress>.sr-sidebar-label-fixed{display:flex!important;align-items:center!important;gap:.625rem!important;min-width:0!important;margin:0!important;white-space:nowrap!important;line-height:1.15!important;order:initial!important}
      #aside-tab-spec-vault>.sr-sidebar-label-fixed{font-size:.82rem!important;letter-spacing:-.01em!important}
      #aside-tab-spec-vault>.sr-sidebar-label-fixed i,#aside-tab-badge-progress>.sr-sidebar-label-fixed i{width:1.2rem!important;min-width:1.2rem!important;text-align:center!important}
      #aside-tab-spec-vault>.sr-sidebar-pill-fixed{width:auto!important;max-width:none!important;min-height:2rem!important;flex:none!important;margin:0!important;padding:.38rem .62rem!important;white-space:nowrap!important;line-height:1!important;font-size:8.5px!important;order:initial!important}
      #aside-tab-badge-progress>.sr-sidebar-pill-fixed{width:auto!important;flex:none!important;margin:0!important;white-space:nowrap!important;line-height:1!important;order:initial!important}
    `;
    document.head.appendChild(style);
  }

  function apply() {
    queued = false;
    installFirebaseReadinessGuard();
    installStyles();
    repairCompletionCard();
    repairSpecActions();
    alignSidebar();
    syncBackToTop();
    document.documentElement.dataset.srUiRegressionFixes = VERSION;
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  document.addEventListener('click', event => {
    const topButton = event.target?.closest?.('#sr-back-to-top');
    if (topButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      scrollToTop();
      return;
    }

    const specButton = event.target?.closest?.('[data-sr-next="spec"],button[onclick*="showSpecApplyModal"]');
    if (specButton && !specState().canApply) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      toast('目前身體數據未達黃金 Spec 申請門檻。', 'info');
    }
  }, true);

  document.addEventListener('scroll', syncBackToTop, true);
  window.addEventListener('scroll', syncBackToTop, { passive: true });
  window.SRRuntime?.register(schedule);
  apply();
})();

})();



/* ===== Consolidated source: sr_frontend_entry.js ===== */
;(() => {
// SecretRoom phase-one frontend UX improvements.
(() => {
  const VERSION = '20260711-phase1-frontend-v1';
  const APP_ID = 'secretg-production-node-tw';
  const FILTER_KEY = 'sr_feed_filter';
  const SCROLL_KEY = 'sr_feed_scroll_top';
  const DRAFT_KEY = 'sr_post_draft_v1';

  const qs = id => document.getElementById(id);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char])); }
  function js(value) { return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r'); }
  function textOf(element) { return String(element?.innerText || element?.textContent || '').replace(/\s+/g, ' ').trim(); }
  function normalizeBrandAndNav() {
    const specTab = qs('aside-tab-spec-vault');
    if (specTab) {
      const main = specTab.querySelector('span:first-child');
      const pill = Array.from(specTab.querySelectorAll('span')).find(span => span !== main && /黃金|Spec|限定/i.test(textOf(span)));
      pill?.classList.add('sr-spec-nav-pill');
    }
    const badgeTab = qs('aside-tab-badge-progress');
    if (badgeTab) {
      const badge = Array.from(badgeTab.querySelectorAll('span')).find(span => /^Badge$/i.test(textOf(span)) || /徽章|進度/.test(textOf(span)));
      badge?.classList.add('sr-badge-nav-pill');
    }
  }

  function getUnreadCount() {
    const badgeText = textOf(qs('aside-notification-count') || qs('mobile-notification-count'));
    const badgeCount = Number.parseInt(badgeText, 10);
    if (Number.isFinite(badgeCount)) return badgeCount;
    const readSet = (() => {
      try { return new Set(JSON.parse(localStorage.getItem('sr_notifications_read') || '[]').map(String)); }
      catch (_) { return new Set(); }
    })();
    return (window.state?.notifications || []).filter(item => !item.revoked && !readSet.has(String(item.id || item.notificationId || ''))).length;
  }

  function openNotifications() {
    const button = qs('aside-tab-notifications') || qs('mobile-btn-notifications');
    button?.click();
  }

  function enhanceFeedHierarchy() {
    const container = qs('dashboard-tab-content');
    const list = qs('feed-posts-list');
    if (!container || !list || window.state?.currentTab !== 'feed') return;

    if (!qs('sr-feed-compose-card')) {
      const compose = document.createElement('button');
      compose.id = 'sr-feed-compose-card';
      compose.type = 'button';
      compose.dataset.srOpenShare = '1';
      compose.className = 'w-full glass-panel crystal-border rounded-3xl p-4 flex items-center gap-3 text-left';
      compose.innerHTML = `<img src="${window.state?.userData?.avatar || 'Gemini_Generated_Image_e2fxvje2fxvje2fx.jpg?v=2'}" class="w-11 h-11 rounded-full object-cover border border-amber-500/20"><span class="flex-1 min-w-0"><strong class="block text-sm text-slate-200">分享近況</strong><span class="block text-xs text-slate-500 mt-1">寫點文字，或上傳一張照片。</span></span><span class="sr-compose-action"><i class="fa-solid fa-plus"></i></span>`;
      container.insertBefore(compose, container.firstElementChild);
    }

    const unread = getUnreadCount();
    let notice = qs('sr-feed-notice-card');
    if (unread > 0 && !notice) {
      notice = document.createElement('button');
      notice.id = 'sr-feed-notice-card';
      notice.type = 'button';
      notice.className = 'w-full rounded-2xl border border-amber-500/15 bg-amber-500/5 p-3 flex items-center gap-3 text-left';
      const compose = qs('sr-feed-compose-card');
      compose?.insertAdjacentElement('afterend', notice);
    }
    if (notice) {
      notice.classList.toggle('hidden', unread <= 0);
      notice.innerHTML = `<span class="w-9 h-9 rounded-full bg-amber-500/10 text-amber-300 flex items-center justify-center"><i class="fa-solid fa-bell"></i></span><span class="flex-1"><strong class="block text-sm text-slate-200">你有 ${unread} 則未讀通知</strong><span class="block text-xs text-slate-500 mt-0.5">點一下查看審核、檢舉或平台通知。</span></span><i class="fa-solid fa-chevron-right text-amber-300"></i>`;
      notice.onclick = openNotifications;
    }

    if (!qs('sr-feed-list-heading')) {
      const heading = document.createElement('div');
      heading.id = 'sr-feed-list-heading';
      heading.className = 'flex items-center justify-between gap-3 pt-1';
      heading.innerHTML = '<div><h3 class="text-base font-black text-white">最新動態</h3><p class="text-xs text-slate-500 mt-0.5">依目前篩選顯示內容</p></div>';
      list.insertAdjacentElement('beforebegin', heading);
    }

    let loadMore = qs('sr-feed-load-more');
    if (!loadMore) {
      loadMore = document.createElement('button');
      loadMore.id = 'sr-feed-load-more';
      loadMore.type = 'button';
      loadMore.className = 'w-full sr-secondary-button mt-2';
      loadMore.textContent = '載入更多';
      list.insertAdjacentElement('afterend', loadMore);
      loadMore.onclick = () => {
        window.state.visiblePostsCount = Number(window.state.visiblePostsCount || 5) + 5;
        if (typeof window.setGlobalFilterLabel === 'function') window.setGlobalFilterLabel(window.state.currentFilter || 'recommended');
      };
    }
    loadMore.classList.toggle('hidden', Number(window.state?.visiblePostsCount || 5) >= Number(window.state?.posts?.length || 0));
  }

  function enhanceSearch() {
    const input = qs('feed-search-input');
    const overlay = qs('search-results-overlay');
    if (!input || !overlay || window.state?.currentTab !== 'feed') return;
    overlay.classList.add('sr-search-drawer');
    input.placeholder = '搜尋貼文、標籤、暱稱或帳號 ID';
    const searchBar = input.parentElement;
    if (searchBar && !qs('sr-search-clear')) {
      const clear = document.createElement('button');
      clear.id = 'sr-search-clear';
      clear.type = 'button';
      clear.className = 'sr-icon-button hidden';
      clear.setAttribute('aria-label', '清除搜尋');
      clear.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      searchBar.appendChild(clear);
      clear.onclick = () => {
        input.value = '';
        window.state.searchTerm = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        if (typeof window.setGlobalFilterLabel === 'function') window.setGlobalFilterLabel(window.state.currentFilter || 'recommended');
        input.focus();
      };
    }
    qs('sr-search-clear')?.classList.toggle('hidden', !input.value.trim());

    const accountTab = overlay.querySelector(`button[onclick*="setSearchTab('users')"]`);
    if (accountTab) {
      const count = (textOf(accountTab).match(/\d+/) || ['0'])[0];
      accountTab.textContent = `帳號 (${count})`;
    }
    const postTab = overlay.querySelector(`button[onclick*="setSearchTab('posts')"]`);
    if (postTab) {
      const count = (textOf(postTab).match(/\d+/) || ['0'])[0];
      postTab.textContent = `貼文 (${count})`;
    }
    Array.from(overlay.querySelectorAll('div')).forEach(node => {
      if (node.children.length) return;
      const text = textOf(node);
      if (/未尋得相符同好|未尋得相符帳號/.test(text)) node.innerHTML = '<i class="fa-solid fa-user-magnifying-glass block text-xl text-amber-500/50 mb-2"></i><strong class="block text-sm text-slate-300">找不到符合的帳號</strong><span class="block text-xs text-slate-500 mt-1">換個帳號 ID 或暱稱試試。</span>';
      if (/未尋得相符動態貼文/.test(text)) node.innerHTML = '<i class="fa-regular fa-file-lines block text-xl text-amber-500/50 mb-2"></i><strong class="block text-sm text-slate-300">找不到符合的貼文</strong><span class="block text-xs text-slate-500 mt-1">換個關鍵字或標籤試試。</span>';
    });
    if (!overlay.classList.contains('hidden') && !qs('sr-search-toolbar')) {
      const toolbar = document.createElement('div');
      toolbar.id = 'sr-search-toolbar';
      toolbar.className = 'flex items-center justify-between gap-3 rounded-xl border border-amber-500/10 bg-slate-950/45 px-3 py-2';
      toolbar.innerHTML = `<span class="text-xs text-slate-400 truncate">搜尋「<strong class="text-amber-300">${esc(input.value.trim())}</strong>」</span><button type="button" id="sr-search-clear-overlay" class="text-xs text-amber-300 font-black shrink-0">清除</button>`;
      overlay.insertBefore(toolbar, overlay.firstElementChild);
      qs('sr-search-clear-overlay').onclick = () => qs('sr-search-clear')?.click();
    }
  }

  function enhanceFilters() {
    const labels = {
      recommended: '推薦',
      'highly-rated': '高分',
      popular: '最多讚'
    };
    Object.entries(labels).forEach(([key, label]) => {
      const button = qs(`filter-btn-${key}`);
      if (!button) return;
      button.classList.add('sr-filter-button');
      if (!button.dataset.srRelabeled) {
        button.dataset.srRelabeled = '1';
        button.textContent = label;
      }
      if (!button.dataset.srPersistBound) {
        button.dataset.srPersistBound = '1';
        button.addEventListener('click', () => localStorage.setItem(FILTER_KEY, key), true);
      }
    });
    const filterRow = qs('filter-btn-recommended')?.parentElement;
    if (!filterRow) return;
    const saved = localStorage.getItem(FILTER_KEY);
    if (!filterRow.dataset.srFilterRestored) {
      filterRow.dataset.srFilterRestored = '1';
      if (saved && saved !== window.state?.currentFilter && typeof window.setGlobalFilter === 'function') {
        window.setGlobalFilter(saved);
      }
    }
    localStorage.setItem(FILTER_KEY, window.state?.currentFilter || 'recommended');
    if (!qs('sr-active-filter')) {
      const row = document.createElement('div');
      row.id = 'sr-active-filter';
      row.className = 'flex items-center justify-between gap-3 rounded-xl border border-amber-500/10 bg-slate-950/25 px-3 py-2';
      filterRow.insertAdjacentElement('afterend', row);
    }
    const active = window.state?.currentFilter || 'recommended';
    const activeLabel = labels[active] || active;
    qs('sr-active-filter').innerHTML = `<span class="text-xs text-slate-400">目前篩選：<strong class="text-amber-300">${esc(activeLabel)}</strong></span>${active !== 'recommended' ? '<button id="sr-clear-filter" type="button" class="text-xs font-black text-amber-300">清除篩選</button>' : ''}`;
    qs('sr-clear-filter')?.addEventListener('click', () => {
      localStorage.setItem(FILTER_KEY, 'recommended');
      window.setGlobalFilter?.('recommended');
    });
  }

  function enhanceFeedLoading() {
    const list = qs('feed-posts-list');
    if (!list || list.dataset.srSkeleton === '1') return;
    if (!/正在與俱樂部建立通道|正在載入/.test(textOf(list))) return;
    list.dataset.srSkeleton = '1';
    list.innerHTML = Array.from({ length: 2 }, () => '<div class="glass-panel crystal-border rounded-3xl p-5 animate-pulse"><div class="flex items-center gap-3"><div class="w-11 h-11 rounded-full bg-slate-800"></div><div class="flex-1"><div class="h-3 rounded bg-slate-800 w-1/3"></div><div class="h-2 rounded bg-slate-900 w-1/4 mt-2"></div></div></div><div class="h-3 rounded bg-slate-800 mt-5"></div><div class="h-3 rounded bg-slate-800 w-4/5 mt-2"></div><div class="h-40 rounded-2xl bg-slate-900 mt-4"></div></div>').join('');
  }

  function bindFeedScroll() {
    const scroll = qs('main-content-scroll');
    if (!scroll || scroll.dataset.srScrollBound === '1') return;
    scroll.dataset.srScrollBound = '1';
    const saved = Number(sessionStorage.getItem(SCROLL_KEY) || 0);
    if (window.state?.currentTab === 'feed' && saved > 0) requestAnimationFrame(() => { scroll.scrollTop = saved; });
    scroll.addEventListener('scroll', () => {
      if (window.state?.currentTab === 'feed') sessionStorage.setItem(SCROLL_KEY, String(scroll.scrollTop));
      qs('sr-back-to-top')?.classList.toggle('sr-back-to-top-visible', scroll.scrollTop > 500);
    }, { passive: true });
    if (!qs('sr-back-to-top')) {
      const button = document.createElement('button');
      button.id = 'sr-back-to-top';
      button.type = 'button';
      button.className = 'sr-back-to-top';
      button.setAttribute('aria-label', '回到頂端');
      button.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
      document.body.appendChild(button);
      button.onclick = () => scroll.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function draftRead() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); }
    catch (_) { return {}; }
  }
  function draftWrite(value) {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(value)); }
    catch (_) {}
  }

  function processImage(file, watermarkText, onProgress) {
    return new Promise((resolve, reject) => {
      if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return reject(new Error('僅支援 JPG、PNG 或 WebP。'));
      if (file.size > 8 * 1024 * 1024) return reject(new Error('單張圖片不可超過 8MB。'));
      const reader = new FileReader();
      reader.onprogress = event => { if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 45)); };
      reader.onerror = () => reject(new Error('讀取圖片失敗。'));
      reader.onload = event => {
        onProgress?.(55);
        const image = new Image();
        image.onerror = () => reject(new Error('圖片無法開啟。'));
        image.onload = () => {
          try {
            const maxDimension = 800;
            let width = image.width;
            let height = image.height;
            if (width > maxDimension || height > maxDimension) {
              const ratio = Math.min(maxDimension / width, maxDimension / height);
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d');
            context.drawImage(image, 0, 0, width, height);
            onProgress?.(75);
            const fontSize = Math.max(11, Math.round(Math.min(width, height) * 0.03));
            context.save();
            context.translate(width / 2, height / 2);
            context.rotate(Math.PI / 4);
            context.font = `600 ${fontSize}px Cinzel, Inter, sans-serif`;
            context.fillStyle = 'rgba(244,247,251,.045)';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            const stepX = Math.max(170, Math.round(fontSize * 13));
            const stepY = Math.max(110, Math.round(fontSize * 8));
            const span = Math.ceil((width + height) * 1.2);
            for (let y = -span; y <= span; y += stepY) for (let x = -span; x <= span; x += stepX) context.fillText(watermarkText, x, y);
            context.restore();
            onProgress?.(95);
            resolve(canvas.toDataURL('image/jpeg', .76));
            onProgress?.(100);
          } catch (error) { reject(error); }
        };
        image.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function openShareModal() {
    if (qs('sr-share-modal')) return;
    const draft = draftRead();
    let imageData = '';
    let selectedFile = null;
    let processing = false;
    let submitting = false;
    let dirty = !!draft.text;
    const modal = document.createElement('div');
    modal.id = 'sr-share-modal';
    modal.className = 'fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-4 bg-black/92 backdrop-blur-md';
    modal.innerHTML = `<div class="glass-panel crystal-border border border-amber-500/20 rounded-3xl p-5 sm:p-6 w-[96vw] max-w-lg max-h-[94vh] overflow-y-auto relative"><button id="sr-share-close" type="button" class="sr-icon-button absolute top-3 right-3" aria-label="關閉發文"><i class="fa-solid fa-xmark"></i></button><h3 class="text-lg font-black text-white pr-12"><i class="fa-solid fa-feather-pointed text-amber-500 mr-2"></i>分享動態</h3><p class="text-xs text-slate-400 mt-1">文字會自動存成草稿，照片處理完成後才可發布。</p><div class="space-y-4 mt-5"><div><label class="block text-xs font-black text-slate-300 mb-1.5">動態內容</label><textarea id="sr-share-text" rows="4" class="w-full bg-slate-900 border border-amber-500/10 rounded-xl px-3.5 py-3 text-sm text-white focus:outline-none focus:border-amber-500 resize-none" placeholder="分享現在的近況...">${esc(draft.text || '')}</textarea></div><div><div class="flex items-center justify-between gap-3 mb-1.5"><label class="text-xs font-black text-slate-300">照片（選填）</label><button id="sr-share-remove-image" type="button" class="hidden text-xs font-black text-rose-300 min-h-[44px]">移除照片</button></div><button id="sr-share-image-trigger" type="button" class="w-full min-h-[180px] rounded-2xl border border-dashed border-amber-500/25 bg-slate-950/60 flex items-center justify-center overflow-hidden relative"><img id="sr-share-preview" class="hidden absolute inset-0 w-full h-full object-contain"><span id="sr-share-placeholder" class="text-center text-slate-500"><i class="fa-regular fa-image text-3xl text-amber-500/60"></i><strong class="block text-sm text-slate-300 mt-2">選擇照片</strong><small class="block text-xs mt-1">JPG、PNG、WebP，最多 8MB</small></span></button><input id="sr-share-file" type="file" accept="image/jpeg,image/png,image/webp" class="hidden"><div id="sr-share-progress-wrap" class="hidden mt-3"><div class="flex items-center justify-between text-xs"><span id="sr-share-progress-text" class="text-slate-400">正在處理照片...</span><span id="sr-share-progress-number" class="text-amber-300 font-black">0%</span></div><div class="sr-upload-progress mt-2"><span id="sr-share-progress-bar"></span></div><button id="sr-share-retry-image" type="button" class="hidden sr-secondary-button mt-2 w-full">重新處理</button></div><p id="sr-share-image-status" class="text-xs text-slate-500 mt-2">上傳後會自動壓縮並加入 SecretRoom 浮水印。</p></div><label class="flex items-start gap-3 rounded-2xl border border-rose-500/15 bg-rose-500/5 p-3 cursor-pointer"><input id="sr-share-sensitive" type="checkbox" class="mt-1 w-4 h-4 accent-rose-500" ${draft.sensitive ? 'checked' : ''}><span><strong class="block text-xs text-rose-300">這是敏感照片</strong><span class="block text-xs text-slate-500 mt-1">勾選後，照片會先模糊，點一下才會顯示。</span></span></label><div><label class="block text-xs font-black text-slate-300 mb-2">主題標籤（至少一項）</label><div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto rounded-2xl border border-amber-500/10 bg-slate-950/40 p-3">${(window.state?.kinksOptions || []).map(tag => `<label class="flex items-center gap-2 min-h-[44px] rounded-xl px-2 hover:bg-slate-900/60"><input type="checkbox" name="sr-share-tag" value="${esc(tag)}" class="w-4 h-4 accent-amber-500" ${(draft.tags || []).includes(tag) ? 'checked' : ''}><span class="text-xs text-slate-300">${esc(tag)}</span></label>`).join('')}</div></div><button id="sr-share-submit" type="button" class="w-full min-h-[48px] brushed-gold crystal-border rounded-xl text-sm font-black">發布動態</button></div></div>`;
    document.body.appendChild(modal);

    const textInput = qs('sr-share-text');
    const fileInput = qs('sr-share-file');
    const preview = qs('sr-share-preview');
    const placeholder = qs('sr-share-placeholder');
    const removeButton = qs('sr-share-remove-image');
    const submitButton = qs('sr-share-submit');
    const progressWrap = qs('sr-share-progress-wrap');
    const progressText = qs('sr-share-progress-text');
    const progressNumber = qs('sr-share-progress-number');
    const progressBar = qs('sr-share-progress-bar');
    const retryButton = qs('sr-share-retry-image');
    const statusText = qs('sr-share-image-status');

    const updateDraft = () => draftWrite({
      text: textInput.value,
      sensitive: qs('sr-share-sensitive').checked,
      tags: Array.from(document.querySelectorAll('input[name="sr-share-tag"]:checked')).map(input => input.value)
    });
    const updateProgress = percent => {
      progressWrap.classList.remove('hidden');
      progressNumber.textContent = `${percent}%`;
      progressBar.style.width = `${percent}%`;
    };
    const processSelected = async () => {
      if (!selectedFile || processing) return;
      processing = true;
      retryButton.classList.add('hidden');
      progressText.textContent = '正在壓縮並加上浮水印...';
      updateProgress(0);
      try {
        const account = String(window.state?.applicationId || 'account').replace(/^@+/, '');
        imageData = await processImage(selectedFile, `SecretRoom @${account}`, updateProgress);
        preview.src = imageData;
        preview.classList.remove('hidden');
        placeholder.classList.add('hidden');
        removeButton.classList.remove('hidden');
        progressText.textContent = '照片處理完成';
        statusText.textContent = qs('sr-share-sensitive').checked ? '照片會先模糊顯示，並帶有 SecretRoom 浮水印。' : '照片會直接顯示，並帶有 SecretRoom 浮水印。';
        dirty = true;
      } catch (error) {
        console.error(error);
        imageData = '';
        progressText.textContent = error.message || '照片處理失敗';
        progressNumber.textContent = '失敗';
        progressBar.style.width = '0%';
        retryButton.classList.remove('hidden');
        window.showToast?.(error.message || '照片處理失敗，請重試。', 'error');
      } finally {
        processing = false;
      }
    };
    const close = force => {
      if (!force && dirty && !confirm('這篇動態還沒發布，要保留草稿並離開嗎？')) return;
      if (!force) updateDraft();
      window.removeEventListener('beforeunload', beforeUnload);
      modal.remove();
    };
    const beforeUnload = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);

    qs('sr-share-close').onclick = () => close(false);
    modal.addEventListener('click', event => { if (event.target === modal) close(false); });
    qs('sr-share-image-trigger').onclick = () => fileInput.click();
    fileInput.onchange = () => { selectedFile = fileInput.files?.[0] || null; if (selectedFile) processSelected(); };
    retryButton.onclick = processSelected;
    removeButton.onclick = () => {
      selectedFile = null;
      imageData = '';
      fileInput.value = '';
      preview.src = '';
      preview.classList.add('hidden');
      placeholder.classList.remove('hidden');
      removeButton.classList.add('hidden');
      progressWrap.classList.add('hidden');
      statusText.textContent = '上傳後會自動壓縮並加入 SecretRoom 浮水印。';
      dirty = true;
    };
    textInput.addEventListener('input', () => { dirty = true; updateDraft(); });
    qs('sr-share-sensitive').addEventListener('change', () => { dirty = true; updateDraft(); if (imageData) statusText.textContent = qs('sr-share-sensitive').checked ? '照片會先模糊顯示，並帶有 SecretRoom 浮水印。' : '照片會直接顯示，並帶有 SecretRoom 浮水印。'; });
    document.querySelectorAll('input[name="sr-share-tag"]').forEach(input => input.addEventListener('change', () => { dirty = true; updateDraft(); }));

    submitButton.onclick = async () => {
      if (submitting || processing) return;
      const text = textInput.value.trim();
      const tags = Array.from(document.querySelectorAll('input[name="sr-share-tag"]:checked')).map(input => input.value);
      if (!text && !imageData) return window.showToast?.('請輸入文字或選一張照片。', 'error');
      if (!tags.length) return window.showToast?.('請至少選一個主題標籤。', 'error');
      submitting = true;
      submitButton.disabled = true;
      submitButton.classList.add('opacity-60', 'cursor-not-allowed');
      submitButton.textContent = '正在發布...';
      try {
        if (!window.SRP?.tools) throw new Error('資料庫尚未連線。');
        const { db, fs } = await window.SRP.tools();
        const postRef = fs.doc(fs.collection(db, 'secretg_apps', APP_ID, 'posts'));
        await fs.setDoc(postRef, {
          userId: window.state.applicationId,
          authorName: window.state.userData?.nickname || window.state.applicationId,
          authorAvatar: window.state.userData?.avatar || '',
          text,
          image: imageData,
          isSensitive: qs('sr-share-sensitive').checked,
          kinks: tags,
          likes: {},
          likeCount: 0,
          ratings: {},
          comments: {},
          viewCount: 0,
          reports: [],
          reportCount: 0,
          createdAt: fs.serverTimestamp(),
          createdAtMs: Date.now()
        });
        localStorage.removeItem(DRAFT_KEY);
        dirty = false;
        close(true);
        window.showToast?.('動態已發布。', 'success');
      } catch (error) {
        console.error('發布動態失敗:', error);
        window.showToast?.('沒有發布成功：' + error.message, 'error');
        submitButton.disabled = false;
        submitButton.classList.remove('opacity-60', 'cursor-not-allowed');
        submitButton.textContent = '重新發布';
      } finally {
        submitting = false;
      }
    };
  }

  function markNotificationReadLocally(id) {
    if (!id) return;
    let values = [];
    try { values = JSON.parse(localStorage.getItem('sr_notifications_read') || '[]'); }
    catch (_) {}
    const set = new Set(values.map(String));
    set.add(String(id));
    localStorage.setItem('sr_notifications_read', JSON.stringify(Array.from(set).slice(-1000)));
    if (window.state) {
      if (!(window.state.notificationReadSet instanceof Set)) window.state.notificationReadSet = new Set();
      window.state.notificationReadSet.add(String(id));
    }
  }

  function parseDisplayDate(text) {
    const match = String(text || '').match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function notificationGroupLabel(date) {
    if (!date) return '更早';
    const today = new Date();
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diff = Math.round((startToday - startDate) / 86400000);
    if (diff === 0) return '今天';
    if (diff === 1) return '昨天';
    return '更早';
  }

  function enhanceNotifications() {
    const list = qs('notifications-list');
    if (!list || window.state?.currentTab !== 'notifications' || list.dataset.srGrouped === '1') return;
    const cards = Array.from(list.querySelectorAll(':scope > article.notification-item'));
    if (!cards.length) return;
    list.dataset.srGrouped = '1';
    const groups = new Map([['今天', []], ['昨天', []], ['更早', []]]);
    cards.forEach(card => {
      const dateText = textOf(card.querySelector('.font-mono span:first-child') || card.querySelector('.font-mono'));
      groups.get(notificationGroupLabel(parseDisplayDate(dateText))).push(card);
      const id = card.dataset.notificationId;
      const item = (window.state?.notifications || []).find(notification => String(notification.id || notification.notificationId || '') === String(id || ''));
      if (item?.sourceId && !card.querySelector('.sr-notification-action')) {
        const action = document.createElement('button');
        action.type = 'button';
        action.className = 'sr-notification-action sr-secondary-button mt-3';
        action.textContent = item.sourceType === 'post' ? '查看貼文' : '查看內容';
        action.onclick = event => {
          event.preventDefault();
          event.stopPropagation();
          markNotificationReadLocally(id);
          if (item.sourceType === 'post' && typeof window.viewSinglePost === 'function') window.viewSinglePost(item.sourceId);
          else if (String(item.type || '').includes('spec')) (qs('aside-tab-spec-vault') || qs('mobile-menu-spec-vault'))?.click();
          else (qs('aside-profile-trigger') || qs('mobile-tab-profile'))?.click();
        };
        card.querySelector('.min-w-0.flex-1')?.appendChild(action);
      }
    });
    list.innerHTML = '';
    groups.forEach((groupCards, label) => {
      if (!groupCards.length) return;
      const section = document.createElement('section');
      section.className = 'space-y-3';
      section.innerHTML = `<h3 class="text-xs font-black text-slate-400 tracking-wider px-1">${label}</h3>`;
      groupCards.forEach(card => section.appendChild(card));
      list.appendChild(section);
    });
  }

  function improveTextAndForms() {
    const replacements = [
      ['勾選後，大廳相片將預設以高精度毛玻璃覆蓋，點擊才會手動解密觀看。', '勾選後，照片會先模糊，點一下才會顯示。'],
      ['發布近期動態。發布相片時將自動生成淡色、較隱性的「SecretRomm @使用者帳號」滿版 45 度浮水印；若原始圖片本身已有其他浮水印，系統不會自動移除。', '發文或上傳照片時，系統會自動加上 SecretRoom 浮水印；原圖上的浮水印不會被移除。'],
      ['相片加載後將自動生成淡色、較隱性的「SecretRomm @使用者帳號」滿版 45 度浮水印；若原始圖片本身已有其他浮水印，系統不會自動移除。', '照片上傳後會自動加上 SecretRoom 浮水印；原圖上的浮水印不會被移除。']
    ];
    document.querySelectorAll('p,div,span,label').forEach(element => {
      if (element.children.length > 1) return;
      const text = textOf(element);
      const found = replacements.find(([from]) => text.includes(from));
      if (found && !element.dataset.srCopyOptimized) {
        element.dataset.srCopyOptimized = '1';
        element.textContent = text.replace(found[0], found[1]);
      }
    });
    document.querySelectorAll('textarea,input[type="text"],input[type="password"],input[type="email"],input:not([type])').forEach(element => element.classList.add('sr-readable-field'));
    document.querySelectorAll('button').forEach(button => {
      if (!textOf(button) || button.getAttribute('aria-label')) button.classList.add('sr-icon-hit');
    });
    document.querySelectorAll('.sr-watermark-grid span').forEach(span => { if (span.textContent.includes('SecretRomm')) span.textContent = span.textContent.replaceAll('SecretRomm', 'SecretRoom'); });
  }

  function installStyles() {
    if (qs('sr-phase1-frontend-style')) return;
    const style = document.createElement('style');
    style.id = 'sr-phase1-frontend-style';
    style.textContent = `
      #dashboard-tab-content button,.sr-dashboard-left button,.sr-mobile-dashboard-nav button{min-height:44px}.sr-icon-hit,.sr-icon-button{min-width:44px!important;min-height:44px!important;display:inline-flex;align-items:center;justify-content:center;border-radius:999px}.sr-icon-button{color:#cbd5e1;background:rgba(15,23,42,.72);border:1px solid rgba(245,158,11,.15)}
      #dashboard-tab-content .text-\\[9px\\],#dashboard-tab-content .text-\\[10px\\],#dashboard-tab-content .text-\\[11px\\],#search-results-overlay .text-\\[8px\\],#search-results-overlay .text-\\[10px\\],#search-results-overlay .text-\\[11px\\]{font-size:12px!important;line-height:1.45!important}.sr-readable-field{line-height:1.5!important}.text-slate-500{color:#8793a6}
      .sr-secondary-button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:.6rem .9rem;border-radius:.85rem;border:1px solid rgba(245,158,11,.18);background:rgba(15,23,42,.62);color:#fcd34d;font-size:12px;font-weight:900}.sr-status-pill{display:inline-flex;align-items:center;gap:.4rem;min-height:30px;padding:.35rem .65rem;border-radius:999px;border:1px solid rgba(148,163,184,.14);background:rgba(15,23,42,.5);color:#94a3b8;font-size:12px;font-weight:800}.sr-status-good{color:#6ee7b7;border-color:rgba(16,185,129,.2);background:rgba(16,185,129,.06)}.sr-status-warn{color:#fcd34d;border-color:rgba(245,158,11,.2);background:rgba(245,158,11,.06)}
      .sr-rank-progress,.sr-upload-progress{height:.55rem;border-radius:999px;overflow:hidden;background:rgba(15,23,42,.9);border:1px solid rgba(245,158,11,.12)}.sr-rank-progress span,.sr-upload-progress span{display:block;height:100%;width:0;border-radius:999px;background:linear-gradient(90deg,#b7791f,#fcd34d);transition:width .25s ease}.sr-rank-tier-card{padding:.8rem .6rem;border-radius:1rem;text-align:center;border:1px solid rgba(245,158,11,.1);background:rgba(2,6,23,.42)}.sr-rank-tier-current{border-color:rgba(245,158,11,.45);background:rgba(245,158,11,.09);box-shadow:0 0 20px rgba(245,158,11,.08)}.sr-rank-member{width:100%;display:flex;align-items:center;gap:.75rem;padding:.9rem;border-radius:1.25rem;border:1px solid rgba(245,158,11,.1);background:rgba(2,6,23,.35);text-align:left}.sr-rank-member-pinned{border-color:rgba(245,158,11,.35);background:rgba(245,158,11,.06)}
      #sr-feed-compose-card{transition:transform .18s ease,border-color .18s ease}#sr-feed-compose-card:hover{transform:translateY(-1px);border-color:rgba(245,158,11,.32)}.sr-compose-action{display:flex;width:44px;height:44px;align-items:center;justify-content:center;border-radius:999px;background:linear-gradient(135deg,#fcd34d,#b7791f);color:#111827}.sr-filter-button{min-width:84px}.sr-search-drawer{z-index:80!important}.sr-back-to-top{position:fixed;right:1rem;bottom:6.25rem;z-index:95;width:44px;height:44px;border-radius:999px;border:1px solid rgba(245,158,11,.25);background:rgba(2,6,23,.88);color:#fcd34d;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transform:translateY(8px);transition:.2s}.sr-back-to-top-visible{opacity:1;pointer-events:auto;transform:translateY(0)}
      @media(min-width:769px){.sr-back-to-top{bottom:1.5rem;right:22rem}}
      @media(max-width:768px){.sr-search-drawer{position:fixed!important;left:.75rem!important;right:.75rem!important;top:4.5rem!important;bottom:5.25rem!important;max-height:none!important;border-radius:1.5rem!important}.sr-rank-member{padding:.75rem;gap:.55rem}.sr-rank-member img{width:42px;height:42px}}
      @media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}}
    `;
    document.head.appendChild(style);
  }

  function applyUI() {
    scheduled = false;
    installStyles();
    normalizeBrandAndNav();
    enhanceFeedLoading();
    enhanceFeedHierarchy();
    enhanceSearch();
    enhanceFilters();
    bindFeedScroll();
    enhanceNotifications();
    improveTextAndForms();
    document.documentElement.dataset.srFrontendUi = VERSION;
  }

  let scheduled = false;
  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(applyUI);
  }

  document.addEventListener('click', event => {
    const shareButton = event.target?.closest?.('#aside-btn-share,#mobile-btn-share,[data-sr-open-share]');
    if (!shareButton) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openShareModal();
  }, true);

  window.SRRuntime?.register(scheduleApply);
  document.addEventListener('DOMContentLoaded', applyUI, { once: true });
  applyUI();
})();
})();

/* ===== Integrated rank policy and renderer ===== */
;(() => {
  if (window.__SR_RANK_POLICY_V4__) return;
  window.__SR_RANK_POLICY_V4__ = true;

  const APP_ID = 'secretg-production-node-tw';
  const VERSION = '20260716-rank-v4';
  const TOP_POSTS = 3;
  const REVIEW_CAP = 3;
  const tiers = [
    ['N.G', 0, 'from-slate-500 via-slate-400 to-slate-600'],
    ['D.G', 50, 'from-stone-300 via-amber-200 to-stone-500'],
    ['C.G', 120, 'from-slate-200 via-slate-300 to-amber-100'],
    ['B.G', 250, 'from-emerald-200 via-teal-300 to-slate-200'],
    ['A.G', 450, 'from-blue-200 via-cyan-300 to-amber-200'],
    ['S.G', 700, 'from-yellow-200 via-amber-400 to-orange-500'],
    ['S+.G', 1000, 'from-amber-200 via-yellow-300 to-amber-500'],
    ['SSR.G', 1450, 'from-violet-300 via-amber-200 to-rose-200'],
    ['Z.G', 2000, 'from-fuchsia-300 via-amber-200 to-cyan-200']
  ];

  const byId = id => document.getElementById(id);
  const floor1 = value => Math.floor((Number(value) || 0) * 10) / 10;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const js = value => String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  const currentId = () => String(window.state?.applicationId || localStorage.getItem('sr_username') || '');
  const sourcePosts = () => window.SRPhase2RawPosts?.() || window.state?.posts || [];
  const toast = (message, type = 'info') => window.showToast?.(message, type);
  const timeValue = value => value?.toDate ? value.toDate().getTime() : (value?.seconds ? Number(value.seconds) * 1000 : (Number.isFinite(Number(value)) ? Number(value) : (new Date(value || 0).getTime() || 0)));
  const weekWindow = (date = new Date()) => {
    const day = date.getDay();
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() + (day === 0 ? -6 : 1 - day), 0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    end.setMilliseconds(-1);
    return { start, end };
  };
  const tierFor = score => tiers.reduce((result, tier) => score >= tier[1] ? tier : result, tiers[0]);
  const validRatings = post => Object.entries(post.ratings || {}).flatMap(([reviewerId, raw]) => {
    const value = Number(raw);
    return reviewerId && reviewerId !== String(post.userId || '') && Number.isInteger(value) && value >= 1 && value <= 5
      ? [{ reviewerId: String(reviewerId), value }]
      : [];
  });
  const uniqueLikes = post => [...new Set(Object.entries(post.likes || {})
    .filter(([, active]) => !!active)
    .map(([id]) => String(id))
    .filter(id => id && id !== String(post.userId || '')))];

  function rankData(now = new Date()) {
    const { start, end } = weekWindow(now);
    const weeklyPosts = sourcePosts().filter(post => {
      const created = timeValue(post.createdAt || post.createdAtMs || post.timestamp);
      return created >= start.getTime() && created <= end.getTime();
    });

    const reviewerAuthorGroups = new Map();
    const allowedRatings = new Set();
    weeklyPosts.forEach(post => validRatings(post).forEach(rating => {
      const key = `${rating.reviewerId}\0${post.userId}`;
      const rows = reviewerAuthorGroups.get(key) || [];
      rows.push({ postId: String(post.id), reviewerId: rating.reviewerId, value: rating.value, time: timeValue(post.createdAt || post.createdAtMs || post.timestamp) });
      reviewerAuthorGroups.set(key, rows);
    }));
    reviewerAuthorGroups.forEach(rows => rows
      .sort((a, b) => b.value - a.value || a.time - b.time)
      .slice(0, REVIEW_CAP)
      .forEach(row => allowedRatings.add(`${row.postId}\0${row.reviewerId}`)));

    const profiles = new Map((window.state?.activeUsers || []).map(user => [String(user.id), user]));
    profiles.set(currentId(), { id: currentId(), ...(window.state?.userData || {}) });
    const authors = new Map();

    weeklyPosts.forEach(post => {
      const userId = String(post.userId || 'unknown');
      const profile = profiles.get(userId) || {};
      const ratings = validRatings(post).filter(rating => allowedRatings.has(`${String(post.id)}\0${rating.reviewerId}`));
      const ratingSum = ratings.reduce((sum, rating) => sum + rating.value, 0);
      const likes = uniqueLikes(post);
      const postScore = floor1(likes.length * 0.3 + ratingSum * 0.7 + 10);
      const author = authors.get(userId) || {
        id: userId,
        name: post.authorName || profile.nickname || userId,
        avatar: post.authorAvatar || profile.avatar || '',
        published: 0,
        items: []
      };
      author.published += 1;
      author.items.push({ score: postScore, likes: likes.length, ratingCount: ratings.length, ratingSum });
      authors.set(userId, author);
    });

    const members = [...authors.values()].map(author => {
      const chosen = [...author.items].sort((a, b) => b.score - a.score).slice(0, TOP_POSTS);
      const score = floor1(chosen.reduce((sum, post) => sum + post.score, 0));
      const likes = chosen.reduce((sum, post) => sum + post.likes, 0);
      const ratingCount = chosen.reduce((sum, post) => sum + post.ratingCount, 0);
      const ratingSum = chosen.reduce((sum, post) => sum + post.ratingSum, 0);
      return {
        ...author,
        chosen: chosen.length,
        score,
        likes,
        ratingCount,
        ratingSum,
        average: ratingCount ? ratingSum / ratingCount : 0,
        tier: tierFor(score)
      };
    }).sort((a, b) => b.score - a.score || b.likes - a.likes || b.ratingCount - a.ratingCount || a.id.localeCompare(b.id));

    return { start, end, weeklyPosts, members };
  }

  function memberCard(member, index, pinned = false) {
    return `<button type="button" class="sr-rank-member ${pinned ? 'sr-rank-member-pinned' : ''}" onclick="viewUserProfile('${js(member.id)}')"><span class="w-9 text-center font-black text-amber-300 font-luxury">#${index + 1}</span><img src="${member.avatar || 'Gemini_Generated_Image_e2fxvje2fxvje2fx.jpg?v=2'}" class="w-12 h-12 rounded-2xl object-cover border border-amber-500/20 shrink-0"><span class="min-w-0 flex-1 text-left"><span class="flex items-center gap-2 flex-wrap"><strong class="text-slate-100 truncate">${esc(member.name)}</strong><span class="text-xs text-slate-500 font-mono">@${esc(member.id)}</span></span><span class="block text-xs text-slate-500 mt-1">本週 ${member.published} 篇 · 取最高 ${member.chosen} 篇 · ${member.likes} 讚 · ${member.ratingCount} 人評星 · 平均 ${member.average.toFixed(1)} 星</span></span><span class="text-right shrink-0"><span class="inline-flex min-w-[4rem] justify-center px-3 py-2 rounded-2xl bg-gradient-to-br ${member.tier[2]} text-slate-950 font-black">${member.tier[0]}</span><strong class="block text-sm text-white mt-1">${member.score.toFixed(1)}</strong></span></button>`;
  }

  function render() {
    if (window.state?.currentTab !== 'rank') return;
    const container = byId('dashboard-tab-content');
    if (!container) return;
    if (container.dataset.srRankPolicy === VERSION && container.querySelector('[data-rank-v4]')) return;

    const data = rankData();
    const currentIndex = data.members.findIndex(member => member.id === currentId());
    const current = currentIndex < 0 ? null : data.members[currentIndex];
    const currentTier = current?.tier || tiers[0];
    const tierIndex = Math.max(0, tiers.indexOf(currentTier));
    const nextTier = tiers[tierIndex + 1] || null;
    const score = current?.score || 0;
    const progress = nextTier ? Math.max(0, Math.min(100, (score - currentTier[1]) / (nextTier[1] - currentTier[1]) * 100)) : 100;
    const nearby = tiers.slice(tierIndex, tierIndex + 3);
    const topTen = data.members.slice(0, 10);
    const pinned = currentIndex >= 10 ? current : null;
    const period = `${data.start.toLocaleDateString('zh-TW', { month:'2-digit', day:'2-digit' })}－${data.end.toLocaleDateString('zh-TW', { month:'2-digit', day:'2-digit' })}`;

    container.dataset.srRankVersion = VERSION;
    container.dataset.srRankPolicy = VERSION;
    container.innerHTML = `<div data-rank-v4 class="space-y-4"><section class="glass-panel crystal-border rounded-3xl overflow-hidden"><div class="p-5 md:p-6 border-b border-white/10"><div class="text-xs text-amber-400/80 font-black tracking-wider">本週位階</div><div class="flex items-end justify-between gap-4 mt-1"><div><h2 class="text-3xl font-black text-white">${currentTier[0]}</h2><p class="text-xs text-slate-400 mt-1">${period} · 每週一重新計算</p></div><div class="text-xs text-slate-500 text-right">依本週互動與貼文品質計算</div></div></div><div class="p-5 md:p-6"><div class="flex items-end justify-between gap-4"><div><div class="text-xs text-slate-500">目前分數</div><div class="text-4xl font-black text-white mt-1">${score.toFixed(1)}</div></div><div class="text-right text-xs"><div class="text-slate-300">${nextTier ? `距離 ${nextTier[0]} 還差 ${Math.max(0, floor1(nextTier[1] - score)).toFixed(1)} 分` : '已到最高位階'}</div><div class="text-amber-300 font-black mt-1">${Math.round(progress)}%</div></div></div><div class="sr-rank-progress mt-4"><span style="width:${progress}%"></span></div></div></section><section class="glass-panel crystal-border rounded-3xl p-5"><div class="flex items-center justify-between gap-3 mb-3"><h3 class="font-black text-white">位階門檻</h3><button id="sr-rank-all-toggle" type="button" class="sr-secondary-button">查看全部</button></div><div id="sr-rank-nearby" class="grid grid-cols-1 sm:grid-cols-3 gap-2">${nearby.map(tier => `<div class="sr-rank-tier-card ${tier === currentTier ? 'sr-rank-tier-current' : ''}"><div class="text-base font-black">${tier[0]}</div><div class="text-xs mt-1">${tier[1].toLocaleString()} 分</div></div>`).join('')}</div><div id="sr-rank-all" class="hidden grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">${tiers.map(tier => `<div class="sr-rank-tier-card ${tier === currentTier ? 'sr-rank-tier-current' : ''}"><div class="text-base font-black">${tier[0]}</div><div class="text-xs mt-1">${tier[1].toLocaleString()} 分</div></div>`).join('')}</div></section><section class="glass-panel crystal-border rounded-3xl p-5 md:p-6"><div class="mb-4"><h3 class="text-lg font-black text-white">本週排行榜</h3><p class="text-xs text-slate-500 mt-1">${data.weeklyPosts.length} 篇貼文列入計算，每位會員最多取 3 篇。</p></div><div class="space-y-3">${topTen.length ? topTen.map((member, index) => memberCard(member, index)).join('') : '<div class="text-center py-10 text-slate-500">這週還沒有人上榜</div>'}${pinned ? `<div class="pt-3 border-t border-amber-500/10"><div class="text-xs text-amber-300 mb-2">你的名次</div>${memberCard(pinned, currentIndex, true)}</div>` : ''}</div></section></div>`;

    byId('sr-rank-all-toggle')?.addEventListener('click', event => {
      const nearbyBox = byId('sr-rank-nearby');
      const allBox = byId('sr-rank-all');
      const opening = allBox?.classList.contains('hidden');
      nearbyBox?.classList.toggle('hidden', opening);
      allBox?.classList.toggle('hidden', !opening);
      event.currentTarget.textContent = opening ? '只看目前附近' : '查看全部';
    });
  }

  async function tools() {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      try { if (window.SRP?.tools) return await window.SRP.tools(); }
      catch (error) { if (!/Firebase 尚未初始化|no Firebase App/i.test(String(error?.message || error))) throw error; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('資料庫尚未連線');
  }

  function installInteractionGuards() {
    if (typeof window.ratePost === 'function' && !window.ratePost.__rankV4) {
      const rate = async (postId, rawValue) => {
        const value = Number(rawValue);
        const post = sourcePosts().find(item => String(item.id) === String(postId));
        const userId = currentId();
        if (!post) return;
        if (!Number.isInteger(value) || value < 1 || value > 5) return toast('評星只接受 1～5 星。', 'error');
        if (String(post.userId) === userId) return toast('不能替自己的貼文評星。', 'info');
        try {
const { db, fs } = await tools();
const ratings = { ...(post.ratings || {}), [userId]: value };
await fs.updateDoc(fs.doc(db, 'secretg_apps', APP_ID, 'posts', String(postId)), { ratings, ratingsUpdatedAtMs: Date.now() });
post.ratings = ratings;
toast(`已評為 ${value} 星。`, 'success');
schedule();
        } catch (error) { toast('評星失敗：' + error.message, 'error'); }
      };
      rate.__rankV4 = true;
      window.ratePost = rate;
    }

    if (typeof window.toggleLikePost === 'function' && !window.toggleLikePost.__rankV4) {
      const toggle = async postId => {
        const post = sourcePosts().find(item => String(item.id) === String(postId));
        const userId = currentId();
        if (!post) return;
        if (String(post.userId) === userId) return toast('自己的貼文不列入自我按讚。', 'info');
        try {
const { db, fs } = await tools();
const likes = { ...(post.likes || {}) };
likes[userId] ? delete likes[userId] : likes[userId] = true;
const likeCount = uniqueLikes({ ...post, likes }).length;
await fs.updateDoc(fs.doc(db, 'secretg_apps', APP_ID, 'posts', String(postId)), { likes, likeCount, likesUpdatedAtMs: Date.now() });
post.likes = likes;
post.likeCount = likeCount;
schedule();
        } catch (error) { toast('按讚失敗：' + error.message, 'error'); }
      };
      toggle.__rankV4 = true;
      window.toggleLikePost = toggle;
    }
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      installInteractionGuards();
      render();
    });
  }

  window.SRRankPolicy = Object.freeze({ version:'v4', maxPosts:TOP_POSTS, maxRatingsPerReviewerAuthor:REVIEW_CAP, tiers, data:rankData, render });
  window.SRRuntime?.register(schedule);
  schedule();
})();

/* ===== Consolidated source: sr_phase2_directory_telegram.js ===== */
;(() => {
// SecretRoom phase two: complete member directory search and Telegram binding.
(() => {
  if (window.__SR_PHASE2_DIRECTORY_TELEGRAM__) return;
  window.__SR_PHASE2_DIRECTORY_TELEGRAM__ = true;

  const APP_ID = 'secretg-production-node-tw';
  const BOT_NAME = 'SecretRoomtwBot';
  const VERSION = '20260711-phase2-directory-telegram-v4';
  const directory = new Map();
  let unsubscribe = null;
  let queued = false;
  let migrationRunning = false;

  const qs = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const currentId = () => String(window.state?.applicationId || localStorage.getItem('sr_username') || '').trim();
  const toast = (message, type = 'info') => window.showToast?.(message, type);

  async function tools() {
    if (window.SRP?.tools) return window.SRP.tools();
    const appMod = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js');
    const fs = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
    const app = appMod.getApps()[0];
    if (!app) throw new Error('Firebase 尚未初始化');
    return { db: fs.getFirestore(app), fs };
  }

  function isLegacyXBridge(info) {
    if (!info || typeof info !== 'object') return false;
    const provider = String(info.provider || '').toLowerCase();
    return provider.startsWith('x-') || provider.startsWith('x_') || Boolean(info.xHandle || info.xUserId);
  }

  function getTelegramInfo(data = {}) {
    const info = data.telegramInfo;
    return info && typeof info === 'object' && !isLegacyXBridge(info) ? info : null;
  }

  function telegramUsername(data = {}) {
    const info = getTelegramInfo(data) || {};
    return String(info.username || info.telegramUsername || info.handle || '').replace(/^@+/, '').trim();
  }

  function telegramBound(data = {}) {
    return Boolean(getTelegramInfo(data));
  }

  function minimal(id, data = {}) {
    return {
      id,
      nickname: data.nickname || data.displayName || id,
      avatar: data.avatar || '',
      status: data.status || '',
      kinks: Array.isArray(data.kinks) ? data.kinks : [],
      isSpecElite: Boolean(data.isSpecElite),
      role: data.role || '',
      isAdmin: Boolean(data.isAdmin),
      telegramInfo: getTelegramInfo(data)
    };
  }

  function includeCurrent() {
    const id = currentId();
    if (id) directory.set(id, minimal(id, window.state?.userData || {}));
  }

  async function syncDirectory() {
    if (unsubscribe || !window.state) return;
    try {
      const { db, fs } = await tools();
      const request = fs.query(
        fs.collection(db, 'secretg_apps', APP_ID, 'applications'),
        fs.where('status', 'in', ['approved', 'active'])
      );
      unsubscribe = fs.onSnapshot(request, snapshot => {
        directory.clear();
        snapshot.forEach(docSnap => directory.set(docSnap.id, minimal(docSnap.id, docSnap.data() || {})));
        includeCurrent();
        schedule();
      }, error => console.warn('帳號目錄同步失敗', error));
    } catch (error) {
      console.warn('帳號目錄無法啟動', error);
      includeCurrent();
    }
  }

  // Temporary migration only: remove compatibility data written during the retired X trial.
  async function migrateLegacySocialData() {
    if (migrationRunning || !window.state?.applicationId) return;
    const user = window.state.userData || {};
    const provider = String(user.socialBindingProvider || '').toLowerCase();
    const legacyTelegram = user.telegramInfo;
    const hasLegacyData = isLegacyXBridge(legacyTelegram) || Boolean(user.xInfo) || provider.startsWith('x');
    if (!hasLegacyData) return;

    migrationRunning = true;
    try {
      const realTelegram = telegramBound(user);
      const { db, fs } = await tools();
      const updates = {
        xInfo: null,
        socialBindingProvider: realTelegram ? 'telegram' : null,
        socialBindingUpdatedAt: fs.serverTimestamp(),
        socialBindingUpdatedAtMs: Date.now()
      };
      if (isLegacyXBridge(legacyTelegram)) updates.telegramInfo = null;
      await fs.updateDoc(fs.doc(db, 'secretg_apps', APP_ID, 'applications', currentId()), updates);
      window.state.userData = { ...user, ...updates };
      if (isLegacyXBridge(legacyTelegram)) {
        toast('已改回 Telegram 綁定，請完成 Telegram 驗證。', 'info');
        setTimeout(() => location.reload(), 350);
      }
    } catch (error) {
      console.warn('舊社群綁定資料清理失敗', error);
      migrationRunning = false;
    }
  }

  function matches(member, term) {
    const needle = term.toLocaleLowerCase('zh-TW');
    return [member.id, member.nickname, telegramUsername(member), ...(member.kinks || [])]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('zh-TW')
      .includes(needle);
  }

  function memberRow(member, compact = false) {
    const username = telegramUsername(member);
    return `<button type="button" data-sr-member-id="${esc(member.id)}" class="w-full ${compact ? 'min-h-[52px] p-2' : 'min-h-[64px] p-3'} flex items-center justify-between gap-3 bg-slate-900/60 border border-amber-500/10 rounded-2xl text-left"><span class="flex items-center gap-3 min-w-0"><img src="${esc(member.avatar || 'Gemini_Generated_Image_e2fxvje2fxvje2fx.jpg?v=2')}" class="${compact ? 'w-8 h-8' : 'w-10 h-10'} rounded-full object-cover"><span class="min-w-0"><strong class="block text-sm text-slate-200 truncate">${esc(member.nickname)}</strong><span class="block text-xs text-slate-500 font-mono">@${esc(member.id)}</span>${username ? `<span class="block text-[11px] text-sky-300">Telegram @${esc(username)}</span>` : ''}</span></span><i class="fa-solid fa-chevron-right text-amber-400/70"></i></button>`;
  }

  function renderSearch() {
    const input = qs('feed-search-input');
    const overlay = qs('search-results-overlay');
    if (!input || !overlay || overlay.classList.contains('hidden')) return;
    const term = input.value.trim();
    if (!term) return;

    includeCurrent();
    const rows = Array.from(directory.values()).filter(member => matches(member, term)).slice(0, 40);
    const tab = overlay.querySelector(`button[onclick*="setSearchTab('users')"]`);
    if (tab && tab.textContent !== `帳號 (${rows.length})`) tab.textContent = `帳號 (${rows.length})`;

    let preview = overlay.querySelector('#sr-account-match-preview');
    if (rows.length) {
      if (!preview) {
        preview = document.createElement('section');
        preview.id = 'sr-account-match-preview';
        preview.className = 'rounded-2xl border border-sky-500/15 bg-sky-500/5 p-3';
        tab?.parentElement?.insertAdjacentElement('afterend', preview);
      }
      const key = `${term}:${rows.slice(0, 3).map(row => row.id).join('|')}`;
      if (preview.dataset.key !== key) {
        preview.dataset.key = key;
        preview.innerHTML = `<div class="flex items-center justify-between gap-3 mb-2"><strong class="text-xs text-sky-300">符合的帳號</strong><button type="button" id="sr-view-all-account-results" class="text-xs text-amber-300 font-black">查看全部 ${rows.length} 個</button></div><div class="space-y-2">${rows.slice(0, 3).map(member => memberRow(member, true)).join('')}</div>`;
        preview.querySelector('#sr-view-all-account-results').onclick = () => window.setSearchTab?.('users');
      }
    } else {
      preview?.remove();
    }

    if (window.state?.searchTab !== 'users') return;
    const list = overlay.querySelector('.overflow-y-auto');
    if (!list) return;
    const key = `${term}:${rows.map(row => row.id).join('|')}`;
    if (list.dataset.srDirectoryKey === key) return;
    list.dataset.srDirectoryKey = key;
    list.innerHTML = rows.length
      ? rows.map(member => memberRow(member)).join('')
      : '<div class="py-8 text-center text-slate-500"><i class="fa-solid fa-user-magnifying-glass text-2xl text-amber-500/50"></i><strong class="block text-sm text-slate-300 mt-3">找不到符合的帳號</strong><span class="block text-xs mt-1">可搜尋帳號 ID、暱稱或 Telegram 帳號。</span></div>';
  }

  window.SRTelegramBound = data => telegramBound(data || window.state?.userData || {});
  window.SROpenTelegramBinding = () => {
    const user = window.state?.userData || {};
    if (telegramBound(user)) {
      window.open(`https://t.me/${BOT_NAME}`, '_blank', 'noopener,noreferrer');
      return;
    }
    if (window.state) window.state.currentView = 'telegram-bind';
    if (typeof window.renderApp === 'function') window.renderApp();
    else location.reload();
  };

  window.SRPhase2OpenProfile = id => {
    const member = directory.get(String(id));
    if (member && window.state) {
      const list = Array.isArray(window.state.activeUsers) ? [...window.state.activeUsers] : [];
      if (!list.some(item => item.id === member.id)) list.push(member);
      window.state.activeUsers = list;
    }
    window.viewUserProfile?.(String(id));
  };

  function apply() {
    queued = false;
    syncDirectory();
    migrateLegacySocialData();
    renderSearch();
    document.documentElement.dataset.srPhase2DirectoryTelegram = VERSION;
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  document.addEventListener('click', event => {
    const row = event.target?.closest?.('[data-sr-member-id]');
    if (!row) return;
    event.preventDefault();
    event.stopPropagation();
    window.SRPhase2OpenProfile(row.dataset.srMemberId);
  }, true);
  document.addEventListener('input', event => {
    if (event.target?.id === 'feed-search-input') setTimeout(schedule, 170);
  }, true);
  window.SRRuntime?.register(schedule);
  apply();
})();

})();

/* ===== Consolidated source: sr_phase3_feed_safety.js ===== */
;(() => {
// SecretRoom phase three: feed-only hiding, restore controls and Badge next steps.
(() => {
  if (window.__SR_PHASE3_FEED_SAFETY__) return;
  window.__SR_PHASE3_FEED_SAFETY__ = true;

  const APP_ID = 'secretg-production-node-tw';
  const VERSION = '20260711-phase3-feed-safety-v2';
  let queued = false;
  let normalizedPosts = false;

  const qs = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const toast = (message, type = 'info') => window.showToast?.(message, type);
  const currentId = () => String(window.state?.applicationId || localStorage.getItem('sr_username') || '');
  const telegramBound = user => typeof window.SRTelegramBound === 'function'
    ? window.SRTelegramBound(user || window.state?.userData || {})
    : Boolean((user || window.state?.userData || {}).telegramInfo);

  async function tools() {
    if (window.SRP?.tools) return window.SRP.tools();
    const appMod = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js');
    const fs = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
    const app = appMod.getApps()[0];
    if (!app) throw new Error('Firebase 尚未初始化');
    return { db: fs.getFirestore(app), fs };
  }

  function fullPosts() {
    return Array.isArray(window.state?.posts) ? window.state.posts : [];
  }

  function normalizePostState() {
    if (normalizedPosts || !window.state) return;
    const descriptor = Object.getOwnPropertyDescriptor(window.state, 'posts');
    if (descriptor?.get && typeof window.SRPhase2RawPosts === 'function') {
      const raw = window.SRPhase2RawPosts();
      Object.defineProperty(window.state, 'posts', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: Array.isArray(raw) ? raw : []
      });
    }
    window.SRPhase2RawPosts = () => [...fullPosts()];
    normalizedPosts = true;
  }

  function preferences() {
    const user = window.state?.userData || {};
    return {
      hidden: new Set((user.hiddenPostIds || []).map(String)),
      blocked: new Set((user.blockedUserIds || []).map(String))
    };
  }

  async function saveList(field, value, enabled) {
    const id = currentId();
    if (!id) throw new Error('找不到目前登入帳號。');
    const values = new Set((window.state?.userData?.[field] || []).map(String));
    enabled ? values.add(String(value)) : values.delete(String(value));
    const next = [...values];
    const { db, fs } = await tools();
    await fs.updateDoc(fs.doc(db, 'secretg_apps', APP_ID, 'applications', id), {
      [field]: next,
      safetyUpdatedAt: fs.serverTimestamp(),
      safetyUpdatedAtMs: Date.now()
    });
    window.state.userData = { ...(window.state.userData || {}), [field]: next };
    schedule();
  }

  function postIdFromCard(card) {
    if (card.dataset.postId) return card.dataset.postId;
    const handlers = [...card.querySelectorAll('[onclick]')].map(node => node.getAttribute('onclick') || '').join(' ');
    const match = handlers.match(/(?:viewSinglePost|openReportModal|toggleLike|deleteMyPost|deletePost)\(['"]([^'"]+)['"]/);
    if (match) card.dataset.postId = match[1];
    return match?.[1] || '';
  }

  function suppressDuplicateComposer() {
    const composer = qs('sr-feed-compose-card');
    if (!composer) return;
    composer.classList.add('hidden');
    composer.setAttribute('aria-hidden', 'true');
    composer.tabIndex = -1;
  }

  function applyFeedVisibility() {
    if (window.state?.currentTab !== 'feed') return;
    const prefs = preferences();
    const postMap = new Map(fullPosts().map(post => [String(post.id || ''), post]));
    qs('feed-posts-list')?.querySelectorAll(':scope > article, :scope > div').forEach(card => {
      const postId = postIdFromCard(card);
      if (!postId) return;
      const post = postMap.get(postId);
      const hidden = prefs.hidden.has(postId) || (post && prefs.blocked.has(String(post.userId || '')));
      card.classList.toggle('hidden', hidden);
      card.setAttribute('aria-hidden', hidden ? 'true' : 'false');
    });
  }

  function hiddenPostRows() {
    const prefs = preferences();
    return fullPosts().filter(post => prefs.hidden.has(String(post.id || '')));
  }

  function openManager() {
    qs('sr-safety-manager')?.remove();
    const prefs = preferences();
    const hidden = hiddenPostRows();
    const blocked = [...prefs.blocked];
    const modal = document.createElement('div');
    modal.id = 'sr-safety-manager';
    modal.className = 'fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md';
    modal.innerHTML = `<section class="glass-panel crystal-border w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-amber-500/20 p-5 sm:p-6"><div class="flex items-start justify-between gap-3"><div><div class="text-xs text-amber-300 font-black">內容管理</div><h2 class="text-xl text-white font-black mt-1">隱藏與封鎖</h2><p class="text-xs text-slate-500 mt-1">隱藏只影響你的動態畫面，不會改變位階分數。</p></div><button id="sr-safety-manager-close" class="w-11 h-11 rounded-full border border-slate-700 text-slate-300" aria-label="關閉"><i class="fa-solid fa-xmark"></i></button></div><section class="mt-5"><h3 class="text-sm text-white font-black">已隱藏貼文（${hidden.length}）</h3><div class="space-y-2 mt-3">${hidden.length ? hidden.map(post => `<div class="rounded-2xl border border-slate-800 bg-slate-950/55 p-3 flex items-start justify-between gap-3"><div class="min-w-0"><div class="text-xs text-slate-300 font-black truncate">${esc(post.authorName || post.userId || '帳號')}</div><p class="text-xs text-slate-500 mt-1 line-clamp-2">${esc(post.text || '圖片貼文')}</p></div><button data-restore-post="${esc(post.id)}" class="min-h-[40px] px-3 rounded-xl border border-emerald-500/20 text-emerald-300 text-xs font-black shrink-0">恢復</button></div>`).join('') : '<div class="rounded-2xl border border-slate-800 p-4 text-xs text-slate-500">目前沒有隱藏貼文。</div>'}</div></section><section class="mt-5"><h3 class="text-sm text-white font-black">已封鎖帳號（${blocked.length}）</h3><div class="space-y-2 mt-3">${blocked.length ? blocked.map(id => `<div class="rounded-2xl border border-slate-800 bg-slate-950/55 p-3 flex items-center justify-between gap-3"><span class="text-sm text-slate-300 font-mono">@${esc(id)}</span><button data-unblock-account="${esc(id)}" class="min-h-[40px] px-3 rounded-xl border border-emerald-500/20 text-emerald-300 text-xs font-black">解除封鎖</button></div>`).join('') : '<div class="rounded-2xl border border-slate-800 p-4 text-xs text-slate-500">目前沒有封鎖帳號。</div>'}</div></section></section>`;
    document.body.appendChild(modal);
    qs('sr-safety-manager-close').onclick = () => modal.remove();
    modal.addEventListener('click', event => { if (event.target === modal) modal.remove(); });
    modal.querySelectorAll('[data-restore-post]').forEach(button => button.onclick = async () => {
      button.disabled = true;
      try {
        await saveList('hiddenPostIds', button.dataset.restorePost, false);
        toast('貼文已恢復到動態。', 'success');
        openManager();
        window.setGlobalFilter?.(window.state?.currentFilter || 'recommended');
      } catch (error) {
        toast('無法恢復貼文：' + error.message, 'error');
        button.disabled = false;
      }
    });
    modal.querySelectorAll('[data-unblock-account]').forEach(button => button.onclick = async () => {
      button.disabled = true;
      try {
        await saveList('blockedUserIds', button.dataset.unblockAccount, false);
        toast(`已解除封鎖 @${button.dataset.unblockAccount}`, 'success');
        openManager();
        window.setGlobalFilter?.(window.state?.currentFilter || 'recommended');
      } catch (error) {
        toast('無法解除封鎖：' + error.message, 'error');
        button.disabled = false;
      }
    });
  }

  function addProfileManager() {
    if (window.state?.currentTab !== 'profile') return;
    const root = qs('dashboard-tab-content');
    if (!root || qs('sr-safety-manager-card')) return;
    const prefs = preferences();
    const card = document.createElement('section');
    card.id = 'sr-safety-manager-card';
    card.className = 'glass-panel crystal-border rounded-3xl p-5 border border-slate-700/60 mb-4';
    card.innerHTML = `<div class="flex items-center justify-between gap-4"><div><div class="text-xs text-slate-400 font-black">內容管理</div><h3 class="text-lg text-white font-black mt-1">隱藏與封鎖</h3><p class="text-xs text-slate-500 mt-1">${prefs.hidden.size} 篇隱藏貼文 · ${prefs.blocked.size} 個封鎖帳號</p></div><button id="sr-open-safety-manager" class="min-h-[44px] px-4 rounded-xl border border-amber-500/20 text-amber-300 text-xs font-black">管理</button></div>`;
    root.insertBefore(card, root.firstElementChild);
    qs('sr-open-safety-manager').onclick = openManager;
  }

  function addHideButtons() {
    if (window.state?.currentTab !== 'feed') return;
    qs('feed-posts-list')?.querySelectorAll(':scope > article, :scope > div').forEach(card => {
      if (card.dataset.srPhase3HideAction === '1') return;
      const postId = postIdFromCard(card);
      if (!postId) return;

      const primaryAction = card.querySelector('button[onclick*="deleteMyPost"],button[onclick*="openReportModal"]');
      if (!primaryAction) return;

      card.dataset.srPhase3HideAction = '1';
      let actionGroup = primaryAction.closest('[data-sr-post-actions]');
      if (!actionGroup) {
        actionGroup = document.createElement('div');
        actionGroup.dataset.srPostActions = '1';
        actionGroup.className = 'flex items-center gap-3 shrink-0';
        primaryAction.parentElement?.insertBefore(actionGroup, primaryAction);
        actionGroup.appendChild(primaryAction);
      }

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'text-slate-550 hover:text-sky-300 transition text-xs sm:text-sm click-press';
      button.title = '隱藏這篇';
      button.setAttribute('aria-label', '隱藏這篇');
      button.innerHTML = '<i class="fa-regular fa-eye-slash"></i>';
      button.onclick = async event => {
        event.preventDefault();
        event.stopPropagation();
        try {
          await saveList('hiddenPostIds', postId, true);
          toast('這篇貼文已隱藏，可從個人頁恢復。', 'success');
          applyFeedVisibility();
        } catch (error) {
          toast('無法隱藏貼文：' + error.message, 'error');
        }
      };
      actionGroup.insertBefore(button, primaryAction);
    });
  }

  function addBlockButton() {
    if (window.state?.currentTab !== 'other-profile') return;
    const target = String(window.state?.viewTargetUserId || '');
    const root = qs('dashboard-tab-content');
    if (!target || !root || qs('sr-phase3-block-account')) return;
    const blocked = preferences().blocked.has(target);
    const button = document.createElement('button');
    button.id = 'sr-phase3-block-account';
    button.className = `w-full min-h-[44px] rounded-xl border ${blocked ? 'border-emerald-500/20 text-emerald-300' : 'border-rose-500/20 text-rose-300'} text-xs font-black mb-4`;
    button.textContent = blocked ? `解除封鎖 @${target}` : `封鎖 @${target}`;
    root.insertBefore(button, root.firstElementChild);
    button.onclick = async () => {
      try {
        await saveList('blockedUserIds', target, !blocked);
        toast(blocked ? `已解除封鎖 @${target}` : `已封鎖 @${target}`, 'success');
        (qs('aside-tab-feed') || qs('mobile-tab-feed'))?.click();
      } catch (error) {
        toast('封鎖設定失敗：' + error.message, 'error');
      }
    };
  }

  function addBadgeSteps() {
    if (window.state?.currentTab !== 'badge-progress') return;
    const root = qs('dashboard-tab-content');
    if (!root || qs('sr-phase3-badge-steps')) return;
    const user = window.state?.userData || {};
    const ownPosts = fullPosts().filter(post => String(post.userId || '') === currentId());
    const steps = [];
    if (!user.avatar) steps.push(['profile', '補上大頭照']);
    if (!telegramBound(user)) steps.push(['telegram', '完成 Telegram 綁定']);
    if (!ownPosts.length) steps.push(['post', '發布第一篇貼文']);
    if (!user.isSpecElite && user.specEliteStatus !== 'pending') steps.push(['spec', '申請黃金 Spec']);
    const card = document.createElement('section');
    card.id = 'sr-phase3-badge-steps';
    card.className = 'glass-panel crystal-border rounded-3xl p-5 mb-4 border border-amber-500/15';
    card.innerHTML = `<div class="text-xs text-amber-300 font-black">下一步</div><h3 class="text-lg text-white font-black mt-1">${steps.length ? '完成這些項目可解鎖更多功能' : '目前主要項目都完成了'}</h3><div class="flex flex-wrap gap-2 mt-4">${steps.map(([action, label]) => `<button data-sr-next="${action}" class="min-h-[44px] px-4 rounded-xl border border-amber-500/20 text-amber-300 text-xs font-black">${label}</button>`).join('')}</div>`;
    root.insertBefore(card, root.firstElementChild);
    card.querySelectorAll('[data-sr-next]').forEach(button => button.onclick = () => {
      const action = button.dataset.srNext;
      if (action === 'profile') (qs('aside-profile-trigger') || qs('mobile-tab-profile'))?.click();
      if (action === 'telegram') window.SROpenTelegramBinding?.();
      if (action === 'post') (qs('aside-btn-share') || qs('mobile-btn-share'))?.click();
      if (action === 'spec') window.showSpecApplyModal?.();
    });
  }

  function installStyles() {
    if (qs('sr-phase3-feed-safety-style')) return;
    const style = document.createElement('style');
    style.id = 'sr-phase3-feed-safety-style';
    style.textContent = '#sr-feed-compose-card{display:none!important}';
    document.head.appendChild(style);
  }

  function apply() {
    queued = false;
    installStyles();
    normalizePostState();
    suppressDuplicateComposer();
    addHideButtons();
    applyFeedVisibility();
    addProfileManager();
    addBlockButton();
    addBadgeSteps();
    document.documentElement.dataset.srPhase3FeedSafety = VERSION;
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  window.SRRuntime?.register(schedule);
  apply();
})();

})();

/* ===== Consolidated source: sr_phase2_onboarding.js ===== */
;(() => {
// SecretRoom phase two: onboarding and profile completion.
(() => {
  if (window.__SR_PHASE2_ONBOARDING__) return;
  window.__SR_PHASE2_ONBOARDING__ = true;

  const VERSION = '20260712-phase2-onboarding-telegram-v4';
  const KEY = 'sr_phase2_onboarding_dismissed';
  let queued = false;
  const qs = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const ownPosts = () => {
    const posts = window.SRPhase2RawPosts?.() || window.state?.posts || [];
    const id = String(window.state?.applicationId || '');
    return posts.filter(post => String(post.userId) === id);
  };
  const telegramBound = () => typeof window.SRTelegramBound === 'function'
    ? Boolean(window.SRTelegramBound())
    : false;

  function progress() {
    const user = window.state?.userData || {};
    const items = [
      ['profile', '基本資料', Boolean(user.nickname && user.email && Array.isArray(user.kinks) && user.kinks.length)],
      ['avatar', '大頭照', Boolean(user.avatar)],
      ['telegram', '啟用 Telegram 通知', telegramBound()],
      ['post', '第一篇貼文', ownPosts().length > 0],
      ['notifications', '查看通知', localStorage.getItem('sr_phase2_notifications_seen') === '1'],
      ['safety', '安全設定', localStorage.getItem('sr_phase2_safety_seen') === '1']
    ].map(([key, label, done]) => ({ key, label, done }));
    const done = items.filter(item => item.done).length;
    return { items, done, percent: Math.round(done / items.length * 100) };
  }

  function profileProgress() {
    const user = window.state?.userData || {};
    const items = [
      ['profile', '基本資料', Boolean(user.nickname && user.email && Array.isArray(user.kinks) && user.kinks.length)],
      ['avatar', '大頭照', Boolean(user.avatar)]
    ].map(([key, label, done]) => ({ key, label, done }));
    const done = items.filter(item => item.done).length;
    return { items, done, percent: Math.round(done / items.length * 100) };
  }

  function clickFirst(ids) {
    for (const id of ids) {
      const node = qs(id);
      if (node) { node.click(); return; }
    }
  }

  function action(name) {
    if (name === 'profile' || name === 'avatar') clickFirst(['aside-profile-trigger', 'mobile-tab-profile']);
    if (name === 'telegram') window.SROpenTelegramBinding?.();
    if (name === 'post') clickFirst(['aside-btn-share', 'mobile-btn-share']);
    if (name === 'notifications') {
      localStorage.setItem('sr_phase2_notifications_seen', '1');
      clickFirst(['aside-tab-notifications', 'mobile-btn-notifications']);
    }
    if (name === 'safety') {
      localStorage.setItem('sr_phase2_safety_seen', '1');
      window.showToast?.('可從個人頁的「隱藏與封鎖」管理已隱藏內容。', 'info');
      schedule();
    }
  }

  function renderOnboarding() {
    const existing = qs('sr-phase2-onboarding');
    if (window.state?.currentTab !== 'feed' || localStorage.getItem(KEY) === '1') {
      existing?.remove();
      return;
    }
    const root = qs('dashboard-tab-content');
    if (!root) return;
    const current = progress();
    if (current.percent >= 100) {
      existing?.remove();
      return;
    }
    if (existing) return;
    const card = document.createElement('section');
    card.id = 'sr-phase2-onboarding';
    card.className = 'glass-panel crystal-border rounded-3xl p-5 border border-cyan-500/15';
    card.innerHTML = `<div class="flex items-start justify-between gap-3"><div><div class="text-xs text-cyan-300 font-black">新帳號導覽</div><h3 class="text-lg text-white font-black mt-1">完成你的 SecretRoom 設定</h3><p class="text-xs text-slate-500 mt-1">已完成 ${current.done}/${current.items.length} 項。</p></div><button id="sr-onboarding-dismiss" class="w-10 h-10 rounded-full border border-slate-700 text-slate-400"><i class="fa-solid fa-xmark"></i></button></div><div class="h-2 rounded-full bg-slate-900 overflow-hidden mt-4"><span class="block h-full bg-gradient-to-r from-cyan-500 to-amber-400" style="width:${current.percent}%"></span></div><div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">${current.items.map(item => `<button data-sr-onboard="${item.key}" class="min-h-[44px] rounded-xl border ${item.done ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300' : 'border-slate-800 bg-slate-950/45 text-slate-300'} text-left px-3 text-xs font-black"><i class="fa-solid ${item.done ? 'fa-circle-check' : 'fa-circle'} mr-2"></i>${esc(item.label)}</button>`).join('')}</div>`;
    root.insertBefore(card, root.firstElementChild);
    qs('sr-onboarding-dismiss').onclick = () => { localStorage.setItem(KEY, '1'); card.remove(); };
    card.querySelectorAll('[data-sr-onboard]').forEach(button => button.onclick = () => action(button.dataset.srOnboard));
  }

  function renderProfile() {
    const existing = qs('sr-profile-completion');
    if (window.state?.currentTab !== 'profile') {
      existing?.remove();
      return;
    }
    const root = qs('dashboard-tab-content');
    if (!root) return;
    const current = profileProgress();
    if (current.percent >= 100) {
      existing?.remove();
      return;
    }
    if (existing) return;
    const bound = telegramBound();
    const card = document.createElement('section');
    card.id = 'sr-profile-completion';
    card.className = 'glass-panel crystal-border rounded-3xl p-5 border border-cyan-500/15 mb-4';
    card.innerHTML = `<div class="flex items-center justify-between gap-4"><div><div class="text-xs text-cyan-300 font-black">資料完成度</div><div class="text-2xl text-white font-black mt-1">${current.percent}%</div></div><div class="flex gap-2"><button id="sr-profile-edit-shortcut" class="min-h-[44px] px-4 rounded-xl border border-amber-500/20 text-amber-300 text-xs font-black">編輯資料</button><button id="sr-profile-telegram-shortcut" class="min-h-[44px] px-4 rounded-xl bg-[#229ED9] text-white text-xs font-black">${bound ? '開啟 Telegram' : '綁定 Telegram'}</button></div></div><div class="h-2 rounded-full bg-slate-900 overflow-hidden mt-4"><span class="block h-full bg-gradient-to-r from-cyan-500 to-amber-400" style="width:${current.percent}%"></span></div><div class="flex flex-wrap gap-2 mt-3">${current.items.map(item => `<span class="px-2.5 py-1 rounded-full text-[11px] border ${item.done ? 'border-emerald-500/20 text-emerald-300' : 'border-slate-700 text-slate-500'}">${item.done ? '✓' : '○'} ${esc(item.label)}</span>`).join('')}</div>`;
    root.insertBefore(card, root.firstElementChild);
    qs('sr-profile-edit-shortcut').onclick = () => window.showProfileEditModal?.();
    qs('sr-profile-telegram-shortcut').onclick = () => window.SROpenTelegramBinding?.();
  }

  function style() {
    if (qs('sr-phase2-onboarding-style')) return;
    const sheet = document.createElement('style');
    sheet.id = 'sr-phase2-onboarding-style';
    sheet.textContent = '@media(max-width:640px){#sr-profile-completion>.flex{align-items:flex-start;flex-direction:column}#sr-profile-completion>.flex>div:last-child{width:100%;display:grid;grid-template-columns:1fr 1fr}}';
    document.head.appendChild(sheet);
  }

  function apply() {
    queued = false;
    style();
    renderOnboarding();
    renderProfile();
    if (window.state?.currentTab === 'notifications') localStorage.setItem('sr_phase2_notifications_seen', '1');
    document.documentElement.dataset.srPhase2Onboarding = VERSION;
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  window.SRRuntime?.register(schedule);
  apply();
})();

})();

/* ===== SecretRoom Telegram Phase 2 member integration ===== */
;(() => {
  if (window.__SR_TELEGRAM_PHASE2_MEMBER__) return;
  window.__SR_TELEGRAM_PHASE2_MEMBER__ = true;

  const APP_ID = 'secretg-production-node-tw';
  const BOT_USERNAME = 'SecretRoomtwBot';
  const TOKEN_TTL_MS = 10 * 60 * 1000;
  const REFRESH_MS = 15000;
  const DEFAULT_PREFERENCES = Object.freeze({
    securityNotifications: true,
    reviewNotifications: true,
    avatarNotifications: true,
    specNotifications: true,
    passwordNotifications: true,
    accountNotifications: true,
    platformNotifications: true,
    rankNotifications: true,
    socialNotifications: false,
    digestMode: 'instant'
  });

  let toolsPromise = null;
  let lastSnapshot = null;
  let lastSnapshotAt = 0;
  let pollingTimer = null;
  let wrappedPasswordMail = false;
  let busy = false;
  let modalRequestId = 0;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const accountId = () => String(window.state?.applicationId || localStorage.getItem('sr_username') || '').trim();
  const isMemberArea = () => ['pending', 'dashboard', 'telegram-bind'].includes(String(window.state?.currentView || ''));
  const isDashboard = () => String(window.state?.currentView || '') === 'dashboard';
  const hasActiveBinding = snapshot => {
    const binding = snapshot?.binding;
    return Boolean(
      binding &&
      String(binding.status || '').toLowerCase() === 'active' &&
      String(binding.telegramUserId || '').trim() &&
      String(binding.telegramChatId || '').trim()
    );
  };
  const hasTelegramIdentity = snapshot => {
    const member = snapshot?.member || {};
    return Boolean(
      member.telegramIdentityVerified === true ||
      member.telegramInfo?.id ||
      member.telegramUserId ||
      member.telegramUsername
    );
  };
  const telegramServiceState = snapshot => hasActiveBinding(snapshot)
    ? 'active'
    : (hasTelegramIdentity(snapshot) ? 'identity_verified' : 'none');
  const toast = (message, type = 'info') => window.showToast?.(message, type);

  async function tools() {
    if (!toolsPromise) {
      toolsPromise = Promise.all([
        import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js')
      ]).then(([appModule, fs]) => {
        const app = appModule.getApps()[0];
        if (!app) throw new Error('Firebase 尚未初始化');
        return { db: fs.getFirestore(app), fs };
      });
    }
    return toolsPromise;
  }

  function randomToken() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function preferenceLabel(key) {
    return ({
      reviewNotifications: '會籍審核',
      avatarNotifications: '頭像審核',
      specNotifications: '黃金 Spec',
      passwordNotifications: '密碼與登入',
      accountNotifications: '帳號狀態',
      platformNotifications: '平台公告',
      rankNotifications: '位階與排名',
      socialNotifications: '按讚與互動'
    })[key] || key;
  }

  async function normalizeTelegramIdentity(snapshot, db, fs) {
    if (!snapshot || hasActiveBinding(snapshot)) return snapshot;
    const member = snapshot.member || {};
    const identityVerified = hasTelegramIdentity(snapshot);
    const normalized = {
      telegramBound: false,
      telegramChatId: null,
      telegramLinkStatus: identityVerified ? 'identity_verified' : 'unbound',
      telegramIdentityVerified: identityVerified,
      telegramServiceState: identityVerified ? 'identity_verified' : 'none',
      telegramStateNormalizedAtMs: Date.now()
    };
    try {
      await fs.setDoc(fs.doc(db, 'secretg_apps', APP_ID, 'applications', snapshot.id), normalized, { merge: true });
    } catch (error) {
      console.warn('無法同步 Telegram 三段狀態，但介面仍以正式 binding 與身分資料判斷:', error);
    }
    snapshot.member = { ...member, ...normalized };
    if (String(window.state?.applicationId || '') === snapshot.id) {
      window.state.userData = { ...(window.state?.userData || {}), ...normalized };
    }
    return snapshot;
  }

  async function loadSnapshot(force = false) {
    const id = accountId();
    if (!id) return null;
    if (!force && lastSnapshot && Date.now() - lastSnapshotAt < REFRESH_MS) return lastSnapshot;
    const { db, fs } = await tools();
    const [memberSnap, bindingSnap, preferenceSnap] = await Promise.all([
      fs.getDoc(fs.doc(db, 'secretg_apps', APP_ID, 'applications', id)),
      fs.getDoc(fs.doc(db, 'secretg_apps', APP_ID, 'telegram_bindings', id)),
      fs.getDoc(fs.doc(db, 'secretg_apps', APP_ID, 'telegram_preferences', id))
    ]);
    const member = memberSnap.exists() ? memberSnap.data() : {};
    const binding = bindingSnap.exists() ? bindingSnap.data() : null;
    const preferences = { ...DEFAULT_PREFERENCES, ...(preferenceSnap.exists() ? preferenceSnap.data() : {}) };
    const snapshot = { id, member, binding, preferences };
    await normalizeTelegramIdentity(snapshot, db, fs);
    lastSnapshot = snapshot;
    lastSnapshotAt = Date.now();
    return lastSnapshot;
  }

  async function reconcileLegacyFields(snapshot) {
    if (!hasActiveBinding(snapshot)) return;
    const member = snapshot.member || {};
    if (member.telegramInfo?.id && member.telegramBound === true) return;
    const { db, fs } = await tools();
    const telegramInfo = {
      id: String(snapshot.binding.telegramUserId || ''),
      username: String(snapshot.binding.telegramUsername || ''),
      first_name: String(snapshot.binding.telegramFirstName || '')
    };
    await fs.setDoc(fs.doc(db, 'secretg_apps', APP_ID, 'applications', snapshot.id), {
      telegramBound: true,
      telegramUserId: telegramInfo.id,
      telegramChatId: String(snapshot.binding.telegramChatId || ''),
      telegramUsername: telegramInfo.username,
      telegramInfo,
      telegramLinkedAtMs: Number(snapshot.binding.linkedAtMs || Date.now())
    }, { merge: true });
    window.state.userData = { ...(window.state.userData || {}), telegramBound: true, telegramInfo, telegramUserId: telegramInfo.id };
    snapshot.member = window.state.userData;
  }

  async function generateBindingLink() {
    if (busy) return;
    busy = true;
    try {
      const id = accountId();
      if (!id) throw new Error('請先登入 SecretRoom');
      const { db, fs } = await tools();
      const memberRef = fs.doc(db, 'secretg_apps', APP_ID, 'applications', id);
      const memberSnap = await fs.getDoc(memberRef);
      if (!memberSnap.exists()) throw new Error('找不到會員資料');
      const member = memberSnap.data() || {};
      if (!['pending', 'approved', 'active'].includes(String(member.status || '').toLowerCase())) throw new Error('目前帳號狀態無法建立 Telegram 綁定');

      const previousToken = String(member.telegramLastLinkToken || '');
      if (previousToken) {
        try {
          await fs.setDoc(fs.doc(db, 'secretg_apps', APP_ID, 'telegram_link_tokens', previousToken), {
            status: 'revoked', revokedAtMs: Date.now(), revokedBy: id
          }, { merge: true });
        } catch (_) {}
      }

      const token = randomToken();
      const expiresAtMs = Date.now() + TOKEN_TTL_MS;
      await fs.setDoc(fs.doc(db, 'secretg_apps', APP_ID, 'telegram_link_tokens', token), {
        accountId: id,
        status: 'active',
        createdAt: fs.serverTimestamp(),
        createdAtMs: Date.now(),
        expiresAtMs,
        createdByUid: String(window.state?.userId || ''),
        purpose: 'telegram_bind'
      });
      await fs.setDoc(memberRef, {
        telegramLastLinkToken: token,
        telegramLinkStatus: 'active',
        telegramLinkExpiresAtMs: expiresAtMs,
        telegramLinkCreatedAtMs: Date.now()
      }, { merge: true });

      const url = `https://t.me/${BOT_USERNAME}?start=bind_${token}`;
      const field = document.getElementById('sr-tg-link-value');
      if (field) field.value = url;
      const expiry = document.getElementById('sr-tg-link-expiry');
      if (expiry) expiry.textContent = '此連結 10 分鐘內有效，且只能使用一次。';
      window.open(url, '_blank', 'noopener,noreferrer');
      toast('已產生 Telegram 專屬綁定連結', 'success');
      startBindingPoll();
    } catch (error) {
      console.error('Telegram 綁定連結產生失敗:', error);
      toast(error.message || '無法產生綁定連結', 'error');
    } finally {
      busy = false;
    }
  }

  async function copyBindingLink() {
    const value = document.getElementById('sr-tg-link-value')?.value || '';
    if (!value) return toast('請先產生綁定連結', 'info');
    try { await navigator.clipboard.writeText(value); toast('綁定連結已複製', 'success'); }
    catch (_) { toast('無法自動複製，請長按連結複製', 'error'); }
  }

  function startBindingPoll() {
    clearInterval(pollingTimer);
    let attempts = 0;
    pollingTimer = setInterval(async () => {
      attempts += 1;
      try {
        const snapshot = await loadSnapshot(true);
        if (hasActiveBinding(snapshot)) {
          clearInterval(pollingTimer);
          pollingTimer = null;
          await reconcileLegacyFields(snapshot);
          renderModal(snapshot);
          ensureCard(snapshot);
          toast('Telegram 綁定完成', 'success');
        }
      } catch (_) {}
      if (attempts >= 60) { clearInterval(pollingTimer); pollingTimer = null; }
    }, 3000);
  }

  async function unbindTelegram() {
    const snapshot = await loadSnapshot(true);
    if (!hasActiveBinding(snapshot)) {
      lastSnapshot = null;
      const refreshed = await loadSnapshot(true);
      renderModal(refreshed);
      ensureCard(refreshed);
      return toast('目前沒有有效的 Telegram 綁定', 'info');
    }
    if (!window.confirm('確定解除 Telegram 綁定？解除後將停止接收 Telegram 通知。')) return;
    const { db, fs } = await tools();
    const now = Date.now();
    const userId = String(snapshot.binding.telegramUserId || '');
    await fs.setDoc(fs.doc(db, 'secretg_apps', APP_ID, 'telegram_bindings', snapshot.id), {
      status: 'revoked', unlinkedAt: fs.serverTimestamp(), unlinkedAtMs: now, unlinkedBy: snapshot.id
    }, { merge: true });
    if (userId) {
      await fs.setDoc(fs.doc(db, 'secretg_apps', APP_ID, 'telegram_users', userId), {
        status: 'revoked', unlinkedAtMs: now
      }, { merge: true });
    }
    await fs.setDoc(fs.doc(db, 'secretg_apps', APP_ID, 'applications', snapshot.id), {
      telegramBound: false,
      telegramInfo: null,
      telegramUserId: null,
      telegramChatId: null,
      telegramUsername: null,
      telegramUnlinkedAtMs: now,
      telegramLinkStatus: 'unbound'
    }, { merge: true });
    window.state.userData = { ...(window.state.userData || {}), telegramBound: false, telegramInfo: null, telegramUserId: null, telegramChatId: null, telegramUsername: null };
    lastSnapshot = null;
    const refreshed = await loadSnapshot(true);
    renderModal(refreshed);
    ensureCard(refreshed);
    toast('Telegram 綁定已解除', 'success');
  }

  async function updatePreference(key, value) {
    if (!(key in DEFAULT_PREFERENCES) || key === 'securityNotifications') return;
    const id = accountId();
    if (!id) return;
    const { db, fs } = await tools();
    await fs.setDoc(fs.doc(db, 'secretg_apps', APP_ID, 'telegram_preferences', id), {
      accountId: id,
      [key]: value,
      securityNotifications: true,
      updatedAt: fs.serverTimestamp(),
      updatedAtMs: Date.now()
    }, { merge: true });
    lastSnapshot = null;
    renderModal(await loadSnapshot(true));
  }

  async function queueSecurityNotification(title, message) {
    const snapshot = await loadSnapshot(true).catch(() => null);
    if (!hasActiveBinding(snapshot)) return;
    const { db, fs } = await tools();
    const ref = fs.doc(fs.collection(db, 'secretg_apps', APP_ID, 'telegram_outbox'));
    await fs.setDoc(ref, {
      accountId: snapshot.id,
      category: 'security',
      title,
      message,
      status: 'pending',
      attemptCount: 0,
      source: 'member_security_event',
      buttonText: '開啟 SecretRoom',
      buttonUrl: location.origin + location.pathname,
      createdAt: fs.serverTimestamp(),
      createdAtMs: Date.now(),
      nextAttemptAtMs: 0
    });
  }

  function renderModal(snapshot) {
    let modal = document.getElementById('sr-telegram-phase2-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'sr-telegram-phase2-modal';
      modal.className = 'fixed inset-0 z-[260] hidden items-center justify-center bg-black/90 backdrop-blur-md p-4';
      document.body.appendChild(modal);
    }
    const bound = hasActiveBinding(snapshot);
    const serviceState = telegramServiceState(snapshot);
    const identityVerified = serviceState === 'identity_verified';
    const preferences = { ...DEFAULT_PREFERENCES, ...(snapshot?.preferences || {}) };
    const toggles = Object.keys(DEFAULT_PREFERENCES).filter(key => !['securityNotifications', 'digestMode'].includes(key)).map(key => `
      <label class="sr-tg-pref-row">
        <span>${esc(preferenceLabel(key))}</span>
        <input type="checkbox" data-sr-tg-pref="${key}" ${preferences[key] ? 'checked' : ''}>
      </label>`).join('');
    modal.innerHTML = `
      <div class="sr-tg-modal-card">
        <div class="flex items-start justify-between gap-4">
          <div><div class="sr-tg-eyebrow"><i class="fa-brands fa-telegram"></i> Telegram 會員服務</div><h2 class="text-xl font-black text-white mt-1">帳號綁定與通知</h2></div>
          <button id="sr-tg-close" class="sr-tg-icon-button" aria-label="關閉"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="sr-tg-status ${bound ? 'sr-tg-bound' : 'sr-tg-unbound'}">
          <strong>${bound ? 'Telegram 通知已啟用' : (identityVerified ? 'Telegram 身分已驗證' : '尚未綁定 Telegram')}</strong>
          <span>${bound
            ? `通知將傳送至 Telegram @${esc(snapshot?.binding?.telegramUsername || '已驗證帳號')}`
            : (identityVerified
              ? '註冊時的 Telegram 身分仍有效；只需開啟 Bot 一次，即可啟用通知。'
              : '完成 Telegram 身分連結並同時啟用 Bot 通知。')}</span>
        </div>
        ${bound ? `
          <div class="sr-tg-settings"><div class="sr-tg-section-title">通知偏好</div>
            <label class="sr-tg-pref-row sr-tg-fixed"><span>安全通知</span><span>固定開啟</span></label>${toggles}
          </div>
          <button id="sr-tg-unbind" class="sr-tg-danger-button">解除 Telegram 綁定</button>
        ` : `
          <div class="sr-tg-link-box">
            <input id="sr-tg-link-value" readonly placeholder="按下方按鈕產生 10 分鐘專屬連結">
            <button id="sr-tg-copy" class="sr-tg-secondary-button">複製</button>
          </div>
          <div id="sr-tg-link-expiry" class="text-xs text-slate-500 mt-2">連結尚未產生。</div>
          <button id="sr-tg-generate" class="sr-tg-primary-button"><i class="fa-brands fa-telegram"></i> ${identityVerified ? '啟用 Telegram 通知' : '綁定 Telegram 並啟用通知'}</button>
        `}
      </div>`;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    modal.querySelector('#sr-tg-close').onclick = () => { modal.classList.add('hidden'); modal.classList.remove('flex'); };
    modal.addEventListener('click', event => { if (event.target === modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); } }, { once: true });
    modal.querySelector('#sr-tg-generate')?.addEventListener('click', generateBindingLink);
    modal.querySelector('#sr-tg-copy')?.addEventListener('click', copyBindingLink);
    modal.querySelector('#sr-tg-unbind')?.addEventListener('click', unbindTelegram);
    modal.querySelectorAll('[data-sr-tg-pref]').forEach(input => input.addEventListener('change', () => updatePreference(input.dataset.srTgPref, input.checked)));
  }

  function modalElement() {
    let modal = document.getElementById('sr-telegram-phase2-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'sr-telegram-phase2-modal';
      modal.className = 'fixed inset-0 z-[260] hidden items-center justify-center bg-black/90 backdrop-blur-md p-4';
      document.body.appendChild(modal);
    }
    return modal;
  }

  function showModalState(title, message, retry = false) {
    const modal = modalElement();
    modal.innerHTML = `<div class="sr-tg-modal-card"><div class="flex items-start justify-between gap-4"><div><div class="sr-tg-eyebrow"><i class="fa-brands fa-telegram"></i> Telegram 會員服務</div><h2 class="text-xl font-black text-white mt-1">${esc(title)}</h2></div><button id="sr-tg-close" class="sr-tg-icon-button" aria-label="關閉"><i class="fa-solid fa-xmark"></i></button></div><div class="sr-tg-status sr-tg-unbound"><strong>${esc(message)}</strong><span>${retry ? '請確認網路與 Firestore 權限後重試。' : '正在同步綁定狀態與通知偏好。'}</span></div>${retry ? '<button id="sr-tg-retry-open" class="sr-tg-primary-button">重新載入</button>' : ''}</div>`;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    const close = () => { modalRequestId += 1; modal.classList.add('hidden'); modal.classList.remove('flex'); };
    modal.querySelector('#sr-tg-close')?.addEventListener('click', close);
    modal.querySelector('#sr-tg-retry-open')?.addEventListener('click', openModal);
    modal.onclick = event => { if (event.target === modal) close(); };
  }

  const TELEGRAM_INTENT_KEY = 'sr_telegram_settings_intent';

  function captureTelegramIntent() {
    try {
      const url = new URL(location.href);
      const intent = String(url.searchParams.get('telegram') || '').toLowerCase();
      if (!['settings', 'bind'].includes(intent)) return;
      sessionStorage.setItem(TELEGRAM_INTENT_KEY, intent);
      url.searchParams.delete('telegram');
      history.replaceState(null, '', url.pathname + (url.search ? url.search : '') + url.hash);
    } catch (_) {}
  }

  function consumeTelegramIntent() {
    const intent = sessionStorage.getItem(TELEGRAM_INTENT_KEY);
    if (!intent || !accountId() || !isMemberArea()) return;
    sessionStorage.removeItem(TELEGRAM_INTENT_KEY);
    setTimeout(() => openModal(), 80);
  }

  async function openModal() {
    const requestId = ++modalRequestId;
    showModalState('帳號綁定與通知', '正在載入 Telegram 設定…');
    try {
      const snapshot = await Promise.race([
        loadSnapshot(true),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Telegram 設定讀取逾時')), 10000))
      ]);
      if (requestId !== modalRequestId) return;
      renderModal(snapshot);
    } catch (error) {
      if (requestId !== modalRequestId) return;
      console.error('Telegram 設定載入失敗:', error);
      showModalState('無法載入 Telegram 設定', error?.message || '請稍後重試', true);
      toast('無法讀取 Telegram 設定', 'error');
    }
  }

  function patchLegacyBindView() {
    if (String(window.state?.currentView || '') !== 'telegram-bind') return;
    const anchor = document.getElementById('telegram-widget-anchor');
    if (!anchor) return;
    if (!anchor.querySelector('#sr-tg-open-bind-modal')) {
      anchor.innerHTML = `<button id="sr-tg-open-bind-modal" data-sr-tg-open="1" class="sr-tg-primary-button"><i class="fa-brands fa-telegram"></i> 產生一次性 Telegram 綁定連結</button>`;
    }
    const description = anchor.closest('.p-6')?.querySelector('p');
    if (description) description.textContent = '若註冊時已驗證 Telegram，只需開啟 Bot 一次即可啟用通知；不會重新驗證身分。';
    window.onTelegramAuth = () => toast('請使用一次性綁定連結完成驗證。', 'info');
  }

  const TELEGRAM_HOME_DISMISS_KEY = 'sr_telegram_home_card_dismissed';

  function ensureProfileNotificationAction() {
    const root = String(window.state?.currentTab || '') === 'profile'
      ? document.getElementById('dashboard-tab-content')
      : null;
    const existingAction = document.getElementById('sr-profile-telegram-action');
    if (!root) { existingAction?.remove(); return; }

    const buttons = [...root.querySelectorAll('button')];
    const edit = buttons.find(button => /修改個人資料/.test(button.textContent || ''));
    const exportButton = buttons.find(button => /匯出個人資料/.test(button.textContent || ''));
    const deleteButton = buttons.find(button => /申請刪除帳號/.test(button.textContent || ''));
    if (!edit || !exportButton || !deleteButton) return;

    const actionHost = edit.parentElement;
    if (!actionHost) return;

    let grid = document.getElementById('sr-profile-action-grid');
    if (!grid) {
      grid = document.createElement('div');
      grid.id = 'sr-profile-action-grid';
      actionHost.insertBefore(grid, edit);
    }
    grid.className = 'grid grid-cols-2 gap-3 w-full mt-4 col-span-2';
    grid.style.width = '100%';
    grid.style.maxWidth = 'none';

    const normalizeActionButton = button => {
      button.classList.remove('min-h-[64px]', 'col-span-2', 'sm:col-span-2', 'md:col-span-2');
      button.classList.add('w-full');
      button.style.gridColumn = '';
      button.style.width = '100%';
      button.style.minHeight = '';
    };

    [edit, exportButton, deleteButton].forEach(button => {
      if (button.parentElement !== grid) grid.appendChild(button);
      normalizeActionButton(button);
    });

    let notificationButton = document.getElementById('sr-profile-telegram-action');
    if (!notificationButton) {
      notificationButton = document.createElement('button');
      notificationButton.id = 'sr-profile-telegram-action';
      notificationButton.type = 'button';
      notificationButton.dataset.srTgOpen = '1';
    }

    notificationButton.className = edit.className;
    notificationButton.classList.remove('col-span-2', 'sm:col-span-2', 'md:col-span-2');
    notificationButton.classList.add('w-full');
    notificationButton.style.gridColumn = '';
    notificationButton.style.width = '100%';
    notificationButton.style.minHeight = '';
    notificationButton.innerHTML = '<i class="fa-brands fa-telegram mr-2 text-sm"></i><span>通知設定</span>';

    [edit, notificationButton, exportButton, deleteButton].forEach(button => {
      if (button.parentElement !== grid) grid.appendChild(button);
      else grid.appendChild(button);
    });
  }

  function ensureCard(snapshot = lastSnapshot) {
    const id = accountId();
    const existing = document.getElementById('sr-telegram-member-card');
    const view = String(window.state?.currentView || '');
    const tab = String(window.state?.currentTab || '');

    ensureProfileNotificationAction();

    const isHome = view === 'dashboard' && tab === 'feed';
    const isPending = view === 'pending';
    if (!id || (!isHome && !isPending) || (isHome && localStorage.getItem(TELEGRAM_HOME_DISMISS_KEY) === '1')) {
      existing?.remove();
      return;
    }

    const bound = hasActiveBinding(snapshot);
    if (bound && isHome) { existing?.remove(); return; }

    const host = isHome
      ? (document.getElementById('dashboard-tab-content') || document.querySelector('#app .overflow-y-auto'))
      : (document.querySelector('#app .overflow-y-auto') || document.querySelector('#app > div'));
    if (!host) return;
    let card = existing;
    if (!card) {
      card = document.createElement('section');
      card.id = 'sr-telegram-member-card';
      card.className = 'sr-tg-member-card relative';
      host.prepend(card);
    }
    const serviceState = telegramServiceState(snapshot);
    const identityVerified = serviceState === 'identity_verified';
    const signature = `${id}|${view}|${tab}|${serviceState}`;
    if (card.dataset.srTgSignature === signature) return;
    card.dataset.srTgSignature = signature;
    card.innerHTML = `<button type="button" id="sr-tg-dismiss-home-card" class="absolute top-3 right-3 z-20 w-10 h-10 rounded-full border border-slate-600/60 bg-slate-950/55 text-slate-300 hover:text-white hover:border-cyan-400/50" aria-label="關閉 Telegram 區塊"><i class="fa-solid fa-xmark"></i></button><div class="pr-12"><div class="sr-tg-eyebrow"><i class="fa-brands fa-telegram"></i> Telegram</div><div class="text-sm font-black text-white mt-1">${bound ? 'Telegram 通知已啟用' : (identityVerified ? 'Telegram 身分已驗證' : '尚未綁定 Telegram')}</div><div class="text-xs text-slate-400 mt-1">${bound ? '可接收審核、安全與帳號狀態通知。' : (identityVerified ? '只需開啟 Bot 一次即可啟用通知，不必重新驗證身分。' : '綁定 Telegram 身分並啟用 Bot 通知。')}</div></div><button id="sr-tg-open-settings" data-sr-tg-open="1" class="sr-tg-card-button shrink-0" style="margin-right:3.75rem">${bound ? '通知設定' : (identityVerified ? '啟用通知' : '立即綁定')}</button>`;
    card.querySelector('#sr-tg-dismiss-home-card')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      localStorage.setItem(TELEGRAM_HOME_DISMISS_KEY, '1');
      card.remove();
    });
  }

  function wrapPasswordSecurityMail() {
    if (wrappedPasswordMail || typeof window.SRP?.sendMail !== 'function') return;
    const original = window.SRP.sendMail;
    wrappedPasswordMail = true;
    window.SRP.sendMail = async function(user, id, message) {
      const result = await original.apply(this, arguments);
      queueSecurityNotification('SecretRoom 密碼已更新', message || '你的 SecretRoom 密碼剛剛已更新。若不是本人操作，請立即聯絡管理員。').catch(error => console.warn('Telegram 密碼通知排隊失敗:', error));
      return result;
    };
  }

  async function apply() {
    wrapPasswordSecurityMail();
    patchLegacyBindView();
    ensureCard();
    if (!accountId() || !isMemberArea()) return;
    consumeTelegramIntent();
    if (!lastSnapshot || Date.now() - lastSnapshotAt > REFRESH_MS) {
      try {
        const snapshot = await loadSnapshot();
        if (hasActiveBinding(snapshot)) await reconcileLegacyFields(snapshot);
        ensureCard(snapshot);
        if (window.state?.currentView === 'telegram-bind' && hasActiveBinding(snapshot)) {
          setTimeout(() => location.reload(), 250);
        }
      } catch (error) {
        console.warn('Telegram 會員狀態同步失敗:', error);
      }
    }
  }

  document.addEventListener('click', event => {
    const trigger = event.target?.closest?.('[data-sr-tg-open],#sr-tg-open-settings,#sr-tg-open-bind-modal');
    if (!trigger) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openModal();
  }, true);

  window.SRTelegramBound = () => hasActiveBinding(lastSnapshot);
  window.SROpenTelegramBinding = openModal;
  window.SRTelegramPhase2 = Object.freeze({ open: openModal, createLink: generateBindingLink, unbind: unbindTelegram, refresh: () => loadSnapshot(true), queueSecurityNotification, isBound: () => hasActiveBinding(lastSnapshot) });
  captureTelegramIntent();
  window.SRRuntime?.register(apply);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { lastSnapshotAt = 0; window.SRRuntime?.schedule?.(); } });
  apply();
})();
/* ===== Secure member authentication ===== */
;(() => {
/* SecretRoom Firebase custom-auth migration.
 * Secure member authentication uses an isolated named Firebase app so the
 * public site, the admin portal, and anonymous Firestore access do not replace
 * each other's persisted sessions.
 */
;(() => {
  const MEMBER_AUTH_APP_NAME = 'secretroom-member-auth';
  const cfg = () => window.SecretRoomBackendConfig || {};
  let sdkPromise = null;
  let loginInFlight = false;
  let loginInterceptorsInstalled = false;
  const originalLoginHandlers = new WeakMap();
  const boundForms = new WeakSet();

  function configuredBackendUrl() {
    return String(
      cfg().backendUrl ||
      localStorage.getItem('sr_backend_url') ||
      ''
    ).replace(/\/+$/, '');
  }

  function migrationEnabled() {
    return Boolean(configuredBackendUrl()) || cfg().strictAuth === true;
  }

  function backendUrl() {
    const value = configuredBackendUrl();
    if (!value) throw new Error('尚未設定 SecretRoom 後端網址。');
    return value;
  }

  async function waitForDefaultApp(appMod) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const app = appMod.getApps().find(item => item.name === '[DEFAULT]') || appMod.getApps()[0];
      if (app) return app;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Firebase 尚未初始化');
  }

  async function authSdk() {
    if (sdkPromise) return sdkPromise;

    sdkPromise = Promise.all([
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js')
    ]).then(async ([appMod, authMod]) => {
      const defaultApp = await waitForDefaultApp(appMod);
      let memberApp = appMod.getApps().find(item => item.name === MEMBER_AUTH_APP_NAME);
      if (!memberApp) {
        memberApp = appMod.initializeApp(defaultApp.options, MEMBER_AUTH_APP_NAME);
      }

      const auth = authMod.getAuth(memberApp);
      await authMod.setPersistence(auth, authMod.browserLocalPersistence);
      if (typeof auth.authStateReady === 'function') await auth.authStateReady();

      return {
        auth,
        signInWithCustomToken: authMod.signInWithCustomToken,
        getIdTokenResult: authMod.getIdTokenResult,
        onAuthStateChanged: authMod.onAuthStateChanged,
        signOut: authMod.signOut
      };
    });

    return sdkPromise;
  }

  async function api(path, body, token = '') {
    const response = await fetch(`${backendUrl()}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body || {}),
      cache: 'no-store'
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `後端錯誤：${response.status}`);
    }
    return data;
  }

  async function signIn(customToken, expectedUserId = '') {
    const { auth, signInWithCustomToken, getIdTokenResult } = await authSdk();
    const credential = await signInWithCustomToken(auth, customToken);
    const tokenResult = await getIdTokenResult(credential.user, true);
    const claims = tokenResult.claims || {};
    const claimUserId = String(claims.secretroomUserId || '');

    if (claims.secretroomMember !== true || !claimUserId) {
      throw new Error('會員安全身分建立失敗，請重新登入');
    }
    if (expectedUserId && claimUserId !== String(expectedUserId)) {
      throw new Error('會員安全身分與登入帳號不一致');
    }

    return credential.user;
  }

  async function currentMemberIdentity(forceRefresh = false) {
    const { auth, getIdTokenResult } = await authSdk();
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return null;

    const tokenResult = await getIdTokenResult(user, forceRefresh);
    const claims = tokenResult.claims || {};
    const userId = String(claims.secretroomUserId || '');
    if (claims.secretroomMember !== true || !userId) return null;

    const rememberedUserId = String(localStorage.getItem('sr_username') || '').trim();
    if (!rememberedUserId || rememberedUserId !== userId) return null;

    return { user, userId, claims, tokenResult };
  }

  async function signOutMember() {
    const { auth, signOut } = await authSdk();
    await signOut(auth).catch(() => {});
    sessionStorage.removeItem('sr_secure_member_id');
    window.dispatchEvent(new CustomEvent('sr:member-auth-changed'));
  }

  function showError(message) {
    window.showToast?.(message, 'error');
    const box = document.getElementById('login-error-box');
    if (box) {
      box.textContent = message;
      box.classList.remove('hidden');
    }
  }

  function setBusy(button, busy, text = '驗證中...') {
    if (!button) return;

    if (busy) {
      if (!button.dataset.srOriginalText) button.dataset.srOriginalText = button.innerHTML;
      button.disabled = true;
      button.classList.add('opacity-60', 'cursor-not-allowed');
      button.innerHTML = text;
      return;
    }

    button.disabled = false;
    button.classList.remove('opacity-60', 'cursor-not-allowed');
    if (button.dataset.srOriginalText) {
      button.innerHTML = button.dataset.srOriginalText;
      delete button.dataset.srOriginalText;
    }
  }

  async function forcePasswordChange(loginResult, user) {
    if (!loginResult.mustChangePassword) return user;

    let first = '';
    let second = '';
    while (true) {
      first = prompt('你目前使用的是臨時密碼。請設定新的 SecretRoom 密碼：') || '';
      if (!first) throw new Error('必須先設定新密碼才能進入平台');
      second = prompt('請再次輸入新密碼：') || '';
      if (first === second) break;
      alert('兩次輸入的密碼不同，請重新操作。');
    }

    const idToken = await user.getIdToken();
    const changed = await api('/api/member/change-password', { newPassword: first }, idToken);
    const refreshedUser = await signIn(changed.customToken, loginResult.userId);
    window.showToast?.('新密碼設定完成', 'success');
    return refreshedUser;
  }

  async function secureLogin(event = null) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
    if (loginInFlight) return;

    const username = document.getElementById('login-username')?.value?.trim() || '';
    const password = document.getElementById('login-password')?.value || '';
    const button = document.getElementById('btn-login-submit');
    if (!username || !password) return showError('請填寫完整登入資訊！');

    loginInFlight = true;
    setBusy(button, true, '安全驗證中…');

    try {
      const result = await api('/api/auth/member-login', {
        userId: username,
        password
      });

      let user = await signIn(result.customToken, result.userId);
      user = await forcePasswordChange(result, user);
      await user.getIdToken(true);

      localStorage.setItem('sr_username', result.userId);
      sessionStorage.setItem('sr_secure_member_id', result.userId);

      const identity = await currentMemberIdentity(true);
      if (!identity || identity.userId !== String(result.userId)) {
        throw new Error('會員安全登入尚未完成，請重新操作');
      }

      window.dispatchEvent(new CustomEvent('sr:member-auth-changed'));
      window.showToast?.('安全登入成功，正在載入俱樂部…', 'success');
      location.reload();
    } catch (error) {
      console.error('Secure login failed', error);
      const noBackendConfigured = !configuredBackendUrl();
      if (noBackendConfigured && cfg().strictAuth !== true && originalLoginHandlers.has(button)) {
        return originalLoginHandlers.get(button)?.call(button, event);
      }
      showError(error.message || String(error));
    } finally {
      loginInFlight = false;
      setBusy(button, false);
    }
  }

  async function secureRegister(form) {
    const button = document.getElementById('apply-submit');
    const avatar = document.getElementById('avatar-preview')?.src || '';
    const kinks = [...document.querySelectorAll('input[name="reg-kink"]:checked')].map(input => input.value);
    const payload = {
      userId: document.getElementById('reg-username')?.value?.trim(),
      password: document.getElementById('reg-password')?.value || '',
      email: document.getElementById('reg-email')?.value?.trim() || '',
      nickname: document.getElementById('reg-nickname')?.value?.trim() || '',
      birthYear: document.getElementById('reg-year')?.value || '',
      birthMonth: document.getElementById('reg-month')?.value || '',
      birthDay: document.getElementById('reg-day')?.value || '',
      height: document.getElementById('reg-height')?.value || '',
      weight: document.getElementById('reg-weight')?.value || '',
      length: document.getElementById('reg-length')?.value || '',
      girth: document.getElementById('reg-girth')?.value || '',
      kinks,
      avatar: avatar.startsWith('data:image/') ? avatar : ''
    };

    setBusy(button, true, '建立安全帳號中…');
    try {
      const result = await api('/api/auth/register', payload);
      await signIn(result.customToken, result.userId);
      localStorage.setItem('sr_username', result.userId);
      sessionStorage.setItem('sr_secure_member_id', result.userId);
      window.dispatchEvent(new CustomEvent('sr:member-auth-changed'));
      window.showToast?.('申請資料提交成功！請靜待審核。', 'success');
      location.reload();
    } catch (error) {
      window.showToast?.(error.message || String(error), 'error');
    } finally {
      setBusy(button, false);
    }
  }

  function installLoginInterceptors() {
    if (!migrationEnabled() || loginInterceptorsInstalled) return;
    loginInterceptorsInstalled = true;

    document.addEventListener('click', event => {
      const button = event.target?.closest?.('#btn-login-submit');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      secureLogin(event);
    }, true);

    document.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      const target = event.target;
      if (!target || !['login-username', 'login-password'].includes(target.id)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      secureLogin(event);
    }, true);
  }

  function installLoginOverride() {
    if (!migrationEnabled()) return;
    const button = document.getElementById('btn-login-submit');
    if (!button || button.dataset.srSecureAuth === '1') return;

    button.dataset.srSecureAuth = '1';
    originalLoginHandlers.set(button, window.__srHandleLoginSubmit || button.onclick);
    window.__srHandleLoginSubmit = secureLogin;
    button.onclick = secureLogin;
  }

  function installRegisterOverride() {
    if (!migrationEnabled()) return;
    const form = document.getElementById('apply-form');
    if (!form || boundForms.has(form)) return;

    boundForms.add(form);
    const email = document.getElementById('reg-email');
    if (email) {
      email.required = false;
      email.placeholder = '選填；外部通知將以 Telegram 為主';
      const label = email.closest('div')?.querySelector('label');
      if (label) label.innerHTML = '備用聯絡信箱 <span class="text-slate-500 font-normal">(選填)</span>';
      const note = email.closest('div')?.querySelector('p');
      if (note) note.textContent = '外部通知與忘記密碼已改由 Telegram；信箱僅作備用聯絡。';
    }

    form.addEventListener('submit', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      secureRegister(form);
    }, true);

    const button = document.getElementById('apply-submit');
    if (button) {
      button.onclick = event => {
        event.preventDefault();
        secureRegister(form);
      };
    }
  }

  function installForgotPasswordOverride() {
    if (!migrationEnabled()) return;
    const button = document.getElementById('btn-forgot-password');
    if (!button || button.dataset.srSecureReset === '1') return;

    button.dataset.srSecureReset = '1';
    button.onclick = async event => {
      event?.preventDefault?.();
      const current = document.getElementById('login-username')?.value?.trim() || '';
      const userId = prompt('請輸入要申請忘記密碼的 SecretRoom 帳號：', current) || '';
      if (!userId.trim()) return;

      try {
        await api('/api/auth/request-password-reset', { userId: userId.trim() });
        alert('申請已建立。請開啟 SecretRoom Telegram Bot，點選「忘記密碼」完成驗證。');
        window.open('https://t.me/SecretRoomtwBot', '_blank', 'noopener');
      } catch (error) {
        showError(error.message || String(error));
      }
    };
  }

  function apply() {
    installLoginInterceptors();
    installLoginOverride();
    installRegisterOverride();
    installForgotPasswordOverride();
  }

  new MutationObserver(apply).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  document.addEventListener('DOMContentLoaded', apply, { once: true });
  apply();

  window.SRSecureAuth = Object.freeze({
    api,
    signIn,
    signOutMember,
    authSdk,
    backendUrl,
    migrationEnabled,
    currentMemberIdentity,
    secureLogin
  });
})();
})();

/* ===== Telegram member service ===== */
;(() => {
/* SecretRoom Telegram member self-service.
 * The button is backed by the isolated persisted member-auth session and stays
 * visible while Firebase restores that session in a regular browser window.
 */
;(() => {
  const BOT_NAME = 'SecretRoomtwBot';
  let unsubscribeAuth = null;
  let syncTimer = null;
  let syncSequence = 0;
  let entryUserId = '';
  let entryRestoring = false;

  function backendEnabled() {
    return window.SRSecureAuth?.migrationEnabled?.() === true;
  }

  async function memberAuthTools() {
    if (!window.SRSecureAuth?.authSdk) {
      throw new Error('會員安全登入模組尚未完成載入');
    }
    return window.SRSecureAuth.authSdk();
  }

  async function memberIdentity(forceRefresh = false) {
    if (!window.SRSecureAuth?.currentMemberIdentity) return null;
    return window.SRSecureAuth.currentMemberIdentity(forceRefresh);
  }

  async function idToken() {
    const identity = await memberIdentity(true);
    if (!identity) {
      throw new Error('請先使用 SecretRoom 會員帳號重新安全登入');
    }
    return identity.user.getIdToken();
  }

  async function api(path, body = {}) {
    if (!window.SRSecureAuth || !backendEnabled()) {
      throw new Error('Telegram 會員服務尚未完成後端啟用');
    }
    return window.SRSecureAuth.api(path, body, await idToken());
  }

  async function createBindingLink() {
    const result = await api('/api/member/binding-link');
    return result.url;
  }

  async function saveTelegramPreferences(patch) {
    return api('/api/member/preferences', patch);
  }

  async function getRequestStatus() {
    return api('/api/member/status');
  }

  function toast(message, type = 'info') {
    window.showToast?.(message, type) || alert(message);
  }

  function closeModal() {
    document.getElementById('sr-telegram-service-modal')?.remove();
  }

  function preferenceDialog(current = {}) {
    const review = confirm(
      `審核結果通知目前為${current.review === false ? '關閉' : '開啟'}。\n按「確定」保持開啟；按「取消」關閉。`
    );
    const service = confirm(
      `服務與系統通知目前為${current.service === false ? '關閉' : '開啟'}。\n按「確定」保持開啟；按「取消」關閉。`
    );
    const promotion = confirm(
      `活動與公告通知目前為${current.promotion === true ? '開啟' : '關閉'}。\n按「確定」開啟；按「取消」關閉。`
    );
    return { review, service, promotion };
  }

  async function openModal() {
    if (!backendEnabled()) {
      return toast('Telegram 會員服務尚未完成後端啟用。', 'info');
    }

    const identity = await memberIdentity(true);
    if (!identity) {
      return toast('會員安全身分尚未恢復，請重新登入 SecretRoom。', 'error');
    }

    closeModal();
    const wrap = document.createElement('div');
    wrap.id = 'sr-telegram-service-modal';
    wrap.className = 'fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-4';
    wrap.innerHTML = `
      <div class="w-full max-w-md rounded-3xl border border-sky-500/20 bg-[#07111d] p-5 shadow-2xl text-slate-100">
        <div class="flex items-start justify-between gap-4 mb-5">
          <div>
            <div class="text-sky-300 text-xs font-black tracking-[.18em]">TELEGRAM SERVICE</div>
            <h2 class="text-xl font-black mt-1">SecretRoom 會員服務</h2>
            <p class="text-xs text-slate-400 mt-2">Telegram 外部通知與平台內通知分開管理。</p>
            <p class="text-[11px] text-sky-300/80 mt-2">目前會員：@${identity.userId}</p>
          </div>
          <button data-close class="text-slate-400 text-2xl">×</button>
        </div>
        <div class="grid gap-3">
          <button data-action="bind" class="text-left rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4"><b>🔗 綁定帳號</b><div class="text-xs text-slate-400 mt-1">產生 10 分鐘有效的一次性安全連結</div></button>
          <button data-action="reset" class="text-left rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4"><b>🔐 忘記密碼</b><div class="text-xs text-slate-400 mt-1">請先從登入頁申請，再到機器人完成</div></button>
          <button data-action="prefs" class="text-left rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4"><b>🔔 Telegram 通知設定</b><div class="text-xs text-slate-400 mt-1">安全通知固定開啟，其他通知獨立設定</div></button>
          <button data-action="status" class="text-left rounded-2xl border border-slate-700 bg-slate-900/70 p-4"><b>📋 我的申請進度</b></button>
        </div>
      </div>`;

    wrap.querySelector('[data-close]').onclick = closeModal;
    wrap.addEventListener('click', async event => {
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (!action) return;

      try {
        if (action === 'bind') location.href = await createBindingLink();
        if (action === 'reset') {
          toast('忘記密碼必須先從登入頁送出申請，再到 Telegram 操作。', 'info');
          window.open(`https://t.me/${BOT_NAME}`, '_blank', 'noopener');
        }
        if (action === 'prefs') {
          const current = await getRequestStatus();
          await saveTelegramPreferences(preferenceDialog(current.preferences || {}));
          toast('Telegram 通知偏好已更新', 'success');
        }
        if (action === 'status') {
          const status = await getRequestStatus();
          alert(
            `帳號綁定：${status.binding ? '已綁定' : '未綁定'}\n` +
            `忘記密碼：${status.passwordReset?.status || '無申請'}\n` +
            `帳號異動：${status.accountRequest?.status || '無申請'}`
          );
        }
      } catch (error) {
        toast(error.message || String(error), 'error');
      }
    });

    document.body.appendChild(wrap);
  }

  function profileEntryHost() {
    if (String(window.state?.currentTab || '') !== 'profile') return null;
    return document.getElementById('dashboard-tab-content');
  }

  function renderProfileEntryButton() {
    // Remove the retired floating entry if an older cached render created it.
    document.getElementById('sr-telegram-service-entry')?.remove();

    const existing = document.getElementById('sr-profile-telegram-service-entry');
    const host = profileEntryHost();
    if (!host || !entryUserId) {
      existing?.remove();
      return;
    }

    let button = existing;
    if (!button) {
      button = document.createElement('button');
      button.id = 'sr-profile-telegram-service-entry';
      button.type = 'button';
      button.onclick = () => openModal().catch(error => toast(error.message || String(error), 'error'));
    }

    const signature = `${entryUserId}|${entryRestoring ? 'restoring' : 'verified'}`;
    if (button.dataset.srProfileServiceSignature !== signature) {
      button.dataset.srProfileServiceSignature = signature;
      button.dataset.memberUserId = entryUserId;
      button.dataset.authState = entryRestoring ? 'restoring' : 'verified';
      button.disabled = false;
      button.className = 'w-full rounded-2xl border border-sky-400/25 bg-sky-500/10 px-4 py-3 text-left flex items-center justify-between gap-3 text-sky-100 shadow-lg transition hover:bg-sky-500/15 click-press';
      button.innerHTML = `<span class="flex items-center gap-3 min-w-0"><span class="w-10 h-10 rounded-full bg-sky-400/15 border border-sky-400/20 flex items-center justify-center shrink-0"><i class="fa-brands fa-telegram text-sky-300"></i></span><span class="min-w-0"><strong class="block text-sm font-black truncate">Telegram 會員服務</strong><span class="block text-xs text-slate-400 mt-0.5 truncate">@${entryUserId}${entryRestoring ? ' · 身分同步中' : ' · 綁定、通知與申請進度'}</span></span></span><i class="fa-solid fa-chevron-right text-sky-300 shrink-0"></i>`;
    }

    const grid = document.getElementById('sr-profile-action-grid');
    if (grid?.parentElement) {
      if (button.parentElement !== grid.parentElement || button.nextElementSibling !== grid) grid.before(button);
    } else if (button.parentElement !== host) {
      host.appendChild(button);
    }
  }

  function removeEntryButton() {
    entryUserId = '';
    entryRestoring = false;
    document.getElementById('sr-telegram-service-entry')?.remove();
    document.getElementById('sr-profile-telegram-service-entry')?.remove();
    closeModal();
  }

  function createOrUpdateEntryButton(userId, restoring = false) {
    if (!userId) return removeEntryButton();
    entryUserId = String(userId);
    entryRestoring = Boolean(restoring);
    renderProfileEntryButton();
  }

  async function syncEntryButton(forceRefresh = false) {
    const sequence = ++syncSequence;
    if (!backendEnabled()) {
      removeEntryButton();
      return;
    }

    const rememberedUserId = String(
      sessionStorage.getItem('sr_secure_member_id') ||
      localStorage.getItem('sr_username') ||
      ''
    ).trim();

    if (rememberedUserId) {
      createOrUpdateEntryButton(rememberedUserId, true);
    }

    try {
      const identity = await memberIdentity(forceRefresh);
      if (sequence !== syncSequence) return;

      if (identity) {
        sessionStorage.setItem('sr_secure_member_id', identity.userId);
        createOrUpdateEntryButton(identity.userId, false);
        return;
      }

      if (!rememberedUserId) removeEntryButton();
    } catch (error) {
      console.warn('Telegram member identity check failed', error);
      if (!rememberedUserId) removeEntryButton();
    }
  }

  function scheduleSync(delay = 250, forceRefresh = false) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncEntryButton(forceRefresh).catch(error => console.warn(error));
    }, delay);
  }

  async function installAuthObserver() {
    if (unsubscribeAuth) return;
    const { auth, onAuthStateChanged } = await memberAuthTools();

    unsubscribeAuth = onAuthStateChanged(auth, () => {
      scheduleSync(350, true);
    });

    await syncEntryButton(false);
  }

  window.SRTelegramPlatform = Object.freeze({
    createBindingLink,
    saveTelegramPreferences,
    getRequestStatus,
    openModal,
    memberIdentity,
    syncEntryButton
  });

  window.SRRuntime?.register(renderProfileEntryButton);

  window.addEventListener('sr:member-auth-changed', () => scheduleSync(50, true));
  window.addEventListener('pageshow', () => scheduleSync(100, false));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleSync(100, false);
  });
  document.addEventListener('DOMContentLoaded', () => {
    installAuthObserver().catch(error => console.warn(error));
  }, { once: true });

  installAuthObserver().catch(error => console.warn(error));
})();
})();

/* ===== SecretRoom conversation interface v1 ===== */
;(() => {
  if (window.__SR_CONVERSATION_UI_V1__) return;
  window.__SR_CONVERSATION_UI_V1__ = true;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const currentId = () => String(window.state?.applicationId || '');
  const postIdOf = box => String(box?.id || '').replace(/^comments-box-/, '');

  function member(userId) {
    const id = String(userId || '');
    if (id === currentId()) return { id, ...(window.state?.userData || {}) };
    return (window.state?.activeUsers || []).find(user => String(user?.id || '') === id) || { id };
  }

  function formatTime(value) {
    const date = new Date(Number(value) || value || Date.now());
    if (Number.isNaN(date.getTime())) return '';
    const sameDay = date.toDateString() === new Date().toDateString();
    return new Intl.DateTimeFormat('zh-TW', sameDay
      ? { hour:'2-digit', minute:'2-digit', hour12:false }
      : { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false }
    ).format(date);
  }

  function commentsOf(post) {
    return Object.values(post?.comments || {}).filter(comment => comment?.id)
      .sort((a, b) => Number(a.time || 0) - Number(b.time || 0));
  }

  function messageHtml(post, comment) {
    const author = member(comment.userId);
    const own = String(comment.userId || '') === currentId();
    const canDelete = own || String(post?.userId || '') === currentId();
    const action = canDelete
      ? `<button type="button" data-sr-comment-action="delete" data-post-id="${esc(post.id)}" data-comment-id="${esc(comment.id)}" aria-label="刪除留言"><i class="fa-regular fa-trash-can"></i></button>`
      : `<button type="button" data-sr-comment-action="report" data-post-id="${esc(post.id)}" data-comment-id="${esc(comment.id)}" aria-label="檢舉留言"><i class="fa-regular fa-flag"></i></button>`;
    return `<article class="sr-conversation-message ${own ? 'is-own' : 'is-other'}">
      <img class="sr-conversation-avatar" src="${esc(author.avatar || 'Gemini_Generated_Image_e2fxvje2fxvje2fx.jpg?v=2')}" alt="" loading="lazy">
      <div class="sr-conversation-message-body">
        <div class="sr-conversation-meta"><span class="sr-conversation-author">${esc(author.nickname || comment.userId || '會員')}</span><span class="sr-conversation-account">@${esc(comment.userId)}</span><time>${esc(formatTime(comment.time))}</time><span class="sr-conversation-action">${action}</span></div>
        <div class="sr-conversation-bubble">${esc(comment.text).replace(/\n/g, '<br>')}</div>
      </div>
    </article>`;
  }

  function resizeInput(input) {
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  }

  function scrollLatest(box, smooth = false) {
    const list = box?.querySelector('[id^="comments-list-"]');
    if (!list) return;
    requestAnimationFrame(() => list.scrollTo({ top:list.scrollHeight, behavior:smooth ? 'smooth' : 'auto' }));
  }

  function enhance(box) {
    const postId = postIdOf(box);
    const post = (window.state?.posts || []).find(item => String(item.id) === postId);
    if (!post) return;
    const list = box.querySelector(`[id="comments-list-${CSS.escape(postId)}"]`);
    let composer = box.querySelector(':scope > .flex.gap-2, :scope > .sr-conversation-composer');
    if (!list || !composer) return;

    box.classList.add('sr-conversation-panel');
    let header = box.querySelector(':scope > .sr-conversation-header');
    if (!header) {
      header = document.createElement('div');
      header.className = 'sr-conversation-header';
      box.prepend(header);
    }

    const rows = commentsOf(post);
    header.innerHTML = `<div><strong>對話</strong><span>${rows.length} 則留言</span></div><span class="sr-conversation-hint">Enter 傳送 · Shift＋Enter 換行</span>`;

    list.className = 'sr-conversation-list';
    list.setAttribute('role', 'log');
    list.setAttribute('aria-live', 'polite');
    const signature = rows.map(row => `${row.id}:${row.time}:${row.text}`).join('|');
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 72;
    if (list.dataset.srConversationSignature !== signature) {
      list.dataset.srConversationSignature = signature;
      list.innerHTML = rows.length ? rows.map(row => messageHtml(post, row)).join('') : '<div class="sr-conversation-empty"><i class="fa-regular fa-comments"></i><strong>尚未開始對話</strong><span>留下第一則友善留言。</span></div>';
      if (nearBottom || !list.dataset.srConversationReady) scrollLatest(box);
      list.dataset.srConversationReady = '1';
    }

    if (list.nextElementSibling !== composer) list.after(composer);
    composer.className = 'sr-conversation-composer';

    let input = composer.querySelector(`[id="comment-input-${CSS.escape(postId)}"]`);
    if (input && input.tagName !== 'TEXTAREA') {
      const textarea = document.createElement('textarea');
      textarea.id = input.id;
      textarea.value = input.value;
      textarea.placeholder = '輸入留言…';
      textarea.rows = 1;
      textarea.maxLength = 500;
      textarea.autocomplete = 'off';
      textarea.enterKeyHint = 'send';
      input.replaceWith(textarea);
      input = textarea;
    }
    if (!input) return;
    input.className = 'sr-conversation-input';
    input.maxLength = 500;
    input.setAttribute('aria-label', '輸入留言');
    resizeInput(input);

    const send = composer.querySelector('button');
    if (send) {
      send.className = 'sr-conversation-send';
      send.innerHTML = '<i class="fa-solid fa-paper-plane"></i><span>送出</span>';
      send.setAttribute('aria-label', '送出留言');
    }

    let count = composer.querySelector('.sr-conversation-count');
    if (!count) {
      count = document.createElement('span');
      count.className = 'sr-conversation-count';
      composer.appendChild(count);
    }
    count.textContent = `${input.value.length}/500`;
  }

  function apply() {
    document.querySelectorAll('[id^="comments-box-"]:not(.hidden)').forEach(enhance);
  }

  function installSubmitGuard() {
    const original = window.submitComment;
    if (typeof original !== 'function' || original.__srConversationWrapped) return;
    const wrapped = async function(postId) {
      const input = document.getElementById(`comment-input-${postId}`);
      const text = input?.value.trim() || '';
      if (!text) return;
      if (text.length > 500) {
        window.showToast?.('每則留言最多 500 個字。', 'info');
        input?.focus();
        return;
      }
      const composer = input?.closest('.sr-conversation-composer');
      const button = composer?.querySelector('button');
      if (button?.disabled) return;
      const oldHtml = button?.innerHTML || '';
      if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>傳送中</span>';
      }
      input.disabled = true;
      const pending = original.call(this, postId);
      document.getElementById('loading-screen')?.classList.add('hidden');
      try {
        await pending;
        window.state.openComments[postId] = true;
        setTimeout(() => {
          apply();
          scrollLatest(document.getElementById(`comments-box-${postId}`), true);
        }, 80);
      } finally {
        input.disabled = false;
        if (button) {
          button.disabled = false;
          button.innerHTML = oldHtml;
        }
        input.focus();
      }
    };
    wrapped.__srConversationWrapped = true;
    window.submitComment = wrapped;
  }

  document.addEventListener('input', event => {
    const input = event.target.closest?.('.sr-conversation-input');
    if (!input) return;
    resizeInput(input);
    const count = input.closest('.sr-conversation-composer')?.querySelector('.sr-conversation-count');
    if (count) count.textContent = `${input.value.length}/500`;
  });

  document.addEventListener('keydown', event => {
    const input = event.target.closest?.('.sr-conversation-input');
    if (!input || event.isComposing || event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    window.submitComment?.(String(input.id).replace(/^comment-input-/, ''));
  });

  document.addEventListener('focusin', event => {
    const input = event.target.closest?.('.sr-conversation-input');
    if (!input) return;
    setTimeout(() => input.closest('.sr-conversation-composer')?.scrollIntoView({ block:'nearest', behavior:'smooth' }), 220);
  });

  document.addEventListener('click', event => {
    const action = event.target.closest?.('[data-sr-comment-action]');
    if (action) {
      event.preventDefault();
      event.stopPropagation();
      if (action.dataset.srCommentAction === 'delete') window.deleteComment?.(action.dataset.postId, action.dataset.commentId);
      else window.openCommentReportModal?.(action.dataset.postId, action.dataset.commentId);
      return;
    }
    const toggle = event.target.closest?.('[onclick^="toggleCommentsSection"]');
    if (toggle) setTimeout(() => {
      installSubmitGuard();
      apply();
      const id = toggle.getAttribute('onclick')?.match(/toggleCommentsSection\(['"]([^'"]+)/)?.[1];
      const box = id ? document.getElementById(`comments-box-${id}`) : null;
      if (box && !box.classList.contains('hidden')) scrollLatest(box, true);
    }, 0);
  }, true);

  window.SRRuntime?.register(() => { installSubmitGuard(); apply(); });
  installSubmitGuard();
  apply();
})();


/* ===== Interface accessibility follow-up v2 ===== */
;(()=>{if(window.__SR_DIALOG_A11Y__)return;window.__SR_DIALOG_A11Y__=true;let previous=null;const sel='#custom-confirm-modal,[id$="-modal"],[id*="-modal-"]',focusSel='button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',visible=e=>e&&!e.hidden&&!e.classList.contains('hidden')&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden';function prep(d){if(!(d instanceof HTMLElement))return;d.setAttribute('role',d.getAttribute('role')||'dialog');d.setAttribute('aria-modal','true');if(!d.hasAttribute('tabindex'))d.tabIndex=-1;const h=d.querySelector('h1,h2,h3'),p=d.querySelector('p');if(h&&!d.hasAttribute('aria-labelledby')){if(!h.id)h.id=`${d.id||'sr-dialog'}-title`;d.setAttribute('aria-labelledby',h.id)}if(p&&!d.hasAttribute('aria-describedby')){if(!p.id)p.id=`${d.id||'sr-dialog'}-description`;d.setAttribute('aria-describedby',p.id)}}function active(){return[...document.querySelectorAll(sel)].filter(visible).at(-1)||null}function focus(d){if(!d||d.contains(document.activeElement))return;previous=document.activeElement instanceof HTMLElement?document.activeElement:null;requestAnimationFrame(()=>(d.querySelector(focusSel)||d).focus({preventScroll:true}))}function close(d){const b=d.querySelector('#confirm-modal-cancel,[data-modal-close],[aria-label*="關閉"],button[id*="close"],button[onclick*="close"]');if(b)b.click();else d.click();requestAnimationFrame(()=>previous?.focus?.({preventScroll:true}))}document.addEventListener('keydown',e=>{const d=active();if(!d)return;if(e.key==='Escape'){e.preventDefault();close(d);return}if(e.key!=='Tab')return;const a=[...d.querySelectorAll(focusSel)].filter(visible);if(!a.length){e.preventDefault();d.focus();return}const f=a[0],l=a.at(-1);if(e.shiftKey&&document.activeElement===f){e.preventDefault();l.focus()}else if(!e.shiftKey&&document.activeElement===l){e.preventDefault();f.focus()}},true);const apply=()=>document.querySelectorAll(sel).forEach(d=>{prep(d);if(visible(d))focus(d)});new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','style']});document.addEventListener('DOMContentLoaded',apply,{once:true});apply()})();
