// Pages in the sitemap: every built page except the legal ones (terms, privacy).
import site from '../data/site.json';
import urls from '../data/urls.json';
export function urlset() {
  const skip = new Set(urls.filter((u) => u.type === 'legal').map((u) => u.path));
  const files = Object.keys(import.meta.glob('../content/*.md'));
  const paths = ['/', ...files.map((f) => `/${f.split('/').pop().replace(/\.md$/, '')}/`)].filter((p) => !skip.has(p));
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((p) => `  <url><loc>${site.domain}${p}</loc></url>`).join('\n')}
</urlset>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
}
