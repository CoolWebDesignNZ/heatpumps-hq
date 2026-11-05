// Monthly status report for heatpumps-christchurch.co.nz.
//   node scripts/status-report.mjs           writes research/status/<date>.json and .md
//   node scripts/status-report.mjs --retry   re-runs only today's searches that errored
// Checks the SAME list every month, research/status/tracked-keywords.json (built once by
// scripts/build-tracked.py), in Google searched from Christchurch, so months compare like
// for like. Search Console comes from the exports in research/status/gsc/ (summarised by
// scripts/gsc-summary.py). Needs DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD.
import fs from 'node:fs';
import path from 'node:path';

const DOMAIN = 'heatpumps-christchurch.co.nz';
const BRAND = /heat\s*pumps?\s*hq/i;
const LOCATION = 1011065; // Christchurch, Canterbury Region, New Zealand
const dir = 'research/status';
const today = new Date().toISOString().slice(0, 10);
const auth = 'Basic ' + Buffer.from(`${process.env.DATAFORSEO_LOGIN ?? ''}:${process.env.DATAFORSEO_PASSWORD ?? ''}`).toString('base64');
const tracked = JSON.parse(fs.readFileSync(path.join(dir, 'tracked-keywords.json'), 'utf8'));
// Share of searchers who click each organic position (a common industry curve). Used only to
// turn positions into one comparable number; it is an estimate, not a visit count.
const CTR = [0, .28, .15, .11, .08, .07, .05, .04, .03, .03, .025];
const ctr = (p) => (!p ? 0 : p <= 10 ? CTR[p] : p <= 20 ? .01 : 0);

async function dfs(endpoint, body) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`https://api.dataforseo.com/v3/${endpoint}`, { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      const t = j.tasks?.[0];
      if (t?.status_code === 20000) return { result: t.result?.[0], cost: t.cost ?? 0 };
      if (i === 2) throw new Error(`${endpoint}: ${t?.status_message ?? j.status_message}`);
    } catch (e) { if (i === 2) throw e; }
    await new Promise((s) => setTimeout(s, 2000 * (i + 1)));
  }
}

let cost = 0;
async function check(t) {
  const { result, cost: c } = await dfs('serp/google/organic/live/advanced', [{ keyword: t.keyword, location_code: LOCATION, language_code: 'en', device: 'desktop', depth: 100 }]);
  cost += c;
  const items = result?.items ?? [];
  const ours = items.find((x) => x.type === 'organic' && x.domain?.endsWith(DOMAIN));
  const pack = items.find((x) => x.type === 'local_pack' && BRAND.test(x.title ?? ''));
  const aio = items.find((x) => x.type === 'ai_overview');
  const urlPath = ours?.url ? new URL(ours.url).pathname : null;
  const expected = t.page == null ? null : t.page === '' ? '/' : `/${t.page}/`;
  return { ...t, position: ours?.rank_group ?? null, url: urlPath, rightPage: expected && urlPath ? urlPath === expected : null, localPack: pack ? pack.rank_group : null, aiOverview: !!aio, aiOverviewCitesUs: !!aio && JSON.stringify(aio).includes(DOMAIN) };
}

const todayFile = path.join(dir, `${today}.json`);
let rows = [];
if (process.argv.includes('--retry') && fs.existsSync(todayFile)) rows = JSON.parse(fs.readFileSync(todayFile, 'utf8')).rows;
const queue = rows.length ? rows.filter((r) => r.error).map(({ keyword }) => tracked.find((t) => t.keyword === keyword)) : [...tracked];
const priorCost = rows.length ? JSON.parse(fs.readFileSync(todayFile, 'utf8')).summary.costUSD ?? 0 : 0;
rows = rows.filter((r) => !r.error);
const failed = [];
await Promise.all(Array.from({ length: 8 }, async () => {
  while (queue.length) { const t = queue.shift(); try { rows.push(await check(t)); } catch { failed.push(t); } }
}));
for (const t of failed) { // DataForSEO sometimes answers "Internal SE Server Error"; one slower second pass.
  await new Promise((s) => setTimeout(s, 3000));
  try { rows.push(await check(t)); } catch (e) { rows.push({ ...t, error: String(e.message ?? e) }); }
}

