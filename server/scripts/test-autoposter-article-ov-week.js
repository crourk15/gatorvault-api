/**
 * Article ingest test — Gators Online OV week article → full Autoposter Intelligence Package posts.
 * Set X_AUTOPOST_BYPASS_FRESHNESS=true (freshness ignored for this test only).
 *
 * Usage: node scripts/test-autoposter-article-ov-week.js
 */
process.env.X_AUTOPOST_BYPASS_FRESHNESS = 'true';
process.env.X_AUTOPOST_ELITE_MODE = process.env.X_AUTOPOST_ELITE_MODE || 'false';

const playerContext = require('../lib/x-autoposter-player-context');

/** Nuggets extracted from article — beat text verbatim, timestamps from article. */
const NUGGETS = [
  {
    id: 'royal-arrived',
    playerName: 'Easton Royal',
    source: 'Corey Bender / Gators Online',
    sourceHandle: 'corey_bender',
    timestamp: '2026-06-11T15:45:57-04:00',
    beatText:
      '5-star Texas WR commit Easton Royal just arrived at the hotel to start his official visit. Florida and LSU are working overtime in hopes of flipping him.'
  },
  {
    id: 'brewster-chatter',
    playerName: 'Jalen Brewster',
    source: 'Corey Bender / Gators Online',
    sourceHandle: 'corey_bender',
    timestamp: '2026-06-11T15:45:03-04:00',
    beatText:
      'Got this message from a source regarding Jalen Bewster.. "No doubt it\u2019s going to be hard\u2026All of these schools have an uphill battle to flip him, but I\u2019m watching Florida most."'
  },
  {
    id: 'hutcheson-arrival',
    playerName: 'Elijah Hutcheson',
    source: 'Keith Niebuhr / Gators Online',
    sourceHandle: 'keithniebuhr',
    timestamp: '2026-06-11T14:25:13-04:00',
    beatText:
      'I\u2019m told Gators OL commit Elijah Hutcheson will be arriving in Gainesville within the hour. His flight is scheduled to land at 3:00. This might be one of my favorite prospects in the class. Extremely high ceiling. Between him and Tyler Chukuyem, I think those two could be starting tackles down the line. Hutch needs to add weight and get stronger, but I love his athleticism and flexibility at the position. He has an aggressive style too.'
  },
  {
    id: 'davidson-recruit',
    playerName: 'Davin Davidson',
    source: 'Keith Niebuhr / Gators Online',
    sourceHandle: 'keithniebuhr',
    timestamp: '2026-06-11T14:25:00-04:00',
    beatText:
      'QB commit Davin Davidson will be in Gainesville Thursday AND Friday. Having him in town to help recruit Easton Royal is a big deal and can only help.'
  },
  {
    id: 'royal-buzz',
    playerName: 'Easton Royal',
    source: 'Keith Niebuhr / Gators Online',
    sourceHandle: 'keithniebuhr',
    timestamp: '2026-06-11T14:24:13-04:00',
    beatText:
      'TTFWIW \u2026. but multiple people have told me this week the UF staff continues to think it has a shot with Royal. (I am not sure how UF feels about Brewster).'
  },
  {
    id: 'evans-note',
    playerName: 'Marquis Evans',
    source: 'Keith Niebuhr / Gators Online',
    sourceHandle: 'keithniebuhr',
    timestamp: '2026-06-11T14:25:24-04:00',
    beatText:
      'Big group coming with DL Marquis Evans to Gainesville. Joining him will be his mother, two brothers, cousin and HS coach. He\u2019s expected at hotel around 4:00. Auburn is trending at No. 1. The Tigers have long been the most consistent, but we will see if the Gators make his recruitment more interesting. They are VERY high on Evans.'
  },
  {
    id: 'floyd-party',
    playerName: 'Raheem Floyd',
    playerSlug: 'raheem-floyd',
    source: 'Keith Niebuhr / Gators Online',
    sourceHandle: 'keithniebuhr',
    timestamp: '2026-06-11T14:25:39-04:00',
    beatText:
      'Joining 4-star cornerback Raheem Floyd this week will be both parents and one of his HS coaches. That coach will be getting to campus later than the family though. Floyd will be the one I\u2019m monitoring the most. I think Florida has a chance to overtake Missouri at No. 1. He\u2019s the top remaining cornerback on the board. He lands at Gainesville airport around 3:00.'
  },
  {
    id: 'royal-arrival-info',
    playerName: 'Easton Royal',
    source: 'Keith Niebuhr / Gators Online',
    sourceHandle: 'keithniebuhr',
    timestamp: '2026-06-11T14:25:47-04:00',
    beatText:
      'Five-star WR Easton Royal, a Texas commit, lands in Gainesville at 3:00 and should arrive at the hotel just before 4:00. Very important visit for both parties. Both are going to be extremely difficult to flip, but I\u2019ve came across more buzz with Royal than Brewster.'
  },
  {
    id: 'brewster-group',
    playerName: 'Jalen Brewster',
    source: 'Keith Niebuhr / Gators Online',
    sourceHandle: 'keithniebuhr',
    timestamp: '2026-06-11T14:25:58-04:00',
    beatText:
      'It\u2019s a big group coming to Gainesville with Jalen Brewster. Joining the No. 1 overall prospect will be his father, trainer, agent, assistant agent and also someone to document his weekend, so a videographer. His flight in Gainesville lands at 4:50.'
  },
  {
    id: 'trio-landing',
    playerName: 'Easton Royal',
    source: 'Corey Bender / Gators Online',
    sourceHandle: 'corey_bender',
    timestamp: '2026-06-11T14:36:02-04:00',
    beatText:
      '5-star WR Easton Royal, 4-star OL commit Elijah Hutcheson and 4-star CB Raheem Floyd were all scheduled to land at 3:00. From there, they should each arrive at the hotel between 3:30-4:00.'
  }
];

