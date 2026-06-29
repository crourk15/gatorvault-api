/**
 * Shared QA helpers.
 */
const fetch = require('node-fetch');
const config = require('./qa-config');

const CRAWLER_UA = 'gatorvault-qa-crawler/2.0 (+https://gatorvaultinsider.com)';

function isRetryableFetchError(message) {
  return /abort|timeout|ECONNRESET|ECONNREFUSED|premature close|invalid response body|fetch failed|network|socket hang up|UND_ERR|body timeout/i.test(
    String(message || '')
  );
}

function defaultFetchHeaders(extra = {}) {
  return {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'User-Agent': CRAWLER_UA,
    ...extra,
  };
}

function resolveFetchTimeout(url, opts = {}) {
  if (opts.timeout) return opts.timeout;
  const isVault = opts.vault || /\/vault(\/|$)/.test(String(url || ''));
  return isVault ? config.VAULT_FETCH_TIMEOUT_MS : config.FETCH_TIMEOUT_MS;
}

async function mapPool(items, worker, concurrency = 3) {
  const results = new Array(items.length);
  let index = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (index < items.length) {
      const i = index;
      index += 1;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

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
  const timeout = resolveFetchTimeout(url, opts);
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
        headers: defaultFetchHeaders({ Accept: 'application/json', ...(opts.headers || {}) }),
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
        (retryStatuses.has(status) || isRetryableFetchError(err.message));
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
  const timeout = resolveFetchTimeout(url, opts);
  const retries = opts.retries ?? config.FETCH_RETRIES;
  const retryDelayMs = opts.retryDelayMs ?? config.FETCH_RETRY_DELAY_MS;
  let lastErr;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;
    try {
      const r = await fetch(url, {
        method: 'GET',
        headers: defaultFetchHeaders(opts.headers || {}),
        signal: controller ? controller.signal : undefined
      });
      const text = await r.text();
      if (!r.ok) {
        const err = new Error(`HTTP ${r.status} ${url}`);
        err.url = url;
        if (attempt < retries && [429, 502, 503, 504].includes(r.status)) {
          lastErr = err;
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
          continue;
        }
        throw err;
      }
      return { status: r.status, text, url };
    } catch (err) {
      lastErr = err;
      if (attempt < retries && isRetryableFetchError(err.message)) {
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

async function headUrl(url, opts = {}) {
  const timeout = resolveFetchTimeout(url, opts);
  const retries = opts.retries ?? config.FETCH_RETRIES;
  const retryDelayMs = opts.retryDelayMs ?? config.FETCH_RETRY_DELAY_MS;
  let lastErr;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;
    try {
      const r = await fetch(url, {
        method: 'HEAD',
        headers: defaultFetchHeaders(opts.headers || {}),
        signal: controller ? controller.signal : undefined
      });
      if (r.ok || r.status === 403 || r.status === 405) return { ok: true, status: r.status, url };
      if (attempt < retries && [429, 502, 503, 504].includes(r.status)) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
        continue;
      }
      return { ok: false, status: r.status, url };
    } catch (e) {
      lastErr = e;
      try {
        const r2 = await fetch(url, {
          method: 'GET',
          headers: defaultFetchHeaders({ Range: 'bytes=0-0', ...(opts.headers || {}) }),
          signal: controller ? controller.signal : undefined
        });
        if (r2.ok || r2.status === 206 || r2.status === 403) return { ok: true, status: r2.status, url };
        if (attempt < retries && isRetryableFetchError(e.message)) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
          continue;
        }
        return { ok: false, status: r2.status, url, error: e.message };
      } catch (e2) {
        lastErr = e2;
        if (attempt < retries && isRetryableFetchError(e2.message || e.message)) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
          continue;
        }
        return { ok: false, status: 0, url, error: e2.message || e.message };
      }
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return { ok: false, status: 0, url, error: lastErr?.message || 'fetch failed' };
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

function extractVaultShellCssHrefs(html) {
  const hrefs = [];
  const re =
    /<link[^>]+data-gv-vault-shell-css[^>]+href=["']([^"']+)["']|<link[^>]+href=["']([^"']+)["'][^>]+data-gv-vault-shell-css/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1] || m[2];
    if (href && !hrefs.includes(href)) hrefs.push(href);
  }
  return hrefs;
}

async function fetchSiteBundleText(siteUrl, pagePath, opts = {}) {
  const base = siteUrl.replace(/\/$/, '');
  const path = pagePath.startsWith('/') ? pagePath : `/${pagePath}`;
  const htmlOnly = opts.htmlOnly ?? config.BUNDLE_HTML_ONLY;
  const { text: html } = await fetchText(`${base}${path}`, { vault: true, ...opts });
  if (htmlOnly) {
    return html;
  }

  const vaultShellCss = extractVaultShellCssHrefs(html);
  const cssAssets = [];
  const jsAssets = [];
  const scriptRe = /<script[^>]+src=["']([^"']+)["']/gi;
  const cssRe = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']|<link[^>]+href=["']([^"']+\.css[^"']*)["'][^>]+rel=["']stylesheet["']/gi;
  let m;
  while ((m = scriptRe.exec(html))) {
    if (m[1] && !m[1].includes('google') && !m[1].includes('cdn.jsdelivr')) jsAssets.push(m[1]);
  }
  while ((m = cssRe.exec(html))) {
    const href = m[1] || m[2];
    if (href && !href.includes('fonts.googleapis')) cssAssets.push(href);
  }
  const toLoad = [];
  const seen = new Set();
  const budget = (opts.maxAssets ?? 4) + vaultShellCss.length;

  const queue = (href) => {
    if (seen.has(href) || toLoad.length >= budget) return;
    seen.add(href);
    toLoad.push(href);
  };

  for (const href of vaultShellCss) queue(href);
  for (const href of cssAssets) queue(href);
  for (const href of jsAssets) queue(href);
  let bundled = html;
  await mapPool(
    toLoad,
    async (src) => {
      const url = src.startsWith('http') ? src : `${base}${src.startsWith('/') ? '' : '/'}${src}`;
      try {
        const { text } = await fetchText(url, { vault: true, ...opts });
        bundled += '\n' + text;
      } catch {
        /* skip optional assets */
      }
    },
    config.SITE_FETCH_CONCURRENCY
  );
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
  fetchSiteBundleText,
  mapPool,
  isRetryableFetchError,
  defaultFetchHeaders,
};
