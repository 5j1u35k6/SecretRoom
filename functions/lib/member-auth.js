"use strict";

const crypto = require("node:crypto");

function constantTimeMatch(storedValue, suppliedValue) {
  const stored = crypto.createHash("sha256").update(String(storedValue || "")).digest();
  const supplied = crypto.createHash("sha256").update(String(suppliedValue || "")).digest();
  return crypto.timingSafeEqual(stored, supplied);
}

function isActiveMember(data) {
  const status = String(data?.status || "").toLowerCase();
  return status === "approved" || status === "active";
}

function requiresPasswordChange(data) {
  return Boolean(data?.mustChangePassword || data?.forcePasswordChange || data?.tempPasswordActive || data?.passwordChangeRequired);
}

module.exports = { constantTimeMatch, isActiveMember, requiresPasswordChange };
