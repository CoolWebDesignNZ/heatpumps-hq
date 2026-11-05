// Counts phone taps and quote-button clicks for the monthly report. The page sends a
// beacon: {type: 'phone' | 'quote', page}. Nothing about the visitor is stored.
import { recordEvent } from './quote.js';

const TYPES = new Set(['phone', 'quote']);
const BOT = /bot|crawl|spider|slurp|preview|headless/i;

export async function onRequestPost({ request, env }) {
  if (BOT.test(request.headers.get('User-Agent') ?? '')) return new Response(null, { status: 204 });
  let body = {};
  try { body = JSON.parse(await request.text()); } catch {}
  if (!TYPES.has(body.type)) return new Response(null, { status: 400 });
  await recordEvent(env, body.type, body.page ?? '', new URL(request.url).hostname);
  return new Response(null, { status: 204 });
}
