# Heat Pumps HQ — heatpumps-christchurch.co.nz

Astro static site replacing the old WordPress site. Every URL from the old
sitemap (`src/data/urls.json`, 133 URLs) is kept exactly, trailing slash included.

- `src/content/<slug>.md` — one file per page; the filename is the URL.
- `src/pages/index.astro` — home page.
- `src/data/site.json` — business details (Nate, phone, hours, brands).
- `src/data/images.json` — Ideogram prompts; `npm run images` generates missing ones (needs `IDEOGRAM_API_KEY`).
- `npm run check-copy` — checks every page against the CLAUDE.md copy and SEO rules.
- `research/keywords.json` — main and secondary keyword per URL (DataForSEO, NZ, 2026-10-17).
- `npm run build` — builds `dist/` and reports how many of the 133 URLs exist. It fails if a page isn't one of the old URLs.

Brand colours are `--brand` / `--brand-ink` in `src/styles/global.css`.

Launch blockers: the quote form posts to `/api/quote`, which doesn't exist yet. It needs a Cloudflare Worker with Email Routing to Nate.
