# SecretRoom X OAuth 設定

目前前台已完成 X OAuth 2.0 Authorization Code Flow with PKCE 與 `/2/users/me` 帳號驗證流程。啟用前仍需在 X Developer Console 建立或設定 App。

## X Developer Console

1. 在 App 的 User authentication settings 啟用 OAuth 2.0。
2. App type 選擇 Single Page App（Public client）。
3. Callback URI 必須完整填入：

   `https://5j1u35k6.github.io/SecretRoom/`

4. Website URL 可填：

   `https://5j1u35k6.github.io/SecretRoom/`

5. 權限範圍使用：
   - `tweet.read`
   - `users.read`
6. 從 Keys and Tokens 取得 Client ID。

## 專案設定

編輯 `sr_x_oauth_config.js`：

```js
window.SR_X_OAUTH_CONFIG = Object.freeze({
  clientId: '貼上 X Client ID',
  redirectUri: 'https://5j1u35k6.github.io/SecretRoom/',
  scopes: Object.freeze(['tweet.read', 'users.read'])
});
```

Client ID 可以放在前端；Client Secret 不可寫入 GitHub 或任何前端檔案。

## 驗證結果

驗證完成後，會員資料會寫入：

- `xInfo.id`
- `xInfo.handle`
- `xInfo.name`
- `xInfo.profileImageUrl`
- `xInfo.verificationStatus = "oauth_verified"`
- `socialBindingProvider = "x_oauth"`

存取權杖只用於讀取 `/2/users/me`，完成後會嘗試立即撤銷，不寫入 Firestore。
