/**
 * Insider Articles Engine — weekly draft generation with strict cycle separation.
 * Template-based analysis only; never auto-publishes.
 */
const store = require('./insider-articles-store');
const cycle = require('./insider-articles-cycle');
const templates = require('./insider-articles-templates');
const sanitize = require('./insider-articles-sanitize');
const identityValidator = require('./identity-record-validator');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_WEEKLY = 3;
const MAX_WEEKLY = 5;
const MAX_CANDIDATES = 12;

function uniqueSources(list) {
  const seen = new Set();
  return (list || []).filter((s) => {
    const key = `${s.name}|${s.outlet}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return s.name && s.outlet;
  });
}

function isUpcomingVisit(intel) {
  const t = String(intel.eventType || '').toLowerCase();
  if (!/official_visit|unofficial_visit|visit/.test(t)) return false;
  if (/cancel|post_visit_reaction/.test(t)) return false;
  const ts = new Date(intel.timestamp || intel.createdAt || 0).getTime();
  return ts >= Date.now() - 3 * 86400000;
}

function isRecentCompletedVisit(intel) {
  const t = String(intel.eventType || '').toLowerCase();
  if (!/official_visit|unofficial_visit|visit/.test(t)) return false;
  const ts = new Date(intel.timestamp || intel.createdAt || intel.reportedAt || 0).getTime();
  const age = Date.now() - ts;
  return age >= 0 && age <= 10 * 86400000;
}

function lastArticleTimestamp(categories) {
  const catSet = new Set(categories || []);
  const items = [...store.listDrafts({ status: null }), ...store.listPublished()];
  let maxTs = 0;
  for (const article of items) {
    if (!catSet.has(article.category)) continue;
    const ts = new Date(article.createdAt || article.publishedAt || 0).getTime();
    if (ts > maxTs) maxTs = ts;
  }
  return maxTs;
}

function buildVisitArticleTopicKey(category, visits) {
  const slug = visits[0]?.playerSlug || 'multi';
  const fps = visits
    .map((v) => v.fingerprint)
    .filter(Boolean)
    .sort()
    .join('|');
  const fpKey = fps ? fps.slice(0, 64).replace(/[^a-z0-9|_-]/gi, '') : 'none';
  const prefix = category === 'post_visit_reaction' ? 'post_visit' : 'ov_preview';
  return `${prefix}_${cycle.RECRUITING_MIN_CLASS}_${slug}_${fpKey}`;
}

function visitIntelAlreadyCovered(visits, category = 'post_visit_reaction') {
  const fps = new Set(visits.map((v) => v.fingerprint).filter(Boolean));
  if (!fps.size) return false;
  const articles = [...store.listDrafts({ status: null }), ...store.listPublished()];
  return articles.some((article) => {
    if (article.category !== category) return false;
    const covered = article.triggerIntelFingerprints || [];
    return covered.some((fp) => fps.has(fp));
  });
}

function validateVisitIntelBatch(intelRows, storePlayers) {
  const seenFingerprints = new Set();
  const accepted = [];
  const rejected = [];
  const triggerLog = [];

  for (const intel of intelRows) {
    const intelValidation = identityValidator.validateIntelForArticle(intel, { seenFingerprints });
    if (!intelValidation.valid) {
      rejected.push({
        slug: intel.playerSlug,
        fingerprint: intel.fingerprint,
        errors: intelValidation.errors
      });
      continue;
    }
    if (intel.fingerprint) seenFingerprints.add(intel.fingerprint);

    const storePl = storePlayers.find((p) => p.slug === intel.playerSlug);
    const playerRecord = {
      slug: intel.playerSlug,
      name: intel.playerName || storePl?.name,
      pos: intel.pos || storePl?.pos,
      classYear: intel.classYear || storePl?.classYear,
      school: storePl?.school || intel.school || intel.highSchool,
      skinny: storePl?.skinny,
      profileNote: storePl?.profileNote
    };
    const playerValidation = identityValidator.validatePlayerIdentityRecord(playerRecord);
    triggerLog.push({
      slug: intel.playerSlug,
      name: intel.playerName,
      fingerprint: intel.fingerprint,
      source: intel.source,
      eventType: intel.eventType,
      playerValid: playerValidation.valid,
      playerErrors: playerValidation.errors,
      intelValid: true
    });
    if (!playerValidation.valid) {
      rejected.push({
        slug: intel.playerSlug,
        fingerprint: intel.fingerprint,
        errors: playerValidation.errors,
        stage: 'player_identity'
      });
      continue;
    }
    accepted.push(intel);
  }

  return { accepted, rejected, triggerLog };
}

function mapVisitIntelToSignals(intelRows, storePlayers) {
  return intelRows.slice(0, 5).map((v) => {
    const storePl = storePlayers.find((p) => p.slug === v.playerSlug);
    return { ...storePl, ...v };
  });
}

async function collectSignals() {
  const recruitingStore = require('./recruiting-store');
  const intelStore = require('./recruiting-intel-store');
  const rosterStore = require('./roster-store');
  const depthJobs = require('./depth-chart-jobs');
  const bettingLines = require('./betting-lines');

  const [allPlayers, events, portal, roster, depthMeta, lines] = await Promise.all([
    recruitingStore.getAllPlayers(),
    recruitingStore.getEvents({ limit: 50 }),
    recruitingStore.getPortalBoard(),
    Promise.resolve(rosterStore.getAllRosterPlayers()),
    Promise.resolve(depthJobs.getDepthChartMeta()),
    bettingLines.getBettingLines().catch(() => null)
  ]);

  let intel = [];
  try {
    intel = identityValidator.dedupeIntelByFingerprint(
      (intelStore.listIntel({ limit: 100 }) || []).filter((i) => i.resolutionStatus !== 'needs_resolution')
    );
  } catch {
    intel = [];
  }

  let heatCheck = null;
  try {
    const heat = require('./heat-check-store');
    heatCheck = await heat.buildHeatCheck();
  } catch {
    heatCheck = null;
  }

  const recruitingPlayers = cycle.filterRecruitingPlayers(allPlayers);
  const intel2027 = cycle.filterRecruitingIntel(intel);
  const events2027 = cycle.filterRecruitingEvents(
    events.filter((e) => Date.now() - new Date(e.createdAt).getTime() < 14 * 86400000)
  );
  const visits2027 = identityValidator.filterStaleVisitIntelChain(
    intel2027.filter((i) => /visit|ov|unofficial/i.test(i.eventType || '')),
    null
  );
  const rising2027 = cycle.filterRecruitingHeat(heatCheck?.rising || []);

  const targets2027 = recruitingPlayers.filter((p) => p.category === 'target');
  const commits2027 = recruitingPlayers.filter(
    (p) => p.status === 'committed' && /florida/i.test(p.committedTo || '')
  );

  const offense = roster.filter((p) => p.unit === 'offense');
  const defense = roster.filter((p) => p.unit === 'defense');

  return {
    collectedAt: new Date().toISOString(),
    season: cycle.programSeasonYear(),
    recruiting: {
      players: recruitingPlayers,
      events: events2027,
      targets: targets2027,
      commits: commits2027,
      minClass: cycle.RECRUITING_MIN_CLASS
    },
    portal: { incoming: portal.incoming || [], headliner: portal.headliner, count: portal.count },
    depthChart: { meta: depthMeta, rosterCount: roster.length, offense: offense.length, defense: defense.length },
    gameZone: { nextGame: lines?.nextGame || null, schedule: lines?.schedule || [] },
    intel: {
      visits: visits2027,
      upcoming: visits2027.filter(isUpcomingVisit),
      recent: visits2027.filter(isRecentCompletedVisit),
      all: intel2027.slice(0, 20)
    },
    heatCheck: heatCheck ? { ...heatCheck, rising: rising2027 } : { rising: rising2027 },
    roster: { players: roster, offense, defense }
  };
}

function scoreTopic(topic) {
  const s = topic.scores || {};
  return (
    (s.relevance || 0) * 0.3 +
    (s.timeliness || 0) * 0.25 +
    (s.impact || 0) * 0.25 +
    (s.dataRichness || 0) * 0.12 +
    (s.freshness || 0) * 0.08
  );
}

function buildCandidateTopics(signals) {
  const topics = [];
  const push = (topic) => {
    if (!topic?.category || !topic.title) return;
    const cycleType = cycle.isRecruitingCategory(topic.category) ? 'recruiting' : 'program';
    if (cycleType === 'recruiting' && topic.classYear != null) {
      if (!cycle.passesCycleGate({ cycleType: 'recruiting', classYear: topic.classYear })) return;
    }
    topics.push({ ...topic, cycleType, totalScore: scoreTopic(topic) });
  };

  const season = signals.season;

  if (signals.portal.count > 0 || signals.roster.players.length > 50) {
    push({
      topicKey: `program_pulse_${season}_${signals.portal.count || 0}`,
      category: 'program_pulse',
      title: `Program Pulse: ${season} Florida roster and portal outlook`,
      classYear: season,
      scores: { relevance: 90, timeliness: 85, impact: 88, dataRichness: 80, freshness: 85 },
      signals: { portal: signals.portal, roster: signals.roster, type: 'program_pulse' },
      sources: [
        { name: 'GatorVault Roster', outlet: 'GatorVault' },
        { name: 'On3 Portal', outlet: 'On3' }
      ]
    });
  }

  if (signals.heatCheck.rising.length >= 2) {
    const rising = signals.heatCheck.rising.slice(0, 4).map((r) => {
      const storePl = signals.recruiting.players.find((p) => p.slug === r.playerSlug);
      return { ...storePl, ...r };
    });
    const top = rising[0];
    push({
      topicKey: `heat_check_${cycle.RECRUITING_MIN_CLASS}_${top.playerSlug || top.playerName}`,
      category: 'heat_check',
      title: `Heat Check: ${cycle.RECRUITING_MIN_CLASS} class momentum — ${sanitize.sanitizePlayerName(top.playerName) || 'top risers'}`,
      classYear: cycle.RECRUITING_MIN_CLASS,
      scores: { relevance: 88, timeliness: 90, impact: 82, dataRichness: 85, freshness: 92 },
      signals: { rising, type: 'heat_check' },
      sources: [
        { name: 'On3 RPM', outlet: 'On3' },
        { name: 'GatorVault Heat Check', outlet: 'GatorVault' }
      ]
    });
  }

  const sinceOvPreview = lastArticleTimestamp(['official_visit_preview']);
  const newUpcomingIntel = visits2027.filter(
    (i) => isUpcomingVisit(i) && identityValidator.isVerifiedNewVisitIntel(i, sinceOvPreview)
  );
  const { accepted: validatedUpcoming, rejected: rejectedUpcoming, triggerLog: ovTriggerLog } =
    validateVisitIntelBatch(newUpcomingIntel, recruitingPlayers);

  if (validatedUpcoming.length >= 1) {
    const visits = mapVisitIntelToSignals(validatedUpcoming, recruitingPlayers);
    const lead = visits[0];
    const name = sanitize.sanitizePlayerName(lead.playerName) || 'Official visitors';
    const topicKey = buildVisitArticleTopicKey('official_visit_preview', visits);
    if (!visitIntelAlreadyCovered(visits, 'official_visit_preview')) {
      push({
        topicKey,
        category: 'official_visit_preview',
        title: `Official Visit Preview: ${name} and ${cycle.RECRUITING_MIN_CLASS} OV intel`,
        classYear: cycle.RECRUITING_MIN_CLASS,
        scores: { relevance: 90, timeliness: 94, impact: 84, dataRichness: 80, freshness: 95 },
        signals: { visits, type: 'official_visit_preview' },
        triggerIntelFingerprints: visits.map((v) => v.fingerprint).filter(Boolean),
        triggerIdentityLog: ovTriggerLog,
        sources: uniqueSources(
          visits.map((v) => ({
            name: v.sourceHandle || v.source || 'Beat Writer',
            outlet: v.source === 'beat_writer' ? 'Beat Report' : 'Recruiting Intel'
          }))
        )
      });
    } else {
      console.log('[insider-articles] skipped OV preview — intel already covered:', topicKey);
    }
  } else if (newUpcomingIntel.length) {
    console.log('[insider-articles] skipped OV preview — no valid new visit intel:', rejectedUpcoming);
  }

  const sincePostVisit = lastArticleTimestamp(['post_visit_reaction']);
  const newRecentIntel = visits2027.filter(
    (i) => isRecentCompletedVisit(i) && identityValidator.isVerifiedNewVisitIntel(i, sincePostVisit)
  );
  const { accepted: validatedRecent, rejected: rejectedRecent, triggerLog: recapTriggerLog } =
    validateVisitIntelBatch(newRecentIntel, recruitingPlayers);

  if (validatedRecent.length >= 1) {
    const visits = mapVisitIntelToSignals(validatedRecent, recruitingPlayers);
    const lead = visits[0];
    const name = sanitize.sanitizePlayerName(lead.playerName) || 'Florida visitors';
    const topicKey = buildVisitArticleTopicKey('post_visit_reaction', visits);
    if (!visitIntelAlreadyCovered(visits, 'post_visit_reaction')) {
      console.log('[insider-articles] visit recap triggered by identity records:', JSON.stringify(recapTriggerLog));
      push({
        topicKey,
        category: 'post_visit_reaction',
        title: `Post-Visit Reaction: ${name} and ${cycle.RECRUITING_MIN_CLASS} OV read`,
        classYear: cycle.RECRUITING_MIN_CLASS,
        scores: { relevance: 86, timeliness: 88, impact: 80, dataRichness: 78, freshness: 90 },
        signals: { visits, type: 'post_visit_reaction' },
        triggerIntelFingerprints: visits.map((v) => v.fingerprint).filter(Boolean),
        triggerIdentityLog: recapTriggerLog,
        sources: uniqueSources(
          visits.map((v) => ({
            name: v.sourceHandle || v.source || 'Beat Writer',
            outlet: 'Beat Report'
          }))
        )
      });
    } else {
      console.log('[insider-articles] skipped visit recap — intel already covered:', topicKey);
    }
  } else {
    const hadCandidates = visits2027.some((i) => isRecentCompletedVisit(i));
    if (hadCandidates || rejectedRecent.length) {
      console.log(
        '[insider-articles] visit recap blocked — no new verified visit intel since',
        new Date(sincePostVisit).toISOString(),
        rejectedRecent.length ? { rejected: rejectedRecent } : ''
      );
    }
  }

  // Legacy blocks removed — visit topics only when new verified intel passes validation above.

  if (signals.roster.players.length >= 40) {
    push({
      topicKey: `roster_analysis_${season}_${signals.roster.players.length}`,
      category: 'roster_analysis',
      title: `Roster Analysis: ${season} Florida team by unit`,
      classYear: season,
      scores: { relevance: 84, timeliness: 70, impact: 76, dataRichness: 88, freshness: 72 },
      signals: { roster: signals.roster, type: 'roster_analysis' },
      sources: [{ name: 'GatorVault Roster Store', outlet: 'GatorVault' }]
    });
  }

  if (signals.depthChart.rosterCount >= 50) {
    push({
      topicKey: `depth_chart_${season}_${signals.depthChart.rosterCount}`,
      category: 'depth_chart_movement',
      title: `Depth Chart Movement: ${season} two-deep updates`,
      classYear: season,
      scores: { relevance: 82, timeliness: 72, impact: 74, dataRichness: 86, freshness: 70 },
      signals: { depthChart: signals.depthChart, type: 'depth_chart_movement' },
      sources: [{ name: 'Depth Chart Engine', outlet: 'GatorVault' }]
    });
  }

  if (signals.roster.players.length >= 50) {
    push({
      topicKey: `summer_preview_${season}`,
      category: 'summer_preview',
      title: `Summer Preview: ${season} camp battles across Florida's two-deep`,
      classYear: season,
      scores: { relevance: 80, timeliness: 82, impact: 74, dataRichness: 72, freshness: 78 },
      signals: { roster: signals.roster, depthChart: signals.depthChart, type: 'summer_preview' },
      sources: [{ name: 'GatorVault Staff', outlet: 'GatorVault' }]
    });

    push({
      topicKey: `staff_intel_${season}`,
      category: 'staff_intel',
      title: `Staff Intel: ${season} scheme and roster evaluation`,
      classYear: season,
      scores: { relevance: 78, timeliness: 75, impact: 72, dataRichness: 70, freshness: 74 },
      signals: { roster: signals.roster, depthChart: signals.depthChart, type: 'staff_intel' },
      sources: [{ name: 'GatorVault Staff', outlet: 'GatorVault' }]
    });
  }

  const nextGame = signals.gameZone.nextGame;
  if (nextGame?.game || nextGame?.opponent) {
    const opp = nextGame.opponent || nextGame.game || 'Next Opponent';
    push({
      topicKey: `game_preview_${season}_${String(opp).replace(/\s+/g, '_').toLowerCase()}`,
      category: 'game_week_preview',
      title: `Game Week Preview: Florida vs ${String(opp).replace(/^Florida vs\s*/i, '')}`,
      classYear: season,
      scores: { relevance: 84, timeliness: 88, impact: 80, dataRichness: 72, freshness: 86 },
      signals: { game: nextGame, schedule: signals.gameZone.schedule, type: 'game_week_preview' },
      sources: uniqueSources([
        { name: 'Game Zone Lines', outlet: 'GatorVault' },
        nextGame.source ? { name: nextGame.source, outlet: nextGame.source } : null
      ].filter(Boolean))
    });
  }

  return topics.sort((a, b) => b.totalScore - a.totalScore).slice(0, MAX_CANDIDATES);
}

