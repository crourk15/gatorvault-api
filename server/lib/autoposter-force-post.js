/**
 * Force-post — immediate X post from queued items or freshest beat/intel (bypasses cadence).
 */
const store = require('./x-autoposter-store');
const policy = require('./x-autoposter-policy');
const autoposter = require('./x-autoposter');
const cadence = require('./x-autoposter-cadence');
const freshness = require('./autoposter-freshness');
const opsMonitor = require('./ops-monitor');
const autoposterIdentity = require('./autoposter-identity');
const {
  collectFreshPostCandidates,
  finalizeNewsCandidate,
  alreadyQueued,
  refillAutoposterQueue,
  forceEnqueueRecentCommits,
  prepareBeatFirstAutoposter
} = require('./x-autoposter-fill');
const { isOAuth1Configured } = require('./x-oauth1');
const pipelineGuards = require('./pipeline-guards');

function forcePostDiagnostics(extra = {}) {
  const failed = store.listQueue({ status: 'failed' });
  const lastFailed = failed.sort(
    (a, b) =>
      new Date(b.sentAt || b.createdAt || 0).getTime() - new Date(a.sentAt || a.createdAt || 0).getTime()
  )[0];
  return {
    pendingCount: store.listQueue({ status: 'pending' }).length,
    failedCount: failed.length,
    lastFailedError: lastFailed?.error || null,
    lastFailedItemId: lastFailed?.id || null,
    lastFailedPreview: lastFailed?.text ? String(lastFailed.text).slice(0, 120) : null,
    autopostEnabled: pipelineGuards.autopostEnabled(),
    oauthConfigured: isOAuth1Configured(),
    ...extra
  };
}

function refreshQueueItemFreshness(item) {
  const ts = store.nowIso();
  item.sourceEventCreatedAt = ts;
  item.sourcePublishedAt = ts;
  item.scheduledAt = ts;
  item.eventTimestamp = ts;
  if (!item.postUrgency) item.postUrgency = 'breaking';
  return item;
}

async function recomposeFailedQueueItems() {
  const doc = store.loadQueue();
  const eliteCaption = require('./x-autoposter-elite-caption');
  let recomposed = 0;
  for (const item of doc.items) {
    if (item.status !== 'failed') continue;
    if (/duplicate content/i.test(String(item.error || ''))) continue;
    const slug = item.playerSlug || item.validationMeta?.playerSlug;
    if (!slug && !item.playerName) continue;
    try {
      const beatText =
        item.validationMeta?.beatText ||
        item.templateBlocks?.context ||
        null;
      const built = await eliteCaption.buildElitePlayerPost({
        playerName: item.playerName,
        playerSlug: slug,
        beatText,
        intel: {
          playerName: item.playerName,
          playerSlug: slug,
          eventType: item.sourceEventType || item.validationMeta?.eventType || 'trending',
          detail: beatText || item.text
        }
      });
      if (!built?.ok || !built.text) continue;
      const candidate = { ...item, text: built.text, templateBlocks: built.templateBlocks || item.templateBlocks };
      const check = policy.validatePostContent(candidate);
      if (!check.valid) continue;
      item.text = built.text;
      item.templateBlocks = built.templateBlocks || item.templateBlocks;
      item.validationMeta = {
        ...(item.validationMeta || {}),
        ...(built.validationMeta || {}),
        eliteCompose: true,
        eliteDigest: true
      };
      item.status = 'pending';
      item.error = null;
      item.validationErrors = [];
      item.sentAt = null;
      refreshQueueItemFreshness(item);
      recomposed += 1;
    } catch {
      /* optional per item */
    }
  }
  if (recomposed) store.saveQueue(doc);
  return recomposed;
}

function mapPostError(err, context = {}) {
  const msg = String(err?.message || err || '').toLowerCase();
  if (/duplicate content/i.test(msg)) return 'duplicate';
  if (/needs_resolution/i.test(msg)) return 'needs_resolution';
  if (/identity|not confirmed|incomplete/i.test(msg)) return 'needs_resolution';
  if (/no fresh|no candidate|no_fresh/i.test(msg)) return 'no_fresh_intel';
  if (/validation/i.test(msg)) return 'validation_failed';
  return 'x_api_error';
}

