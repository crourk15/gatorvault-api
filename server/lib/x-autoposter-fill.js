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
const { commitFingerprint, intelFingerprint, stableIntelFingerprint } = require('./commit-fingerprint');
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
  let on3News = null;
  const beatEmpty =
    !(cache.postCount || 0) ||
    cache.reason === 'no_fetch_credentials' ||
    /X_BEARER_TOKEN not set/i.test(String(cache.error || ''));
  if (beatEmpty && process.env.X_AUTOPOST_ON3_NEWS_FALLBACK !== 'false') {
    try {
      const { runUfOn3NewsDiscovery } = require('./uf-on3-news-discovery');
      on3News = await runUfOn3NewsDiscovery({
        classYear: 2028,
        maxArticles: 20,
        queueAutoposter: pipelineGuards.autopostEnabled()
      });
    } catch (err) {
      on3News = { ok: false, error: err.message };
    }
  }
  return { cache, ingest, on3News };
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
const MAX_BEAT_INTEL_AGE_MS = parseInt(
  process.env.X_AUTOPOST_MAX_BEAT_INTEL_AGE_MS || String(postSpec.MAX_BEAT_INTEL_AGE_MS),
  10
);

const REFILL_PREP_TIMEOUT_MS = parseInt(process.env.X_AUTOPOST_REFILL_PREP_TIMEOUT_MS || '20000', 10);
const REFILL_WIDE_TIMEOUT_MS = parseInt(process.env.X_AUTOPOST_REFILL_WIDE_TIMEOUT_MS || '45000', 10);
const REFILL_INTEL_COLLECT_TIMEOUT_MS = parseInt(
  process.env.X_AUTOPOST_INTEL_COLLECT_TIMEOUT_MS || '40000',
  10
);
const REFILL_GOLDEN_FOUR_TIMEOUT_MS = parseInt(process.env.X_AUTOPOST_GOLDEN_FOUR_TIMEOUT_MS || '30000', 10);
const MAX_BEAT_INTEL_SCAN = parseInt(process.env.X_AUTOPOST_MAX_BEAT_INTEL_SCAN || '32', 10);
const MAX_BEAT_INTEL_BUILD = parseInt(process.env.X_AUTOPOST_MAX_BEAT_INTEL_BUILD || '4', 10);

function dedupeIntelByPlayerSlug(rows) {
  const bySlug = new Map();
  for (const row of rows || []) {
    const slug = String(row.playerSlug || '').trim().toLowerCase();
    if (!slug) continue;
    const prev = bySlug.get(slug);
    if (!prev) {
      bySlug.set(slug, row);
      continue;
    }
    const prevTs = new Date(prev.reportedAt || prev.createdAt).getTime();
    const rowTs = new Date(row.reportedAt || row.createdAt).getTime();
    if (rowTs > prevTs) bySlug.set(slug, row);
  }
  return [...bySlug.values()];
}

async function selectBeatIntelForAutopost(beatIntel, { limit = MAX_BEAT_INTEL_SCAN } = {}) {
  const deduped = dedupeIntelByPlayerSlug(beatIntel);
  let tierA = null;
  let wasMentionedRecently = null;
  try {
    const tiers = require('./player-intelligence/tiers');
    tierA = await tiers.loadTierASlugs();
    wasMentionedRecently = tiers.wasMentionedRecently;
  } catch {
    /* optional */
  }
  const scored = deduped.map((row) => {
    const slug = String(row.playerSlug || '').trim().toLowerCase();
    let tierRank = 2;
    if (tierA && slug && tierA.has(slug)) tierRank = 0;
    else if (wasMentionedRecently && slug && wasMentionedRecently(slug)) tierRank = 1;
    const on3News = /on3-team-news/i.test(String(row.source || '')) ? 0 : 1;
    const on3Promoted =
      /on3-team-news/i.test(String(row.source || '')) &&
      slug &&
      String(row.articleUrl || row.sourceUrl || '')
        .toLowerCase()
        .includes(slug);
    const ts = new Date(row.reportedAt || row.createdAt).getTime();
    return { row, tierRank, on3News, on3Promoted, ts };
  });
  scored.sort((a, b) => {
    if (a.on3Promoted !== b.on3Promoted) return a.on3Promoted ? -1 : 1;
    if (a.tierRank !== b.tierRank) return a.tierRank - b.tierRank;
    if (a.on3News !== b.on3News) return a.on3News - b.on3News;
    return b.ts - a.ts;
  });
  const cap = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Number(limit) : scored.length;
  return scored.slice(0, cap).map((s) => s.row);
}

async function buildCandidatesFromIntelRows(intelRows, { maxBuild = MAX_BEAT_INTEL_BUILD } = {}) {
  const eligibility = require('./rivals-prediction-eligibility');
  const candidates = [];
  const cap = Number.isFinite(Number(maxBuild)) && Number(maxBuild) > 0 ? Number(maxBuild) : MAX_BEAT_INTEL_BUILD;
  for (const intel of intelRows) {
    if (candidates.length >= cap) break;
    const gate = await eligibility.checkIntelForAutopost(intel);
    if (!gate.allowed) continue;
    const row = await buildNewsFromIntel(intel);
    if (row) candidates.unshift(row);
  }
  return candidates;
}

async function collectUnqueuedIntelCandidates({ forcePost = false, maxBuild } = {}) {
  const buildCap = Number.isFinite(Number(maxBuild)) && Number(maxBuild) > 0 ? Number(maxBuild) : MAX_BEAT_INTEL_BUILD;
  const candidates = [];
  const maxIntelAgeMs = forcePost ? FORCE_POST_COMMIT_AGE_MS : MAX_INTEL_AGE_MS;
  try {
    const beatIntel = intelStore
      .getUnqueuedIntel({ maxAgeMs: forcePost ? maxIntelAgeMs : MAX_BEAT_INTEL_AGE_MS })
      .filter(isBeatWriterIntel);
    const beatScan = await selectBeatIntelForAutopost(beatIntel, { limit: Math.max(buildCap * 2, 12) });
    const otherIntel = dedupeIntelByPlayerSlug(
      intelStore.getUnqueuedIntel({ maxAgeMs: maxIntelAgeMs }).filter((i) => !isBeatWriterIntel(i))
    ).slice(0, buildCap);
    candidates.push(...(await buildCandidatesFromIntelRows([...beatScan, ...otherIntel], { maxBuild: buildCap })));
  } catch (err) {
    console.warn('[x-autoposter] intel candidate collect failed:', err.message);
  }
  return prioritizePostCandidates(candidates);
}

