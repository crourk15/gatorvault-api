/**
 * Smoke test — AutoPoster quality gates (headline-only / duplicate / weak blocks).
 */
const validation = require('../lib/x-autoposter-validation');
const policy = require('../lib/x-autoposter-policy');

const badHeadlineOnly = {
  category: 'news',
  text: [
    '2027 WR Amare Patterson (6-1, 185 — Miami)',
    'Amare Patterson received an offer from Florida per On3.',
    'On3 ranks him No. 142 nationally.'
  ].join('\n'),
  sources: [{ label: 'On3', url: 'https://www.on3.com/' }],
  source: 'auto:intel',
  sourceEventCreatedAt: new Date().toISOString(),
  templateBlocks: {
    identity: '2027 WR Amare Patterson (6-1, 185 — Miami)',
    context: 'Amare Patterson received an offer from Florida per On3.',
    insider: 'On3 ranks him No. 142 nationally.'
  },
  playerContext: { name: 'Amare Patterson', pos: 'WR', classYear: 2027, school: 'Miami', natlRank: 142 },
  validationMeta: {}
};

const duplicatePost = {
  ...badHeadlineOnly,
  text: [
    '2027 4★ WR Amare Patterson (6-1, 185 — Miami) · On3 #142',
    'Staff hosted Patterson on campus Saturday per Corey Bender.',
    'Staff hosted Patterson on campus Saturday per Corey Bender.'
  ].join('\n'),
  templateBlocks: {
    identity: '2027 4★ WR Amare Patterson (6-1, 185 — Miami) · On3 #142',
    context: 'Staff hosted Patterson on campus Saturday per Corey Bender.',
    insider: 'Staff hosted Patterson on campus Saturday per Corey Bender.'
  },
  validationMeta: {
    contextFromBeat: true,
    insiderFromBeat: true,
    beatText: 'Staff hosted Patterson on campus Saturday per Corey Bender. Florida is firmly in the mix.'
  }
};

const goodPost = {
  category: 'news',
  text: [
    '2027 4★ WR Amare Patterson (6-1, 185 — Miami) · On3 #142',
    'Amare Patterson is on campus today for a Florida visit.',
    'The staff has been pushing hard here, and this stop is viewed as an important checkpoint in the Gators\' pursuit.'
  ].join('\n'),
  sources: [{ label: 'Corey Bender / On3', url: 'https://www.on3.com/' }],
  source: 'auto:beat-intel',
  sourceEventCreatedAt: new Date().toISOString(),
  templateBlocks: {
    identity: '2027 4★ WR Amare Patterson (6-1, 185 — Miami) · On3 #142',
    context: 'Amare Patterson is on campus today for a Florida visit.',
    insider:
      'The staff has been pushing hard here, and this stop is viewed as an important checkpoint in the Gators\' pursuit.'
  },
  playerContext: {
    name: 'Amare Patterson',
    pos: 'WR',
    classYear: 2027,
    school: 'Miami',
    natlRank: 142,
    starsLabel: '4★'
  },
  validationMeta: {
    situation: 'visit',
    contextFromRewrite: true,
    insiderFromRewrite: true,
    beatText:
      'Staff hosted Patterson on campus Saturday per Corey Bender. Bender: Florida is firmly in the mix after the OV.'
  }
};

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label);
    process.exitCode = 1;
    return;
  }
  console.log('OK:', label);
}

const badCheck = policy.validatePostContent(badHeadlineOnly);
assert('headline-only post rejected', !badCheck.valid);

const dupCheck = policy.validatePostContent(duplicatePost);
assert('duplicate sentences rejected', !dupCheck.valid);

const goodCheck = policy.validatePostContent(goodPost);
assert('verified 3-block post accepted', goodCheck.valid);
assert('good post meets 85% threshold', (goodCheck.qualityScore || 0) >= 85);
assert('good post source confidence 100%', goodCheck.sourceConfidence === 100);

const goodScore = validation.scoreNewsPost(goodPost);
assert('scoring weights sum to composite', goodScore.breakdown.compositeScore === goodScore.score);
assert('identity weighted ~40%', goodScore.breakdown.identity.weight === 0.4);

const stale = {
  ...goodPost,
  sourceEventCreatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
};
const staleCheck = policy.validatePostContent(stale);
assert('stale post rejected', !staleCheck.valid);

const prediction = require('../lib/x-autoposter-prediction');

const barePrediction = {
  category: 'news',
  text: [
    '2027 4★ WR Test Player (Central HS, Miami, FL) · On3 #42',
    'Steve Wiltfong has logged a Florida FutureCast · 70% · UF RPM: 45%',
    'Steve Wiltfong logged a Florida prediction (70%).'
  ].join('\n'),
  sources: [{ label: 'Steve Wiltfong / Rivals', url: 'https://www.on3.com/' }],
  source: 'auto:rivals-pm',
  sourceEventCreatedAt: new Date().toISOString(),
  templateBlocks: {
    identity: '2027 4★ WR Test Player (Central HS, Miami, FL) · On3 #42',
    context: 'Steve Wiltfong has logged a Florida FutureCast · 70% · UF RPM: 45%',
    insider: 'Steve Wiltfong logged a Florida prediction (70%).'
  },
  playerContext: {
    name: 'Test Player',
    pos: 'WR',
    classYear: 2027,
    school: 'Central HS',
    natlRank: 42,
    starsLabel: '4★'
  },
  validationMeta: { predictionPost: true, insiderFromAnalyst: true }
};
const bareCheck = policy.validatePostContent(barePrediction);
assert('bare analyst prediction line rejected', !bareCheck.valid);

const fullPrediction = {
  category: 'news',
  text: [
    '2027 4★ WR Amare Patterson (Miami Central, Miami, FL) · On3 #142',
    'Steve Wiltfong has logged a Florida FutureCast · 70% · UF RPM: 45%',
    'On3 ranks him No. 142 nationally — a name to watch in this class.'
  ].join('\n'),
  sources: [{ label: 'Steve Wiltfong / Rivals', url: 'https://www.on3.com/' }],
  source: 'auto:rivals-pm',
  sourceEventCreatedAt: new Date().toISOString(),
  templateBlocks: {
    identity: '2027 4★ WR Amare Patterson (Miami Central, Miami, FL) · On3 #142',
    context: 'Steve Wiltfong has logged a Florida FutureCast · 70% · UF RPM: 45%',
    insider: 'On3 ranks him No. 142 nationally — a name to watch in this class.'
  },
  playerContext: {
    name: 'Amare Patterson',
    pos: 'WR',
    classYear: 2027,
    school: 'Miami Central',
    natlRank: 142,
    starsLabel: '4★'
  },
  validationMeta: {
    predictionPost: true,
    insiderFromAnalyst: true,
    contextFromIntel: true,
    analystName: 'Steve Wiltfong',
    confidencePct: 70,
    ufRpmPct: 45
  }
};
const fullPredCheck = policy.validatePostContent(fullPrediction);
assert('full prediction template accepted', fullPredCheck.valid);

const missingRpm = prediction.validatePredictionFields({
  playerName: 'Amare Patterson',
  stars: 4,
  pos: 'WR',
  classYear: 2027,
  highSchool: 'Miami Central',
  hometownState: 'Miami, FL',
  analystName: 'Steve Wiltfong',
  confidencePct: 70
});
assert('prediction missing RPM skipped', !missingRpm.ok && missingRpm.missing.includes('ufRpmPct'));

if (process.exitCode) {
  console.error('\nValidation smoke test failed.');
} else {
  console.log('\nAll validation smoke tests passed.');
}
