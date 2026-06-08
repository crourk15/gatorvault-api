#!/usr/bin/env node
/**
 * Ensure Film Room MP4 assets exist for every clip in clips.json.
 * Uses ffmpeg when available; otherwise downloads a small sample MP4 and copies per clip.
 *
 * Run: node scripts/ensure-film-room-media.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const fetch = require('node-fetch');

const CLIPS_PATH = path.join(__dirname, '..', 'data', 'highlights', 'clips.json');
const MEDIA_DIR = path.join(__dirname, '..', 'media', 'highlights');
const SAMPLE_URL =
  process.env.FILM_ROOM_SAMPLE_MP4_URL ||
  'https://filesamples.com/samples/video/mp4/sample_640x360.mp4';

function hasFfmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function generateBrandedMp4(outPath, title) {
  const safeTitle = String(title || 'GatorVault Film Room').replace(/'/g, '');
  execSync(
    `ffmpeg -y -f lavfi -i color=c=0x003087:s=1280x720:d=8 -f lavfi -i anullsrc=r=44100:cl=mono -vf "drawtext=text='${safeTitle}':fontcolor=white:fontsize=36:x=(w-text_w)/2:y=(h-text_h)/2" -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "${outPath}"`,
    { stdio: 'inherit' }
  );
}

async function downloadSample(dest) {
  const res = await fetch(SAMPLE_URL, { timeout: 120000 });
  if (!res.ok) throw new Error(`Sample download failed HTTP ${res.status}`);
  const buf = await res.buffer();
  fs.writeFileSync(dest, buf);
}

async function main() {
  const clips = JSON.parse(fs.readFileSync(CLIPS_PATH, 'utf8'));
  fs.mkdirSync(MEDIA_DIR, { recursive: true });

  const templatePath = path.join(MEDIA_DIR, '_template.mp4');
  if (!fs.existsSync(templatePath)) {
    console.log('Creating template MP4…');
    if (hasFfmpeg()) {
      generateBrandedMp4(templatePath, 'GatorVault Film Room');
    } else {
      console.log('ffmpeg not found — downloading sample MP4');
      await downloadSample(templatePath);
    }
  }

  let created = 0;
  for (const clip of clips) {
    if (!clip.videoUrl) continue;
    const rel = clip.videoUrl.replace(/^\//, '');
    const out = path.join(__dirname, '..', rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    if (!fs.existsSync(out)) {
      fs.copyFileSync(templatePath, out);
      created += 1;
      console.log('  +', rel);
    } else {
      console.log('  ✓', rel);
    }
  }

  console.log(`\nFilm Room media ready (${created} new, ${clips.length} total clips).`);
  console.log('Replace files in server/media/highlights/ with final ESPN-style cuts when ready.');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
