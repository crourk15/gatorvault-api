/**
 * One-time / maintenance cleanup: sanitize every player in the recruiting store.
 * Usage: node server/scripts/sanitize-recruiting-players.js [--repair]
 */
const gm2 = require('../lib/gm2');

async function main() {
  const repair = process.argv.includes('--repair');
  console.log('[sanitize-recruiting-players] starting', repair ? '(sanitize + On3 repair)' : '(sanitize only)');

  const sanitize = await gm2.sanitizeAllPlayers({ source: 'cleanup-script' });
  console.log('[sanitize]', {
    total: sanitize.total,
    fixed: sanitize.fixed,
    healedNeedsRepair: sanitize.healedNeedsRepair,
    unchanged: sanitize.unchanged,
    quarantined: sanitize.quarantined
  });

  if (repair) {
    const repairResult = await gm2.repairAllQuarantinedPlayers({ source: 'cleanup-script' });
    console.log('[repair]', {
      total: repairResult.total,
      repaired: repairResult.repaired,
      failed: repairResult.failed
    });
  }

  const status = gm2.getDashboard();
  console.log('[gm2 status]', {
    quarantinedPlayers: status.quarantine?.quarantinedPlayers,
    repairQueue: status.autoRepair?.repairQueueCount
  });
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
