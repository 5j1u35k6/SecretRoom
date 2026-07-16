# SecretRoom Telegram Bot — Phase 1.1 deployment

This update fixes repeated message cards without changing Script Properties, Firestore collections, or EmailJS.

## Changes

- Webhook `update_id` deduplication for six hours.
- Three-second debounce for repeated taps on the same inline button.
- Inline navigation edits the current Telegram message instead of sending a new message.
- `message is not modified` is treated as success.
- A one-time reset function clears callbacks queued before the upgrade.

## Apps Script update

1. Open the existing `SecretRoom Telegram Bot` Apps Script project.
2. Replace the current `Code.gs` with the Phase 1.1 `Code.gs` from the updated installation package.
3. Click **Deploy → Manage deployments**.
4. Open the existing Web App deployment and click the pencil icon.
5. Under **Version**, choose **New version**.
6. Keep **Execute as: Me** and **Who has access: Anyone** unchanged.
7. Click **Deploy**.
8. In the function selector, choose `resetTelegramWebhookAndDropPending`.
9. Click **Run** once and approve authorization if requested.
10. Run `getTelegramWebhookInfo` and confirm `pending_update_count` is `0` or quickly returns to `0`.

Do not create new Script Properties and do not paste the Bot Token into GitHub.

## Verification

- Send `/start` once.
- Tap `我的帳號`, `審核進度`, `本週位階`, and `通知設定` repeatedly.
- The existing bot card should change in place.
- Rapidly tapping the same button should not create duplicate cards.
- EmailJS remains enabled during this phase.
