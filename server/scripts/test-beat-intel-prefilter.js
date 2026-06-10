/**
 * Unit tests — beat intel pre-filter (vague phrase rejection).
 */
const prefilter = require('../lib/beat-intel-prefilter');
const { isValidPlayerName } = require('../lib/x-autoposter-player-context');

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label);
    process.exitCode = 1;
    return;
  }
  console.log('OK:', label);
}

const VAGUE_EXAMPLES = [
  "new florida's official visit weekend just landed two commits…",
  'florida is set to host its third slate of official visitors…',
  'the stakes are the no. 1 WR in America…',
  'official visitor preview june 11–13…',
  'dl marquis mj evans…',
  's seth williams…',
  'new elijah guertins florida official visit…'
];

(async () => {
  for (const phrase of VAGUE_EXAMPLES) {
    const gate = await prefilter.evaluateBeatIntelEligibility(phrase);
    assert(`rejects vague: "${phrase.slice(0, 48)}…"`, !gate.eligible && gate.category === 'non_player_intel');
  }

  assert('generic detector catches preview header', prefilter.isGenericNonPlayerIntel('Official Visitor Preview June 11–13'));
  assert('generic detector catches florida hosting', prefilter.isGenericNonPlayerIntel('Florida is set to host its third slate of official visitors'));

  const fullName = prefilter.extractCleanFullName('2027 4-Star WR Jaylen Brown is set to visit Florida this weekend');
  assert('extracts full name from class line', fullName === 'Jaylen Brown' && isValidPlayerName(fullName));

  const single = await prefilter.evaluateBeatIntelEligibility('Raheem is visiting Florida this weekend');
  assert('rejects single first name only', !single.eligible && single.category === 'non_player_intel');

  const skip = prefilter.buildNonPlayerSkipPayload({ reason: 'generic_phrase', category: 'non_player_intel', triggerPhrase: 'test' });
  assert('non-player skip payload', skip.skipReason === 'non_player_intel' && skip._nonPlayerSkip === true);

  if (process.exitCode) {
    console.error('\nBeat intel prefilter tests failed.');
  } else {
    console.log('\nAll beat intel prefilter tests passed.');
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
