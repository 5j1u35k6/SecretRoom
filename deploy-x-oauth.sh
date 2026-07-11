#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "找不到 Node.js。請先安裝 Node.js 20，再重新執行。"
  exit 1
fi

echo "[1/5] 安裝 Firebase Functions 套件"
cd functions
npm install --no-audit --no-fund

echo "[2/5] 檢查 JavaScript 語法"
npm run check
cd "$ROOT_DIR"

echo "[3/5] 登入 Firebase"
echo "請使用可管理 secretroom-ef728 的 Google 帳號完成授權。"
if [[ -n "${DEVSHELL_PROJECT_ID:-}" || -n "${CLOUD_SHELL:-}" ]]; then
  echo "偵測到 Google Cloud Shell，將使用遠端登入模式。"
  npx firebase-tools@latest login --no-localhost
else
  npx firebase-tools@latest login
fi

echo "[4/5] 選用 Firebase 專案 secretroom-ef728"
npx firebase-tools@latest use secretroom-ef728

echo "[5/5] 部署 X OAuth Functions"
echo "第一次部署若詢問 X_CLIENT_ID，請貼上 X Developer Console 的 OAuth 2.0 Client ID。"
echo "X_REDIRECT_URI 請直接採用預設值：https://5j1u35k6.github.io/SecretRoom/"
npx firebase-tools@latest deploy --only functions:xOAuthStart,functions:xOAuthComplete

echo
echo "部署完成。請強制重新整理 SecretRoom，再測試『驗證 X』。"
