// After a build: report which of the old site's 133 URLs exist in dist/,
// and fail if dist/ has a page that was never on the old site.
import fs from 'node:fs';
import path from 'node:path';

const urls = JSON.parse(fs.readFileSync('src/data/urls.json', 'utf8'));
const old = new Set(urls.map((u) => u.path));
const built = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (f.name === 'index.html') built.push('/' + path.relative('dist', dir).replace(/\\/g, '/') + (dir === 'dist' ? '' : '/'));
  }
})('dist');
const extra = built.map((b) => b.replace('//', '/')).filter((b) => !old.has(b));
const missing = [...old].filter((u) => !built.map((b) => b.replace('//', '/')).includes(u));
console.log(`URLs built: ${old.size - missing.length} of ${old.size}`);
if (missing.length) console.log(`Not built yet: ${missing.length}`);
if (extra.length) { console.error('Pages that were not on the old site:', extra); process.exit(1); }