function withRefillTimeout(promise, ms, label = 'refill_step') {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label}_timeout_${ms}ms`)), ms);
    })
  ]).finally(() => clearTimeout(timer));
}

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
    validationMeta: { ...(row.validationMeta || {}), ...(built.validationMeta || {}) },
    playerContext: built.playerContext || row.playerContext
  };
}

function dedupeKey(text) {
  return crypto.createHash('sha256').update(String(text || '').trim().toLowerCase()).digest('hex').slice(0, 16);
}

const QUEUED_STATUSES = new Set(['pending', 'sent', 'skipped_duplicate', 'failed']);

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
  const ledgerHit = sentLedger.hasRecentSentPost({ text });
  if (ledgerHit.hit) return true;
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

function similarPostQueued(text, items, meta = {}) {
  const ledgerHit = sentLedger.hasRecentSentPost({
    text,
    slug: meta.slug || meta.playerSlug,
    intelFingerprint: meta.intelFingerprint,
  });
  if (ledgerHit.hit) {
    return { hit: true, itemId: ledgerHit.tweetId || 'sent-ledger', similarity: 1, reason: ledgerHit.reason };
  }
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

async function probeIntelAutoposterPath(slug) {
  const normalized = String(slug || '')
    .trim()
    .toLowerCase();
  if (!normalized) return { ok: false, error: 'missing_slug' };

  await intelStore.initIntelStore().catch(() => {});

  const { matchIntelToPlayer } = require('./autoposter/identity-matcher');
  const { isEligibleIntel, assessEligibilityFromIntel } = require('./autoposter/autoposter-policy');
  const { resolveCoverageTier } = require('./player-intelligence/tiers');
  const { fusePlayerIntel } = require('./player-intelligence/fuse-player-intel');
  const qa = require('./autoposter/recruiting-post-qa');

  const allRows = intelStore.getIntelForPlayer({ playerSlug: normalized }) || [];
  const unqueued = intelStore.getUnqueuedIntel({ maxAgeMs: MAX_BEAT_INTEL_AGE_MS });
  const beatUnqueued = unqueued.filter(isBeatWriterIntel);
  const scan = await selectBeatIntelForAutopost(beatUnqueued);
  const on3Row =
    allRows.find((row) => /on3-team-news/i.test(String(row.source || ''))) ||
    allRows.find((row) => isBeatWriterIntel(row)) ||
    null;

  let tier = null;
  let eligibility = null;
  let fuse = null;
  let build = null;
  let finalized = null;
  let resolution = null;

  if (on3Row) {
    const player = matchIntelToPlayer(on3Row);
    tier = await resolveCoverageTier(normalized);
    eligibility = {
      playerMatched: !!player,
      eligible: isEligibleIntel(on3Row, player),
      reasons: assessEligibilityFromIntel(on3Row, player).reasons
    };
    fuse = await fusePlayerIntel(normalized, { persist: false });
    build = await buildNewsFromIntel(on3Row);
    if (build) finalized = await finalizeNewsCandidate(build);
  }

  try {
    const ledger = require('./autoposter/player-resolution-ledger');
    resolution = ledger.checkPlayerResolution(normalized, {
      allowGoldenFour: true,
      intelFingerprint: on3Row?.fingerprint || null
    });
  } catch {
    /* optional */
  }

  return {
    ok: true,
    slug: normalized,
    intelStore: await intelStore.getIntelStoreDiagnostics().catch((err) => ({ error: err.message })),
    intelRowCount: allRows.length,
    on3Row: on3Row
      ? {
          id: on3Row.id,
          source: on3Row.source,
          xPostQueued: !!on3Row.xPostQueued,
          xPosted: !!on3Row.xPosted,
          ufRelevant: on3Row.ufRelevant,
          articleUrl: on3Row.articleUrl || null,
          fingerprint: on3Row.fingerprint || null
        }
      : null,
    inBeatUnqueued: beatUnqueued.some((row) => row.playerSlug === normalized),
    inBeatScan: scan.some((row) => row.playerSlug === normalized),
    beatScanIndex: scan.findIndex((row) => row.playerSlug === normalized),
    beatScanSize: scan.length,
    tier,
    eligibility,
    resolution,
    fuse: fuse
      ? {
          confidence: fuse.confidence,
          publishAction: fuse.publishAction,
          urlSlugMatch: fuse.urlSlugMatch,
          beatLen: String(fuse.beatText || '').length,
          gaps: fuse.gaps || []
        }
      : null,
    build: build
      ? {
          ok: true,
          fusedIntel: !!build.validationMeta?.fusedIntel,
          source: build.source,
          preview: String(build.text || '').slice(0, 160)
        }
      : { ok: false },
    finalize: !!finalized,
    publishGate: finalized ? qa.passesPublishGate(finalized) : null,
    publishGateReason: finalized && !qa.passesPublishGate(finalized) ? qa.rejectReason(finalized) : null
  };
}

async function buildNewsFromIntel(intel) {
  const { matchIntelToPlayer } = require('./autoposter/identity-matcher');
  const { isEligibleIntel } = require('./autoposter/autoposter-policy');
  const player = matchIntelToPlayer(intel);
  if (!player) return null;
  if (!isEligibleIntel(intel, player)) return null;

  const slug = String(intel.playerSlug || player?.playerId || '')
    .trim()
    .toLowerCase();
  if (slug) {
    try {
      const { resolveCoverageTier } = require('./player-intelligence/tiers');
      const tier = await resolveCoverageTier(slug);
      if (tier === 'A' || tier === 'B') {
        const { fusePlayerIntel, fusedBeatIntelEnqueueAllowed } = require('./player-intelligence/fuse-player-intel');
        const { composeFromFusedIntel } = require('./player-intelligence/compose-from-fused-intel');
        const fused = await fusePlayerIntel(slug);
        if (!fusedBeatIntelEnqueueAllowed(fused, tier, intel)) return null;
        const composed = composeFromFusedIntel(fused);
        if (composed?.ok && composed.text) {
          const fp = intel.fingerprint || intelFingerprint(intel.playerId, intel.eventType, intel.timestamp);
          const intelType = String(intel.eventType || '').toLowerCase();
          const intelSource = String(intel.source || '');
          const urgentIntel = /visit_cancel|visit_scheduled|rivals_prediction|prediction_change|prediction/.test(
            intelType
          );
          const beatIntel =
            /beat|on3-team-news|detectives|auto:on3/i.test(intelSource) ||
            intel.sourceType === 'beat';
          return attachNewsMeta(
            {
              text: composed.text,
              category: 'news',
              topic: 'recruiting',
              urgencyLabel: /injury/.test(intelType)
                ? 'injury'
                : urgentIntel || beatIntel
                  ? 'major_beat'
                  : null,
              postUrgency: beatIntel ? 'urgent' : null,
              sourceEventType: intel.eventType,
              sources: (fused.sources || []).slice(0, 3).map((s) => ({ label: s.label, url: s.url })),
              source: intelSource || 'auto:intel-fused',
              intelFingerprint: fp,
              intelType: intel.eventType,
              playerName: composed.playerName || intel.playerName,
              playerSlug: slug,
              classYear: intel.classYear || player?.classYear || null,
              sourceIntelId: intel.id,
              sourceEventCreatedAt: intel.timestamp || intel.createdAt || null,
              eventTimestamp: intel.timestamp || intel.createdAt || null,
              validationMeta: {
                ...(composed.validationMeta || {}),
                beatText: fused.beatText,
                situation: postSpec.detectSituation(fused.beatText, intel.eventType),
                fusedIntel: true,
                fuseConfidence: fused.confidence
              },
              templateBlocks: composed.templateBlocks
            },
            composed
          );
        }
      }
    } catch (err) {
      console.warn('[x-autoposter] fused intel compose failed:', err.message);
    }
  }

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

function isDetectivesPlayerPost(raw) {
  return (
    String(raw?.source || '').includes('detectives') ||
    raw?.validationMeta?.detectivesResolved === true
  );
}

function isProgramOrTeamNews(raw) {
  if (isDetectivesPlayerPost(raw)) return false;
  return (
    raw?.triggerType === 'program_news' ||
    raw?.triggerType === 'team_event' ||
    raw?.identityConfirmed === true ||
    raw?.validationMeta?.programNews ||
    raw?.validationMeta?.ufOfficialFootball ||
    String(raw?.source || '').includes('program-news') ||
    String(raw?.source || '').includes('team-event') ||
    String(raw?.source || '').includes('uf-official')
  );
}

function prepareNewsCandidate(raw) {
  if (!raw?.text && !raw?._articleBuild) return null;
  if (raw?.text && copy.isBrokenCopy(raw.text, raw)) return null;
  try {
    const qa = require('./autoposter/recruiting-post-qa');
    const pr789Elite = validation.isPr789AngleElitePost(raw);
    if (qa.isRecruitingPlayerCandidate(raw) && !pr789Elite && !qa.passesPublishGate(raw)) return null;
  } catch {
    /* optional */
  }

  const eventMs = validation.resolveEventTimestamp(raw);
  const fresh = postSpec.validateIntelFreshness(eventMs);
  const relaxedFreshness =
    raw.source === 'auto:article' ||
    raw.source === 'auto:heat-mover' ||
    raw.source === 'auto:uf-official-news' ||
    raw.source === 'auto:detectives' ||
    raw.source === 'auto:on3-team-news' ||
    raw.source === 'auto:intel-fused' ||
    raw.validationMeta?.fusedIntel === true ||
    validation.isPr789AngleElitePost(raw) ||
    isProgramOrTeamNews(raw);
  if (!fresh.ok && !relaxedFreshness) {
    console.log(`[x-autoposter] skip: ${fresh.logTag || fresh.skipReason} — ${fresh.reason}`);
    return null;
  }

  const gate = validation.passesNewsQualityGate(raw);
  const verifiedCommit = raw.verifiedCommit || raw.validationMeta?.verifiedCommit;
  const programOrTeam = isProgramOrTeamNews(raw);
  const softFailOnly =
    gate.scored?.errors?.length &&
    gate.scored.errors.every((e) => e.type === 'below_threshold' || e.rule === 'score');

  if (
    !gate.pass &&
    (verifiedCommit || programOrTeam) &&
    !(gate.scored?.hardSkips?.length) &&
    (verifiedCommit || softFailOnly || programOrTeam)
  ) {
    return {
      ...raw,
      qualityScore: Math.max(gate.scored?.score ?? 0, validation.POSTING_THRESHOLD || 85),
      qualityBreakdown: gate.scored?.breakdown ?? null,
      sourceConfidence: gate.scored?.sourceConfidence ?? validation.SOURCE_CONFIDENCE_REQUIRED ?? 100,
      situation: raw.situation || postSpec.detectSituation(raw.text, raw.sourceEventType || raw.intelType),
      verifiedCommit: !!verifiedCommit,
      identityConfirmed: raw.identityConfirmed || programOrTeam || undefined
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

function emptyQueueFallbackEnabled() {
  return process.env.X_AUTOPOST_EMPTY_QUEUE_FALLBACK !== 'false';
}

async function buildEngagementPulsePost() {
  try {
    const { buildHeatCheck } = require('./heat-check-store');
    const heat = await buildHeatCheck();
    const rising = (heat?.rising || []).filter((r) => r?.name);
    const top = rising[0];
    if (top?.name) {
      const pos = top.pos ? ` (${top.pos})` : '';
      return {
        text: `🐊 GatorVault Intel: ${top.name}${pos} momentum building for Florida — full RPM + visit intel inside. ${SITE_URL}`,
        category: 'engagement',
        topic: 'recruiting',
        sources: [{ label: 'GatorVault Heat Check', url: SITE_URL }],
        source: 'auto:heat-pulse',
        playerName: top.name
      };
    }
  } catch {
    /* optional */
  }
  return buildPromoFromMix();
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
  const combined = `${article.title} ${article.summary || ''}`;
  const playerName = copy.extractPlayerFromText(combined);
  let prefilter = null;
  try {
    prefilter = require('./beat-intel-prefilter');
  } catch {
    /* optional */
  }
  const programNewsType = prefilter?.classifyProgramNewsType?.(combined) || null;
  const isUfFootballArticle =
    /\b(gator|florida gators|uf football|gator football|florida football)\b/i.test(combined);
  if (!playerName && !programNewsType && !isUfFootballArticle) return null;

  const fp = intelFingerprint(article.id || article.title, 'article', article.publishedAt || article.date);
  const publishedAt = article.publishedAt || article.date || article.postDateGMT || null;
  const base = {
    text: null,
    category: 'news',
    sources: [{ label: article.author || 'GatorVault Insider', url: SITE_URL }],
    source: 'auto:article',
    intelFingerprint: fp,
    sourceEventCreatedAt: publishedAt,
    sourcePublishedAt: publishedAt,
    _articleBuild: article
  };

  if (programNewsType) {
    return {
      ...base,
      topic: 'program',
      urgencyLabel: 'analysis',
      postUrgency: programNewsType === 'hall_of_fame' ? 'breaking' : null,
      sourceEventType: 'program_news',
      triggerType: 'program_news',
      programNewsType,
      identityConfirmed: true,
      playerName: null
    };
  }

  if (!playerName && isUfFootballArticle) {
    return {
      ...base,
      topic: 'general',
      urgencyLabel: 'analysis',
      sourceEventType: 'article',
      identityConfirmed: true,
      playerName: null,
      validationMeta: { programNews: true, articleTopic: 'uf_football' }
    };
  }

  return {
    ...base,
    topic: 'general',
    urgencyLabel: 'analysis',
    sourceEventType: 'article',
    playerName
  };
}

function collectArticlePostCandidates({ limit, forcePost = false } = {}) {
  const maxItems = limit || parseInt(process.env.X_AUTOPOST_ARTICLE_HARVEST_LIMIT || '8', 10);
  const forceAgeMs = parseInt(
    process.env.X_AUTOPOST_FORCE_COMMIT_AGE_MS || String(30 * 24 * 60 * 60 * 1000),
    10
  );
  const maxAgeMs = forcePost
    ? forceAgeMs
    : parseInt(process.env.X_AUTOPOST_ARTICLE_MAX_AGE_MS || String(14 * 24 * 60 * 60 * 1000), 10);
  const cutoff = Date.now() - maxAgeMs;
  const articles = contentStore.loadPublishedArticles();
  const rows = [];
  for (const article of articles) {
    if (!article?.title) continue;
    const ts = new Date(article.publishedAt || article.date || article.postDateGMT || 0).getTime();
    if (!forcePost && (Number.isNaN(ts) || ts < cutoff)) continue;
    const row = buildNewsFromArticle(article);
    if (row) rows.push(row);
    if (rows.length >= maxItems) break;
  }
  return rows;
}

const TOPIC_PRIORITY = {
  program_news: 0,
  team_event: 1,
  uf_official_news: 1,
  roster_delta: 2,
  game_week: 2,
  commitment: 3,
  portal: 4,
  scouting_update: 5,
  research_ladder: 6,
  beat_intel: 7,
  heat_mover: 8,
  article: 9,
  recruiting_momentum: 10,
  evergreen: 11,
  program_history: 11,
  general: 12
};

function candidateTopicRank(raw) {
  if (raw?.triggerType === 'program_news' || raw?.programNewsType) return TOPIC_PRIORITY.program_news;
  if (raw?.triggerType === 'team_event' || raw?.teamEventType) return TOPIC_PRIORITY.team_event;
  if (raw?.source === 'auto:uf-official-news') return TOPIC_PRIORITY.uf_official_news;
  if (raw?.source === 'auto:roster-delta') return TOPIC_PRIORITY.roster_delta;
  if (raw?.source === 'auto:game-zone') return TOPIC_PRIORITY.game_week;
  if (raw?.source === 'auto:scouting-update') return TOPIC_PRIORITY.scouting_update;
  if (raw?.source === 'auto:heat-mover' || raw?.sourceEventType === 'heat_mover') return TOPIC_PRIORITY.heat_mover;
  if (raw?.source === 'auto:research-ladder') return TOPIC_PRIORITY.research_ladder;
  if (raw?.source === 'auto:evergreen' || raw?.sourceEventType === 'evergreen') return TOPIC_PRIORITY.evergreen;
  if (raw?.source === 'auto:program-history' || raw?.sourceEventType === 'program_history') return TOPIC_PRIORITY.program_history;
  const eventType = String(raw?.sourceEventType || raw?.eventType || '').toLowerCase();
  if (/commit|flip/.test(eventType)) return TOPIC_PRIORITY.commitment;
  if (/portal/.test(eventType)) return TOPIC_PRIORITY.portal;
  if (eventType === 'heat_mover') return TOPIC_PRIORITY.heat_mover;
  if (eventType === 'article' || raw?.source === 'auto:article') return TOPIC_PRIORITY.article;
  if (eventType === 'recruiting_momentum') return TOPIC_PRIORITY.recruiting_momentum;
  if (String(raw?.source || '').includes('beat')) return TOPIC_PRIORITY.beat_intel;
  return TOPIC_PRIORITY.general;
}

function prioritizePostCandidates(candidates) {
  if (process.env.X_AUTOPOST_TOPIC_ROTATION === 'false') return candidates;
  let perf = null;
  let timeBucket = null;
  try {
    perf = require('./autoposter/performance-tracker');
  } catch {
    /* optional */
  }
  try {
    timeBucket = require('./autoposter/time-bucket');
  } catch {
    /* optional */
  }
  let engagement = null;
  try {
    engagement = require('./autoposter/engagement-tracker');
  } catch {
    /* optional */
  }
  const bucket = timeBucket?.getTimeBucket?.();
  return [...(candidates || [])].sort((a, b) => {
    const pa =
      candidateTopicRank(a) +
      (perf?.candidatePerformanceBoost?.(a) || 0) +
      (timeBucket?.candidateTimeBucketBoost?.(a, bucket) || 0) +
      (engagement?.candidateEngagementBoost?.(a) || 0);
    const pb =
      candidateTopicRank(b) +
      (perf?.candidatePerformanceBoost?.(b) || 0) +
      (timeBucket?.candidateTimeBucketBoost?.(b, bucket) || 0) +
      (engagement?.candidateEngagementBoost?.(b) || 0);
    if (pa !== pb) return pa - pb;
    const ta = new Date(a.sourceEventCreatedAt || a.sourcePublishedAt || 0).getTime();
    const tb = new Date(b.sourceEventCreatedAt || b.sourcePublishedAt || 0).getTime();
    return tb - ta;
  });
}

async function collectDigDeeperPostCandidates({ forcePost = false } = {}) {
  const out = [];
  for (const row of collectArticlePostCandidates({ limit: 10, forcePost: true })) {
    out.push(row);
  }
  try {
    const { buildHeatCheck } = require('./heat-check-store');
    const heat = await buildHeatCheck();
    for (const row of (heat?.rising || []).slice(0, 5)) {
      if (!row?.name) continue;
      const slug = row.slug || String(row.name).toLowerCase().replace(/\s+/g, '-');
      const fp = stableIntelFingerprint(slug, 'heat_mover');
      const dup = sentLedger.hasRecentSentPost({ slug, intelFingerprint: fp, text: row.name });
      if (dup.hit) continue;
      const classYear = row.classYear ? `${row.classYear} ` : '';
      const pos = row.pos ? ` ${row.pos}` : '';
      const identity = `${classYear}${row.name}${pos}`.trim();
      const text = [
        identity,
        'GatorVault Heat Check — RPM momentum building on the Florida board.',
        'Full prediction + visit intel ↓',
        `${SITE_URL}/vault/futurecast/player/${slug}`
      ].join('\n');
      out.push({
        text,
        category: 'news',
        topic: 'recruiting',
        urgencyLabel: 'analysis',
        sourceEventType: 'heat_mover',
        sources: [{ label: 'GatorVault Heat Check', url: SITE_URL }],
        source: 'auto:heat-mover',
        intelFingerprint: fp,
        playerName: row.name,
        playerSlug: slug,
        sourceEventCreatedAt: store.nowIso(),
        validationMeta: { eliteCompose: true, heatMover: true },
        templateBlocks: {
          identity,
          context: 'GatorVault Heat Check — RPM momentum building on the Florida board.',
          insider: 'Full prediction + visit intel on FutureCast.'
        }
      });
    }
  } catch {
    /* optional */
  }
  try {
    const phase3 = require('./autoposter/phase3-index');
    for (const row of phase3.evergreenLibrary.collectEvergreenCandidates({ limit: 4, forcePost: true })) {
      out.push(row);
    }
  } catch {
    /* optional */
  }
  return out;
}

const MAX_LADDER_DEPTH = parseInt(process.env.X_AUTOPOST_RESEARCH_LADDER_DEPTH || '2', 10);

async function tryResearchLadder(rawCandidate, reason, doc, ladderDepth) {
  if (ladderDepth >= MAX_LADDER_DEPTH || !rawCandidate) return null;
  try {
    const rl = require('./autoposter/research-ladder');
    if (!rl.ladderEnabled()) return null;
    const dig = rl.digOnFilterSkipEnabled();
    const phase3 = require('./autoposter/phase3-index');
    if (!dig && !phase3.phase3Enabled()) return null;
    const alt = await rl.buildResearchLadderCandidate(rawCandidate, reason);
    if (!alt) return null;
    return attemptEnqueueCandidate(alt, doc, { ladderDepth: ladderDepth + 1, skipDetectives: true });
  } catch {
    return null;
  }
}

async function finalizeEnqueueFailure(rawCandidate, doc, result, opts = {}) {
  if (opts.skipDetectives || result?.queued) return result;
  try {
    const det = require('./autoposter/detectives');
    const detectivesPayload = {
      candidate: rawCandidate,
      beatPost: opts.beatPost || null,
      skipReason: result.reason,
      skipStage: opts.skipStage || 'enqueue',
      hints: {
        playerName: rawCandidate?.playerName,
        playerSlug: rawCandidate?.playerSlug,
        handle: opts.beatPost?.handle,
        writerName: opts.beatPost?.writerName,
        url: opts.beatPost?.url
      }
    };
    if (!det.detectivesEnabled() || !det.shouldHandoff(result.reason, detectivesPayload)) return result;
    const handoff = await det.handoffToDetectives(detectivesPayload);
    const resolved = await det.tryImmediateResolve(handoff, doc);
    if (resolved?.queued) {
      return { queued: true, item: resolved.item, detectives: true, path: resolved.path };
    }
  } catch {
    /* optional */
  }
  return result;
}

async function attemptEnqueueCandidate(rawCandidate, doc, opts = {}) {
  const ladderDepth = opts.ladderDepth || 0;
  let phase3 = null;
  try {
    phase3 = require('./autoposter/phase3-index');
  } catch {
    /* optional */
  }

  const slug = String(rawCandidate?.playerSlug || '').trim().toLowerCase();
  const isRecruitingPlayer =
    slug &&
    !isProgramOrTeamNews(rawCandidate) &&
    (rawCandidate?.topic === 'recruiting' ||
      (rawCandidate?.category === 'news' && rawCandidate?.playerName));
  if (isRecruitingPlayer) {
    const preflightMod = require('./autoposter/player-resolution-preflight');
    const ledger = require('./autoposter/player-resolution-ledger');
    const allowGoldenFour = String(rawCandidate?.source || '').includes('golden-four');
    const pre = await preflightMod.evaluatePlayerPostPreflight({
      ...rawCandidate,
      playerSlug: slug,
      allowGoldenFour,
      allowRepublish: opts.allowRepublish === true
    });
    if (!pre.ok) {
      if (pre.action === 'archive') {
        ledger.markResolvedArchive(slug, pre.archiveReason || pre.reason, {
          source: rawCandidate?.source || 'enqueue',
          committedTo: pre.committedTo || null,
          intelFingerprint: rawCandidate?.intelFingerprint || null,
          preview: rawCandidate?.text || null
        });
      }
      return finalizeEnqueueFailure(
        rawCandidate,
        doc,
        { queued: false, reason: pre.reason, archiveReason: pre.archiveReason },
        { ...opts, skipDetectives: pre.action === 'archive' }
      );
    }

    const elig = await policy.validateRecruitingPostEligibility(rawCandidate);
    if (!elig.ok) {
      ledger.markResolvedArchive(slug, 'committed_elsewhere', {
        source: rawCandidate?.source || 'enqueue',
        committedTo: elig.committedTo || null,
        intelFingerprint: rawCandidate?.intelFingerprint || null
      });
      return finalizeEnqueueFailure(
        rawCandidate,
        doc,
        { queued: false, reason: elig.reason, committedTo: elig.committedTo || null },
        { ...opts, skipDetectives: true }
      );
    }
  }

  if (rawCandidate?._nonPlayerSkip && !isProgramOrTeamNews(rawCandidate)) {
    const ladder = await tryResearchLadder(rawCandidate, 'non_player_intel', doc, ladderDepth);
    if (ladder?.queued) return ladder;
    return finalizeEnqueueFailure(rawCandidate, doc, { queued: false, reason: 'non_player_intel' }, opts);
  }
  if (rawCandidate?._needsResolution || rawCandidate?.skipReason === 'needs_resolution') {
    const ladder = await tryResearchLadder(rawCandidate, 'needs_resolution', doc, ladderDepth);
    if (ladder?.queued) return ladder;
    return finalizeEnqueueFailure(rawCandidate, doc, { queued: false, reason: 'needs_resolution' }, opts);
  }
  if (rawCandidate?.skipReason && !isProgramOrTeamNews(rawCandidate)) {
    const ladder = await tryResearchLadder(rawCandidate, rawCandidate.skipReason, doc, ladderDepth);
    if (ladder?.queued) return ladder;
    return finalizeEnqueueFailure(rawCandidate, doc, { queued: false, reason: rawCandidate.skipReason }, opts);
  }
  if (rawCandidate?._identitySkip && !isProgramOrTeamNews(rawCandidate)) {
    const ladder = await tryResearchLadder(rawCandidate, 'identity_skip', doc, ladderDepth);
    if (ladder?.queued) return ladder;
    return finalizeEnqueueFailure(rawCandidate, doc, { queued: false, reason: 'identity_skip' }, opts);
  }

  const scored = await finalizeNewsCandidate(rawCandidate);
  if (!scored) {
    const ladder = await tryResearchLadder(rawCandidate, 'quality_gate', doc, ladderDepth);
    if (ladder?.queued) return ladder;
    return finalizeEnqueueFailure(rawCandidate, doc, { queued: false, reason: 'quality_gate' }, opts);
  }

  if (phase3?.phase3Enabled?.()) {
    const mem = phase3.guardCandidateMemory(scored);
    if (!mem.ok) {
      if (mem.reason === 'story_dedupe') {
        return finalizeEnqueueFailure(scored, doc, { queued: false, reason: 'story_dedupe', detail: mem.detail }, opts);
      }
      if (ladderDepth < MAX_LADDER_DEPTH && mem.reason === 'topic_angle') {
        const ladder = await tryResearchLadder(scored, 'topic_angle', doc, ladderDepth);
        if (ladder?.queued) return ladder;
      }
      return finalizeEnqueueFailure(scored, doc, { queued: false, reason: mem.reason, detail: mem.detail }, opts);
    }
  }

  const fp = scored.intelFingerprint || scored.commitFingerprint;
  if (fp && fingerprintAlreadyQueued(fp, doc.items)) {
    return finalizeEnqueueFailure(scored, doc, { queued: false, reason: 'duplicate_fingerprint' }, opts);
  }
  if (
    scored.commitFingerprint &&
    commitAlreadyQueued(scored.commitFingerprint, doc.items, {
      slug: scored.playerSlug,
      text: scored.text,
      eventType: scored.sourceEventType
    })
  ) {
    return finalizeEnqueueFailure(scored, doc, { queued: false, reason: 'duplicate_commit' }, opts);
  }
  if (alreadyQueued(scored.text, doc.items)) {
    return finalizeEnqueueFailure(scored, doc, { queued: false, reason: 'duplicate_text' }, opts);
  }
  const similar = similarPostQueued(scored.text, doc.items, {
    slug: scored.playerSlug,
    intelFingerprint: scored.intelFingerprint
  });
  if (similar) {
    return finalizeEnqueueFailure(scored, doc, { queued: false, reason: 'similar_post', similarity: similar.similarity }, opts);
  }

  const gm2 = require('./gm2');
  if (!gm2.filterAutoposterCandidate(scored)) {
    const ladder = await tryResearchLadder(scored, 'gm2_filter', doc, ladderDepth);
    if (ladder?.queued) return ladder;
    return finalizeEnqueueFailure(scored, doc, { queued: false, reason: 'gm2_filter' }, opts);
  }

  try {
    const qa = require('./autoposter/recruiting-post-qa');
    if (qa.isRecruitingPlayerCandidate(scored) && !qa.passesPublishGate(scored)) {
      const ladder = await tryResearchLadder(scored, 'quality_gate', doc, ladderDepth);
      if (ladder?.queued) return ladder;
      return finalizeEnqueueFailure(
        scored,
        doc,
        { queued: false, reason: 'recruiting_qa', detail: qa.rejectReason(scored) },
        opts
      );
    }
  } catch {
    /* optional */
  }

  const check = policy.validatePostContent(scored);
  const verifiedCommit = scored.verifiedCommit || scored.validationMeta?.verifiedCommit;
  const programOrTeam = isProgramOrTeamNews(scored);
  const elitePremade =
    !isDetectivesPlayerPost(scored) &&
    (scored.validationMeta?.eliteCompose ||
      scored.validationMeta?.eliteDigest ||
      String(scored.source || '').includes('beat-intel'));
  const policyBlocked =
    !check.valid &&
    !(
      (verifiedCommit || programOrTeam || elitePremade) &&
      check.errors.every(
        (e) =>
          e.type === 'below_threshold' ||
          e.rule === 'score' ||
          ((programOrTeam || elitePremade) &&
            (e.type === 'stale_intel' || e.type === 'stale' || e.type === 'missing_timestamp'))
      )
    );
  if (policyBlocked) {
    const ladder = await tryResearchLadder(scored, 'policy', doc, ladderDepth);
    if (ladder?.queued) return ladder;
    return finalizeEnqueueFailure(scored, doc, { queued: false, reason: 'policy', errors: check.errors }, opts);
  }

  try {
    const tagged = cadence.tagCandidate({
      ...scored,
      qualityScore: scored.qualityScore ?? check.qualityScore ?? null,
      qualityBreakdown: scored.qualityBreakdown ?? check.qualityBreakdown ?? null,
      sourceConfidence: scored.sourceConfidence ?? check.sourceConfidence ?? null
    });
    const out = store.enqueuePost({
      ...tagged,
      scheduledAt: store.nowIso(),
      status: 'pending'
    });
    if (scored.sourceIntelId) {
      const marked = intelStore.markIntelXPostQueued(scored.sourceIntelId, { queueItemId: out.item.id });
      if (!marked) {
        console.warn(
          `[x-autoposter] enqueue ok but intel mark failed for ${scored.sourceIntelId} (${out.item.id})`
        );
      }
    }
    return { queued: true, item: out.item };
  } catch (err) {
    return finalizeEnqueueFailure(scored, doc, { queued: false, reason: 'enqueue_error', error: err.message }, opts);
  }
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

const BEAT_INTEL_SOURCES =
  /beat-writer|program-news|team-event|auto:beat|auto:program|auto:team|auto:on3-team-news|on3-team-news/i;

function isBeatWriterIntel(intel) {
  return BEAT_INTEL_SOURCES.test(String(intel?.source || ''));
}

async function directBeatPostCandidates(freshPosts) {
  const prefilter = require('./beat-intel-prefilter');
  const researchLadder = require('./autoposter/research-ladder');
  const programRows = [];
  const otherRows = [];
  for (const post of freshPosts) {
    const guarded = await prefilter.guardBeatPost(post);
    if (!guarded.eligible) {
      const skipReason = prefilter.resolveGuardSkipReason(guarded);
      if (researchLadder.digOnFilterSkipEnabled()) {
        const alt = await researchLadder.buildFromBeatPostSkip(post, skipReason);
        if (alt?.text) otherRows.push(alt);
      }
      try {
        const det = require('./autoposter/detectives');
        if (det.detectivesEnabled()) {
          await det.handoffToDetectives({
            beatPost: post,
            skipReason,
            skipStage: 'beat_prefilter',
            hints: {
              handle: post.handle,
              writerName: post.writerName || post.outlet,
              url: post.url
            }
          });
        }
      } catch {
        /* optional */
      }
      continue;
    }

    if (guarded.triggerType === 'program_news' || guarded.triggerType === 'team_event') {
      const beatNews = await buildNewsFromBeatPost(post);
      if (beatNews) programRows.push(beatNews);
      continue;
    }

    const momentum = await buildMomentumFromBeat(post);
    if (momentum) {
      otherRows.push(momentum);
      continue;
    }
    const beatNews = await buildNewsFromBeatPost(post);
    if (beatNews) otherRows.push(beatNews);
  }
  return [...programRows, ...otherRows];
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

async function collectFreshPostCandidates({ forcePost = false, digDeeper = false, intelOnly = false } = {}) {
  const candidates = [];
  const maxCommitAgeMs = forcePost ? FORCE_POST_COMMIT_AGE_MS : MAX_COMMIT_EVENT_AGE_MS;
  const maxBeatAgeMs = forcePost ? FORCE_POST_COMMIT_AGE_MS : MAX_BEAT_POST_AGE_MS;
  const maxIntelAgeMs = forcePost ? FORCE_POST_COMMIT_AGE_MS : MAX_INTEL_AGE_MS;

  try {
    const beatIntel = intelStore
      .getUnqueuedIntel({ maxAgeMs: forcePost ? maxIntelAgeMs : MAX_BEAT_INTEL_AGE_MS })
      .filter(isBeatWriterIntel);
    const beatScan = await selectBeatIntelForAutopost(beatIntel, { limit: MAX_BEAT_INTEL_BUILD * 2 });
    const otherIntel = dedupeIntelByPlayerSlug(
      intelStore.getUnqueuedIntel({ maxAgeMs: maxIntelAgeMs }).filter((i) => !isBeatWriterIntel(i))
    ).slice(0, MAX_BEAT_INTEL_BUILD);
    candidates.push(
      ...(await buildCandidatesFromIntelRows([...beatScan, ...otherIntel], { maxBuild: MAX_BEAT_INTEL_BUILD }))
    );
  } catch {
    /* optional */
  }

  if (intelOnly) {
    return prioritizePostCandidates(candidates);
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

    if (!freshPosts.length && process.env.X_AUTOPOST_ON3_NEWS_FALLBACK !== 'false') {
      const on3Candidates = await collectOn3NewsBeatCandidates();
      for (const row of on3Candidates) candidates.unshift(row);
    }
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
    const discovery = require('./autoposter/discovery-index');
    const discovered = await discovery.collectAllDiscoveryCandidates({ forcePost, digDeeper });
    for (const row of discovered) candidates.push(row);
  } catch (err) {
    console.warn('[x-autoposter] discovery collect failed:', err.message);
  }

  try {
    const articleLimit = parseInt(process.env.X_AUTOPOST_ARTICLE_HARVEST_LIMIT || '8', 10);
    for (const row of collectArticlePostCandidates({ limit: articleLimit, forcePost: forcePost || digDeeper })) {
      candidates.push(row);
    }
  } catch {
    /* optional */
  }

  if (digDeeper) {
    try {
      const deeper = await collectDigDeeperPostCandidates({ forcePost: true });
      for (const row of deeper) candidates.push(row);
    } catch {
      /* optional */
    }
  }

  return prioritizePostCandidates(candidates);
}

async function queueOn3NewsBeatPost(syntheticPost, meta = {}) {
  if (!pipelineGuards.autopostEnabled()) {
    return { queued: false, reason: 'autoposter_disabled' };
  }
  const news = await buildNewsFromBeatPost(syntheticPost);
  if (!news?.text) return { queued: false, reason: 'copy_failed', detail: news?.skipReason || null };
  const finalized = await finalizeNewsCandidate(news);
  if (!finalized) return { queued: false, reason: 'quality_gate' };
  const fp = meta.fingerprint || finalized.intelFingerprint;
  const doc = store.loadQueue();
  if (fp && fingerprintAlreadyQueued(fp, doc.items)) return { queued: false, reason: 'duplicate' };
  if (alreadyQueued(finalized.text, doc.items)) return { queued: false, reason: 'duplicate_text' };
  const similar = similarPostQueued(finalized.text, doc.items, {
    slug: finalized.playerSlug,
    intelFingerprint: finalized.intelFingerprint,
  });
  if (similar) return { queued: false, reason: 'similar_post', similarity: similar.similarity };
  const policy = require('./x-autoposter-policy');
  const check = policy.validatePostContent(finalized);
  if (!check.valid) return { queued: false, reason: 'validation', errors: check.errors };
  const gm2 = require('./gm2');
  if (!gm2.filterAutoposterCandidate(finalized)) return { queued: false, reason: 'gm2_filter' };
  const tagged = cadence.tagCandidate({
    ...finalized,
    qualityScore: finalized.qualityScore ?? check.qualityScore ?? null,
    qualityBreakdown: finalized.qualityBreakdown ?? check.qualityBreakdown ?? null,
    sourceConfidence: finalized.sourceConfidence ?? check.sourceConfidence ?? null,
    source: finalized.source || 'auto:on3-team-news',
    intelFingerprint: fp || finalized.intelFingerprint
  });
  const out = store.enqueuePost({
    ...tagged,
    scheduledAt: store.nowIso(),
    status: 'pending'
  });
  if (meta.sourceIntelId) {
    try {
      intelStore.markIntelXPostQueued(meta.sourceIntelId, { queueItemId: out.item.id });
    } catch {
      /* optional */
    }
  }
  return { queued: true, itemId: out.item.id, preview: String(finalized.text || '').slice(0, 160) };
}

async function collectOn3NewsBeatCandidates() {
  const { fetchFloridaTeamNewsArticles, parseArticleIdentity, buildSyntheticBeatPostFromOn3Article } = require('./uf-on3-news-discovery');
  let articles = [];
  try {
    articles = await fetchFloridaTeamNewsArticles();
  } catch {
    return [];
  }
  const cutoff = Date.now() - MAX_BEAT_POST_AGE_MS;
  const candidates = [];
  for (const article of articles.slice(0, 12)) {
    const ts = new Date(article.postDateGMT || article.postDate || 0).getTime();
    if (Number.isNaN(ts) || ts < cutoff) continue;
    const identity = parseArticleIdentity(article);
    if (!identity?.playerSlug) continue;
    const synthetic = buildSyntheticBeatPostFromOn3Article(article, identity);
    const row = await buildNewsFromBeatPost(synthetic);
    if (row?.text && !copy.isBrokenCopy(row.text, row)) candidates.push(row);
  }
  return candidates;
}

async function processDetectivesPileSidecar(doc, limit = 3, { background = false } = {}) {
  const run = async () => {
    try {
      const det = require('./autoposter/detectives');
      if (!det.detectivesEnabled()) return null;
      const queueDoc = doc || store.loadQueue();
      const detectivesRun = await det.processDetectivesPile({ limit, doc: queueDoc });
      const enqueued = [];
      if (detectivesRun?.results?.some((r) => r.queued)) {
        for (const r of detectivesRun.results) {
          if (r.item) enqueued.push(r.item);
        }
      }
      return { detectivesRun, enqueued };
    } catch (err) {
      console.warn('[x-autoposter] detectives pile failed:', err.message);
      return null;
    }
  };
  if (background) {
    if (global.__detectivesSidecarRunning) return { background: true, skipped: true, reason: 'busy' };
    global.__detectivesSidecarRunning = true;
    setImmediate(async () => {
      try {
        await run();
      } finally {
        global.__detectivesSidecarRunning = false;
      }
    });
    return { background: true, started: true };
  }
  return run();
}

function hasGoldenFourPending() {
  try {
    const { GOLDEN_FOUR_PROD_SLUGS } = require('./player-intelligence/golden-four-on3');
    return store
      .listQueue({ status: 'pending' })
      .some((item) => GOLDEN_FOUR_PROD_SLUGS.includes(String(item.playerSlug || '').toLowerCase()));
  } catch {
    return false;
  }
}

async function tryAutonomousGoldenFourRefill(maxSlugs = 1) {
  if (process.env.X_AUTOPOST_GOLDEN_FOUR_AUTO === 'false') {
    return { ok: false, reason: 'disabled' };
  }
  try {
    const resolutionLedger = require('./autoposter/player-resolution-ledger');
    const { enqueueGoldenFourPosts, DEFAULT_ORDER } = require('./player-intelligence/golden-four-enqueue');
    const pendingSlugs = new Set(
      store
        .listQueue({ status: 'pending' })
        .map((i) => String(i.playerSlug || '').toLowerCase())
        .filter(Boolean)
    );
    const nextSlugs = DEFAULT_ORDER.filter((slug) => {
      if (pendingSlugs.has(slug)) return false;
      const check = resolutionLedger.checkPlayerResolution(slug, { allowGoldenFour: true });
      if (check.blocked && (check.reason === 'duplicate_already_sent' || check.reason === 'player_archived')) {
        return false;
      }
      return true;
    }).slice(0, Math.max(1, parseInt(maxSlugs, 10) || 1));
    if (!nextSlugs.length) return { ok: false, reason: 'golden_four_complete' };
    return enqueueGoldenFourPosts({
      slugs: nextSlugs,
      includeHam: false,
      clearPendingNonGolden: false
    });
  } catch (err) {
    return { ok: false, reason: err.message || 'golden_four_failed' };
  }
}

async function refillAutoposterQueue({
  minPending = parseInt(process.env.X_AUTOPOST_REFILL_MIN_PENDING || '2', 10),
  maxEnqueue = parseInt(process.env.X_AUTOPOST_REFILL_MAX_ENQUEUE || '4', 10),
  forcePost = false,
  digDeeper = false
} = {}) {
  if (typeof intelStore.initIntelStore === 'function') {
    await intelStore.initIntelStore().catch((err) => {
      console.warn('[x-autoposter] intel store init skipped during refill:', err.message);
    });
  }
  if (!pipelineGuards.autopostEnabled()) {
    return { ok: true, skipped: true, reason: 'autoposter disabled', pending: 0, enqueued: [] };
  }
  let dailyCount = 0;
  let dailyMax = 6;
  try {
    const cadenceMod = require('./x-autoposter-cadence');
    dailyCount = cadenceMod.countDailyPosts();
    dailyMax = cadenceMod.DAILY_MAX_POSTS || 6;
  } catch {
    /* optional */
  }
  if (dailyCount >= dailyMax) {
    forcePost = false;
    digDeeper = false;
  }
  const beatPrepPromise = withRefillTimeout(
    prepareBeatFirstAutoposter({ forceIngest: forcePost }),
    REFILL_PREP_TIMEOUT_MS,
    'beat_prep'
  ).catch((err) => ({ ok: false, error: err.message }));
  try {
    intelStore.reconcileGhostQueuedIntel();
  } catch {
    /* optional */
  }
  const doc = store.loadQueue();
  const pending = doc.items.filter((i) => i.status === 'pending');
  const need = Math.max(minPending - pending.length, pending.length === 0 ? 1 : 0);

  let goldenFourRun = null;
  let goldenEnqueued = [];
  const enqueued = [];
  const skipReasons = [];
  let added = 0;
  let qualitySkipped = 0;

  const enqueueFromCandidates = async (rawNewsCandidates, slots) => {
    const allowPromo = process.env.X_AUTOPOST_ALLOW_PROMO === 'true';
    const finalCandidates = [...rawNewsCandidates];
    if (allowPromo) {
      const promo = buildPromoFromMix();
      if (promo) finalCandidates.push(promo);
    }

    for (const raw of finalCandidates) {
      if (added >= slots) break;
      if (raw?.category === 'promo' || raw?.category === 'engagement') {
        if (!raw?.text || copy.isBrokenCopy(raw.text, raw)) continue;
        const check = policy.validatePostContent(raw);
        if (!check.valid && raw.category !== 'engagement' && raw.category !== 'promo') continue;
        try {
          const tagged = cadence.tagCandidate({
            ...raw,
            qualityScore: raw.qualityScore ?? check.qualityScore ?? 70,
            qualityBreakdown: raw.qualityBreakdown ?? check.qualityBreakdown ?? null,
            sourceConfidence: raw.sourceConfidence ?? check.sourceConfidence ?? 80
          });
          const out = store.enqueuePost({
            ...tagged,
            scheduledAt: store.nowIso(),
            status: 'pending'
          });
          enqueued.push(out.item);
          doc.items.push(out.item);
          added += 1;
        } catch (err) {
          console.warn(`[x-autoposter] promo enqueue failed: ${err.message}`);
        }
        continue;
      }

      const result = await attemptEnqueueCandidate(raw, doc);
      if (result.queued) {
        enqueued.push(result.item);
        doc.items.push(result.item);
        added += 1;
      } else {
        qualitySkipped += 1;
        if (skipReasons.length < 12) {
          skipReasons.push({
            reason: result.reason,
            source: raw.source,
            player: raw.playerName,
            topic: raw.topic || raw.triggerType
          });
        }
      }
    }
  };

  const emptyQueueRefill = pending.length === 0;

  if (need > 0) {
    let beatDigDeeper = digDeeper;
    if (beatDigDeeper && hasGoldenFourPending()) {
      beatDigDeeper = false;
    }
    const beatSlots = Math.min(maxEnqueue, need);
    const intelBuildCap = Math.min(Math.max(maxEnqueue + 1, 3), MAX_BEAT_INTEL_BUILD);
    let rawNewsCandidates = [];
    try {
      rawNewsCandidates = await withRefillTimeout(
        collectUnqueuedIntelCandidates({
          forcePost: forcePost || digDeeper,
          maxBuild: intelBuildCap
        }),
        REFILL_INTEL_COLLECT_TIMEOUT_MS,
        'intel_candidate_collect'
      );
    } catch (err) {
      console.warn('[x-autoposter] intel candidate collect skipped:', err.message);
      rawNewsCandidates = [];
    }
    if (rawNewsCandidates.length) {
      await enqueueFromCandidates(rawNewsCandidates, beatSlots);
    }
    const pendingAfterIntel = store.listQueue({ status: 'pending' }).length;
    if (pendingAfterIntel >= minPending || added > 0) {
      void beatPrepPromise;
      return {
        ok: true,
        skipped: false,
        reason: added > 0 ? 'intel_first_fast_path' : 'queue_satisfied',
        pending: pendingAfterIntel,
        enqueued,
        enqueuedCount: enqueued.length,
        qualitySkipped,
        skipReasons,
        digDeeper: forcePost || digDeeper,
        beatPrep: null,
        goldenFour: null,
        detectivesRun: null,
        emptyQueueFallback: added > 0 && pending.length === 0
      };
    }
    if (!rawNewsCandidates.length) {
      try {
        rawNewsCandidates = await withRefillTimeout(
          collectFreshPostCandidates({
            forcePost: forcePost || digDeeper,
            digDeeper: beatDigDeeper,
            intelOnly: true
          }),
          REFILL_PREP_TIMEOUT_MS,
          'intel_only_collect'
        );
      } catch (err) {
        console.warn('[x-autoposter] intel-only collect skipped:', err.message);
        rawNewsCandidates = [];
      }
      if (rawNewsCandidates.length) {
        await enqueueFromCandidates(rawNewsCandidates, beatSlots);
      }
      const pendingAfterIntelOnly = store.listQueue({ status: 'pending' }).length;
      if (pendingAfterIntelOnly >= minPending || added > 0) {
        void beatPrepPromise;
        return {
          ok: true,
          skipped: false,
          reason: added > 0 ? 'intel_only_fast_path' : 'queue_satisfied',
          pending: pendingAfterIntelOnly,
          enqueued,
          enqueuedCount: enqueued.length,
          qualitySkipped,
          skipReasons,
          digDeeper: forcePost || digDeeper,
          beatPrep: null,
          goldenFour: null,
          detectivesRun: null,
          emptyQueueFallback: added > 0 && pending.length === 0
        };
      }
    }

    if (emptyQueueRefill) {
      if (added === 0 && store.listQueue({ status: 'pending' }).length < minPending) {
        goldenFourRun = await withRefillTimeout(
          tryAutonomousGoldenFourRefill(Math.min(Math.max(minPending, 1), maxEnqueue)),
          REFILL_GOLDEN_FOUR_TIMEOUT_MS,
          'golden_four_refill'
        ).catch((err) => ({ ok: false, reason: err.message || String(err) }));
        goldenEnqueued = (goldenFourRun?.results || []).filter((r) => r.ok);
        for (const row of goldenEnqueued) {
          if (!row.itemId) continue;
          const item = store.loadQueue().items.find((i) => i.id === row.itemId);
          if (item) {
            enqueued.push(item);
            added += 1;
          }
        }
      }
      void beatPrepPromise;
      return {
        ok: true,
        skipped: added === 0,
        reason:
          added > 0
            ? goldenEnqueued.length
              ? 'empty_queue_golden_four'
              : 'empty_queue_intel'
            : 'empty_queue_miss',
        pending: store.listQueue({ status: 'pending' }).length,
        enqueued,
        enqueuedCount: enqueued.length,
        qualitySkipped,
        skipReasons,
        digDeeper: forcePost || digDeeper,
        beatPrep: null,
        goldenFour: goldenFourRun,
        detectivesRun: null,
        emptyQueueFallback: false
      };
    }

    if (!rawNewsCandidates.length) {
      try {
        rawNewsCandidates = await withRefillTimeout(
          collectFreshPostCandidates({
            forcePost: forcePost || digDeeper,
            digDeeper: beatDigDeeper
          }),
          REFILL_WIDE_TIMEOUT_MS,
          'wide_candidate_collect'
        );
      } catch (err) {
        console.warn('[x-autoposter] wide candidate collect skipped:', err.message);
        rawNewsCandidates = [];
      }
      if (rawNewsCandidates.length) {
        await enqueueFromCandidates(rawNewsCandidates, beatSlots);
      }
    }
  }

  const pendingAfterBeat = store.listQueue({ status: 'pending' }).length;
  const stillNeed = Math.max(minPending - pendingAfterBeat, pendingAfterBeat === 0 ? 1 : 0);

  if (stillNeed > 0) {
    goldenFourRun = await withRefillTimeout(
      tryAutonomousGoldenFourRefill(Math.min(stillNeed, maxEnqueue)),
      REFILL_GOLDEN_FOUR_TIMEOUT_MS,
      'golden_four_refill'
    ).catch((err) => ({ ok: false, reason: err.message || String(err) }));
    goldenEnqueued = (goldenFourRun?.results || []).filter((r) => r.ok);
    for (const row of goldenEnqueued) {
      if (!row.itemId) continue;
      const item = store.loadQueue().items.find((i) => i.id === row.itemId);
      if (item) enqueued.push(item);
    }
    added += goldenEnqueued.length;
  }

  if (pendingAfterBeat >= minPending && enqueued.length === 0 && goldenEnqueued.length === 0) {
    const sidecar = await processDetectivesPileSidecar(doc, 3, { background: true });
    const detectivesEnqueued = sidecar?.enqueued || [];
    return {
      ok: true,
      skipped: true,
      reason: 'queue_full',
      pending: pendingAfterBeat,
      enqueued: detectivesEnqueued,
      enqueuedCount: detectivesEnqueued.length,
      detectivesRun: sidecar?.detectivesRun || null
    };
  }

  const pendingNow = store.listQueue({ status: 'pending' }).length;
  const slots = Math.max(maxEnqueue - pendingNow, stillNeed > 0 ? stillNeed : 0);

  if (added === 0) {
    try {
      const rl = require('./autoposter/research-ladder');
      if (rl.digOnFilterSkipEnabled()) {
        const deeper = await collectDigDeeperPostCandidates({ forcePost: true });
        await enqueueFromCandidates(deeper, slots);
      }
    } catch {
      /* optional */
    }
  }

  if (added === 0 && emptyQueueFallbackEnabled() && pendingNow === 0) {
    const fallbacks = [];
    if (process.env.X_AUTOPOST_ON3_NEWS_FALLBACK !== 'false') {
      try {
        const on3Candidates = await collectOn3NewsBeatCandidates();
        for (const raw of on3Candidates.slice(0, 3)) {
          const scored = await finalizeNewsCandidate(raw);
          if (scored) fallbacks.push(scored);
        }
      } catch {
        /* optional */
      }
    }
    const pulse = await buildEngagementPulsePost();
    if (pulse) fallbacks.push(pulse);
    try {
      const phase3 = require('./autoposter/phase3-index');
      for (const row of phase3.evergreenLibrary.collectEvergreenCandidates({ limit: 2, forcePost: true })) {
        fallbacks.push(row);
      }
    } catch {
      /* optional */
    }
    const promo = buildPromoFromMix();
    if (promo) fallbacks.push(promo);
    for (const raw of fallbacks) {
      if (added >= slots) break;
      const result = await attemptEnqueueCandidate(raw, doc);
      if (result.queued) {
        enqueued.push(result.item);
        doc.items.push(result.item);
        added += 1;
      }
    }
  }

  if (qualitySkipped > 0 && added === 0 && skipReasons.length) {
    console.log('[x-autoposter] topic rotation: all candidates skipped', skipReasons.slice(0, 5));
  }

  let detectivesRun = null;
  const sidecar = await processDetectivesPileSidecar(doc, 3, { background: true });
  if (sidecar && !sidecar.background) {
    detectivesRun = sidecar.detectivesRun;
    for (const item of sidecar.enqueued || []) {
      enqueued.push(item);
      doc.items.push(item);
      added += 1;
    }
  }

  void beatPrepPromise;

  return {
    ok: true,
    skipped: false,
    reason: goldenEnqueued.length && enqueued.length === goldenEnqueued.length ? 'golden_four_auto' : null,
    pending: store.listQueue({ status: 'pending' }).length,
    enqueued,
    enqueuedCount: enqueued.length,
    qualitySkipped,
    skipReasons,
    digDeeper: forcePost || digDeeper,
    beatPrep: null,
    goldenFour: goldenFourRun,
    detectivesRun,
    emptyQueueFallback: added > 0 && pending.length === 0
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
  if (similarPostQueued(scored.text, doc.items, {
    slug: scored.playerSlug,
    intelFingerprint: scored.intelFingerprint,
  })) {
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
  hasGoldenFourPending,
  tryAutonomousGoldenFourRefill,
  collectFreshPostCandidates,
  collectDigDeeperPostCandidates,
  collectArticlePostCandidates,
  collectBeatAutoposterCandidates,
  directBeatPostCandidates,
  isBeatWriterIntel,
  finalizeNewsCandidate,
  attemptEnqueueCandidate,
  prioritizePostCandidates,
  alreadyQueued,
  similarPostQueued,
  dedupeKey,
  fingerprintAlreadyQueued,
  buildNewsFromIntel,
  buildNewsFromBeatPost,
  buildNewsFromArticle,
  buildMomentumFromBeat,
  queueCommitEventAutopost,
  forceEnqueueRecentCommits,
  prepareBeatFirstAutoposter,
  queueOn3NewsBeatPost,
  collectOn3NewsBeatCandidates,
  buildEngagementPulsePost,
  isCommitAutopostEvent,
  isProgramOrTeamNews,
  dedupeIntelByPlayerSlug,
  selectBeatIntelForAutopost,
  buildCandidatesFromIntelRows,
  probeIntelAutoposterPath,
  COMMIT_EVENT_SOURCES,
  FORCE_POST_COMMIT_AGE_MS,
};
