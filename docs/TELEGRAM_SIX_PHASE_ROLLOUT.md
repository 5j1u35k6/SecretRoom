# SecretRoom Telegram 六階段整合與上線手冊

## 已完成的系統目標

1. Telegram 取代 EmailJS 的外部通知與密碼救援。
2. 平台通知與 Telegram 外部通知使用不同集合與設定。
3. 會員與管理員登入改用 Firebase Custom Token。
4. 舊明文密碼可遷移到後端專用的 PBKDF2-SHA256 憑證集合。
5. Bot 透過可信任的 Cloudflare Worker 正式讀寫 Firestore。
6. 忘記密碼由平台申請、Telegram 被動確認，傳送失敗會回滾。
7. 永久刪除帳號與管理員權限異動仍保留後台人工操作。

## 主要檔案

- `telegram/cloudflare-worker.js`：Telegram Bot、Firebase Custom Token、Firestore 後端、通知 Queue。
- `telegram/wrangler.toml`：Worker 與每五分鐘 Queue 重試排程。
- `sr_backend_config.js`：前台與後台共用的 Worker URL 設定。
- `app_bootstrap.js`：載入前台並停用 EmailJS。
- `sr_auth_migration.js`：會員註冊、登入、忘記密碼與強制改密碼。
- `sr_telegram_platform.js`：綁定、通知偏好及申請進度。
- `admin_bootstrap.js`：載入後台並接上 Telegram bridge。
- `sr_admin_auth.js`：管理員 Firebase Custom Token 登入。
- `sr_emailjs_telegram_bridge.js`：將舊後台通知呼叫導向 Telegram 後端。
- `sr_telegram_admin.js`：Queue、舊密碼遷移及後台流程調整。
- `firestore.rules`：Custom Claims 安全規則。

## Cloudflare Worker 必要設定

進入 Cloudflare：

`Workers & Pages → secretroom-telegram-webhook → Settings → Variables and Secrets`

### Secrets

- `TELEGRAM_BOT_TOKEN`：BotFather 提供的 Bot Token。
- `TELEGRAM_WEBHOOK_SECRET`：目前 Telegram setWebhook 使用的 Secret Token。
- `FIREBASE_SERVICE_ACCOUNT_JSON`：Firebase 服務帳戶 JSON 的完整內容。
- `FIREBASE_WEB_API_KEY`：從目前前台 `firebaseConfig.apiKey` 複製。

### 一般變數

- `FIREBASE_PROJECT_ID`：`secretroom-ef728`
- `SECRETROOM_URL`：`https://5j1u35k6.github.io/SecretRoom/`
- `BOT_USERNAME`：`SecretRoomtwBot`
- `ALLOWED_ORIGINS`：`https://5j1u35k6.github.io`

不可將服務帳戶 JSON、Bot Token 或 Webhook Secret 提交到 GitHub。

## Firebase 服務帳戶

在 Firebase Console：

1. 開啟 `專案設定`。
2. 進入 `服務帳戶`。
3. 點選 `產生新的私密金鑰`。
4. 下載 JSON。
5. 將 JSON 完整內容貼入 Cloudflare Secret `FIREBASE_SERVICE_ACCOUNT_JSON`。
6. 私密金鑰檔使用完後放在安全位置，不要上傳到 GitHub 或雲端硬碟公開分享。

Worker 使用這個服務帳戶：

- 簽發 Firebase Custom Token。
- 透過 Firestore REST API 執行後端專用操作。
- 讀寫瀏覽器不可直接存取的憑證、綁定 Token 與通知 Queue。

## 部署 Worker

可使用 Cloudflare 線上編輯器，將 `telegram/cloudflare-worker.js` 完整覆蓋後部署。

使用 Wrangler 時：

```bash
cd telegram
npx wrangler deploy
```

`wrangler.toml` 已設定每五分鐘處理一次未完成的 Telegram Queue。

部署完成後記下 Worker 的 `https://...workers.dev` 網址。

## 設定平台後端網址

打開 `sr_backend_config.js`：

```javascript
window.SecretRoomBackendConfig = Object.freeze({
  backendUrl: 'https://你的-worker.workers.dev',
  firebaseApiKey: '保留現有值',
  strictAuth: true
});
```

正式啟用前先保持 `strictAuth: false`。完成測試與憑證遷移後，再改成 `true`。

## Telegram Webhook

更新後的 Worker 已直接處理 Telegram，不再需要 Apps Script 轉送業務邏輯。

