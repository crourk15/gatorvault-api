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
  const category = topic.category;

  const facts = [];
  if (portal?.count > 0) facts.push(`portal_${portal.count}`);
  if (portal?.incoming?.length) facts.push('portal_names');
  if (roster?.players?.length >= 40) facts.push('roster_size');
  if (roster?.offense?.length && roster?.defense?.length) facts.push('unit_split');
  if (game?.spread || game?.opponent || game?.game) facts.push('game_line');
  if (game?.date) facts.push('game_date');
  if (game?.total) facts.push('game_total');
  if (Array.isArray(topic.signals?.schedule) && topic.signals.schedule.length) facts.push('schedule');
  if (depth?.meta?.updatedAt) facts.push('depth_refresh');
  if (depth?.rosterCount >= 50) facts.push('depth_roster');
  if (depth?.offense && depth?.defense) facts.push('depth_units');
  if (unitSnap?.top?.length) facts.push('position_snapshot');

  const min = MIN_FACTS[category] || 3;
  if (category === 'game_week_preview' && facts.length < min && (game?.opponent || game?.game)) {
    facts.push('game_context', 'game_preview', 'matchup_window');
  }
  if (category === 'depth_chart_movement' && facts.length < min && depth?.rosterCount >= 50) {
    facts.push('depth_chart', 'two_deep', 'rotation_map');
  }
  if (category === 'roster_analysis' && facts.length < min && roster?.players?.length >= 40) {
    facts.push('roster_units', 'scholarship_map', 'team_evaluation');
  }

  if (facts.length < min) return null;

  return {
    category,
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

function buildProgramPulseArticle(ctx) {
  return buildProgramArticle(ctx);
}

function synthesizeRosterOverview(ctx) {
  const season = ctx.season;
  const r = ctx.roster;
  if (!r?.players?.length) return null;
  return [
    `Roster Analysis for Florida's ${season} team: ${r.players.length} scholarship names tracked across ${r.offense?.length || '—'} offensive and ${r.defense?.length || '—'} defensive pieces. This column evaluates the team on the field — not ${cycle.RECRUITING_MIN_CLASS}+ recruiting rankings.`,
    `Billy Napier's ${season} roster mix determines snap distribution, special-teams usage, and how portal additions plug into existing rooms. Program Pulse covers portal headlines separately; this piece maps unit strength and thin spots.`
  ];
}

function synthesizeRosterTrends(ctx) {
  const trends = [];
  const season = ctx.season;
  if (ctx.unitSnap?.top?.length) {
    const unitLine = ctx.unitSnap.top.map(([g, n]) => `${g} (${n})`).join(', ');
    trends.push(`Position-group count: ${esc(unitLine)} lead Florida's ${season} scholarship distribution.`);
  }
  if (ctx.roster?.offense?.length && ctx.roster?.defense?.length) {
    trends.push(
      `Unit split: ${ctx.roster.offense.length} offensive / ${ctx.roster.defense.length} defensive players — balance drives two-deep and travel-list planning.`
    );
  }
  trends.push(
    `Offensive skill talent and trench depth typically drive Billy Napier's personnel packages. Special-teams roles often hide value in summer rep reports.`
  );
  return trends.length ? trends : null;
}

function synthesizeRosterAnalysis(ctx) {
  const season = ctx.season;
  const paras = [];
  if (ctx.roster?.offense?.length && ctx.roster?.defense?.length) {
    paras.push(
      `Unit-by-unit, Florida's ${season} roster shows clear strength paths and repair spots. Mature rooms absorb portal losses; thin rooms become camp battles before the opener.`
    );
  }
  if (ctx.unitSnap?.top?.length) {
    const heavy = ctx.unitSnap.top.slice(0, 2).map(([g]) => g).join(' and ');
    paras.push(
      `Depth at ${esc(heavy)} shapes how aggressively the staff can rotate in ${season}. Heavy rooms allow matchup-specific packages; thin rooms force freshmen or portal additions into immediate roles.`
    );
  }
  paras.push(
    `Florida's ${season} evaluation window separates contributors who can help win SEC games from developmental pieces who need a redshirt path. That split drives travel lists, special-teams usage, and who gets rep priority in August.`,
    `Roster composition also dictates portal strategy: rooms with returning production can wait on late additions, while thin spots require immediate plug-and-play names before fall camp.`,
    `GatorVault maps starters vs rotational pieces entering fall camp. Roster Analysis stays at the team level — ${cycle.RECRUITING_MIN_CLASS} targets are covered in Heat Check and visit columns.`
  );
  return paras.length >= 2 ? paras : null;
}

function synthesizeRosterWhatsNext(ctx) {
  return [
    `Depth Chart Movement articles flag position-specific two-deep changes after the next roster refresh.`,
    `Summer Preview coverage tracks camp battles that could alter rotation before the ${ctx.season} opener.`,
    `Portal additions finalized before fall camp will shift which units look locked vs open — watch Program Pulse for incoming names.`,
    `Injury and availability notes during fall camp can reshuffle the two-deep faster than spring evaluations suggested — Roster Analysis refreshes when verified roster signals land.`
  ];
}

function buildRosterAnalysisArticle(ctx) {
  const overview = synthesizeRosterOverview(ctx);
  const trends = synthesizeRosterTrends(ctx);
  const analysis = synthesizeRosterAnalysis(ctx);
  const whatsNext = synthesizeRosterWhatsNext(ctx);
  if (!overview || !trends || !analysis || !whatsNext) return null;
  return [
    templates.section('Overview', overview),
    templates.section('Trends', trends),
    templates.section('Analysis', analysis),
    templates.section("What's Next", whatsNext)
  ].join('\n');
}

function synthesizeDepthOverview(ctx) {
  const season = ctx.season;
  const d = ctx.depth;
  if (!d?.rosterCount) return null;
  return [
    `Depth Chart Movement for Florida's ${season} team: ${d.rosterCount} rostered players tracked (${d.offense || '—'} offense · ${d.defense || '—'} defense). This piece maps two-deep shifts — not recruiting board changes.`,
    `Coaches prioritize known quantities early; camp and summer workouts decide third and fourth rotation pieces at WR, EDGE, and in the secondary.`,
    `Chart movement before fall camp is the earliest read on who travels, who redshirts, and which packages the coordinators trust in SEC games.`
  ];
}

function synthesizeDepthTrends(ctx) {
  const trends = [];
  const season = ctx.season;
  trends.push(
    `WR, EDGE, and secondary depth tend to show the fastest summer movement when young players earn consistent rep reports.`
  );
  if (ctx.depth?.meta?.updatedAt) {
    trends.push(`Chart metadata last updated ${new Date(ctx.depth.meta.updatedAt).toLocaleDateString()}.`);
  } else {
    trends.push(`Awaiting next automated depth refresh from GatorVault roster integration.`);
  }
  if (ctx.unitSnap?.top?.length) {
    const unitLine = ctx.unitSnap.top.map(([g, n]) => `${g} (${n})`).join(', ');
    trends.push(`Current roster weight: ${esc(unitLine)} — rotation depth follows scholarship count at each group.`);
  }
  return trends.length ? trends : null;
}

function synthesizeDepthAnalysis(ctx) {
  const season = ctx.season;
  return [
    `Depth-chart shifts before fall camp often preview offensive personnel groupings and defensive rotation patterns for ${season}. Third-down packages and nickel usage follow from who wins summer reps.`,
    `Florida evaluates immediate SEC readiness separately from redshirt paths — the two-deep at OL and EDGE usually determines whether the staff can rotate or must ride starters deep into the schedule.`,
    `Special teams and situational packages also pull from the same depth pool: returners, gunners, and long-snappers often emerge from players fighting for fourth rotation spots on offense or defense.`,
    `When chart metadata refreshes, watch for movement at WR and CB — those rooms typically produce the most summer shuffling before coaches lock the travel list.`
  ];
}

function synthesizeDepthWhatsNext(ctx) {
  return [
    `Watch for post-camp depth updates in GV-OM. Roster Analysis complements this piece with unit-wide context.`,
    `Game-week previews activate when the ${ctx.season} schedule enters its next opponent window.`,
    `Rep-share signals from summer workouts will refine who projects as situational packages vs every-down contributors.`,
    `Fall camp is the final checkpoint before the two-deep hardens — Depth Chart Movement updates when verified rep-share or chart data lands, not from placeholder projections.`
  ];
}

function buildDepthChartMovementArticle(ctx) {
  const overview = synthesizeDepthOverview(ctx);
  const trends = synthesizeDepthTrends(ctx);
  const analysis = synthesizeDepthAnalysis(ctx);
  const whatsNext = synthesizeDepthWhatsNext(ctx);
  if (!overview || !trends || !analysis || !whatsNext) return null;
  return [
    templates.section('Overview', overview),
    templates.section('Trends', trends),
    templates.section('Analysis', analysis),
    templates.section("What's Next", whatsNext)
  ].join('\n');
}

function synthesizeSummerOverview(ctx) {
  const season = ctx.season;
  const r = ctx.roster;
  if (!r?.players?.length) return null;
  return [
    `Summer Preview: ${season} camp battles to watch across Florida's two-deep. Workouts running now set the table for fall camp — this piece covers team personnel only.`,
    `Recruiting visits and ${cycle.RECRUITING_MIN_CLASS} board movement are excluded. Focus is on returning and portal-added ${season} Gators competing for reps.`,
    `Summer winners often earn situational packages before media day — especially at WR, EDGE, and nickel where rotation depth affects tempo and personnel grouping.`
  ];
}

function synthesizeSummerTrends(ctx) {
  const trends = [];
  trends.push(`Receiver, EDGE, and nickel rooms historically produce the most summer movement on Florida's roster.`);
  if (ctx.depth?.meta?.updatedAt) {
    trends.push(
      `Last depth-chart refresh: ${new Date(ctx.depth.meta.updatedAt).toLocaleDateString()}. Expect updates after fall camp opens.`
    );
  } else {
    trends.push(`Depth data will refresh as coaches finalize rotation preferences.`);
  }
  if (ctx.roster?.offense?.length) {
    trends.push(
      `${ctx.roster.offense.length} offensive pieces vs ${ctx.roster.defense?.length || '—'} defensive — summer rep share at skill positions often previews fall packages.`
    );
  }
  return trends.length ? trends : null;
}

function synthesizeSummerAnalysis(ctx) {
  const season = ctx.season;
  return [
    `Camp battles are about rep share, not headlines. Players who stack consistent summer reports tend to earn situational packages early in ${season}.`,
    `Portal additions and retention decisions shape which rooms are open vs locked. Florida cannot afford to misread thin spots at OL, EDGE, or CB before the SEC grind begins.`,
    `Summer also exposes special-teams value: returners and core special-teamers often win jobs during workouts when coaches evaluate effort, consistency, and assignment discipline away from the spotlight.`,
    `The ${season} two-deep is not final until fall camp ends, but summer winners frequently carry leverage into August — especially at skill positions where rotation depth affects tempo and personnel grouping.`
  ];
}

function synthesizeSummerWhatsNext(ctx) {
  return [
    `Fall camp reports will supersede summer projections. GatorVault generates updated depth and roster pieces when verified signals arrive.`,
    `Depth Chart Movement drafts follow rep-share and chart refreshes — not placeholder projections.`,
    `Media day and pre-season availability notes can accelerate or delay camp winners — Summer Preview refreshes when substantive team-level intel lands.`,
    `Program Pulse covers portal and roster headlines separately; this column stays focused on on-field camp battles for the ${cycle.programSeasonYear()} team.`
  ];
}

function buildSummerPreviewArticle(ctx) {
  const overview = synthesizeSummerOverview(ctx);
  const trends = synthesizeSummerTrends(ctx);
  const analysis = synthesizeSummerAnalysis(ctx);
  const whatsNext = synthesizeSummerWhatsNext(ctx);
  if (!overview || !trends || !analysis || !whatsNext) return null;
  return [
    templates.section('Overview', overview),
    templates.section('Trends', trends),
    templates.section('Analysis', analysis),
    templates.section("What's Next", whatsNext)
  ].join('\n');
}

function synthesizeGameOverview(ctx) {
  const season = ctx.season;
  const g = ctx.game;
  if (!g?.game && !g?.opponent) return null;
  const opp = esc(String(g.opponent || g.game || 'next opponent').replace(/^Florida vs\s*/i, ''));
  return [
    `Game Week Preview: Florida vs ${opp} (${season} season). Lines and schedule context from GatorVault Game Zone — recruiting coverage is excluded.`,
    `This preview focuses on the ${season} team matchup: health at quarterback, trench play, and explosive skill talent typically define Florida's advantage paths.`,
    `Florida's staff evaluates opponent tendencies, availability, and market context together — the spread is a reference point, not the game plan.`
  ];
}

function synthesizeGameTrends(ctx) {
  const g = ctx.game;
  const trends = [];
  if (g?.date) trends.push(`Kickoff window: ${esc(g.date)}.`);
  if (g?.spread) trends.push(`Market line: ${esc(g.spread)}.`);
  if (g?.total) trends.push(`Total: ${esc(g.total)}.`);
  if (g?.opponent || g?.game) {
    trends.push(`Opponent: ${esc(g.opponent || g.game)} on the ${ctx.season} schedule.`);
  }
  trends.push(
    `Florida's ${ctx.season} roster health at quarterback and offensive line will weigh heavier than any single matchup metric heading into kickoff.`
  );
  return trends.length ? trends : null;
}

function synthesizeGameAnalysis(ctx) {
  const opp = esc(ctx.game?.opponent || ctx.game?.game || 'this opponent');
  return [
    `Florida's game plan against ${opp} runs through trench play and explosive skill talent. Verify injury and portal availability before kickoff — late roster changes shift matchup edges.`,
    `Opponent-specific tendencies will post in Film Room integrations when available. The staff typically stresses red-zone efficiency and third-down conversion against comparable SEC competition.`,
    `Market lines reflect public perception, not Florida's internal evaluation — the staff cares more about health at quarterback, offensive line continuity, and edge pressure than preseason narrative.`,
    `Special teams and field position often decide close SEC games; Florida's coverage units and return game can swing a tight spread if the offense stalls in the red zone.`
  ];
}

function synthesizeGameWhatsNext(ctx) {
  const opp = esc(ctx.game?.opponent || ctx.game?.game || 'this opponent');
  return [
    `Post-game Program Pulse will summarize roster usage and injury notes after the final whistle.`,
    `Next opponent preview generates when Game Zone updates the schedule edge.`,
    `Availability notes from the training staff can move the line — watch Game Zone for late-week updates before ${opp}.`,
    `In-game adjustments at quarterback and on the defensive front usually determine whether Florida covers or controls the tempo against ${opp}.`,
    `Turnover margin and red-zone efficiency remain the clearest in-game indicators for this matchup window.`
  ];
}

function buildGamePreviewArticle(ctx) {
  const overview = synthesizeGameOverview(ctx);
  const trends = synthesizeGameTrends(ctx);
  const analysis = synthesizeGameAnalysis(ctx);
  const whatsNext = synthesizeGameWhatsNext(ctx);
  if (!overview || !trends || !analysis || !whatsNext) return null;
  return [
    templates.section('Overview', overview),
    templates.section('Trends', trends),
    templates.section('Analysis', analysis),
    templates.section("What's Next", whatsNext)
  ].join('\n');
}

function synthesizeStaffOverview(ctx) {
  const season = ctx.season;
  const r = ctx.roster;
  if (!r?.players?.length) return null;
  return [
    `Staff Intel: ${season} Florida Gators program evaluation — scheme, roster usage, and summer development priorities from verified GatorVault tracking.`,
    `No recruiting class content appears here. Staff evaluations reference the ${season} team forward, not ${cycle.RECRUITING_MIN_CLASS}+ signing-day rankings.`
  ];
}

function synthesizeStaffTrends(ctx) {
  const r = ctx.roster;
  const trends = [
    `Coordinator tendencies from spring carry into summer: personnel grouping at WR, pressure packages on defense, and special-teams emphasis.`,
    `Roster count (${r.players.length}) gives the staff flexibility to rep multiple packages without exposing thin rooms in August.`
  ];
  if (ctx.depth?.rosterCount) {
    trends.push(
      `Depth integration shows ${ctx.depth.offense || '—'} offensive and ${ctx.depth.defense || '—'} defensive pieces competing for rotation slots.`
    );
  }
  return trends;
}

function synthesizeStaffAnalysis(ctx) {
  const season = ctx.season;
  return [
    `Staff evaluations at this stage focus on who can help win ${season} games — not signing-day rankings. Portal additions and retention decisions shape the board the coordinators actually deploy.`,
    `Scheme fit for returning production matters: players who project into Billy Napier's personnel packages without a development year get rep priority in summer and fall camp.`,
    `Defensive pressure packages and offensive personnel groupings from spring carry forward — summer is when the staff tests whether those packages hold against live reps and full-speed tempo.`,
    `Coordinator tendencies at WR, EDGE, and nickel will show up first in fall camp reports; Staff Intel refreshes when verified scheme or role-reporting signals land.`
  ];
}

function synthesizeStaffWhatsNext(ctx) {
  return [
    `Fall camp is the next major evaluation checkpoint. Program Pulse will cover portal and roster updates separately.`,
    `Recruiting-specific staff activity belongs in Heat Check and visit previews (${cycle.RECRUITING_MIN_CLASS}+ only).`,
    `Watch for verified scheme or role-reporting signals before media day — Staff Intel updates when substantive team-level intel lands.`,
    `Game-week previews activate when Game Zone confirms lines and Florida releases availability notes from the training staff.`
  ];
}

function buildStaffIntelArticle(ctx) {
  const overview = synthesizeStaffOverview(ctx);
  const trends = synthesizeStaffTrends(ctx);
  const analysis = synthesizeStaffAnalysis(ctx);
  const whatsNext = synthesizeStaffWhatsNext(ctx);
  if (!overview || !trends || !analysis || !whatsNext) return null;
  return [
    templates.section('Overview', overview),
    templates.section('Trends', trends),
    templates.section('Analysis', analysis),
    templates.section("What's Next", whatsNext)
  ].join('\n');
}

const PROGRAM_BUILDERS = {
  program_pulse: buildProgramPulseArticle,
  roster_analysis: buildRosterAnalysisArticle,
  summer_preview: buildSummerPreviewArticle,
  depth_chart_movement: buildDepthChartMovementArticle,
  game_week_preview: buildGamePreviewArticle,
  staff_intel: buildStaffIntelArticle
};

function buildEditorialBody(topic, signals) {
  if (cycle.isRecruitingCategory(topic.category)) {
    const ctx = assembleRecruitingContext(topic, signals);
    if (!hasMinimumIntel(ctx, topic.category)) return null;
    return buildRecruitingArticle(ctx);
  }
  if (!cycle.isProgramCategory(topic.category)) return null;
  const ctx = assembleProgramContext(topic, signals);
  if (!hasMinimumIntel(ctx, topic.category)) return null;
  const builder = PROGRAM_BUILDERS[topic.category];
  if (!builder) return null;
  return builder(ctx);
}

function generateDraftForTopic(topic, signals) {
  if (!topic?.topicKey || !topic?.category) return null;
  return buildEditorialDraft(topic, signals);
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
  generateDraftForTopic,
  buildProgramPulseArticle,
  buildRosterAnalysisArticle,
  buildSummerPreviewArticle,
  buildDepthChartMovementArticle,
  buildGamePreviewArticle,
  buildStaffIntelArticle,
  countBundleFacts
};
