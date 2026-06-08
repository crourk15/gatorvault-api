const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const BRAND = {
  gatorBlue: '0x003087',
  gatorOrange: '0xFA4616',
  slateSec: 2,
  lowerThirdSec: 4,
  width: 1280,
  height: 720
};

function hasFfmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function probeDuration(filePath) {
  if (!hasFfmpeg() || !fs.existsSync(filePath)) return null;
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: 'utf8' }
    );
    const sec = parseFloat(out.trim());
    return Number.isFinite(sec) ? sec : null;
  } catch {
    return null;
  }
}

function escapeDrawtext(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/%/g, '\\%');
}

function generateSlate(outPath, { title, subtitle, category }) {
  const line1 = escapeDrawtext(title || 'GatorVault Film Room');
  const line2 = escapeDrawtext(subtitle || category || 'Florida Gators');
  const filter =
    `drawbox=x=0:y=h-8:w=iw:h=8:color=${BRAND.gatorOrange}:t=fill,` +
    `drawtext=text='GATORVAULT':fontcolor=${BRAND.gatorOrange}:fontsize=28:x=64:y=80,` +
    `drawtext=text='${line1}':fontcolor=white:fontsize=42:x=64:y=280,` +
    `drawtext=text='${line2}':fontcolor=0xcbd5e1:fontsize=28:x=64:y=340`;

  execSync(
    `ffmpeg -y -f lavfi -i color=c=${BRAND.gatorBlue}:s=${BRAND.width}x${BRAND.height}:d=${BRAND.slateSec} ` +
      `-f lavfi -i anullsrc=r=44100:cl=stereo -vf "${filter}" ` +
      `-c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "${outPath}"`,
    { stdio: 'pipe' }
  );
}

function trimAndBrandClip({
  inputPath,
  outputPath,
  workDir,
  title,
  subtitle,
  category,
  durationSec,
  skipIntroSec = 1.5,
  skipOutroSec = 1.5
}) {
  if (!hasFfmpeg()) throw new Error('ffmpeg not found — install ffmpeg and ensure it is on PATH');
  if (!fs.existsSync(inputPath)) throw new Error(`Input not found: ${inputPath}`);

  fs.mkdirSync(workDir, { recursive: true });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const minSec = durationSec?.min || 10;
  const maxSec = durationSec?.max || 30;
  const total = probeDuration(inputPath) || maxSec;
  const usable = Math.max(minSec, Math.min(maxSec, total - skipIntroSec - skipOutroSec));
  const start = Math.min(skipIntroSec, Math.max(0, total - usable - skipOutroSec));

  const trimmedPath = path.join(workDir, 'trimmed.mp4');
  const slatePath = path.join(workDir, 'slate.mp4');
  const concatList = path.join(workDir, 'concat.txt');
  const mergedPath = path.join(workDir, 'merged.mp4');

  execSync(
    `ffmpeg -y -ss ${start} -i "${inputPath}" -t ${usable} -c:v libx264 -pix_fmt yuv420p -c:a aac "${trimmedPath}"`,
    { stdio: 'pipe' }
  );

  generateSlate(slatePath, { title, subtitle, category });

  const lowerTitle = escapeDrawtext(title || 'GatorVault');
  const lowerSub = escapeDrawtext(subtitle || category || '');
  const lowerFilter =
    `drawbox=x=0:y=h-96:w=iw:h=96:color=${BRAND.gatorBlue}@0.88:t=fill,` +
    `drawbox=x=0:y=h-96:w=6:h=96:color=${BRAND.gatorOrange}:t=fill,` +
    `drawtext=text='${lowerTitle}':fontcolor=white:fontsize=30:x=24:y=h-72,` +
    `drawtext=text='${lowerSub}':fontcolor=${BRAND.gatorOrange}:fontsize=22:x=24:y=h-38`;

  execSync(
    `ffmpeg -y -i "${trimmedPath}" -vf "${lowerFilter}" -c:v libx264 -pix_fmt yuv420p -c:a copy "${mergedPath}"`,
    { stdio: 'pipe' }
  );

  fs.writeFileSync(concatList, `file '${slatePath.replace(/\\/g, '/')}'\nfile '${mergedPath.replace(/\\/g, '/')}'\n`);
  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${concatList}" -c copy "${outputPath}"`,
    { stdio: 'pipe' }
  );

  const finalDur = probeDuration(outputPath);
  return {
    durationSec: finalDur,
    durationLabel: formatDuration(finalDur),
    trimmedFromSec: start,
    trimmedLengthSec: usable
  };
}

function formatDuration(sec) {
  if (!sec || !Number.isFinite(sec)) return '';
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function generatePosterFromVideo(videoPath, posterPath) {
  if (!hasFfmpeg()) return false;
  fs.mkdirSync(path.dirname(posterPath), { recursive: true });
  const result = spawnSync(
    'ffmpeg',
    ['-y', '-ss', '3', '-i', videoPath, '-frames:v', '1', '-q:v', '2', posterPath],
    { stdio: 'pipe' }
  );
  return result.status === 0 && fs.existsSync(posterPath);
}

module.exports = {
  BRAND,
  hasFfmpeg,
  probeDuration,
  generateSlate,
  trimAndBrandClip,
  formatDuration,
  generatePosterFromVideo
};