function successFromQueueResult(result, source = 'force-post:queue') {
  const item = result.item || {};
  const tweet = result.result || {};
  return {
    ok: true,
    posted: true,
    timestamp: store.nowIso(),
    source,
    tweetId: tweet.tweetId || item.tweetId || null,
    tweetUrl: tweet.tweetUrl || item.tweetUrl || null,
    text: item.text || null
  };
}

/** Post the best pending queue item — recover failed verified commits first. */
async function forceProcessQueuedPost() {
  store.recoverFailedVerifiedCommits();
  const pending = store.listQueue({ status: 'pending' });
  if (!pending.length) return null;

  const next = cadence.pickNextPost(pending) || pending[0];
  if (!next) return null;

  try {
    const result = await autoposter.processQueueItem(next);
    if (result.ok) {
      opsMonitor.logEvent({
        subsystem: 'autoposter',
        status: 'success',
        message: 'Force post successful (queue)',
        details: {
          source: 'force-post:queue',
          itemId: next.id,
          tweetId: result.result?.tweetId || result.item?.tweetId || null,
          preview: String(next.text || '').slice(0, 80)
        }
      });
      return successFromQueueResult(result);
    }

    if (result.skipped && result.reason === 'autoposter disabled') {
      return { ok: false, posted: false, error: 'autoposter disabled', source: 'force-post:queue' };
    }

    return {
      ok: false,
      posted: false,
      error: result.error || result.reason || 'queue_post_failed',
      source: 'force-post:queue',
      itemId: next.id
    };
  } catch (err) {
    return {
      ok: false,
      posted: false,
      error: err.message || 'queue_post_failed',
      source: 'force-post:queue',
      itemId: next.id
    };
  }
}

async function retryCandidateAfterPatternRebuild(raw) {
  const failure = autoposterIdentity.identityFailureFromCandidate(raw);
  const slug = failure?.playerSlug;
  if (!slug) return null;

  await autoposterIdentity.ensurePatternsForPlayer(slug);

  const candidates = await collectFreshPostCandidates();
  const matchPhrase = failure.triggerPhrase || raw.triggerPhrase;
  for (const candidate of candidates) {
    if (candidate._nonPlayerSkip || candidate.skipReason === 'non_player_intel') continue;
    if (candidate._needsResolution || candidate.skipReason === 'needs_resolution') continue;
    if (candidate.skipReason || candidate._identitySkip) continue;
    if (matchPhrase && candidate.triggerPhrase && candidate.triggerPhrase !== matchPhrase) continue;
    if (failure.playerName && candidate.playerName && candidate.playerName !== failure.playerName) continue;
    const scored = await finalizeNewsCandidate(candidate);
    if (scored) return scored;
  }
  return null;
}

function findPendingQueueItemForText(text, items) {
  const key = String(text || '').trim().toLowerCase();
  if (!key) return null;
  return (
    items.find(
      (i) => i.status === 'pending' && String(i.text || '').trim().toLowerCase() === key
    ) || null
  );
}

async function tryForceQueuePost({ skipRecompose = false } = {}) {
  store.recoverFailedVerifiedCommits();
  store.recoverFailedPostableItems();
  if (!skipRecompose) {
    await recomposeFailedQueueItems();
    store.recoverFailedVerifiedCommits();
    store.recoverFailedPostableItems();
  }
  const pending = store.listQueue({ status: 'pending' });
  for (const item of pending) {
    refreshQueueItemFreshness(item);
    store.updatePost(item.id, {
      sourceEventCreatedAt: item.sourceEventCreatedAt,
      sourcePublishedAt: item.sourcePublishedAt,
      scheduledAt: item.scheduledAt,
      eventTimestamp: item.eventTimestamp,
      postUrgency: item.postUrgency
    });
  }
  if (!pending.length) return null;
  return forceProcessQueuedPost();
}

