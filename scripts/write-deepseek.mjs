// Writes new pages with DeepSeek from the briefs in research/new-pages.json.
// For each brief: sends the CLAUDE.md copy and SEO rules, a similar existing
// page as the format example, the list of real URLs it may link to and the
// brief; saves src/content/<slug>.md; adds the URL to urls.json (new: true);
// runs check-copy on it and sends any failures back for a rewrite, up to three
// times. Pages that still fail are left in place and listed at the end.
// Needs DEEPSEEK_API_KEY. Usage: node scripts/write-deepseek.mjs [slug ...]
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const key = process.env.DEEPSEEK_API_KEY;
if (!key) { console.error('DEEPSEEK_API_KEY is not set.'); process.exit(1); }
const model = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';

const briefs = JSON.parse(fs.readFileSync('research/new-pages.json', 'utf8'));
const only = process.argv.slice(2);
const rules = fs.readFileSync('CLAUDE.md', 'utf8').split('## Design')[0];
const urlsPath = 'src/data/urls.json';
const urls = JSON.parse(fs.readFileSync(urlsPath, 'utf8'));
const linkable = () => urls.map((u) => u.path).concat(briefs.map((b) => `/${b.slug}/`));

const system = `You write pages for Heat Pumps HQ, a heat pump installer in Christchurch, New Zealand, owned by Nate Thompson. Follow these rules exactly:

${rules}

Output one Markdown file and nothing else: YAML frontmatter between --- lines, then the body. Match the frontmatter fields and section style of the example page you are given. Body: 5 to 8 H2 sections, about 900 to 1400 words, short paragraphs and bold-led bullet lists like the example. Write 4 or 5 FAQs and 3 related links. Internal links only to URLs in the list given. No external links except https://tools.tenancy.govt.nz/heating-tool where the brief mentions it. Never invent prices, figures, percentages, testimonials or claims about the business. No em dashes or en dashes. Use the hero and gallery image ids given. Do not wrap the output in a code fence.`;

async function ask(messages) {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, temperature: 0.7 }),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${await res.text()}`);
  return (await res.json()).choices[0].message.content.trim().replace(/^```(?:markdown|md)?\n/, '').replace(/\n```$/, '');
}

function check(slug) {
  try { execFileSync('node', ['scripts/check-copy.mjs', slug], { encoding: 'utf8', stdio: 'pipe' }); return ''; }
  catch (e) { return (e.stdout || '') + (e.stderr || ''); }
}

const failed = [];
for (const b of briefs.filter((x) => !only.length || only.includes(x.slug))) {
  if (!urls.some((u) => u.slug === b.slug)) {
    urls.push({ path: `/${b.slug}/`, slug: b.slug, type: b.type, new: true });
    fs.writeFileSync(urlsPath, JSON.stringify(urls, null, 1) + '\n');
  }
  const example = fs.readFileSync(`src/content/${b.example}.md`, 'utf8');
  const user = `Write the page /${b.slug}/ (page type: ${b.type}${b.suburb ? `, suburb: ${b.suburb}` : ''}).
Main keyword: ${b.keyword}
Secondary keywords: ${b.secondary.join(', ')}
Image ids: hero: ${b.slug}-hero, gallery: [${b.slug}-1, ${b.slug}-2]
Brief: ${b.brief}

URLs you may link to:
${linkable().join('\n')}

Example page for format and tone (do not copy its sentences):
${example}`;
  const messages = [{ role: 'system', content: system }, { role: 'user', content: user }];
  let ok = false;
  for (let attempt = 1; attempt <= 4 && !ok; attempt++) {
    const md = await ask(messages);
    fs.writeFileSync(`src/content/${b.slug}.md`, md.endsWith('\n') ? md : md + '\n');
    const problems = check(b.slug);
    if (!problems.trim() || /pages pass/.test(problems)) { ok = true; break; }
    console.log(`${b.slug}: attempt ${attempt} failed the checks`);
    messages.push({ role: 'assistant', content: md }, { role: 'user', content: `The page failed these checks. Rewrite the whole file to fix every one, changing nothing else:\n${problems}` });
  }
  console.log(`${b.slug}: ${ok ? 'written, checks pass' : 'written, still failing checks'}`);
  if (!ok) failed.push(b.slug);
}
if (failed.length) console.log(`Still failing: ${failed.join(', ')}`);
