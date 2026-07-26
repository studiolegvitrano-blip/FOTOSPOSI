// scripts/test-watermark.mjs
// Test watermark: applica l'overlay photo-overlay a una foto demo e salva l'output.
import fs from 'fs';
import path from 'path';

const fixturesDir = path.join(process.cwd(), 'stress-test-agenti/fixtures');
const demoJpg = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.jpg'))[0];
if (!demoJpg) {
  console.error('No .jpg demo');
  process.exit(1);
}

const input = fs.readFileSync(path.join(fixturesDir, demoJpg));
console.log(`Input: ${demoJpg} ${(input.length / 1024).toFixed(1)} KB`);

// Chiama applyOverlay
const sharp = (await import('sharp')).default;
const meta = await sharp(input).metadata();
console.log(`Image meta: ${meta.width}x${meta.height} format=${meta.format}`);

const out = await sharp(input).jpeg().toBuffer();
fs.writeFileSync('/tmp/watermark-input.jpg', out);

const result = await applyOverlay(input, {
  format: 'square',
  branding: {
    coupleNames: 'Anna & Marco',
    date: '26/07/2026',
    primaryColor: '#d4a574',
    wordmark: 'Sposi.live',
    fontFamily: 'Great Vibes',
    brandLogoBuffer: null,
  },
});
fs.writeFileSync('/tmp/watermark-output.jpg', result);
console.log(`Output: ${(result.length / 1024).toFixed(1)} KB`);

// Decode output per controllare se il watermark è renderizzato
const outMeta = await sharp(result).metadata();
console.log(`Output meta: ${outMeta.width}x${outMeta.height}`);

// Campiona un pixel a 50, 50 (alto sx) per vedere il contenuto
const topPx = await sharp(result).extract({ left: 50, top: 50, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
const bottomPx = await sharp(result).extract({ left: 50, top: outMeta.height - 50, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
console.log(`Pixel top-sx: rgb(${topPx.data[0]}, ${topPx.data[1]}, ${topPx.data[2]})`);
console.log(`Pixel bottom-sx: rgb(${bottomPx.data[0]}, ${bottomPx.data[1]}, ${bottomPx.data[2]})`);

// Conta pixel neri/vs bianchi nel bottom-strip ≈ dove dovrebbe essere il watermark
const stripTop = outMeta.height - 60;
const strip = await sharp(result).extract({ left: 0, top: stripTop, width: outMeta.width, height: 60 }).raw().toBuffer({ resolveWithObject: true });
const { data, info } = strip;
let dark = 0, light = 0, total = info.width * info.height;
for (let i = 0; i < data.length; i += info.channels) {
  const luma = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
  if (luma < 128) dark++; else light++;
}
console.log(`Bottom 60px strip: ${dark} dark / ${light} light / ${total} total`);
console.log(`  dark ratio: ${(dark/total*100).toFixed(1)}%, light ratio: ${(light/total*100).toFixed(1)}%`);
