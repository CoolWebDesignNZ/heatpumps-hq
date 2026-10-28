// Writes a WebP beside every JPEG in public/images/ that doesn't have one yet.
// Pages load the WebP; the JPEG stays for og:image and schema.
import fs from 'node:fs';
import sharp from 'sharp';

const dir = 'public/images';
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.jpg'))) {
  const out = `${dir}/${f.replace(/\.jpg$/, '.webp')}`;
  if (fs.existsSync(out)) continue;
  await sharp(`${dir}/${f}`).webp({ quality: 80 }).toFile(out);
}
console.log(`${fs.readdirSync(dir).filter((x) => x.endsWith('.webp')).length} WebP images`);
