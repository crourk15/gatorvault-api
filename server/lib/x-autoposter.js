/**
 * GatorVault X AutoPoster — OAuth 1.0a user context (@gatorvault).
 * Posting, media upload, scheduled queue. Read-only beat stream stays on Bearer in live-beat.js.
 */
const fs = require('fs');
const path = require('path');
const { loadOAuth1Credentials, isOAuth1Configured, oauth1Request, oauth1RequestJson, verifyOAuth1Credentials } = require('./x-oauth1');
const store = require('./x-autoposter-store');
const intelStore = require('./recruiting-intel-store');
const policy = require('./x-autoposter-policy');
const { getTweetCharLimit } = require('./autoposter/tweet-char-limit');
const { refillAutoposterQueue } = require('./x-autoposter-fill');
const cadence = require('./x-autoposter-cadence');
const freshness = require('./autoposter-freshness');
const opsMonitor = require('./ops-monitor');
const pipelineGuards = require('./pipeline-guards');
const {
  isReplyEnabled,
  scheduleRepliesForSentPost,
  scanTrendingEngagementReplies
} = require('./x-autoposter-replies');

const API_V11 = 'https://api.twitter.com/1.1';
const API_V2 = 'https://api.twitter.com/2';
const UPLOAD_V11 = 'https://upload.twitter.com/1.1';

const X_ACCOUNT = process.env.X_AUTOPOST_ACCOUNT || 'gatorvault';
const LOG_MAX = 100;
const STATUS_PATH = path.join(__dirname, '..', 'data', 'x', 'autoposter-status.json');
const _logs = [];

function loadSchedulerStatus() {
  try {
    return JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
  } catch {
    return {
      version: 1,
      updatedAt: null,
      schedulerEnabled: false,
      schedulerStartedAt: null,
      lastRun: null,
      lastPostAttempt: null,
      lastPostSuccess: null,
      lastPostAt: null,
      lastRefillAt: null,
      lastRefillCount: 0,
      lastProcessedCount: 0,
      lastError: null
    };
  }
}

function saveSchedulerStatus(patch) {
  const next = {
    ...loadSchedulerStatus(),
    ...patch,
    schedulerEnabled: process.env.X_AUTOPOST_ENABLED === 'true',
    updatedAt: store.nowIso()
  };
  fs.mkdirSync(path.dirname(STATUS_PATH), { recursive: true });
  fs.writeFileSync(STATUS_PATH, JSON.stringify(next, null, 2));
  return next;
}

function getSchedulerStatus() {
  return {
    ...loadSchedulerStatus(),
    schedulerEnabled: process.env.X_AUTOPOST_ENABLED === 'true'
  };
}

function autopostLog(level, message, detail) {
  const row = {
    ts: store.nowIso(),
    level,
    message,
    detail: detail || null
  };
  _logs.unshift(row);
  if (_logs.length > LOG_MAX) _logs.length = LOG_MAX;
  const tag = `[x-autoposter] ${message}`;
  if (level === 'error') console.error(tag, detail || '');
  else if (level === 'warn') console.warn(tag, detail || '');
  else console.log(tag, detail || '');
  return row;
}

function getAutoposterLogs(limit = 20) {
  return _logs.slice(0, Math.min(LOG_MAX, Math.max(1, limit)));
}

let _statusCache = {
  configured: false,
  ok: false,
  screenName: null,
  userId: null,
  error: null,
  checkedAt: null
};

function getConfigStatus() {
  const creds = loadOAuth1Credentials();
  const configured = isOAuth1Configured(creds);
  const envKeys = {
    X_OAUTH1_API_KEY: !!process.env.X_OAUTH1_API_KEY,
    X_OAUTH1_API_SECRET: !!process.env.X_OAUTH1_API_SECRET,
    X_OAUTH1_ACCESS_TOKEN: !!process.env.X_OAUTH1_ACCESS_TOKEN,
    X_OAUTH1_ACCESS_TOKEN_SECRET: !!process.env.X_OAUTH1_ACCESS_TOKEN_SECRET,
    TWITTER_API_KEY: !!process.env.TWITTER_API_KEY,
    TWITTER_API_SECRET: !!process.env.TWITTER_API_SECRET,
    TWITTER_ACCESS_TOKEN: !!process.env.TWITTER_ACCESS_TOKEN,
    TWITTER_ACCESS_SECRET: !!process.env.TWITTER_ACCESS_SECRET
  };
  return {
    configured,
    authMode: 'oauth1_user_context',
    account: `@${X_ACCOUNT}`,
    envKeysLoaded: envKeys,
    apiKeyHint: creds.apiKey ? `${creds.apiKey.slice(0, 4)}…` : null,
    accessTokenHint: creds.accessToken ? `${creds.accessToken.slice(0, 8)}…` : null,
    schedulerEnabled: process.env.X_AUTOPOST_ENABLED === 'true',
    replyEnabled: process.env.X_AUTOPOST_REPLY_ENABLED === 'true',
    schedulerIntervalMs: parseInt(process.env.X_AUTOPOST_INTERVAL_MS || '60000', 10),
    contentMix: policy.getContentPolicy().contentMixLabel,
    cadence: cadence.getCadenceConfig(),
    charLimit: getTweetCharLimit(),
    rewriteLive: {
      pr6: process.env.X_AUTOPOST_PR6_ENABLED === 'true',
      pr789: process.env.X_AUTOPOST_PR7_8_9_ENABLED === 'true',
      pr789AngleGolden: process.env.X_AUTOPOST_PR789_ANGLE_GOLDEN_LIVE !== 'false',
      voiceEngine: process.env.X_AUTOPOST_VOICE_ENGINE !== 'false'
    },
    lastVerify: _statusCache.checkedAt ? { ..._statusCache } : null,
    scheduler: getSchedulerStatus()
  };
}

