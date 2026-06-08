/**
 * GatorVault X AutoPoster — OAuth 1.0a user context (@gatorvault).
 * Posting, media upload, scheduled queue. Read-only beat stream stays on Bearer in live-beat.js.
 */
const fs = require('fs');
const path = require('path');
const { loadOAuth1Credentials, isOAuth1Configured, oauth1Request } = require('./x-oauth1');
const store = require('./x-autoposter-store');

const API_V11 = 'https://api.twitter.com/1.1';
const UPLOAD_V11 = 'https://upload.twitter.com/1.1';

const X_ACCOUNT = process.env.X_AUTOPOST_ACCOUNT || 'gatorvault';

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
  return {
    configured,
    authMode: 'oauth1_user_context',
    account: `@${X_ACCOUNT}`,
    apiKeyHint: creds.apiKey ? `${creds.apiKey.slice(0, 4)}…` : null,
    accessTokenHint: creds.accessToken ? `${creds.accessToken.slice(0, 8)}…` : null,
    schedulerEnabled: process.env.X_AUTOPOST_ENABLED === 'true',
    schedulerIntervalMs: parseInt(process.env.X_AUTOPOST_INTERVAL_MS || '60000', 10),
    lastVerify: _statusCache.checkedAt ? { ..._statusCache } : null
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

async function postTweet({ text, mediaIds = [], mediaPath = null, mediaBase64 = null, mediaMime = null }) {
  const status = String(text || '').trim();
  if (!status) throw new Error('Tweet text required');
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

  const form = { status };
  if (ids.length) form.media_ids = ids.join(',');

  const data = await oauth1Request({
    method: 'POST',
    url: `${API_V11}/statuses/update.json`,
    form
  });

  const tweetId = data.id_str || String(data.id || '');
  const screenName = data.user?.screen_name || _statusCache.screenName || X_ACCOUNT;

  return {
    ok: true,
    tweetId,
    tweetUrl: tweetId ? `https://x.com/${screenName}/status/${tweetId}` : null,
    text: data.text || status,
    createdAt: data.created_at || store.nowIso()
  };
}

async function processQueueItem(item) {
  try {
    const result = await postTweet({
      text: item.text,
      mediaBase64: item.mediaBase64 || null,
      mediaMime: item.mediaMime || null
    });
    store.updatePost(item.id, {
      status: 'sent',
      sentAt: store.nowIso(),
      tweetId: result.tweetId,
      tweetUrl: result.tweetUrl,
      error: null
    });
    return { ok: true, item: store.loadQueue().items.find((i) => i.id === item.id), result };
  } catch (err) {
    store.updatePost(item.id, {
      status: 'failed',
      error: err.message,
      sentAt: store.nowIso()
    });
    return { ok: false, itemId: item.id, error: err.message };
  }
}

async function processDuePosts({ limit = 5 } = {}) {
  const due = store.getDuePosts(limit);
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
    console.log('[x-autoposter] scheduler disabled (set X_AUTOPOST_ENABLED=true)');
    return;
  }

  const intervalMs = parseInt(process.env.X_AUTOPOST_INTERVAL_MS || '60000', 10);
  const bootDelay = parseInt(process.env.X_AUTOPOST_BOOT_DELAY_MS || '20000', 10);

  verifyCredentials()
    .then((s) => {
      if (s.ok) console.log(`[x-autoposter] OAuth 1.0a verified as @${s.screenName}`);
      else console.warn('[x-autoposter] OAuth verify failed:', s.error);
    })
    .catch((e) => console.warn('[x-autoposter] OAuth verify error', e.message));

  setTimeout(() => {
    const tick = async () => {
      if (_processing) return;
      _processing = true;
      try {
        const out = await processDuePosts();
        if (out.processed > 0) {
          console.log(`[x-autoposter] processed ${out.processed} scheduled post(s)`);
        }
      } catch (e) {
        console.warn('[x-autoposter] scheduler tick failed', e.message);
      } finally {
        _processing = false;
      }
    };
    tick();
    _schedulerTimer = setInterval(tick, intervalMs);
    console.log(`[x-autoposter] scheduler started (every ${intervalMs}ms)`);
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
  stopXAutoposterScheduler
};
