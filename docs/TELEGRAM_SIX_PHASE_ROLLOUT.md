# SecretRoom Telegram 六階段整合

## 目標

1. Telegram 取代 Email 綁定與外部通知。
2. 忘記密碼改為平台申請、Telegram 被動確認。
3. 降低管理員手動操作。
4. 平台通知與 Telegram 通知分流。

## 第一階段：即時 Webhook 與選單

- Telegram -> Cloudflare Worker -> Apps Script。
- 主選單：帳號綁定、忘記密碼、通知設定、申請進度、開啟平台。
- 使用 update_id 去重。

## 第二階段：一次性帳號綁定

- 平台產生 10 分鐘一次性 Token。
- Firestore 只保存 Token SHA-256。
- Bot 驗證到期、使用狀態、會員與 Telegram 重複綁定。
- 同一 Telegram 只能綁一個會員；同一會員只能綁一個 Telegram。

## 第三階段：被動忘記密碼

- 使用者必須先在平台建立 pending 申請。
- Bot 只處理已綁定 Telegram 的會員。
- 臨時密碼有效 10 分鐘；登入後強制變更。
- Telegram 發送失敗時必須還原憑證狀態。
- 帳號刪除與管理員移除仍由後台人工確認。

## 第四階段：通知分流

- 平台通知：notifications / notification_reads。
- Telegram 外部通知：telegram_notification_queue。
- 發送紀錄：telegram_delivery_logs。
- security 類通知不可關閉；review、service、promotion 可調整。

## 第五階段：管理員自動化

- 審核結果自動建立 Telegram queue。
- 管理員 Bot 只提供待辦提醒與後台連結。
- 永久刪除、管理員權限異動等高風險操作不在 Bot 直接執行。

## 第六階段：停用 EmailJS

停用前必須確認：

- 綁定成功率與重複綁定檢查正常。
- 忘記密碼 Telegram 發送與回滾正常。
- Queue、delivery log、失敗重送正常。
- 未綁定 Telegram 的舊會員已有遷移方案。

完成後移除 index.html 與 portal_sr_x892.html 的 EmailJS SDK，以及 app.js/admin.js 的 EmailJS 設定與呼叫。

## 目前分支內容

- `telegram/cloudflare-worker.js`
- `sr_telegram_platform.js`
- `sr_telegram_admin.js`
- `firestore.rules`
- `index.html` 已載入前台 Telegram 模組

## 重要部署阻擋

目前平台使用自製帳密與匿名 Firebase 連線，Firestore Rules 無法從 `request.auth` 辨識 SecretRoom 會員或管理員。新的 rules 假設未來會簽發：

- `secretroomUserId`
- `secretroomAdmin`

在完成 Firebase Auth / Custom Token 遷移前，**不可部署本分支的 firestore.rules**，否則現有前台與後台會失去資料權限。

同理，`sr_telegram_platform.js` 目前是整合介面與資料模型實作；正式上線前，綁定 Token 與忘記密碼寫入應改由可信任後端完成，不能長期依賴瀏覽器直接寫入敏感集合。
