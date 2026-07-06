/**
 * Recruiting narrative dedupe keys — player + arc + quote hash.
 */
const crypto = require('crypto');
const { selectNarrativeArc } = require('./narrative-fact-extractor');

function slugPart(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function quotePart(quote = '') {
  if (!quote) return '';
  return crypto.createHash('sha256').update(String(quote).trim().toLowerCase()).digest('hex').slice(0, 8);
}

function computeNarrativeDedupeKey(facts = {}) {
  const arc = selectNarrativeArc(facts);
  const parts = ['narrative', arc];
  parts.push(slugPart(facts.player_slug || facts.player_name || 'player'));
  if (facts.quote) parts.push(quotePart(facts.quote));
  else if (facts.narrative_types?.length) parts.push(facts.narrative_types.slice(0, 2).join('-'));
  const raw = parts.filter(Boolean).join('|');
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

module.exports = { computeNarrativeDedupeKey, slugPart, quotePart };