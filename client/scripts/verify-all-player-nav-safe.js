'use strict';

/**
 * Guardrail: no programmatic hard-nav into catch-all player routes,
 * and native entry must normalize absolute same-origin hrefs.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const failures = [];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.next' || ent.name === 'ios') continue;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(abs, out);
    else if (/\.(tsx|ts|jsx|js)$/.test(ent.name)) out.push(abs);
  }
  return out;
}

function rel(abs) {
  return path.relative(ROOT, abs);
}

const PLAYER_LOC =
  /window\.location\.(href|assign|replace)\s*=\s*[^;\n]*(playerProfilePath|playerProfileRoute|\/vault\/(?:futurecast|recruiting|portal)\/player|\/vault\/players\/|\/futurecast\/player\/|\/recruiting\/player\/)/;

const files = []
  .concat(walk(path.join(ROOT, 'components')))
  .concat(walk(path.join(ROOT, 'lib')))
  .concat(walk(path.join(ROOT, 'routes')));

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const base = path.basename(file);
  if (
    base === 'navigate-vault-href.ts' ||
    base === 'native-spa-nav.ts' ||
    base === 'native-app-entry.ts' ||
    base === 'native-boot-script.ts'
  ) {
    continue;
  }
  if (PLAYER_LOC.test(text)) {
    failures.push(rel(file) + ': unsafe window.location hard-nav into a player route');
  }
}

const must = [
  ['lib/native-app-entry.ts', 'toAppRelativeHref'],
  ['lib/native-boot-script.ts', 'toAppRelative'],
  ['lib/navigate-vault-href.ts', 'isNativeCatchAllDynamicHref'],
  ['lib/app-href.ts', 'toAppRelativeHref'],
  ['components/vault/VaultNavLink.tsx', 'toAppRelativeHref'],
  ['components/futurecast/EarlyDiscoveryGrid.tsx', 'profileContext="futurecast"'],
  ['components/vault/ClassicRecruitCard.tsx', 'VaultNavLink'],
];

for (const [file, needle] of must) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs) || !fs.readFileSync(abs, 'utf8').includes(needle)) {
    failures.push(file + ': missing ' + JSON.stringify(needle));
  }
}

if (failures.length) {
  console.error('[verify-all-player-nav-safe] FAIL');
  failures.forEach((f) => console.error(' -', f));
  process.exit(1);
}
console.log('[verify-all-player-nav-safe] OK');
