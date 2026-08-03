/**
 * Current UF roster names must not become phantom 2028 recruiting targets.
 * Run: node server/test/roster-recruit-collision.test.js
 */
'use strict';

const assert = require('assert');
const { isBlockedRecruit } = require('../lib/recruiting-blocked-players');
const {
  isCommittedPlayer,
  statusLooksCommitted,
  currentRosterCollision,
  buildBeatBrief
} = require('../lib/beat-brief-packet');
const { feedDeskIntelToFutureCast } = require('../lib/desk-intel-futurecast-feed');

async function main() {
  assert.equal(statusLooksCommitted('uncommitted'), false);
  assert.equal(statusLooksCommitted('committed'), true);
  assert.equal(statusLooksCommitted('Florida Committed'), true);
  assert.equal(statusLooksCommitted('Pending Eval'), false);

  assert.equal(isCommittedPlayer({ status: 'uncommitted' }, null), false);

  assert.ok(isBlockedRecruit({ slug: 'bryce-lovett', name: 'Bryce Lovett' }));

  const roster = currentRosterCollision('bryce-lovett');
  assert.ok(roster, 'bryce-lovett must resolve on UF roster');
  assert.ok(/ol|rg|ot|g/i.test(String(roster.pos || roster.position || '')), JSON.stringify(roster));

  const brief = await buildBeatBrief('bryce-lovett', { feedFutureCast: false, hydrateFilm: false });
  assert.equal(brief.ok, false);
  assert.equal(brief.error, 'current_roster_player');
  assert.ok(/ROSTER COLLISION/i.test(brief.pasteText || ''), brief.pasteText);

  const feed = await feedDeskIntelToFutureCast({
    slug: 'bryce-lovett',
    player: { name: 'Bryce Lovett', classYear: 2028, pos: 'ATH', stars: 0 },
    dryRun: true
  });
  assert.equal(feed.ok, false);
  assert.equal(feed.error, 'current_roster_player');

  console.log('roster-recruit-collision.test.js PASS');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
