/**
 * Runtime allowlist additions — merged with locked code allowlist for board placement.
 */
const fs = require('fs');
const path = require('path');
const { slugify } = require('./slug');

const ALLOWLIST_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'admin-allowlist.json');

function readDoc() {
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
  return {
    slugs2027: [...new Set((doc.slugs2027 || []).map(normalizeSlug))],
    slugs2028: [...new Set((doc.slugs2028 || []).map(normalizeSlug))],
    names: doc.names || {},
  };
}

function addToAdminAllowlist({ slug, name, classYear }) {
  const year = parseInt(classYear, 10);
  const s = normalizeSlug(slug || slugify(name));
  if (!s || !name) throw new Error('slug and name required');
  if (year !== 2027 && year !== 2028) {
    return { added: false, reason: 'admin_allowlist_only_2027_2028', slug: s };
  }

  const doc = readDoc();
  doc.slugs2027 = doc.slugs2027 || [];
  doc.slugs2028 = doc.slugs2028 || [];
  doc.names = doc.names || {};

  const key = year === 2027 ? 'slugs2027' : 'slugs2028';
  if (!doc[key].includes(s)) doc[key].push(s);
  doc.names[s] = String(name).trim();
  doc.updatedAt = new Date().toISOString();
  writeDoc(doc);

  return { added: true, slug: s, classYear: year, key };
}

module.exports = {
  ALLOWLIST_PATH,
  loadAdminAllowlist,
  addToAdminAllowlist,
};
