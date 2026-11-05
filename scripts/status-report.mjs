// Monthly status report: where heatpumps-christchurch.co.nz stands in Google
// for every page's main keyword, searched from Christchurch.
//   node scripts/status-report.mjs            (writes research/status/<date>.json and .md)
// Needs DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD (or a proxy that injects them).
// Each run is compared with the newest earlier report in research/status/.
// Search Console figures are added by hand from its export until the site has
// a Search Console connection this can read.
import fs from 'node:fs';
import path from 'node:path';

const DOMAIN = 'heatpumps-christchurch.co.nz';
const BRAND = /heat\s*pumps?\s*hq/i;
const LOCATION = 1011065; // Christchurch, Canterbury Region, New Zealand
const dir = 'research/status';
const today = new Date().toISOString().slice(0, 10);
const auth = 'Basic ' + Buffer.from(`${process.env.DATAFORSEO_LOGIN ?? ''}:${process.env.DATAFORSEO_PASSWORD ?? ''}`).toString('base64');

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

// Every page's main keyword, plus the brand search.
const pages = [];
for (const f of fs.readdirSync('src/content').filter((f) => f.endsWith('.md'))) {
  const kw = fs.readFileSync(`src/content/${f}`, 'utf8').match(/^keyword: *"?([^"\n]+)"?$/m)?.[1]?.trim();
  if (kw) pages.push({ slug: f.slice(0, -3), keyword: kw.toLowerCase() });
}
const keywords = [...new Map([['heat pumps hq christchurch', 'brand'], ...pages.map((p) => [p.keyword, p.slug])])].map(([keyword, slug]) => ({ keyword, slug }));

let cost = 0;
async function check({ keyword, slug }) {
  const { result, cost: c } = await dfs('serp/google/organic/live/advanced', [{ keyword, location_code: LOCATION, language_code: 'en', device: 'desktop', depth: 100 }]);
  cost += c;
  const items = result?.items ?? [];
  const ours = items.find((x) => x.type === 'organic' && x.domain?.endsWith(DOMAIN));
  const pack = items.find((x) => x.type === 'local_pack' && BRAND.test(x.title ?? ''));
  const aio = items.find((x) => x.type === 'ai_overview');
  const aioCites = !!aio && JSON.stringify(aio).includes(DOMAIN);
  return { keyword, slug, position: ours?.rank_group ?? null, url: ours?.url ?? null, localPack: pack ? pack.rank_group : null, aiOverview: !!aio, aiOverviewCitesUs: aioCites };
}

// --retry re-runs only the searches that errored in today's report.
const todayFile = path.join(dir, `${today}.json`);
let rows = [];
if (process.argv.includes('--retry') && fs.existsSync(todayFile)) rows = JSON.parse(fs.readFileSync(todayFile, 'utf8')).rows;
const queue = rows.length ? rows.filter((r) => r.error).map(({ keyword, slug }) => ({ keyword, slug })) : [...keywords];
rows = rows.filter((r) => !r.error);
const failed = [];
await Promise.all(Array.from({ length: 8 }, async () => {
  while (queue.length) { const k = queue.shift(); try { rows.push(await check(k)); } catch (e) { failed.push(k); } }
}));
// DataForSEO sometimes answers "Internal SE Server Error"; give those one slower second pass.
for (const k of failed) {
  await new Promise((s) => setTimeout(s, 3000));
  try { rows.push(await check(k)); } catch (e) { rows.push({ ...k, error: String(e.message ?? e) }); }
}
rows.sort((a, b) => (a.position ?? 999) - (b.position ?? 999) || a.keyword.localeCompare(b.keyword));

// Pages Google shows for the domain (rough index count).
let indexed = null;
try {
  const { result, cost: c } = await dfs('serp/google/organic/live/regular', [{ keyword: `site:${DOMAIN}`, location_code: 2554, language_code: 'en', depth: 10 }]);
  cost += c; indexed = result?.se_results_count ?? null;
} catch {}

const ok = rows.filter((r) => !r.error);
const summary = {
  date: today, domain: DOMAIN, location: 'Christchurch', keywords: rows.length,
  top3: ok.filter((r) => r.position && r.position <= 3).length,
  top10: ok.filter((r) => r.position && r.position <= 10).length,
  top20: ok.filter((r) => r.position && r.position <= 20).length,
  top100: ok.filter((r) => r.position).length,
  localPack: ok.filter((r) => r.localPack).length,
  aiOverviews: ok.filter((r) => r.aiOverview).length,
  aiOverviewsCitingUs: ok.filter((r) => r.aiOverviewCitesUs).length,
  indexed, errors: rows.length - ok.length, costUSD: Math.round(cost * 1000) / 1000,
};

fs.mkdirSync(dir, { recursive: true });
const earlier = fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f !== `${today}.json`).sort().pop();
const prev = earlier ? JSON.parse(fs.readFileSync(path.join(dir, earlier), 'utf8')) : null;
fs.writeFileSync(path.join(dir, `${today}.json`), JSON.stringify({ summary, rows }, null, 1) + '\n');

const prevPos = new Map((prev?.rows ?? []).map((r) => [r.keyword, r.position]));
const delta = (k, now) => {
  if (!prev) return '';
  const was = prevPos.get(k);
  if (was === undefined) return 'new';
  if (!was && !now) return '';
  if (!was) return 'entered';
  if (!now) return `dropped (was ${was})`;
  return now < was ? `up ${was - now}` : now > was ? `down ${now - was}` : 'same';
};
const sd = (k) => (prev ? ` (${summary[k] - prev.summary[k] >= 0 ? '+' : ''}${summary[k] - prev.summary[k]})` : '');
const md = [
  `# Status report ${today}: ${DOMAIN}`,
  '',
  prev ? `Compared with ${earlier.slice(0, 10)}.` : 'First report: this is the baseline.',
  '',
  `Google, searched from Christchurch, desktop, for the main keyword of every page (${summary.keywords} searches).`,
  '',
  '| Measure | Now |',
  '|---|---|',
  `| Keywords in the top 3 | ${summary.top3}${sd('top3')} |`,
  `| Keywords in the top 10 | ${summary.top10}${sd('top10')} |`,
  `| Keywords in the top 20 | ${summary.top20}${sd('top20')} |`,
  `| Keywords ranking at all (top 100) | ${summary.top100}${sd('top100')} |`,
  `| Shown in the map pack | ${summary.localPack}${sd('localPack')} |`,
  `| Searches with an AI Overview | ${summary.aiOverviews}${sd('aiOverviews')} |`,
  `| AI Overviews citing the site | ${summary.aiOverviewsCitingUs}${sd('aiOverviewsCitingUs')} |`,
  `| Pages Google shows for site: (rough) | ${summary.indexed ?? 'n/a'} |`,
  '',
  '## Every keyword',
  '',
  `| Keyword | Page | Position | Map pack | AI Overview | ${prev ? 'Change |' : ''}`,
  `|---|---|---|---|---|${prev ? '---|' : ''}`,
  ...rows.map((r) => `| ${r.keyword} | ${r.slug} | ${r.error ? 'error' : r.position ?? '-'} | ${r.localPack ?? '-'} | ${r.aiOverview ? (r.aiOverviewCitesUs ? 'cites us' : 'yes') : '-'} | ${prev ? delta(r.keyword, r.position) + ' |' : ''}`),
  '',
  `DataForSEO cost: US$${summary.costUSD}.`,
  '',
].join('\n');
fs.writeFileSync(path.join(dir, `${today}.md`), md);
console.log(JSON.stringify(summary));
