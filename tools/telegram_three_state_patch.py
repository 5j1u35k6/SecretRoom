from pathlib import Path

path = Path('app.js')
text = path.read_text(encoding='utf-8')

old_legacy = """  const hasLegacyBindingFields = member => Boolean(
    member?.telegramBound === true ||
    member?.telegramInfo ||
    member?.telegramUserId ||
    member?.telegramChatId ||
    member?.telegramUsername
  );
"""
new_legacy = """  const hasTelegramIdentity = snapshot => {
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
"""
if old_legacy not in text:
    raise SystemExit('Legacy binding helper not found')
text = text.replace(old_legacy, new_legacy, 1)

start = text.find('  async function clearStaleBindingFields(')
end = text.find('\n  async function loadSnapshot(', start)
if start < 0 or end < 0:
    raise SystemExit('clearStaleBindingFields section not found')
new_cleanup = """  async function normalizeTelegramIdentity(snapshot, db, fs) {
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
"""
text = text[:start] + new_cleanup + text[end:]
text = text.replace('    await clearStaleBindingFields(snapshot, db, fs);', '    await normalizeTelegramIdentity(snapshot, db, fs);', 1)

old_modal_head = """    const bound = hasActiveBinding(snapshot);
    const preferences = { ...DEFAULT_PREFERENCES, ...(snapshot?.preferences || {}) };
"""
new_modal_head = """    const bound = hasActiveBinding(snapshot);
    const serviceState = telegramServiceState(snapshot);
    const identityVerified = serviceState === 'identity_verified';
    const preferences = { ...DEFAULT_PREFERENCES, ...(snapshot?.preferences || {}) };
"""
if old_modal_head not in text:
    raise SystemExit('Modal header not found')
text = text.replace(old_modal_head, new_modal_head, 1)

old_status = """        <div class=\"sr-tg-status ${bound ? 'sr-tg-bound' : 'sr-tg-unbound'}\">
          <strong>${bound ? '已完成綁定' : '尚未綁定'}</strong>
          <span>${bound ? `Telegram @${esc(snapshot?.binding?.telegramUsername || '已驗證帳號')}` : '產生短效專屬連結後，至 Telegram 完成一次性驗證。'}</span>
        </div>
"""
new_status = """        <div class=\"sr-tg-status ${bound ? 'sr-tg-bound' : 'sr-tg-unbound'}\">
          <strong>${bound ? 'Telegram 通知已啟用' : (identityVerified ? 'Telegram 身分已驗證' : '尚未綁定 Telegram')}</strong>
          <span>${bound
            ? `通知將傳送至 Telegram @${esc(snapshot?.binding?.telegramUsername || '已驗證帳號')}`
            : (identityVerified
              ? '註冊時的 Telegram 身分仍有效；只需開啟 Bot 一次，即可啟用通知。'
              : '完成 Telegram 身分連結並同時啟用 Bot 通知。')}</span>
        </div>
"""
if old_status not in text:
    raise SystemExit('Modal status block not found')
text = text.replace(old_status, new_status, 1)

old_generate = """          <button id=\"sr-tg-generate\" class=\"sr-tg-primary-button\"><i class=\"fa-brands fa-telegram\"></i> 產生並開啟綁定連結</button>
"""
new_generate = """          <button id=\"sr-tg-generate\" class=\"sr-tg-primary-button\"><i class=\"fa-brands fa-telegram\"></i> ${identityVerified ? '啟用 Telegram 通知' : '綁定 Telegram 並啟用通知'}</button>
"""
if old_generate not in text:
    raise SystemExit('Generate button not found')
text = text.replace(old_generate, new_generate, 1)

old_description = """    if (description) description.textContent = '使用 10 分鐘有效的一次性連結完成安全綁定，不需要輸入 Telegram 密碼。';
"""
new_description = """    if (description) description.textContent = '若註冊時已驗證 Telegram，只需開啟 Bot 一次即可啟用通知；不會重新驗證身分。';
"""
if old_description not in text:
    raise SystemExit('Legacy description not found')
text = text.replace(old_description, new_description, 1)

old_card = """    const bound = hasActiveBinding(snapshot);
    const signature = `${id}|${view}|${bound ? 'bound' : 'unbound'}`;
    if (card.dataset.srTgSignature === signature) return;
    card.dataset.srTgSignature = signature;
    card.innerHTML = `<div><div class=\"sr-tg-eyebrow\"><i class=\"fa-brands fa-telegram\"></i> Telegram</div><div class=\"text-sm font-black text-white mt-1\">${bound ? '通知服務已綁定' : (view === 'pending' ? '先綁定以接收審核結果' : '完成帳號綁定')}</div><div class=\"text-xs text-slate-400 mt-1\">${bound ? '可接收審核、安全與帳號狀態通知。' : '使用 10 分鐘一次性連結安全綁定。'}</div></div><button id=\"sr-tg-open-settings\" data-sr-tg-open=\"1\" class=\"sr-tg-card-button\">${bound ? '通知設定' : '立即綁定'}</button>`;
"""
new_card = """    const bound = hasActiveBinding(snapshot);
    const serviceState = telegramServiceState(snapshot);
    const identityVerified = serviceState === 'identity_verified';
    const signature = `${id}|${view}|${serviceState}`;
    if (card.dataset.srTgSignature === signature) return;
    card.dataset.srTgSignature = signature;
    card.innerHTML = `<div><div class=\"sr-tg-eyebrow\"><i class=\"fa-brands fa-telegram\"></i> Telegram</div><div class=\"text-sm font-black text-white mt-1\">${bound ? 'Telegram 通知已啟用' : (identityVerified ? 'Telegram 身分已驗證' : '尚未綁定 Telegram')}</div><div class=\"text-xs text-slate-400 mt-1\">${bound ? '可接收審核、安全與帳號狀態通知。' : (identityVerified ? '只需開啟 Bot 一次即可啟用通知，不必重新驗證身分。' : '綁定 Telegram 身分並啟用 Bot 通知。')}</div></div><button id=\"sr-tg-open-settings\" data-sr-tg-open=\"1\" class=\"sr-tg-card-button\">${bound ? '通知設定' : (identityVerified ? '啟用通知' : '立即綁定')}</button>`;
"""
if old_card not in text:
    raise SystemExit('Member card block not found')
text = text.replace(old_card, new_card, 1)

text = text.replace("['telegram', 'Telegram 綁定', telegramBound()]", "['telegram', '啟用 Telegram 通知', telegramBound()]", 1)

path.write_text(text, encoding='utf-8')
