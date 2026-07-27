/**
 * On3 HTML fetch with Cloudflare detection + optional reader fallback.
 *
 * Direct datacenter requests to www.on3.com often get CF 403 challenge pages
 * (no __NEXT_DATA__). When that happens we retry through a configurable HTML
 * fallback (default: r.jina.ai with X-Return-Format: html), which returns the
 * real Next.js document so existing parsers keep working.
 */

const DEFAULT_UA =
  process.env.ON3_USER_AGENT ||
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function fallbackEnabled() {
  return String(process.env.ON3_HTML_FALLBACK || 'true').toLowerCase() !== 'false';
}

function fallbackBase() {
  const raw = process.env.ON3_HTML_FALLBACK_BASE || 'https://r.jina.ai/';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

function buildFallbackUrl(targetUrl) {
  const url = String(targetUrl || '').trim();
  if (!url) return url;
  const base = fallbackBase();
  if (url.startsWith(base)) return url;
  return `${base}${url}`;
}

function looksLikeCloudflare(html = '', status = 0) {
  const body = String(html || '');
  const lower = body.toLowerCase();
  if (Number(status) === 403) return true;
  if (/attention required!\s*\|\s*cloudflare/i.test(body)) return true;
  if (lower.includes('cdn-cgi/challenge-platform')) return true;
  if (lower.includes('cf-browser-verification')) return true;
  if (lower.includes('just a moment...') && lower.includes('cloudflare')) return true;
  return false;
}

function hasNextData(html = '') {
  return /<script id="__NEXT_DATA__"[^>]*>/i.test(String(html || ''));
}

function extractNextDataJson(html) {
  const match = String(html || '').match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) throw new Error('On3 page missing __NEXT_DATA__');
  return JSON.parse(match[1]);
}

function defaultOn3Headers(classYear, extra = {}) {
  const year = classYear || 2027;
  const site = process.env.ON3_SITE_BASE || 'https://www.on3.com';
  const org = process.env.ON3_ORG_SLUG || 'florida-gators';
  const sport = process.env.ON3_SPORT || 'football';
  return {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'User-Agent': DEFAULT_UA,
    Referer: `${site}/college/${org}/${sport}/${year}/commits/`,
    ...extra,
  };
}

async function rawFetch(url, { headers = {}, timeout = 45000 } = {}) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller ? controller.signal : undefined,
    });
    const text = await res.text();
    return { status: res.status, text, url };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch On3 HTML. Tries direct first; on Cloudflare / missing NEXT_DATA,
 * retries via ON3_HTML_FALLBACK_BASE (jina by default).
 */
async function fetchOn3Html(url, opts = {}) {
  const timeout = parseInt(process.env.ON3_FETCH_TIMEOUT_MS || String(opts.timeout || 45000), 10) || 45000;
  const retries = Math.max(0, parseInt(process.env.ON3_FETCH_RETRIES || String(opts.retries ?? 2), 10) || 2);
  const classYear = opts.classYear;
  const headers = defaultOn3Headers(classYear, opts.headers || {});

  let lastErr = null;
  let direct = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      direct = await rawFetch(url, { headers, timeout });
      if (direct.status >= 500 && attempt < retries) {
        await sleep(400 * (attempt + 1));
        continue;
      }
      break;
    } catch (e) {
      lastErr = e;
      if (attempt < retries) {
        await sleep(400 * (attempt + 1));
        continue;
      }
    }
  }

  if (
    direct &&
    direct.status >= 200 &&
    direct.status < 300 &&
    hasNextData(direct.text) &&
    !looksLikeCloudflare(direct.text, direct.status)
  ) {
    return {
      status: direct.status,
      text: direct.text,
      url,
      source: 'direct',
      fallbackUsed: false,
    };
  }

  const blocked =
    !direct ||
    looksLikeCloudflare(direct.text, direct.status) ||
    !hasNextData(direct?.text || '') ||
    (direct.status && direct.status >= 400);

  if (!blocked) {
    return {
      status: direct.status,
      text: direct.text,
      url,
      source: 'direct',
      fallbackUsed: false,
    };
  }

  if (!fallbackEnabled()) {
    const why = looksLikeCloudflare(direct?.text || '', direct?.status || 0)
      ? `Cloudflare blocked On3 (${direct?.status || 0})`
      : `On3 fetch failed (${direct?.status || 0}) missing __NEXT_DATA__`;
    const err = new Error(why);
    err.status = direct?.status || 0;
    err.cause = lastErr;
    throw err;
  }

  const proxyUrl = buildFallbackUrl(url);
  console.warn(`[on3-fetch] direct blocked (status=${direct?.status || 0}); trying fallback ${proxyUrl}`);
  await sleep(Math.max(0, parseInt(process.env.ON3_FALLBACK_DELAY_MS || '350', 10) || 350));

  const fallback = await rawFetch(proxyUrl, {
    timeout: Math.max(timeout, 60000),
    headers: {
      ...headers,
      'X-Return-Format': 'html',
      Accept: 'text/html,*/*',
    },
  });

  if (!(fallback.status >= 200 && fallback.status < 300) || !hasNextData(fallback.text)) {
    const err = new Error(
      `On3 fallback failed (status=${fallback.status})` +
        (looksLikeCloudflare(fallback.text, fallback.status) ? ' cloudflare' : '') +
        (!hasNextData(fallback.text) ? ' missing __NEXT_DATA__' : '')
    );
    err.status = fallback.status;
    throw err;
  }

  return {
    status: fallback.status,
    text: fallback.text,
    url: proxyUrl,
    source: 'fallback',
    fallbackUsed: true,
    originalUrl: url,
  };
}

module.exports = {
  fallbackEnabled,
  fallbackBase,
  buildFallbackUrl,
  looksLikeCloudflare,
  hasNextData,
  extractNextDataJson,
  defaultOn3Headers,
  fetchOn3Html,
};
