# Heat Pumps HQ site: rules

Rebuild of heatpumps-christchurch.co.nz (Nate Thompson, Heat Pumps HQ). Read README.md for the file layout.

## URLs
- Only the 133 URLs in `src/data/urls.json`. Never add a page, never rename a slug, never add a 301. The build fails on a new URL.
- Removed pages (heat-pump-subsidy, solar-powered-heat-pump-integration) stay gone: Nate doesn't do that work.

## Copy
- Written for a human, by a human. Plain, direct, specific to the page. No filler, no AI phrasing ("in today's world", "look no further", "whether you're", "seamless", "elevate").
- No AI fluff, no jokes or jesting, no cute or clever closing lines, no vague placeholders ("various", "a range of", "and more", "[suburb]"). End a page with the next step, stated plainly.
- Voice: we and you. "We size every install", never "Nate sizes" or "Heat Pumps HQ offers". Nate is named only as the owner and founder.
- NZ English (colour, centre, organise, metres, neighbour). No em dashes or en dashes anywhere.
- Never invent facts: no testimonials, success stories, Nate quotes, stats, prices or claims ("most often", "fastest") unless Nate supplies them. Laws, rules and limits need an official source linked in the copy.
- Old site copy is not reused. Only its URLs.

## SEO per page
- Every page targets its own keywords from DataForSEO (NZ, en) plus the Search Console export. Record them in the page frontmatter as `keyword` and `secondary`.
- Title: main keyword first, unique. The layout adds " | Heat Pumps HQ" to every page, so the frontmatter title is 44 characters or fewer (60 in total).
- H1: contains the main keyword, written as a heading a person would say.
- Meta description: unique, 120 to 158 characters, does not repeat the title. Lead with the searcher's problem or the main keyword, say exactly what the page gives them, and end with a concrete reason to click (fixed-price quote, the actual limits, all brands). Every description different. No phone numbers, no brand-name stuffing.

## Design
- No icons, no coloured borders, no dark section backgrounds (dark only as an overlay on hero photos), body text 18px or larger, Inter, lots of photos.
- Text runs the full container width.
- Images come from Ideogram (`npm run images`, needs `IDEOGRAM_API_KEY`). No photo is presented as Nate or his team.
