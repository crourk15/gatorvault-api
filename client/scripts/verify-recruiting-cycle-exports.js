/**
 * Fail fast if recruiting-cycle.ts drops shared exports (Netlify type-check killer).
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'lib', 'recruiting-cycle.ts');
const src = fs.readFileSync(file, 'utf8');

const required = [
  'ACTIVE_RECRUITING_CLASS_YEAR',
  'RECRUITING_CLASS_YEARS',
  'parseRecruitingClassYear',
  'getSigningCalendar',
  'getPortalSeasonState',
  'shouldShowPortalWatchlist',
];

const missing = required.filter((name) => !new RegExp(`export\\s+(const|function|type)\\s+${name}\\b`).test(src));

if (missing.length) {
  console.error('[verify-recruiting-cycle-exports] missing exports:', missing.join(', '));
  process.exit(1);
}

console.log('[verify-recruiting-cycle-exports] OK');
