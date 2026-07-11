"use strict";

const crypto = require("node:crypto");
const { X_CLIENT_ID } = require("./config");
const { HttpError } = require("./http");

function randomUrlSafe(size = 32) {
  return crypto.randomBytes(size).toString("base64url");
}

function challengeFor(verifier) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

async function fetchJson(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  } finally {
    clearTimeout(timer);
  }
}

async function exchangeCode(code, verifier, redirectUri) {
  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    client_id: X_CLIENT_ID.value(),
    redirect_uri: redirectUri,
    code_verifier: verifier
  });
  const { response, payload } = await fetchJson("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok || !payload.access_token) {
    throw new HttpError(502, "x_token_exchange_failed", "X 沒有接受這次授權，請重新開始驗證。");
  }
  return payload.access_token;
}

async function getIdentity(accessToken) {
  const { response, payload } = await fetchJson(
    "https://api.x.com/2/users/me?user.fields=id,name,username,profile_image_url",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok || !payload.data?.id || !payload.data?.username) {
    throw new HttpError(502, "x_identity_failed", "無法讀取 X 帳號資料，請稍後重試。");
  }
  return payload.data;
}

async function revoke(accessToken) {
  if (!accessToken) return;
  try {
    await fetch("https://api.x.com/2/oauth2/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: accessToken, client_id: X_CLIENT_ID.value() })
    });
  } catch (_) {}
}

module.exports = { randomUrlSafe, challengeFor, exchangeCode, getIdentity, revoke };
