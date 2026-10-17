// Lists every page that has been built (home plus one per Markdown file).
import site from '../data/site.json';
export function GET() {
  const files = Object.keys(import.meta.glob('../content/*.md'));
  const paths = ['/', ...files.map((f) => `/${f.split('/').pop().replace(/\.md$/, '')}/`)];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((p) => `  <url><loc>${site.domain}${p}</loc></url>`).join('\n')}
</urlset>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
}