Webhook URL 保持指向 Worker 網址，並使用與 Cloudflare `TELEGRAM_WEBHOOK_SECRET` 相同的 `secret_token`。

Apps Script 可以保留作為短期回退版本；確認新版 Worker 穩定後再停止使用。

## 資料集合

### 會員與驗證

- `applications`：會員資料，不再保存明文密碼。
- `credentials`：會員 PBKDF2 憑證，僅後端可讀寫。
- `admins`：管理員基本資料與權限。
- `admin_credentials`：管理員 PBKDF2 憑證，僅後端可讀寫。

### Telegram

- `telegram_binding_tokens`：一次性綁定 Token 的 SHA-256。
- `telegram_bindings`：Telegram ID 與會員 ID 的唯一對照。
- `telegram_updates`：Webhook `update_id` 去重紀錄。
- `telegram_notification_queue`：待發送及重試通知。
- `telegram_delivery_logs`：成功發送紀錄。

### 申請與平台通知

- `password_reset_requests`：平台先建立、Bot 被動處理的忘記密碼申請。
- `account_requests`：帳號刪除等仍需人工處理的申請。
- `notifications`：SecretRoom 平台內通知。
- `notification_reads`：平台通知已讀狀態。

## 舊密碼遷移

在部署新 Firestore Rules 前必須完成。

1. 先部署 Worker，但保持現有 Firestore Rules。
2. 在 `sr_backend_config.js` 填入 Worker URL，先保持 `strictAuth: false`。
3. 進入管理後台並安全登入。
4. 點擊 `遷移舊密碼`。
5. 重複執行，直到畫面顯示遷移數量為 `0`。
6. 在 Firestore 確認：
   - `credentials` 已建立會員憑證。
   - `applications` 不再包含 `password`。
7. 管理員首次安全登入時，系統會自動建立 `admin_credentials`，並移除 `admins` 內的舊 `password` 或 `passwordHash`。

## Firestore Rules 上線順序

1. 完成所有會員憑證遷移。
2. 使用一般會員測試 Custom Token 登入。
3. 使用管理員測試 Custom Token 登入。
4. 確認綁定連結、通知設定與忘記密碼正常。
5. 將 `firestore.rules` 發布至 Firebase。
6. 將 `sr_backend_config.js` 的 `strictAuth` 改為 `true`。

不可先發布新 Rules；否則尚未遷移或仍使用匿名登入的舊流程會失去權限。

## 忘記密碼與回滾

流程：

1. 使用者在平台登入視窗點 `忘記密碼`。
2. 平台後端建立 30 分鐘有效的 pending 申請。
3. 使用者到 Telegram 點 `忘記密碼`。
4. Bot 驗證 Telegram 綁定及 pending 申請。
5. 後端建立 10 分鐘有效的臨時密碼雜湊。
6. Bot 傳送臨時密碼。
7. 傳送成功後申請標記 completed。
8. 傳送失敗時，後端原子化還原原憑證、會員密碼旗標與申請狀態。
9. 使用者用臨時密碼登入後，平台強制設定新密碼。

管理員後台的舊「設定新密碼」按鈕會被停用，顯示為等待會員 Telegram 確認。

## EmailJS 移除

- `index.html` 已移除 EmailJS CDN。
- `portal_sr_x892.html` 已移除 EmailJS CDN。
- `app.js` 與 `admin.js` 的 EmailJS 金鑰由 GitHub Actions 移除。
- 舊後台 `emailjs.send` 呼叫由本地 bridge 導向 Telegram 後端，不再連線 EmailJS。
- 平台內通知仍寫入 `notifications`，不會自動發送 Telegram。

## 驗收清單

- `/start` 只回覆一次並顯示新主選單。
- 同一綁定 Token 只能使用一次。
- 同一 Telegram 不可綁定兩個會員。
- 同一會員不可綁定兩個 Telegram。
- 無平台 pending 申請時，Bot 不產生臨時密碼。
- 臨時密碼 10 分鐘後不可登入。
- 臨時密碼登入後必須立即改密碼。
- Telegram 傳送失敗時，舊密碼仍可使用。
- security 通知不可關閉。
- review、service、promotion 可獨立設定。
- 平台公告只出現在平台通知。
- Telegram 發送結果出現在 Queue 與 delivery logs。
- GitHub 程式碼內沒有 EmailJS Public Key、Service ID 或服務帳戶私鑰。
