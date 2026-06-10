/**
 * Unit tests — beat intel pre-filter (vague phrase rejection).
 */
const prefilter = require('../lib/beat-intel-prefilter');
const copy = require('../lib/x-autoposter-copy');
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

  const blogPhrase = 'Our weekend official visitor blog is loaded with intel on the way https://example.com/preview';
  const blogGate = await prefilter.evaluateBeatIntelEligibility(blogPhrase);
  assert('rejects visitor blog promo', !blogGate.eligible);
  assert('rejects way https as player name', !isValidPlayerName('way https'));
  assert('rejects schools I\'m garbage name', !isValidPlayerName("schools I'm"));

  const autoResolver = require('../lib/recruiting-auto-resolution');
  const garbage = await autoResolver.autoResolveIntel(
    { playerName: "schools I'm", detail: 'schools I\'m visiting this weekend', eventType: 'official_visit' },
    { subsystem: 'autoposter:test' }
  );
  assert('autoResolveIntel rejects garbage via prefilter', garbage.nonPlayerIntel || garbage.needs_resolution);

  const momentum = await copy.buildMomentumCopyAsync({ text: blogPhrase, handle: 'corey_bender' });
  assert('momentum returns non_player skip for blog promo', prefilter.isNonPlayerIntelSkip(momentum));

  const beat = await copy.buildBeatIntelCopyAsync({ text: blogPhrase, handle: 'corey_bender' });
  assert('beat intel returns non_player skip for blog promo', prefilter.isNonPlayerIntelSkip(beat));

  assert(
    'shouldSurface rejects blog promo intel record',
    !prefilter.shouldSurfaceRecruitingIntelSync({
      playerName: 'way https',
      playerSlug: 'way-https',
      detail: blogPhrase
    })
  );
  assert(
    'shouldSurface rejects vague detail even with valid-looking slug',
    !prefilter.shouldSurfaceRecruitingIntelSync({
      playerName: 'way https',
      detail: 'Our weekend official visitor blog is loaded with intel on the way'
    })
  );

  const trustedOffer = await prefilter.evaluateBeatIntelEligibility(
    'Florida has offered 2027 4-star EDGE Marcus Williams from IMG Academy per @GatorsOnline.',
    { trustedWriter: true, post: { handle: 'Blake_Alderman' } }
  );
  assert('trusted writer passes offer intel with player name', trustedOffer.eligible && trustedOffer.playerName === 'Marcus Williams');

  assert('strong recruiting signals detect class+position line', prefilter.hasStrongRecruitingSignals('2027 4-Star WR Jaylen Brown is set to visit Florida this weekend'));

  if (process.exitCode) {
    console.error('\nBeat intel prefilter tests failed.');
  } else {
    console.log('\nAll beat intel prefilter tests passed.');
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
