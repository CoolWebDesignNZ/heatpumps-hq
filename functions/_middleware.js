// Password-protects the whole site while it's in preview. Set the
// SITE_PASSWORD secret on the Cloudflare Pages project; any username works.
// Delete the secret at launch to open the site.
//
// One address: once CANONICAL_HOST is set on the project (at launch, after the
// domain is live), www and the heatpumps-hq.pages.dev address 301 to
// https://CANONICAL_HOST with the same path and query, so every page, old URLs
// and new pages alike, has one address. Hashed preview deployments
// (<hash>.heatpumps-hq.pages.dev) are left alone.
export async function onRequest({ request, env, next }) {
  const canonical = env.CANONICAL_HOST;
  if (canonical) {
    const url = new URL(request.url);
    if (url.hostname === `www.${canonical}` || url.hostname === 'heatpumps-hq.pages.dev' || (url.hostname === canonical && url.protocol === 'http:')) {
      url.hostname = canonical; url.protocol = 'https:'; url.port = '';
      return Response.redirect(url.toString(), 301);
    }
  }
  const password = env.SITE_PASSWORD;
  if (!password) return next();
  // The quote form posts here from pages that are already behind the password.
  if (request.method === 'POST' && ['/api/quote', '/api/event'].includes(new URL(request.url).pathname)) return next();
  const [scheme, encoded] = (request.headers.get('Authorization') ?? '').split(' ');
  if (scheme === 'Basic' && encoded) {
    const decoded = atob(encoded);
    if (decoded.slice(decoded.indexOf(':') + 1) === password) {
      const res = await next();
      const out = new Response(res.body, res);
      out.headers.set('X-Robots-Tag', 'noindex, nofollow');
      return out;
    }
  }
  return new Response('Password required.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Heat Pumps HQ preview", charset="UTF-8"', 'X-Robots-Tag': 'noindex, nofollow' },
  });
}
