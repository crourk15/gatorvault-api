/**
 * Canonical player slugs — beat/On3 parsers mint "lineman-moreno-fisher"
 * from "lineman Moreno Fisher". Emails and alerts then open a phantom profile.
 */
'use strict';

const SITE_URL = (process.env.SITE_URL || 'https://gatorvaultinsider.com').replace(/\/$/, '');

const EXPLICIT_ALIASES = {
  'lineman-moreno-fisher': 'moreno-fisher',
};

/** Longest first so "offensive-lineman" wins over "lineman". */
const POSITIONAL_SLUG_PREFIXES = [
  'offensive-lineman',
  'defensive-lineman',
  'offensive-tackle',
  'defensive-back',
  'running-back',
  'wide-receiver',
  'tight-end',
  'edge-rusher',
  'linebacker',
  'quarterback',
  'cornerback',
  'lineman',
  'receiver',
  'athlete',
  'safety',
  'tackle',
  'guard',
].sort((a, b) => b.length - a.length);

const POSITIONAL_FIRST_NAMES = new Set([
  'lineman',
  'linebacker',
  'quarterback',
  'receiver',
  'running',
  'tight',
  'cornerback',
  'safety',
  'athlete',
  'tackle',
  'guard',
  'edge',
]);

function stripPositionalSlugPrefix(slug) {
  const s = String(slug || '').trim().toLowerCase();
  for (const prefix of POSITIONAL_SLUG_PREFIXES) {
    if (!s.startsWith(`${prefix}-`)) continue;
    const rest = s.slice(prefix.length + 1);
    if (rest.includes('-') && rest.length >= 5) return rest;
  }
  return s;
}

function aliasPlayerSlug(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return s;
  if (EXPLICIT_ALIASES[s]) return EXPLICIT_ALIASES[s];
  return stripPositionalSlugPrefix(s);
}

function isPositionalPhantomName(name) {
  const first = String(name || '')
    .trim()
    .split(/\s+/)[0];
  return POSITIONAL_FIRST_NAMES.has(String(first || '').toLowerCase());
}

function playerRecruitingProfileUrl(slug) {
  const canonical = aliasPlayerSlug(slug);
  if (!canonical) return `${SITE_URL}/vault/alerts/`;
  return `${SITE_URL}/vault/recruiting/player/${encodeURIComponent(canonical)}/`;
}

module.exports = {
  EXPLICIT_ALIASES,
  aliasPlayerSlug,
  isPositionalPhantomName,
  playerRecruitingProfileUrl,
  stripPositionalSlugPrefix,
};
