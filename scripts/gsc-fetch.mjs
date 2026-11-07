// Reads the Search Console figures the heatpumps-hq-gsc Worker (workers/gsc/) stored in the
// heatpumps-hq-events D1 (last 28 days and the 28 before, pulled through coolweb.design).
// Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.
//   node scripts/gsc-fetch.mjs   -> research/status/gsc/<today>.json (same shape as gsc-summary.py)
import fs from 'node:fs';
const DB = '26674de9-c075-42d1-a4cb-b716f963b65d';
const api = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${DB}/query`, {
  method: 'POST', headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ sql: 'SELECT fetched_at, status, data FROM gsc ORDER BY id DESC LIMIT 1' }),
}).then((r) => r.json());
const row = api.result?.[0]?.results?.[0];
if (!row) { console.error('No Search Console row stored yet:', JSON.stringify(api.errors || [])); process.exit(1); }
const age = (Date.now() - Date.parse(row.fetched_at + 'Z')) / 86400000;
const d = JSON.parse(row.data);
if (d.error) { console.error(`Search Console failed (${row.fetched_at}):`, d.error, d.detail || ''); process.exit(1); }
if (age > 5) console.error(`Warning: the newest Search Console pull is ${Math.round(age)} days old (${row.fetched_at}).`);
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1;
const r2 = (n) => Math.round(n * 10) / 10;
const prevEnd = new Date(Date.parse(d.range.start) - 86400000).toISOString().slice(0, 10);
const prevStart = new Date(Date.parse(prevEnd) - (days(d.range.start, d.range.end) - 1) * 86400000).toISOString().slice(0, 10);
const totals = (t, from, to) => ({ from, to, days: days(from, to), clicks: t.clicks, impressions: t.impressions, ctr: Math.round(t.ctr * 10000) / 10000, position: r2(t.position) });
const item = (key) => (x) => ({ item: x[key], clicks: x.clicks, impressions: x.impressions, position: r2(x.position) });
const out = {
  range: 'Last 28 days (API)', ...totals(d.totals, d.range.start, d.range.end),
  previous: totals(d.previous, prevStart, prevEnd),
  topQueriesByClicks: [...d.queries].sort((a, b) => b.clicks - a.clicks).slice(0, 25).map(item('term')),
  topQueriesByImpressions: [...d.queries].sort((a, b) => b.impressions - a.impressions).slice(0, 25).map(item('term')),
  topPagesByClicks: [...d.pages].sort((a, b) => b.clicks - a.clicks).slice(0, 25).map(item('url')),
};
const file = `research/status/gsc/${new Date().toISOString().slice(0, 10)}.json`;
fs.mkdirSync('research/status/gsc', { recursive: true });
fs.writeFileSync(file, JSON.stringify(out, null, 2));
console.log(file, `${out.clicks} clicks, ${out.impressions} impressions, position ${out.position}`);
