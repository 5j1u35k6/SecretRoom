/**
 * SecretRoom Telegram Webhook Proxy
 *
 * Telegram -> Cloudflare Worker -> Google Apps Script
 */
export default {
  async fetch(request, env, ctx) {
    if (request.method === 'GET') {
      return jsonResponse({ ok: true, service: 'SecretRoom Telegram Webhook Proxy' });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
    }

    const receivedSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
    if (!env.TELEGRAM_WEBHOOK_SECRET || receivedSecret !== env.TELEGRAM_WEBHOOK_SECRET) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 403);
    }

    const body = await request.text();
    if (!body) return jsonResponse({ ok: false, error: 'Empty request body' }, 400);

    ctx.waitUntil(forwardToAppsScript(body, env));
    return jsonResponse({ ok: true });
  }
};

async function forwardToAppsScript(body, env) {
  if (!env.APPS_SCRIPT_WEBHOOK_URL) throw new Error('Missing APPS_SCRIPT_WEBHOOK_URL');

  const response = await fetch(env.APPS_SCRIPT_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    redirect: 'follow'
  });

  const responseText = await response.text();
  console.log('Apps Script response:', response.status, responseText);
  if (!response.ok) throw new Error(`Apps Script error: ${response.status} ${responseText}`);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=UTF-8' }
  });
}
