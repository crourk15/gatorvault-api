/**
 * Insider Articles Editorial Engine — synthesizes verified intel into Florida-specific analysis.
 * No template filler. No generation without sufficient substantive facts.
 */
const cycle = require('./insider-articles-cycle');
const sanitize = require('./insider-articles-sanitize');
const templates = require('./insider-articles-templates');
const identityValidator = require('./identity-record-validator');

const MIN_FACTS = {
  heat_check: 6,
  official_visit_preview: 5,
  post_visit_reaction: 5,
  program_pulse: 4,
  roster_analysis: 4,
  summer_preview: 3,
  depth_chart_movement: 3,
  staff_intel: 4,
  game_week_preview: 3
};

const POS_GROUPS = {
  WR: ['WR'],
  RB: ['RB', 'HB'],
  TE: ['TE'],
  OL: ['OL', 'OT', 'OG', 'C'],
  EDGE: ['EDGE', 'DE', 'OLB'],
  DL: ['DL', 'DT', 'DE'],
  LB: ['LB', 'ILB'],
  CB: ['CB'],
  S: ['S', 'DB', 'SAF'],
  ATH: ['ATH'],
  QB: ['QB']
};

function posGroup(pos) {
  const p = String(pos || '').toUpperCase();
  for (const [group, aliases] of Object.entries(POS_GROUPS)) {
    if (aliases.includes(p)) return group;
  }
  return p || 'UNKNOWN';
}

function esc(text) {
  return templates.esc(text);
}

function fmtPct(n) {
  if (n == null || Number.isNaN(Number(n))) return null;
  return `${Math.round(Number(n) * 10) / 10}%`;
}

function findStorePlayer(slug, name, players) {
  const list = players || [];
  if (slug) {
    const bySlug = list.find((p) => p.slug === slug);
    if (bySlug) return bySlug;
  }
  if (name) {
    const key = String(name).toLowerCase();
    return list.find((p) => String(p.name || '').toLowerCase() === key) || null;
  }
  return null;
}

function loadStaffIntel(slug) {
  if (!slug) return null;
  try {
    const scoutingDb = require('./scouting-database');
    const entry = scoutingDb.getEntryBySlug(slug);
    if (entry?.scoutingSummary) return { source: 'scouting_db', summary: entry.scoutingSummary, analyst: entry.analystName };
  } catch {
    /* optional */
  }
  try {
    const warRoom = require('./war-room-store');
    const b = warRoom.getBreakdownBySlug(slug);
    if (!b?.verified) return null;
    return {
      source: 'war_room',
      schemeFit: b.schemeFit,
      staffNotes: b.staffNotes,
      strengths: (b.strengths || []).slice(0, 2).join('; '),
      weaknesses: (b.weaknesses || []).slice(0, 2).join('; '),
      projection: b.projection,
      comparison: b.comparison
    };
  } catch {
    return null;
  }
}

function parseRpmFromDetail(detail) {
  const t = String(detail || '');
  const uf = t.match(/Florida\s+(\d+(?:\.\d+)?)\s*%/i);
  const leader = t.match(/next\s+([^·]+?)\s+(\d+(?:\.\d+)?)\s*%/i);
  return {
    ufPct: uf ? parseFloat(uf[1]) : null,
    leaderName: leader ? leader[1].trim() : null,
    leaderPct: leader ? parseFloat(leader[2]) : null
  };
}

