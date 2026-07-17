# SecretRoom Telegram 六階段整合

此分支建立 Telegram 身分綁定、被動式忘記密碼、通知分流、管理端發送佇列與安全規則的第一個可部署版本。

## 六個階段

1. **Telegram 主選單與即時回覆**：沿用目前 Apps Script Webhook。
2. **帳號綁定**：平台驗證帳號密碼後，由 Worker 產生 10 分鐘一次性深連結。
3. **忘記密碼自助化**：平台只建立申請；已綁定 Telegram 的會員才能在 Bot 產生 10 分鐘臨時密碼。
4. **Telegram 通知分流**：`telegram_notification_queue` 與平台 `notifications` 分開。
5. **管理員減量**：審核結果改排入 Telegram 佇列；失敗可重送，管理員不再手動產生臨時密碼。
6. **EmailJS 移除**：待 Telegram 發送成功率與失敗重送驗證後，移除 `index.html`、`portal_sr_x892.html`、`app.js`、`admin.js` 的 EmailJS 呼叫。

> 為避免現行平台因既有 EmailJS 呼叫直接中斷，本分支尚未立即刪除 EmailJS SDK。這是遷移保護，不是最終狀態。

## Cloudflare Worker 部署

將 `telegram-worker.js` 貼入現有 Worker，並設定：

- `TELEGRAM_WEBHOOK_SECRET`
- `APPS_SCRIPT_WEBHOOK_URL`
- `BOT_BACKEND_SECRET`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `SECRETROOM_ORIGIN=https://5j1u35k6.github.io`
- `BOT_USERNAME=SecretRoomtwBot`

Webhook URL 改為：

```text
https://你的-worker.workers.dev/telegram
```

## 前台設定

編輯 `sr_telegram_member.js`：

```js
const API_BASE = 'https://你的-worker.workers.dev';
```

`index.html` 已載入此模組。

## Apps Script 後端呼叫

Apps Script 需要新增指令碼屬性：

- `TELEGRAM_BACKEND_URL=https://你的-worker.workers.dev/api/bot/action`
- `BOT_BACKEND_SECRET=與 Worker 完全相同`

Bot 的綁定、忘記密碼、通知設定與申請進度，都應透過 `/api/bot/action` 呼叫，不直接讀寫 Firestore。

請求 Header：

```text
X-SecretRoom-Bot-Secret: BOT_BACKEND_SECRET
```

可用 action：

- `complete_binding`
- `account_status`
- `password_reset_check`
- `password_reset_complete`
- `update_preferences`
- `request_status`

## Firestore Rules

`firestore.rules` 已把以下敏感集合改為後端專用：

- `telegram_binding_tokens`
- `password_reset_requests`
- `telegram_notification_queue`
- `telegram_delivery_logs`
- `telegram_security_logs`
- `admin_logs`

Service Account 透過 Firestore REST 存取，不受 Rules 限制。

## 尚未直接發布的原因

此分支會改變帳號綁定與密碼救援安全邊界。合併前必須先完成：

1. Worker Secrets 設定。
2. Google Service Account 金鑰設定。
3. Apps Script Bot action 串接。
4. 測試帳號完整走過綁定、忘記密碼與重複綁定阻擋。
5. 確認 Telegram 發送佇列可被後端消化。
6. 最後才移除 EmailJS。
