/**
 * ============================================================
 * SecretRoom Telegram Bot — Phase 1～6 完整版
 * Google Apps Script + Cloudflare Worker + Firestore REST
 * ============================================================
 *
 * 必要的指令碼屬性：
 * TELEGRAM_BOT_TOKEN
 * TELEGRAM_WEBHOOK_KEY
 * WEB_APP_URL
 * CLOUDFLARE_WORKER_URL
 * CLOUDFLARE_WEBHOOK_SECRET
 * FIREBASE_PROJECT_ID
 * FIREBASE_APP_ID
 * FIREBASE_CLIENT_EMAIL
 * FIREBASE_PRIVATE_KEY
 *
 * 可選的指令碼屬性：
 * BOT_USERNAME                 預設 SecretRoomtwBot
 * SECRETROOM_URL               預設 GitHub Pages 首頁
 * TELEGRAM_ADMIN_CHAT_IDS      逗號分隔的管理員 chat ID
 *
 * 本版本完成：
 * 1. 帳號綁定與平台串接。
 * 2. 忘記密碼被動觸發與 Bot 自助處理。
 * 3. Telegram 通知偏好，與平台通知分離。
 * 4. Telegram outbox 發送、紀錄與失敗重送。
 * 5. 管理員 Telegram 待辦提醒。
 * 6. EmailJS 遷移後的 Telegram 外部通知流程。
 */

const TELEGRAM_API_BASE_URL = 'https://api.telegram.org/bot';
const TELEGRAM_UPDATE_CACHE_PREFIX = 'telegram_update_';
const TELEGRAM_UPDATE_CACHE_SECONDS = 21600;
const TELEGRAM_BINDING_TOKEN_TTL_MS = 10 * 60 * 1000;
const TELEGRAM_TEMP_PASSWORD_TTL_MS = 10 * 60 * 1000;
const TELEGRAM_PASSWORD_RESET_COOLDOWN_MS = 2 * 60 * 1000;
const TELEGRAM_OUTBOX_BATCH_SIZE = 20;
const FIRESTORE_DATABASE_ID = '(default)';
