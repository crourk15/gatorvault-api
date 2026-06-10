/**
 * Unit tests — Player Identity Lookup confirmation + merge (no network).
 */
const lookup = require('../lib/player-identity-lookup');

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label);
    process.exitCode = 1;
    return;
  }
  console.log('OK:', label);
}

const baseSnapshot = {
  playerName: 'Amare Patterson',
  on3Id: '12345',
  stars: 4,
  pos: 'WR',
  classYear: 2027,
  highSchool: 'Miami Central',
  hometownState: 'Miami, FL',
  ufRpmPct: 45
};

const on3Source = {
  provider: 'on3_profile',
  label: 'On3 recruit profile',
  confidence: 95,
  snapshot: { ...baseSnapshot, natlRank: 142 }
};

const rivalsSource = {
  provider: 'rivals_pm',
  label: 'Rivals Prediction Machine',
  confidence: 88,
  snapshot: {
    ...baseSnapshot,
    highSchool: null,
    natlRank: 142
  }
};

const intelSource = {
  provider: 'intel_store',
  label: 'GatorVault intel store',
  confidence: 85,
  snapshot: {
    playerName: 'Amare Patterson',
    classYear: 2027,
    pos: 'WR',
    stars: 4
  }
};

const singleHigh = lookup.confirmIdentity([on3Source]);
assert('single source ≥90% confirms identity', singleHigh.confirmed && singleHigh.mode === 'single_high_confidence');

const dualMatch = lookup.confirmIdentity([rivalsSource, intelSource]);
assert('dual matching sources confirm identity', dualMatch.confirmed && dualMatch.mode === 'dual_source_match');

const weakOnly = lookup.confirmIdentity([
  { provider: 'intel_store', confidence: 70, snapshot: { playerName: 'Other Player', classYear: 2028, pos: 'QB' } },
  { provider: 'gatorvault_store', confidence: 78, snapshot: { playerName: 'Third Guy', classYear: 2029, pos: 'RB' } }
]);
assert('unrelated low-confidence sources fail confirmation', !weakOnly.confirmed);

const merged = lookup.mergeMissingFields(
  { playerName: 'Amare Patterson', stars: null, pos: 'WR', classYear: 2027, highSchool: null, hometownState: null, ufRpmPct: null },
  [on3Source, rivalsSource]
);
assert('merge fills missing fields from verified sources', merged.stars === 4 && merged.highSchool === 'Miami Central' && merged.ufRpmPct === 45);

const missing = lookup.listMissingIdentityFields({
  playerName: 'Test',
  stars: 4,
  pos: 'WR',
  classYear: 2027,
  highSchool: 'Central HS',
  hometownState: 'Miami, FL'
});
assert('listMissingIdentityFields flags missing RPM', missing.includes('ufRpmPct') && !missing.includes('natlRank'));

const matchScore = lookup.snapshotsMatch(
  { playerName: 'Amare Patterson', on3Id: '12345', classYear: 2027, pos: 'WR' },
  { playerName: 'Amare Patterson', on3Id: '12345', classYear: 2027, pos: 'WR', highSchool: 'Miami Central' }
);
assert('snapshotsMatch requires same name + 2+ field agreement', matchScore);

async function testBuildPredictionSkipAfterLookup() {
  const prediction = require('../lib/x-autoposter-prediction');
  const result = await prediction.buildPredictionPost({
    skipIdentityLookup: true,
    intel: {
      eventType: 'prediction',
      playerName: 'Incomplete Player',
      analystName: 'Steve Wiltfong',
      confidencePct: 70
    },
    row: { analystName: 'Steve Wiltfong' }
  });
  assert('prediction skips incomplete fields when lookup bypassed', !result.ok && result.skipped);
}

testBuildPredictionSkipAfterLookup().then(() => {
  if (process.exitCode) {
    console.error('\nPlayer identity lookup tests failed.');
  } else {
    console.log('\nAll player identity lookup tests passed.');
  }
});
