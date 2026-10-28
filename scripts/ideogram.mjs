// Generates every image in src/data/images.json that is not yet in
// public/images/. Uses IDEOGRAM_API_KEY from the environment, or a network
// secret that adds the Api-Key header for api.ideogram.ai.
// Usage: npm run images            (all missing)
//        npm run images -- home-hero (one id, regenerates it)
import fs from 'node:fs';
import sharp from 'sharp';

const key = process.env.IDEOGRAM_API_KEY;
const images = JSON.parse(fs.readFileSync('src/data/images.json', 'utf8'));
const only = process.argv.slice(2);
const ids = only.length ? only : Object.keys(images).filter((id) => !fs.existsSync(`public/images/${id}.webp`));

// Ideogram 4.5 with magic prompt on. 2K presets: 16x9 heroes, 4x3 gallery.
const sizes = { '16x9': '2560x1440', '4x3': '2304x1728' };
// Real installs are hardwired; magic prompt otherwise tends to add a power cord.
const tidy = ' Installed neatly: no power cord, plug or loose cables on any heat pump unit. Never more than one heat pump unit in the picture. Any outdoor unit is a small domestic split unit with one round front fan, about knee height, never a large commercial or tall box unit.';
async function generate(id) {
  const { prompt: base, aspect } = images[id];
  // Street and suburb scenes show no heat pumps at all: skip the unit wording and ban units outright.
  const street = /no heat pump units/.test(base);
  const prompt = street ? base : base + tidy;
  const form = new FormData();
  form.append('prompt', prompt);
  form.append('negative_prompt', street
    ? 'heat pump, air conditioner, outdoor unit, wall mounted box, meter box, vent unit'
    : 'two heat pumps, multiple heat pump units, second air conditioner, large commercial condenser, power cord');
  form.append('magic_prompt', 'on');
  form.append('size', sizes[aspect] ?? 'auto');
  form.append('quality', 'high');
  const res = await fetch('https://api.ideogram.ai/v2/image/generate/ideogram-4-5', {
    method: 'POST', headers: key ? { 'Api-Key': key } : {}, body: form,
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const url = (await res.json()).data?.[0]?.url;
  if (!url) { console.error(`${id}: no image returned (safety check?)`); return; }
  const img = await fetch(url);
  // Ideogram returns a large PNG; save a web-sized WebP for the pages and a JPEG for og:image and schema.
  const sized = sharp(Buffer.from(await img.arrayBuffer())).resize({ width: aspect === '16x9' ? 1920 : 1200 });
  await sized.clone().webp({ quality: 80 }).toFile(`public/images/${id}.webp`);
  await sized.clone().jpeg({ quality: 80, mozjpeg: true }).toFile(`public/images/${id}.jpg`);
  console.log(`${id}: saved`);
}
// Two at a time (Ideogram limits requests in flight).
const queue = [...ids];
// A 429 (too many requests in flight) waits 20 seconds and goes back in the queue, up to 3 tries.
const tries = {};
await Promise.all(Array.from({ length: 2 }, async () => {
  while (queue.length) {
    const id = queue.shift();
    try { await generate(id); } catch (e) {
      if (e.message.startsWith('429') && (tries[id] = (tries[id] ?? 0) + 1) < 3) { await new Promise((r) => setTimeout(r, 20000)); queue.push(id); }
      else console.error(`${id}: ${e.message}`);
    }
  }
}));
