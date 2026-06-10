/**
 * Auto-generate beat-writer identity match phrases from recruiting player fields.
 */
const STAR_WORDS = { 5: 'five', 4: 'four', 3: 'three', 2: 'two', 1: 'one' };

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
  addStarPosNameVariants(lastName.length >= 3 ? lastName : null);

  if (school && stars) {
    add(`${school} ${stars} star`);
    if (starWord) add(`${school} ${starWord} star`);
  }

  if (school && pos) add(`${school} ${pos}`);

  if (firstName && lastName) add(`${firstName} ${lastName}`);
  if (lastName && lastName.length >= 3) add(lastName);

  if (stars && pos) {
    add(`${stars} star ${pos}`);
    add(`${stars}-star ${pos}`);
    if (starWord) {
      add(`${starWord} star ${pos}`);
      add(`${starWord}-star ${pos}`);
    }
  }

  if (pos && firstName) add(`${pos} ${firstName}`);
  if (pos && lastName && lastName.length >= 3) add(`${pos} ${lastName}`);

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
    if (stars && pos) {
      add(`${classYear} ${stars}-star ${pos}`);
      if (starWord) add(`${classYear} ${starWord}-star ${pos}`);
    }
    if (firstName && lastName) add(`${classYear} ${firstName} ${lastName}`);
  }

  if (natlRank && natlRank > 0 && natlRank <= 500) {
    if (firstName) add(`#${natlRank} ${firstName}`);
    if (pos && firstName) add(`top ${natlRank} ${pos} ${firstName}`);
    if (stars && pos) add(`${natlRank} ${stars} star ${pos}`);
    if (starWord && pos) add(`${natlRank} ${starWord} star ${pos}`);
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
  splitName,
  isFloridaSchool,
  generateIdentityPatterns,
  buildPatternRecord
};
