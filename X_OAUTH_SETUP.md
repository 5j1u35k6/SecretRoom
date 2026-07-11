# SecretRoom X OAuth 設定與部署

SecretRoom 現在使用 **X OAuth 2.0 Authorization Code Flow with PKCE**，但授權碼交換與 `/2/users/me` 查詢已改由 Firebase Cloud Functions 執行。瀏覽器不再直接呼叫 X token API，因此可避開原本的 CORS `Failed to fetch` 問題。

## 目前已完成的程式

前端：

- `sr_x_oauth_config.js`
- `sr_x_oauth_backend_client.js`
- `sr_x_oauth_ui.js`

後端：

- `functions/x-oauth-start.js`
- `functions/x-oauth-complete.js`
- `functions/lib/`
- `firebase.json`
- `.firebaserc`

後端包含：

- SecretRoom 帳號與密碼再次確認
- 15 分鐘內最多 8 次嘗試，超過後暫停 30 分鐘
- 10 分鐘一次性 OAuth 工作階段
- PKCE `state`、`code_verifier`、`code_challenge`
- X `/2/users/me` 官方身分確認
- 同一個 X 帳號不得綁定多個 SecretRoom 帳號
- 驗證完成後嘗試撤銷 X access token
- access token 不寫入 Firestore

## 一、X Developer Console 設定

目前你選擇的設定可以維持：

- **App permissions**：`Read`
- **Request email from users**：關閉
- **Type of App**：`Native App`（Public client）

Callback URI 必須完全一致：

```text
https://5j1u35k6.github.io/SecretRoom/
```

Website URL：

```text
https://5j1u35k6.github.io/SecretRoom/
```

不需要 Client Secret，也不要把 Client Secret 放進 GitHub、前端或 Firebase Functions 環境變數。這套流程使用 Public client 的 PKCE。

## 二、Firebase 必要條件

Firebase 專案：

```text
secretroom-ef728
```

部署 Cloud Functions 前需要：

1. Firebase 專案已啟用 Cloud Firestore。
2. Firebase 專案升級為 Blaze 方案。
3. 電腦已安裝 Node.js 20。
4. 使用可管理 `secretroom-ef728` 的 Google 帳號登入 Firebase CLI。

## 三、下載或開啟專案

在終端機進入 SecretRoom 專案根目錄，也就是能看到以下檔案的位置：

```text
firebase.json
.firebaserc
functions/
index.html
```

若尚未下載 repo：

```bash
git clone https://github.com/5j1u35k6/SecretRoom.git
cd SecretRoom
```

若已經有本機專案：

```bash
git pull origin main
```

## 四、安裝 Functions 套件

```bash
cd functions
npm install
npm run check
cd ..
```

`npm run check` 應完成且沒有 JavaScript 語法錯誤。

## 五、登入 Firebase CLI

```bash
npx firebase-tools@latest login
```

瀏覽器會開啟 Google 登入頁，請使用有權限管理 `secretroom-ef728` 的 Google 帳號登入。

確認專案：

```bash
npx firebase-tools@latest use secretroom-ef728
```

## 六、部署兩個 X OAuth Functions

執行：

```bash
npx firebase-tools@latest deploy --only functions:xOAuthStart,functions:xOAuthComplete
```

第一次部署時，Firebase CLI 會詢問參數。

### X_CLIENT_ID

輸入 X Developer Console 顯示的 OAuth 2.0 Client ID。

```text
X_CLIENT_ID = 你的 X OAuth 2.0 Client ID
```

這是 Public client 的公開 Client ID，不是 Client Secret。

### X_REDIRECT_URI

直接使用預設值：

```text
https://5j1u35k6.github.io/SecretRoom/
```

部署成功後，預期會產生：

```text
https://asia-east1-secretroom-ef728.cloudfunctions.net/xOAuthStart
https://asia-east1-secretroom-ef728.cloudfunctions.net/xOAuthComplete
```

這兩個網址已經填入 `sr_x_oauth_config.js`。

## 七、部署後測試

1. 強制重新整理 SecretRoom。
2. 登入 SecretRoom 帳號。
3. 開啟個人資料。
4. 點擊「驗證 X」。
5. 再次輸入 SecretRoom 密碼。
6. 點擊「使用 X 官方驗證」。
7. 前往 X 官方授權頁並同意。
8. 回到 SecretRoom。
9. 畫面應顯示：

```text
X 帳號 @你的帳號 已完成官方驗證。
```

會員文件會寫入：

```text
xInfo.id
xInfo.handle
xInfo.name
xInfo.profileImageUrl
xInfo.profileUrl
xInfo.verificationStatus = "oauth_verified"
socialBindingProvider = "x_oauth"
```

另外會建立：

```text
secretg_apps/secretg-production-node-tw/x_account_bindings/{X_USER_ID}
secretg_apps/secretg-production-node-tw/x_oauth_events/{EVENT_ID}
```

## 八、常見錯誤

### X 驗證後端尚未部署、連線被阻擋，或網路暫時中斷

通常表示 Cloud Functions 尚未部署成功，或 Functions URL 無法存取。重新執行：

```bash
npx firebase-tools@latest deploy --only functions:xOAuthStart,functions:xOAuthComplete
```

### 這個來源不能使用 X 驗證服務

目前後端只允許：

```text
https://5j1u35k6.github.io
```

若未來改用自訂網域，需要同步更新：

```text
functions/lib/config.js
```

### SecretRoom 帳號或密碼不正確

X 驗證開始前會重新確認 SecretRoom 密碼。密碼不會寫入 OAuth 工作階段或操作紀錄。

### X 沒有接受這次授權

請檢查：

- X Client ID 是否正確
- Callback URI 是否完全一致
- App permissions 是否為 Read
- Type of App 是否為 Native App / Public client
- 授權後是否在短時間內返回 SecretRoom

### 這個 X 帳號已綁定其他 SecretRoom 帳號

同一個 X user ID 只能對應一個 SecretRoom 帳號。需要先解除原本綁定，再綁定新的帳號。

## 九、可選：Firestore TTL

OAuth 工作階段已包含 `expiresAt` 與 `expiresAtMs`。若要自動清除未完成的過期工作階段，可以在 Firestore 的 TTL 設定中，對以下 Collection Group 啟用 `expiresAt`：

```text
x_oauth_sessions
```

即使未啟用 TTL，過期工作階段也不能再次使用；TTL 只負責清理資料。
