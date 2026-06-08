#!/usr/bin/env node
/** Compare portal htWt: players.json vs On3 UF commits board (transfer rows). */
const fs = require('fs');
const path = require('path');
const on3 = require('../lib/on3-client');

async function main() {
  const classYear = parseInt(process.env.ON3_PORTAL_CLASS_YEAR || '2026', 10);
  const { transfers, url } = await on3.fetchFloridaPortalTransfers(classYear);
  console.log('Source URL:', url);
  console.log('Transfer rows from On3:', transfers.length);

  const playersPath = path.join(__dirname, '..', 'data', 'recruiting', 'players.json');
  const stored = JSON.parse(fs.readFileSync(playersPath, 'utf8')).filter((p) => p.category === 'portal');

  const mismatches = [];
  for (const t of transfers) {
    const local = stored.find((p) => p.on3Id && String(p.on3Id) === String(t.on3Id));
    if (!local) {
      mismatches.push({ name: t.name, on3: t.htWt, stored: '(missing)', from: t.fromSchool });
      continue;
    }
    if (local.htWt !== t.htWt) {
      mismatches.push({ name: t.name, on3: t.htWt, stored: local.htWt, from: t.fromSchool });
    }
  }

  console.log('\nMismatches (stored vs On3 commits board):');
  mismatches.forEach((m) => console.log(`  ${m.name}: stored=${m.stored} on3=${m.on3} from=${m.from}`));
  if (!mismatches.length) console.log('  (none)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
