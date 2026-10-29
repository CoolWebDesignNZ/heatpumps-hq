// Password-protects the whole site while it's in preview. Set the
// SITE_PASSWORD secret on the Cloudflare Pages project; any username works.
// Delete the secret (or this file) at launch to open the site.
export async function onRequest({ request, env, next }) {
  const password = env.SITE_PASSWORD;
  if (!password) return next();
  // The quote form posts here from pages that are already behind the password.
  if (request.method === 'POST' && new URL(request.url).pathname === '/api/quote') return next();
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
