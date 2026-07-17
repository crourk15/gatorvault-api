'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const failures = [];

function read(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    failures.push('missing ' + rel);
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

function mustInclude(rel, needle) {
  if (!read(rel).includes(needle)) failures.push(rel + ' missing ' + JSON.stringify(needle));
}

function mustNot(rel, needle) {
  if (read(rel).includes(needle)) failures.push(rel + ' still has ' + JSON.stringify(needle));
}

mustNot('components/futurecast/FutureCastBigBoardPage.tsx', 'window.location.href = playerProfilePath');
mustNot('components/futurecast/EarlyDiscoveryGrid.tsx', 'gv-rb-card-button');
mustNot('components/futurecast/PlayerCard.tsx', 'gv-rb-card-button');
mustInclude('components/vault/ClassicRecruitCard.tsx', 'VaultNavLink');
mustInclude('components/vault/ClassicRecruitCard.tsx', 'profileContext');
mustInclude('components/futurecast/EarlyDiscoveryGrid.tsx', 'profileContext="futurecast"');
mustInclude('lib/navigate-vault-href.ts', 'navigateVaultHref');

if (failures.length) {
  console.error('[verify-early-discovery-player-nav] FAIL');
  failures.forEach((f) => console.error(' -', f));
  process.exit(1);
}
console.log('[verify-early-discovery-player-nav] OK');
