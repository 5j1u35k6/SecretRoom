"use strict";

const { PUBLIC_ORIGIN } = require("./config");

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function sendJson(res, status, body) {
  res.set("Cache-Control", "no-store");
  res.set("Pragma", "no-cache");
  return res.status(status).json(body);
}

function requestOrigin(req) {
  return String(req.get("origin") || "").trim();
}

function assertRequest(req) {
  const origin = requestOrigin(req);
  const local = /^http:\/\/localhost(?::\d+)?$/.test(origin);
  if (origin !== PUBLIC_ORIGIN && !local) {
    throw new HttpError(403, "origin_not_allowed", "這個來源不能使用 X 驗證服務。");
  }
  if (req.method !== "POST") {
    throw new HttpError(405, "method_not_allowed", "只接受 POST 請求。");
  }
}

function clientIp(req) {
  const forwarded = String(req.get("x-forwarded-for") || "").split(",")[0].trim();
  return forwarded || req.ip || "unknown";
}

function handleError(res, error) {
  if (error instanceof HttpError) {
    return sendJson(res, error.status, { ok: false, code: error.code, message: error.message });
  }
  console.error("X OAuth function error:", error);
  return sendJson(res, 500, {
    ok: false,
    code: "internal_error",
    message: "X 驗證服務暫時無法使用，請稍後再試。"
  });
}

module.exports = { HttpError, sendJson, requestOrigin, assertRequest, clientIp, handleError };
