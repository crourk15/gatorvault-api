/**
 * Structured elite synthesis from multi-source insider context (no LLM).
 */
function esc(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function section(title, paragraphs) {
  const body = (paragraphs || []).filter(Boolean).map((p) => `<p>${p}</p>`).join('\n');
  if (!body) return '';
  return `<h2>${esc(title)}</h2>\n${body}`;
}

function expandParagraphs(base, extras) {
  return [...base, ...(extras || [])].filter(Boolean);
}

function plainText(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function formatTargetNames(targets, { html } = { html: false }) {
  return (targets || [])
    .slice(0, 3)
    .map((p) => {
      const name = String(p.name || '').trim();
      const pos = String(p.pos || '').trim();
      if (!name) return '';
      if (html) return `<strong>${esc(name)}</strong>${pos ? ` (${esc(pos)})` : ''}`;
      return pos ? `${name} (${pos})` : name;
    })
    .filter(Boolean)
    .join(', ');
}

function buildPunchyAngles({ portal, board, intel, scheme, heatCount }) {
  const htmlNames = formatTargetNames(board.topTargets, { html: true });
  const plainNames = formatTargetNames(board.topTargets, { html: false });
  const bodyAngles = [];
  const takeaways = [];

  if (portal.incomingCount) {
    const t = `Portal math: ${portal.incomingCount} incoming transfers already reshaped which high school battles are must-close vs wait-and-see.`;
    bodyAngles.push(t);
    takeaways.push(t);
  }
  if (board.topTargets?.length) {
    const tHtml = `Board focus: ${board.targetCount || board.topTargets.length} live ${board.classYear || ''} targets — priority names: ${htmlNames}.`;
    const tPlain = `Board focus: ${board.targetCount || board.topTargets.length} live ${board.classYear || ''} targets — priority names: ${plainNames}.`;
    bodyAngles.push(tHtml);
    takeaways.push(tPlain);
  }
  if (intel.upcomingVisits?.length) {
    const t = `Visit window: ${intel.upcomingVisits.length} upcoming visits can reorder closing priority before fall camp.`;
    bodyAngles.push(t);
    takeaways.push(t);
  } else if (intel.recentIntel?.length) {
    const t = `Intel desk: ${intel.recentIntel.length} verified signals in the latest window — use them to weight battles, not rumor.`;
    bodyAngles.push(t);
    takeaways.push(t);
  }
  if (heatCount) {
    const t = `Heat check: ${heatCount} rising names on the desk; momentum can flip closing order week to week.`;
    bodyAngles.push(t);
    takeaways.push(t);
  }
  if (bodyAngles.length < 3) {
    const t = `Scheme fit: ${scheme.dcScheme || '3-3-5 hybrid'} install puts JACK/STAR and trench depth under the brightest fall-camp spotlight.`;
    bodyAngles.push(t);
    takeaways.push(t);
  }
  while (bodyAngles.length < 3) {
    const t = 'Fall camp rep winners — not spring pedigree — will decide the real two-deep.';
    bodyAngles.push(t);
    takeaways.push(t);
  }
  return {
    bodyAngles: bodyAngles.slice(0, 4),
    takeaways: takeaways.slice(0, 4).map(plainText),
  };
}



function synthesizeRecruitingBattleFromContext({ title, angleKey, context, articleType }) {
  const season = context.season;
  const roster = context.rosterContext || {};
  const portal = context.portalContext || {};
  const board = context.recruitingContext?.board || {};
  const analytics = context.analyticsContext || {};
  const scheme = context.schemeContext || {};
  const intel = context.intelContext || {};
  const htmlNames = formatTargetNames(board.topTargets, { html: true });
  const plainNames = formatTargetNames(board.topTargets, { html: false });
  const { bodyAngles, takeaways } = buildPunchyAngles({
    portal,
    board,
    intel,
    scheme,
    heatCount: context.heatCheck?.length || 0,
  });

  const lede = htmlNames
    ? `Florida's ${board.classYear || '2027'} board still turns on a short list — ${htmlNames} — and the closing window is already compressing.`
    : `Florida's ${board.classYear || '2027'} closing window will define the ${season} roster ceiling more than any single spring evaluation.`;
  const stakes = `Thesis: win the tier-one battles with real visit/RPM edges, or watch portal math force UF into reactive board decisions by August.`;

  const body = [
    section('Thesis', [lede, stakes]),
    section('Insider Angles', bodyAngles),
    section('Scheme Implications', [
      `The ${scheme.dcScheme || '3-3-5 hybrid'} install tells you which positions are actually stress-tested in camp — JACK, STAR, and trench depth first.`,
      htmlNames
        ? `Closing ${htmlNames} changes how Florida deploys hybrid defenders and how the offense protects a rebuilt OL.`
        : `Personnel fit at JACK, STAR, and WR decides how quickly portal pieces can play winning snaps in September.`,
    ]),
    section('Roster Impact', [
      `${roster.unitSnapshot?.total || 0} scholarship names tracked (${roster.offenseCount || 0} offense / ${roster.defenseCount || 0} defense).`,
      portal.incomingCount
        ? `${portal.incomingCount} portal additions already reset snap expectations — high school closes only matter where rooms are still thin.`
        : `Returning production sets the floor; camp battles decide who actually travels.`,
    ]),
    section('Recruiting and Portal Impact', [
      `${board.ufCommitCount || 0} UF commits with ${board.targetCount || 0} live targets on the board.`,
      `Battle cards in this piece lean on competitor splits, visit signals, and staff notes — board movement without intel is noise.`,
    ]),
    section('Analytics and Data', [
      analytics.nextGame
        ? `Next opponent ${esc(analytics.nextGame.opponent || 'TBD')}${analytics.nextGame.ufPct != null ? ` — model win probability ${analytics.nextGame.ufPct}%` : ''}.`
        : `Schedule strength and returning production set the baseline before roster adjustments.`,
    ]),
    section("What's Next", [
      plainNames
        ? `Watch visit logs on ${plainNames} before fall camp — those weekends reorder closing priority.`
        : `Watch which priority targets log official visits before fall camp — those weekends reorder closing priority.`,
      `Florida ${season} ceiling: close the board with verified edges, then let camp reps settle the two-deep.`,
    ]),
  ]
    .filter(Boolean)
    .join('\n');

  return {
    body,
    title,
    articleType: articleType || 'Heat Check',
    angleKey,
    thesis: plainText(`${lede} ${stakes}`),
    summary: plainText(`${lede} ${stakes}`).slice(0, 220),
    insiderAngles: takeaways,
    sourcesUsed: [],
  };
}

function synthesizeEliteFromContext({ articleType, title, angleKey, context }) {
  const { isRecruitingBattleArticleType } = require('./insider-articles-types');
  if (isRecruitingBattleArticleType(articleType)) {
    return synthesizeRecruitingBattleFromContext({ title, angleKey, context, articleType });
  }
  const season = context.season;
  const roster = context.rosterContext || {};
  const portal = context.portalContext || {};
  const board = context.recruitingContext?.board || {};
  const analytics = context.analyticsContext || {};
  const scheme = context.schemeContext || {};
  const intel = context.intelContext || {};
  const htmlNames = formatTargetNames(board.topTargets, { html: true });
  const plainNames = formatTargetNames(board.topTargets, { html: false });
  const schemeName = scheme.dcScheme || '3-3-5 hybrid';
  const { bodyAngles, takeaways } = buildPunchyAngles({
    portal,
    board,
    intel,
    scheme,
    heatCount: context.heatCheck?.length || 0,
  });

  // One claim up front — no "Title — Type analysis" boilerplate.
  const claimByType = {
    'Film Room': `Florida's ${schemeName} only travels if JACK/STAR and the trenches win August reps — pedigree on paper will not cover a late install.`,
    Analytics: `The ${season} projection is roster math, not vibe: portal net value plus returning production decide whether Florida survives the SEC back half.`,
    'Roster Analysis': `Depth chart truth for ${season} will come from camp winners, not spring rankings — especially in thin OL and secondary rooms.`,
    'Program Pulse': `Florida is running roster churn, scheme install, and board closes on the same clock — miss one, and September gets expensive.`,
  };
  const lede =
    claimByType[articleType] ||
    `Florida's ${season} ceiling rises or falls on one install question: can the ${schemeName} gel before SEC weeks punish thin depth?`;
  const stakes = plainNames
    ? `Meanwhile the board still hinges on ${htmlNames} — close those lanes or portal math keeps forcing reactive decisions.`
    : `Portal churn and board closes are not separate stories — filled rooms free staff to hunt remaining tier-one targets.`;

  const body = [
    section('Thesis', [lede, stakes]),
    section('Insider Angles', bodyAngles),
    section('Scheme Implications', [
      `The ${schemeName} asks three down linemen to eat doubles so hybrid defenders can play with leverage in space.`,
      `JACK and STAR are the stress points against spread sets — cover-and-rush bodies win the install; substitution delays lose it.`,
      `Offensively, protect the rebuilt OL with quick-game, play-action, and tempo until the trenches stabilize.`,
      `Special teams and tempo only amplify that edge when the install is on schedule — lag shows up as explosives allowed, not as a December problem.`,
    ]),
    section('Roster Impact', [
      `${roster.unitSnapshot?.total || 0} scholarship names tracked (${roster.offenseCount || 0} offense / ${roster.defenseCount || 0} defense)${
        roster.unitSnapshot?.top?.length
          ? ` — heaviest rooms: ${roster.unitSnapshot.top
              .slice(0, 4)
              .map(([g, n]) => `${g} (${n})`)
              .join(', ')}`
          : ''
      }.`,
      portal.incomingCount
        ? `${portal.incomingCount} portal additions must acclimate fast — SEC weeks one through four punish slow integrations in the trenches and secondary.`
        : `Thin rooms and travel-list battles will sort the real two-deep faster than spring paper depth. Leadership after portal churn decides whether new faces raise the room or stall it.`,
    ]),
    section('Recruiting and Portal Impact', [
      `${board.ufCommitCount || 0} UF commits with ${board.targetCount || 0} live ${board.classYear || ''} targets still on the board.`,
      htmlNames
        ? `Staff visits and OVs on ${htmlNames} are the week-to-week tells — competitor RPM without visit proof is just noise.`
        : `Staff visits compress into a narrow window; board movement without validated intel should be ignored.`,
    ]),
    section('Analytics and Data', [
      analytics.nextGame
        ? `Next opponent ${esc(analytics.nextGame.opponent || 'TBD')}${analytics.nextGame.ufPct != null ? ` — model win probability ${analytics.nextGame.ufPct}%` : ''}.`
        : `Opponent strength and returning starters set the floor before portal net value adjusts the ceiling.`,
      `Heat desk: ${context.heatCheck?.length || 0} rising prospects flagged this cycle — use that for closing urgency, not filler.`,
    ]),
    section("What's Next", [
      `Watch JACK/STAR and OL rep winners after the first fall scrimmage — that is the install report card.`,
      plainNames
        ? `Watch visit-weekend movement on ${plainNames} before kickoff.`
        : `Watch visit-weekend board shifts and commit windows before kickoff.`,
      `If the August install slips, explosive plays allowed and thin depth will show up by mid-October — not in December.`,
    ]),
  ].join('\n');

  return {
    articleType,
    thesis: plainText(`${lede} ${stakes}`),
    title,
    summary: plainText(`${lede} ${stakes}`).slice(0, 220),
    body,
    insiderAngles: takeaways,
    angleKey,
    sourcesUsed: [],
  };
}

const cycle = require('./insider-articles-cycle');
const templates = require('./insider-articles-templates');
const sanitize = require('./insider-articles-sanitize');
const store = require('./insider-articles-store');
const { extractArticleMetadata } = require('./insider-articles-metadata');

const { articleTypeForCategory } = require('./insider-articles-types');

const ANGLES_BY_TYPE = {
  'Program Pulse': [
    { key: 'macro_health', titleTemplate: 'Program Pulse: {season} Florida roster architecture and culture check' },
    { key: 'portal_math', titleTemplate: 'Portal Math: How Florida rebuilt the {season} roster position by position' },
    { key: 'culture_churn', titleTemplate: 'Culture vs. Churn: Managing portal exits without losing the locker room' },
    { key: 'scheme_identity', titleTemplate: 'Scheme Identity: Why Florida {season} defense is built around the JACK' },
    { key: 'momentum', titleTemplate: 'Program Pulse: Recruiting momentum and roster health entering fall camp' },
  ],
  'Heat Check': [
    { key: 'board_battle', titleTemplate: 'Heat Check: {focus} - commit likelihoods and competing schools' },
    { key: 'rpm_edge', titleTemplate: 'Heat Check: On3 RPM edges and Florida path with {focus}' },
    { key: 'target_tiers', titleTemplate: 'Heat Check: Tier-one targets and Florida closing window' },
    { key: 'momentum_pulse', titleTemplate: 'Heat Check: Rising momentum and board pressure on {focus}' },
    { key: 'competitor_split', titleTemplate: 'Heat Check: Competitor splits and Florida path with {focus}' },
  ],
  'OV Preview': [
    { key: 'ov_intel', titleTemplate: 'OV Preview: Official visit intel and board movement for {focus}' },
    { key: 'visit_setup', titleTemplate: 'OV Preview: What Florida must prove to {focus} on campus' },
    { key: 'closing_window', titleTemplate: 'OV Preview: Closing window and staff plan for {focus}' },
    { key: 'competitor_ov', titleTemplate: 'OV Preview: Competing OV weekends and Florida edge with {focus}' },
    { key: 'board_impact', titleTemplate: 'OV Preview: How an OV with {focus} reshapes the board' },
  ],
  'Post-Visit': [
    { key: 'visit_reaction', titleTemplate: 'Post-Visit: What {focus} means for UF after the visit' },
    { key: 'momentum_shift', titleTemplate: 'Post-Visit: Momentum shift and next steps with {focus}' },
    { key: 'staff_read', titleTemplate: 'Post-Visit: Staff read on {focus} and closing timeline' },
    { key: 'competitor_response', titleTemplate: 'Post-Visit: Competitor response after {focus} left campus' },
    { key: 'board_reorder', titleTemplate: 'Post-Visit: Board reorder after {focus} visit weekend' },
  ],
  'Film Room': [
    { key: 'scheme_breakdown', titleTemplate: 'Film Room: 3-3-5 install - personnel fits and stress points' },
    { key: 'position_group', titleTemplate: 'Film Room: {focus} group analysis - who wins reps in fall camp' },
    { key: 'player_mechanics', titleTemplate: 'Film Room: Player mechanics and rep winners at {focus}' },
    { key: 'coverage_shells', titleTemplate: 'Film Room: Coverage shells and stress points on film' },
    { key: 'run_game', titleTemplate: 'Film Room: Run game fits and OL movement' },
    { key: 'pass_rush', titleTemplate: 'Film Room: Pass rush paths and JACK usage' },
  ],
  Analytics: [
    { key: 'win_model', titleTemplate: 'Analytics: {season} schedule win probability model' },
    { key: 'returning_prod', titleTemplate: 'Analytics: Returning production and roster math for {season}' },
  ],
  'Roster Analysis': [
    { key: 'depth_two_deep', titleTemplate: 'Roster Analysis: {season} two-deep updates and unit strength' },
    { key: 'portal_impact', titleTemplate: 'Roster Analysis: Portal additions and depth chart movement' },
    { key: 'thin_spots', titleTemplate: 'Roster Analysis: Florida thinnest rooms and repair paths' },
  ],
  'Game Week': [
    { key: 'opponent_scout', titleTemplate: 'Game Week: Florida vs {focus} - scouting report and keys' },
    { key: 'matchup_analytics', titleTemplate: 'Game Week: Matchup analytics - Florida vs {focus}' },
    { key: 'scheme_tendencies', titleTemplate: 'Game Week: Scheme tendencies and coverage shells vs {focus}' },
    { key: 'pressure_points', titleTemplate: 'Game Week: Pressure points and explosive play threats vs {focus}' },
    { key: 'red_zone', titleTemplate: 'Game Week: Red zone tendencies and keys vs {focus}' },
    { key: 'personnel', titleTemplate: 'Game Week: Personnel groupings and matchup edges vs {focus}' },
    { key: 'trench_battle', titleTemplate: 'Game Week: OL/DL trench battle preview vs {focus}' },
    { key: 'qb_tendencies', titleTemplate: 'Game Week: QB tendencies and coverage shells vs {focus}' },
    { key: 'keys_to_game', titleTemplate: 'Game Week: Keys to the game vs {focus}' },
    { key: 'camp_battles', titleTemplate: 'Game Week: Summer camp preview - position battles for the opener' },
  ],
  Insider: [
    { key: 'staff_decisions', titleTemplate: 'Insider: Staff decisions shaping Florida {season} identity' },
    { key: 'locker_room', titleTemplate: 'Insider: Locker room intel and leadership structure' },
    { key: 'scheme_install', titleTemplate: 'Insider: Defensive scheme install ahead of schedule' },
  ],
};

function typeForCategory(category) {
  return articleTypeForCategory(category);
}

function focusFromTopic(topic, context) {
  if (topic?.signals?.visits?.length) {
    return topic.signals.visits[0]?.playerName || topic.signals.visits[0]?.name || 'top target';
  }
  if (topic?.signals?.rising?.length) {
    return topic.signals.rising[0]?.name || 'rising prospect';
  }
  if (context?.opponentContext?.opponent) return context.opponentContext.opponent;
  if (context?.analyticsContext?.nextGame?.opponent) return context.analyticsContext.nextGame.opponent;
  return 'Florida';
}

function renderAngleTitle(template, topic, context) {
  const season = context?.season || new Date().getFullYear();
  const focus = focusFromTopic(topic, context);
  return template.replace(/\{season\}/g, String(season)).replace(/\{focus\}/g, focus);
}

function pickNextAngle(articleType, topic, context, usedKeys = []) {
  const pool = ANGLES_BY_TYPE[articleType] || ANGLES_BY_TYPE.Insider;
  const used = new Set(usedKeys || []);
  for (const angle of pool) {
    if (used.has(angle.key)) continue;
    return {
      key: angle.key,
      title: renderAngleTitle(angle.titleTemplate, topic, context),
      articleType,
    };
  }
  const fallback = pool[pool.length - 1];
  return {
    key: `${fallback.key}_${Date.now()}`,
    title: renderAngleTitle(fallback.titleTemplate, topic, context),
    articleType,
  };
}

function rosterUnitSnapshot(roster) {
  const groups = new Map();
  for (const p of roster?.players || []) {
    const g = String(p.pos || p.position || 'UNK').toUpperCase().slice(0, 3);
    groups.set(g, (groups.get(g) || 0) + 1);
  }
  return { top: [...groups.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8), total: roster?.players?.length || 0 };
}

function summarizeRecruitingBoard(recruiting) {
  const players = recruiting?.players || [];
  const targets = players.filter((p) => p.category === 'target' || p.status === 'target');
  const commits = players.filter((p) => p.committedTo);
  const ufCommits = commits.filter((p) => /florida|gators|\bUF\b/i.test(String(p.committedTo || '')));
  return {
    classYear: cycle.RECRUITING_MIN_CLASS,
    totalTracked: players.length,
    targetCount: targets.length,
    commitCount: commits.length,
    ufCommitCount: ufCommits.length,
    topTargets: targets.slice(0, 8).map((p) => ({
      slug: p.slug,
      name: p.name,
      pos: p.pos || p.position,
      stars: p.stars,
      ufProbability: p.ufProbability ?? p.ufRpmPct ?? null,
    })),
  };
}

async function buildInsiderContext(signals, topic = null) {
  const editorial = require('./insider-articles-editorial');
  const topicForCtx = topic || {
    category: 'program_pulse',
    classYear: cycle.RECRUITING_MIN_CLASS,
    signals: {},
  };
  const recruitingCtx = editorial.assembleRecruitingContext(topicForCtx, signals) || {};
  const programCtx = editorial.assembleProgramContext(topicForCtx, signals) || {};
  const roster = programCtx.roster || topicForCtx.signals?.roster || signals?.roster || {};
  const portalRaw = signals?.portal || programCtx.portal;
  const incoming = portalRaw?.incoming || portalRaw?.in || [];
  const gameZone = signals?.gameZone;
  const next = gameZone?.nextGame || null;
  return {
    collectedAt: signals?.collectedAt || new Date().toISOString(),
    season: cycle.programSeasonYear(),
    recruitingMinClass: cycle.RECRUITING_MIN_CLASS,
    rosterContext: {
      ...roster,
      unitSnapshot: rosterUnitSnapshot(roster),
      offenseCount: roster?.offense?.length || 0,
      defenseCount: roster?.defense?.length || 0,
    },
    portalContext: {
      incomingCount: portalRaw?.incomingCount ?? portalRaw?.count ?? incoming.length,
      incoming: incoming.slice(0, 10),
    },
    schemeContext: { depthChart: signals?.depthChart, dcScheme: '3-3-5 hybrid' },
    recruitingContext: { ...recruitingCtx, board: summarizeRecruitingBoard(signals?.recruiting) },
    analyticsContext: {
      nextGame: next ? { opponent: next.opponent || next.game, ufPct: next.ufPct ?? next.winProb } : null,
      scheduleLength: (gameZone?.schedule || []).length,
    },
    opponentContext: next ? { opponent: next.opponent || next.game } : null,
    intelContext: {
      upcomingVisits: (signals?.intel?.upcoming || []).slice(0, 8),
      recentIntel: (signals?.intel?.recent || signals?.intel?.all || []).slice(0, 10),
    },
    heatCheck: (signals?.heatCheck?.rising || signals?.heat?.rising || []).slice(0, 6),
    programFacts: programCtx.factCount || 0,
  };
}

function isLlmEnabled() {
  try {
    return require('./insider-articles-llm').isLlmEnabled();
  } catch {
    return false;
  }
}

async function generateWithLlm(args) {
  try {
    return require('./insider-articles-llm').generateWithLlm(args);
  } catch (err) {
    throw err;
  }
}

const MAX_GENERATION_ATTEMPTS = 3;

function slugFromTitle(title) {
  return String(title || 'article')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}


function sourcesFromContext(context, topic) {
  const out = [];
  const seen = new Set();
  const push = (name, outlet, url) => {
    const n = String(name || '').trim();
    const o = String(outlet || '').trim();
    if (!n && !o) return;
    // Drop useless self-label duplicates like GatorVault · GatorVault
    if (n.toLowerCase() === 'gatorvault' && o.toLowerCase() === 'gatorvault') return;
    const key = `${n}|\${o}|${url || ''}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ name: n || o, outlet: o && o.toLowerCase() !== n.toLowerCase() ? o : o || 'Public reporting', url: url || null });
  };

  for (const s of topic?.sources || []) {
    push(s.name || s.reporter, s.outlet || s.source || 'Beat report', s.url || s.href);
  }
  for (const row of context?.intelContext?.recentIntel || []) {
    if (row?.sourceHandle || row?.outlet) {
      push(row.sourceHandle || row.reporter || 'Beat', row.outlet || 'Public beat', row.url);
    }
  }
  if (context?.recruitingContext?.board?.totalTracked || context?.recruitingContext?.board?.targetCount) {
    push('UF recruiting board', 'GatorVault tracker');
  }
  if (context?.portalContext?.incomingCount) {
    push('Portal tracker', 'GatorVault tracker');
  }
  if (!out.length) {
    push('GatorVault Staff', 'Internal roster & board data');
  }
  return out.slice(0, 8);
}

async function produceDraftPayload({ articleType, title, angleKey, context, topic }) {
  if (isLlmEnabled()) {
    try {
      const llmDraft = await generateWithLlm({ articleType, title, angleKey, context, topic });
      if (llmDraft?.body) return { ...llmDraft, generationSource: 'llm' };
    } catch (err) {
      console.warn('[insider-generator] LLM failed, synthesis fallback:', err.message);
    }
  }
  const synth = synthesizeEliteFromContext({ articleType, title, angleKey, context, topic });
  return { ...synth, generationSource: 'synthesis' };
}

async function buildDraftRecord({ payload, topic, context, angleKey, articleType, signals }) {
  const scaffoldBody = payload.body;
  const { transformDraftForPublish } = require('./insider-articles-pipeline');
  let transformed;
  try {
    transformed = await transformDraftForPublish({
      scaffoldBody,
      articleType: payload.articleType || articleType,
      context,
      signals,
      season: context?.season,
    });
  } catch (err) {
    console.warn('[insider-generator] editorial transform failed:', err.message);
    return null;
  }
  const body = transformed.body;
  const words = transformed.words || sanitize.wordCount(body);
  const meta = extractArticleMetadata(context, topic, {
    articleType: payload.articleType || articleType,
    angleKey,
    topicKey: topic.topicKey,
  });
  return {
    title: sanitize.sanitizeText(payload.title || topic.title),
    slug: slugFromTitle(payload.title || topic.title),
    category: topic.category,
    articleType: payload.articleType || articleType,
    summary: sanitize.sanitizeText(payload.summary || payload.thesis || '').slice(0, 280),
    scaffoldBody,
    body,
    editorialHeaders: transformed.editorialHeaders,
    battles: transformed.battles || [],
    thesis: payload.thesis || '',
    insiderAngles: (payload.insiderAngles || []).map((a) => plainText(a)).filter(Boolean),
    readTimeMinutes: Math.max(5, Math.ceil(words / 200)),
    sources: sourcesFromContext(context, topic),
    topicKey: topic.topicKey,
    angleKey,
    generationSource: payload.generationSource || 'synthesis',
    rosterUnits: meta.rosterUnits,
    recruitingTargets: meta.recruitingTargets,
    schemeTags: meta.schemeTags,
    analyticsTags: meta.analyticsTags,
    classYear: topic.classYear || null,
    cycleType: topic.cycleType || null,
    triggerIntelFingerprints: topic.triggerIntelFingerprints || [],
    triggerIdentityLog: topic.triggerIdentityLog || [],
  };
}

async function generateEliteDraft(topic, signals, options = {}) {
  const usedAngles = options.usedAngles || [];
  const context = options.context || (await buildInsiderContext(signals, topic));
  const angle =
    options.angle ||
    pickNextAngle(typeForCategory(topic.category), topic, context, usedAngles);
  const topicWithTitle = { ...topic, title: angle.title };
  const payload = await produceDraftPayload({
    articleType: angle.articleType,
    title: angle.title,
    angleKey: angle.key,
    context,
    topic: topicWithTitle,
  });
  if (!payload?.body) return null;
  const draft = await buildDraftRecord({
    payload,
    topic: topicWithTitle,
    context,
    angleKey: angle.key,
    articleType: angle.articleType,
    signals,
  });
  return { draft, quality: templates.validateDraftQuality(draft), angle, context };
}

async function generateEliteDraftWithRetries(topic, signals) {
  const usedAngles = [];
  let lastResult = null;
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const context = await buildInsiderContext(signals, topic);
    const angle = pickNextAngle(typeForCategory(topic.category), topic, context, usedAngles);
    usedAngles.push(angle.key);
    const result = await generateEliteDraft(topic, signals, { context, angle, usedAngles: [...usedAngles] });
    lastResult = result;
    if (!result?.draft) continue;
    if (result.quality?.ok) return { ...result, attempts: attempt + 1, usedAngles };
    store.logEvent('draft_auto_rejected', {
      topicKey: topic.topicKey,
      angleKey: angle.key,
      title: result.draft.title,
      reasons: result.quality?.reasons,
      words: result.quality?.words,
    });
  }
  return lastResult ? { ...lastResult, attempts: MAX_GENERATION_ATTEMPTS, failed: true } : null;
}

async function regenerateAfterReject(rejectedDraft, signals) {
  if (!rejectedDraft?.topicKey) return null;
  const usedAngles = store.listUsedAnglesForTopic(rejectedDraft.topicKey);
  if (rejectedDraft.angleKey) usedAngles.push(rejectedDraft.angleKey);
  const topic = {
    topicKey: rejectedDraft.topicKey,
    category: rejectedDraft.category,
    classYear: rejectedDraft.classYear,
    cycleType: rejectedDraft.cycleType,
    title: rejectedDraft.title,
    signals: rejectedDraft.signals || {},
    sources: rejectedDraft.sources || [],
    triggerIntelFingerprints: rejectedDraft.triggerIntelFingerprints || [],
    triggerIdentityLog: rejectedDraft.triggerIdentityLog || [],
  };
  const context = await buildInsiderContext(signals, topic);
  const articleType = rejectedDraft.articleType || typeForCategory(topic.category);
  const angle = pickNextAngle(articleType, topic, context, usedAngles);
  const result = await generateEliteDraft(topic, signals, { context, angle, usedAngles });
  if (!result?.draft) return null;
  if (!result.quality?.ok) {
    store.addDraft({ ...result.draft, status: 'auto-rejected', qualityReasons: result.quality.reasons });
    return { ok: false, autoRejected: true, reasons: result.quality.reasons };
  }
  const saved = store.addDraft({ ...result.draft, status: 'draft' });
  store.logEvent('draft_regenerated', {
    fromArticleId: rejectedDraft.id,
    newArticleId: saved.id,
    angleKey: angle.key,
    title: saved.title,
  });
  return { ok: true, draft: saved, angleKey: angle.key };
}

module.exports = {
  synthesizeEliteFromContext,
  section,
  esc,
  buildInsiderContext,
  pickNextAngle,
  typeForCategory,
  generateEliteDraft,
  generateEliteDraftWithRetries,
  regenerateAfterReject,
  MAX_GENERATION_ATTEMPTS,
};
