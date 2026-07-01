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

function synthesizeEliteFromContext({ articleType, title, angleKey, context }) {
  const season = context.season;
  const roster = context.rosterContext || {};
  const portal = context.portalContext || {};
  const board = context.recruitingContext?.board || {};
  const analytics = context.analyticsContext || {};
  const scheme = context.schemeContext || {};
  const intel = context.intelContext || {};

  const thesis = [
    `${title} — ${articleType} analysis for Florida ${season}.`,
    `Thesis: Florida's ${season} ceiling depends on meshing portal talent, defensive scheme install, and closing recruiting battles before fall camp.`,
    `The stakes are SEC survival: slow installs and thin depth become exploitable matchups by mid-October.`,
  ].join(' ');

  const angleParas = [];
  if (portal.incomingCount) {
    angleParas.push(
      `Portal impact: Florida added ${portal.incomingCount} incoming transfers this cycle, reshaping snap expectations before fall camp.`,
      `Each portal addition shifts which high school targets remain priorities — filled rooms reduce urgency on the board.`
    );
  }
  if (board.topTargets?.length) {
    const names = board.topTargets.slice(0, 3).map((p) => `<strong>${esc(p.name)}</strong> (${esc(p.pos || '')})`).join(', ');
    angleParas.push(
      `Recruiting board: ${board.targetCount} active ${board.classYear} targets tracked. Priority names: ${names}.`,
      `Staff allocation this month signals who UF believes it can close before the season opens.`
    );
  }
  if (intel.upcomingVisits?.length) {
    angleParas.push(
      `Visit calendar: ${intel.upcomingVisits.length} upcoming visit events compress decision timelines for tier-one targets.`,
      `OV and UV intel drives next staff visits — validated signals only, not social noise.`
    );
  }
  if (intel.recentIntel?.length) {
    angleParas.push(`Recent intel: ${intel.recentIntel.length} verified signals in the last window feed board movement analysis.`);
  }
  angleParas.push(
    `Coaching intel: ${scheme.dcScheme || '3-3-5 hybrid'} install is the defensive identity — personnel fit at JACK and STAR decides stress-test outcomes.`,
    `Locker room leadership after portal churn decides how quickly new pieces mesh in August reps.`,
    `Fall camp rep reports will re-sort the two-deep faster than spring evaluations or pedigree alone.`,
    `Narrative tension: units that fail to gel in August become season-long liabilities against SEC tempo and physicality.`,
    `Film-driven evaluation favors rep winners over name recognition when depth chart slots are contested.`
  );

  const body = [
    section('Thesis', expandParagraphs([thesis], [
      `Florida enters ${season} with roster math, scheme install, and recruiting momentum all in motion simultaneously.`,
      `This ${articleType} piece synthesizes GatorVault roster data, portal tracker intel, recruiting board signals, and analytics — not a surface recap.`,
    ])),
    section('Insider Angles', angleParas.slice(0, 5)),
    section('Scheme Implications', expandParagraphs([
      `Florida ${scheme.dcScheme || '3-3-5 hybrid'} asks three down linemen to eat doubles, freeing hybrid defenders to play with leverage in space.`,
      `Offensively, packages must protect a rebuilt OL; quick-game, play-action, and tempo become necessities against SEC fronts.`,
      `JACK and STAR roles are stress points against spread sets — personnel who can cover and rush win the install.`,
    ], [
      `Special teams and tempo amplify scheme edges when install is ahead of schedule; lagging install shows up as explosive plays allowed.`,
      `Defensive coordinator tendencies favor hybrid bodies who can blitz, spy, and match slot receivers without substitution delays.`,
      `Offensive scheme fit ties directly to QB comfort in structure — rep battles in fall camp reveal who handles pressure and checks.`,
    ])),
    section('Roster Impact', expandParagraphs([
      `${roster.unitSnapshot?.total || 0} scholarship names tracked (${roster.offenseCount || 0} offense / ${roster.defenseCount || 0} defense).`,
      roster.unitSnapshot?.top?.length
        ? `Position distribution: ${roster.unitSnapshot.top.map(([g, n]) => `${g} (${n})`).join(', ')}.`
        : `Unit distribution drives travel-list and rotation planning across the two-deep.`,
      `Depth chart movement favors rep winners, not pedigree alone — portal exits created repair spots incoming names must plug quickly.`,
    ], [
      `Thin rooms at OL and secondary depth remain the highest-variance units entering camp.`,
      `Portal additions must acclimate without long learning curves — SEC weeks one through four punish slow integrations.`,
      `Leadership structure after churn determines whether new faces elevate or stall unit chemistry.`,
    ])),
    section('Recruiting and Portal Impact', expandParagraphs([
      `${board.ufCommitCount || 0} UF commits with ${board.targetCount || 0} live targets on the ${board.classYear} board.`,
      `Portal additions reshape which high school targets stay priorities — roster holes define staff visit calendars.`,
      `Commit likelihoods shift with every OV; competing schools on the board require war-room attention, not passive monitoring.`,
    ], [
      `On3 RPM and competitor percentages inform closing strategy — Florida path requires validated intel, not rumor.`,
      `Board movement without intel is noise; GatorVault tracks signals that survived sanitization and identity validation.`,
      `Recruiting momentum and portal math are linked — a closed position group frees resources for remaining tier-one battles.`,
    ])),
    section('Analytics and Data', expandParagraphs([
      analytics.nextGame
        ? `Next opponent ${esc(analytics.nextGame.opponent || 'TBD')}${analytics.nextGame.ufPct != null ? ` — model win probability ${analytics.nextGame.ufPct}%` : ''}.`
        : `Schedule and opponent strength feed the baseline win model before roster adjustments.`,
      `Returning production and continuity drive projections; portal churn adjusts both floor and ceiling estimates.`,
      `Heat check: ${context.heatCheck?.length || 0} rising prospects flagged on the recruiting desk this cycle.`,
      `Schedule length ${analytics.scheduleLength || 0} games sets the SEC survival curve — no soft middle weeks in this league.`,
    ], [
      `Win probability models incorporate opponent strength, returning starters, and portal net value — not narrative hype.`,
      `Roster math exposes where Florida is over- or under-built relative to scheme demands and schedule stress.`,
      `Data-backed analysis separates signal from noise when evaluating camp battles and board movement.`,
      `Trend lines on returning production and portal net value inform whether Florida is built to survive the back half of the schedule.`,
    ])),
    section("What's Next", expandParagraphs([
      `Watch OL and QB rep battles in fall camp for two-deep movement — trenches decide ${season} floor.`,
      `Recruiting closes on top-tier targets before the season opens; staff visits compress into a narrow window.`,
      `Defensive depth behind the starting eleven remains the primary risk factor if injuries hit hybrid roles.`,
      `Florida ${season} ceiling: mesh portal talent, stabilize trenches, close the board, and execute the ${scheme.dcScheme || '3-3-5 hybrid'} install on schedule.`,
    ], [
      `Forward-looking: monitor JACK/STAR rep winners, portal acclimation timelines, and visit-weekend board shifts.`,
      `What to watch: depth chart updates after first fall scrimmage, commit announcements, and opponent scouting drops.`,
      `Florida must win the August install window — scheme, roster, and recruiting momentum converge there.`,
    ])),
  ].join('\n');

  let finalBody = body;
  const countWords = (html) =>
    String(html || '')
      .replace(/<[^>]+>/g, ' ')
      .split(/\s+/)
      .filter(Boolean).length;
  if (countWords(finalBody) < 700) {
    const pad = section("What's Next", [
      `Florida must treat every fall camp rep as roster currency — the ${season} two-deep will not mirror spring paper depth.`,
      `Insider read: scheme install pace, portal acclimation, and board closes define whether this ${articleType} thesis holds by kickoff.`,
    ]);
    finalBody = `${finalBody}\n${pad}`;
  }

  return {
    articleType,
    thesis,
    title,
    summary: thesis.slice(0, 220),
    body: finalBody,
    insiderAngles: angleParas.slice(0, 5),
    angleKey,
    sourcesUsed: ['GatorVault', 'Recruiting Board', 'Portal Tracker'],
  };
}

