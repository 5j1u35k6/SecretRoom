"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const {
  db, APP_ID, REGION, CORS_ORIGINS, FieldValue,
  applicationRef, sessionRef
} = require("./lib/config");
const { HttpError, sendJson, assertRequest, handleError } = require("./lib/http");
const { exchangeCode, getIdentity, revoke } = require("./lib/x-api");

const xOAuthComplete = onRequest({
  region: REGION,
  cors: CORS_ORIGINS,
  timeoutSeconds: 30,
  maxInstances: 10
}, async (req, res) => {
  let activeSessionRef = null;
  let accessToken = "";
  try {
    assertRequest(req);
    const code = String(req.body?.code || "").trim();
    const state = String(req.body?.state || "").trim();
    if (!code || code.length > 4096 || !/^[A-Za-z0-9_-]{20,200}$/.test(state)) {
      throw new HttpError(400, "invalid_callback", "X 回傳的驗證資料不完整，請重新開始。");
    }

    activeSessionRef = sessionRef(state);
    let oauthSession = null;
    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(activeSessionRef);
      if (!snapshot.exists) throw new HttpError(400, "session_not_found", "X 驗證工作階段已失效，請重新開始。");
      const data = snapshot.data() || {};
      if (data.status !== "pending") throw new HttpError(409, "session_already_used", "這次 X 驗證已經處理過，請重新開始。");
      if (Number(data.expiresAtMs || 0) < Date.now()) throw new HttpError(410, "session_expired", "X 驗證已逾時，請重新開始。");
      oauthSession = data;
      transaction.update(activeSessionRef, {
        status: "processing",
        processingAt: FieldValue.serverTimestamp(),
        processingAtMs: Date.now()
      });
    });

    accessToken = await exchangeCode(code, oauthSession.verifier, oauthSession.redirectUri);
    const xUser = await getIdentity(accessToken);
    const memberId = String(oauthSession.memberId || "");
    const memberRef = applicationRef(memberId);
    const bindingRef = db.doc(`secretg_apps/${APP_ID}/x_account_bindings/${xUser.id}`);
    const eventRef = db.collection(`secretg_apps/${APP_ID}/x_oauth_events`).doc();
    const now = Date.now();
    const responseInfo = {
      id: String(xUser.id),
      handle: String(xUser.username),
      name: String(xUser.name || xUser.username),
      profileImageUrl: String(xUser.profile_image_url || ""),
      profileUrl: `https://x.com/${xUser.username}`,
      verificationStatus: "oauth_verified",
      verifiedAtMs: now
    };

    await db.runTransaction(async transaction => {
      const memberSnapshot = await transaction.get(memberRef);
      if (!memberSnapshot.exists) throw new HttpError(404, "member_not_found", "找不到 SecretRoom 帳號。");
      const member = memberSnapshot.data() || {};
      const bindingSnapshot = await transaction.get(bindingRef);
      if (bindingSnapshot.exists && bindingSnapshot.data()?.memberId !== memberId) {
        throw new HttpError(409, "x_account_in_use", "這個 X 帳號已綁定其他 SecretRoom 帳號。");
      }

      const oldXId = String(member.xInfo?.id || "");
      let oldBindingRef = null;
      let oldBindingSnapshot = null;
      if (oldXId && oldXId !== String(xUser.id)) {
        oldBindingRef = db.doc(`secretg_apps/${APP_ID}/x_account_bindings/${oldXId}`);
        oldBindingSnapshot = await transaction.get(oldBindingRef);
      }

      transaction.set(bindingRef, {
        xUserId: String(xUser.id),
        xHandle: String(xUser.username),
        memberId,
        verifiedAt: FieldValue.serverTimestamp(),
        verifiedAtMs: now,
        updatedAt: FieldValue.serverTimestamp(),
        updatedAtMs: now
      }, { merge: true });
      if (oldBindingRef && oldBindingSnapshot?.exists && oldBindingSnapshot.data()?.memberId === memberId) {
        transaction.delete(oldBindingRef);
      }

      transaction.update(memberRef, {
        xInfo: { ...responseInfo, verifiedAt: FieldValue.serverTimestamp() },
        socialBindingProvider: "x_oauth",
        socialBindingUpdatedAt: FieldValue.serverTimestamp(),
        socialBindingUpdatedAtMs: now,
        telegramInfo: {
          provider: "x-oauth-compat",
          deprecated: true,
          xUserId: String(xUser.id),
          xHandle: String(xUser.username),
          verified: true,
          verifiedAtMs: now
        }
      });
      transaction.set(eventRef, {
        action: "x_oauth_verified",
        memberId,
        xUserId: String(xUser.id),
        xHandle: String(xUser.username),
        createdAt: FieldValue.serverTimestamp(),
        createdAtMs: now
      });
      transaction.delete(activeSessionRef);
    });

    return sendJson(res, 200, { ok: true, xInfo: responseInfo });
  } catch (error) {
    if (activeSessionRef) {
      try {
        await activeSessionRef.set({
          status: "failed",
          errorCode: error?.code || "internal_error",
          failedAt: FieldValue.serverTimestamp(),
          failedAtMs: Date.now()
        }, { merge: true });
      } catch (_) {}
    }
    return handleError(res, error);
  } finally {
    await revoke(accessToken);
  }
});

module.exports = { xOAuthComplete };