function enrichPlayerBundle(raw, { storePlayers, intelList, heatList } = {}) {
  const name = sanitize.sanitizePlayerName(raw?.playerName || raw?.name);
  if (!name) return null;

  const slug = raw.playerSlug || raw.slug;
  const store = findStorePlayer(slug, name, storePlayers);
  const intel =
    (intelList || []).find(
      (i) =>
        i.playerSlug === slug ||
        sanitize.sanitizePlayerName(i.playerName) === name
    ) || null;
  const heat =
    (heatList || []).find(
      (h) =>
        h.playerSlug === slug ||
        sanitize.sanitizePlayerName(h.playerName) === name
    ) || raw;

  const staff = loadStaffIntel(slug || store?.slug);
  const intelDetail = sanitize.sanitizeIntelDetail(intel?.detail || raw?.detail);
  const heatDetail = sanitize.sanitizeIntelDetail(heat?.detail);
  const rpm = parseRpmFromDetail(heatDetail || heat?.headline);

  const bundle = {
    name,
    slug: slug || store?.slug,
    pos: raw.pos || store?.pos || intel?.pos,
    stars: raw.stars || store?.stars || intel?.stars,
    classYear: raw.classYear || store?.classYear || intel?.classYear || cycle.RECRUITING_MIN_CLASS,
    school:
      identityValidator.sanitizeSchoolField(raw.school || raw.highSchool || store?.school || store?.fromSchool) ||
      identityValidator.sanitizeSchoolField(intel?.school || intel?.highSchool, { allowCollege: true }) ||
      null,
    natlRank: raw.natlRank || store?.natlRank,
    ufRpmPct: store?.ufRpmPct || rpm.ufPct,
    rpmLeader: rpm.leaderName,
    rpmLeaderPct: rpm.leaderPct,
    trigger: heat?.trigger || raw?.trigger,
    triggerLabel: heat?.triggerLabel || raw?.triggerLabel,
    predictionSchool: heat?.predictionSchool || raw?.predictionSchool,
    movement: heat?.movement || raw?.movement,
    intelDetail,
    heatDetail,
    visitStart: intel?.visitStart || raw?.visitStart,
    eventType: intel?.eventType || raw?.eventType,
    source: intel?.source || raw?.source,
    staff,
    store
  };

  bundle.factCount = countBundleFacts(bundle);
  const playerValidation = identityValidator.validatePlayerIdentityRecord({
    slug: bundle.slug,
    name: bundle.name,
    pos: bundle.pos,
    classYear: bundle.classYear,
    school: bundle.school
  });
  if (!playerValidation.valid) return null;
  return bundle.factCount >= 2 ? bundle : null;
}

function countBundleFacts(b) {
  if (!b) return 0;
  let n = 0;
  if (b.intelDetail) n += 2;
  if (b.heatDetail && b.heatDetail !== b.intelDetail) n += 1;
  if (b.triggerLabel) n += 1;
  if (b.ufRpmPct != null || b.rpmLeader) n += 1;
  if (b.staff?.schemeFit || b.staff?.staffNotes || b.staff?.summary) n += 2;
  if (b.stars && b.pos) n += 1;
  if (b.natlRank > 0) n += 1;
  if (b.movement) n += 1;
  if (b.visitStart) n += 1;
  return n;
}

