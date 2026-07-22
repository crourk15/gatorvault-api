const fs = require('fs');
const path = require('path');

const BUNDLE_DIR = path.join(__dirname, '..', 'data', 'recruiting');
const RENDER_DIR = '/var/data/recruiting';

function resolveRecruitingDataDir() {
  const fromEnv = String(process.env.GV_RECRUITING_DATA_DIR || '').trim();
  if (fromEnv) return fromEnv;
  try {
    if (process.env.NODE_ENV === 'production' && fs.existsSync('/var/data')) {
      return RENDER_DIR;
    }
  } catch {
    /* ignore */
  }
  return BUNDLE_DIR;
}

/**
 * Copy missing JSON artifacts from bundled recruiting data into durable dir.
 * Never overwrites non-empty durable files.
 */
function migrateRecruitingBundleIfNeeded(dataDir = resolveRecruitingDataDir()) {
  if (path.resolve(dataDir) === path.resolve(BUNDLE_DIR)) {
    return { migrated: false, reason: 'same_path' };
  }
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(BUNDLE_DIR)) return { migrated: false, reason: 'no_bundle' };
    let copied = 0;
    for (const name of fs.readdirSync(BUNDLE_DIR)) {
      if (!name.endsWith('.json')) continue;
      const src = path.join(BUNDLE_DIR, name);
      const dest = path.join(dataDir, name);
      if (fs.existsSync(dest)) {
        try {
          const existing = JSON.parse(fs.readFileSync(dest, 'utf8'));
          if (Array.isArray(existing) ? existing.length > 0 : existing && Object.keys(existing).length > 0) {
            continue;
          }
        } catch {
          continue;
        }
      }
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
        copied += 1;
      }
    }
    return { migrated: copied > 0, copied, to: dataDir };
  } catch (err) {
    console.warn('[recruiting-data-dir] migrate skipped:', err.message);
    return { migrated: false, error: err.message };
  }
}

module.exports = {
  BUNDLE_DIR,
  RENDER_DIR,
  resolveRecruitingDataDir,
  migrateRecruitingBundleIfNeeded,
};
