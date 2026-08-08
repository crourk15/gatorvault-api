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
function copyJsonIfMissing(src, dest) {
  if (!fs.existsSync(src) || fs.existsSync(dest)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return true;
}

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
      if (copyJsonIfMissing(src, dest)) copied += 1;
    }
    // Seed Lab HP snapshots into durable disk (Starter cannot rebuild these in-process).
    const seedRuntime = path.join(BUNDLE_DIR, 'futurecast-runtime');
    const destRuntime = path.join(dataDir, 'futurecast-runtime');
    if (fs.existsSync(seedRuntime)) {
      fs.mkdirSync(destRuntime, { recursive: true });
      for (const name of fs.readdirSync(seedRuntime)) {
        if (!name.endsWith('.json')) continue;
        if (copyJsonIfMissing(path.join(seedRuntime, name), path.join(destRuntime, name))) {
          copied += 1;
        }
      }
    }
    // Prepared-meal profile dossiers (RPM overlaid live on GET).
    const seedStamps = path.join(__dirname, '..', 'data', 'player-profiles', 'stamps');
    const destStamps = path.join(path.dirname(dataDir), 'player-profiles', 'stamps');
    if (fs.existsSync(seedStamps) && path.resolve(destStamps) !== path.resolve(seedStamps)) {
      fs.mkdirSync(destStamps, { recursive: true });
      for (const name of fs.readdirSync(seedStamps)) {
        if (!name.endsWith('.json')) continue;
        if (copyJsonIfMissing(path.join(seedStamps, name), path.join(destStamps, name))) {
          copied += 1;
        }
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