async function generatePost(nugget) {
  const intel = {
    playerName: nugget.playerName,
    playerSlug: nugget.playerSlug || null,
    detail: nugget.beatText,
    timestamp: nugget.timestamp,
    sourceEventCreatedAt: nugget.timestamp,
    source: nugget.source,
    sourceHandle: nugget.sourceHandle,
    directlyInvolvesUF: true,
    eventType: 'official_visit'
  };

  const built = await playerContext.buildPlayerNewsPost({
    source: 'auto:beat-intel',
    beatText: nugget.beatText,
    intel,
    playerName: nugget.playerName
  });

  return built;
}

function formatSkip(nugget, built) {
  return {
    id: nugget.id,
    player: nugget.playerName,
    status: 'SKIPPED',
    reason: built?.skipReason || built?.reason || built?.identityFailure?.reason || 'unknown',
    missingFields: built?.missingFields || built?.identityFailure?.missingFields || [],
    detail: built?.identityFailure || null
  };
}

async function main() {
  const results = [];
  console.log('=== GatorVault Autoposter — Article OV Week Test ===\n');
  console.log(`Nuggets: ${NUGGETS.length} | Freshness bypass: ON | Elite mode: ${process.env.X_AUTOPOST_ELITE_MODE}\n`);

  for (const nugget of NUGGETS) {
    try {
      const built = await generatePost(nugget);
      if (!built?.text) {
        results.push(formatSkip(nugget, built));
        continue;
      }
      results.push({
        id: nugget.id,
        player: nugget.playerName,
        status: 'POST',
        situation: built.validationMeta?.situation,
        heat: built.validationMeta?.heatMeter?.state,
        confidence: built.validationMeta?.confidenceMeter?.score,
        charCount: built.text.length,
        text: built.text
      });
    } catch (e) {
      results.push({
        id: nugget.id,
        player: nugget.playerName,
        status: 'ERROR',
        reason: e.message,
        stack: e.stack
      });
    }
  }

  const posts = results.filter((r) => r.status === 'POST');
  const skipped = results.filter((r) => r.status !== 'POST');

  console.log(`Generated: ${posts.length} posts | Skipped: ${skipped.length}\n`);
  console.log('='.repeat(72));

  posts.forEach((p, i) => {
    console.log(`\n--- POST ${i + 1} [${p.id}] ${p.player} ---`);
    console.log(`Situation: ${p.situation} | Heat: ${p.heat} | Confidence: ${p.confidence} | ${p.charCount} chars\n`);
    console.log(p.text);
    console.log('\n' + '-'.repeat(72));
  });

  if (skipped.length) {
    console.log('\n=== SKIPPED NUGGETS ===\n');
    skipped.forEach((s) => {
      console.log(`• ${s.id} (${s.player}): ${s.reason}${s.missingFields?.length ? ` [${s.missingFields.join(', ')}]` : ''}`);
      if (s.detail) console.log('  ', JSON.stringify(s.detail));
      if (s.stack) console.log(s.stack.split('\n').slice(0, 6).join('\n'));
    });
  }

  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify({ generated: posts.length, skipped: skipped.length, ids: posts.map((p) => p.id) }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
