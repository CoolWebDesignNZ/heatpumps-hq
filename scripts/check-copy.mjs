// Checks every page in src/content/ against the CLAUDE.md copy and SEO rules.
// Usage: node scripts/check-copy.mjs            (all pages)
//        node scripts/check-copy.mjs rolleston  (named pages only)
import fs from 'node:fs';
import { parse } from 'yaml';

const urls = JSON.parse(fs.readFileSync('src/data/urls.json', 'utf8'));
const images = JSON.parse(fs.readFileSync('src/data/images.json', 'utf8'));
// CHECK_IMAGES=<dir> also counts image entries in that folder's .json files (drafts not yet merged).
if (process.env.CHECK_IMAGES) for (const f of fs.readdirSync(process.env.CHECK_IMAGES).filter((x) => x.endsWith('.json')))
  Object.assign(images, JSON.parse(fs.readFileSync(`${process.env.CHECK_IMAGES}/${f}`, 'utf8')));
const paths = new Set(urls.map((u) => u.path));
const only = process.argv.slice(2);

const banned = [
  "in today's world", 'look no further', "whether you're", 'whether you are', 'seamless', 'elevate', 'various',
  'a range of', 'and more.', 'and more,', '[suburb]', 'unlock', 'delve', 'game changer', 'game-changer', 'peace of mind',
  'rest assured', 'hassle-free', 'hassle free', 'cutting-edge', 'cutting edge', 'state-of-the-art', 'top-notch',
  'one-stop', 'second to none', 'tailored to your needs', 'nestled', 'vibrant', 'bustling', 'navigate the',
  'when it comes to', "it's worth noting", 'in conclusion', 'ever-changing', 'look no', 'trusted experts',
  'heat pumps hq offers', 'owner-run', 'owner run', 'nate sizes', 'nate installs', 'nate will', 'testimonial', 'happy customers',
  'fastest', 'number one', 'no.1', '#1', 'best in christchurch', 'best in canterbury', 'unrivalled', 'unmatched', 'industry leading', 'industry-leading', 'leading heat pump',
];
const us = /\b(color|colors|center|centers|centered|organize|organized|neighbor|neighbors|neighborhood|favorite|liter|liters|analyze|optimize|optimized|minimize|maximize|realize|recognize|apologize|customize|customized|humidity level|aluminum|gray|program(?:s|med)? your)\b/i;