// Headline figures, overall and per group.
const groups = ['Services', 'Guides', 'Search Console', 'Suburbs', 'Brand'];
const stats = (rs) => {
  const ok = rs.filter((r) => !r.error);
  const ranked = ok.filter((r) => r.position);
  return {
    searches: rs.length,
    top3: ranked.filter((r) => r.position <= 3).length,
    top10: ranked.filter((r) => r.position <= 10).length,
    top100: ranked.length,
    avgPosition: ok.length ? Math.round(ok.reduce((s, r) => s + (r.position ?? 101), 0) / ok.length * 10) / 10 : null,
    estVisits: Math.round(ok.reduce((s, r) => s + (r.volume ?? 0) * ctr(r.position), 0)),
    mapPack: ok.filter((r) => r.localPack).length,
    aiOverviewCitesUs: ok.filter((r) => r.aiOverviewCitesUs).length,
    wrongPage: ok.filter((r) => r.rightPage === false).length,
  };
};
const summary = { date: today, domain: DOMAIN, all: stats(rows), errors: rows.filter((r) => r.error).length, costUSD: Math.round((priorCost + cost) * 1000) / 1000 };
for (const g of groups) summary[g] = stats(rows.filter((r) => r.group === g));
const brand = rows.find((r) => r.keyword === 'heat pumps hq christchurch');

fs.mkdirSync(dir, { recursive: true });
const earlier = fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f !== `${today}.json`).sort().pop();
const prev = earlier ? JSON.parse(fs.readFileSync(path.join(dir, earlier), 'utf8')) : null;
const comparable = prev?.summary?.all ? prev : null; // older reports used a different keyword list
fs.writeFileSync(todayFile, JSON.stringify({ summary, rows }, null, 1) + '\n');

// Search Console: the newest export and the one before it.
const gscFiles = fs.existsSync(path.join(dir, 'gsc')) ? fs.readdirSync(path.join(dir, 'gsc')).filter((f) => f.endsWith('.json')).sort() : [];
const gscNow = gscFiles.length ? JSON.parse(fs.readFileSync(path.join(dir, 'gsc', gscFiles.at(-1)), 'utf8')) : null;
const gscPrev = gscFiles.length > 1 ? JSON.parse(fs.readFileSync(path.join(dir, 'gsc', gscFiles.at(-2)), 'utf8')) : null;

// Leads and calls from the site itself (functions/api/event.js and quote.js write them to the
// heatpumps-hq-events D1 database). Last calendar month against the month before, real domain only.
const D1 = '26674de9-c075-42d1-a4cb-b716f963b65d';
async function d1(sql, params = []) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${D1}/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ sql, params }),
  });
  const j = await r.json();
  if (!j.success) throw new Error(JSON.stringify(j.errors));
  return j.result[0].results;
}
const monthStart = (d, back) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1)).toISOString().slice(0, 10);
const now = new Date();
const months = [[monthStart(now, 1), monthStart(now, 0)], [monthStart(now, 2), monthStart(now, 1)]];
let activity = null;
if (process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID) {
  try {
    const count = async ([from, to]) => Object.fromEntries((await d1(
      "SELECT type, COUNT(*) AS n FROM events WHERE host = ? AND created_at >= ? AND created_at < ? GROUP BY type", [DOMAIN, from, to])).map((r) => [r.type, r.n]));
    activity = { last: { from: months[0][0], to: months[0][1], ...(await count(months[0])) }, before: { from: months[1][0], to: months[1][1], ...(await count(months[1])) } };
    const pages = await d1("SELECT page, COUNT(*) AS n FROM events WHERE host = ? AND type = 'lead' AND created_at >= ? AND created_at < ? GROUP BY page ORDER BY n DESC LIMIT 10", [DOMAIN, ...months[0]]);
    activity.leadPages = pages;
  } catch (e) { activity = { error: String(e.message ?? e) }; }
}
summary.activity = activity;
fs.writeFileSync(todayFile, JSON.stringify({ summary, rows }, null, 1) + '\n');

