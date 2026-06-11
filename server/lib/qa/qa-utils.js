/**
 * Shared QA helpers.
 */
const fetch = require('node-fetch');
const config = require('./qa-config');

function check(id, module, label, fn) {
  return Promise.resolve()
    .then(fn)
    .then((details) => ({
      id,
      module,
      label,
      pass: true,
      details: details || null
    }))
    .catch((err) => ({
      id,
      module,
      label,
      pass: false,
      error: err.message || String(err),
      details: err.details || null,
      url: err.url || null,
      repro: err.repro || null
    }));
}

async function fetchJson(url, opts = {}) {
  const timeout = opts.timeout || config.FETCH_TIMEOUT_MS;
  const retries = opts.retries ?? 0;
  const retryDelayMs = opts.retryDelayMs ?? 2500;
  const retryStatuses = new Set(opts.retryOn || [502, 503, 504, 429, 0]);
  let lastErr;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;
    try {
      const r = await fetch(url, {
        method: opts.method || 'GET',
        headers: { Accept: 'application/json', ...(opts.headers || {}) },
        signal: controller ? controller.signal : undefined
      });
      const text = await r.text();
      let body = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }
      if (!r.ok) {
        const err = new Error(`HTTP ${r.status} ${url}`);
        err.details = { status: r.status, body: typeof body === 'string' ? body.slice(0, 200) : body };
        err.url = url;
        if (opts.allowNotOk) return { status: r.status, body, url };
        if (attempt < retries && retryStatuses.has(r.status)) {
          lastErr = err;
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
          continue;
        }
        throw err;
      }
      return { status: r.status, body, url };
    } catch (err) {
      lastErr = err;
      const status = err.details?.status || 0;
      const retryable =
        attempt < retries &&
        (retryStatuses.has(status) ||
          /abort|timeout|ECONNRESET|ECONNREFUSED|fetch failed|network/i.test(String(err.message || '')));
      if (retryable) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
        continue;
      }
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  throw lastErr;
}

async function fetchJsonWithRetry(url, opts = {}) {
  return fetchJson(url, {
    retries: opts.retries ?? 3,
    retryDelayMs: opts.retryDelayMs ?? config.LIVE_DASHBOARD_RETRY_MS,
    retryOn: opts.retryOn || [502, 503, 504, 429, 0],
    ...opts
  });
}

async function waitForApiWarmup() {
  const pingUrl = `${config.API_URL}/api/ping`;
  const healthUrl = `${config.API_URL}/api/health`;
  const dashHealthUrl = `${config.API_URL}/api/live/dashboard/health`;
  for (let i = 0; i < 6; i += 1) {
    try {
      await fetchJson(pingUrl, { timeout: 12000, retries: 0 });
      const health = await fetchJson(healthUrl, { timeout: 12000, retries: 0, allowNotOk: true });
      const ready = health.body?.ready === true || health.body?.dashboard?.ready === true;
      if (ready) return true;
      try {
        const dash = await fetchJson(dashHealthUrl, { timeout: 12000, retries: 0, allowNotOk: true });
        if (dash.body?.ready === true) return true;
      } catch {
        /* dashboard health route may not exist on older deploys */
      }
      await fetchJson(`${config.API_URL}/api/live/dashboard?limit=5`, {
        timeout: 20000,
        retries: 1,
        retryDelayMs: 2000
      });
      return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 2500 * (i + 1)));
    }
  }
  return false;
}

async function fetchText(url, opts = {}) {
  const timeout = opts.timeout || config.FETCH_TIMEOUT_MS;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;
  try {
    const r = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'text/html', ...(opts.headers || {}) },
      signal: controller ? controller.signal : undefined
    });
    const text = await r.text();
    if (!r.ok) {
      const err = new Error(`HTTP ${r.status} ${url}`);
      err.url = url;
      throw err;
    }
    return { status: r.status, text, url };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function headUrl(url) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), config.FETCH_TIMEOUT_MS) : null;
  try {
    const r = await fetch(url, { method: 'HEAD', signal: controller ? controller.signal : undefined });
    if (r.ok || r.status === 403 || r.status === 405) return { ok: true, status: r.status, url };
    return { ok: false, status: r.status, url };
  } catch (e) {
    try {
      const r2 = await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        signal: controller ? controller.signal : undefined
      });
      if (r2.ok || r2.status === 206 || r2.status === 403) return { ok: true, status: r2.status, url };
      return { ok: false, status: r2.status, url, error: e.message };
    } catch (e2) {
      return { ok: false, status: 0, url, error: e2.message || e.message };
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function extractUrls(text) {
  const urls = new Set();
  const re = /https?:\/\/[^\s<>"')\]]+/gi;
  let m;
  const src = String(text || '');
  while ((m = re.exec(src))) {
    urls.add(m[0].replace(/[.,;:!?)]+$/, ''));
  }
  return [...urls];
}

function moduleResult(module, checks) {
  const failed = checks.filter((c) => !c.pass);
  return {
    module,
    pass: failed.length === 0,
    total: checks.length,
    failed: failed.length,
    checks
  };
}

async function fetchSiteBundleText(siteUrl, pagePath) {
  const base = siteUrl.replace(/\/$/, '');
  const { text: html } = await fetchText(`${base}${pagePath}`);
  const scripts = [];
  const re = /<script[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[1] && !m[1].includes('google') && !m[1].includes('cdn.jsdelivr')) scripts.push(m[1]);
  }
  let bundled = html;
  for (const src of scripts.slice(0, 8)) {
    const url = src.startsWith('http') ? src : `${base}${src.startsWith('/') ? '' : '/'}${src}`;
    try {
      const { text } = await fetchText(url);
      bundled += '\n' + text;
    } catch {
      /* skip */
    }
  }
  return bundled;
}

module.exports = {
  check,
  fetchJson,
  fetchJsonWithRetry,
  waitForApiWarmup,
  fetchText,
  headUrl,
  extractUrls,
  moduleResult,
  fetchSiteBundleText
};
