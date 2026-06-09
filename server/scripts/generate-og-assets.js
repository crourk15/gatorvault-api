#!/usr/bin/env node
/**
 * Generate og-image.png (1200x630) and favicon PNGs from SVG sources.
 * Requires: npm install sharp (devDependency)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error('Run: npm install --save-dev sharp');
    process.exit(1);
  }

  const ogSvg = fs.readFileSync(path.join(ROOT, 'og-image.svg'));
  await sharp(ogSvg, { density: 144 })
    .resize(1200, 630, { fit: 'fill' })
    .png({ compressionLevel: 9, palette: false })
    .toFile(path.join(ROOT, 'og-image.png'));

  await sharp(ogSvg, { density: 144 })
    .resize(1200, 630, { fit: 'fill' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(path.join(ROOT, 'og-image.jpg'));

  const favSvg = fs.readFileSync(path.join(ROOT, 'favicon.svg'));
  await sharp(favSvg, { density: 144 })
    .resize(32, 32)
    .png()
    .toFile(path.join(ROOT, 'favicon-32.png'));
  await sharp(favSvg, { density: 144 })
    .resize(180, 180)
    .png()
    .toFile(path.join(ROOT, 'apple-touch-icon.png'));
  await sharp(favSvg, { density: 144 })
    .resize(48, 48)
    .png()
    .toFile(path.join(ROOT, 'favicon-48.png'));

  const ogStat = fs.statSync(path.join(ROOT, 'og-image.png'));
  const jpgStat = fs.statSync(path.join(ROOT, 'og-image.jpg'));
  const meta = await sharp(path.join(ROOT, 'og-image.png')).metadata();
  console.log(`og-image.png: ${meta.width}x${meta.height}, ${Math.round(ogStat.size / 1024)} KB`);
  console.log(`og-image.jpg: ${meta.width}x${meta.height}, ${Math.round(jpgStat.size / 1024)} KB`);
  console.log('favicon-32.png, favicon-48.png, apple-touch-icon.png written');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
