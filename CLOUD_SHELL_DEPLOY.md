# 使用 Google Cloud Shell 部署 X OAuth

不需要在自己的電腦建立 SecretRoom 專案資料夾，也不需要先安裝 Node.js 或 Firebase CLI。整個流程都可以在瀏覽器完成。

## 1. 開啟 Google Cloud Console

使用可管理 Firebase 專案 `secretroom-ef728` 的 Google 帳號登入 Google Cloud Console。

確認目前選取的專案是：

```text
secretroom-ef728
```

## 2. 開啟 Cloud Shell

點擊右上角的 Cloud Shell 終端機圖示 `>_`。

等終端機完成啟動後，貼上：

```bash
git clone https://github.com/5j1u35k6/SecretRoom.git
cd SecretRoom
bash deploy-x-oauth.sh
```

## 3. 完成 Firebase CLI 登入

Cloud Shell 會使用遠端登入模式。

畫面出現登入網址時：

1. 開啟該網址。
2. 使用可管理 `secretroom-ef728` 的 Google 帳號登入。
3. 同意 Firebase CLI 權限。
4. 將畫面顯示的授權碼貼回 Cloud Shell。

## 4. 輸入部署參數

第一次部署若詢問 `X_CLIENT_ID`，貼上 X Developer Console 的 OAuth 2.0 Client ID。

若詢問 `X_REDIRECT_URI`，直接按 Enter 使用預設值：

```text
https://5j1u35k6.github.io/SecretRoom/
```

## 5. 部署成功

成功時應看到兩個 Functions：

```text
xOAuthStart
xOAuthComplete
```

接著強制重新整理 SecretRoom，再測試「驗證 X」。

## 常見問題

### 專案不是 Blaze 方案

Firebase Cloud Functions 正式部署需要 Blaze 方案。請先到 Firebase Console 的 Usage and billing 升級方案，再重新執行部署。

### 權限不足

登入的 Google 帳號必須能管理 `secretroom-ef728`。若 `firebase use` 或部署時出現 permission denied，請切換到正確帳號。

### repo 已經存在

若 Cloud Shell 顯示 `SecretRoom already exists`，改用：

```bash
cd SecretRoom
git pull origin main
bash deploy-x-oauth.sh
```
