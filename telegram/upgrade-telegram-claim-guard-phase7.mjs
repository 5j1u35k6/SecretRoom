import { readFile, writeFile } from 'node:fs/promises';

const workerUrl = new URL(
  './.generated-worker.js',
  import.meta.url
);

let source = await readFile(
  workerUrl,
  'utf8'
);

const handlerStart =
  'async function handleTelegramUpdate(update, env) {';

const claimCall =
  '  if (!(await claimTelegramUpdate(update, env))) return;';

if (!source.includes(handlerStart)) {
  throw new Error(
    '找不到 Telegram 更新處理器'
  );
}

/*
 * 確保所有 Telegram 更新先進行 update_id 防重複處理。
 */
if (!source.includes(claimCall)) {
  source = source.replace(
    handlerStart,
    `${handlerStart}
${claimCall}`
  );
}

/*
 * Phase 3 的舊替換範圍可能會移除這個函式本體。
 * 這裡在部署前重新建立，而且只允許存在一份。
 */
if (
  !source.includes(
    'async function claimTelegramUpdate(update, env) {'
  )
) {
  const insertionMarker =
    'function verifyTelegramSecret(request, env) {';

  if (!source.includes(insertionMarker)) {
    throw new Error(
      '找不到 Telegram 驗證函式插入位置'
    );
  }

  const helper = `async function claimTelegramUpdate(update, env) {
  if (
    update?.update_id === undefined ||
    update?.update_id === null
  ) {
    return true;
  }

  const path = appPath(
    'telegram_updates',
    String(update.update_id)
  );

  try {
    await createDocument(env, path, {
      updateId: String(update.update_id),
      claimedAtMs: Date.now()
    });

    return true;
  } catch (error) {
    if (Number(error.status || 0) === 409) {
      return false;
    }

    throw error;
  }
}

`;

  source = source.replace(
    insertionMarker,
    helper + insertionMarker
  );
}

const definitionCount = (
  source.match(
    /async function claimTelegramUpdate\s*\(/g
  ) || []
).length;

if (definitionCount !== 1) {
  throw new Error(
    `claimTelegramUpdate 函式數量異常：${definitionCount}`
  );
}

const requiredFeatures = [
  "command === '/menu'",
  "data === 'RESET_CONFIRM'",
  "data.startsWith('REPORT_CATEGORY:')",
  "data === 'SUPPORT_SUBMIT'",
  "appPath('support_tickets', ticketId)",
  'telegram_support_sessions',
  'showPasswordResetStatus',
  'showTelegramPreferences',
  'showSupportCategories',
  '平台內通知'
];

for (const feature of requiredFeatures) {
  if (!source.includes(feature)) {
    throw new Error(
      `完整會員中心缺少功能：${feature}`
    );
  }
}

await writeFile(
  workerUrl,
  source,
  'utf8'
);

console.log(
  'Restored Telegram update claim guard phase 7'
);
