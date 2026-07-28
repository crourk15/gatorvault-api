/**
 * Elite Beat Brief depth — On3 ranks + interested schools for thin slugs.
 * Run: node server/test/beat-brief-elite-depth.test.js
 */
const assert = require('assert');
const {
  humanizeSlugName,
  boardNeedsHydration,
  rankingLine,
  interestedSchoolsFromTopTeams,
  mergePlayerWithProfile,
  profileUsableForClass
} = require('../lib/on3-board-hydrate');
const { humanizeSlugAsName, profileFitsClassYear } = require('../lib/on3-recruit-discovery');
const {
  buildWhyFlorida,
  buildVaultAngle,
  buildBoardFacts,
  formatBriefText
} = require('../lib/beat-brief-packet');

function sampleProfile() {
  return {
    name: 'Nick Carroll',
    stars: 4,
    natlRank: 70,
    posRank: 7,
    stateRank: 11,
    pos: 'S',
    school: 'Toombs County',
    state: 'GA',
    classYear: 2028,
    slug: 'nick-carroll-281042',
    rating: 92.3,
    hometownCity: 'Lyons',
    topTeams: [
      { team: { name: 'Florida' }, status: 'Offered', prediction: 36.1, year: 2028 },
      { team: { name: 'Georgia' }, status: 'Offered', prediction: 17.2, year: 2028 },
      { team: { name: 'Georgia Tech' }, status: 'Offered', prediction: 14.8, year: 2028 },
      { team: { name: 'Florida State' }, status: 'Offered', prediction: 12.3, year: 2028 },
      { team: { name: 'Alabama' }, status: 'Offered', prediction: 2.1, year: 2028 }
    ]
  };
}

async function main() {
  assert.strictEqual(humanizeSlugName('nick-carroll'), 'Nick Carroll');
  assert.strictEqual(humanizeSlugAsName('nick-carroll-281042'), 'Nick Carroll');
  assert.ok(boardNeedsHydration(null));
  assert.ok(boardNeedsHydration({ name: 'Nick Carroll' }));
  assert.ok(!profileUsableForClass({ name: 'Nick Carroll', classYear: 2024 }, 2028));
  assert.ok(profileFitsClassYear({ name: 'Nick Carroll', classYear: 2028 }, 2028));
  assert.ok(!profileFitsClassYear({ name: 'Nick Carroll', classYear: 2024 }, 2028));

  const player = mergePlayerWithProfile(null, sampleProfile(), 'nick-carroll-281042');
  assert.strictEqual(player.natlRank, 70);
  assert.strictEqual(player.posRank, 7);
  assert.strictEqual(player.stateRank, 11);
  assert.ok(player.on3TopTeams.length >= 4);
  assert.ok(player.ufRpmPct > 30);

  const ranks = rankingLine(player);
  assert.ok(/Natl #70/.test(ranks), ranks);
  assert.ok(/Pos #7/.test(ranks), ranks);
  assert.ok(/State #11/.test(ranks), ranks);

  const schools = interestedSchoolsFromTopTeams(player.on3TopTeams, 2028, 5);
  assert.ok(schools.some((s) => /Florida/i.test(s.school)));
  assert.ok(schools.some((s) => /Georgia/i.test(s.school)));

  const why = buildWhyFlorida({
    player,
    research: { ufPosition: 'trending up', eventType: 'trending' },
    intelligence: null,
    beatRows: [],
    rivals: player.rivals || []
  });
  assert.ok(/On3 board/i.test(why), why);
  assert.ok(/Natl #70/i.test(why), why);
  assert.ok(/Interested|Georgia|Florida State/i.test(why), why);
  // Must not be the hollow two-line loop alone.
  assert.ok(why.length > 80, why);

  const angle = buildVaultAngle({
    playerName: 'Nick Carroll',
    research: { eventType: 'trending', ufPosition: 'trending up' },
    intelligence: null,
    beatRows: [],
    rivals: player.rivals || [],
    whyFlorida: why,
    player
  });
  assert.ok(/board fact|On3 ranks|school ladder/i.test(angle), angle);
  assert.ok(!/^Angle: Take today's trending beat/m.test(angle.split('\n')[0]), angle);

  const facts = buildBoardFacts({
    player,
    intelligence: null,
    research: { ufPosition: 'trending up', eventType: 'trending' },
    rivals: player.rivals || []
  });
  assert.ok(facts.rankings);
  assert.ok(facts.interestedSchools);
  assert.ok(facts.offers);
  assert.ok(facts.rpm);

  const paste = formatBriefText({
    slug: 'nick-carroll',
    playerName: 'Nick Carroll',
    player,
    inspect: null,
    beatRows: [],
    research: { ufPosition: 'trending up', eventType: 'trending' },
    intelligence: null,
    whyFlorida: why,
    vaultAngle: angle,
    rivals: player.rivals || []
  });
  assert.ok(/On3 ranks:/i.test(paste), paste);
  assert.ok(/Interested schools:/i.test(paste), paste);
  assert.ok(/Natl #70/i.test(paste), paste);
  assert.ok(/Georgia/i.test(paste), paste);
  assert.ok(/600|900|1000|VERIFIED|long-form/i.test(paste), 'verified long-form instructions');
  assert.ok(/ELITE DEPTH CHECKLIST/i.test(paste), paste);

  // Live hydration via slug map (network) — skip soft-fail if On3 blocked.
  const { hydrateRecruitBoard } = require('../lib/on3-board-hydrate');
  const live = await hydrateRecruitBoard({ slug: 'nick-carroll', name: 'Nick Carroll', classYear: 2028 });
  if (live.recruitSlug) {
    assert.strictEqual(live.recruitSlug, 'nick-carroll-281042');
    assert.ok(live.player?.natlRank != null, 'live natlRank');
    assert.ok((live.player?.on3TopTeams || []).length >= 3, 'live topTeams');
    assert.ok(live.player?.htWt || live.player?.height, 'measurements');
    assert.ok(Array.isArray(live.player?.visitTrail), 'visitTrail array');
    assert.ok(live.player?.ufStaff || live.player?.schoolLadder?.length, 'staff or ladder');
    console.log(
      'live hydrate OK',
      live.player.natlRank,
      live.player.posRank,
      live.player.stateRank,
      live.player.htWt,
      live.player.ufStaff?.label || null
    );
  } else {
    console.log('live hydrate skipped (On3 unavailable)');
  }

  const brief = await require('../lib/beat-brief-packet').buildBeatBrief('nick-carroll');
  assert.ok(brief.ok);
  assert.ok(brief.research?.postGuidance?.verifiedLongForm);
  assert.ok(brief.research?.measurements || brief.player?.htWt);
  assert.ok(brief.research?.schoolLadder || brief.research?.interestedSchools);
  assert.ok(/Chris Collins|UF staff|Florida staff/i.test(brief.pasteText + ' ' + (brief.research?.ufStaff || '')));
  assert.ok(brief.pasteText.length > 1200, 'paste packet should be dense');

  console.log('beat-brief-elite-depth.test.js PASS');
}

main().catch((err) => {
  console.error('FAIL', err);
  process.exit(1);
});
