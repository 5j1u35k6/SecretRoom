from pathlib import Path

path = Path('app.js')
text = path.read_text(encoding='utf-8')
old = '''    button.dataset.memberUserId = entryUserId;
    button.dataset.authState = entryRestoring ? 'restoring' : 'verified';
    button.disabled = false;
    button.className = 'w-full rounded-2xl border border-sky-400/25 bg-sky-500/10 px-4 py-3 text-left flex items-center justify-between gap-3 text-sky-100 shadow-lg transition hover:bg-sky-500/15 click-press';
    button.innerHTML = `<span class="flex items-center gap-3 min-w-0"><span class="w-10 h-10 rounded-full bg-sky-400/15 border border-sky-400/20 flex items-center justify-center shrink-0"><i class="fa-brands fa-telegram text-sky-300"></i></span><span class="min-w-0"><strong class="block text-sm font-black truncate">Telegram 會員服務</strong><span class="block text-xs text-slate-400 mt-0.5 truncate">@${entryUserId}${entryRestoring ? ' · 身分同步中' : ' · 綁定、通知與申請進度'}</span></span></span><i class="fa-solid fa-chevron-right text-sky-300 shrink-0"></i>`;

    const grid = document.getElementById('sr-profile-action-grid');'''
new = '''    const signature = `${entryUserId}|${entryRestoring ? 'restoring' : 'verified'}`;
    if (button.dataset.srProfileServiceSignature !== signature) {
      button.dataset.srProfileServiceSignature = signature;
      button.dataset.memberUserId = entryUserId;
      button.dataset.authState = entryRestoring ? 'restoring' : 'verified';
      button.disabled = false;
      button.className = 'w-full rounded-2xl border border-sky-400/25 bg-sky-500/10 px-4 py-3 text-left flex items-center justify-between gap-3 text-sky-100 shadow-lg transition hover:bg-sky-500/15 click-press';
      button.innerHTML = `<span class="flex items-center gap-3 min-w-0"><span class="w-10 h-10 rounded-full bg-sky-400/15 border border-sky-400/20 flex items-center justify-center shrink-0"><i class="fa-brands fa-telegram text-sky-300"></i></span><span class="min-w-0"><strong class="block text-sm font-black truncate">Telegram 會員服務</strong><span class="block text-xs text-slate-400 mt-0.5 truncate">@${entryUserId}${entryRestoring ? ' · 身分同步中' : ' · 綁定、通知與申請進度'}</span></span></span><i class="fa-solid fa-chevron-right text-sky-300 shrink-0"></i>`;
    }

    const grid = document.getElementById('sr-profile-action-grid');'''
if old not in text:
    raise SystemExit('Profile service render block was not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
