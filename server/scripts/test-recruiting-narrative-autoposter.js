/**
 * Recruiting narrative elite autoposter — trust/contender relationship beats.
 */
const prefilter = require('../lib/beat-intel-prefilter');
const copy = require('../lib/x-autoposter-copy');
const ingest = require('../lib/beat-writer-ingest');
const gm2Rules = require('../lib/gm2/rules-engine');
const validation = require('../lib/x-autoposter-validation');

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label);
    process.exitCode = 1;
    return;
  }
  console.log('OK:', label);
}

const DION_BEAT =
  "Florida offered Top-100 prospect Dion Edwards in April. Months later, the 4-star safety says the Gators are cementing themselves as a major contender. 'That honesty has made it easy to build trust.'";

(async () => {
  assert('extracts Dion Edwards cleanly', copy.extractPlayerFromText(DION_BEAT) === 'Dion Edwards');
  assert('resolves recruiting_narrative event', ingest.resolveRecruitingEventType(DION_BEAT) === 'recruiting_narrative');
  assert('does not emit fresh offer newsEvent', copy.detectBeatNewsEvent(DION_BEAT) === null);
  assert('classifies narrative elite intel', prefilter.isRecruitingNarrativeEliteIntel(DION_BEAT));
  const gate = prefilter.evaluateRecruitingNarrativeEliteEligibility(DION_BEAT);
  assert('narrative elite eligible', gate.eligible && gate.triggerType === 'recruiting_narrative_elite');

  const narrativePost = {
    text: DION_BEAT,
    writerName: 'Corey Bender',
    handle: 'corey_bender',
    url: 'https://example.com/dion'
  };
  const guarded = await prefilter.guardBeatPost(narrativePost);
  assert(
    'guardBeatPost allows narrative beat for trusted writer',
    guarded.eligible && guarded.triggerType === 'recruiting_narrative_elite'
  );

  const built = await copy.buildBeatIntelCopyAsync(narrativePost);
  assert('buildBeatIntelCopyAsync produces narrative text', built?.text && /Dion Edwards/i.test(built.text));
  assert('quote preserved', built?.text && /That honesty has made it easy to build trust/i.test(built.text));

  const candidate = {
    text: built.text,
    category: 'news',
    triggerType: 'recruiting_narrative_elite',
    eventType: 'recruiting_narrative',
    sourceEventType: 'recruiting_narrative',
    source: 'auto:beat-writer',
    playerName: 'Dion Edwards',
    sources: [{ label: 'Corey Bender', url: narrativePost.url }],
    templateBlocks: built.templateBlocks,
    validationMeta: built.validationMeta,
    playerContext: built.playerContext,
    sourceEventCreatedAt: new Date().toISOString()
  };
  assert(
    'GM2 allows recruiting_narrative_elite',
    gm2Rules.rulesForAutoposter({ ...candidate, triggerType: 'recruiting_narrative_elite' }).allow === true
  );
  const quality = validation.passesNewsQualityGate(candidate);
  assert('passes news quality gate', quality.pass, quality.scored?.errors?.[0]?.message || '');

  const playerContext = require('../lib/x-autoposter-player-context');
  const direct = playerContext.buildRecruitingNarrativePost({
    beatText: DION_BEAT,
    source: 'Beat intel',
    playerName: 'Dion Edwards'
  });
  assert('elite narrative compose direct', direct?.text && /trust/i.test(direct.text));
  assert('trust arc metadata', direct?.validationMeta?.arc === 'trust');

  if (process.exitCode) {
    console.error('\nRecruiting narrative autoposter tests failed.');
  } else {
    console.log('\nAll recruiting narrative autoposter tests passed.');
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});