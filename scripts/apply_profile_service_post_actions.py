from pathlib import Path
import re

APP = Path('app.js')
INDEX = Path('index.html')
text = APP.read_text(encoding='utf-8')

# 1) Place the per-post hide action in the header action group rather than at
#    the bottom of the card, so it does not increase card height.
hide_pattern = re.compile(
    r"  function addHideButtons\(\) \{[\s\S]*?\n  \}\n\n  function addBlockButton\(\)",
    re.M,
)
hide_replacement = '''  function addHideButtons() {
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

  function addBlockButton()'''
text, hide_count = hide_pattern.subn(hide_replacement, text, count=1)
if hide_count != 1:
    raise SystemExit('Unable to replace addHideButtons')

# 2) Replace the fixed Telegram service chip with a compact full-width entry
#    on the profile page, immediately above the 2x2 profile action grid.
text = text.replace(
    "  let syncSequence = 0;\n",
    "  let syncSequence = 0;\n  let entryUserId = '';\n  let entryRestoring = false;\n",
    1,
)

entry_pattern = re.compile(
    r"  function removeEntryButton\(\) \{[\s\S]*?\n  \}\n\n  async function syncEntryButton",
    re.M,
)
entry_replacement = '''  function profileEntryHost() {
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

    button.dataset.memberUserId = entryUserId;
    button.dataset.authState = entryRestoring ? 'restoring' : 'verified';
    button.disabled = false;
    button.className = 'w-full rounded-2xl border border-sky-400/25 bg-sky-500/10 px-4 py-3 text-left flex items-center justify-between gap-3 text-sky-100 shadow-lg transition hover:bg-sky-500/15 click-press';
    button.innerHTML = `<span class="flex items-center gap-3 min-w-0"><span class="w-10 h-10 rounded-full bg-sky-400/15 border border-sky-400/20 flex items-center justify-center shrink-0"><i class="fa-brands fa-telegram text-sky-300"></i></span><span class="min-w-0"><strong class="block text-sm font-black truncate">Telegram 會員服務</strong><span class="block text-xs text-slate-400 mt-0.5 truncate">@${entryUserId}${entryRestoring ? ' · 身分同步中' : ' · 綁定、通知與申請進度'}</span></span></span><i class="fa-solid fa-chevron-right text-sky-300 shrink-0"></i>`;

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

  async function syncEntryButton'''
text, entry_count = entry_pattern.subn(entry_replacement, text, count=1)
if entry_count != 1:
    raise SystemExit('Unable to replace Telegram entry functions')

runtime_marker = "  window.addEventListener('sr:member-auth-changed', () => scheduleSync(50, true));"
if runtime_marker not in text:
    raise SystemExit('Unable to find Telegram runtime marker')
text = text.replace(
    runtime_marker,
    "  window.SRRuntime?.register(renderProfileEntryButton);\n\n" + runtime_marker,
    1,
)

APP.write_text(text, encoding='utf-8')

index = INDEX.read_text(encoding='utf-8')
index, cache_count = re.subn(
    r'app\.js\?v=[^"\']+',
    'app.js?v=20260719-profile-service-post-actions-v1',
    index,
    count=1,
)
if cache_count != 1:
    raise SystemExit('Unable to update app.js cache version')
INDEX.write_text(index, encoding='utf-8')