const ch = (now, was, lowerIsBetter = false) => {
  if (was == null || now == null) return '';
  const d = Math.round((now - was) * 10) / 10;
  if (!d) return ' (no change)';
  const better = lowerIsBetter ? d < 0 : d > 0;
  return ` (${d > 0 ? '+' : ''}${d.toLocaleString('en-NZ')} ${better ? 'better' : 'worse'})`;
};
const p = comparable?.summary;
const prevRow = new Map((comparable?.rows ?? []).map((r) => [r.keyword, r]));
const move = (r) => {
  if (!comparable) return '';
  const was = prevRow.get(r.keyword)?.position ?? null;
  if (was === r.position) return was ? 'same' : '';
  if (!was) return `new at ${r.position}`;
  if (!r.position) return `lost (was ${was})`;
  return was > r.position ? `up ${was - r.position}` : `down ${r.position - was}`;
};
const posTxt = (r) => (r.error ? 'error' : r.position ?? 'not in top 100');
const pageTxt = (r) => (r.url ? `${r.url}${r.rightPage === false ? ' (wrong page)' : ''}` : '');

const lines = [
  `# Status report ${today}: ${DOMAIN}`,
  '',
  comparable ? `Compared with the report of ${earlier.slice(0, 10)}.` : 'Baseline: the old WordPress site, before the new site went live. Next month is measured against these figures.',
  '',
  '## Headline',
  '',
  '| Measure | Now | Means |',
  '|---|---|---|',
  `| Estimated visits a month from the tracked searches | ${summary.all.estVisits}${ch(summary.all.estVisits, p?.all.estVisits)} | Search volume x the share of clicks each position gets. One number that moves with every ranking. |`,
  `| Tracked searches on page one (top 10) | ${summary.all.top10} of ${summary.all.searches}${ch(summary.all.top10, p?.all.top10)} | |`,
  `| Service searches on page one | ${summary.Services.top10} of ${summary.Services.searches}${ch(summary.Services.top10, p?.Services.top10)} | The searches that bring jobs: repair, service, installation, cost. |`,
  `| Average position, service searches | ${summary.Services.avgPosition}${ch(summary.Services.avgPosition, p?.Services.avgPosition, true)} | Not ranking counts as 101. Lower is better. |`,
  `| Suburb pages on page one for their own search | ${summary.Suburbs.top10} of ${summary.Suburbs.searches}${ch(summary.Suburbs.top10, p?.Suburbs.top10)} | |`,
  `| Brand search "heat pumps hq christchurch" | ${brand ? posTxt(brand) : 'n/a'} | |`,
  `| In the Google map pack | ${summary.all.mapPack}${ch(summary.all.mapPack, p?.all.mapPack)} searches | |`,
  `| Google AI Overviews citing the site | ${summary.all.aiOverviewCitesUs}${ch(summary.all.aiOverviewCitesUs, p?.all.aiOverviewCitesUs)} | |`,
  `| Searches ranking on the wrong page | ${summary.all.wrongPage}${ch(summary.all.wrongPage, p?.all.wrongPage, true)} | Google shows a different page from the one written for that search. |`,
];
if (activity && !activity.error) {
  const L = activity.last, B = activity.before, n = (o, k) => o[k] ?? 0;
  lines.push(
    '',
    `## Leads and calls from the site (${L.from} to ${L.to}, against the month before)`,
    '',
    '| Measure | Last month | Month before |',
    '|---|---|---|',
    `| Quote form leads | ${n(L, 'lead')}${ch(n(L, 'lead'), n(B, 'lead'))} | ${n(B, 'lead')} |`,
    ...(n(L, 'lead-unsent') ? [`| Leads whose email failed (they were asked to ring; check the More Leads dashboard) | ${n(L, 'lead-unsent')} | ${n(B, 'lead-unsent')} |`] : []),
    `| Taps on the phone number | ${n(L, 'phone')}${ch(n(L, 'phone'), n(B, 'phone'))} | ${n(B, 'phone')} |`,
    `| Clicks on a quote button | ${n(L, 'quote')}${ch(n(L, 'quote'), n(B, 'quote'))} | ${n(B, 'quote')} |`,
    '',
    activity.leadPages?.length ? 'Pages the leads were sent from: ' + activity.leadPages.map((p) => `${p.page || '(unknown)'} ${p.n}`).join('; ') + '.' : 'No form leads last month.',
    '',
    'Chat leads and phone calls themselves are on the More Leads dashboard (leads.moreleads.nz), not counted here. Counting started when the new site went live.',
  );
} else if (activity?.error) {
  lines.push('', `## Leads and calls from the site`, '', `Could not read the counts: ${activity.error}`);
}
if (gscNow) {
  const g = gscNow, q = gscPrev;
  lines.push(
    '',
    `## Search Console (${g.from} to ${g.to}${q ? `, against ${q.from} to ${q.to}` : ''})`,
    '',
    '| Measure | Now |',
    '|---|---|',
    `| Clicks | ${g.clicks}${ch(g.clicks, q?.clicks)} |`,
    `| Impressions | ${g.impressions.toLocaleString('en-NZ')}${ch(g.impressions, q?.impressions)} |`,
    `| Click-through rate | ${(g.ctr * 100).toFixed(2)}%${q ? ch(Math.round(g.ctr * 10000) / 100, Math.round(q.ctr * 10000) / 100) : ''} |`,
    `| Average position | ${g.position}${ch(g.position, q?.position, true)} |`,
    '',
    'Top pages by clicks:',
    '',
    '| Page | Clicks | Impressions | Position |',
    '|---|---|---|---|',
    ...g.topPagesByClicks.slice(0, 10).map((x) => `| ${x.item.replace(/^https?:\/\/[^/]+/, '')} | ${x.clicks} | ${x.impressions} | ${x.position} |`),
  );
}
lines.push('', '## Biggest searches by volume', '', 'The 20 tracked searches with the most searches a month, where the site stands on each.', '', `| Search | Searches a month | Position | ${comparable ? 'Change | ' : ''}Page Google shows |`, `|---|---|---|${comparable ? '---|' : ''}---|`);
for (const r of [...rows].filter((r) => r.volume).sort((a, b) => b.volume - a.volume).slice(0, 20)) lines.push(`| ${r.keyword} | ${r.volume} | ${posTxt(r)} | ${comparable ? move(r) + ' | ' : ''}${pageTxt(r)} |`);
for (const g of groups) {
  const rs = rows.filter((r) => r.group === g).sort((a, b) => (a.position ?? 999) - (b.position ?? 999) || (b.volume ?? 0) - (a.volume ?? 0));
  if (!rs.length) continue;
  const s = summary[g];
  lines.push('', `## ${g}: ${s.top10} of ${s.searches} on page one, ${s.top100} in the top 100`, '', `| Search | Searches a month | Position | ${comparable ? 'Change | ' : ''}Page Google shows |`, `|---|---|---|${comparable ? '---|' : ''}---|`);
  for (const r of rs) lines.push(`| ${r.keyword} | ${r.volume ?? r.source ?? ''} | ${posTxt(r)} | ${comparable ? move(r) + ' | ' : ''}${pageTxt(r)} |`);
}
lines.push('', `Searched in Google from Christchurch (desktop) on ${today}: ${summary.all.searches} searches from research/status/tracked-keywords.json. Search volumes are New Zealand monthly averages (DataForSEO). DataForSEO cost US$${summary.costUSD}.`, '');
fs.writeFileSync(path.join(dir, `${today}.md`), lines.join('\n'));
console.log(JSON.stringify({ all: summary.all, errors: summary.errors, costUSD: summary.costUSD }));
