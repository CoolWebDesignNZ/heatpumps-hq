# Heat Pumps HQ — heatpumps-christchurch.co.nz

Astro static site replacing the old WordPress site. Every URL from the old
sitemap is kept exactly, trailing slash included, and new pages the client approves are added alongside them (`src/data/urls.json`).

- `src/content/<slug>.md` — one file per page; the filename is the URL.
- `src/pages/index.astro` — home page.
- `src/data/site.json` — business details (Nate, phone, hours, brands).
- `src/data/images.json` — Ideogram prompts; `npm run images` generates missing ones (needs `IDEOGRAM_API_KEY`).
- `npm run check-copy` — checks every page against the CLAUDE.md copy and SEO rules.
- `research/keywords.json` — main and secondary keyword per URL (DataForSEO, NZ, 2026-10-17).
- `npm run build` — builds `dist/` and reports how many of the URLs in urls.json exist. It fails if a page isn't listed there.

Brand colours are `--brand` / `--brand-ink` in `src/styles/global.css`.

Preview: https://heatpumps-hq.pages.dev, password-protected by `functions/_middleware.js` (secret `SITE_PASSWORD` on the Pages project). Deploy with `npm run build && npx wrangler pages deploy dist --project-name heatpumps-hq --branch main`. Delete the secret at launch.

Launch blockers: the quote form posts to `/api/quote`, which doesn't exist yet. It needs a Cloudflare Worker with Email Routing to Nate.