function writeDraftFromTopic(topic, signals) {
  const draft = templates.buildArticleDraft(topic, signals);
  if (!draft) return null;

  const meta = store.CATEGORIES[draft.category] || store.CATEGORIES.program_pulse;
  return store.normalizeArticle({
    ...draft,
    byline: meta.byline,
    topicKey: topic.topicKey,
    triggerIntelFingerprints: topic.triggerIntelFingerprints || [],
    triggerIdentityLog: topic.triggerIdentityLog || [],
    status: 'draft',
    createdAt: new Date().toISOString()
  });
}

async function generateWeeklyDrafts({ force = false, maxDrafts = MAX_WEEKLY } = {}) {
  const createdThisWeek = store.draftsCreatedSince(WEEK_MS).filter((a) => a.status === 'draft');
  const pending = store.countDraftsPending();

  if (!force && createdThisWeek.length >= maxDrafts) {
    return {
      ok: true,
      skipped: true,
      reason: 'weekly_cap_reached',
      createdThisWeek: createdThisWeek.length,
      pending
    };
  }

  const signals = await collectSignals();
  const candidates = buildCandidateTopics(signals);
  const existingKeys = new Set(
    [...store.listDrafts({ status: 'draft' }), ...store.listPublished()].map((a) => a.topicKey).filter(Boolean)
  );

  const slots = Math.max(0, maxDrafts - createdThisWeek.length);
  const selected = [];
  for (const topic of candidates) {
    if (selected.length >= slots) break;
    if (existingKeys.has(topic.topicKey)) continue;
    selected.push(topic);
    existingKeys.add(topic.topicKey);
  }

  const drafts = [];
  const aborted = [];
  for (const topic of selected) {
    const draft = writeDraftFromTopic(topic, signals);
    if (draft) {
      drafts.push(store.addDraft(draft));
    } else {
      aborted.push({ topicKey: topic.topicKey, category: topic.category, reason: 'insufficient_intel_or_quality' });
    }
  }

  store.logEvent('weekly_generation', {
    candidateCount: candidates.length,
    selectedCount: selected.length,
    draftCount: drafts.length,
    aborted,
    draftIds: drafts.map((d) => d.id),
    visitRecapTriggers: selected
      .filter((t) => t.category === 'post_visit_reaction')
      .map((t) => ({
        topicKey: t.topicKey,
        triggerIdentityLog: t.triggerIdentityLog,
        fingerprints: t.triggerIntelFingerprints
      })),
    ovPreviewTriggers: selected
      .filter((t) => t.category === 'official_visit_preview')
      .map((t) => ({
        topicKey: t.topicKey,
        triggerIdentityLog: t.triggerIdentityLog,
        fingerprints: t.triggerIntelFingerprints
      })),
    recruitingMinClass: cycle.RECRUITING_MIN_CLASS,
    programSeason: cycle.programSeasonYear()
  });

  return {
    ok: true,
    signalsAt: signals.collectedAt,
    candidates: candidates.length,
    selected: drafts.length,
    aborted,
    drafts,
    pending: store.countDraftsPending()
  };
}

async function refreshArticleContent(article) {
  const signals = await collectSignals();
  const candidates = buildCandidateTopics(signals);
  let topic = candidates.find((t) => t.topicKey === article.topicKey);
  if (!topic) {
    topic = {
      topicKey: article.topicKey || article.id,
      category: article.category,
      title: article.title,
      classYear: cycle.isRecruitingCategory(article.category) ? cycle.RECRUITING_MIN_CLASS : cycle.programSeasonYear(),
      signals: { roster: signals.roster, type: article.category },
      sources: article.sources
    };
  }
  const draft = templates.buildArticleDraft(topic, signals);
  if (!draft) {
    return {
      summary: article.summary,
      body: article.body,
      readTimeMinutes: article.readTimeMinutes,
      sources: article.sources
    };
  }
  return {
    summary: draft.summary,
    body: draft.body,
    readTimeMinutes: draft.readTimeMinutes,
    sources: uniqueSources(topic.sources || article.sources)
  };
}

module.exports = {
  WEEK_MS,
  MIN_WEEKLY,
  MAX_WEEKLY,
  collectSignals,
  buildCandidateTopics,
  writeDraftFromTopic,
  generateWeeklyDrafts,
  refreshArticleContent
};
