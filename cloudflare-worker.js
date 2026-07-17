/**
 * SecretRoom Telegram Webhook Proxy
 *
 * Cloudflare Worker 僅負責：
 * 1. 接收 Telegram Webhook。
 * 2. 驗證 Telegram Secret Token。
 * 3. 將 Update 轉送到 Google Apps Script。
 * 4. 立即回傳 HTTP 200，避免 Telegram 重送。
 */
export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') {
      return jsonResponse({
        ok: true,
        service: 'SecretRoom Telegram Webhook Proxy',
        phase: '1-6'
      });
    }

    try {
      const receivedSecret = request.headers.get(
        'X-Telegram-Bot-Api-Secret-Token'
      ) || '';

      if (
        !env.TELEGRAM_WEBHOOK_SECRET ||
        receivedSecret !== env.TELEGRAM_WEBHOOK_SECRET
      ) {
        return jsonResponse({ ok: false, error: 'Unauthorized' }, 403);
      }

      const body = await request.text();
      if (!body) return jsonResponse({ ok: false, error: 'Empty request body' }, 400);

      ctx.waitUntil(forwardToAppsScript(body, env));
      return jsonResponse({ ok: true });
    } catch (error) {
      console.error('Webhook Proxy 處理失敗：', error);

      /*
       * 仍回覆 HTTP 200，避免 Telegram 對同一 Update 無限重送。
       * 轉送錯誤會留在 Worker Logs。
       */
      return jsonResponse({ ok: true, forwarded: false });
    }
  }
};


async function forwardToAppsScript(body, env) {
  if (!env.APPS_SCRIPT_WEBHOOK_URL) {
    throw new Error('尚未設定 APPS_SCRIPT_WEBHOOK_URL');
  }

  const response = await fetch(env.APPS_SCRIPT_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-SecretRoom-Proxy': 'cloudflare-worker'
    },
    body,
    redirect: 'follow'
  });

  const responseText = await response.text();
  console.log('Apps Script 回應：', response.status, responseText);

  if (!response.ok) {
    throw new Error(
      `Apps Script 回傳錯誤：${response.status} ${responseText}`
    );
  }
}


function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Cache-Control': 'no-store'
    }
  });
}
