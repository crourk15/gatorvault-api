/**
 * Force-post — immediate X post from freshest beat/intel (bypasses cadence).
 */
const store = require('./x-autoposter-store');
const policy = require('./x-autoposter-policy');
const autoposter = require('./x-autoposter');
const freshness = require('./autoposter-freshness');
const opsMonitor = require('./ops-monitor');
const autoposterIdentity = require('./autoposter-identity');
const {
  collectFreshPostCandidates,
  finalizeNewsCandidate,
  alreadyQueued
} = require('./x-autoposter-fill');

function mapPostError(err, context = {}) {
  const msg = String(err?.message || err || '').toLowerCase();
  if (/duplicate content/i.test(msg)) return 'duplicate';
  if (/needs_resolution/i.test(msg)) return 'needs_resolution';
  if (/identity|not confirmed|incomplete/i.test(msg)) return 'needs_resolution';
  if (/no fresh|no candidate|no_fresh/i.test(msg)) return 'no_fresh_intel';
  if (/validation/i.test(msg)) return 'validation_failed';
  return 'x_api_error';
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

async function forcePostNow() {
  autoposter.saveSchedulerStatus({ lastPostAttempt: store.nowIso(), lastError: null });

  try {
    const beatIngest = require('./beat-writer-ingest');
    if (typeof beatIngest.runBeatWriterIngest === 'function') {
      await beatIngest.runBeatWriterIngest({ force: true });
    }
  } catch (err) {
    /* beat ingest optional — continue with cached intel */
  }

  const queueItems = store.loadQueue().items || [];
  const candidates = await collectFreshPostCandidates();
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
      return { ok: false, posted: false, error: 'duplicate', source: 'force-post' };
    }

    const check = policy.validatePostContent(scored);
    if (!check.valid) continue;

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

  return { ok: false, posted: false, error: 'no_fresh_intel', source: 'force-post' };
}

module.exports = { forcePostNow, mapPostError };