async function verifyCredentials({ force = false } = {}) {
  const result = await verifyOAuth1Credentials({ force });
  _statusCache = { ...result, checkedAt: result.checkedAt || store.nowIso() };
  return { ..._statusCache };
}

async function uploadMedia({ filePath, base64, mimeType }) {
  let mediaData;
  if (base64) {
    mediaData = base64;
  } else if (filePath) {
    const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    if (!fs.existsSync(abs)) throw new Error(`Media file not found: ${abs}`);
    mediaData = fs.readFileSync(abs).toString('base64');
  } else {
    throw new Error('uploadMedia requires filePath or base64');
  }

  const data = await oauth1Request({
    method: 'POST',
    url: `${UPLOAD_V11}/media/upload.json`,
    form: { media: mediaData, media_category: mimeType && mimeType.startsWith('image/gif') ? 'tweet_gif' : 'tweet_image' }
  });

  if (!data.media_id_string) throw new Error('Media upload did not return media_id_string');
  return data.media_id_string;
}

async function postTweet({
  text,
  mediaIds = [],
  mediaPath = null,
  mediaBase64 = null,
  mediaMime = null,
  inReplyToStatusId = null,
  quoteTweetUrl = null,
  quoteTweetId = null,
  autoPopulateReplyMetadata = true
}) {
  let status = String(text || '').trim();
  if (!status) throw new Error('Tweet text required');

  const quoteUrl =
    quoteTweetUrl ||
    (quoteTweetId ? `https://x.com/i/status/${quoteTweetId}` : null);

  let ids = [...mediaIds];
  if (!ids.length && (mediaPath || mediaBase64)) {
    const mediaId = await uploadMedia({
      filePath: mediaPath || null,
      base64: mediaBase64 || null,
      mimeType: mediaMime
    });
    ids = [mediaId];
  }

  const payload = { text: status };
  if (ids.length) payload.media = { media_ids: ids };
  if (inReplyToStatusId) {
    payload.reply = { in_reply_to_tweet_id: String(inReplyToStatusId) };
  }
  if (quoteTweetId) {
    payload.quote_tweet_id = String(quoteTweetId);
  } else if (quoteUrl) {
    const m = quoteUrl.match(/status\/(\d+)/i);
    if (m) payload.quote_tweet_id = m[1];
  }

  if (status.length > getTweetCharLimit()) {
    throw new Error(`Tweet exceeds ${getTweetCharLimit()} characters`);
  }

  const data = await oauth1RequestJson({
    method: 'POST',
    url: `${API_V2}/tweets`,
    json: payload
  });

  const tweet = data.data || data;
  const tweetId = tweet.id || tweet.id_str || String(tweet.id || '');
  const screenName = _statusCache.screenName || X_ACCOUNT;

  autopostLog('success', 'Post successful', { tweetId, screenName });

  return {
    ok: true,
    tweetId,
    tweetUrl: tweetId ? `https://x.com/${screenName}/status/${tweetId}` : null,
    text: tweet.text || status,
    createdAt: tweet.created_at || store.nowIso()
  };
}

function isDuplicateTweetError(err) {
  const msg = String(err?.message || err || '');
  return /duplicate content/i.test(msg);
}

function duplicateRecoveryEnabled() {
  return process.env.X_AUTOPOST_DUPLICATE_RECOVERY === 'true';
}

