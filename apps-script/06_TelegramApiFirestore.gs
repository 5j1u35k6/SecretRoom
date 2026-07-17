/**
 * Telegram Bot API。
 */
function sendMessage_(chatId, text, options) {
  const payload = Object.assign({
    chat_id: String(chatId),
    text: String(text),
    parse_mode: 'HTML',
    disable_web_page_preview: true
  }, options || {});

  return callTelegramApi_('sendMessage', payload);
}


function answerCallbackQuery_(callbackQueryId, text) {
  const payload = { callback_query_id: String(callbackQueryId) };
  if (text) payload.text = String(text);
  return callTelegramApi_('answerCallbackQuery', payload);
}


function callTelegramApi_(methodName, payload) {
  const token = getRequiredProperty_('TELEGRAM_BOT_TOKEN');
  const response = UrlFetchApp.fetch(
    TELEGRAM_API_BASE_URL + token + '/' + methodName,
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload || {}),
      muteHttpExceptions: true
    }
  );

  const statusCode = response.getResponseCode();
  const responseText = response.getContentText();
  let result;
  try {
    result = JSON.parse(responseText);
  } catch (error) {
    throw new Error(`Telegram API ${methodName} 回傳非 JSON：${responseText}`);
  }

  if (statusCode < 200 || statusCode >= 300 || !result.ok) {
    throw new Error(`Telegram API ${methodName} 失敗：${statusCode} ${responseText}`);
  }

  return result.result;
}


/**
 * Firestore Service Account REST。
 */
function firestoreGetDocument_(collectionName, documentId) {
  const response = firestoreFetch_('get', firestoreDocumentUrl_(collectionName, documentId));
  if (response.statusCode === 404) return null;
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`Firestore 讀取失敗：${response.statusCode} ${response.text}`);
  }
  const document = JSON.parse(response.text);
  const data = fromFirestoreFields_(document.fields || {});
  data.__documentId = documentIdFromName_(document.name);
  return data;
}


function firestoreSetDocument_(collectionName, documentId, updates, merge) {
  const existing = merge ? (firestoreGetDocument_(collectionName, documentId) || {}) : {};
  delete existing.__documentId;
  const body = { fields: toFirestoreFields_(Object.assign(existing, updates || {})) };
  const response = firestoreFetch_(
    'patch',
    firestoreDocumentUrl_(collectionName, documentId),
    body
  );
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`Firestore 寫入失敗：${response.statusCode} ${response.text}`);
  }
  return JSON.parse(response.text);
}


function firestoreReplaceDocument_(collectionName, documentId, data) {
  const copy = Object.assign({}, data || {});
  delete copy.__documentId;
  return firestoreSetDocument_(collectionName, documentId, copy, false);
}


function queryDocuments_(collectionName, filters) {
  const parent = firestoreParentPath_();
  const structuredQuery = {
    from: [{ collectionId: collectionName }]
  };

  if (filters && filters.length === 1) {
    structuredQuery.where = fieldFilter_(filters[0]);
  } else if (filters && filters.length > 1) {
    structuredQuery.where = {
      compositeFilter: {
        op: 'AND',
        filters: filters.map(fieldFilter_)
      }
    };
  }

  const response = firestoreFetch_(
    'post',
    `https://firestore.googleapis.com/v1/${parent}:runQuery`,
    { structuredQuery }
  );

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`Firestore 查詢失敗：${response.statusCode} ${response.text}`);
  }

  const rows = JSON.parse(response.text || '[]');
  return rows
    .filter(row => row.document)
    .map(row => {
      const data = fromFirestoreFields_(row.document.fields || {});
      data.__documentId = documentIdFromName_(row.document.name);
      return data;
    });
}


function fieldFilter_(filter) {
  return {
    fieldFilter: {
      field: { fieldPath: String(filter.field) },
      op: String(filter.op || 'EQUAL'),
      value: toFirestoreValue_(filter.value)
    }
  };
}


function firestoreFetch_(method, url, body) {
  const options = {
    method,
    headers: {
      Authorization: 'Bearer ' + getGoogleAccessToken_()
    },
    muteHttpExceptions: true
  };
  if (body !== undefined) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(body);
  }

  const response = UrlFetchApp.fetch(url, options);
  return {
    statusCode: response.getResponseCode(),
    text: response.getContentText()
  };
}


function getGoogleAccessToken_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('firebase_service_account_access_token');
  if (cached) return cached;

  const clientEmail = getRequiredProperty_('FIREBASE_CLIENT_EMAIL');
  const privateKey = normalizePrivateKey_(getRequiredProperty_('FIREBASE_PRIVATE_KEY'));
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode_(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64UrlEncode_(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));
  const unsigned = header + '.' + claim;
  const signature = Utilities.computeRsaSha256Signature(unsigned, privateKey);
  const assertion = unsigned + '.' + base64UrlEncode_(signature);

  const response = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    },
    muteHttpExceptions: true
  });

  const statusCode = response.getResponseCode();
  const text = response.getContentText();
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`Google OAuth 失敗：${statusCode} ${text}`);
  }

  const result = JSON.parse(text);
  cache.put('firebase_service_account_access_token', result.access_token, 3300);
  return result.access_token;
}


function firestoreParentPath_() {
  const projectId = getRequiredProperty_('FIREBASE_PROJECT_ID');
  const appId = getRequiredProperty_('FIREBASE_APP_ID');
  return `projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(FIRESTORE_DATABASE_ID)}/documents/secretg_apps/${encodeURIComponent(appId)}`;
}


function firestoreDocumentUrl_(collectionName, documentId) {
  return 'https://firestore.googleapis.com/v1/' +
    firestoreParentPath_() + '/' +
    encodeURIComponent(collectionName) + '/' +
    encodeURIComponent(documentId);
}


function documentIdFromName_(name) {
  const parts = String(name || '').split('/');
  return parts.length ? decodeURIComponent(parts[parts.length - 1]) : '';
}


function toFirestoreFields_(object) {
  const fields = {};
  Object.keys(object || {}).forEach(key => {
    if (object[key] !== undefined) fields[key] = toFirestoreValue_(object[key]);
  });
  return fields;
}


function toFirestoreValue_(value) {
  if (value === null) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue_) } };

  const type = typeof value;
  if (type === 'boolean') return { booleanValue: value };
  if (type === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (type === 'object') return { mapValue: { fields: toFirestoreFields_(value) } };
  return { stringValue: String(value) };
}


function fromFirestoreFields_(fields) {
  const object = {};
  Object.keys(fields || {}).forEach(key => {
    object[key] = fromFirestoreValue_(fields[key]);
  });
  return object;
}


function fromFirestoreValue_(value) {
  if (!value || typeof value !== 'object') return null;
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fromFirestoreValue_);
  if ('mapValue' in value) return fromFirestoreFields_(value.mapValue.fields || {});
  if ('referenceValue' in value) return value.referenceValue;
  if ('geoPointValue' in value) return value.geoPointValue;
  return null;
}


function base64UrlEncode_(value) {
  const bytes = typeof value === 'string'
    ? Utilities.newBlob(value).getBytes()
    : value;
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, '');
}


function normalizePrivateKey_(value) {
  return String(value || '').replace(/\\n/g, '\n').trim();
}
