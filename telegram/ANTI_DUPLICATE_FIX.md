# Telegram duplicate-message fix

## Problem

The Phase 1 bot used `sendMessage` for every inline-keyboard callback. Rapid taps therefore created a new message for every action. Telegram may also resend the same webhook update when the endpoint is slow or times out.

## Applied design

1. Deduplicate every webhook by `update_id` for six hours using Apps Script `CacheService` guarded by `LockService`.
2. Debounce the same callback action for three seconds using `chat_id + message_id + callback_data`.
3. Use `editMessageText` for inline-keyboard navigation so the current bot card is updated in place instead of creating a new card.
4. Ignore Telegram's `message is not modified` response.
5. Add `resetTelegramWebhookAndDropPending()` to clear callbacks that were queued before this upgrade.
6. Set `drop_pending_updates: true` when the webhook is installed.

## Deployment steps

Replace the existing Apps Script `Code.gs` with the updated Phase 1 package, create a new Web App version, and run `resetTelegramWebhookAndDropPending()` once. Existing Script Properties remain unchanged.

## Expected result

- Repeated delivery of the same `update_id` produces no second response.
- Rapidly tapping the same button shows a short `處理中，請稍候` callback notice.
- Navigating Account, Status, Rank, Settings, and Home edits the existing message instead of adding another message.
- EmailJS remains active and is not changed by this patch.
