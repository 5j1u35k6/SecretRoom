# SecretRoom Telegram Phase 1～6 測試清單

## Webhook

- [ ] 傳送 `/menu`，3 秒內只回覆一次。
- [ ] Apps Script 執行項目只出現一筆 `doPost`。
- [ ] `getTelegramWebhookInfo` 的 URL 為 `workers.dev`。

## 帳號綁定

- [ ] 未綁定時，Bot 顯示平台綁定入口。
- [ ] 平台可產生 10 分鐘一次性連結。
- [ ] 使用連結後建立 `telegram_bindings/{accountId}`。
- [ ] 建立 `telegram_users/{telegramUserId}`。
- [ ] Token 狀態變成 `used`。
- [ ] 相同 Telegram 不可綁定第二個會員。
- [ ] 相同會員不可綁定第二個 Telegram。
- [ ] 過期 Token 不可使用。

## 忘記密碼／帳號復原

- [ ] 未在平台申請時，Bot 不建立復原連結。
- [ ] 平台只要求會員帳號，不要求 Email。
- [ ] 已綁定會員可在 Bot 找到 pending 申請。
- [ ] Bot 驗證身分後建立 10 分鐘一次性復原 Token。
- [ ] Telegram 只傳送受保護的復原連結，不傳送新密碼。
- [ ] 使用者可在 SecretRoom 輸入自己的新密碼。
- [ ] 完成後 Token 狀態變成 `used`，申請變成 `completed`。
- [ ] 已使用或過期連結不可再次使用。
- [ ] 新密碼不出現在 Firestore outbox、管理員提醒或 delivery logs。
- [ ] 未綁定會員顯示人工例外處理，不顯示成功。

## 通知分流

- [ ] 平台通知只寫入 `notifications`。
- [ ] Telegram 外部通知只寫入 `telegram_outbox`。
- [ ] 關閉 Telegram 公告後，不影響平台內通知。
- [ ] 安全通知無法關閉。

## 管理員

- [ ] 新忘記密碼申請建立 `telegram_admin_outbox`。
- [ ] 管理員 Telegram 收到待辦提醒。
- [ ] 後台標準重設按鈕改為「轉交 Telegram 自助處理」。
- [ ] 未綁定 Telegram 的會員被標記為例外。
- [ ] Telegram 發送中心可看到 pending、sent、failed、skipped。
- [ ] 單筆失敗可重送。
- [ ] 全部失敗可重送。

## EmailJS 遷移

- [ ] 頁面不再載入 EmailJS CDN。
- [ ] 舊 `emailjs.send()` 呼叫改寫入 Telegram outbox。
- [ ] 任何包含敏感登入憑證的舊寄信呼叫被拒絕，不寫入 outbox。
- [ ] 舊 `email_failures` 只保留唯讀歷史。

## Rules

- [ ] 未登入請求無法直接讀寫 Firestore。
- [ ] 匿名 Firebase Auth 登入後平台仍可正常使用。
- [ ] `telegram_recovery_tokens` 無法列舉，只能用完整 Token ID 單筆取得。
- [ ] `telegram_delivery_logs` 無法由瀏覽器寫入。
- [ ] 後端 Service Account 可正常讀寫 Telegram 集合。
