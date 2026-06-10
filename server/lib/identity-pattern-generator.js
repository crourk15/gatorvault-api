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

function generateIdentityPatterns(player) {
  const { firstName, lastName } = splitName(player.name);
  const stars = parseInt(player.stars, 10) || null;
  const pos = String(player.pos || '').toUpperCase().trim();
  const school = String(player.school || player.fromSchool || player.highSchool || '').trim();
  const patterns = new Set();

  const add = (value) => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text) patterns.add(text);
  };

  const starWord = stars ? STAR_WORDS[stars] : null;

  if (stars && pos && firstName) {
    add(`${stars} star ${pos} ${firstName}`);
    add(`${stars}-star ${pos} ${firstName}`);
    if (starWord) {
      add(`${starWord} star ${pos} ${firstName}`);
      add(`${starWord}-star ${pos} ${firstName}`);
    }
  }

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

  if (stars && school) {
    add(`${stars} star ${school} commit`);
    if (starWord) add(`${starWord} star ${school} commit`);
  }

  return Array.from(patterns);
}

function buildPatternRecord(player) {
  const normalized = {
    slug: player.slug,
    name: player.name,
    stars: parseInt(player.stars, 10) || null,
    position: player.pos ? String(player.pos).toUpperCase() : null,
    school: player.school || player.fromSchool || player.highSchool || null,
    class: player.classYear || null,
    patterns: generateIdentityPatterns(player)
  };
  return normalized;
}

module.exports = {
  STAR_WORDS,
  splitName,
  generateIdentityPatterns,
  buildPatternRecord
};
