'use strict';

/**
 * Find 2027/2028 players with UF recruiting signals who are NOT on the live target board.
 * Common cause: preview-only intel entry or demoted non-allowlisted category.
 * Committed-elsewhere allowlist names are expected off the active board.
 */
const store = require('../lib/recruiting-store');
const { getAllowlistSet, canonicalTargetSlug } = require('../lib/recruiting-target-allowlist');
const { isCommittedElsewhere } = require('../lib/recruiting-target-filters');

function hasUfSignal(player) {
  if (!player) return false;
  if (String(player.ufOvStatus || '').toUpperCase() === 'OFFERED') return true;
  const offers = player.offers || player.offerList || [];
  if (Array.isArray(offers) && offers.some((o) => /florida|gators/i.test(String(o.school || o.name || '')))) {
    return true;
  }
  if (player.on3Source === 'player-intel-entry') return true;
  if (Number(player.ufProbability) > 0) return true;
  return false;
}

function stubReason(player, onAllowlist) {
  if (isCommittedElsewhere(player)) return 'committed_elsewhere';
  if (player.category !== 'target') return 'wrong_category';
  if (!onAllowlist) return 'not_allowlisted';
  return 'not_on_live_board';
}

async function main() {
  const failures = [];
  const rows = [];

  for (const year of [2027, 2028]) {
    const board = await store.getBoard(year);
    const liveSlugs = new Set((board.targets || []).map((p) => String(p.slug || '').toLowerCase()));
    const allowSet = getAllowlistSet(year);
    const players = (await store.getAllPlayers()).filter((p) => Number(p.classYear) === year);

    for (const player of players) {
      const slug = String(player.slug || '').toLowerCase();
      if (!slug || liveSlugs.has(slug)) continue;
      if (!hasUfSignal(player)) continue;

      const onAllowlist = allowSet.has(canonicalTargetSlug(slug));
      const reason = stubReason(player, onAllowlist);
      if (reason === 'committed_elsewhere') continue;

      rows.push({
        slug,
        name: player.name,
        classYear: year,
        category: player.category,
        status: player.status,
        onAllowlist,
        reason,
      });
    }
  }

  rows.sort((a, b) => a.classYear - b.classYear || a.name.localeCompare(b.name));

  console.log('[audit-target-stubs] candidates=' + rows.length);
  for (const row of rows) {
    console.log(
      ' -',
      row.classYear,
      row.slug,
      '(' + row.category + ', allowlist=' + row.onAllowlist + ', reason=' + row.reason + ')'
    );
  }

  const board2027 = await store.getBoard(2027);
  for (const slug of ['jalen-brewster']) {
    if (!board2027.targets.some((p) => p.slug === slug)) {
      failures.push(`${slug} missing from 2027 live board`);
    }
  }

  const tyzon = rows.find((r) => r.slug === 'tyzon-swann');
  if (tyzon) failures.push('tyzon-swann still missing from live board');

  if (failures.length) {
    console.error('[audit-target-stubs] FAIL');
    failures.forEach((f) => console.error(' -', f));
    process.exit(1);
  }

  console.log('[audit-target-stubs] OK');
}

main().catch((err) => {
  console.error('[audit-target-stubs] error:', err.message);
  process.exit(1);
});