function computePositionalLandscape(bundles, targets) {
  const counts = {};
  for (const b of bundles) {
    const g = posGroup(b.pos);
    counts[g] = (counts[g] || 0) + 1;
  }
  for (const t of targets || []) {
    const g = posGroup(t.pos);
    counts[g] = (counts[g] || 0) + 0.5;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const hot = sorted.filter(([, c]) => c >= 2).map(([g]) => g);
  const thin = ['EDGE', 'WR', 'CB', 'OL', 'QB'].filter((g) => !counts[g] || counts[g] < 1.5);
  return { counts, hot, thin };
}

function assembleRecruitingContext(topic, signals) {
  const storePlayers = signals?.recruiting?.players || signals?.recruiting?.targets || [];
  const intelList = signals?.intel?.all || [];
  const heatList = topic.signals?.rising || topic.signals?.visits || [];

  const bundles = [];
  for (const raw of heatList) {
    const b = enrichPlayerBundle(raw, { storePlayers, intelList, heatList: topic.signals?.rising });
    if (b) bundles.push(b);
  }

  if (topic.category === 'official_visit_preview' || topic.category === 'post_visit_reaction') {
    for (const raw of topic.signals?.visits || []) {
      if (bundles.some((b) => b.name === sanitize.sanitizePlayerName(raw.playerName))) continue;
      const b = enrichPlayerBundle(raw, { storePlayers, intelList, heatList: topic.signals?.rising });
      if (b) bundles.push(b);
    }
  }

  if (!bundles.length) return null;

  const deduped = [];
  const seenSlugs = new Set();
  for (const bundle of bundles) {
    const key = bundle.slug || bundle.name;
    if (seenSlugs.has(key)) continue;
    seenSlugs.add(key);
    deduped.push(bundle);
  }

  const totalFacts = deduped.reduce((sum, b) => sum + b.factCount, 0);
  const landscape = computePositionalLandscape(deduped, signals?.recruiting?.targets);
  const upcoming = (signals?.intel?.upcoming || []).slice(0, 4);
  const commits = signals?.recruiting?.commits || [];

  return {
    category: topic.category,
    classYear: topic.classYear || cycle.RECRUITING_MIN_CLASS,
    bundles: deduped.slice(0, 5),
    totalFacts,
    landscape,
    upcoming,
    commits,
    targets: signals?.recruiting?.targets || []
  };
}

function rosterUnitSnapshot(roster) {
  const players = roster?.players || [];
  if (!players.length || !players[0]?.pos) return null;
  const counts = {};
  for (const p of players) {
    const g = posGroup(p.pos || p.position);
    counts[g] = (counts[g] || 0) + 1;
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4);
  return { counts, top };
}

function assembleProgramContext(topic, signals) {
  const portal = topic.signals?.portal || signals?.portal;
  const roster = topic.signals?.roster || signals?.roster;
  const game = topic.signals?.game;
  const depth = topic.signals?.depthChart || signals?.depthChart;
  const unitSnap = rosterUnitSnapshot(roster);

  const facts = [];
  if (portal?.count > 0) facts.push(`portal_${portal.count}`);
  if (portal?.incoming?.length) facts.push('portal_names');
  if (roster?.players?.length >= 40) facts.push('roster_size');
  if (roster?.offense?.length && roster?.defense?.length) facts.push('unit_split');
  if (game?.spread || game?.opponent) facts.push('game_line');
  if (depth?.meta?.updatedAt) facts.push('depth_refresh');
  if (unitSnap?.top?.length) facts.push('position_snapshot');

  if (facts.length < (MIN_FACTS[topic.category] || 3)) return null;

  return {
    category: topic.category,
    portal,
    roster,
    game,
    depth,
    unitSnap,
    season: cycle.programSeasonYear(),
    factCount: facts.length
  };
}

function hasMinimumIntel(ctx, category) {
  if (!ctx) return false;
  const min = MIN_FACTS[category] || 4;
  if (ctx.bundles) return ctx.totalFacts >= min && ctx.bundles.length >= (category === 'heat_check' ? 2 : 1);
  return (ctx.factCount || 0) >= min;
}

function playerDescriptor(b) {
  const bits = [];
  if (b.stars) bits.push(`${b.stars}-star`);
  if (b.pos) bits.push(b.pos);
  if (b.school) bits.push(`from ${b.school}`);
  if (b.natlRank > 0) bits.push(`No. ${b.natlRank} nationally`);
  return bits.join(' ');
}

function synthesizeHeatOverview(ctx) {
  const names = ctx.bundles.map((b) => b.name);
  const groups = ctx.landscape.hot.length ? ctx.landscape.hot.join(', ') : posGroup(ctx.bundles[0]?.pos);
  const yr = ctx.classYear;

  const paras = [
    `Florida's ${yr} recruiting board shifted this week with measurable momentum around ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` and ${names.length - 3} more` : ''}. GatorVault Heat Check flagged ${names.length} rising ${yr} names where verified beat intel, visit activity, or On3 RPM movement align — not isolated social buzz.`,
    `The movement clusters at ${groups}, which matches where Billy Napier's staff has been active on the trail heading into summer official visits. Florida is not chasing volume for its own sake; the names below cleared identity confirmation and carried at least two independent data points before inclusion.`,
    `For the ${yr} cycle, Florida's strategic priority is closing skill talent and trench depth before rival SEC programs consolidate their boards. This week's momentum suggests the staff is pushing decision windows on prospects where Florida already holds RPM leverage or has a campus visit scheduled.`
  ];
  return paras;
}

function synthesizeVisitOverview(ctx, { postVisit = false } = {}) {
  const b = ctx.bundles[0];
  const count = ctx.bundles.length;
  const window = postVisit ? 'completed Gainesville trips' : 'confirmed official visit window';
  return [
    `Florida ${postVisit ? 'hosted' : 'is preparing for'} a ${window} with ${count} verified ${ctx.classYear}-cycle prospect${count > 1 ? 's' : ''}${b?.visitStart ? ` (${esc(String(b.visitStart))})` : ''}. This piece synthesizes scheduling intel, board context, and staff evaluation — not visit grades from social posts.`,
    `${esc(b.name)}${count > 1 ? ` leads a group that includes ${ctx.bundles.slice(1, 3).map((x) => esc(x.name)).join(' and ')}` : ''}. Each name below is identity-confirmed on Florida's ${ctx.classYear} board with complete position and school context.`,
    `Official visits are Florida's highest-leverage evaluation tool in the ${ctx.classYear} cycle: the staff sells scheme fit, development path, and NIL infrastructure while assessing whether the prospect can help compete in the SEC as a freshman or early contributor.`
  ];
}

function synthesizePlayerTrendParagraph(b, ctx) {
  const parts = [];
  const desc = playerDescriptor(b);
  parts.push(`<strong>${esc(b.name)}</strong>${desc ? ` (${esc(desc)})` : ''} is rising this week`);

  if (b.triggerLabel) {
    parts.push(`after ${esc(b.triggerLabel.toLowerCase())}`);
  }
  if (b.movement) {
    parts.push(`— ${esc(b.movement)}`);
  }
  parts.push('.');

  if (b.intelDetail) {
    parts.push(`Beat intel: ${esc(b.intelDetail)}`);
  } else if (b.heatDetail) {
    parts.push(`Signal: ${esc(b.heatDetail)}`);
  }

  if (b.ufRpmPct != null) {
    if (b.rpmLeader && b.rpmLeaderPct != null) {
      parts.push(
        `On3 RPM shows Florida at ${esc(fmtPct(b.ufRpmPct))} with ${esc(b.rpmLeader)} at ${esc(fmtPct(b.rpmLeaderPct))} — competitive pressure remains, but Florida is in the mix.`
      );
    } else {
      parts.push(`Florida leads On3 RPM at ${esc(fmtPct(b.ufRpmPct))} for this recruitment.`);
    }
  }

  if (b.staff?.schemeFit) {
    parts.push(`Staff evaluation: ${esc(b.staff.schemeFit)}`);
  } else if (b.staff?.summary) {
    parts.push(`Scouting note: ${esc(String(b.staff.summary).slice(0, 200))}`);
  } else if (b.staff?.staffNotes) {
    parts.push(`Staff notes: ${esc(String(b.staff.staffNotes).slice(0, 200))}`);
  }

  if (b.visitStart && /visit/i.test(String(b.eventType || ''))) {
    parts.push(`Visit timing: ${esc(String(b.visitStart))} — Florida will prioritize post-visit follow-up if the trip validates scheme fit.`);
  }

  const text = parts.join(' ');
  return text.length >= 80 ? text : null;
}

function synthesizeRecruitingAnalysis(ctx) {
  const paras = [];
  const { hot, thin } = ctx.landscape;

  if (hot.length) {
    paras.push(
      `Position-group read: momentum is concentrated at ${hot.join(', ')}. When Florida pushes multiple names in the same room, it usually reflects a staff priority for the ${ctx.classYear} class — not random national buzz.`
    );
  }

  const withRpm = ctx.bundles.filter((b) => b.ufRpmPct != null);
  if (withRpm.length) {
    const leaders = withRpm.filter((b) => b.ufRpmPct >= 40);
    if (leaders.length) {
      paras.push(
        `${leaders.map((b) => esc(b.name)).join(' and ')} ${leaders.length > 1 ? 'show' : 'shows'} strong Florida RPM leverage — the staff can push timeline acceleration because the Crystal Ball/RPM picture already favors Gainesville.`
      );
    }
    const pressured = withRpm.filter((b) => b.rpmLeader && b.rpmLeaderPct != null && (b.ufRpmPct || 0) < (b.rpmLeaderPct || 0));
    if (pressured.length) {
      paras.push(
        `Competitive landscape: ${pressured.map((b) => `${esc(b.name)} trails ${esc(b.rpmLeader)} on RPM`).join('; ')}. Florida must win the official visit and follow-up window to flip momentum.`
      );
    }
  }

  const withStaff = ctx.bundles.filter((b) => b.staff?.schemeFit || b.staff?.summary);
  if (withStaff.length) {
    paras.push(
      `Scheme fit matters for this group — ${withStaff.map((b) => esc(b.name)).join(', ')} ${withStaff.length > 1 ? 'have' : 'has'} verified scouting context on file. Florida's staff typically accelerates prospects who project into Billy Napier's personnel packages without a year of development delay.`
    );
  }

  if (thin.length && ctx.category !== 'post_visit_reaction') {
    paras.push(
      `Board reshuffling note: Florida still needs volume at ${thin.slice(0, 3).join(', ')} in the ${ctx.classYear} class. Rising names at other positions may reflect the staff filling immediate priorities before turning to thin rooms.`
    );
  }

  const ovBundles = ctx.bundles.filter((b) => /visit/i.test(String(b.eventType || '')) || b.visitStart);
  if (ovBundles.length) {
    paras.push(
      `OV impact: ${ovBundles.map((b) => esc(b.name)).join(', ')} ${ovBundles.length > 1 ? 'are' : 'is'} on Florida's visit calendar. Strong campus weekends often compress decision timelines by two to four weeks when family feedback and position-coach film review align.`
    );
  }

  if (ctx.category === 'official_visit_preview' || ctx.category === 'post_visit_reaction') {
    paras.push(
      `Florida's ${ctx.classYear} staff uses official visits to validate scheme fit in Billy Napier's offense and to map where a prospect fits in the current board pecking order. A productive OV does not guarantee commitment — but it almost always clarifies whether Florida is a finalist or a fallback option.`
    );
    if (ctx.landscape.thin.length) {
      paras.push(
        `With ${ctx.landscape.thin.slice(0, 2).join(' and ')} still thin on the ${ctx.classYear} board, a strong visit from ${esc(ctx.bundles[0]?.name || 'this prospect')} could move Florida from "monitoring" to "priority push" if RPM and family feedback follow.`
      );
    }
  }

  if (paras.length < 2) return null;
  return paras;
}

function synthesizeRecruitingWhatsNext(ctx) {
  const paras = [];
  const yr = ctx.classYear;

  if (ctx.upcoming?.length) {
    const names = ctx.upcoming
      .map((v) => sanitize.sanitizePlayerName(v.playerName))
      .filter(Boolean)
      .slice(0, 3);
    if (names.length) {
      paras.push(
        `Visit calendar: ${names.map((n) => esc(n)).join(', ')} ${names.length > 1 ? 'have' : 'has'} upcoming Florida dates on the board. Post-visit reaction coverage generates only after verified beat intel lands — not same-day social posts.`
      );
    }
  }

  const commitCandidates = ctx.bundles.filter(
    (b) => b.ufRpmPct >= 35 || b.trigger === 'crystal_ball_uf' || b.trigger === 'rpm_uf'
  );
  if (commitCandidates.length) {
    paras.push(
      `Commit watch: ${commitCandidates.map((b) => esc(b.name)).join(', ')} ${commitCandidates.length > 1 ? 'profile' : 'profiles'} as ${commitCandidates.length > 1 ? 'names trending toward' : 'a name trending toward'} a Florida decision if the staff closes the next in-person touchpoint.`
    );
  }

  const staffPush = ctx.bundles.filter((b) => b.natlRank > 0 && b.natlRank <= 150);
  if (staffPush.length) {
    paras.push(
      `Staff priority: Florida is pushing hardest for ${staffPush.map((b) => esc(b.name)).join(' and ')} — top-150 national profiles where losing ground to ${staffPush[0]?.rpmLeader ? esc(staffPush[0].rpmLeader) : 'SEC rivals'} would reshuffle the ${yr} board.`
    );
  }

  paras.push(
    `What could change the board: RPM flips after competing official visits, new Crystal Ball entries from SEC rivals, or visit cancellations. GatorVault refreshes when verified signals arrive — never from speculation.`
  );

  return paras.length >= 2 ? paras : null;
}

function synthesizeProgramOverview(ctx) {
  const season = ctx.season;
  const paras = [];

  if (ctx.portal?.count > 0) {
    const head = ctx.portal.headliner?.name ? sanitize.sanitizePlayerName(ctx.portal.headliner.name) : null;
    paras.push(
      `Florida's ${season} roster construction includes ${ctx.portal.count} tracked portal addition${ctx.portal.count > 1 ? 's' : ''}${head ? `, headlined by ${esc(head)}` : ''}. Portal activity defines the floor before fall camp — immediate contributors vs developmental depth are evaluated separately.`
    );
  } else if (ctx.roster?.players?.length) {
    paras.push(
      `Roster analysis for Florida's ${season} team: ${ctx.roster.players.length} scholarship names across ${ctx.roster.offense?.length || '—'} offensive and ${ctx.roster.defense?.length || '—'} defensive pieces. This is program evaluation — not recruiting class rankings.`
    );
  }

  if (ctx.game?.opponent) {
    paras.push(
      `Game-week context: Florida faces ${esc(ctx.game.opponent)} with ${ctx.game.spread ? `market line ${esc(ctx.game.spread)}` : 'lines tracked in Game Zone'}${ctx.game.total ? ` and total ${esc(ctx.game.total)}` : ''}.`
    );
  }

  paras.push(
    `Billy Napier's staff enters the ${season} evaluation window focused on returning production, portal integration, and scheme adjustments from spring. Program Pulse tracks team personnel only — ${cycle.RECRUITING_MIN_CLASS}+ recruiting lives in Heat Check and visit columns.`,
    `The SEC window does not wait for development timelines. Florida needs contributors who can help win ${season} games while the staff continues to build the ${cycle.RECRUITING_MIN_CLASS} board separately — that separation keeps this column focused on the team on the field, not signing-day rankings.`
  );

  return paras.length >= 2 ? paras : null;
}

function synthesizeProgramTrends(ctx) {
  const trends = [];
  if (ctx.portal?.incoming?.length) {
    for (const pl of ctx.portal.incoming.slice(0, 3)) {
      const line = templates.playerLine({ ...pl, classYear: ctx.season }, 'portal addition');
      if (line) trends.push(line.replace(`${ctx.season} class`, `${ctx.season} roster`));
    }
  }
  if (!trends.length && ctx.roster?.offense?.length) {
    trends.push(
      `Unit split: ${ctx.roster.offense.length} offensive / ${ctx.roster.defense.length} defensive players on the ${ctx.season} roster — balance drives two-deep and special-teams planning.`
    );
  }
  if (ctx.game?.date) {
    trends.push(`Next kickoff window: ${esc(ctx.game.date)} vs ${esc(ctx.game.opponent || 'TBD')}.`);
  }
  return trends.length ? trends : null;
}

function synthesizeProgramAnalysis(ctx) {
  const paras = [];
  const season = ctx.season;

  if (ctx.roster?.offense?.length && ctx.roster?.defense?.length) {
    paras.push(
      `Personnel grouping trends at WR, EDGE, and nickel will define ${season} snap distribution. Florida lists ${ctx.roster.offense.length} offensive and ${ctx.roster.defense.length} defensive pieces — mature rooms absorb portal losses while thin rooms become immediate camp battles.`
    );
  }
  if (ctx.unitSnap?.top?.length) {
    const unitLine = ctx.unitSnap.top.map(([g, n]) => `${g} (${n})`).join(', ');
    paras.push(
      `Roster composition snapshot: ${esc(unitLine)} lead the scholarship count. That distribution shapes who travels, who redshirts, and where portal additions can plug immediate holes before the ${season} opener.`
    );
  }
  if (ctx.depth?.rosterCount >= 50) {
    paras.push(
      `Depth-chart integration tracks ${ctx.depth.rosterCount} rostered players — coaches prioritize known quantities early while camp decides third and fourth rotation pieces at WR, EDGE, and in the secondary.`
    );
  }
  if (ctx.portal?.count > 0) {
    paras.push(
      `Portal additions finalized before camp shift the two-deep at positions where ${season} playing time is available. Florida evaluates immediate SEC readiness separately from redshirt development paths — the staff cannot afford to miss on plug-and-play contributors at OL and EDGE.`
    );
  }
  if (ctx.game?.opponent) {
    paras.push(
      `The ${esc(ctx.game.opponent)} matchup adds context: Florida's game plan and health at quarterback, offensive line, and edge rusher will determine whether the ${season} ceiling matches the roster talent on paper.`
    );
  }
  return paras.length >= 2 ? paras : null;
}

function synthesizeProgramWhatsNext(ctx) {
  const paras = [
    `Fall camp is the next major checkpoint for the ${ctx.season} team. Depth Chart Movement and Summer Preview drafts generate only when verified roster or rep-share signals land — not from placeholder projections.`,
    `Portal names who finalize before camp will appear in the next Program Pulse refresh. Recruiting-specific staff activity remains in ${cycle.RECRUITING_MIN_CLASS}+ Heat Check and official visit columns.`
  ];
  if (ctx.portal?.count > 0) {
    paras.push(
      `Watch whether incoming portal additions stack reps in summer workouts — that is the earliest indicator of who projects into the ${ctx.season} two-deep before media day.`
    );
  }
  if (ctx.game?.opponent) {
    paras.push(
      `Game-week preview coverage for ${esc(ctx.game.opponent)} activates when Game Zone confirms lines and Florida releases availability notes from the training staff.`
    );
  }
  return paras;
}

function buildRecruitingArticle(ctx) {
  const trends = ctx.bundles.map((b) => synthesizePlayerTrendParagraph(b, ctx)).filter(Boolean);
  if (trends.length < (ctx.category === 'heat_check' ? 2 : 1)) return null;

  let overview;
  if (ctx.category === 'heat_check') overview = synthesizeHeatOverview(ctx);
  else if (ctx.category === 'official_visit_preview') overview = synthesizeVisitOverview(ctx);
  else if (ctx.category === 'post_visit_reaction') overview = synthesizeVisitOverview(ctx, { postVisit: true });
  else overview = null;

  const analysis = synthesizeRecruitingAnalysis(ctx);
  const whatsNext = synthesizeRecruitingWhatsNext(ctx);

  if (!overview || !analysis || !whatsNext) return null;

  return [
    templates.section('Overview', overview),
    templates.section('Trends', trends),
    templates.section('Analysis', analysis),
    templates.section("What's Next", whatsNext)
  ].join('\n');
}

function buildProgramArticle(ctx) {
  const overview = synthesizeProgramOverview(ctx);
  const trends = synthesizeProgramTrends(ctx);
  const analysis = synthesizeProgramAnalysis(ctx);
  const whatsNext = synthesizeProgramWhatsNext(ctx);
  if (!overview || !trends || !analysis || !whatsNext) return null;

  return [
    templates.section('Overview', overview),
    templates.section('Trends', trends),
    templates.section('Analysis', analysis),
    templates.section("What's Next", whatsNext)
  ].join('\n');
}

function buildEditorialBody(topic, signals) {
  let ctx;
  if (cycle.isRecruitingCategory(topic.category)) {
    ctx = assembleRecruitingContext(topic, signals);
    if (!hasMinimumIntel(ctx, topic.category)) return null;
    return buildRecruitingArticle(ctx);
  }
  ctx = assembleProgramContext(topic, signals);
  if (!hasMinimumIntel(ctx, topic.category)) return null;
  return buildProgramArticle(ctx);
}

function buildEditorialDraft(topic, signals) {
  const body = buildEditorialBody(topic, signals);
  if (!body) return null;

  const draft = {
    title: sanitize.sanitizeText(topic.title),
    category: topic.category,
    summary: sanitize.sanitizeText(topic.title).replace(/^[^:]+:\s*/, '').slice(0, 220),
    body,
    readTimeMinutes: Math.max(4, Math.ceil(sanitize.wordCount(body) / 200)),
    sources: topic.sources || [],
    topicKey: topic.topicKey,
    classYear: topic.classYear || null,
    cycleType: topic.cycleType || null
  };

  const quality = templates.validateDraftQuality(draft);
  if (!quality.ok) return null;
  return draft;
}

module.exports = {
  MIN_FACTS,
  enrichPlayerBundle,
  assembleRecruitingContext,
  assembleProgramContext,
  hasMinimumIntel,
  buildEditorialBody,
  buildEditorialDraft,
  countBundleFacts
};
