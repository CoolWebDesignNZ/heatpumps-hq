# Heat Pumps HQ site: rules

Rebuild of heatpumps-christchurch.co.nz (Nate Thompson, Heat Pumps HQ). Read README.md for the file layout.

## URLs
- Every URL lives in `src/data/urls.json`: the 133 from the old site, plus new pages the client has approved (marked `"new": true`). Never rename or remove an old URL, never add a 301. The build fails on a page that isn't in urls.json.
- New pages so far: /high-wall-heat-pumps/ and /floor-mounted-heat-pumps/ (client asked for pages on each heat pump type, 2026-10-18), /heat-pump-guides/ (the Guides hub the menu button opens, 2026-10-20).
- Removed pages (heat-pump-subsidy, solar-powered-heat-pump-integration, energy-efficiency-assessment) stay gone: the client asked for them out (energy-efficiency-assessment removed 2026-10-20).

## Copy
- Written for a human, by a human. Plain, direct, specific to the page. No filler, no AI phrasing ("in today's world", "look no further", "whether you're", "seamless", "elevate").
- No AI fluff, no jokes or jesting, no cute or clever closing lines, no vague placeholders ("various", "a range of", "and more", "[suburb]"). End a page with the next step, stated plainly.
- Voice: we and you. "We size every install", never "Nate sizes" or "Heat Pumps HQ offers". Nate is named only as the owner and founder. It is Nate's business: never "our owner", "our founder" or "owner-run". Name him ("Nate Thompson started Heat Pumps HQ").
- NZ English (colour, centre, organise, metres, neighbour). No em dashes or en dashes anywhere.
- Never invent facts: no testimonials, success stories, Nate quotes, stats, prices or claims ("most often", "fastest") unless Nate supplies them. State rules and limits plainly and check them against the official source, but never cite it: no "Source:" lines, no "EECA says" (client, 2026-10-20). Link out only to a tool or form the reader uses.
- Talk to the reader about their home and heat pump, never about the website: no "this page", "each suburb page covers", "our X page explains". Put links on the topic words instead.
- Old site copy is not reused. Only its URLs.
- Never quote, cite or link to other companies (manufacturers' or distributors' websites, news sites, charities). The brands we install can be named as products we fit. Links out go only to .govt.nz tools and forms (client, 2026-10-20).

## SEO per page
- Every page targets its own keywords from DataForSEO (NZ, en) plus the Search Console export. Record them in the page frontmatter as `keyword` and `secondary`.
- Title: main keyword first, unique. The layout adds " | Heat Pumps HQ" to every page, so the frontmatter title is 44 characters or fewer (60 in total).
- H1: contains the main keyword, written as a heading a person would say.
- Meta description: unique, 120 to 158 characters, does not repeat the title. Lead with the searcher's problem or the main keyword, say exactly what the page gives them, and end with a concrete reason to click (fixed-price quote, the actual limits, all brands). Every description different. No phone numbers, no brand-name stuffing.

## Design
- No icons, no coloured borders, no dark section backgrounds (dark only as an overlay on hero photos, and the footer, which the client asked to be dark), body text 18px or larger, Inter, lots of photos.
- Text runs the full container width.
- Images come from Ideogram (`npm run images`, needs `IDEOGRAM_API_KEY`). Technician and van photos carry HEAT PUMPS HQ branding (client, 2026-10-20), shown from behind with no face, and are never named as Nate or a real person. Never more than one heat pump unit in a photo; street scenes show none.