const seen = { title: new Map(), description: new Map(), h2: new Map() };
// H2 keyword matching: word sets, plurals folded, place words optional.
const stem = (w) => w.replace(/(ies)$/, 'y').replace(/(?<!s)s$/, '');
const words = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).map(stem);
const loose = new Set(['christchurch', 'nz', 'chch', 'new', 'zealand', 'in', 'for', 'of', 'the', 'a', 'to']);
const hasKw = (h, kw) => { const hw = new Set(words(h)); return words(kw).filter((w) => !loose.has(w)).every((w) => hw.has(w)); };
const problems = [];
const files = fs.readdirSync('src/content').filter((f) => f.endsWith('.md'));
for (const f of files) {
  const slug = f.replace(/\.md$/, '');
  const raw = fs.readFileSync(`src/content/${f}`, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const err = (msg) => { if (!only.length || only.includes(slug)) problems.push(`${slug}: ${msg}`); };
  if (!m) { err('no frontmatter'); continue; }
  let fm;
  try { fm = parse(m[1]); } catch (e) { err(`frontmatter does not parse: ${e.message}`); continue; }
  const body = m[2];
  const entry = urls.find((u) => u.slug === slug);
  if (!entry) err('not in urls.json');
  for (const k of ['title', 'description', 'h1', 'intro', 'hero', 'keyword']) if (!fm[k]) err(`missing ${k}`);
  if (!Array.isArray(fm.secondary)) err('missing secondary');
  const t = String(fm.title ?? ''), d = String(fm.description ?? ''), kw = String(fm.keyword ?? '').toLowerCase();
  if (t.length > 44) err(`title is ${t.length} characters (44 max)`);
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (kw && !norm(t).startsWith(norm(kw))) err(`title does not start with the keyword "${kw}"`);
  if (kw && !words(kw).filter((w) => w !== 'nz').every((w) => words(String(fm.h1 ?? '')).includes(w))) err(`h1 does not contain every word of "${kw}"`);
  if (d.length < 120 || d.length > 158) err(`description is ${d.length} characters (120 to 158)`);
  if (d && t && d.toLowerCase().includes(t.toLowerCase())) err('description repeats the title');
  if (/\d{2}\s?\d{3}\s?\d{4}/.test(d)) err('phone number in description');
  for (const [k, v] of [['title', t], ['description', d]]) {
    if (seen[k].has(v)) err(`${k} duplicates ${seen[k].get(v)}`); else seen[k].set(v, slug);
  }
  // H2s: the main keyword in at least one, keywords (main or secondary) in at least half.
  const h2s = [...body.matchAll(/^## (.+)$/gm)].map((x) => x[1].trim());
  const all = [...h2s, fm.faqHeading, fm.relatedHeading].filter(Boolean);
  if (entry && !['privacy-policy', 'terms-and-conditions'].includes(slug) && kw) {
    const kws = [kw, ...(fm.secondary ?? [])];
    if (!all.some((h) => hasKw(h, kw))) err(`no H2 contains the main keyword "${kw}"`);
    const n = all.filter((h) => kws.some((k) => hasKw(h, k))).length;
    if (n * 2 < all.length) err(`only ${n} of ${all.length} H2s carry a keyword`);
    if (fm.faqs?.length && !fm.faqHeading) err('missing faqHeading');
    if (fm.related?.length && !fm.relatedHeading) err('missing relatedHeading');
  }
  for (const h of all) { const k = h.toLowerCase(); if (seen.h2.has(k) && seen.h2.get(k) !== slug) err(`H2 "${h}" also on ${seen.h2.get(k)}`); else seen.h2.set(k, slug); }
  if (entry?.type === 'guide' && !fm.updated) err('guide without updated date');
  for (const id of [fm.hero, ...(fm.gallery ?? [])].filter(Boolean)) if (!images[id]) err(`image "${id}" not in images.json`);
  const text = raw.toLowerCase();
  if (/[–—]/.test(raw)) err('em or en dash');
  if (/ - /.test(body.replace(/^\s*- /gm, '').replace(/\| --- /g, ''))) err('spaced hyphen used as a dash');
  for (const b of banned) if (text.includes(b)) err(`banned phrase "${b}"`);
  if (/\bour (owner|founder)\b/i.test(raw)) err('says "our owner" or "our founder": name Nate instead');
  // Copy talks to the reader about heat pumps, not about the website's pages.
  if (!['privacy-policy', 'terms-and-conditions'].includes(slug) && /\bpages?\b|this site\b|this guide\b/i.test(raw.replace(/^(related|  - \{ label)[^\n]*$/gm, '').replace(/\]\([^)]*\)/g, ''))) err('talks about pages or the site');
  const u = raw.replace(/\]\([^)]*\)|https?:\/\/\S+/g, '').match(us); if (u) err(`US spelling "${u[0]}"`);
  if (!['about-us', 'privacy-policy'].includes(slug) && /\bnate\b/i.test(raw)) err('names Nate outside About');
  for (const [, href] of raw.matchAll(/(?:\]\(|href=")(\/[^)"#]*)/g)) if (!paths.has(href)) err(`link to ${href} is not in urls.json`);
  for (const r of fm.related ?? []) if (!paths.has(r.href)) err(`related link ${r.href} is not in urls.json`);
}
console.log(problems.length ? problems.join('\n') : `${files.length} pages pass`);
process.exit(problems.length ? 1 : 0);
