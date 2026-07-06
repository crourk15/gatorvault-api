/**
 * Portal elite autoposter — player portal posts with identity.
 */
const prefilter = require('../lib/beat-intel-prefilter');
const copy = require('../lib/x-autoposter-copy');
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

const PORTAL_IN =
  'Jayden Daniels entered the transfer portal — Florida among programs tracking per @GatorsOnline.';

(async () => {
  assert('classifies portal elite intel', prefilter.isPortalEliteIntel(PORTAL_IN));
  const gate = prefilter.evaluatePortalEliteEligibility(PORTAL_IN);
  assert('portal elite eligible', gate.eligible && gate.triggerType === 'portal_elite');

  const portalPost = {
    text: PORTAL_IN,
    writerName: 'Gators Online',
    handle: 'gatorsonline',
    url: 'https://example.com/portal'
  };
  const guarded = await prefilter.guardBeatPost(portalPost);
  assert('guardBeatPost allows portal beat', guarded.eligible && guarded.triggerType === 'portal_elite');

  const built = await copy.buildBeatIntelCopyAsync(portalPost);
  assert('buildBeatIntelCopyAsync produces portal text', built?.text && /Jayden Daniels/i.test(built.text));
  assert('portal identity present', built?.text && /Portal · UF target/i.test(built.text));

  const candidate = {
    text: built.text,
    category: 'news',
    triggerType: 'portal_elite',
    portalEventType: 'portal_in',
    sourceEventType: 'portal_in',
    source: 'auto:portal-elite',
    playerName: 'Jayden Daniels',
    sources: [{ label: 'Gators Online', url: portalPost.url }],
    templateBlocks: built.templateBlocks,
    validationMeta: built.validationMeta,
    playerContext: built.playerContext,
    sourceEventCreatedAt: new Date().toISOString()
  };
  assert('GM2 allows portal_elite', gm2Rules.rulesForAutoposter({ ...candidate, triggerType: 'portal_elite' }).allow === true);
  const quality = validation.passesNewsQualityGate(candidate);
  assert('passes news quality gate', quality.pass);

  const playerContext = require('../lib/x-autoposter-player-context');
  const direct = playerContext.buildPortalPost({
    beatText: PORTAL_IN,
    source: 'Beat intel',
    portalEventType: 'portal_in',
    playerName: 'Jayden Daniels'
  });
  assert('elite portal compose direct', direct?.text && /transfer portal/i.test(direct.text));
  assert('no thin portal fallback', direct?.text && !/^Entered the transfer portal/i.test(direct.text));

  if (process.exitCode) {
    console.error('\nPortal autoposter tests failed.');
  } else {
    console.log('\nAll portal autoposter tests passed.');
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});