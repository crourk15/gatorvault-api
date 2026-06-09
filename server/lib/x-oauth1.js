/**
 * X (Twitter) OAuth 1.0a request signing — user context for posting.
 * Do NOT use Bearer tokens here; read-only beat stream uses live-beat.js separately.
 */
const crypto = require('crypto');
const fetch = require('node-fetch');

function percentEncode(str) {
  return encodeURIComponent(String(str)).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function loadOAuth1Credentials() {
  const apiKey =
    process.env.X_OAUTH1_API_KEY ||
    process.env.X_API_KEY ||
    process.env.X_CONSUMER_KEY ||
    process.env.TWITTER_API_KEY ||
    '';
  const apiSecret =
    process.env.X_OAUTH1_API_SECRET ||
    process.env.X_API_SECRET ||
    process.env.X_CONSUMER_SECRET ||
    process.env.X_CLIENT_SECRET ||
    process.env.TWITTER_API_SECRET ||
    '';
  const accessToken =
    process.env.X_OAUTH1_ACCESS_TOKEN ||
    process.env.X_ACCESS_TOKEN ||
    process.env.TWITTER_ACCESS_TOKEN ||
    '';
  const accessTokenSecret =
    process.env.X_OAUTH1_ACCESS_TOKEN_SECRET ||
    process.env.X_ACCESS_TOKEN_SECRET ||
    process.env.TWITTER_ACCESS_SECRET ||
    '';

  return {
    apiKey: apiKey.trim(),
    apiSecret: apiSecret.trim(),
    accessToken: accessToken.trim(),
    accessTokenSecret: accessTokenSecret.trim()
  };
}

function isOAuth1Configured(creds) {
  const c = creds || loadOAuth1Credentials();
  return !!(c.apiKey && c.apiSecret && c.accessToken && c.accessTokenSecret);
}

function buildOAuth1Authorization({ method, url, params, apiKey, apiSecret, accessToken, accessTokenSecret }) {
  const oauth = {
    oauth_consumer_key: apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: '1.0'
  };

  const signatureParams = { ...params, ...oauth };
  const paramString = Object.keys(signatureParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(signatureParams[k])}`)
    .join('&');

  const baseUrl = url.split('?')[0];
  const baseString = [method.toUpperCase(), percentEncode(baseUrl), percentEncode(paramString)].join('&');
  const signingKey = `${percentEncode(apiSecret)}&${percentEncode(accessTokenSecret || '')}`;
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

  oauth.oauth_signature = signature;

  return (
    'OAuth ' +
    Object.keys(oauth)
      .sort()
      .map((k) => `${percentEncode(k)}="${percentEncode(oauth[k])}"`)
      .join(', ')
  );
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Signed OAuth 1.0a request. Form params are application/x-www-form-urlencoded.
 */
async function oauth1Request({ method = 'GET', url, form = {} }) {
  const creds = loadOAuth1Credentials();
  if (!isOAuth1Configured(creds)) {
    throw new Error(
      'X OAuth 1.0a not configured. Set X_OAUTH1_API_KEY, X_OAUTH1_API_SECRET, X_OAUTH1_ACCESS_TOKEN, X_OAUTH1_ACCESS_TOKEN_SECRET.'
    );
  }

  const m = method.toUpperCase();
  let requestUrl = url;
  const params = { ...form };

  if (m === 'GET' && Object.keys(params).length) {
    const qs = new URLSearchParams(params).toString();
    requestUrl = `${url}${url.includes('?') ? '&' : '?'}${qs}`;
  }

  const authHeader = buildOAuth1Authorization({
    method: m,
    url: requestUrl,
    params,
    ...creds
  });

  const headers = { Authorization: authHeader };
  let body;

  if (m !== 'GET' && Object.keys(params).length) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(params).toString();
  }

  const res = await fetch(requestUrl, { method: m, headers, body, timeout: 60000 });
  const text = await res.text();
  const data = parseJsonSafe(text);

  if (!res.ok) {
    const detail = typeof data === 'object' ? JSON.stringify(data) : String(data).slice(0, 400);
    const err = new Error(`X API HTTP ${res.status}: ${detail}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }

  return data;
}

/**
 * Signed OAuth 1.0a request with JSON body (X API v2).
 * Signature uses oauth params only — JSON body is excluded per OAuth 1.0a spec.
 */
async function oauth1RequestJson({ method = 'POST', url, json = {} }) {
  const creds = loadOAuth1Credentials();
  if (!isOAuth1Configured(creds)) {
    throw new Error(
      'X OAuth 1.0a not configured. Set X_OAUTH1_API_KEY, X_OAUTH1_API_SECRET, X_OAUTH1_ACCESS_TOKEN, X_OAUTH1_ACCESS_TOKEN_SECRET.'
    );
  }

  const m = method.toUpperCase();
  const authHeader = buildOAuth1Authorization({
    method: m,
    url,
    params: {},
    ...creds
  });

  const res = await fetch(url, {
    method: m,
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(json),
    timeout: 60000
  });
  const text = await res.text();
  const data = parseJsonSafe(text);

  if (!res.ok) {
    const detail = typeof data === 'object' ? JSON.stringify(data) : String(data).slice(0, 400);
    const err = new Error(`X API HTTP ${res.status}: ${detail}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }

  return data;
}

module.exports = {
  loadOAuth1Credentials,
  isOAuth1Configured,
  buildOAuth1Authorization,
  oauth1Request,
  oauth1RequestJson,
  percentEncode
};
