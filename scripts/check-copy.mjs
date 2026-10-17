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
  'heat pumps hq offers', 'nate sizes', 'nate installs', 'nate will', 'testimonial', 'happy customers',
  'fastest', 'number one', 'no.1', '#1', 'best in christchurch', 'best in canterbury', 'unrivalled', 'unmatched', 'industry leading', 'industry-leading', 'leading heat pump',
];
const us = /\b(color|colors|center|centers|centered|organize|organized|neighbor|neighbors|neighborhood|favorite|liter|liters|analyze|optimize|optimized|minimize|maximize|realize|recognize|apologize|customize|customized|humidity level|aluminum|gray|program(?:s|med)? your)\b/i;

const seen = { title: new Map(), description: new Map() };
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
  if (!entry) err('not one of the 133 URLs');
  for (const k of ['title', 'description', 'h1', 'intro', 'hero', 'keyword']) if (!fm[k]) err(`missing ${k}`);
  if (!Array.isArray(fm.secondary)) err('missing secondary');
  const t = String(fm.title ?? ''), d = String(fm.description ?? ''), kw = String(fm.keyword ?? '').toLowerCase();
  if (t.length > 44) err(`title is ${t.length} characters (44 max)`);
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (kw && !norm(t).startsWith(norm(kw))) err(`title does not start with the keyword "${kw}"`);
  if (kw && !norm(kw).split(' ').filter((w) => w !== 'nz').every((w) => norm(String(fm.h1 ?? '')).split(' ').includes(w))) err(`h1 does not contain every word of "${kw}"`);
  if (d.length < 120 || d.length > 158) err(`description is ${d.length} characters (120 to 158)`);
  if (d && t && d.toLowerCase().includes(t.toLowerCase())) err('description repeats the title');
  if (/\d{2}\s?\d{3}\s?\d{4}/.test(d)) err('phone number in description');
  for (const [k, v] of [['title', t], ['description', d]]) {
    if (seen[k].has(v)) err(`${k} duplicates ${seen[k].get(v)}`); else seen[k].set(v, slug);
  }
  if (entry?.type === 'guide' && !fm.updated) err('guide without updated date');
  for (const id of [fm.hero, ...(fm.gallery ?? [])].filter(Boolean)) if (!images[id]) err(`image "${id}" not in images.json`);
  const text = raw.toLowerCase();
  if (/[–—]/.test(raw)) err('em or en dash');
  if (/ - /.test(body.replace(/^\s*- /gm, '').replace(/\| --- /g, ''))) err('spaced hyphen used as a dash');
  for (const b of banned) if (text.includes(b)) err(`banned phrase "${b}"`);
  const u = raw.replace(/\]\([^)]*\)|https?:\/\/\S+/g, '').match(us); if (u) err(`US spelling "${u[0]}"`);
  if (slug !== 'about-us' && /\bnate\b/i.test(raw)) err('names Nate outside About');
  for (const [, href] of raw.matchAll(/(?:\]\(|href=")(\/[^)"#]*)/g)) if (!paths.has(href)) err(`link to ${href} is not one of the 133 URLs`);
  for (const r of fm.related ?? []) if (!paths.has(r.href)) err(`related link ${r.href} is not one of the 133 URLs`);
}
console.log(problems.length ? problems.join('\n') : `${files.length} pages pass`);
process.exit(problems.length ? 1 : 0);
