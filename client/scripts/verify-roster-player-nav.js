'use strict';

/**
 * Guardrail: every current roster player has a safe Team → profile path,
 * RosterList uses Capacitor-safe PlayerNavLink, and profile redirects never
 * use Next router.replace into catch-all player shells.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..');
const failures = [];

function read(relFromClient) {
  const abs = path.join(ROOT, relFromClient);
  if (!fs.existsSync(abs)) {
    failures.push('missing ' + relFromClient);
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

function mustInclude(rel, needle) {
  if (!read(rel).includes(needle)) {
    failures.push(rel + ' missing ' + JSON.stringify(needle));
  }
}

function mustNot(rel, needle) {
  if (read(rel).includes(needle)) {
    failures.push(rel + ' still has ' + JSON.stringify(needle));
  }
}

function normalizePlayerSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

mustInclude('components/team/RosterList.tsx', 'PlayerNavLink');
mustInclude(
  'components/team/RosterList.tsx',
  "playerProfilePath(player.slug, 'ROSTER', true, player.name, 'roster')"
);
mustNot('components/team/RosterList.tsx', '<a href={href}');
mustInclude('hooks/usePlayerProfileRoute.ts', 'navigateVaultHref');
mustNot('hooks/usePlayerProfileRoute.ts', 'router.replace');
mustNot('hooks/usePlayerProfileRoute.ts', 'useRouter');

const resolveSrc = fs.readFileSync(
  path.join(REPO, 'server/api/player/build-full-profile.ts'),
  'utf8'
);
if (!/context === 'roster'[\s\S]*rosterPlayerBySlug/.test(resolveSrc)) {
  failures.push(
    "server/api/player/build-full-profile.ts: roster context must prefer rosterPlayerBySlug before PORTAL redirect"
  );
}
if (/player\.status === 'PORTAL' && context !== 'recruiting'\)/.test(resolveSrc)) {
  failures.push(
    "server/api/player/build-full-profile.ts: PORTAL redirect must also exclude context === 'roster'"
  );
}

const rosterPath = path.join(REPO, 'server/data/roster/players.json');
if (!fs.existsSync(rosterPath)) {
  failures.push('missing server/data/roster/players.json');
} else {
  const players = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
  if (!Array.isArray(players) || players.length < 1) {
    failures.push('roster players.json is empty or not an array');
  } else {
    const seen = new Set();
    for (const player of players) {
      const name = player.name || player.fullName || '?';
      const slug = normalizePlayerSlug(player.slug || player.id || '');
      if (!slug) {
        failures.push('roster player missing slug: ' + name);
        continue;
      }
      if (seen.has(slug)) {
        failures.push('duplicate roster slug: ' + slug);
      }
      seen.add(slug);
      const href = '/vault/players/' + slug;
      if (!href.startsWith('/vault/players/') || href.endsWith('/players/')) {
        failures.push('bad roster href for ' + name + ': ' + href);
      }
    }
    if (!seen.has('eric-singleton-jr')) {
      failures.push('expected eric-singleton-jr on current roster');
    }
    console.log(
      '[verify-roster-player-nav] audited',
      players.length,
      'roster players; unique slugs',
      seen.size
    );
  }
}

if (failures.length) {
  console.error('[verify-roster-player-nav] FAIL');
  failures.forEach((f) => console.error(' -', f));
  process.exit(1);
}
console.log('[verify-roster-player-nav] OK');