/** Fast path — pending queue only (no beat ingest / discovery). */
async function forcePostQueueOnly() {
  process.env.X_AUTOPOST_FORCE_POST = 'true';
  try {
    autoposter.saveSchedulerStatus({ lastPostAttempt: store.nowIso(), lastError: null });
    return await tryForceQueuePost({ skipRecompose: true });
  } finally {
    delete process.env.X_AUTOPOST_FORCE_POST;
  }
}

/** Full pipeline — beat ingest, refill, discovery (can take minutes). */
async function forcePostDiscover() {
  process.env.X_AUTOPOST_FORCE_POST = 'true';
  try {
  autoposter.saveSchedulerStatus({ lastPostAttempt: store.nowIso(), lastError: null });

  try {
    await prepareBeatFirstAutoposter({ forceIngest: true });
  } catch (err) {
    /* beat prep optional */
  }

  let queueResult = await tryForceQueuePost();
  if (queueResult?.posted) return queueResult;
  if (queueResult && !queueResult.posted && queueResult.error) {
    return { ...queueResult, ...forcePostDiagnostics() };
  }

  try {
    await refillAutoposterQueue({ minPending: 1, maxEnqueue: 3, forcePost: true });
  } catch (err) {
    /* refill optional */
  }

  queueResult = await tryForceQueuePost();
  if (queueResult?.posted) return queueResult;
  if (queueResult && !queueResult.posted && queueResult.error) {
    return { ...queueResult, ...forcePostDiagnostics() };
  }

  try {
    const enq = await forceEnqueueRecentCommits();
    if (enq.queued) {
      queueResult = await tryForceQueuePost();
      if (queueResult?.posted) return queueResult;
      if (queueResult && !queueResult.posted && queueResult.error) {
        return { ...queueResult, ...forcePostDiagnostics() };
      }
    }
  } catch (err) {
    /* commit enqueue optional */
  }

  try {
    const beatIngest = require('./beat-writer-ingest');
    if (typeof beatIngest.runBeatWriterIngest === 'function') {
      await beatIngest.runBeatWriterIngest({ force: true });
    }
  } catch (err) {
    /* beat ingest optional — continue with cached intel */
  }

  const queueItems = store.loadQueue().items || [];
  const candidates = await collectFreshPostCandidates({ forcePost: true });
  let lastNeedsResolution = null;

  for (const raw of candidates) {
    if (raw._nonPlayerSkip || raw.skipReason === 'non_player_intel') continue;
    if (raw._needsResolution || raw.skipReason === 'needs_resolution') {
      lastNeedsResolution = raw;
      continue;
    }
    if (raw.skipReason || raw._skipReason || raw._identitySkip) continue;

    const scored = await finalizeNewsCandidate(raw);
    if (!scored) continue;

    if (alreadyQueued(scored.text, queueItems)) {
      const pendingMatch = findPendingQueueItemForText(scored.text, queueItems);
      if (pendingMatch) {
        const queued = await autoposter.processQueueItem(pendingMatch);
        if (queued.ok) return successFromQueueResult(queued, 'force-post:queued-intel');
      }
      return { ok: false, posted: false, error: 'duplicate', source: 'force-post' };
    }

    const check = policy.validatePostContent(scored);
    if (!check.valid) continue;

    try {
      const qa = require('./autoposter/recruiting-post-qa');
      if (qa.isRecruitingPlayerCandidate(scored) && !qa.passesPublishGate(scored)) continue;
    } catch {
      /* optional */
    }

    try {
      const result = await autoposter.postTweet({ text: scored.text });
      const ts = store.nowIso();
      freshness.recordLastPost(ts);
      autoposter.saveSchedulerStatus({
        lastPostAt: ts,
        lastPostSuccess: ts,
        lastError: null
      });

      opsMonitor.logEvent({
        subsystem: 'autoposter',
        status: 'success',
        message: 'Force post successful',
        details: { source: 'force-post', tweetId: result.tweetId, preview: String(scored.text).slice(0, 80) }
      });

      return {
        ok: true,
        posted: true,
        timestamp: ts,
        source: 'force-post',
        tweetId: result.tweetId,
        tweetUrl: result.tweetUrl,
        text: scored.text
      };
    } catch (err) {
      if (/duplicate content/i.test(err.message)) {
        return { ok: false, posted: false, error: 'duplicate', source: 'force-post' };
      }
      opsMonitor.logEvent({
        subsystem: 'autoposter',
        status: 'error',
        message: `Force post failed: ${err.message}`,
        details: { source: 'force-post' }
      });
      return { ok: false, posted: false, error: mapPostError(err), source: 'force-post' };
    }
  }

  if (lastNeedsResolution) {
    opsMonitor.logEvent({
      subsystem: 'autoposter',
      status: 'needs_resolution',
      message: 'Force post deferred: auto-resolution incomplete',
      details: {
        missingFields: lastNeedsResolution.missingFields || [],
        playerName: lastNeedsResolution.playerName || null,
        triggerPhrase: lastNeedsResolution.triggerPhrase || null
      }
    });
    return {
      ok: true,
      posted: false,
      source: 'force-post',
      needs_resolution: true,
      ...autoposterIdentity.formatNeedsResolutionResponse(lastNeedsResolution)
    };
  }

  return {
    ok: false,
    posted: false,
    error: 'no_fresh_intel',
    source: 'force-post',
    ...forcePostDiagnostics()
  };
  } finally {
    delete process.env.X_AUTOPOST_FORCE_POST;
  }
}

