/**
 * Auto-generate beat-writer identity match phrases from recruiting player fields.
 */
const STAR_WORDS = { 5: 'five', 4: 'four', 3: 'three', 2: 'two', 1: 'one' };

/** Bare surnames shorter than this collide (Ham→Hambrick, Lee, King, etc.). */
const BARE_LAST_NAME_MIN_LEN = 5;

function splitName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || ''
  };
}

function isFloridaSchool(label) {
  return /^florida|gators|\buf\b/i.test(String(label || '').trim());
}

function canUseBareLastName(lastName) {
  const last = String(lastName || '').trim();
  if (!last || /\s/.test(last)) return false;
  return last.length >= BARE_LAST_NAME_MIN_LEN;
}

function generateIdentityPatterns(player) {
  const { firstName, lastName } = splitName(player.name);
  const stars = parseInt(player.stars, 10) || null;
  const pos = String(player.pos || '').toUpperCase().trim();
  const highSchool = String(player.school || player.highSchool || '').trim();
  const fromSchool = String(player.fromSchool || '').trim();
  const school =
    (highSchool && !isFloridaSchool(highSchool) ? highSchool : '') ||
    (fromSchool && !isFloridaSchool(fromSchool) ? fromSchool : '');
  const classYear = player.classYear ? parseInt(player.classYear, 10) : null;
  const natlRank = player.natlRank != null ? parseInt(player.natlRank, 10) : null;
  const committedTo = String(player.committedTo || player.committed_to || '').trim();
  const commitSchool = committedTo && !isFloridaSchool(committedTo) ? committedTo : null;
  const bareLastOk = canUseBareLastName(lastName);

  const patterns = new Set();
  const add = (value) => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text) patterns.add(text);
  };

  const starWord = stars ? STAR_WORDS[stars] : null;

  const addStarPosNameVariants = (nameToken) => {
    if (!stars || !pos || !nameToken) return;
    add(`${stars} star ${pos} ${nameToken}`);
    add(`${stars}-star ${pos} ${nameToken}`);
    if (starWord) {
      add(`${starWord} star ${pos} ${nameToken}`);
      add(`${starWord}-star ${pos} ${nameToken}`);
    }
  };

  addStarPosNameVariants(firstName);
  addStarPosNameVariants(bareLastOk ? lastName : null);

  if (school && stars) {
    add(`${school} ${stars} star`);
    if (starWord) add(`${school} ${starWord} star`);
  }

  if (school && pos) add(`${school} ${pos}`);

  if (firstName && lastName) add(`${firstName} ${lastName}`);
  // Never emit bare short surnames like "Ham" — they false-match Hambrick and similar.
  if (bareLastOk) add(lastName);

  // Do NOT emit bare `${stars} star ${pos}` / `${stars}-star ${pos}` without a name/school
  // token — those latch onto any 4★ EDGE mention (e.g. Hambrick pick-six tweets).

  if (pos && firstName) add(`${pos} ${firstName}`);
  if (pos && bareLastOk) add(`${pos} ${lastName}`);

  if (stars && school) {
    add(`${stars} star ${school} commit`);
    if (starWord) add(`${starWord} star ${school} commit`);
  }

  if (commitSchool && stars) {
    add(`${commitSchool} ${stars} star`);
    if (starWord) add(`${commitSchool} ${starWord} star`);
    add(`${stars} star ${commitSchool}`);
    if (starWord) add(`${starWord} star ${commitSchool}`);
  }

  if (fromSchool && fromSchool !== school) {
    if (stars) {
      add(`${fromSchool} ${stars} star`);
      if (starWord) add(`${fromSchool} ${starWord} star`);
    }
    if (pos) add(`${fromSchool} ${pos}`);
  }

  if (classYear) {
    if (pos && firstName) add(`${classYear} ${pos} ${firstName}`);
    // Require a name token with class+stars+pos (avoid bare "2028 4-star EDGE").
    if (stars && pos && firstName) {
      add(`${classYear} ${stars}-star ${pos} ${firstName}`);
      if (starWord) add(`${classYear} ${starWord}-star ${pos} ${firstName}`);
    }
    if (firstName && lastName) add(`${classYear} ${firstName} ${lastName}`);
  }

  if (natlRank && natlRank > 0 && natlRank <= 500) {
    if (firstName) add(`#${natlRank} ${firstName}`);
    if (pos && firstName) add(`top ${natlRank} ${pos} ${firstName}`);
    // Rank + stars + pos alone is too broad without a name token.
    if (stars && pos && firstName) add(`${natlRank} ${stars} star ${pos} ${firstName}`);
    if (starWord && pos && firstName) add(`${natlRank} ${starWord} star ${pos} ${firstName}`);
  }

  return Array.from(patterns);
}

function buildPatternRecord(player) {
  const identityValidator = require('./identity-record-validator');
  const school =
    identityValidator.sanitizeSchoolField(player.school || player.highSchool) ||
    identityValidator.sanitizeSchoolField(player.fromSchool, { allowCollege: true }) ||
    null;
  const committedTo = player.committedTo || player.committed_to || null;
  const commitSchool =
    committedTo && !isFloridaSchool(committedTo)
      ? identityValidator.sanitizeSchoolField(committedTo, { allowCollege: true })
      : null;

  return {
    slug: player.slug,
    name: player.name,
    stars: parseInt(player.stars, 10) || null,
    position: player.pos ? String(player.pos).toUpperCase() : null,
    school,
    commitSchool,
    class: player.classYear || null,
    natlRank: player.natlRank != null ? parseInt(player.natlRank, 10) : null,
    patterns: generateIdentityPatterns({ ...player, school, fromSchool: commitSchool || player.fromSchool })
  };
}

module.exports = {
  STAR_WORDS,
  BARE_LAST_NAME_MIN_LEN,
  splitName,
  isFloridaSchool,
  canUseBareLastName,
  generateIdentityPatterns,
  buildPatternRecord
};
