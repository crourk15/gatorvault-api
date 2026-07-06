/**
 * Portal post dedupe keys — player slug + arc + former school.
 */
const crypto = require('crypto');
const { selectPortalArc } = require('./portal-fact-extractor');

function slugPart(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function computePortalDedupeKey(facts = {}) {
  const arc = selectPortalArc(facts);
  const parts = ['portal', arc];
  parts.push(slugPart(facts.player_slug || facts.player_name || 'player'));
  if (facts.former_school) parts.push(slugPart(facts.former_school));
  const raw = parts.filter(Boolean).join('|');
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

module.exports = { computePortalDedupeKey, slugPart };