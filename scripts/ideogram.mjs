// Generates every image in src/data/images.json that is not yet in
// public/images/. Uses IDEOGRAM_API_KEY from the environment, or a network
// secret that adds the Api-Key header for api.ideogram.ai.
// Usage: npm run images            (all missing)
//        npm run images -- home-hero (one id, regenerates it)
import fs from 'node:fs';

const key = process.env.IDEOGRAM_API_KEY;
const images = JSON.parse(fs.readFileSync('src/data/images.json', 'utf8'));
const only = process.argv[2];
const ids = only ? [only] : Object.keys(images).filter((id) => !fs.existsSync(`public/images/${id}.jpg`));

for (const id of ids) {
  const { prompt, aspect } = images[id];
  const form = new FormData();
  form.append('prompt', prompt);
  form.append('aspect_ratio', aspect);
  form.append('rendering_speed', 'QUALITY');
  form.append('style_type', 'REALISTIC');
  form.append('magic_prompt', 'OFF');
  form.append('negative_prompt', 'text, words, letters, logos, watermark, signage, cartoon, illustration, 3d render');
  const res = await fetch('https://api.ideogram.ai/v1/ideogram-v3/generate', {
    method: 'POST', headers: key ? { 'Api-Key': key } : {}, body: form,
  });
  if (!res.ok) { console.error(`${id}: ${res.status} ${await res.text()}`); continue; }
  const url = (await res.json()).data?.[0]?.url;
  const img = await fetch(url);
  fs.writeFileSync(`public/images/${id}.jpg`, Buffer.from(await img.arrayBuffer()));
  console.log(`${id}: saved`);
}
