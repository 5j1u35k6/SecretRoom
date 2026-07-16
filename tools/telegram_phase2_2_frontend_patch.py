from pathlib import Path

app_path = Path('app.js')
text = app_path.read_text(encoding='utf-8')

# Onboarding must not infer Telegram binding from stale member fields.
old = """  const telegramBound = () => typeof window.SRTelegramBound === 'function'
    ? window.SRTelegramBound(window.state?.userData || {})
    : Boolean(window.state?.userData?.telegramInfo);
"""
new = """  const telegramBound = () => typeof window.SRTelegramBound === 'function'
    ? Boolean(window.SRTelegramBound())
    : false;
"""
if old not in text:
    raise SystemExit('Onboarding Telegram binding helper not found')
text = text.replace(old, new, 1)

progress_end = """    const done = items.filter(item => item.done).length;
    return { items, done, percent: Math.round(done / items.length * 100) };
  }

  function clickFirst(ids) {
"""
profile_progress = """    const done = items.filter(item => item.done).length;
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
"""
if progress_end not in text:
    raise SystemExit('Onboarding progress block not found')
text = text.replace(progress_end, profile_progress, 1)

profile_section_start = text.index('  function renderProfile() {')
profile_section_end = text.index('\n  function style() {', profile_section_start)
profile_section = text[profile_section_start:profile_section_end]
if 'const current = progress();' not in profile_section:
    raise SystemExit('Profile completion progress call not found')
profile_section = profile_section.replace('const current = progress();', 'const current = profileProgress();', 1)
text = text[:profile_section_start] + profile_section + text[profile_section_end:]

# Telegram binding document is the sole source of truth.
old = "  const isBoundData = data => Boolean(data?.telegramBound === true || data?.telegramInfo?.id || data?.telegramUserId);\n"
new = """  const hasActiveBinding = snapshot => {
    const binding = snapshot?.binding;
    return Boolean(
      binding &&
      String(binding.status || '').toLowerCase() === 'active' &&
      String(binding.telegramUserId || '').trim() &&
      String(binding.telegramChatId || '').trim()
    );
  };
  const hasLegacyBindingFields = member => Boolean(
    member?.telegramBound === true ||
    member?.telegramInfo ||
    member?.telegramUserId ||
    member?.telegramChatId ||
    member?.telegramUsername
  );
"""
if old not in text:
    raise SystemExit('Legacy Telegram bound helper not found')
text = text.replace(old, new, 1)

old_load = """  async function loadSnapshot(force = false) {
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
    lastSnapshot = { id, member, binding, preferences };
    lastSnapshotAt = Date.now();
    return lastSnapshot;
  }
"""
new_load = """  async function clearStaleBindingFields(snapshot, db, fs) {
    if (!snapshot || hasActiveBinding(snapshot) || !hasLegacyBindingFields(snapshot.member)) return snapshot;
    const cleared = {
      telegramBound: false,
      telegramInfo: null,
      telegramUserId: null,
      telegramChatId: null,
      telegramUsername: null,
      telegramLinkStatus: 'unbound',
      telegramLegacyClearedAtMs: Date.now()
    };
    try {
      await fs.setDoc(fs.doc(db, 'secretg_apps', APP_ID, 'applications', snapshot.id), cleared, { merge: true });
    } catch (error) {
      console.warn('無法清除過期 Telegram 相容欄位，但介面仍以正式 binding 為準:', error);
    }
    snapshot.member = { ...(snapshot.member || {}), ...cleared };
    if (String(window.state?.applicationId || '') === snapshot.id) {
      window.state.userData = { ...(window.state?.userData || {}), ...cleared };
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
    await clearStaleBindingFields(snapshot, db, fs);
    lastSnapshot = snapshot;
    lastSnapshotAt = Date.now();
    return lastSnapshot;
  }
"""
if old_load not in text:
    raise SystemExit('Telegram loadSnapshot block not found')
text = text.replace(old_load, new_load, 1)

text = text.replace("if (!snapshot?.binding || snapshot.binding.status !== 'active') return;", "if (!hasActiveBinding(snapshot)) return;", 1)
text = text.replace("if (snapshot?.binding?.status === 'active') {", "if (hasActiveBinding(snapshot)) {", 1)
text = text.replace("const bound = snapshot?.binding?.status === 'active' || isBoundData(snapshot?.member);", "const bound = hasActiveBinding(snapshot);", 1)
text = text.replace("const bound = snapshot?.binding?.status === 'active' || isBoundData(snapshot?.member || window.state?.userData);", "const bound = hasActiveBinding(snapshot);", 1)
text = text.replace("if (snapshot?.binding?.status === 'active') await reconcileLegacyFields(snapshot);", "if (hasActiveBinding(snapshot)) await reconcileLegacyFields(snapshot);", 1)
text = text.replace("if (!snapshot?.binding || snapshot.binding.status !== 'active') return toast('目前沒有有效的 Telegram 綁定', 'info');", "if (!hasActiveBinding(snapshot)) {\n      lastSnapshot = null;\n      const refreshed = await loadSnapshot(true);\n      renderModal(refreshed);\n      ensureCard(refreshed);\n      return toast('目前沒有有效的 Telegram 綁定', 'info');\n    }", 1)

# Telegram deep link intent survives login and opens the binding/settings modal.
marker = "  async function openModal() {\n"
intent_helpers = """  const TELEGRAM_INTENT_KEY = 'sr_telegram_settings_intent';

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

"""
if marker not in text:
    raise SystemExit('Telegram openModal marker not found')
text = text.replace(marker, intent_helpers + marker, 1)

old_apply = """    ensureCard();
    if (!accountId() || !isMemberArea()) return;
    if (!lastSnapshot || Date.now() - lastSnapshotAt > REFRESH_MS) {
"""
new_apply = """    ensureCard();
    if (!accountId() || !isMemberArea()) return;
    consumeTelegramIntent();
    if (!lastSnapshot || Date.now() - lastSnapshotAt > REFRESH_MS) {
"""
if old_apply not in text:
    raise SystemExit('Telegram apply block not found')
text = text.replace(old_apply, new_apply, 1)

old_export = """  window.SRTelegramPhase2 = Object.freeze({ open: openModal, createLink: generateBindingLink, unbind: unbindTelegram, refresh: () => loadSnapshot(true), queueSecurityNotification });
  window.SRRuntime?.register(apply);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { lastSnapshotAt = 0; window.SRRuntime?.schedule?.(); } });
  apply();
"""
new_export = """  window.SRTelegramBound = () => hasActiveBinding(lastSnapshot);
  window.SROpenTelegramBinding = openModal;
  window.SRTelegramPhase2 = Object.freeze({ open: openModal, createLink: generateBindingLink, unbind: unbindTelegram, refresh: () => loadSnapshot(true), queueSecurityNotification, isBound: () => hasActiveBinding(lastSnapshot) });
  captureTelegramIntent();
  window.SRRuntime?.register(apply);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { lastSnapshotAt = 0; window.SRRuntime?.schedule?.(); } });
  apply();
"""
if old_export not in text:
    raise SystemExit('Telegram export block not found')
text = text.replace(old_export, new_export, 1)

app_path.write_text(text, encoding='utf-8')

index_path = Path('index.html')
index = index_path.read_text(encoding='utf-8')
old_version = 'app.js?v=20260716-telegram-phase2-1-v1'
new_version = 'app.js?v=20260716-telegram-phase2-2-v1'
if old_version not in index:
    raise SystemExit('Expected app.js cache version not found')
index_path.write_text(index.replace(old_version, new_version, 1), encoding='utf-8')
