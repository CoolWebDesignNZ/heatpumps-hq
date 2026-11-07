// Pulls the last 28 days of Search Console for the site (and the 28 days before) through
// coolweb.design/api/client-search, whose Google service account is a user on the property.
// The environment injects the X-Playbook-Key header, so no key lives here.
//   node scripts/gsc-fetch.mjs   -> research/status/gsc/<today>.json (same shape as gsc-summary.py)
import fs from 'node:fs';
const domain = 'heatpumps-christchurch.co.nz';
const res = await fetch(`https://coolweb.design/api/client-search?domain=${domain}`, { headers: { 'X-Playbook-Key': 'injected-by-proxy' } });
const d = await res.json().catch(() => ({}));
if (!res.ok || d.error) { console.error('Search Console fetch failed:', res.status, d.error || '', d.detail || ''); process.exit(1); }
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