const cycle = require('./insider-articles-cycle');
const templates = require('./insider-articles-templates');
const sanitize = require('./insider-articles-sanitize');
const store = require('./insider-articles-store');
const { extractArticleMetadata } = require('./insider-articles-metadata');

const CATEGORY_TO_TYPE = {
  program_pulse: 'Program Pulse',
  heat_check: 'War Room',
  official_visit_preview: 'War Room',
  post_visit_reaction: 'War Room',
  staff_intel: 'Insider',
  summer_preview: 'Game Week',
  depth_chart_movement: 'Roster Analysis',
  insider: 'Insider',
  game_week_preview: 'Game Week',
  roster_analysis: 'Roster Analysis',
};

const ANGLES_BY_TYPE = {
  'Program Pulse': [
    { key: 'macro_health', titleTemplate: 'Program Pulse: {season} Florida roster architecture and culture check' },
    { key: 'portal_math', titleTemplate: 'Portal Math: How Florida rebuilt the {season} roster position by position' },
    { key: 'culture_churn', titleTemplate: 'Culture vs. Churn: Managing portal exits without losing the locker room' },
    { key: 'scheme_identity', titleTemplate: 'Scheme Identity: Why Florida {season} defense is built around the JACK' },
    { key: 'momentum', titleTemplate: 'Program Pulse: Recruiting momentum and roster health entering fall camp' },
  ],
  'War Room': [
    { key: 'board_battle', titleTemplate: 'War Room: {focus} - commit likelihoods and competing schools' },
    { key: 'ov_intel', titleTemplate: 'War Room: Official visit intel and board movement for {focus}' },
    { key: 'rpm_edge', titleTemplate: 'War Room: On3 RPM edges and Florida path with {focus}' },
    { key: 'visit_reaction', titleTemplate: 'War Room: Post-visit reaction - what {focus} means for UF' },
    { key: 'target_tiers', titleTemplate: 'War Room: Tier-one targets and Florida closing window' },
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
  return CATEGORY_TO_TYPE[category] || 'Insider';
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
    portalContext: { incomingCount: portalRaw?.incomingCount ?? incoming.length, incoming: incoming.slice(0, 10) },
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
  const out = [{ name: 'GatorVault Staff', outlet: 'GatorVault' }];
  if (context?.recruitingContext?.board?.totalTracked) {
    out.push({ name: 'Recruiting Board', outlet: 'GatorVault' });
  }
  if (context?.portalContext?.incomingCount) {
    out.push({ name: 'Portal Tracker', outlet: 'GatorVault' });
  }
  for (const s of topic?.sources || []) {
    if (s?.name && s?.outlet) out.push(s);
  }
  return out;
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
    insiderAngles: payload.insiderAngles || [],
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
