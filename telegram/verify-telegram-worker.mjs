import {
  copyFile,
  readFile,
  rm
} from 'node:fs/promises';

import {
  spawnSync
} from 'node:child_process';

const workerUrl = new URL(
  './.generated-worker.js',
  import.meta.url
);

const smokeWorkerUrl = new URL(
  './.generated-worker.verify.mjs',
  import.meta.url
);

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * 使用 Node.js 解析器檢查最終 Worker 語法。
 */
const syntaxResult = spawnSync(
  process.execPath,
  [
    '--check',
    workerUrl.pathname
  ],
  {
    encoding: 'utf8'
  }
);

if (syntaxResult.status !== 0) {
  throw new Error(
    [
      '最終 Worker JavaScript 語法檢查失敗。',
      syntaxResult.stdout || '',
      syntaxResult.stderr || ''
    ]
      .filter(Boolean)
      .join('\n')
  );
}

console.log(
  '✓ 最終 Worker JavaScript 語法正常'
);

const source = await readFile(
  workerUrl,
  'utf8'
);

/**
 * Telegram update_id 防重複函式必須剛好存在一份。
 */
const claimDefinitionCount = (
  source.match(
    /async function claimTelegramUpdate\s*\(/g
  ) || []
).length;

assertCondition(
  claimDefinitionCount === 1,
  `claimTelegramUpdate 函式數量異常：${claimDefinitionCount}`
);

assertCondition(
  source.includes(
    'await claimTelegramUpdate(update, env)'
  ),
  'Telegram 更新處理器缺少防重複呼叫'
);

console.log(
  '✓ Telegram update_id 防重複機制正常'
);

/**
 * 檢查會員中心必要功能是否存在於最終 Worker。
 */
const requiredFeatures = [
  {
    marker: "command === '/menu'",
    name: '/menu 主選單'
  },
  {
    marker: "data === 'ACCOUNT'",
    name: '我的帳號'
  },
  {
    marker: "data === 'UNBIND_EXECUTE'",
    name: '解除綁定確認'
  },
  {
    marker: 'showTelegramPreferences',
    name: 'Telegram 通知設定'
  },
  {
    marker: "data === 'RESET_CONFIRM'",
    name: '被動式密碼重設確認'
  },
  {
    marker: 'showPasswordResetStatus',
    name: '密碼重設申請查詢'
  },
  {
    marker: 'showSupportCategories',
    name: '協助中心問題分類'
  },
  {
    marker: "data.startsWith('REPORT_CATEGORY:')",
    name: '問題回報分類路由'
  },
  {
    marker: "data === 'SUPPORT_SUBMIT'",
    name: '問題回報送出'
  },
  {
    marker: 'telegram_support_sessions',
    name: '問題回報輸入工作階段'
  },
  {
    marker: "appPath('support_tickets', ticketId)",
    name: '服務單建立'
  }
];

for (const feature of requiredFeatures) {
  assertCondition(
    source.includes(feature.marker),
    `最終 Worker 缺少功能：${feature.name}`
  );

  console.log(
    `✓ ${feature.name}`
  );
}

/**
 * 複製為 .mjs 後實際載入 Worker，
 * 並呼叫不依賴 Secret 的健康檢查路由。
 */
await copyFile(
  workerUrl,
  smokeWorkerUrl
);

try {
  const workerModule = await import(
    `${smokeWorkerUrl.href}?time=${Date.now()}`
  );

  assertCondition(
    workerModule.default &&
    typeof workerModule.default.fetch === 'function',
    'Worker 沒有有效的 fetch 處理器'
  );

  const response =
    await workerModule.default.fetch(
      new Request(
        'https://secretroom-worker-verification.local/'
      ),
      {},
      {
        waitUntil() {}
      }
    );

  assertCondition(
    response instanceof Response,
    'Worker 健康檢查沒有回傳 Response'
  );

  assertCondition(
    response.status === 200,
    `Worker 健康檢查狀態異常：${response.status}`
  );

  console.log(
    '✓ Worker 基礎啟動測試通過'
  );
} finally {
  await rm(
    smokeWorkerUrl,
    {
      force: true
    }
  );
}

console.log(
  'Telegram Worker 完整部署前驗證通過'
);
