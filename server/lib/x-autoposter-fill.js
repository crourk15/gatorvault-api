/**
 * Auto-fill X autoposter queue from live GatorVault data (On3 events, intel, beat writers, articles, portal).
 * Evaluates beat-writer posts, recruiting momentum, commits, visits, portal, and general UF intel.
 */
const crypto = require('crypto');
const store = require('./x-autoposter-store');
const policy = require('./x-autoposter-policy');
const recruitingStore = require('./recruiting-store');
const intelStore = require('./recruiting-intel-store');
const contentStore = require('./content-store');
const { commitFingerprint, intelFingerprint } = require('./commit-fingerprint');
const { getBeatPosts, refreshBeatStream } = require('./live-beat');
const beatFilters = require('./beat-writer-filters');
const copy = require('./x-autoposter-copy');
const cadence = require('./x-autoposter-cadence');
const pipelineGuards = require('./pipeline-guards');
const validation = require('./x-autoposter-validation');
const postSpec = require('./x-autoposter-post-spec');
const sentLedger = require('./x-autoposter-sent-ledger');

const BEAT_CACHE_STALE_MS = parseInt(
  process.env.X_AUTOPOST_BEAT_CACHE_STALE_MS || String(15 * 60 * 1000),
  10
);

function beatFirstEnabled() {
  return process.env.X_AUTOPOST_BEAT_FIRST !== 'false';
}

function clusterFallbackEnabled() {
  return process.env.X_AUTOPOST_CLUSTER_FALLBACK !== 'false';
}

async function ensureBeatCacheFresh() {
  if (!beatFirstEnabled()) return { refreshed: false, reason: 'beat_first_disabled' };
  const beat = getBeatPosts(1);
  const fetchedAt = beat.fetchedAt ? new Date(beat.fetchedAt).getTime() : 0;
  const stale = !fetchedAt || Date.now() - fetchedAt > BEAT_CACHE_STALE_MS;
  if (!stale && (beat.posts || []).length) {
    return { refreshed: false, reason: 'cache_fresh', postCount: beat.posts.length, fetchedAt: beat.fetchedAt };
  }
  if (!pipelineGuards.scheduledJobsEnabled() && !process.env.X_BEARER_TOKEN) {
    return { refreshed: false, reason: 'no_fetch_credentials', postCount: (beat.posts || []).length };
  }
  try {
    const out = await refreshBeatStream();
    return { refreshed: true, postCount: out.postCount || 0, source: out.source || null };
  } catch (err) {
    return { refreshed: false, reason: err.message, postCount: (beat.posts || []).length };
  }
}

