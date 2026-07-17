# SecretRoom Telegram Phase 1～6 部署說明

此分支將 Telegram 作為 SecretRoom 的外部通知與帳號安全通道；平台內通知仍維持獨立。

## 六個階段

1. 帳號綁定：平台產生 10 分鐘一次性連結，Bot 驗證後建立正式 binding。
2. 忘記密碼：使用者先在平台申請，Bot 驗證已綁定的 Telegram 身分後，發出 10 分鐘一次性重設連結；使用者回平台自行設定新密碼。
3. 會員通知設定：安全通知固定開啟，其他 Telegram 類型可調整。
4. Telegram outbox：發送紀錄、失敗狀態、單筆與全部重送。
5. 管理員通知：新申請與帳號安全待辦送到管理員 Telegram。
6. EmailJS 遷移：既有 `emailjs.send()` 由相容橋接層改寫入 Telegram outbox；平台通知不受影響。

## GitHub Pages 檔案

- `index.html`
- `portal_sr_x892.html`
- `sr_emailjs_telegram_bridge.js`
- `sr_telegram_phase6.js`
- `sr_telegram_recovery_completion.js`
- `sr_admin_telegram_phase6.js`
- `firestore.rules`

## Apps Script

Apps Script 已拆成多個完整 `.gs` 檔案，位於 `apps-script/`：

- `00_Config.gs`
- `01_Webhook.gs`
- `02_MenuBinding.gs`
- `03_Recovery.gs`
- `04_SettingsRequests.gs`
- `05_CallbackDelivery.gs`
- `06_TelegramApiFirestore.gs`
- `07_DeployUtils.gs`

在 Apps Script 左側逐一新增同名檔案並完整貼入；不要與舊版同名函式混用。`appsscript.json` 則放入「專案設定 → 在編輯器中顯示 appsscript.json 資訊清單檔案」後覆蓋。

### 必要指令碼屬性

| 屬性 | 內容 |
|---|---|
| `TELEGRAM_BOT_TOKEN` | BotFather Token |
| `TELEGRAM_WEBHOOK_KEY` | Cloudflare 轉送 Apps Script 使用的 key |
| `WEB_APP_URL` | Apps Script `/exec` 網址 |
| `CLOUDFLARE_WORKER_URL` | `https://...workers.dev` |
| `CLOUDFLARE_WEBHOOK_SECRET` | 與 Worker 的 `TELEGRAM_WEBHOOK_SECRET` 相同 |
| `FIREBASE_PROJECT_ID` | `secretroom-ef728` |
| `FIREBASE_APP_ID` | `secretg-production-node-tw` |
| `FIREBASE_CLIENT_EMAIL` | Service Account 的 `client_email` |
| `FIREBASE_PRIVATE_KEY` | Service Account 的 `private_key` |
| `SECRETROOM_URL` | `https://5j1u35k6.github.io/SecretRoom/` |
| `TELEGRAM_ADMIN_CHAT_IDS` | 管理員 Telegram chat ID，多筆用逗號分隔 |

### 建立 Firebase Service Account（免費）

1. 進入 Firebase Console。
2. 選擇 `secretroom-ef728`。
3. 點齒輪「專案設定」。
4. 點「服務帳戶」。
5. 點「產生新的私密金鑰」。
6. 下載 JSON。
7. 將 JSON 的 `client_email` 放入 `FIREBASE_CLIENT_EMAIL`。
8. 將 JSON 的 `private_key` 完整放入 `FIREBASE_PRIVATE_KEY`。
9. 私密金鑰不得上傳 GitHub。

### Apps Script 執行順序

1. 執行 `checkTelegramConfiguration`。
2. 執行 `testFirebaseServiceAccount`。
3. 執行 `testTelegramBotConnection`。
4. 更新 Web App 部署為「新版本」。
5. 執行 `setupTelegramWebhook`。
6. 執行 `installTelegramMaintenanceTrigger`。

`installTelegramMaintenanceTrigger` 建立的每分鐘觸發器只處理外送通知與管理員提醒，不使用 `getUpdates`，不會改變使用者訊息的即時 Webhook 回覆。

## Cloudflare Worker

將 `cloudflare-worker.js` 貼入目前 Worker。

### Worker Secrets

| 名稱 | 內容 |
|---|---|
| `TELEGRAM_WEBHOOK_SECRET` | 與 Apps Script 的 `CLOUDFLARE_WEBHOOK_SECRET` 相同 |
| `APPS_SCRIPT_WEBHOOK_URL` | `WEB_APP_URL?key=TELEGRAM_WEBHOOK_KEY` |

## 帳號復原流程

1. 使用者先在 SecretRoom 建立忘記密碼申請。
2. Bot 只接受已綁定 Telegram 身分的會員。
3. Bot 建立 `telegram_recovery_tokens` 的 10 分鐘一次性 Token。
4. Bot 發送受保護的 SecretRoom 重設連結。
5. 使用者回平台自行設定新密碼。
6. Token 與申請狀態立即標記完成，不能重複使用。

新密碼不會寫入 Telegram outbox、管理員通知或發送紀錄。

## Firestore Rules

`firestore.rules` 已從 `allow read, write: if true` 改為至少要求 Firebase Auth；復原 Token 禁止集合列舉，只允許持有完整 Token ID 的登入工作階段單筆讀取與更新。

目前平台仍使用匿名 Firebase Auth 搭配自訂帳密，因此這是過渡規則，不等同真正逐會員隔離。Service Account 後端不受 Rules 限制。真正逐帳號隔離仍需後續遷移至 Firebase Auth／Custom Token。

## 發布順序

1. 先部署 Apps Script 與 Worker。
2. 測試 Bot `/menu`、`/bind`、`/reset`、`/settings`。
3. 發布 GitHub Pages 新模組。
4. 確認一次性復原連結與 Telegram outbox 能正常運作。
5. 最後發布 Firestore Rules。
6. 保留舊規則備份，若前台出現 `permission-denied`，先回滾 Rules，再檢查缺少的集合規則。
