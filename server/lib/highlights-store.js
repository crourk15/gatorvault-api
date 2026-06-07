const fs = require('fs');
const path = require('path');

const CLIPS_PATH = path.join(__dirname, '..', 'data', 'highlights', 'clips.json');

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function loadClips() {
  return readJson(CLIPS_PATH, []);
}

function getClipBySlug(slug) {
  return loadClips().find((c) => c.slug === slug) || null;
}

module.exports = {
  CLIPS_PATH,
  loadClips,
  getClipBySlug
};
