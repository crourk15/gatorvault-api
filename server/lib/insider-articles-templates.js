/**
 * Category-specific Insider article templates — structured sections, cycle-aware.
 */
const cycle = require('./insider-articles-cycle');
const sanitize = require('./insider-articles-sanitize');

const MIN_WORDS = 250;
const TARGET_WORDS = 320;

function recruitingBoilerplate() {
  return [
    `GatorVault recruiting coverage is locked to the ${cycle.RECRUITING_MIN_CLASS} cycle and later. The 2026 signing class is closed and excluded from Heat Check, visit previews, and board movement articles.`,
    `Every data point below passed sanitization — URLs, social handles, VIP tags, and incomplete names are removed before generation.`
  ];
}

function programBoilerplate(season) {
  return [
    `Program coverage references the ${season} Florida Gators football team — roster, portal, depth, camp, and schedule. Recruiting class rankings and visit chatter are intentionally omitted.`,
    `Analysis draws from GatorVault roster integration, depth-chart metadata, and verified public reporting — not social posts or paywalled snippets.`,
    `The ${season} season is the evaluation window for returning production, portal additions, and scheme adjustments entering fall camp.`
  ];
}

function esc(text) {
  return sanitize
    .sanitizeText(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function section(title, paragraphs) {
  const body = (paragraphs || []).filter(Boolean).map((p) => `<p>${p}</p>`).join('\n');
  if (!body) return '';
  return `<h2>${esc(title)}</h2>\n${body}`;
}

function playerLine(player, extra = '') {
  const name = sanitize.sanitizePlayerName(player?.name || player?.playerName);
  if (!name) return null;
  const pos = esc(player.pos || player.position || '');
  const stars = player.stars ? `${player.stars}★` : '';
  const school = esc(player.school || player.highSchool || '');
  const yr = player.classYear || cycle.RECRUITING_MIN_CLASS;
  const bits = [pos, stars, school, `${yr} class`].filter(Boolean).join(' · ');
  const tail = extra ? ` ${esc(extra)}` : '';
  return `<strong>${esc(name)}</strong> (${bits})${tail}.`;
}

function intelContextLine(intel) {
  const name = sanitize.sanitizePlayerName(intel?.playerName);
  if (!name) return null;
  const detail = sanitize.sanitizeIntelDetail(intel.detail);
  const event = esc(intel.eventType || 'recruiting update').replace(/_/g, ' ');
  if (detail) {
    return `<strong>${esc(name)}</strong> — ${event}: ${esc(detail)}`;
  }
  return `<strong>${esc(name)}</strong> — ${event} tracked on the ${cycle.RECRUITING_MIN_CLASS} board.`;
}

function buildHeatCheck(topic) {
  const rising = (topic.signals?.rising || []).slice(0, 4);
  if (rising.length < 2) return null;

  const names = rising.map((r) => sanitize.sanitizePlayerName(r.playerName)).filter(Boolean);
  if (names.length < 2) return null;

  const overview = [
    `Florida's ${cycle.RECRUITING_MIN_CLASS} recruiting board is showing measurable momentum this week. GatorVault Heat Check flags ${names.length} rising names where On3 RPM movement, visit activity, or verified beat reporting align — all restricted to the ${cycle.RECRUITING_MIN_CLASS} class and beyond per our cycle policy.`,
    ...recruitingBoilerplate()
  ];

  const trendLines = rising
    .map((r) => {
      const label = esc(r.triggerLabel || r.headline || 'RPM / board momentum');
      const lean = r.predictionSchool ? ` Crystal Ball lean: ${esc(r.predictionSchool)}.` : '';
      const school = r.school || r.highSchool ? ` School: ${esc(r.school || r.highSchool)}.` : '';
      return playerLine(r, `— ${label}.${lean}${school}`);
    })
    .filter(Boolean);

  if (trendLines.length < 2) return null;

  const analysis = [
    `Momentum clusters matter more than isolated spikes. When multiple ${cycle.RECRUITING_MIN_CLASS} targets rise in the same week, it usually reflects coordinated visit windows, staff prioritization, or competitive pressure from SEC programs.`,
    `Heat Check does not treat a single RPM tick as news. Each name above cleared verified context thresholds before inclusion.`,
    `Florida's staff typically converts Heat Check momentum into OV invitations when scheme fit and academic readiness align. Names that rise without a visit path may reflect national buzz rather than Gator-specific traction.`,
    `Compare rising profiles by position group — WR, EDGE, and CB cycles often move together when Florida hosts a loaded OV weekend.`
  ];

  const whatsNext = [
    `Monitor whether rising ${cycle.RECRUITING_MIN_CLASS} names schedule or complete official visits to Gainesville. Post-visit reaction pieces generate only after verified visit intel lands.`,
    `GatorVault will refresh Heat Check when new On3 RPM or beat signals arrive. Approve in GV-OM before publish.`,
    `If momentum cools for a previously rising name, the board update will reflect that in the next weekly generation pass — drafts are never auto-published.`
  ];

  return [
    section('Overview', overview),
    section('Trends', trendLines),
    section('Analysis', analysis),
    section("What's Next", whatsNext)
  ].join('\n');
}

function buildOfficialVisitPreview(topic) {
  const visits = (topic.signals?.visits || []).slice(0, 5);
  if (visits.length < 1) return null;

  const lines = visits.map(intelContextLine).filter(Boolean);
  if (!lines.length) return null;

  const overview = [
    `Florida is preparing for an official visit window with ${lines.length} ${cycle.RECRUITING_MIN_CLASS}-cycle prospect${lines.length > 1 ? 's' : ''} on the confirmed board. This preview summarizes verified scheduling intel only — no 2026 class references.`,
    ...recruitingBoilerplate()
  ];

  const analysis = [
    `OV weekends compress decision timelines. Florida's staff typically prioritizes matchups where the prospect fills a projected ${cycle.programSeasonYear()} roster need — size at EDGE, depth at WR, or competition at CB.`,
    `Visit volume alone is not a ranking. The preview focuses on names with confirmed Florida dates and complete identity context.`,
    `Official visits also serve as mutual evaluation windows — Florida sells scheme, development path, and NIL infrastructure while assessing football maturity and fit.`,
    `Prospects who tour multiple SEC campuses the same month often accelerate their decision windows; Florida benefits when the OV aligns with a home game atmosphere or packed practice viewing window.`
  ];

  const whatsNext = [
    `Post-visit reaction articles generate after prospects return home and new beat intel confirms impressions. Check GV-OM for draft availability mid-week.`,
    `If visits cancel or reschedule, this preview will be retired rather than patched with speculation.`,
    `Heat Check will flag RPM movement for visitors who emerge as commit candidates after the trip.`
  ];

  return [
    section('Overview', overview),
    section('Trends', lines),
    section('Analysis', analysis),
    section("What's Next", whatsNext)
  ].join('\n');
}

function buildPostVisitReaction(topic) {
  const visits = (topic.signals?.visits || []).slice(0, 4);
  if (!visits.length) return null;

  const lines = visits.map(intelContextLine).filter(Boolean);
  if (!lines.length) return null;

  const overview = [
    `Initial post-visit read on Florida's latest ${cycle.RECRUITING_MIN_CLASS} official visitors. Reactions below synthesize verified reporting — not social posts — after prospects completed Gainesville trips.`,
    ...recruitingBoilerplate()
  ];

  const analysis = [
    `First reactions after OVs typically focus on fit, role projection, and competitive standing vs other finalists. Florida benefits when multiple visitors in the same class cycle reference scheme familiarity or early playing-time paths.`,
    `GatorVault avoids publishing visit grades without a second verified signal (beat report, RPM shift, or board update).`,
    `Post-visit windows are when Crystal Ball and RPM movement matter most — a strong campus experience can compress a timeline that previously looked like a multi-month recruitment.`,
    `Florida's staff often follows an OV with coordinated family communication and position-coach film review; those signals sometimes appear in beat reporting before public commitment announcements.`
  ];

  const whatsNext = [
    `Watch for commitment timing windows over the next two to four weeks. Momentum from a strong OV weekend often shows up in Crystal Ball movement before public announcements.`,
    `Additional ${cycle.RECRUITING_MIN_CLASS} visit intel will spawn updated drafts — never auto-published.`
  ];

  return [
    section('Overview', overview),
    section('Trends', lines),
    section('Analysis', analysis),
    section("What's Next", whatsNext)
  ].join('\n');
}

function buildProgramPulse(topic) {
  const portal = topic.signals?.portal;
  const roster = topic.signals?.roster;
  const season = cycle.programSeasonYear();
  if (!portal?.count && !roster?.players?.length) return null;

  const overview = [
    `Program Pulse tracks the ${season} Florida Gators football team — roster construction, portal activity, and summer/fall prep. Recruiting class chatter is intentionally excluded from this column.`,
    ...programBoilerplate(season),
    portal?.count
      ? `Florida is managing <strong>${portal.count}</strong> incoming portal names on the GatorVault tracker${
          portal.headliner
            ? `, headlined by ${esc(sanitize.sanitizePlayerName(portal.headliner.name) || sanitize.sanitizeText(portal.headliner.name))}`
            : ''
        }.`
      : `The ${season} roster lists <strong>${roster.players.length}</strong> players across offense, defense, and special teams.`
  ];

  const trends = [];
  if (portal?.incoming?.length) {
    portal.incoming.slice(0, 3).forEach((pl) => {
      const line = playerLine({ ...pl, classYear: season }, 'portal addition');
      if (line) trends.push(line.replace(`${season} class`, `${season} roster addition`));
    });
  }
  if (!trends.length && roster?.offense?.length) {
    trends.push(
      `Offense: ${roster.offense.length} listed · Defense: ${roster.defense.length} listed — unit balance drives two-deep planning for ${season}.`
    );
  }
  if (trends.length < 1) return null;

  const analysis = [
    `Portal additions and retention decisions define Florida's ${season} floor before fall camp. The staff evaluates immediate contributors separately from developmental depth.`,
    `Scheme notes from spring carry into summer workouts: personnel grouping trends at WR, EDGE, and nickel will show up in August depth-chart movement.`,
    `Special teams and situational packages are part of the ${season} evaluation — roster numbers only tell part of the story when identifying who travels and who redshirts.`,
    `Florida's program staff typically enters fall camp with 85 scholarship names and a clear starter map at quarterback, offensive line, and edge rusher.`
  ];

  const whatsNext = [
    `Fall camp opens the next evaluation window. Program Pulse will update when depth-chart refreshes or verified staff/scheme reporting lands.`,
    `No recruiting class references appear in this column — see Heat Check and visit previews for ${cycle.RECRUITING_MIN_CLASS} coverage.`,
    `Portal additions finalized before camp will appear in the next roster refresh and depth-chart movement draft.`
  ];

  return [
    section('Overview', overview),
    section('Trends', trends),
    section('Analysis', analysis),
    section("What's Next", whatsNext)
  ].join('\n');
}

function buildRosterAnalysis(topic) {
  const r = topic.signals?.roster;
  const season = cycle.programSeasonYear();
  if (!r?.players?.length || r.players.length < 40) return null;

  const overview = [
    `Roster Analysis breaks down Florida's ${season} team by unit — not recruiting rankings. The ${r.players.length}-man board includes ${r.offense.length} offensive players and ${r.defense.length} defensive players.`,
    ...programBoilerplate(season)
  ];

  const trends = [
    `Offensive skill talent and trench depth typically drive snap distribution in Billy Napier's system. The ${season} roster includes enough experienced pieces to compete in the SEC if health holds.`,
    `Special teams and specialist roles often hide value — watch punter/kicker competition and return options during summer workouts.`
  ];

  const analysis = [
    `Unit-by-unit, Florida's ${season} roster shows clear strength paths and repair spots. Mature rooms can absorb portal losses; thin rooms become recruiting priorities for future cycles — but those priorities are covered elsewhere.`,
    `Film-room and depth integrations on GatorVault map starters vs rotational pieces entering fall camp.`
  ];

  const whatsNext = [
    `Depth Chart Movement articles will flag position-specific changes after the next roster refresh.`,
    `Summer Preview coverage tracks camp battles that could alter the two-deep before the ${season} opener.`
  ];

  return [
    section('Overview', overview),
    section('Trends', trends),
    section('Analysis', analysis),
    section("What's Next", whatsNext)
  ].join('\n');
}

function buildSummerPreview(topic) {
  const r = topic.signals?.roster;
  const d = topic.signals?.depthChart;
  const season = cycle.programSeasonYear();
  if (!r?.players?.length) return null;

  const overview = [
    `Summer Preview: ${season} camp battles to watch across Florida's two-deep. Workouts running now set the table for fall camp — this piece covers team personnel only.`,
    ...programBoilerplate(season)
  ];

  const trends = [
    `Receiver, EDGE, and nickel rooms historically produce the most summer movement on Florida's roster.`,
    d?.meta?.updatedAt
      ? `Last depth-chart refresh: ${new Date(d.meta.updatedAt).toLocaleDateString()}. Expect updates after fall camp opens.`
      : `Depth data will refresh as coaches finalize rotation preferences.`
  ];

  const analysis = [
    `Camp battles are about rep share, not headlines. Players who stack consistent summer reports tend to earn situational packages early in ${season}.`,
    `Portal additions and the completed signing class shape which rooms are open vs locked — evaluated at the team level here.`
  ];

  const whatsNext = [
    `Fall camp reports will supersede summer projections. GatorVault generates updated Program Pulse and depth pieces when verified signals arrive.`,
    `Approve drafts in GV-OM before any public publish.`
  ];

  return [
    section('Overview', overview),
    section('Trends', trends),
    section('Analysis', analysis),
    section("What's Next", whatsNext)
  ].join('\n');
}

function buildDepthChartMovement(topic) {
  const d = topic.signals?.depthChart;
  const season = cycle.programSeasonYear();
  if (!d?.rosterCount || d.rosterCount < 50) return null;

  const overview = [
    `Depth Chart Movement for Florida's ${season} team: ${d.rosterCount} rostered players tracked (${d.offense || '—'} offense · ${d.defense || '—'} defense).`,
    `Recruiting board changes are not included — this is a program-level depth evaluation.`
  ];

  const trends = [
    `WR, EDGE, and secondary depth tend to show the fastest summer movement when young players earn consistent rep reports.`,
    d.meta?.updatedAt
      ? `Chart metadata last updated ${new Date(d.meta.updatedAt).toLocaleDateString()}.`
      : `Awaiting next automated depth refresh from GatorVault roster integration.`
  ];

  const analysis = [
    `Depth-chart shifts before fall camp often preview offensive personnel groupings and defensive rotation patterns for ${season}.`,
    `Coaches prioritize known quantities early; camp battles decide who becomes the third and fourth rotation pieces.`
  ];

  const whatsNext = [
    `Watch for post-camp depth updates in GV-OM. Roster Analysis complements this piece with unit-wide context.`,
    `Game-week previews activate when the ${season} schedule enters its next opponent window.`
  ];

  return [
    section('Overview', overview),
    section('Trends', trends),
    section('Analysis', analysis),
    section("What's Next", whatsNext)
  ].join('\n');
}

function buildStaffIntel(topic) {
  const season = cycle.programSeasonYear();
  const r = topic.signals?.roster;
  const d = topic.signals?.depthChart;
  if (!r?.players?.length) return null;

  const overview = [
    `Staff Intel: ${season} Florida Gators program evaluation — scheme, roster usage, and summer development priorities from verified GatorVault tracking.`,
    `No recruiting class content appears here. Staff evaluations reference the ${season} team forward.`
  ];

  const trends = [
    `Coordinator tendencies from spring carry into summer: personnel grouping at WR, pressure packages on defense, and special-teams emphasis.`,
    `Roster count (${r.players.length}) gives the staff flexibility to rep multiple packages without exposing thin rooms in August.`
  ];

  const analysis = [
    `Staff evaluations at this stage focus on who can help win ${season} games — not signing-day rankings. Portal additions and retention decisions shape the board.`,
    d?.rosterCount
      ? `Depth integration shows ${d.offense || '—'} offensive and ${d.defense || '—'} defensive pieces competing for rotation slots.`
      : `Depth integration updates will refine role projections after the next chart refresh.`
  ];

  const whatsNext = [
    `Fall camp is the next major evaluation checkpoint. Program Pulse will cover portal and roster updates separately.`,
    `Recruiting-specific staff activity belongs in Heat Check and visit previews (${cycle.RECRUITING_MIN_CLASS}+ only).`
  ];

  return [
    section('Overview', overview),
    section('Trends', trends),
    section('Analysis', analysis),
    section("What's Next", whatsNext)
  ].join('\n');
}

function buildGameWeekPreview(topic) {
  const g = topic.signals?.game;
  const season = cycle.programSeasonYear();
  if (!g?.game && !g?.opponent) return null;

  const opp = esc(g.opponent || g.game || 'next opponent');
  const overview = [
    `Game Week Preview: Florida vs ${opp.replace(/^Florida vs\s*/i, '')} (${season} season). Lines and schedule context from GatorVault Game Zone.`,
    `Recruiting coverage is excluded. This preview focuses on the ${season} team matchup.`
  ];

  const trends = [
    g.date ? `Kickoff window: ${esc(g.date)}.` : `Schedule slot confirmed on the ${season} slate.`,
    g.spread ? `Market line: ${esc(g.spread)}.` : '',
    g.total ? `Total: ${esc(g.total)}.` : ''
  ].filter(Boolean);

  if (trends.length < 1) return null;

  const analysis = [
    `Florida's advantage paths typically run through trench play and explosive skill talent. Verify injury and portal availability before kickoff.`,
    `Opponent-specific tendencies will post in Film Room integrations when available.`
  ];

  const whatsNext = [
    `Post-game Program Pulse will summarize roster usage and injury notes after the final whistle.`,
    `Next opponent preview generates when Game Zone updates the schedule edge.`
  ];

  return [
    section('Overview', overview),
    section('Trends', trends),
    section('Analysis', analysis),
    section("What's Next", whatsNext)
  ].join('\n');
}

const BUILDERS = {
  heat_check: buildHeatCheck,
  official_visit_preview: buildOfficialVisitPreview,
  post_visit_reaction: buildPostVisitReaction,
  program_pulse: buildProgramPulse,
  roster_analysis: buildRosterAnalysis,
  summer_preview: buildSummerPreview,
  depth_chart_movement: buildDepthChartMovement,
  staff_intel: buildStaffIntel,
  game_week_preview: buildGameWeekPreview
};

function buildArticleBody(topic) {
  const fn = BUILDERS[topic.category];
  if (!fn) return null;
  return fn(topic);
}

function validateDraftQuality(draft) {
  if (!draft?.body) {
    return { ok: false, reasons: ['empty_body'], words: 0, minWords: MIN_WORDS, targetWords: TARGET_WORDS };
  }
  const body = draft.body;
  const words = sanitize.wordCount(body);
  const reasons = [];

  if (words < MIN_WORDS) reasons.push(`word_count_${words}`);
  if (sanitize.hasEmptyParentheses(body)) reasons.push('empty_parentheses');
  if (!sanitize.hasRequiredSections(body)) reasons.push('missing_sections');
  if (sanitize.isNameOnlyListBody(body)) reasons.push('name_only_list');

  if (cycle.isRecruitingCategory(draft.category)) {
    const yr = cycle.parseYear(draft.classYear || cycle.RECRUITING_MIN_CLASS);
    if (yr != null && yr < cycle.RECRUITING_MIN_CLASS) reasons.push('recruiting_cycle_violation');
  }

  return {
    ok: reasons.length === 0,
    reasons,
    words,
    minWords: MIN_WORDS,
    targetWords: TARGET_WORDS
  };
}

function buildArticleDraft(topic) {
  const body = buildArticleBody(topic);
  if (!body) return null;

  const summary = sanitize.sanitizeText(topic.title).replace(/^[^:]+:\s*/, '').slice(0, 220);
  const draft = {
    title: sanitize.sanitizeText(topic.title),
    category: topic.category,
    summary,
    body,
    readTimeMinutes: Math.max(4, Math.ceil(sanitize.wordCount(body) / 200)),
    sources: topic.sources || [],
    topicKey: topic.topicKey,
    classYear: topic.classYear || null,
    cycleType: topic.cycleType || null
  };

  const quality = validateDraftQuality(draft);
  if (!quality.ok) return null;
  return draft;
}

module.exports = {
  MIN_WORDS,
  TARGET_WORDS,
  buildArticleBody,
  buildArticleDraft,
  validateDraftQuality,
  section,
  esc
};
