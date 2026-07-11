"use strict";

const crypto = require("node:crypto");
const { db, APP_ID, FieldValue } = require("./config");
const { HttpError } = require("./http");

const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 30 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function rateRef(memberId, ip) {
  const key = crypto.createHash("sha256").update(`${ip}:${memberId.toLowerCase()}`).digest("hex");
  return db.doc(`secretg_apps/${APP_ID}/x_oauth_rate_limits/${key}`);
}

async function registerAttempt(memberId, ip) {
  const ref = rateRef(memberId, ip);
  const now = Date.now();
  let retryAfterMs = 0;

  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.exists ? snapshot.data() : {};
    const blockedUntilMs = Number(data.blockedUntilMs || 0);
    if (blockedUntilMs > now) {
      retryAfterMs = blockedUntilMs - now;
      return;
    }

    const previousStart = Number(data.windowStartedAtMs || 0);
    const sameWindow = previousStart > 0 && now - previousStart < WINDOW_MS;
    const attempts = sameWindow ? Number(data.attempts || 0) + 1 : 1;
    const blocked = attempts > MAX_ATTEMPTS ? now + BLOCK_MS : 0;

    transaction.set(ref, {
      memberId,
      attempts,
      windowStartedAtMs: sameWindow ? previousStart : now,
      blockedUntilMs: blocked,
      lastAttemptAt: FieldValue.serverTimestamp(),
      lastAttemptAtMs: now
    }, { merge: true });
    if (blocked) retryAfterMs = BLOCK_MS;
  });

  if (retryAfterMs) {
    throw new HttpError(429, "too_many_attempts", `嘗試次數過多，請在 ${Math.ceil(retryAfterMs / 60000)} 分鐘後再試。`);
  }
  return ref;
}

async function clearAttempts(ref) {
  try { await ref.delete(); } catch (_) {}
}

module.exports = { registerAttempt, clearAttempts };
