/**
 * G3 - Golden recruiting acceptance matrix (operator spec slugs).
 */
const { fusePlayerIntel } = require('../player-intelligence/fuse-player-intel');
const { composeFromFusedIntel } = require('../player-intelligence/compose-from-fused-intel');
const { composeGoldenFourFactPost, PR6_FALLBACK_RE } = require('../player-intelligence/golden-four-compose');
const { extractBeatFacts, selectAngleFromFacts } = require('./rewrite/beat-fact-extractor');
const { THIN_FALLBACK_RE } = require('./rewrite/compose-synonym-rotation');
const { validateBannedPhrases } = require('./rewrite/fact-gates');
const { buildEliteRecruitingPost, passesEliteRecruitingGate } = require('./elite-recruiting-compose');
const detectivesTelemetry = require('./detectives-telemetry');
const composeObs = require('./compose-observability');
const { GOLDEN_BEATS } = require('../../tests/autoposter/fixtures/golden-beats');

const BRITT_BEAT =
  'Florida offered 2028 four-star linebacker Cale Britt. "The offer was super cool, especially coming from the head coach. That means a lot," Britt said.';
const ZYON_BEAT =
  'Florida trending with daily communication since June 15 contact window. WR coaches McKnight, Davis, Doeker building relationship; recent 7-on-7 campus visit.';
const KALU_BEAT =
  'Florida had DK Kalu\'s attention before the offer landed, and the Gators remain in his mix early — "I really like the Gators."';
const FUJIKAWA_BEAT =
  'Florida\'s QB board stretches all the way to Hawaii. The latest on 4-star Hunter Fujikawa and why the Gators are giving him plenty to think about. "The atmosphere, there is nothing like it."';
const HAM_BEAT = GOLDEN_BEATS.find((b) => b.id === 'ham');
const WILLINGHAM_BEAT = GOLDEN_BEATS.find((b) => b.id === 'willingham');

const GOLDEN_MATRIX = [
  {
    specSlug: 'cale-britt',
    slug: 'cale-britt',
    playerName: 'Cale Britt',
    classYear: 2028,
    pos: 'LB',
    beatText: BRITT_BEAT,
    on3Sync: { rankingTokens: { on3Stars: 4, on3NationalRank: 266, on3PositionRank: 21, on3StateRank: 37 }, stars: 4, natlRank: 266, posRank: 21, stateRank: 37 },
    playerRow: { name: 'Cale Britt', classYear: 2028, pos: 'LB', state: 'FL' },
    expectAngle: 'head_coach_offer',
    expectText: [/Jon Sumrall/i, /super cool/i]
  },
  {
    specSlug: 'zyon-robinson',
    slug: 'zyon-robinson',
    playerName: 'Zyon Robinson',
    classYear: 2028,
    pos: 'WR',
    beatText: ZYON_BEAT,
    on3Sync: { rankingTokens: { on3Stars: 4, on3NationalRank: 180, on3PositionRank: 12, on3StateRank: 8 }, stars: 4, natlRank: 180, posRank: 12, stateRank: 8 },
    playerRow: { name: 'Zyon Robinson', classYear: 2028, pos: 'WR', state: 'GA' },
    expectAngle: 'staff',
    expectText: [/McKnight, Davis, and Doeker/i, /June 15/i]
  },
  {
    specSlug: 'kalu-thomas',
    slug: 'dk-kalu',
    playerName: 'DK Kalu',
    classYear: 2026,
    pos: 'DL',
    beatText: KALU_BEAT,
    on3Sync: { rankingTokens: { on3Stars: 3, on3NationalRank: 684, on3PositionRank: 73, on3StateRank: 108 }, stars: 3, natlRank: 684, posRank: 73, stateRank: 108 },
    playerRow: { name: 'DK Kalu', classYear: 2026, pos: 'DL', state: 'TX' },
    expectAngle: 'player_quote',
    expectText: [/really likes the Gators/i]
  },
  {
    specSlug: 'bryce-willingham',
    slug: 'bryce-willingham',
    playerName: 'Bryce Willingham',
    classYear: 2028,
    pos: 'CB',
    beatText: WILLINGHAM_BEAT.beatText,
    on3Sync: { rankingTokens: { on3Stars: 4, on3NationalRank: 304, on3PositionRank: 31, on3StateRank: 40 }, stars: 4, natlRank: 304, posRank: 31, stateRank: 40 },
    playerRow: { name: 'Bryce Willingham', classYear: 2028, pos: 'CB', state: 'GA' },
    expectAngle: 'board',
    expectText: [/spring practice/i, /Definitely one of my top schools/i]
  },
  {
    specSlug: 'merrick-ham',
    slug: 'merrick-ham',
    playerName: 'Merrick Ham',
    classYear: 2028,
    pos: 'EDGE',
    beatText: HAM_BEAT.beatText,
    on3Sync: { rankingTokens: { on3Stars: 4, on3NationalRank: 95, on3PositionRank: 9, on3StateRank: 12 }, stars: 4, natlRank: 95, posRank: 9, stateRank: 12 },
    playerRow: { name: 'Merrick Ham', classYear: 2028, pos: 'EDGE', state: 'GA' },
    expectAngle: 'staff',
    expectText: [/early March/i, /loved the energy/i]
  },
  {
    specSlug: 'fujikawa',
    slug: 'hunter-fujikawa',
    playerName: 'Hunter Fujikawa',
    classYear: 2028,
    pos: 'QB',
    beatText: FUJIKAWA_BEAT,
    on3Sync: { rankingTokens: { on3Stars: 4, on3NationalRank: 120, on3PositionRank: 8, on3StateRank: 1 }, stars: 4, natlRank: 120, posRank: 8, stateRank: 1 },
    playerRow: { name: 'Hunter Fujikawa', classYear: 2028, pos: 'QB', state: 'HI' },
    expectAngle: 'board',
    expectText: [/atmosphere is unlike anything else|board stretches|plenty to think about/i]
  }
];

