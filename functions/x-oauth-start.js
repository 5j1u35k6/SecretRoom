"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const {
  REGION, CORS_ORIGINS, SESSION_TTL_MS, X_CLIENT_ID, X_REDIRECT_URI,
  FieldValue, Timestamp, applicationRef, sessionRef
} = require("./lib/config");
const { HttpError, sendJson, requestOrigin, assertRequest, clientIp, handleError } = require("./lib/http");
const { constantTimeMatch, isActiveMember, requiresPasswordChange } = require("./lib/member-auth");
const { registerAttempt, clearAttempts } = require("./lib/rate-limit");
const { randomUrlSafe, challengeFor } = require("./lib/x-api");

const xOAuthStart = onRequest({
  region: REGION,
  cors: CORS_ORIGINS,
  timeoutSeconds: 30,
  maxInstances: 10
}, async (req, res) => {
  try {
    assertRequest(req);
    const memberId = String(req.body?.memberId || "").trim();
    const passphrase = String(req.body?.password || "");
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(memberId) || !passphrase || passphrase.length > 256) {
      throw new HttpError(400, "invalid_credentials", "請輸入有效的 SecretRoom 帳號與密碼。");
    }

    const attemptRef = await registerAttempt(memberId, clientIp(req));
    const memberSnapshot = await applicationRef(memberId).get();
    if (!memberSnapshot.exists) {
      throw new HttpError(401, "invalid_credentials", "SecretRoom 帳號或密碼不正確。");
    }

    const member = memberSnapshot.data() || {};
    if (!isActiveMember(member)) {
      throw new HttpError(403, "account_not_active", "這個 SecretRoom 帳號目前不能綁定 X。");
    }
    if (requiresPasswordChange(member)) {
      throw new HttpError(409, "password_change_required", "請先完成 SecretRoom 密碼更新，再進行 X 驗證。");
    }
    if (!constantTimeMatch(member.password, passphrase)) {
      throw new HttpError(401, "invalid_credentials", "SecretRoom 帳號或密碼不正確。");
    }
    await clearAttempts(attemptRef);

    const state = randomUrlSafe(32);
    const verifier = randomUrlSafe(64);
    const now = Date.now();
    const redirectUri = X_REDIRECT_URI.value();
    await sessionRef(state).set({
      state,
      memberId,
      verifier,
      redirectUri,
      origin: requestOrigin(req),
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: now,
      expiresAt: Timestamp.fromMillis(now + SESSION_TTL_MS),
      expiresAtMs: now + SESSION_TTL_MS
    });

    const authorizationUrl = new URL("https://x.com/i/oauth2/authorize");
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("client_id", X_CLIENT_ID.value());
    authorizationUrl.searchParams.set("redirect_uri", redirectUri);
    authorizationUrl.searchParams.set("scope", "tweet.read users.read");
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set("code_challenge", challengeFor(verifier));
    authorizationUrl.searchParams.set("code_challenge_method", "S256");

    return sendJson(res, 200, {
      ok: true,
      state,
      authorizationUrl: authorizationUrl.toString(),
      expiresInSeconds: Math.floor(SESSION_TTL_MS / 1000)
    });
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = { xOAuthStart };
