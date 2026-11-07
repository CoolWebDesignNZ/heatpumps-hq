// heatpumps-hq-gsc: once a month, asks coolweb.design/api/client-search for Heat Pumps HQ's
// Search Console figures (last 28 days and the 28 before) and stores the reply in the
// heatpumps-hq-events D1, table gsc. scripts/gsc-fetch.mjs reads the newest row for the
// monthly report. REPORT_KEY (secret) matches REPORT_KEY on the coolweb Pages project.
const DOMAIN = 'heatpumps-christchurch.co.nz';

async function pull(env) {
  const res = await fetch(`https://coolweb.design/api/client-search?domain=${DOMAIN}`, { headers: { 'X-Stats-Key': env.REPORT_KEY } });
  const body = await res.text();
  await env.EVENTS.prepare('CREATE TABLE IF NOT EXISTS gsc (id INTEGER PRIMARY KEY AUTOINCREMENT, fetched_at TEXT DEFAULT CURRENT_TIMESTAMP, status INTEGER, data TEXT)').run();
  await env.EVENTS.prepare('INSERT INTO gsc (status, data) VALUES (?, ?)').bind(res.status, body).run();
  let err = null; try { err = JSON.parse(body).error || null; } catch { err = 'bad reply'; }
  return { status: res.status, error: err };
}

export default {
  async scheduled(_event, env, ctx) { ctx.waitUntil(pull(env)); },
  // GET /run refreshes it now and says only whether it worked; nothing else is served.
  async fetch(request, env) {
    if (new URL(request.url).pathname !== '/run') return new Response('Not found', { status: 404 });
    const r = await pull(env);
    return new Response(r.error ? `failed: ${r.error}` : 'ok', { status: r.error ? 502 : 200 });
  },
};