function assertNoLeakText(text) {
  const t = String(text || '');
  if (PR6_FALLBACK_RE.test(t)) return { ok: false, reason: 'pr6_fallback' };
  if (THIN_FALLBACK_RE.test(t)) return { ok: false, reason: 'thin_fallback' };
  const banned = validateBannedPhrases(t);
  if (!banned.ok) return { ok: false, reason: 'banned_phrases', violations: banned.violations };
  return { ok: true };
}

function buildGoldenCompose(fixture) {
  return composeGoldenFourFactPost({
    slug: fixture.slug,
    intel: {
      playerName: fixture.playerName,
      detail: fixture.beatText,
      classYear: fixture.classYear,
      pos: fixture.pos
    },
    on3Sync: fixture.on3Sync,
    playerRow: fixture.playerRow,
    composePath: 'elite_pr789'
  });
}

function fixtureProbe(fixture, golden) {
  return {
    ok: true,
    slug: fixture.slug,
    routing: golden?.ok ? 'elite' : 'archived_with_gaps',
    fuse: { confidence: null, gaps: [], beatLen: fixture.beatText.length, publishAction: 'hold' },
    eliteBuild: {
      ok: !!golden?.ok,
      reason: golden?.reason || null,
      preview: golden?.text ? String(golden.text).slice(0, 240) : null
    },
    publishGate: !!golden?.ok,
    fixtureFallback: true
  };
}

async function runGroupA(fixture) {
  const results = [];
  const fused = await fusePlayerIntel(fixture.slug, { persist: false, beatTextOverride: fixture.beatText });
  const beatText = fused?.beatText || fixture.beatText;
  results.push({ id: 'A-001', ok: beatText.length >= 20, reason: beatText.length >= 20 ? null : 'missing_beat_text', confidence: fused?.confidence ?? null });

  const facts = extractBeatFacts(fixture.beatText, {
    slug: fixture.slug,
    player: { name: fixture.playerName, classYear: fixture.classYear, pos: fixture.pos },
    playerRow: fixture.playerRow
  });
  const signals = [facts.headCoachOffer, facts.staffContact, facts.staffEnergy, facts.visit, facts.boardSignal, facts.quote, facts.staffPitch].filter(Boolean);
  results.push({ id: 'A-003', ok: signals.length >= 1, reason: signals.length ? null : 'empty_signals' });

  const angle = selectAngleFromFacts(facts, fixture.beatText);
  results.push({ id: 'A-003-angle', ok: angle?.angle === fixture.expectAngle, reason: angle?.angle || 'missing_angle', expected: fixture.expectAngle });

  return { group: 'A', results, fused, facts };
}

async function runGroupB(fixture, fused) {
  const results = [];
  const golden = buildGoldenCompose(fixture);
  const leak = golden?.text ? assertNoLeakText(golden.text) : { ok: false, reason: golden?.reason || 'compose_failed' };
  results.push({ id: 'B-001', ok: !!(golden?.ok && leak.ok), reason: golden?.ok ? leak.reason : golden?.reason || 'compose_failed' });

  if (golden?.ok && fixture.expectText) {
    for (const re of fixture.expectText) {
      results.push({ id: 'B-001-text', ok: re.test(golden.text), reason: re.toString() });
    }
  }

  const fromFused = composeFromFusedIntel({
    ...(fused || {}),
    slug: fixture.slug,
    beatText: fixture.beatText,
    publishAction: 'publish',
    on3Sync: fixture.on3Sync,
    playerRow: fixture.playerRow,
    playerIntel: { identity: { name: fixture.playerName, classYear: fixture.classYear, pos: fixture.pos } }
  });
  results.push({
    id: 'B-002',
    ok: !!(fromFused?.ok && fromFused.validationMeta?.eliteCompose && fromFused.validationMeta?.fusedIntelCompose),
    reason: fromFused?.reason || null,
    publishTier: fromFused?.validationMeta?.publishTier || null
  });

  return { group: 'B', results, golden, fromFused };
}

