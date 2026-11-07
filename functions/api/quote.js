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
          htmlContent: leadHtml(q, email, from),
        }),
      });
      if (!res.ok) throw new Error(`Brevo ${res.status} ${(await res.text()).slice(0, 300)}`);
      emailed = true;
    } catch (err) {
      console.log('quote: send failed', String(err), text);
    }
  }

  // A confirmation to the customer when they gave an email and the lead went out. Best
  // effort only: it never changes what the visitor is shown.
  if (emailed && email) waitUntil(sendConfirmation(env, q, email).catch((e) => console.log('quote: confirmation failed', String(e))));

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

const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function sendConfirmation(env, q, to) {
  const first = q.name.split(' ')[0];
  const replyTo = String(env.LEAD_TO).split(',')[0].trim();
  const rows = [['What you need', q.service], ['Address or suburb', q.suburb], ['Details', q.message || '(none)']];
  const hours = `${site.hours[0].days}, ${site.hours[0].label}`;
  const text = [
    `Hi ${first},`, '',
    `Thanks for your quote request. We've got it, and we call or email you back ${site.replyTime} (${hours}).`, '',
    'What you sent us:', ...rows.map(([k, v]) => `${k}: ${v}`), '',
    `Need us sooner? Call ${site.phone}.`, '',
    site.name, site.domain.replace('https://', ''),
  ].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#16191d;max-width:560px">
<p style="font-size:20px;font-weight:700;color:#0d5c8c;margin:0 0 16px">${escHtml(site.name)}</p>
<p>Hi ${escHtml(first)},</p>
<p>Thanks for your quote request. We've got it, and we call or email you back ${escHtml(site.replyTime)} (${escHtml(hours)}).</p>
<table style="border-collapse:collapse;margin:8px 0 16px">${rows.map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;font-weight:700;vertical-align:top">${escHtml(k)}</td><td style="padding:4px 0">${escHtml(v).replace(/\n/g, '<br>')}</td></tr>`).join('')}</table>
<p>Need us sooner? Call <a href="${site.phoneHref}" style="color:#0d5c8c;font-weight:700">${escHtml(site.phone)}</a>.</p>
<p style="color:#4a525b">${escHtml(site.name)}<br><a href="${site.domain}" style="color:#0d5c8c">${escHtml(site.domain.replace('https://', ''))}</a></p></div>`;
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: site.name, email: env.LEAD_FROM },
      to: [{ email: to, name: q.name }],
      replyTo: { email: replyTo, name: site.name },
      subject: `We've got your quote request, ${first}`,
      textContent: text,
      htmlContent: html,
    }),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status} ${(await res.text()).slice(0, 200)}`);
}

// The lead card Nate and Ryno get: the details at a glance, phone and email tappable.
function leadHtml(q, email, from) {
  const tel = q.phone.replace(/[^\d+]/g, '');
  const link = (href, s) => `<a href="${href}" style="color:#0d5c8c;font-weight:700;text-decoration:none">${escHtml(s)}</a>`;
  const rows = [
    ['Name', escHtml(q.name)],
    ['Phone', link(`tel:${tel}`, q.phone)],
    ['Email', email ? link(`mailto:${email}`, email) : '<span style="color:#8a929b">Not given</span>'],
    ['Needs', `<span style="display:inline-block;background:#eaf3f8;color:#0a4870;font-weight:700;padding:2px 10px;border-radius:4px">${escHtml(q.service)}</span>`],
    ['Address or suburb', escHtml(q.suburb)],
  ];
  return `<div style="background:#f4f6f8;padding:24px 12px;font-family:Arial,sans-serif;color:#16191d">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden">
<div style="background:#0d5c8c;color:#fff;padding:18px 24px"><div style="font-size:13px;opacity:.85">${escHtml(site.name)}</div><div style="font-size:21px;font-weight:700;margin-top:2px">New quote request</div></div>
<div style="padding:20px 24px">
<table style="border-collapse:collapse;width:100%;font-size:16px;line-height:1.4">${rows.map(([k, v]) => `<tr><td style="padding:8px 12px 8px 0;color:#4a525b;width:150px;vertical-align:top;border-bottom:1px solid #eef0f2">${k}</td><td style="padding:8px 0;border-bottom:1px solid #eef0f2">${v}</td></tr>`).join('')}</table>
<div style="font-size:14px;color:#4a525b;margin:18px 0 6px">What they said</div>
<div style="background:#f4f6f8;border-radius:6px;padding:12px 14px;font-size:16px;line-height:1.5">${q.message ? escHtml(q.message).replace(/\n/g, '<br>') : '<span style="color:#8a929b">Nothing added</span>'}</div>
<div style="margin:22px 0 4px"><a href="tel:${tel}" style="display:inline-block;background:#0d5c8c;color:#fff;font-weight:700;text-decoration:none;padding:11px 22px;border-radius:6px">Call ${escHtml(q.name.split(' ')[0])}</a></div>
</div>
<div style="padding:12px 24px;background:#fafbfc;font-size:12px;color:#8a929b">Sent from ${escHtml(from || site.domain)}</div>
</div></div>`;
}
