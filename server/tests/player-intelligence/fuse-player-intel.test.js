/** Phase 1 — fuse-player-intel + Cobbins-shaped promo URL identity. */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  fusePlayerIntel,
  clusterIntelRows,
  computeConfidence,
  resolvePublishAction,
  buildBeatTextFromCluster
} = require('../../lib/player-intelligence/fuse-player-intel');
const { composeFromFusedIntel } = require('../../lib/player-intelligence/compose-from-fused-intel');
const { evaluateBeatIntelEligibility } = require('../../lib/beat-intel-prefilter');
const { parseOn3NewsArticleSlug } = require('../../lib/on3-recruit-discovery');

const COBBINS_BEAT =
  "The Florida Gators' defensive back history and coaching staff continue standing out to one of the country's top 2028 prospects.";
const COBBINS_URL =
  'https://www.on3.com/teams/florida-gators/news/how-florida-is-off-to-a-fast-start-with-elite-cb-jermaine-cobbins/';

test('parseOn3NewsArticleSlug — Cobbins article tail slug', () => {
  const parsed = parseOn3NewsArticleSlug('how-florida-is-off-to-a-fast-start-with-elite-cb-jermaine-cobbins');
  assert.equal(parsed?.playerSlug, 'jermaine-cobbins');
  assert.equal(parsed?.playerName, 'Jermaine Cobbins');
});

test('evaluateBeatIntelEligibility — promo INTEL URL resolves slug without body name', async () => {
  const gate = await evaluateBeatIntelEligibility(`INTEL: ${COBBINS_URL}`, {
    trustedWriter: true,
    post: { url: COBBINS_URL, handle: 'coreybender' }
  });
  assert.equal(gate.eligible, true, gate.reason || JSON.stringify(gate));
  assert.equal(gate.playerSlug, 'jermaine-cobbins');
  assert.equal(gate.matchMode, 'on3_url_slug');
});

test('buildBeatTextFromCluster — dedupes identical intel chunks', () => {
  const text = buildBeatTextFromCluster([
    { detail: COBBINS_BEAT },
    { detail: COBBINS_BEAT },
    { detail: 'Secondary line about UF DB room fit.' }
  ]);
  assert.match(text, /defensive back history/i);
  assert.match(text, /Secondary line/i);
  assert.equal(text.split(COBBINS_BEAT).length - 1, 1);
});

test('computeConfidence — URL slug match lifts thin excerpt into hold/publish band', () => {
  const confidence = computeConfidence({
    slug: 'jermaine-cobbins',
    rows: [{ playerSlug: 'jermaine-cobbins', articleUrl: COBBINS_URL, source: 'auto:on3-team-news' }],
    beatText: COBBINS_BEAT,
    playerIntel: {
      identity: { name: 'Jermaine Cobbins', on3Id: '251062', classYear: 2028, pos: 'CB' },
      rankingBlock: { valid: true },
      visits: [{ visitType: 'unofficial', visitDate: '2026-04-03' }],
      rpm: { ufPct: 18 },
      gaps: []
    },
    urlSlugMatch: true
  });
  assert.ok(confidence >= 0.75, `expected publish band, got ${confidence}`);
  assert.equal(resolvePublishAction(confidence), 'publish');
});

test('fusePlayerIntel — clusters live Cobbins intel when present', async () => {
  const rows = clusterIntelRows('jermaine-cobbins');
  if (!rows.length) {
    console.log('skip fusePlayerIntel live test — no Cobbins intel rows in store');
    return;
  }
  const fused = await fusePlayerIntel('jermaine-cobbins', { persist: false });
  assert.ok(fused, 'expected fused intel');
  assert.equal(fused.slug, 'jermaine-cobbins');
  assert.ok(fused.beatText.length > 20);
  assert.ok(fused.urlSlugMatch === true || fused.sources.some((s) => /on3\.com/i.test(s.url)));
  assert.ok(['publish', 'hold', 'archive'].includes(fused.publishAction));
});

test('fusedBeatIntelEnqueueAllowed — tier-A hold beat intel may enqueue', () => {
  const { fusedBeatIntelEnqueueAllowed } = require('../../lib/player-intelligence/fuse-player-intel');
  const holdFused = {
    publishAction: 'hold',
    urlSlugMatch: false,
    primaryIntelRow: { source: 'auto:on3-team-news' }
  };
  assert.equal(fusedBeatIntelEnqueueAllowed(holdFused, 'A', { source: 'auto:on3-team-news' }), true);
  assert.equal(fusedBeatIntelEnqueueAllowed(holdFused, 'C', { source: 'auto:on3-team-news' }), false);
  assert.equal(
    fusedBeatIntelEnqueueAllowed(
      { publishAction: 'hold', urlSlugMatch: true, primaryIntelRow: { source: 'auto:on3-team-news' } },
      'B',
      { source: 'auto:on3-team-news' }
    ),
    true
  );
});

test('composeFromFusedIntel — uses PR-789 path, blocks archive tier', () => {
  const archive = composeFromFusedIntel({
    slug: 'test-player',
    beatText: 'short',
    publishAction: 'archive',
    confidence: 0.3,
    playerIntel: { identity: { name: 'Test Player' } },
    on3Sync: { rankingValid: false },
    playerRow: { name: 'Test Player', classYear: 2028, pos: 'CB' }
  });
  assert.equal(archive.ok, false);
  assert.equal(archive.reason, 'confidence_archive');

  const fused = {
    slug: 'bryce-willingham',
    beatText:
      'Florida hosted Bryce Willingham for spring practice. "Definitely one of my top schools," Willingham said after the visit.',
    publishAction: 'publish',
    confidence: 0.9,
    primaryIntelRow: { source: 'beat-writer' },
    playerIntel: {
      identity: { name: 'Bryce Willingham', classYear: 2028, pos: 'CB', hometownState: 'GA' },
      rankingTokens: {
        on3Stars: 4,
        on3NationalRank: 304,
        on3PositionRank: 31,
        on3StateRank: 40
      },
      rankingBlock: { valid: true },
      competitors: [
        { school: 'Georgia', pct: 28 },
        { school: 'Florida', pct: 22 }
      ],
      rpm: { ufPct: 22 },
      gaps: []
    },
    on3Sync: {
      ok: true,
      rankingValid: true,
      stars: 4,
      natlRank: 304,
      posRank: 31,
      stateRank: 40,
      rankingTokens: {
        on3Stars: 4,
        on3NationalRank: 304,
        on3PositionRank: 31,
        on3StateRank: 40
      }
    },
    playerRow: {
      name: 'Bryce Willingham',
      pos: 'CB',
      classYear: 2028,
      hometownState: 'GA',
      competitors: [
        { school: 'Georgia', pct: 28 },
        { school: 'Florida', pct: 22 }
      ]
    }
  };
  const out = composeFromFusedIntel(fused);
  assert.equal(out.ok, true, out.reason || JSON.stringify(out));
  assert.match(out.text, /Willingham/i);
  assert.equal(out.validationMeta?.fusedIntelCompose, true);
});
