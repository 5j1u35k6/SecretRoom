"use strict";

const { defineString } = require("firebase-functions/params");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

if (!getApps().length) initializeApp();

const db = getFirestore();
const APP_ID = "secretg-production-node-tw";
const REGION = "asia-east1";
const PUBLIC_ORIGIN = "https://5j1u35k6.github.io";
const CORS_ORIGINS = [PUBLIC_ORIGIN, /^http:\/\/localhost(?::\d+)?$/];
const SESSION_TTL_MS = 10 * 60 * 1000;

const X_CLIENT_ID = defineString("X_CLIENT_ID", {
  description: "Public OAuth 2.0 Client ID for the SecretRoom X app."
});
const X_REDIRECT_URI = defineString("X_REDIRECT_URI", {
  default: "https://5j1u35k6.github.io/SecretRoom/",
  description: "Exact X OAuth callback URL configured in X Developer Console."
});

function applicationRef(memberId) {
  return db.doc(`secretg_apps/${APP_ID}/applications/${memberId}`);
}

function sessionRef(state) {
  return db.doc(`secretg_apps/${APP_ID}/x_oauth_sessions/${state}`);
}

module.exports = {
  db,
  APP_ID,
  REGION,
  PUBLIC_ORIGIN,
  CORS_ORIGINS,
  SESSION_TTL_MS,
  X_CLIENT_ID,
  X_REDIRECT_URI,
  FieldValue,
  Timestamp,
  applicationRef,
  sessionRef
};