/** Optional one-shot copy tweak when X rejects identical body (off by default). */
function duplicateRecoveryText(text) {
  const base = String(text || '').trim();
  if (!base || /#GoGators\b/i.test(base)) return null;
  const suffix = '\n#GoGators';
  if (base.length + suffix.length > getTweetCharLimit()) return null;
  return `${base}${suffix}`;
}

function duplicateGuardBeforePost(item) {
  const sentLedger = require('./x-autoposter-sent-ledger');
  const fill = require('./x-autoposter-fill');
  const postSpec = require('./x-autoposter-post-spec');
  const windowMs = postSpec.DEDUPE_REPOST_WINDOW_MS || 48 * 60 * 60 * 1000;
  const cutoff = Date.now() - windowMs;

  try {
    const phase3 = require('./autoposter/phase3-index');
    if (phase3.phase3Enabled()) {
      const story = phase3.storyMemory.hasRecentStoryUnit(item);
      if (story.hit) return { duplicate: true, reason: 'story_dedupe', ...story };
    }
  } catch {
    /* optional */
  }
  const ledgerHit = sentLedger.hasRecentSentPost({
    slug: item.playerSlug,
    intelFingerprint: item.intelFingerprint,
    text: item.text,
  });
  if (ledgerHit.hit) return { duplicate: true, ...ledgerHit };

  for (const q of store.loadQueue().items) {
    if (q.id === item.id || q.status !== 'sent' || !q.tweetId) continue;
    const ts = new Date(q.sentAt || 0).getTime();
    if (!Number.isFinite(ts) || ts < cutoff) continue;
    if (item.intelFingerprint && q.intelFingerprint && q.intelFingerprint === item.intelFingerprint) {
      return { duplicate: true, reason: 'queue_sent_fingerprint', tweetId: q.tweetId };
    }
    if (item.text && q.text && postSpec.isTooSimilar(item.text, q.text)) {
      return { duplicate: true, reason: 'queue_sent_similar', tweetId: q.tweetId };
    }
  }

  const others = store.loadQueue().items.filter((i) => i.id !== item.id);
  if (fill.alreadyQueued(item.text, others)) {
    return { duplicate: true, reason: 'queue_exact' };
  }
  const similar = fill.similarPostQueued(item.text, others, {
    slug: item.playerSlug,
    intelFingerprint: item.intelFingerprint,
  });
  if (similar) return { duplicate: true, reason: similar.reason || 'queue_similar', ...similar };
  return { duplicate: false };
}

function skipDuplicateQueueItem(item, reason, extra = {}) {
  autopostLog('warn', 'Skipped duplicate autopost (recent match)', {
    itemId: item.id,
    reason,
    playerSlug: item.playerSlug,
    ...extra,
  });
  store.updatePost(item.id, {
    status: 'skipped_duplicate',
    error: reason || 'duplicate',
    sentAt: store.nowIso(),
  });
  saveSchedulerStatus({
    lastDuplicateSkipAt: store.nowIso(),
    lastError: null,
  });
  return { ok: true, skipped: true, duplicate: true, itemId: item.id, reason };
}

function finalizeSuccessfulPost(workingItem, result, { duplicateRecovery = false } = {}) {
  const postedAt = store.nowIso();
  const patch = {
    status: 'sent',
    sentAt: postedAt,
    tweetId: result.tweetId,
    tweetUrl: result.tweetUrl,
    error: null,
    validationErrors: [],
  };
  if (duplicateRecovery && result.text) {
    patch.text = result.text;
  }
  store.updatePost(workingItem.id, patch);
  const posted = { ...workingItem, ...patch };
  recordAutoposterSend(posted, result, { duplicateRecovery, queueItemId: workingItem.id });
  store.logQueueOp('post_success', { ...posted, tweetId: result.tweetId });

  return {
    ok: true,
    item: store.loadQueue().items.find((i) => i.id === workingItem.id),
    result,
    duplicateRecovery: duplicateRecovery || undefined,
  };
}

function recordAutoposterSend(candidate, result, { duplicateRecovery = false, source = null, queueItemId = null } = {}) {
  const postedAt = store.nowIso();
  const posted = {
    ...candidate,
    status: 'sent',
    sentAt: candidate.sentAt || postedAt,
    tweetId: result.tweetId,
    tweetUrl: result.tweetUrl,
    id: queueItemId || candidate.id || null,
    source: source || candidate.source || 'autoposter'
  };

  try {
    const sentLedger = require('./x-autoposter-sent-ledger');
    sentLedger.recordSentPost(posted);
    if (posted.playerSlug && String(posted.topic || '').toLowerCase() === 'recruiting') {
      try {
        const resolutionLedger = require('./autoposter/player-resolution-ledger');
        resolutionLedger.markResolvedPublish(posted.playerSlug, {
          source: posted.source || 'autoposter_sent',
          queueItemId: posted.id || null,
          intelFingerprint: posted.intelFingerprint || null,
          preview: posted.text || null,
          tweetId: result.tweetId || null
        });
      } catch {
        /* optional */
      }
    }
    try {
      const phase3 = require('./autoposter/phase3-index');
      phase3.recordPostMemory(posted);
    } catch {
      /* optional */
    }
  } catch {
    /* optional */
  }

  freshness.recordLastPost(postedAt);
  saveSchedulerStatus({
    lastPostAt: postedAt,
    lastPostSuccess: postedAt,
    lastError: null,
  });

  try {
    const monitoring = require('./autoposter/autoposter-monitoring');
    monitoring.logAutoposterEvent('post_success', {
      itemId: posted.id,
      intelId: posted.sourceIntelId,
      playerName: posted.playerName,
      statusId: result.tweetId,
      tweetUrl: result.tweetUrl,
      duplicateRecovery: !!duplicateRecovery,
    });
    if (posted.sourceIntelId) {
      intelStore.markIntelXPosted(posted.sourceIntelId, {
        tweetId: result.tweetId,
        tweetUrl: result.tweetUrl,
      });
    }
  } catch {
    /* optional */
  }

  opsMonitor.logEvent({
    subsystem: 'autoposter',
    status: 'success',
    message: duplicateRecovery ? 'Post successful (duplicate recovery)' : 'Post successful',
    details: {
      tweetId: result.tweetId,
      itemId: posted.id,
      category: posted.category,
      duplicateRecovery: !!duplicateRecovery,
      source: posted.source || null
    },
  });

  return posted;
}

function bootstrapAutoposterRuntime() {
  try {
    const sentLedger = require('./x-autoposter-sent-ledger');
    const pruned = sentLedger.prunePhantomLedgerEntries();
    if (pruned > 0) {
      autopostLog('info', `Pruned ${pruned} phantom sent-ledger row(s)`);
    }
  } catch (e) {
    autopostLog('warn', `Sent ledger prune skipped: ${e.message}`);
  }
  try {
    const persistence = require('./autoposter/autoposter-ledger-persistence');
    if (persistence.isEnabled()) {
      persistence.ensureTables().catch((err) => {
        autopostLog('warn', `Ledger table ensure skipped: ${err.message}`);
      });
      persistence.hydrateAllLedgers().then((out) => {
        autopostLog('info', 'Hydrated autoposter ledgers from Postgres', out);
      }).catch((err) => {
        autopostLog('warn', `Ledger hydrate skipped: ${err.message}`);
      });
    }
  } catch (e) {
    autopostLog('warn', `Ledger hydrate skipped: ${e.message}`);
  }
  try {
    const doc = store.loadQueue();
    const { removed } = policy.purgeFixtureQueueItems(doc);
    if (removed > 0) {
      store.saveQueue(doc);
      autopostLog('info', `Purged ${removed} fixture/demo queue item(s)`);
    }
  } catch (e) {
    autopostLog('warn', `Fixture queue purge skipped: ${e.message}`);
  }
}

async function processQueueItem(item) {
  if (!pipelineGuards.autopostEnabled()) {
    return { ok: false, skipped: true, reason: 'autoposter disabled', itemId: item?.id };
  }
  if (policy.isFixtureQueueItem(item)) {
    autopostLog('warn', 'Skipping fixture/demo queue item', { itemId: item.id });
    store.updatePost(item.id, {
      status: 'cancelled',
      error: 'fixture_source',
      sentAt: store.nowIso(),
    });
    return { ok: false, skipped: true, reason: 'fixture_source', itemId: item.id };
  }
  saveSchedulerStatus({ lastPostAttempt: store.nowIso(), lastError: null });
  store.logQueueOp('post_attempt', item, { preview: String(item.text || '').slice(0, 120) });

  let workingItem = item;
  try {
    const intelligencePipeline = require('./autoposter/intelligence-pipeline');
    const prepared = await intelligencePipeline.prepareQueueItemForPost(item);
    if (prepared.ok && prepared.item?.text) {
      workingItem = prepared.item;
      if (workingItem.text !== item.text) {
        store.updatePost(item.id, {
          text: workingItem.text,
          validationMeta: workingItem.validationMeta,
          templateBlocks: workingItem.templateBlocks
        });
      }
    } else if (!prepared.ok) {
      const verified = item.verifiedCommit || item.validationMeta?.verifiedCommit;
      const detectivesItem =
        String(item.source || '').includes('detectives') || item.validationMeta?.detectivesResolved === true;
      const elitePremade =
        !detectivesItem &&
        (item.validationMeta?.eliteCompose ||
          item.validationMeta?.eliteDigest ||
          String(item.source || '').includes('beat-intel'));
      const check = verified || elitePremade ? policy.validatePostContent(item) : null;
      if ((verified || elitePremade) && check?.valid) {
        autopostLog('warn', `Premade copy used after ${prepared.reason || 'rewrite_failed'}`, {
          itemId: item.id,
          elitePremade: !!elitePremade
        });
        workingItem = item;
      } else {
        const errMsg = prepared.reason || 'rewrite_failed';
        autopostLog('error', `Error: intelligence rewrite failed`, {
          itemId: item.id,
          errMsg,
          quality: prepared.quality
        });
        store.updatePost(item.id, {
          status: 'failed',
          error: errMsg,
          validationErrors: [{ message: errMsg }],
          sentAt: store.nowIso()
        });
        saveSchedulerStatus({ lastError: errMsg });
        return { ok: false, itemId: item.id, error: errMsg, rewrite: prepared.quality };
      }
    } else if (prepared.item?.text) {
      workingItem = prepared.item;
    }
  } catch (pipeErr) {
    autopostLog('warn', `Intelligence pipeline fallback: ${pipeErr.message}`, { itemId: item.id });
  }

  try {
    const { applyPublishSafetyToItem } = require('./autoposter/publish-routing');
    const safeItem = applyPublishSafetyToItem(workingItem);
    if (!safeItem) {
      const errMsg = 'banned_phrases_no_pr6_fallback';
      autopostLog('error', 'Blocked post — banned filler with no clean PR-6 fallback', {
        itemId: item.id,
        preview: String(workingItem.text || '').slice(0, 160)
      });
      store.updatePost(item.id, {
        status: 'failed',
        error: errMsg,
        validationErrors: [{ type: 'banned_filler', message: errMsg }],
        sentAt: store.nowIso()
      });
      saveSchedulerStatus({ lastError: errMsg });
      return { ok: false, itemId: item.id, error: errMsg, blocked: true };
    }
    if (safeItem.text !== workingItem.text) {
      workingItem = safeItem;
      store.updatePost(item.id, { text: workingItem.text, validationMeta: workingItem.validationMeta });
    }
  } catch (safetyErr) {
    autopostLog('warn', `Publish safety check skipped: ${safetyErr.message}`, { itemId: item.id });
  }

  try {
    const eligibility = await policy.validateRecruitingPostEligibility(workingItem);
    if (!eligibility.ok) {
      const errMsg = eligibility.reason || 'committed_elsewhere';
      autopostLog('warn', 'Blocked post — player committed elsewhere', {
        itemId: item.id,
        playerSlug: workingItem.playerSlug,
        committedTo: eligibility.committedTo || null
      });
      store.updatePost(item.id, {
        status: 'cancelled',
        error: errMsg,
        validationErrors: [{ type: errMsg, message: `Player committed to ${eligibility.committedTo || 'another school'}` }],
        sentAt: store.nowIso()
      });
      saveSchedulerStatus({ lastError: errMsg });
      return { ok: false, itemId: item.id, skipped: true, reason: errMsg, blocked: true };
    }
  } catch (eligErr) {
    autopostLog('warn', `Commitment eligibility check skipped: ${eligErr.message}`, { itemId: item.id });
  }

  autopostLog('info', 'Posting…', {
    itemId: workingItem.id,
    category: workingItem.category,
    source: workingItem.source,
    topic: workingItem.topic,
    text: String(workingItem.text || ''),
    preview: String(workingItem.text || '').slice(0, 120)
  });
  const check = policy.validatePostContent(workingItem);
  if (!check.valid) {
    const errMsg = check.errors.map((e) => e.message).join(' ');
    autopostLog('error', `Error: validation failed`, {
      itemId: item.id,
      errMsg,
      text: String(item.text || '').slice(0, 200),
      validation: check.errors
    });
    store.updatePost(item.id, {
      status: 'failed',
      error: check.errors.map((e) => e.message).join(' '),
      validationErrors: check.errors,
      sentAt: store.nowIso()
    });
    saveSchedulerStatus({ lastError: errMsg });
    return { ok: false, itemId: item.id, error: 'Validation failed', validation: check };
  }

  try {
    const qa = require('./autoposter/recruiting-post-qa');
    if (qa.isRecruitingPlayerCandidate(workingItem) && !qa.passesPublishGate(workingItem)) {
      const errMsg = `recruiting_qa:${qa.rejectReason(workingItem)}`;
      autopostLog('error', 'Blocked generic recruiting post at send time', {
        itemId: item.id,
        reason: qa.rejectReason(workingItem),
        preview: String(workingItem.text || '').slice(0, 160)
      });
      store.updatePost(item.id, {
        status: 'cancelled',
        error: errMsg,
        sentAt: store.nowIso()
      });
      saveSchedulerStatus({ lastError: errMsg });
      return { ok: false, itemId: item.id, error: errMsg, blocked: true };
    }
  } catch {
    /* optional */
  }

  const dupGuard = duplicateGuardBeforePost(workingItem);
  if (dupGuard.duplicate) {
    return skipDuplicateQueueItem(workingItem, dupGuard.reason || 'duplicate_guard', dupGuard);
  }

  try {
    const engagement = require('./autoposter/engagement-tracker');
    const taggedText = engagement.tagPostText(workingItem.text, workingItem);
    if (taggedText && taggedText !== workingItem.text) {
      workingItem = { ...workingItem, text: taggedText };
    }
  } catch {
    /* optional */
  }

  try {
    const result = await postTweet({
      text: workingItem.text,
      mediaBase64: workingItem.mediaBase64 || null,
      mediaMime: workingItem.mediaMime || null,
      inReplyToStatusId: workingItem.action === 'reply' ? workingItem.inReplyToStatusId : null,
      quoteTweetUrl: workingItem.action === 'quote' ? workingItem.quoteTweetUrl : null,
      quoteTweetId: workingItem.action === 'quote' ? workingItem.quoteTweetId : null
    });
    const out = finalizeSuccessfulPost(workingItem, result);
    if (isReplyEnabled() && workingItem.action === 'post') {
      try {
        const replyOut = await scheduleRepliesForSentPost({ item: workingItem, tweetId: result.tweetId });
        if (replyOut.scheduled > 0) {
          autopostLog('info', `Scheduled ${replyOut.scheduled} reply/replies`, { parentTweetId: result.tweetId });
        }
      } catch (replyErr) {
        autopostLog('warn', `Reply scheduling failed: ${replyErr.message}`, { itemId: item.id });
      }
    }
    return out;
  } catch (err) {
    if (isDuplicateTweetError(err)) {
      if (duplicateRecoveryEnabled()) {
        const altText = duplicateRecoveryText(workingItem.text);
        if (altText && altText !== workingItem.text) {
          try {
            autopostLog('info', 'Retrying duplicate tweet with recovery suffix', { itemId: item.id });
            const retry = await postTweet({
              text: altText,
              mediaBase64: workingItem.mediaBase64 || null,
              mediaMime: workingItem.mediaMime || null,
              inReplyToStatusId:
                workingItem.action === 'reply' ? workingItem.inReplyToStatusId : null,
              quoteTweetUrl: workingItem.action === 'quote' ? workingItem.quoteTweetUrl : null,
              quoteTweetId: workingItem.action === 'quote' ? workingItem.quoteTweetId : null
            });
            return finalizeSuccessfulPost(
              { ...workingItem, text: altText },
              { ...retry, text: altText },
              { duplicateRecovery: true }
            );
          } catch (retryErr) {
            if (!isDuplicateTweetError(retryErr)) {
              throw retryErr;
            }
          }
        }
      }
      return skipDuplicateQueueItem(item, 'x_duplicate_content', { error: err.message });
    }
    autopostLog('error', `Error: ${err.message}`, { itemId: item.id });
    store.updatePost(item.id, {
      status: 'failed',
      error: err.message,
      sentAt: store.nowIso()
    });
    store.logQueueOp('post_failed', { ...item, status: 'failed' }, { error: err.message });
    saveSchedulerStatus({ lastError: err.message });
    opsMonitor.logEvent({
      subsystem: 'autoposter',
      status: 'error',
      message: `Post failed: ${err.message}`,
      details: { itemId: item.id, category: item.category }
    });
    return { ok: false, itemId: item.id, error: err.message };
  }
}

async function processDuePosts({ limit = 1, force = false } = {}) {
  store.recoverFailedVerifiedCommits();
  store.recoverFailedPostableItems();
  const pending = store.listQueue({ status: 'pending' });
  const status = loadSchedulerStatus();
  const lastPostAt = status.lastPostAt || status.lastPostSuccess || null;

  if (!force) {
    const window = cadence.evaluatePostWindow({ pendingItems: pending, lastPostAt });
    if (!window.allowed) {
      autopostLog('info', `Cadence hold (${window.reason})`, {
        waitMs: window.waitMs,
        tier: window.tier,
        label: window.label,
        nightMode: window.nightMode
      });
      saveSchedulerStatus({
        lastCadenceCheck: store.nowIso(),
        lastCadenceReason: window.reason,
        cadenceWaitMs: window.waitMs || 0,
        nightMode: window.nightMode
      });
      return { processed: 0, skipped: true, cadence: window, results: [] };
    }

    const item = window.item;
    autopostLog('info', `Cadence post (${window.reason})`, {
      tier: window.tier,
      label: window.label,
      itemId: item.id
    });
    const result = await processQueueItem(item);
    return { processed: 1, skipped: false, cadence: window, results: [result] };
  }

  const due = pending
    .filter((i) => new Date(i.scheduledAt).getTime() <= Date.now())
    .slice(0, Math.max(1, limit));
  let targets = due;
  if (!targets.length && pending.length) {
    const next = cadence.pickNextPost(
      pending.map((i) => ({ ...i, scheduledAt: store.nowIso() }))
    );
    targets = next ? [next] : [pending[0]];
  }
  if (!targets.length) return { processed: 0, skipped: true, reason: 'no_due_posts', results: [] };

  autopostLog('info', `Force processing ${targets.length} due post(s)…`);
  const results = [];
  for (const item of targets) {
    results.push(await processQueueItem(item));
    if (results.length >= limit) break;
  }
  return { processed: results.length, skipped: false, forced: true, results };
}

let _schedulerTimer = null;
let _processing = false;
let _emptyQueueStreak = 0;

function startXAutoposterScheduler() {
  if (!pipelineGuards.autopostEnabled()) {
    autopostLog('warn', 'Cron disabled — X_PIPELINES_ENABLED and X_AUTOPOST_ENABLED must be true');
    saveSchedulerStatus({ lastError: 'Scheduler disabled — autoposter pipelines off' });
    return;
  }

  const intervalMs = parseInt(process.env.X_AUTOPOST_INTERVAL_MS || '60000', 10);
  const bootDelay = parseInt(process.env.X_AUTOPOST_BOOT_DELAY_MS || '20000', 10);
  const replyOn = isReplyEnabled();

  saveSchedulerStatus({
    schedulerStartedAt: store.nowIso(),
    lastError: null
  });

  bootstrapAutoposterRuntime();

  try {
    const sentLedger = require('./x-autoposter-sent-ledger');
    const doc = store.loadQueue();
    const bootstrapped = sentLedger.bootstrapFromQueueItems(doc.items);
    if (bootstrapped) {
      autopostLog('info', `Restored ${bootstrapped} sent post(s) into autopost ledger`);
    }
  } catch (e) {
    autopostLog('warn', `Sent ledger bootstrap skipped: ${e.message}`);
  }

  verifyCredentials()
    .then((s) => {
      if (s.ok) autopostLog('info', `OAuth verified as @${s.screenName}`);
      else {
        autopostLog('error', `Error: OAuth verify failed — ${s.error}`);
        saveSchedulerStatus({ lastError: s.error });
      }
    })
    .catch((e) => {
      autopostLog('error', `Error: OAuth verify — ${e.message}`);
      saveSchedulerStatus({ lastError: e.message });
    });

  setTimeout(() => {
    autopostLog('info', 'Cron started', { intervalMs, bootDelay, replyEnabled: replyOn });
    const tick = async () => {
      if (_processing) return;
      _processing = true;
      saveSchedulerStatus({ lastRun: store.nowIso() });
      try {
        const pendingBefore = store.listQueue({ status: 'pending' }).length;
        const freshnessMod = require('./autoposter-freshness');
        const schedulerStatus = loadSchedulerStatus();
        const postFloorMs = parseInt(process.env.X_AUTOPOST_POST_FLOOR_MS || String(2 * 60 * 60 * 1000), 10);
        const lastPostAt = schedulerStatus.lastPostAt || schedulerStatus.lastPostSuccess || null;
        const msSincePost = lastPostAt ? Date.now() - new Date(lastPostAt).getTime() : Infinity;
        const activityWindow = freshnessMod.getActivityWindow();
        const postFloorDue =
          activityWindow === 'normal' &&
          Number.isFinite(msSincePost) &&
          msSincePost >= postFloorMs;
        const fillMod = require('./x-autoposter-fill');
        const goldenPending =
          typeof fillMod.hasGoldenFourPending === 'function' ? fillMod.hasGoldenFourPending() : false;
        const forceRefill = pendingBefore === 0 || postFloorDue;
        const digDeeper = (postFloorDue || pendingBefore === 0) && !goldenPending;
        const refill = await Promise.race([
          refillAutoposterQueue({
            minPending: parseInt(process.env.X_AUTOPOST_REFILL_MIN_PENDING || '2', 10),
            maxEnqueue: parseInt(process.env.X_AUTOPOST_REFILL_MAX_ENQUEUE || '4', 10),
            forcePost: forceRefill,
            digDeeper
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('refill_timeout')), parseInt(process.env.X_AUTOPOST_REFILL_TIMEOUT_MS || '90000', 10))
          )
        ]).catch((err) => {
          autopostLog('warn', 'Refill timed out or failed', { error: err.message });
          return { enqueuedCount: 0, skipReasons: [{ reason: err.message }] };
        });
        if (postFloorDue && refill.enqueuedCount > 0) {
          autopostLog('info', 'Post floor refill — widened topic discovery', {
            msSincePost,
            enqueued: refill.enqueuedCount
          });
        }
        const pendingAfterRefill = store.listQueue({ status: 'pending' }).length;
        if (pendingAfterRefill === 0) {
          _emptyQueueStreak += 1;
        } else {
          _emptyQueueStreak = 0;
        }
        if (refill.enqueuedCount > 0) {
          autopostLog('info', `Auto-filled queue with ${refill.enqueuedCount} post(s)`);
        } else if (refill.detectivesRun?.results?.some((r) => r.queued)) {
          autopostLog('info', 'Detectives resolved intel into queue', {
            counts: refill.detectivesRun.counts
          });
        } else if (refill.detectivesRun?.processed > 0) {
          autopostLog('info', 'Detectives investigated pile (no queue pass yet)', {
            processed: refill.detectivesRun.processed,
            results: (refill.detectivesRun.results || []).slice(0, 3).map((r) => ({
              caseId: r.caseId,
              queued: !!r.queued,
              reason: r.reason || null,
              path: r.path || null
            }))
          });
        } else if (_emptyQueueStreak >= 3) {
          autopostLog('warn', 'Queue empty — elite fallback engaged', { streak: _emptyQueueStreak });
        }
        saveSchedulerStatus({
          lastRefillAt: store.nowIso(),
          lastRefillCount: refill.enqueuedCount || 0,
          lastSkipReasons: refill.skipReasons?.slice?.(0, 5) || null,
          postFloorDue: !!postFloorDue,
          digDeeper: !!digDeeper
        });
        const out = await processDuePosts({ limit: 1 });
        saveSchedulerStatus({
          lastProcessedCount: out.processed || 0,
          lastCadenceReason: out.cadence?.reason || out.reason || null,
          lastError: null,
          emptyQueueStreak: _emptyQueueStreak,
          pendingCount: store.listQueue({ status: 'pending' }).length
        });
        opsMonitor.logEvent({
          subsystem: 'autoposter:scheduler',
          status: out.processed > 0 ? 'success' : _emptyQueueStreak >= 5 ? 'warning' : 'success',
          message: out.processed > 0
            ? `Posted ${out.processed} item(s)`
            : `Tick — ${out.cadence?.reason || out.reason || 'no_post'}`,
          details: {
            pending: store.listQueue({ status: 'pending' }).length,
            enqueued: refill.enqueuedCount || 0,
            emptyQueueStreak: _emptyQueueStreak,
            cadence: out.cadence?.reason || out.reason || null
          }
        });
        if (out.processed > 0) {
          autopostLog('info', `Cron tick posted ${out.processed} item(s)`, {
            cadence: out.cadence?.reason,
            results: (out.results || []).map((r) => ({
              ok: r.ok,
              itemId: r.itemId,
              tweetId: r.tweetId,
              error: r.error
            }))
          });
        } else {
          autopostLog('info', 'Cron tick — no post', {
            skipped: out.skipped,
            reason: out.cadence?.reason || out.reason || 'cadence_hold',
            waitMs: out.cadence?.waitMs,
            pendingCount: store.listQueue({ status: 'pending' }).length
          });
        }
        if (isReplyEnabled()) {
          const trend = await scanTrendingEngagementReplies();
          if (trend.queued > 0) {
            autopostLog('info', `Queued ${trend.queued} trending engagement reply/replies`);
          }
        }
      } catch (e) {
        autopostLog('error', `Error: scheduler tick — ${e.message}`);
        saveSchedulerStatus({ lastError: e.message });
      } finally {
        _processing = false;
      }
    };
    tick();
    _schedulerTimer = setInterval(tick, intervalMs);
  }, bootDelay);
}

function stopXAutoposterScheduler() {
  if (_schedulerTimer) clearInterval(_schedulerTimer);
  _schedulerTimer = null;
}

module.exports = {
  getConfigStatus,
  verifyCredentials,
  uploadMedia,
  postTweet,
  processQueueItem,
  processDuePosts,
  recordAutoposterSend,
  finalizeSuccessfulPost,
  startXAutoposterScheduler,
  stopXAutoposterScheduler,
  getAutoposterLogs,
  getContentPolicy: policy.getContentPolicy,
  validatePostContent: policy.validatePostContent,
  getSchedulerStatus,
  saveSchedulerStatus,
  getCadenceConfig: cadence.getCadenceConfig,
  evaluatePostWindow: cadence.evaluatePostWindow
};
