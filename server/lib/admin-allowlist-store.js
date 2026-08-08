/**
 * Runtime allowlist additions — merged with locked code allowlist for board placement.
 * Durable on Render when /var/data is mounted.
 */
const fs = require('fs');
const path = require('path');
const { slugify } = require('./slug');

const BUNDLE_ALLOWLIST_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'admin-allowlist.json');

function resolveAllowlistPath() {
  const fromEnv = String(process.env.GV_ADMIN_ALLOWLIST_PATH || '').trim();
  if (fromEnv) return fromEnv;
  try {
    if (process.env.NODE_ENV === 'production' && fs.existsSync('/var/data')) {
      return '/var/data/recruiting/admin-allowlist.json';
    }
  } catch {
    /* ignore */
  }
  return BUNDLE_ALLOWLIST_PATH;
}

const ALLOWLIST_PATH = resolveAllowlistPath();

function migrateIfNeeded() {
  if (path.resolve(ALLOWLIST_PATH) === path.resolve(BUNDLE_ALLOWLIST_PATH)) return;
  if (fs.existsSync(ALLOWLIST_PATH)) return;
  if (!fs.existsSync(BUNDLE_ALLOWLIST_PATH)) return;
  try {
    fs.mkdirSync(path.dirname(ALLOWLIST_PATH), { recursive: true });
    fs.copyFileSync(BUNDLE_ALLOWLIST_PATH, ALLOWLIST_PATH);
    console.log('[admin-allowlist] migrated →', ALLOWLIST_PATH);
  } catch (err) {
    console.warn('[admin-allowlist] migrate failed:', err.message);
  }
}

function readDoc() {
  migrateIfNeeded();
  try {
    return JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
  } catch {
    return { version: 1, updatedAt: null, slugs2027: [], slugs2028: [], names: {} };
  }
}

function writeDoc(doc) {
  fs.mkdirSync(path.dirname(ALLOWLIST_PATH), { recursive: true });
  fs.writeFileSync(ALLOWLIST_PATH, `${JSON.stringify(doc, null, 2)}\n`);
}

function normalizeSlug(raw) {
  return String(raw || '').trim().toLowerCase();
}

function loadAdminAllowlist() {
  const doc = readDoc();
  const stale2027 = [...new Set((doc.slugs2027 || []).map(normalizeSlug))];
  // Closing Class is code-locked — scrub durable admin extras so demote/sync
  // and future reads cannot re-expand the 2027 board from Render disk.
  if (stale2027.length) {
    doc.slugs2027 = [];
    doc.updatedAt = new Date().toISOString();
    try {
      writeDoc(doc);
      console.log('[admin-allowlist] scrubbed stale slugs2027:', stale2027.length);
    } catch (err) {
      console.warn('[admin-allowlist] scrub slugs2027 failed:', err.message);
    }
  }
  return {
    slugs2027: [],
    slugs2028: [...new Set((doc.slugs2028 || []).map(normalizeSlug))],
    names: doc.names || {},
  };
}

function addToAdminAllowlist({ slug, name, classYear }) {
  const year = parseInt(classYear, 10);
  const s = normalizeSlug(slug || slugify(name));
  if (!s || !name) throw new Error('slug and name required');
  try {
    const staff = require('./recruiting-staff-directory');
    if (staff.isStaffPlayerSlug(s) || staff.isStaffOrCoachName(name)) {
      return { added: false, reason: 'staff_not_recruit', slug: s, classYear: year };
    }
  } catch {
    /* optional */
  }
  if (year === 2027) {
    return {
      added: false,
      reason: 'closing_class_2027_hard_locked',
      slug: s,
      classYear: year,
    };
  }
  if (year !== 2028) {
    return { added: false, reason: 'admin_allowlist_only_2028', slug: s };
  }

  const doc = readDoc();
  doc.slugs2027 = [];
  doc.slugs2028 = doc.slugs2028 || [];
  doc.names = doc.names || {};

  if (!doc.slugs2028.includes(s)) doc.slugs2028.push(s);
  doc.names[s] = String(name).trim();
  doc.updatedAt = new Date().toISOString();
  writeDoc(doc);

  return { added: true, slug: s, classYear: year, key: 'slugs2028' };
}

function removeFromAdminAllowlist({ slug, classYear }) {
  const year = parseInt(classYear, 10);
  const s = normalizeSlug(slug);
  if (!s) throw new Error('slug required');
  if (year === 2027) {
    return {
      removed: false,
      reason: 'closing_class_2027_hard_locked',
      slug: s,
      classYear: year,
    };
  }
  if (year !== 2028) {
    return { removed: false, reason: 'admin_allowlist_only_2028', slug: s };
  }

  const doc = readDoc();
  doc.slugs2027 = [];
  doc.slugs2028 = doc.slugs2028 || [];
  doc.names = doc.names || {};
  const before = doc.slugs2028.length;
  doc.slugs2028 = doc.slugs2028.filter((row) => row !== s);
  if (doc.names[s]) delete doc.names[s];
  doc.updatedAt = new Date().toISOString();
  writeDoc(doc);

  return {
    removed: before !== doc.slugs2028.length,
    slug: s,
    classYear: year,
    key: 'slugs2028',
  };
}

module.exports = {
  ALLOWLIST_PATH,
  loadAdminAllowlist,
  addToAdminAllowlist,
  removeFromAdminAllowlist,
};
