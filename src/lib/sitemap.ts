// Pages in the sitemap: every built page except the legal ones (terms, privacy).
// lastmod is the date the page's source file was last committed (today if it has uncommitted changes).
import { execSync } from 'node:child_process';
import site from '../data/site.json';
import urls from '../data/urls.json';

const today = new Date().toISOString().slice(0, 10);
function lastmod(file: string) {
  try {
    if (execSync(`git status --porcelain -- "${file}"`).toString().trim()) return today;
    return execSync(`git log -1 --format=%cs -- "${file}"`).toString().trim() || today;
  } catch { return today; }
}

export function urlset() {
  const skip = new Set(urls.filter((u) => u.type === 'legal').map((u) => u.path));
  const files = Object.keys(import.meta.glob('../content/*.md')).map((f) => f.split('/').pop().replace(/\.md$/, ''));
  const pages = [['/', 'src/pages/index.astro'], ...files.map((s) => [`/${s}/`, `src/content/${s}.md`])].filter(([p]) => !skip.has(p));
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(([p, f]) => `  <url><loc>${site.domain}${p}</loc><lastmod>${lastmod(f)}</lastmod></url>`).join('\n')}
</urlset>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
}
