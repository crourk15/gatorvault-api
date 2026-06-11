/**
 * Verified UF coaching identity — explicit corrections only, no alias guessing.
 * Used by Film Room Knowledge Engine, GM2, and content validation.
 */
const fs = require('fs');
const path = require('path');

const OFFICIAL_PATH = path.join(__dirname, '..', 'data', 'official-names.json');

let _cache = null;

function readOfficial() {
  if (!_cache) {
    try {
      _cache = JSON.parse(fs.readFileSync(OFFICIAL_PATH, 'utf8'));
    } catch (e) {
      _cache = { coaches: {}, staff: {}, blockedNames: [], coachCorrections: {} };
    }
  }
  return _cache;
}

function reloadOfficialCoachIdentity() {
  _cache = null;
  return readOfficial();
}

function getCanonicalCoachNames() {
  const official = readOfficial();
  const names = new Set();
  Object.values(official.coaches || {}).forEach((c) => {
    if (c?.name) names.add(c.name);
    (c?.aliases || []).forEach((a) => names.add(a));
  });
  Object.values(official.staff || {}).forEach((c) => {
    if (c?.name) names.add(c.name);
    (c?.aliases || []).forEach((a) => names.add(a));
  });
  return names;
}

function getBlockedCoachNames() {
  const official = readOfficial();
  const blocked = new Set(official.blockedNames || []);
  Object.values(official.verifiedCoachSources || {}).forEach((entry) => {
    (entry.rejectedAliases || []).forEach((a) => blocked.add(a));
  });
  return blocked;
}

function getCoachCorrections() {
  const official = readOfficial();
  const map = new Map();
  const raw = official.coachCorrections || {};
  Object.entries(raw).forEach(([wrong, right]) => {
    if (wrong && right) map.set(String(wrong).trim(), String(right).trim());
  });
  return map;
}

/** Apply only explicit coachCorrections from official-names.json — never guess. */
function applyCoachCorrections(text) {
  let out = String(text || '');
  if (!out) return out;
  getCoachCorrections().forEach((canonical, wrong) => {
    const re = new RegExp(wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    out = out.replace(re, canonical);
  });
  return out;
}

function findBlockedCoachNames(text) {
  const raw = String(text || '');
  if (!raw) return [];
  const hits = [];
  getBlockedCoachNames().forEach((blocked) => {
    if (raw.includes(blocked)) hits.push(blocked);
  });
  return hits;
}

function validateCoachIdentityText(text, { field = 'text' } = {}) {
  const blocked = findBlockedCoachNames(text);
  if (blocked.length) {
    return {
      ok: false,
      reason: 'coach_identity_blocked',
      field,
      blocked,
      detail: `Blocked coach name(s): ${blocked.join(', ')}. Use verified names from official-names.json only.`
    };
  }
  return { ok: true };
}

function sanitizeRecordCoachFields(row, fields = ['source_name', 'summary', 'usage_description', 'definition']) {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };
  fields.forEach((field) => {
    if (out[field] != null) out[field] = applyCoachCorrections(out[field]);
  });
  return out;
}

function getVerifiedCoachSource(role) {
  const official = readOfficial();
  return official.verifiedCoachSources?.[role] || null;
}

module.exports = {
  readOfficial,
  reloadOfficialCoachIdentity,
  getCanonicalCoachNames,
  getBlockedCoachNames,
  getCoachCorrections,
  applyCoachCorrections,
  findBlockedCoachNames,
  validateCoachIdentityText,
  sanitizeRecordCoachFields,
  getVerifiedCoachSource
};
