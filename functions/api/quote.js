// Receives the quote form and emails it to Nate.
// Pages can't send email, so the message goes over the EMAILER service binding
// to the coolweb-emailer Worker, which sends it through Cloudflare Email
// Routing. On the Pages project: service binding EMAILER -> coolweb-emailer,
// LEAD_FROM (a sender on a domain with Email Routing on) and LEAD_TO (a
// verified destination address; comma-separate for more than one).
import site from '../../src/data/site.json';

const clean = (v, max = 500) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

const page = (status, h1, p) => new Response(
  `<!doctype html><html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${h1} | ${site.name}</title><style>body{font:18px/1.6 system-ui,sans-serif;max-width:640px;margin:60px auto;padding:0 20px;color:#1d2731}a{color:inherit}</style></head><body><h1>${h1}</h1><p>${p}</p><p><a href="/">Back to the home page</a></p></body></html>`,
  { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
);

const callUs = `Please call us on <a href="${site.phoneHref}">${site.phone}</a>, ${site.hours[0].days}, ${site.hours[0].label}.`;

export async function onRequestPost({ request, env }) {
  let form;
  try { form = await request.formData(); } catch { return page(400, 'Something went wrong', `We couldn't read the form. ${callUs}`); }

  // Hidden field people never see; bots fill it in. Pretend it worked.
  if (clean(form.get('company'))) return Response.redirect(new URL('/thank-you/', request.url), 303);

  const q = {
    name: clean(form.get('name'), 120),
    phone: clean(form.get('phone'), 40),
    service: clean(form.get('service'), 40),
    suburb: clean(form.get('suburb'), 200),
    email: clean(form.get('email'), 200),
    message: String(form.get('message') ?? '').trim().slice(0, 4000),
  };
  if (!q.name || !q.phone || !q.service || !q.suburb) {
    return page(400, 'A few details are missing', `Go back and fill in your name, phone, what you need and your suburb. Or ${callUs.charAt(0).toLowerCase() + callUs.slice(1)}`);
  }
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q.email) ? q.email : '';
  const from = request.headers.get('Referer') || '';

  const text = [
    `New quote request from the website`,
    ``,
    `Name: ${q.name}`,
    `Phone: ${q.phone}`,
    `Email: ${email || '(not given)'}`,
    `Needs: ${q.service}`,
    `Suburb or address: ${q.suburb}`,
    ``,
    `Description:`,
    q.message || '(none)',
    ``,
    `Sent from: ${from}`,
  ].join('\n');

  if (!env.EMAILER || !env.LEAD_FROM || !env.LEAD_TO) {
    console.log('quote: EMAILER, LEAD_FROM or LEAD_TO not set', text);
    return page(503, "Your request didn't send", callUs);
  }

  try {
    const res = await env.EMAILER.fetch('https://emailer/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${site.name} website <${env.LEAD_FROM}>`,
        to: env.LEAD_TO,
        replyTo: email || undefined,
        subject: `Quote request: ${q.service}, ${q.suburb} (${q.name})`,
        text,
      }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok) throw new Error(`${res.status} ${JSON.stringify(out)}`);
  } catch (err) {
    console.log('quote: send failed', String(err), text);
    return page(502, "Your request didn't send", callUs);
  }

  return Response.redirect(new URL('/thank-you/', request.url), 303);
}
