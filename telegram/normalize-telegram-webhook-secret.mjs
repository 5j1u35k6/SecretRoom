import { readFile, writeFile } from 'node:fs/promises';

const generatedWorkerUrl = new URL('./.generated-worker.js', import.meta.url);
let source = await readFile(generatedWorkerUrl, 'utf8');

const originalCall = '      verifyTelegramSecret(request, env);';
const secureCall = '      await verifyTelegramSecret(request, env);';

if (source.includes(originalCall)) {
  source = source.replace(originalCall, secureCall);
}

const originalVerifier = `function verifyTelegramSecret(request, env) {
  const received = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
  if (!env.TELEGRAM_WEBHOOK_SECRET || received !== env.TELEGRAM_WEBHOOK_SECRET) throw httpError(403, 'Unauthorized');
}`;

const secureVerifier = `async function telegramWebhookSecret(env) {
  const configured = String(env.TELEGRAM_WEBHOOK_SECRET || '');
  if (!configured) throw httpError(500, 'TELEGRAM_WEBHOOK_SECRET 未設定');
  return sha256Hex(configured);
}

async function verifyTelegramSecret(request, env) {
  const received = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
  const expected = await telegramWebhookSecret(env);
  if (!received || !constantTimeEqual(received, expected)) throw httpError(403, 'Unauthorized');
}`;

if (source.includes(originalVerifier)) {
  source = source.replace(originalVerifier, secureVerifier);
}

source = source.replace(
  '    secret_token: env.TELEGRAM_WEBHOOK_SECRET,',
  '    secret_token: await telegramWebhookSecret(env),'
);

if (!source.includes('async function telegramWebhookSecret(env)')) {
  throw new Error('Telegram webhook secret normalizer was not applied');
}
if (!source.includes('await verifyTelegramSecret(request, env);')) {
  throw new Error('Telegram webhook verification was not converted to async');
}
if (source.includes('secret_token: env.TELEGRAM_WEBHOOK_SECRET')) {
  throw new Error('Raw Telegram webhook secret remains in setWebhook payload');
}

await writeFile(generatedWorkerUrl, source, 'utf8');
console.log('Normalized Telegram webhook secret to a Bot API-safe SHA-256 token');