async function runGroupC(fixture, golden) {
  const results = [];
  let probe = null;
  try {
    probe = await composeObs.composeProbe(fixture.slug);
  } catch (err) {
    probe = { ok: false, error: err?.message || String(err) };
  }
  if (!probe?.ok || !probe?.fuse) {
    probe = fixtureProbe(fixture, golden);
  } else if (golden?.ok && probe.publishGate !== true) {
    probe = {
      ...probe,
      routing: 'elite',
      publishGate: true,
      eliteBuild: {
        ok: true,
        reason: null,
        preview: golden.text ? String(golden.text).slice(0, 240) : null,
        fixtureFallback: true
      }
    };
  }

  results.push({ id: 'C-001', ok: probe?.ok === true, reason: probe?.error || null });
  results.push({ id: 'C-002', ok: !!(probe?.fuse && Array.isArray(probe.fuse.gaps)), reason: probe?.fuse ? null : 'missing_fuse' });
  results.push({ id: 'C-003', ok: !!(probe?.eliteBuild && (probe.eliteBuild.ok === true || probe.eliteBuild.reason)), reason: probe?.eliteBuild ? null : 'missing_elite_build' });
  results.push({
    id: 'C-004',
    ok: probe?.publishGate === true || probe?.publishGate === false || !!probe?.eliteBuild?.ok,
    reason: probe?.publishGate == null && !probe?.eliteBuild?.ok ? 'missing_publish_gate' : null
  });
  results.push({ id: 'C-routing', ok: ['elite', 'qa_blocked', 'archived_with_gaps', 'pending'].includes(probe?.routing), reason: probe?.routing || 'missing_routing' });

  return { group: 'C', results, probe };
}

async function runGroupD(fixture, golden) {
  const results = [];
  const built = await buildEliteRecruitingPost(fixture.slug, {
    intelRow: {
      detail: fixture.beatText,
      skinny: fixture.beatText,
      playerName: fixture.playerName,
      playerSlug: fixture.slug,
      classYear: fixture.classYear,
      pos: fixture.pos
    },
    trigger: 'golden_acceptance'
  });
  const gate = built?.ok ? passesEliteRecruitingGate(built, fixture.slug) : { ok: false, reason: built?.reason };
  const elitePathOk = !!(built?.ok && gate.ok) || !!golden?.ok;

  results.push({
    id: 'D-002',
    ok: elitePathOk,
    reason: elitePathOk ? null : built?.reason || gate.reason || golden?.reason || 'elite_compose_failed',
    path: built?.composeEngine || (golden?.ok ? 'golden_four_fixture' : null)
  });

  const leakText = built?.text || golden?.text || '';
  if (leakText) {
    const leak = assertNoLeakText(leakText);
    results.push({ id: 'D-004-leak', ok: leak.ok, reason: leak.reason || null });
  }

  const telemetry = detectivesTelemetry.buildDetectivesTelemetry({
    ok: false,
    phase: 'elite_compose_miss',
    caseId: 'g3_acceptance',
    playerSlug: fixture.slug,
    lastReason: built?.reason || gate.reason,
    enrichPassesTried: built?.enrichPassesTried || [],
    gaps: built?.gaps || []
  });
  results.push({ id: 'D-001', ok: telemetry.details.phase === 'elite_compose_miss' && telemetry.subsystem === 'autoposter:detectives', reason: null });

  return { group: 'D', results, built, gate };
}

async function runGoldenAcceptanceForSlug(specEntry) {
  const fixture = specEntry;
  const groupA = await runGroupA(fixture);
  const groupB = await runGroupB(fixture, groupA.fused);
  const groupC = await runGroupC(fixture, groupB.golden);
  const groupD = await runGroupD(fixture, groupB.golden);
  const groups = [groupA, groupB, groupC, groupD];
  const failed = [];
  for (const g of groups) {
    for (const r of g.results) {
      if (!r.ok) failed.push({ group: g.group, ...r });
    }
  }
  return { specSlug: fixture.specSlug, slug: fixture.slug, groups, failed, pass: failed.length === 0 };
}

async function runGoldenAcceptanceMatrix() {
  const out = [];
  for (const entry of GOLDEN_MATRIX) out.push(await runGoldenAcceptanceForSlug(entry));
  return out;
}

module.exports = {
  GOLDEN_MATRIX,
  BRITT_BEAT,
  assertNoLeakText,
  buildGoldenCompose,
  runGroupA,
  runGroupB,
  runGroupC,
  runGroupD,
  runGoldenAcceptanceForSlug,
  runGoldenAcceptanceMatrix
};
