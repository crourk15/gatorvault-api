const fs = require('fs');
const path = require('path');

const sharp = require(path.join(__dirname, '..', 'server', 'node_modules', 'sharp'));

const SRC_DIR = path.join(__dirname, '..', 'docs', 'app-store-screenshots');
const OUT_DIR = path.join(SRC_DIR, 'ipad-13');
const IPAD_W = 2064;
const IPAD_H = 2752;
const BG = { r: 10, g: 26, b: 40, alpha: 1 };

const FILES = [
  '01-futurecast.png',
  '02-recruiting.png',
  '03-team.png',
  '04-community.png',
  '05-membership.png',
  '06-live-feed.png',
];

async function padToIpad(srcName) {
  const srcPath = path.join(SRC_DIR, srcName);
  if (!fs.existsSync(srcPath)) {
    throw new Error(`Missing source screenshot: ${srcPath}`);
  }

  const meta = await sharp(srcPath).metadata();
  const scale = IPAD_H / meta.height;
  const w = Math.round(meta.width * scale);
  const h = IPAD_H;
  const left = Math.round((IPAD_W - w) / 2);

  const outName = srcName.replace('.png', '-ipad-13.png');
  const outPath = path.join(OUT_DIR, outName);

  const resized = await sharp(srcPath).resize(w, h, { fit: 'fill' }).png().toBuffer();

  await sharp({
    create: {
      width: IPAD_W,
      height: IPAD_H,
      channels: 4,
      background: BG,
    },
  })
    .composite([{ input: resized, left, top: 0 }])
    .png()
    .toFile(outPath);

  return outPath;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const file of FILES) {
    process.stdout.write(`[ipad-13] ${file} ... `);
    await padToIpad(file);
    console.log('OK');
  }
  console.log(`[ipad-13] Done -> ${OUT_DIR}`);
}

main().catch((err) => {
  console.error('[ipad-13] failed:', err.message || err);
  process.exit(1);
});