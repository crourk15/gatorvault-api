/**
 * Demo - Corey Bender Landon Dawson TE tweet through elite autoposter.
 * Run: node server/scripts/demo-bender-landon-dawson.js
 */
process.env.X_PIPELINES_ENABLED = 'true';
process.env.X_AUTOPOST_ENABLED = 'true';
process.env.X_AUTOPOST_ELITE_MODE = 'true';
process.env.X_GM2_REWRITE_ENABLED = 'true';
process.env.X_INTEL_REWRITE_ENABLED = 'true';
process.env.X_AUTOPOST_GV_CTA_ENABLED = 'true';
process.env.X_AUTOPOST_SUBTLE_GV_HOOKS = 'true';
process.env.X_AUTOPOST_ELITE_COMPOSE = 'true';

const copy = require('../lib/x-autoposter-copy');
const eliteCaption = require('../lib/x-autoposter-elite-caption');
const prefilter = require('../lib/beat-intel-prefilter');

const BEAT_TEXT = [
  '@EvanMcKissack and the Gators won one TE recruiting battle in Ohio with @JaxBallinger.',
  'Now, they are hoping history repeats itself with Landon Dawson.',
  'The coveted prospect spoke with @GatorsOnline about why UF is a top contender.',
  'INTEL: Florida looking to strike twice in Ohio at tight end (On3+).'
].join(' ');

const benderPost = {
  id: 'demo_bender_landon_dawson',
  handle: 'Corey_Bender',
  writerName: 'Corey Bender',
  outlet: 'On3 / Gators Online',
  text: BEAT_TEXT,
  url: 'https://x.com/Corey_Bender/status/demo_landon_dawson',
  publishedAt: new Date().toISOString(),
  source: 'x',
  attachmentUrls: [
    'https://www.on3.com/teams/florida-gators/news/florida-gators-looking-to-strike-twice-in-ohio-at-tight-end/'
  ]
};

async function main() {
  console.log('=== BEAT INPUT (Corey Bender) ===\n');
  console.log(BEAT_TEXT);
  console.log('\n---\n');

  const guarded = await prefilter.guardBeatPost(benderPost);
  console.log('Prefilter:', guarded.eligible ? 'ELIGIBLE' : 'BLOCKED', guarded.reason || '');

  const built = await copy.buildBeatIntelCopyAsync(benderPost);
  if (built?.skipReason || built?._identitySkip || built?._needsResolution) {
    console.log('\nCopy build blocked:', built.skipReason || built.reason || built);
    console.log('\nTrying elite caption with explicit player patch...\n');
    const elite = await eliteCaption.buildElitePlayerPost({
      playerName: 'Landon Dawson',
      playerSlug: 'landon-dawson',
      beatText: BEAT_TEXT,
      source: 'Corey Bender / On3',
      intel: {
        playerName: 'Landon Dawson',
        playerSlug: 'landon-dawson',
        pos: 'TE',
        classYear: 2028,
        eventType: 'trending',
        detail: BEAT_TEXT,
        source: 'auto:beat-writer',
        sourceHandle: 'corey_bender',
        articleUrl:
          'https://www.on3.com/teams/florida-gators/news/florida-gators-looking-to-strike-twice-in-ohio-at-tight-end/',
        timestamp: new Date().toISOString()
      },
      patch: {
        name: 'Landon Dawson',
        pos: 'TE',
        classYear: 2028,
        school: 'Mount Vernon, OH',
        stars: 4,
        natlRank: null
      }
    });
    if (elite?.ok && elite.text) {
      printEliteOutput(elite);
      return;
    }
    console.log('Elite fallback failed:', elite?.reason || elite);
    return;
  }

  if (built?.text) {
    console.log('=== ELITE AUTOPOST OUTPUT ===\n');
    console.log(built.text);
    console.log('\n---\n');
    console.log('Blocks:', JSON.stringify(built.templateBlocks, null, 2));
    if (built.validationMeta) {
      console.log('\nMeta:', {
        eliteMode: built.validationMeta.eliteMode,
        eliteDigest: built.validationMeta.eliteDigest,
        eventType: built.validationMeta.eventType,
        ufPosition: built.validationMeta.ufPosition,
        sourcesUsed: built.validationMeta.sourcesUsed
      });
    }
    return;
  }

  console.log('No output:', built);
}

function printEliteOutput(elite) {
  console.log('=== ELITE AUTOPOST OUTPUT (patched demo) ===\n');
  console.log(elite.text);
  console.log('\n---\n');
  console.log('Blocks:', JSON.stringify(elite.templateBlocks, null, 2));
  console.log('\nMeta:', {
    eliteDigest: elite.validationMeta?.eliteDigest,
    eventType: elite.validationMeta?.eventType,
    ufPosition: elite.validationMeta?.ufPosition,
    sourcesUsed: elite.validationMeta?.sourcesUsed
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
