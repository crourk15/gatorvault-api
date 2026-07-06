/**
 * Program post dedupe keys — facility / nil / culture.
 */
const crypto = require('crypto');
const { selectProgramArc } = require('./program-fact-extractor');

function slugPart(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function computeProgramDedupeKey(facts = {}) {
  const arc = selectProgramArc(facts);
  const parts = ['program', arc];
  if (arc === 'facility' || arc === 'facility_visit') {
    parts.push(slugPart(facts.facility_name || 'facility'));
    parts.push(slugPart(facts.upgrade_type || facts.facility_impression || 'upgrade'));
  } else if (arc === 'nil') {
    parts.push(slugPart(facts.nil_entity || 'nil'));
  } else if (arc === 'culture') {
    parts.push(slugPart(facts.program_speaker || 'staff'));
    parts.push(slugPart(facts.program_quote || 'quote'));
  } else {
    parts.push(slugPart(facts.official_source || 'general'));
  }
  const raw = parts.filter(Boolean).join('|');
  return crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16);
}

module.exports = { computeProgramDedupeKey, slugPart };