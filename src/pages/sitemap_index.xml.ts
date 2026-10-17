// Same address Google already has for the sitemap: /sitemap_index.xml.
import site from '../data/site.json';
export function GET() {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${site.domain}/page-sitemap.xml</loc></sitemap>
</sitemapindex>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
}
