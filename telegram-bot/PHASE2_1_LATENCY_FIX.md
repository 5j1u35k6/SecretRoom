# SecretRoom Telegram Bot — Phase 2.1

This release repairs the member settings button and reduces Bot command latency while EmailJS remains active.

## Frontend

- Telegram settings uses capture-phase event delegation instead of a replaceable button handler.
- The member Telegram card is redrawn only when account, view, or binding status changes.
- The settings modal opens immediately with a loading state.
- Firestore loading has a visible 10-second timeout, error message, and retry action.
- The `app.js` cache version is refreshed so browsers receive the repaired runtime.

## Apps Script

- `/settings` immediately sends a loading card and edits that card when data is ready.
- Telegram-to-SecretRoom account mapping is cached for 120 seconds.
- Notification preferences and member summaries are cached for 60 seconds.
- The Bot no longer writes `lastInteractionAtMs` during every command.
- Configuration properties are read once per Apps Script execution.
- Webhook failures produce a visible Telegram error card instead of silently ending.
- Website preference changes are reflected after the short preference cache expires.

## Deployment

1. Replace the existing Apps Script `Code.gs` with the Phase 2.1 package.
2. Deploy a **New version** of the existing Web App.
3. Run `setupTelegramBot()` once.
4. Run `resetTelegramWebhookAndDropPending()` once.
5. Run `getTelegramWebhookInfo()` and confirm `pending_update_count` returns to `0`.
6. Test `/settings` twice. The first request may include a short cold-start delay; the second should be materially faster.

No Script Properties need to be changed. Do not place the Bot Token in GitHub or frontend code.
