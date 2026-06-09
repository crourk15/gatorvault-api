/**
 * GatorVault X AutoPoster — OAuth 1.0a user context (@gatorvault).
 * Posting, media upload, scheduled queue. Read-only beat stream stays on Bearer in live-beat.js.
 */
const fs = require('fs');
const path = require('path');
const { loadOAuth1Credentials, isOAuth1Configured, oauth1Request, oauth1RequestJson } = require('./x-oauth1');
const store = require('./x-autoposter-store');
const policy = require('./x-autoposter-policy');
const { refillAutoposterQueue } = require('./x-autoposter-fill');
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
    lastVerify: _statusCache.checkedAt ? { ..._statusCache } : null,
    scheduler: getSchedulerStatus()
  };
}

async function verifyCredentials({ force = false } = {}) {
  if (!isOAuth1Configured()) {
    _statusCache = {
      configured: false,
      ok: false,
      screenName: null,
      userId: null,
      error:
        'OAuth 1.0a keys missing. Set X_OAUTH1_API_KEY, X_OAUTH1_API_SECRET, X_OAUTH1_ACCESS_TOKEN, X_OAUTH1_ACCESS_TOKEN_SECRET.',
      checkedAt: store.nowIso()
    };
    return { ..._statusCache };
  }

  const stale =
    !_statusCache.checkedAt ||
    Date.now() - new Date(_statusCache.checkedAt).getTime() > 5 * 60 * 1000;
  if (!force && _statusCache.configured && _statusCache.ok && !stale) {
    return { ..._statusCache };
  }

  try {
    const data = await oauth1Request({
      method: 'GET',
      url: `${API_V11}/account/verify_credentials.json`,
      form: { skip_status: 'true', include_email: 'false' }
    });

    _statusCache = {
      configured: true,
      ok: true,
      screenName: data.screen_name || null,
      userId: data.id_str || String(data.id || ''),
      error: null,
      checkedAt: store.nowIso()
    };
    return { ..._statusCache };
  } catch (err) {
    _statusCache = {
      configured: true,
      ok: false,
      screenName: null,
      userId: null,
      error: err.message,
      checkedAt: store.nowIso()
    };
    return { ..._statusCache };
  }
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
  if (quoteUrl && !status.includes(quoteUrl)) {
    status = `${status} ${quoteUrl}`.trim();
  }

  if (status.length > 280) throw new Error('Tweet exceeds 280 characters');

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
  if (quoteTweetId && !quoteUrl) {
    payload.quote_tweet_id = String(quoteTweetId);
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

async function processQueueItem(item) {
  saveSchedulerStatus({ lastPostAttempt: store.nowIso(), lastError: null });
  autopostLog('info', 'Posting…', { itemId: item.id, category: item.category, preview: String(item.text || '').slice(0, 80) });
  const check = policy.validatePostContent(item);
  if (!check.valid) {
    const errMsg = check.errors.map((e) => e.message).join(' ');
    autopostLog('error', `Error: validation failed`, { itemId: item.id, errMsg });
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
      text: item.text,
      mediaBase64: item.mediaBase64 || null,
      mediaMime: item.mediaMime || null,
      inReplyToStatusId: item.action === 'reply' ? item.inReplyToStatusId : null,
      quoteTweetUrl: item.action === 'quote' ? item.quoteTweetUrl : null,
      quoteTweetId: item.action === 'quote' ? item.quoteTweetId : null
    });
    store.updatePost(item.id, {
      status: 'sent',
      sentAt: store.nowIso(),
      tweetId: result.tweetId,
      tweetUrl: result.tweetUrl,
      error: null,
      validationErrors: []
    });
    saveSchedulerStatus({
      lastPostSuccess: store.nowIso(),
      lastError: null
    });
    if (isReplyEnabled() && item.action === 'post') {
      try {
        const replyOut = await scheduleRepliesForSentPost({ item, tweetId: result.tweetId });
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
      autopostLog('warn', 'Skipped duplicate tweet (already on timeline)', { itemId: item.id });
      store.updatePost(item.id, {
        status: 'skipped_duplicate',
        error: err.message,
        sentAt: store.nowIso()
      });
      saveSchedulerStatus({ lastPostSuccess: store.nowIso(), lastError: null });
      return { ok: true, skipped: true, duplicate: true, itemId: item.id };
    }
    autopostLog('error', `Error: ${err.message}`, { itemId: item.id });
    store.updatePost(item.id, {
      status: 'failed',
      error: err.message,
      sentAt: store.nowIso()
    });
    saveSchedulerStatus({ lastError: err.message });
    return { ok: false, itemId: item.id, error: err.message };
  }
}

async function processDuePosts({ limit = 5 } = {}) {
  const due = store.getDuePosts(limit);
  if (due.length) autopostLog('info', `Processing ${due.length} due post(s)…`);
  const results = [];
  for (const item of due) {
    results.push(await processQueueItem(item));
  }
  return { processed: results.length, results };
}

let _schedulerTimer = null;
let _processing = false;

function startXAutoposterScheduler() {
  if (process.env.X_AUTOPOST_ENABLED !== 'true') {
    autopostLog('warn', 'Cron disabled — set X_AUTOPOST_ENABLED=true');
    saveSchedulerStatus({ lastError: 'Scheduler disabled — X_AUTOPOST_ENABLED is not true' });
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
        const out = await processDuePosts();
        saveSchedulerStatus({
          lastProcessedCount: out.processed || 0,
          lastError: null
        });
        if (out.processed > 0) {
          autopostLog('info', `Cron tick processed ${out.processed} post(s)`);
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
  saveSchedulerStatus
};
