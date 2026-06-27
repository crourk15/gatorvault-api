require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const store = require('../lib/recruiting-store');
const { ALLOWLIST_2028 } = require('../lib/recruiting-target-allowlist');
const { isPlaceholderSchool } = require('../lib/recruiting-placeholder-school');
const { formatAllowlistEvalSummary } = require('../lib/allowlist-school-persist');

const players = JSON.parse(fs.readFileSync(store.PLAYERS_PATH, 'utf8'));
let updated = 0;
for (const slug of ALLOWLIST_2028) {
  const idx = players.findIndex((p) => String(p.slug).toLowerCase() === slug);
  if (idx < 0) continue;
  const player = players[idx];
  if (!player.school || isPlaceholderSchool(player.school)) continue;
  const summary = formatAllowlistEvalSummary(player);
  if (!summary || player.evaluationSummary === summary) continue;
  players[idx].evaluationSummary = summary;
  updated += 1;
}
fs.writeFileSync(store.PLAYERS_PATH, `${JSON.stringify(players, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, classYear: 2028, updated, total: ALLOWLIST_2028.length }, null, 2));