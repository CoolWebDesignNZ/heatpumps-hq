// Receives the quote form and emails it to Nate through Brevo (see below), then
// records it for the monthly report and passes it to the More Leads tracker.
import site from '../../src/data/site.json';

const clean = (v, max = 500) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

const page = (status, h1, p) => new Response(
  `<!doctype html><html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${h1} | ${site.name}</title><style>body{font:18px/1.6 system-ui,sans-serif;max-width:640px;margin:60px auto;padding:0 20px;color:#1d2731}a{color:inherit}</style></head><body><h1>${h1}</h1><p>${p}</p><p><a href="/">Back to the home page</a></p></body></html>`,
  { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
);

const callUs = `Please call us on <a href="${site.phoneHref}">${site.phone}</a>, ${site.hours[0].days}, ${site.hours[0].label}.`;

export async function onRequestPost({ request, env, waitUntil }) {
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

  // The email goes through Brevo's API, the same arrangement as every CoolWeb client site:
  // from LEAD_FROM (leads@coolweb.design, already authenticated in Brevo) to LEAD_TO, with
  // the customer as Reply-To. Needs BREVO_API_KEY, LEAD_FROM and LEAD_TO on the project.
  let emailed = false;
  if (!env.BREVO_API_KEY || !env.LEAD_FROM || !env.LEAD_TO) {
    console.log('quote: BREVO_API_KEY, LEAD_FROM or LEAD_TO not set', text);
  } else {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: { name: `${site.name} website`, email: env.LEAD_FROM },
          to: String(env.LEAD_TO).split(',').map((s) => ({ email: s.trim() })).filter((x) => x.email),
          // LEAD_BCC: who else gets a copy (CoolWeb), comma separated. They can't see each other.
          ...(env.LEAD_BCC ? { bcc: String(env.LEAD_BCC).split(',').map((s) => ({ email: s.trim() })).filter((x) => x.email) } : {}),
          ...(email ? { replyTo: { email, name: q.name } } : {}),
          subject: `Quote request: ${q.service}, ${q.suburb} (${q.name})`,
          textContent: text,
        }),
      });
      if (!res.ok) throw new Error(`Brevo ${res.status} ${(await res.text()).slice(0, 300)}`);
      emailed = true;
    } catch (err) {
      console.log('quote: send failed', String(err), text);
    }
  }

  // Count the lead for the monthly report, and pass it to the More Leads tracker
  // (leads.moreleads.nz) the way the old site's form webhook did. Both happen whether or not
  // the email went, so a lead is never lost to a mail fault: the tracker shows it as not
  // emailed. They run after the reply and their failures are only logged.
  const fromPath = (() => { try { return new URL(from).pathname; } catch { return ''; } })();
  waitUntil(recordEvent(env, emailed ? 'lead' : 'lead-unsent', fromPath, new URL(request.url).hostname, q.service));
  if (env.LEADS_KEY && env.LEADS_SITE) {
    waitUntil(fetch('https://leads.moreleads.nz/api/lead.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site: env.LEADS_SITE, key: env.LEADS_KEY, lead: {
        source: 'form', service: q.service, name: q.name, phone: q.phone, email,
        suburb: q.suburb, message: q.message, page_url: from, received_at: new Date().toISOString(),
        emailed_to: String(env.LEAD_TO).split(',').map((s) => s.trim()),
        emailed_bcc: String(env.LEAD_BCC ?? '').split(',').map((s) => s.trim()).filter(Boolean), emailed_ok: emailed,
      } }),
    }).then((r) => { if (!r.ok) console.log('quote: tracker said', r.status); }).catch((e) => console.log('quote: tracker failed', String(e))));
  }

  // The visitor is told the truth: if the email did not go, they are asked to ring.
  if (!emailed) return page(502, "Your request didn't send", callUs);
  return Response.redirect(new URL('/thank-you/', request.url), 303);
}

export async function recordEvent(env, type, page, host, detail = '') {
  if (!env.EVENTS) return;
  try {
    await env.EVENTS.prepare('INSERT INTO events (type, page, host, detail) VALUES (?, ?, ?, ?)')
      .bind(type, String(page).slice(0, 200), String(host).slice(0, 100), String(detail).slice(0, 100)).run();
  } catch (e) { console.log('event insert failed', String(e)); }
}
