# Heat Pumps HQ — heatpumps-christchurch.co.nz

Astro static site replacing the old WordPress site. Every URL from the old
sitemap is kept exactly, trailing slash included, and new pages the client approves are added alongside them (`src/data/urls.json`).

- `src/content/<slug>.md` — one file per page; the filename is the URL.
- `src/pages/index.astro` — home page.
- `src/data/site.json` — business details (Nate, phone, hours, brands).
- `src/data/images.json` — Ideogram prompts; `npm run images` generates missing ones (needs `IDEOGRAM_API_KEY`). Pages load the WebP; the JPEG beside it is for og:image and schema. `node scripts/to-webp.mjs` makes a WebP for any JPEG without one.
- `src/pages/404.astro` and `src/pages/thank-you.astro` — noindex, not in urls.json or the sitemap. The quote form should land on /thank-you/ once /api/quote exists.
- `npm run check-copy` — checks every page against the CLAUDE.md copy and SEO rules.
- `research/keywords.json` — main and secondary keyword per URL (DataForSEO, NZ, 2026-10-17).
- `npm run build` — builds `dist/` and reports how many of the URLs in urls.json exist. It fails if a page isn't listed there.

Brand colours are `--brand` / `--brand-ink` in `src/styles/global.css`.

Preview: https://heatpumps-hq.pages.dev, password-protected by `functions/_middleware.js` (secret `SITE_PASSWORD` on the Pages project). Deploy with `npm run build && npx wrangler pages deploy dist --project-name heatpumps-hq --branch main`. Delete the secret at launch.

Quote form: posts to `/api/quote` (`functions/api/quote.js`), which emails the request and redirects to /thank-you/. Pages can't send email, so it goes over the `EMAILER` service binding to the `coolweb-emailer` Worker (Cloudflare Email Routing). Pages project settings: `EMAILER` -> coolweb-emailer, `LEAD_FROM` = leads@coolweb.design, `LEAD_TO` = info@heatpumps-christchurch.co.nz. `LEAD_TO` must be a verified destination address in Email Routing. A hidden `company` field catches bots. While the password is on, the middleware lets `POST /api/quote` through.

Size calculator: `src/components/SizeCalc.astro`, shown on any page with `calculator: true` (calculator-single-room-heat-pump). It uses the Healthy Homes Schedule 2 method (18°C inside, minus 4°C for Christchurch, 1.0 or 0.5 air changes, +40 W/m² or × 1.2) with typical R-values for each construction choice; the R-values are estimates, listed in the component.