async function forcePostNow() {
  const queueResult = await forcePostQueueOnly();
  if (queueResult?.posted) return queueResult;
  if (queueResult && !queueResult.posted && queueResult.error) {
    return { ...queueResult, ...forcePostDiagnostics() };
  }
  return forcePostDiscover();
}

function formatForcePostJson(out) {
  if (out.ok && out.posted) {
    return {
      status: 200,
      body: {
        ok: true,
        posted: true,
        timestamp: out.timestamp,
        source: out.source || 'force-post',
        tweetId: out.tweetId,
        tweetUrl: out.tweetUrl
      }
    };
  }
  if (out.ok && out.needs_resolution) {
    return {
      status: 200,
      body: {
        ok: true,
        posted: false,
        needs_resolution: true,
        source: out.source || 'force-post',
        playerName: out.playerName || null,
        playerSlug: out.playerSlug || null,
        triggerPhrase: out.triggerPhrase || null,
        missingPattern: out.missingPattern || null,
        missingPatterns: out.missingPatterns || [],
        missingFields: out.missingFields || [],
        reason: out.reason || null,
        patternRebuildAttempted: out.patternRebuildAttempted || false
      }
    };
  }
  return {
    status: out.error === 'duplicate' ? 409 : 400,
    body: {
      ok: false,
      posted: false,
      error: out.error || 'x_api_error',
      source: out.source || 'force-post',
      pendingCount: out.pendingCount ?? null,
      failedCount: out.failedCount ?? null,
      lastFailedError: out.lastFailedError ?? null,
      lastFailedItemId: out.lastFailedItemId ?? null,
      oauthConfigured: out.oauthConfigured ?? null,
      autopostEnabled: out.autopostEnabled ?? null,
      playerName: out.playerName || null,
      playerSlug: out.playerSlug || null,
      triggerPhrase: out.triggerPhrase || null,
      missingPattern: out.missingPattern || null,
      missingPatterns: out.missingPatterns || [],
      missingFields: out.missingFields || [],
      reason: out.reason || out.error || null,
      patternRebuildAttempted: out.patternRebuildAttempted || false
    }
  };
}

module.exports = {
  forcePostNow,
  forcePostQueueOnly,
  forcePostDiscover,
  formatForcePostJson,
  mapPostError,
  forceProcessQueuedPost
};
