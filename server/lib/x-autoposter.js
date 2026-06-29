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

  if (status.length > 280) throw new Error('Tweet exceeds 280 characters');

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

/** One-shot copy tweak when X rejects identical body (common on re-queued commits). */
function duplicateRecoveryText(text) {
  const base = String(text || '').trim();
  if (!base || /#GoGators\b/i.test(base)) return null;
  const suffix = '\n#GoGators';
  if (base.length + suffix.length > 280) return null;
  return `${base}${suffix}`;
}

async function processQueueItem(item) {
  if (!pipelineGuards.autopostEnabled()) {
    return { ok: false, skipped: true, reason: 'autoposter disabled', itemId: item?.id };
  }
  saveSchedulerStatus({ lastPostAttempt: store.nowIso(), lastError: null });
  store.logQueueOp('post_attempt', item, { preview: String(item.text || '').slice(0, 120) });

  let workingItem = item;
  try {
    const intelligencePipeline = require('./autoposter/intelligence-pipeline');
    const prepared = await intelligencePipeline.prepareQueueItemForPost(item);
    if (!prepared.ok) {
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
    if (prepared.item && prepared.item.text) {
      workingItem = prepared.item;
      if (workingItem.text !== item.text) {
        store.updatePost(item.id, {
          text: workingItem.text,
          validationMeta: workingItem.validationMeta,
          templateBlocks: workingItem.templateBlocks
        });
      }
    }
  } catch (pipeErr) {
    autopostLog('warn', `Intelligence pipeline fallback: ${pipeErr.message}`, { itemId: item.id });
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
    const result = await postTweet({
      text: workingItem.text,
      mediaBase64: workingItem.mediaBase64 || null,
      mediaMime: workingItem.mediaMime || null,
      inReplyToStatusId: workingItem.action === 'reply' ? workingItem.inReplyToStatusId : null,
      quoteTweetUrl: workingItem.action === 'quote' ? workingItem.quoteTweetUrl : null,
      quoteTweetId: workingItem.action === 'quote' ? workingItem.quoteTweetId : null
    });
    store.updatePost(workingItem.id, {
      status: 'sent',
      sentAt: store.nowIso(),
      tweetId: result.tweetId,
      tweetUrl: result.tweetUrl,
      error: null,
      validationErrors: []
    });
    store.logQueueOp('post_success', { ...workingItem, status: 'sent', tweetId: result.tweetId });
    const postedAt = store.nowIso();
    freshness.recordLastPost(postedAt);
    saveSchedulerStatus({
      lastPostAt: postedAt,
      lastPostSuccess: postedAt,
      lastError: null
    });
    try {
      const monitoring = require('./autoposter/autoposter-monitoring');
      monitoring.logAutoposterEvent('post_success', {
        itemId: workingItem.id,
        intelId: workingItem.sourceIntelId,
        playerName: workingItem.playerName,
        statusId: result.tweetId,
        tweetUrl: result.tweetUrl
      });
      if (workingItem.sourceIntelId) {
        intelStore.markIntelXPosted(workingItem.sourceIntelId, {
          tweetId: result.tweetId,
          tweetUrl: result.tweetUrl
        });
      }
    } catch {
      /* optional */
    }
    opsMonitor.logEvent({
      subsystem: 'autoposter',
      status: 'success',
      message: 'Post successful',
      details: { tweetId: result.tweetId, itemId: workingItem.id, category: workingItem.category }
    });
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
    return { ok: true, item: store.loadQueue().items.find((i) => i.id === item.id), result };
  } catch (err) {
    if (isDuplicateTweetError(err)) {
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
          store.updatePost(workingItem.id, {
            text: altText,
            status: 'sent',
            sentAt: store.nowIso(),
            tweetId: retry.tweetId,
            tweetUrl: retry.tweetUrl,
            error: null,
            validationErrors: []
          });
          const postedAt = store.nowIso();
          freshness.recordLastPost(postedAt);
          saveSchedulerStatus({
            lastPostAt: postedAt,
            lastPostSuccess: postedAt,
            lastError: null
          });
          return {
            ok: true,
            item: store.loadQueue().items.find((i) => i.id === item.id),
            result: retry,
            duplicateRecovery: true
          };
        } catch (retryErr) {
          if (!isDuplicateTweetError(retryErr)) {
            throw retryErr;
          }
        }
      }
      autopostLog('warn', 'Skipped duplicate tweet (already on timeline)', { itemId: item.id });
      store.updatePost(item.id, {
        status: 'skipped_duplicate',
        error: err.message,
        sentAt: store.nowIso()
      });
      saveSchedulerStatus({
        lastPostAt: store.nowIso(),
        lastPostSuccess: store.nowIso(),
        lastError: null
      });
      return { ok: true, skipped: true, duplicate: true, itemId: item.id };
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
  if (!due.length) return { processed: 0, skipped: true, reason: 'no_due_posts', results: [] };

  autopostLog('info', `Force processing ${due.length} due post(s)…`);
  const results = [];
  for (const item of due) {
    results.push(await processQueueItem(item));
    if (results.length >= limit) break;
  }
  return { processed: results.length, skipped: false, forced: true, results };
}

let _schedulerTimer = null;
let _processing = false;

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
        const refill = await refillAutoposterQueue({ minPending: 2, maxEnqueue: 4 });
        if (refill.enqueuedCount > 0) {
          autopostLog('info', `Auto-filled queue with ${refill.enqueuedCount} post(s)`);
        }
        saveSchedulerStatus({
          lastRefillAt: store.nowIso(),
          lastRefillCount: refill.enqueuedCount || 0
        });
        const out = await processDuePosts({ limit: 1 });
        saveSchedulerStatus({
          lastProcessedCount: out.processed || 0,
          lastCadenceReason: out.cadence?.reason || out.reason || null,
          lastError: null
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
