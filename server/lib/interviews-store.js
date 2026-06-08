const fs = require('fs');
const path = require('path');

const CLIPS_PATH = path.join(__dirname, '..', 'data', 'interviews', 'clips.json');
const SERVER_ROOT = path.join(__dirname, '..');

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function mediaPathForClip(clip) {
  if (!clip?.videoUrl) return null;
  const rel = String(clip.videoUrl).replace(/^\//, '');
  return path.join(SERVER_ROOT, rel);
}

function mediaExists(clip) {
  const p = mediaPathForClip(clip);
  return !!(p && fs.existsSync(p));
}

function resolveClipUrls(clip, baseUrl) {
  const base = String(baseUrl || '').replace(/\/$/, '');
  const ready = mediaExists(clip);
  const abs = (url) => {
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    return `${base}${url.startsWith('/') ? url : `/${url}`}`;
  };

  return {
    ...clip,
    thumbUrl: abs(clip.thumbUrl),
    videoUrl: ready ? abs(clip.videoUrl) : null,
    streamUrl: ready ? `${base}/api/interviews/stream/${encodeURIComponent(clip.slug)}` : null,
    mediaReady: ready
  };
}

function loadClips(options = {}) {
  const clips = readJson(CLIPS_PATH, []);
  const baseUrl = options.baseUrl || null;
  let list = clips;
  if (options.playerSlug) {
    list = list.filter((c) => (c.playerSlugs || []).includes(options.playerSlug));
  }
  if (options.gameSlug) {
    list = list.filter((c) => c.gameSlug === options.gameSlug);
  }
  if (!baseUrl) return list;
  return list.map((c) => resolveClipUrls(c, baseUrl));
}

function getClipBySlug(slug, options = {}) {
  const clip = readJson(CLIPS_PATH, []).find((c) => c.slug === slug) || null;
  if (!clip) return null;
  if (options.baseUrl) return resolveClipUrls(clip, options.baseUrl);
  return clip;
}

function getMediaPathBySlug(slug) {
  const clip = getClipBySlug(slug);
  if (!clip) return null;
  return mediaPathForClip(clip);
}

function auditMedia() {
  const clips = readJson(CLIPS_PATH, []);
  return clips.map((c) => ({
    slug: c.slug,
    videoUrl: c.videoUrl,
    mediaReady: mediaExists(c)
  }));
}

module.exports = {
  CLIPS_PATH,
  loadClips,
  getClipBySlug,
  getMediaPathBySlug,
  mediaExists,
  resolveClipUrls,
  auditMedia
};