async function ensureBeatIntelIngested({ force = false } = {}) {
  if (!beatFirstEnabled()) return { ok: true, skipped: true, reason: 'beat_first_disabled' };
  if (!pipelineGuards.autopostEnabled()) return { ok: true, skipped: true, reason: 'autoposter_disabled' };
  try {
    const beatIngest = require('./beat-writer-ingest');
    const result = await beatIngest.runBeatWriterIngest({ force });
    return {
      ok: true,
      processedCount: result.processed?.length || 0,
      skippedCount: result.skipped?.length || 0,
      errorCount: result.errors?.length || 0
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function prepareBeatFirstAutoposter({ forceIngest = false } = {}) {
  const cache = await ensureBeatCacheFresh();
  const ingest = await ensureBeatIntelIngested({ force: forceIngest });
  return { cache, ingest };
}

const SITE_URL = process.env.SITE_URL || 'https://gatorvaultinsider.com';
const ON3_PORTAL =
  process.env.ON3_PORTAL_SOURCE ||
  'https://www.on3.com/college/florida-gators/football/2026/commits/';
/** Only queue events within freshness window (3h normal; validation also enforces 30m breaking). */
const MAX_COMMIT_EVENT_AGE_MS = parseInt(
  process.env.X_AUTOPOST_MAX_COMMIT_AGE_MS || String(validation.MAX_NEWS_AGE_MS),
  10
);
const MAX_BEAT_POST_AGE_MS = parseInt(
  process.env.X_AUTOPOST_MAX_BEAT_AGE_MS || String(validation.MAX_NEWS_AGE_MS),
  10
);
/** Only queue intel ≤ 60 minutes old (elite spec rule 1). */
const MAX_INTEL_AGE_MS = parseInt(
  process.env.X_AUTOPOST_MAX_INTEL_AGE_MS || String(postSpec.MAX_INTEL_AGE_MS),
  10
);

/** Recruiting commit sources eligible for X autopost (On3 board + beat-verified allowlist). */
const COMMIT_EVENT_SOURCES = new Set(['on3', 'hayes_fawcett', 'rivals_beat', 'allowlist-commit-ingest']);

function isCommitAutopostEvent(ev) {
  return ev && ['commit', 'flip'].includes(String(ev.eventType || '')) && COMMIT_EVENT_SOURCES.has(String(ev.source || ''));
}

function commitSourceMeta(ev) {
  const src = String(ev?.source || 'on3');
  if (src === 'hayes_fawcett') {
    return { label: 'Hayes Fawcett', url: 'https://x.com/hayesfawcett3', queueSource: 'auto:hayes-commit' };
  }
  if (src === 'rivals_beat') {
    return { label: 'Rivals', url: SITE_URL, queueSource: 'auto:rivals-commit' };
  }
  return { label: 'On3', url: ON3_PORTAL, queueSource: 'auto:on3-event' };
}

function attachNewsMeta(row, built) {
  if (!row || !built) return row;
  return {
    ...row,
    templateBlocks: built.templateBlocks || row.templateBlocks,
    validationMeta: built.validationMeta || row.validationMeta,
    playerContext: built.playerContext || row.playerContext
  };
}

function dedupeKey(text) {
  return crypto.createHash('sha256').update(String(text || '').trim().toLowerCase()).digest('hex').slice(0, 16);
}

const QUEUED_STATUSES = new Set(['pending', 'sent', 'skipped_duplicate']);

function fingerprintAlreadyQueued(fp, items) {
  if (!fp) return false;
  return items.some(
    (i) =>
      (i.intelFingerprint === fp || i.commitFingerprint === fp) && QUEUED_STATUSES.has(i.status)
  );
}

function alreadyQueued(text, items) {
  if (sentLedger.isCommitAnnouncementText(text)) {
    if (sentLedger.hasRecentSentCommit({ text, eventType: 'commit' })) return true;
  }
  const key = dedupeKey(text);
  const dedupeWindow = postSpec.DEDUPE_REPOST_WINDOW_MS;
  const cutoff = Date.now() - dedupeWindow;
  return items.some((i) => {
    if (dedupeKey(i.text) !== key) return false;
    if (i.status === 'pending' || i.status === 'skipped_duplicate') return true;
    if (i.status === 'sent' && i.sentAt && new Date(i.sentAt).getTime() >= cutoff) return true;
    if (i.status === 'failed' && /duplicate content/i.test(i.error || '')) return true;
    return false;
  });
}

function similarPostQueued(text, items) {
  if (
    sentLedger.isCommitAnnouncementText(text) &&
    sentLedger.hasRecentSentCommit({ text, eventType: 'commit' })
  ) {
    return { hit: true, itemId: 'sent-ledger', similarity: 1 };
  }
  const hit = postSpec.findSimilarInQueue(text, items);
  return hit.hit ? hit : null;
}

function commitAlreadyQueued(fp, items, meta = {}) {
  if (
    sentLedger.hasRecentSentCommit({
      slug: meta.slug,
      commitFingerprint: fp,
      text: meta.text,
      eventType: meta.eventType || 'commit',
    })
  ) {
    return true;
  }
  return fingerprintAlreadyQueued(fp, items);
}

async function buildNewsFromEvent(ev) {
  const meta = commitSourceMeta(ev);
  let built = await copy.buildRecruitingEventCopyAsync(ev, { source: meta.label });
  if ((!built?.text || copy.isBrokenCopy(built.text, built)) && !['portal_in', 'portal_out'].includes(String(ev.eventType || '').toLowerCase())) {
    built = copy.buildVerifiedCommitEventCopy(ev, { source: meta.label });
  }
  if (!built?.text || copy.isBrokenCopy(built.text, built)) return null;
  const player = ev.payload?.player || { slug: ev.playerSlug };
  const fp = commitFingerprint(player);
  return attachNewsMeta(
    {
      text: built.text,
      category: 'news',
      topic: ev.eventType?.startsWith('portal') ? 'portal' : 'recruiting',
      urgencyLabel: ev.eventType?.startsWith('portal') ? 'portal' : 'commitment',
      postUrgency: 'breaking',
      sourceEventType: ev.eventType,
      sources: [{ label: meta.label, url: meta.url }],
      source: meta.queueSource,
      commitFingerprint: fp,
      intelFingerprint: fp,
      playerSlug: player.slug || ev.playerSlug || null,
      sourceEventId: ev.id,
      sourceEventCreatedAt: ev.createdAt,
      timestamp: ev.createdAt,
      eventTimestamp: ev.createdAt,
      publishedAt: ev.createdAt,
      playerName: built.playerName || player.name || null,
      verifiedCommit: built.verifiedCommit || built.validationMeta?.verifiedCommit || null,
      sourceEventSource: ev.source || null,
    },
    built
  );
}

async function buildNewsFromIntel(intel) {
  const { matchIntelToPlayer } = require('./autoposter/identity-matcher');
  const { isEligibleIntel } = require('./autoposter/autoposter-policy');
  const player = matchIntelToPlayer(intel);
  if (!player) return null;
  if (!isEligibleIntel(intel, player)) return null;

  const built = await copy.buildIntelCopyAsync(intel);
  if (built?._nonPlayerSkip || built?.skipReason === 'non_player_intel') return null;
  if (built?._nonFootballSkip || built?.skipReason === 'non_football_sport') return null;
  if (built?._needsResolution || built?.skipReason === 'needs_resolution') return null;
  if (built?.skipReason || built?._identitySkip) return null;
  if (!built?.text || copy.isBrokenCopy(built.text, built)) return null;
  const fp = intel.fingerprint || intelFingerprint(intel.playerId, intel.eventType, intel.timestamp);
  const intelType = String(intel.eventType || '').toLowerCase();
  const urgentIntel = /visit_cancel|visit_scheduled|rivals_prediction|prediction_change|prediction/.test(intelType);
  return attachNewsMeta(
    {
      text: built.text,
      category: 'news',
      topic: 'recruiting',
      urgencyLabel: /injury/.test(intelType) ? 'injury' : urgentIntel ? 'major_beat' : null,
      sourceEventType: intel.eventType,
      sources: [{ label: intel.source || 'Insider', url: intel.sourceHandle ? `https://x.com/${intel.sourceHandle}` : SITE_URL }],
      source: 'auto:intel',
      intelFingerprint: fp,
      intelType: intel.eventType,
      playerName: built.playerName || intel.playerName,
      playerSlug: intel.playerSlug || player?.playerId || null,
      classYear: intel.classYear || player?.classYear || null,
      sourceIntelId: intel.id,
      sourceEventCreatedAt: intel.timestamp || intel.createdAt || null,
      eventTimestamp: intel.timestamp || intel.createdAt || null,
      validationMeta: {
        beatText: intel.text || intel.detail || null,
        situation: postSpec.detectSituation(intel.text || intel.detail, intel.eventType)
      }
    },
    built
  );
}

async function buildNewsFromPortal(headliner) {
  const built = await copy.buildPortalHeadlinerCopyAsync(headliner);
  if (!built?.text || copy.isBrokenCopy(built.text, built)) return null;
  const fp = intelFingerprint(headliner.on3Id || headliner.slug || headliner.name, 'portal_headliner', headliner.updatedAt || 'once');
  return attachNewsMeta(
    {
      text: built.text,
      category: 'news',
      topic: 'portal',
      urgencyLabel: 'portal',
      sourceEventType: 'portal_headliner',
      sources: [{ label: 'On3', url: headliner.on3ProfileUrl || ON3_PORTAL }],
      source: 'auto:portal-headliner',
      intelFingerprint: fp,
      playerName: built.playerName,
      sourceEventCreatedAt: headliner.updatedAt || null
    },
    built
  );
}

function prepareNewsCandidate(raw) {
  if (!raw?.text || copy.isBrokenCopy(raw.text, raw)) return null;

  const eventMs = validation.resolveEventTimestamp(raw);
  const fresh = postSpec.validateIntelFreshness(eventMs);
  if (!fresh.ok) {
    console.log(`[x-autoposter] skip: ${fresh.logTag || fresh.skipReason} — ${fresh.reason}`);
    return null;
  }

  const gate = validation.passesNewsQualityGate(raw);
  const verifiedCommit = raw.verifiedCommit || raw.validationMeta?.verifiedCommit;
  if (!gate.pass && verifiedCommit && !(gate.scored?.hardSkips?.length)) {
  return {
    ...raw,
    qualityScore: Math.max(gate.scored?.score ?? 0, validation.POSTING_THRESHOLD || 85),
    qualityBreakdown: gate.scored?.breakdown ?? null,
    sourceConfidence: gate.scored?.sourceConfidence ?? validation.SOURCE_CONFIDENCE_REQUIRED ?? 100,
    situation: raw.situation || postSpec.detectSituation(raw.text, raw.sourceEventType || raw.intelType),
    verifiedCommit: true,
  };
  }
  if (!gate.pass) return null;
  return {
    ...raw,
    qualityScore: gate.scored?.score ?? null,
    qualityBreakdown: gate.scored?.breakdown ?? null,
    sourceConfidence: gate.scored?.sourceConfidence ?? null,
    situation: raw.situation || postSpec.detectSituation(raw.text, raw.sourceEventType || raw.intelType)
  };
}

async function finalizeNewsCandidate(rawCandidate) {
  let raw = rawCandidate;
  if (raw._articleBuild) {
    const articleBuilt = await copy.buildArticleCopyAsync(raw._articleBuild);
    if (!articleBuilt?.text) return null;
    raw = attachNewsMeta(
      {
        ...raw,
        text: articleBuilt.text,
        playerName: articleBuilt.playerName,
        sourceEventCreatedAt: raw._articleBuild.publishedAt || raw._articleBuild.date || null
      },
      articleBuilt
    );
    delete raw._articleBuild;
  }
  return prepareNewsCandidate(raw);
}

function buildPromoFromMix() {
  const mix = store.getMixStats();
  const cat = mix.suggestedNextCategory || 'promo';
  if (cat === 'engagement') {
    return {
      text: `What's the biggest question about the Gators right now — QB, portal, or the 3-3-5? Drop it below 🐊 ${SITE_URL}`,
      category: 'engagement',
      topic: 'general',
      sources: [{ label: 'GatorVault', url: SITE_URL }],
      source: 'auto:engagement'
    };
  }
  if (cat === 'promo') {
    return {
      text: `Film Room + Portal Radar + live recruiting intel — free 30-day trial at GatorVault 🐊 ${SITE_URL}`,
      category: 'promo',
      topic: 'general',
      sources: [{ label: 'GatorVault', url: SITE_URL }],
      source: 'auto:promo'
    };
  }
  return null;
}

function buildNewsFromArticle(article) {
  if (!article?.title) return null;
  const playerName = copy.extractPlayerFromText(`${article.title} ${article.summary || ''}`);
  if (!playerName) return null;
  const fp = intelFingerprint(article.id || article.title, 'article', article.publishedAt || article.date);
  return {
    text: null,
    category: 'news',
    topic: 'general',
    urgencyLabel: 'analysis',
    sourceEventType: 'article',
    sources: [{ label: article.author || 'GatorVault', url: SITE_URL }],
    source: 'auto:article',
    intelFingerprint: fp,
    playerName,
    _articleBuild: article
  };
}

async function buildMomentumFromBeat(post) {
  const sportClassifier = require('./x-autoposter-sport-classifier');
  if (!sportClassifier.isFootballAutoposterEligible(post?.text, post)) return null;
  const built = await copy.buildMomentumCopyAsync(post);
  if (built?._nonPlayerSkip || built?.skipReason === 'non_player_intel') return null;
  if (built?._nonFootballSkip || built?.skipReason === 'non_football_sport') return null;
  if (built?._needsResolution || built?.skipReason === 'needs_resolution') return null;
  if (built?.skipReason || built?._identitySkip) return null;
  if (!built?.text || copy.isBrokenCopy(built.text, built)) return null;
  const player = built.playerName || copy.extractPlayerFromText(String(post.text || ''));
  const source = post.writerName || post.outlet || post.handle || 'Insider';
  const fp = intelFingerprint(post.id || post.url, 'recruiting_momentum', post.publishedAt);
  return attachNewsMeta(
    {
      text: built.text,
      category: 'news',
      topic: 'recruiting',
      urgencyLabel: 'major_beat',
      sourceEventType: 'recruiting_momentum',
      sources: [{ label: source, url: post.url || SITE_URL }],
      source: 'auto:beat-momentum',
      intelType: 'recruiting_momentum',
      intelFingerprint: fp,
      playerName: player,
      sourceEventCreatedAt: post.publishedAt,
      sourcePublishedAt: post.publishedAt
    },
    built
  );
}

async function buildNewsFromBeatPost(post) {
  if (!beatFilters.shouldIncludeBeatPost(post) || !beatFilters.isTrustedBeatWriter(post)) return null;
  const sportClassifier = require('./x-autoposter-sport-classifier');
  if (!sportClassifier.isFootballAutoposterEligible(post.text, post)) return null;
  const prefilter = require('./beat-intel-prefilter');
  const guarded = await prefilter.guardBeatPost(post);
  const built = await copy.buildBeatIntelCopyAsync(post);
  if (built?._nonPlayerSkip || built?.skipReason === 'non_player_intel') return null;
  if (built?._nonFootballSkip || built?.skipReason === 'non_football_sport') return null;
  if (built?._needsResolution || built?.skipReason === 'needs_resolution') return null;
  if (built?.skipReason || built?._identitySkip) {
    return {
      ...built,
      triggerPhrase: built.identityFailure?.triggerPhrase || post.text || null,
      playerName: built.identityFailure?.playerName || null
    };
  }
  if (!built?.text || copy.isBrokenCopy(built.text, built)) return null;
  const source = post.writerName || post.outlet || post.handle || 'Beat writer';
  const isProgramNews =
    guarded.triggerType === 'program_news' ||
    built.triggerType === 'program_news' ||
    built?.validationMeta?.programNews;
  const isTeamEvent = guarded.triggerType === 'team_event' || built.triggerType === 'team_event';
  const fpType = isProgramNews ? 'program_news' : isTeamEvent ? 'team_event' : 'beat_intel';
  const fp = intelFingerprint(post.id || post.url, fpType, post.publishedAt);
  const isDecisionDay =
    built?.validationMeta?.eventType === 'decision_day' ||
    /decision day|announcement coming|approaches a commitment decision/i.test(String(post.text || ''));
  return attachNewsMeta(
    {
      text: built.text,
      category: 'news',
      topic: isProgramNews ? 'program' : isTeamEvent ? 'team' : 'recruiting',
      urgencyLabel: isProgramNews || isDecisionDay ? 'breaking' : 'major_beat',
      postUrgency: isProgramNews || isDecisionDay ? 'breaking' : null,
      triggerType: isProgramNews ? 'program_news' : isTeamEvent ? 'team_event' : null,
      teamEventType: guarded.teamEventType || built.teamEventType || null,
      programNewsType: guarded.programNewsType || built.programNewsType || null,
      sourceEventType: fpType,
      sources: [{ label: source, url: post.url || SITE_URL }],
      source: isProgramNews ? 'auto:program-news' : isTeamEvent ? 'auto:team-event' : 'auto:beat-intel',
      intelFingerprint: fp,
      playerName: built.playerName || null,
      identityConfirmed: isProgramNews || isTeamEvent ? true : undefined,
      sourceEventCreatedAt: post.publishedAt,
      sourcePublishedAt: post.publishedAt
    },
    built
  );
}

async function buildNewsFromScheduleEvent(event) {
  const built = copy.buildTeamEventCopyFromSchedule(event.game || event);
  if (!built?.text || copy.isBrokenCopy(built.text, built)) return null;
  const game = event.game || event;
  const fp = intelFingerprint(game.id || game.game, 'team_event_schedule', game.date);
  return attachNewsMeta(
    {
      text: built.text,
      category: 'news',
      topic: 'team',
      urgencyLabel: 'major_beat',
      triggerType: 'team_event',
      teamEventType: event.teamEventType || 'schedule',
      sourceEventType: 'team_event',
      sources: [{ label: 'Schedule', url: SITE_URL }],
      source: 'auto:schedule',
      intelFingerprint: fp,
      identityConfirmed: true,
      sourceEventCreatedAt: event.at || game.date || null
    },
    built
  );
}

async function buildNewsFromPortalEvent(ev) {
  const built = await copy.buildRecruitingEventCopyAsync(ev, { source: 'On3' });
  if (!built?.text || copy.isBrokenCopy(built.text, built)) return null;
  const fp = intelFingerprint(ev.playerSlug || ev.id, ev.eventType, ev.createdAt);
  return attachNewsMeta(
    {
      text: built.text,
      category: 'news',
      topic: 'portal',
      urgencyLabel: 'portal',
      sourceEventType: ev.eventType,
      sources: [{ label: 'On3', url: ON3_PORTAL }],
      source: 'auto:on3-portal',
      intelFingerprint: fp,
      sourceEventId: ev.id,
      sourceEventCreatedAt: ev.createdAt,
      playerName: built.playerName
    },
    built
  );
}

const FORCE_POST_COMMIT_AGE_MS = parseInt(
  process.env.X_AUTOPOST_FORCE_COMMIT_AGE_MS || String(30 * 24 * 60 * 60 * 1000),
  10
);

const BEAT_INTEL_SOURCES = /beat-writer|program-news|team-event|auto:beat|auto:program|auto:team/i;

function isBeatWriterIntel(intel) {
  return BEAT_INTEL_SOURCES.test(String(intel?.source || ''));
}

async function directBeatPostCandidates(freshPosts) {
  const candidates = [];
  const prefilter = require('./beat-intel-prefilter');
  for (const post of freshPosts) {
    const guarded = await prefilter.guardBeatPost(post);
    if (!guarded.eligible) continue;

    const momentum = await buildMomentumFromBeat(post);
    if (momentum) {
      candidates.unshift(momentum);
      continue;
    }
    const beatNews = await buildNewsFromBeatPost(post);
    if (beatNews) candidates.unshift(beatNews);
  }
  return candidates;
}

/** Beat posts → elite original compose by default; cluster quote-RT only when X_AUTOPOST_ELITE_COMPOSE=false. */
async function collectBeatAutoposterCandidates(freshPosts) {
  if (process.env.X_AUTOPOST_ELITE_COMPOSE !== 'false') {
    return directBeatPostCandidates(freshPosts);
  }

  const candidates = [];
  const eventCluster = require('./x-autoposter-event-cluster');
  const clusterFallback = clusterFallbackEnabled();

  if (eventCluster.isClusteringEnabled()) {
    const clusters = await eventCluster.buildClustersFromBeatPosts(freshPosts);
    const handledKeys = new Set();

    for (const cluster of clusters) {
      const out = await eventCluster.buildEliteClusterPost(cluster);
      if (out?.ok && out.queueItem) {
        candidates.unshift(out.queueItem);
        for (const p of cluster.posts || []) handledKeys.add(String(p.id || p.url || ''));
        continue;
      }
      if (clusterFallback && cluster.posts?.length) {
        const direct = await directBeatPostCandidates(cluster.posts);
        for (const row of direct) candidates.unshift(row);
        for (const p of cluster.posts) handledKeys.add(String(p.id || p.url || ''));
      }
    }

    if (clusterFallback) {
      const remainder = freshPosts.filter((p) => !handledKeys.has(String(p.id || p.url || '')));
      if (remainder.length) {
        candidates.unshift(...(await directBeatPostCandidates(remainder)));
      }
    }
  } else {
    candidates.unshift(...(await directBeatPostCandidates(freshPosts)));
  }

  return candidates;
}

async function collectFreshPostCandidates({ forcePost = false } = {}) {
  const candidates = [];
  const maxCommitAgeMs = forcePost ? FORCE_POST_COMMIT_AGE_MS : MAX_COMMIT_EVENT_AGE_MS;
  const maxBeatAgeMs = forcePost ? FORCE_POST_COMMIT_AGE_MS : MAX_BEAT_POST_AGE_MS;
  const maxIntelAgeMs = forcePost ? FORCE_POST_COMMIT_AGE_MS : MAX_INTEL_AGE_MS;

  try {
    const unqueuedIntel = intelStore.getUnqueuedIntel({ maxAgeMs: maxIntelAgeMs });
    const beatIntel = unqueuedIntel.filter(isBeatWriterIntel);
    const otherIntel = unqueuedIntel.filter((i) => !isBeatWriterIntel(i));
    for (const intel of [...beatIntel, ...otherIntel].slice(0, 12)) {
      const eligibility = require('./rivals-prediction-eligibility');
      const gate = await eligibility.checkIntelForAutopost(intel);
      if (!gate.allowed) continue;
      const row = await buildNewsFromIntel(intel);
      if (row) candidates.unshift(row);
    }
  } catch {
    /* optional */
  }

  try {
    const eventCluster = require('./x-autoposter-event-cluster');
    const beat = getBeatPosts(80);
    const beatCutoff = Date.now() - maxBeatAgeMs;
    const sportClassifier = require('./x-autoposter-sport-classifier');
    const freshPosts = sportClassifier.filterFootballBeatPosts(
      (beat.posts || []).filter((p) => new Date(p.publishedAt).getTime() >= beatCutoff)
    );

    const beatCandidates = await collectBeatAutoposterCandidates(freshPosts);
    for (const row of beatCandidates) candidates.unshift(row);
  } catch {
    /* optional */
  }

  try {
    const events = await recruitingStore.getEvents({ limit: 50 });
    const cutoff = Date.now() - maxCommitAgeMs;
    for (const ev of events
      .filter((e) => isCommitAutopostEvent(e))
      .filter((e) => !String(e.title || '').includes('ranking'))
      .filter((e) => new Date(e.createdAt).getTime() >= cutoff)
      .slice(0, 5)) {
      const row = await buildNewsFromEvent(ev);
      if (row) candidates.push(row);
    }
    for (const ev of events
      .filter((e) => e.source === 'on3' && ['portal_in', 'portal_out'].includes(e.eventType))
      .filter((e) => new Date(e.createdAt).getTime() >= cutoff)
      .slice(0, 3)) {
      const row = await buildNewsFromPortalEvent(ev);
      if (row) candidates.push(row);
    }
  } catch {
    /* optional */
  }

  try {
    const portal = await recruitingStore.getPortalBoard();
    const row = await buildNewsFromPortal(portal.headliner);
    if (row) candidates.push(row);
  } catch {
    /* optional */
  }

  try {
    const bettingLines = require('./betting-lines');
    const pending = bettingLines.consumePendingTeamEvents?.() || [];
    for (const event of pending.slice(0, 2)) {
      const row = await buildNewsFromScheduleEvent(event);
      if (row) candidates.unshift(row);
    }
  } catch {
    /* optional */
  }

  try {
    const articles = contentStore.loadPublishedArticles();
    if (articles[0]) {
      const row = buildNewsFromArticle(articles[0]);
      if (row) candidates.push(row);
    }
  } catch {
    /* optional */
  }

  return candidates;
}

async function refillAutoposterQueue({
  minPending = parseInt(process.env.X_AUTOPOST_REFILL_MIN_PENDING || '5', 10),
  maxEnqueue = parseInt(process.env.X_AUTOPOST_REFILL_MAX_ENQUEUE || '8', 10),
  forcePost = false
} = {}) {
  if (!pipelineGuards.autopostEnabled()) {
    return { ok: true, skipped: true, reason: 'autoposter disabled', pending: 0, enqueued: [] };
  }
  let beatPrep = null;
  try {
    beatPrep = await prepareBeatFirstAutoposter({ forceIngest: forcePost });
  } catch {
    /* optional */
  }
  try {
    intelStore.reconcileGhostQueuedIntel();
  } catch {
    /* optional */
  }
  const doc = store.loadQueue();
  const pending = doc.items.filter((i) => i.status === 'pending');
  const need = Math.max(minPending - pending.length, pending.length === 0 ? 1 : 0);
  if (need <= 0 && pending.length >= minPending) {
    return { ok: true, skipped: true, reason: 'queue_full', pending: pending.length, enqueued: [] };
  }

  const slots = Math.max(maxEnqueue - pending.length, need);
  const rawNewsCandidates = await collectFreshPostCandidates({ forcePost });
  const validatedNews = [];
  for (const raw of rawNewsCandidates) {
    if (raw?._nonPlayerSkip || raw?.skipReason === 'non_player_intel') continue;
    if (raw?._needsResolution || raw?.skipReason === 'needs_resolution') continue;
    if (raw?.skipReason || raw?._identitySkip) continue;
    const scored = await finalizeNewsCandidate(raw);
    if (scored) validatedNews.push(scored);
  }

  /** Content-mix (50/30/20) runs only after news quality scoring. */
  const allowPromo = process.env.X_AUTOPOST_ALLOW_PROMO === 'true';
  const finalCandidates = [...validatedNews];
  if (allowPromo) {
    const promo = buildPromoFromMix();
    if (promo) finalCandidates.push(promo);
  }

  const enqueued = [];
  let added = 0;
  let qualitySkipped = rawNewsCandidates.length - validatedNews.length;
  for (const raw of finalCandidates) {
    if (added >= slots) break;
    const fp = raw.intelFingerprint || raw.commitFingerprint;
    if (fp && fingerprintAlreadyQueued(fp, doc.items)) continue;
    if (
      raw.commitFingerprint &&
      commitAlreadyQueued(raw.commitFingerprint, doc.items, {
        slug: raw.playerSlug,
        text: raw.text,
        eventType: raw.sourceEventType,
      })
    ) {
      continue;
    }
    if (alreadyQueued(raw.text, doc.items)) continue;
    const similar = similarPostQueued(raw.text, doc.items);
    if (similar) {
      console.log(
        `[x-autoposter] skip: similar post (${Math.round((similar.similarity || 0) * 100)}% overlap, item ${similar.itemId})`
      );
      continue;
    }
    const gm2 = require('./gm2');
    if (!gm2.filterAutoposterCandidate(raw)) continue;
    const check = policy.validatePostContent(raw);
    if (!check.valid) continue;
    try {
      const tagged = cadence.tagCandidate({
        ...raw,
        qualityScore: raw.qualityScore ?? check.qualityScore ?? null,
        qualityBreakdown: raw.qualityBreakdown ?? check.qualityBreakdown ?? null,
        sourceConfidence: raw.sourceConfidence ?? check.sourceConfidence ?? null
      });
      const out = store.enqueuePost({
        ...tagged,
        scheduledAt: store.nowIso(),
        status: 'pending'
      });
      enqueued.push(out.item);
      doc.items.push(out.item);
      if (raw.sourceIntelId) {
        const marked = intelStore.markIntelXPostQueued(raw.sourceIntelId, { queueItemId: out.item.id });
        if (!marked) {
          console.warn(
            `[x-autoposter] enqueue ok but intel mark failed for ${raw.sourceIntelId} (${out.item.id})`
          );
        }
      }
      added += 1;
    } catch (err) {
      console.warn(`[x-autoposter] refill enqueue failed: ${err.message}`, {
        player: raw.playerName,
        fingerprint: raw.intelFingerprint || raw.commitFingerprint
      });
    }
  }

  return {
    ok: true,
    skipped: false,
    pending: pending.length,
    enqueued,
    enqueuedCount: enqueued.length,
    qualitySkipped,
    validatedNewsCount: validatedNews.length,
    beatPrep
  };
}

/**
 * Queue a UF commit/flip for X immediately after ingest (On3 or beat-verified allowlist).
 * Accepts a persisted recruiting event or a synthetic payload from allowlist ingest.
 */
async function queueCommitEventAutopost(input, { urgent = true } = {}) {
  if (!pipelineGuards.autopostEnabled()) {
    return { queued: false, reason: 'autoposter_disabled' };
  }

  const player = input.payload?.player || input.player || null;
  const eventType = input.eventType || (input.event?.eventType) || 'commit';
  const source = input.source || input.event?.source || 'on3';
  const ev = {
    id: input.id || input.event?.id || null,
    eventType,
    source,
    playerSlug: input.playerSlug || player?.slug || null,
    title: input.title || input.event?.title || null,
    skinny: input.skinny || input.event?.skinny || null,
    detail: input.detail || input.event?.detail || null,
    createdAt: input.createdAt || input.event?.createdAt || new Date().toISOString(),
    payload: { player: player || input.payload?.player },
  };

  if (!isCommitAutopostEvent(ev)) {
    return { queued: false, reason: 'ineligible_source', source: ev.source };
  }

  const doc = store.loadQueue();
  const slug = player?.slug || ev.playerSlug || null;
  const fp = commitFingerprint(player || { slug: ev.playerSlug });
  if (fp && commitAlreadyQueued(fp, doc.items, { slug, eventType: ev.eventType })) {
    return { queued: false, reason: 'duplicate', commitFingerprint: fp };
  }

  const raw = await buildNewsFromEvent(ev);
  if (!raw) return { queued: false, reason: 'invalid_copy' };

  const scored = await finalizeNewsCandidate({
    ...raw,
    postUrgency: urgent ? 'breaking' : raw.postUrgency,
    scheduledAt: new Date(Date.now() + (urgent ? 60 : 120) * 1000).toISOString(),
    status: 'pending',
  });
  if (!scored) return { queued: false, reason: 'quality_gate' };

  if (commitAlreadyQueued(fp, doc.items, { slug, text: scored.text, eventType: ev.eventType })) {
    return { queued: false, reason: 'duplicate', commitFingerprint: fp };
  }
  if (similarPostQueued(scored.text, doc.items)) {
    return { queued: false, reason: 'similar_post' };
  }

  const gm2 = require('./gm2');
  if (!gm2.filterAutoposterCandidate(scored)) {
    return { queued: false, reason: 'gm2_rejected' };
  }

  const check = policy.validatePostContent(scored);
  const verifiedCommit = scored.verifiedCommit || scored.validationMeta?.verifiedCommit;
  const policyBlocked =
    !check.valid &&
    !(verifiedCommit && check.errors.every((e) => e.type === 'below_threshold' || e.rule === 'score'));
  if (policyBlocked) return { queued: false, reason: 'policy', errors: check.errors };

  const out = store.enqueuePost({
    ...scored,
    qualityScore: scored.qualityScore ?? check.scored?.score ?? null,
    qualityBreakdown: scored.qualityBreakdown ?? check.scored?.breakdown ?? null,
    sourceConfidence: scored.sourceConfidence ?? check.scored?.sourceConfidence ?? null,
  });

  return { queued: true, item: out.item, commitFingerprint: fp };
}

/** Force-post: enqueue recent On3/beat commits even when normal freshness window expired. */
async function forceEnqueueRecentCommits({ maxAgeMs = FORCE_POST_COMMIT_AGE_MS } = {}) {
  if (!pipelineGuards.autopostEnabled()) {
    return { queued: false, reason: 'autoposter_disabled' };
  }

  store.recoverFailedVerifiedCommits();
  store.recoverFailedPostableItems({ maxAgeMs });

  const pending = store.listQueue({ status: 'pending' });
  if (pending.length) {
    return { queued: false, reason: 'already_pending', pending: pending.length };
  }

  const cutoff = Date.now() - maxAgeMs;
  const events = await recruitingStore.getEvents({ limit: 120 });
  const commits = events
    .filter((e) => isCommitAutopostEvent(e))
    .filter((e) => !String(e.title || '').includes('ranking'))
    .filter((e) => new Date(e.createdAt).getTime() >= cutoff)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  for (const ev of commits) {
    const result = await queueCommitEventAutopost(ev, { urgent: true });
    if (result.queued) return result;
  }

  return { queued: false, reason: 'no_eligible_commits', scanned: commits.length };
}

module.exports = {
  refillAutoposterQueue,
  collectFreshPostCandidates,
  collectBeatAutoposterCandidates,
  directBeatPostCandidates,
  isBeatWriterIntel,
  finalizeNewsCandidate,
  alreadyQueued,
  similarPostQueued,
  dedupeKey,
  fingerprintAlreadyQueued,
  buildNewsFromIntel,
  buildNewsFromBeatPost,
  buildMomentumFromBeat,
  queueCommitEventAutopost,
  forceEnqueueRecentCommits,
  prepareBeatFirstAutoposter,
  isCommitAutopostEvent,
  COMMIT_EVENT_SOURCES,
  FORCE_POST_COMMIT_AGE_MS,
};
