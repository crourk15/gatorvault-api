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
      throw err;
    }
    return { status: r.status, body, url };
  } finally {
    if (timer) clearTimeout(timer);
  }
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
  fetchText,
  headUrl,
  extractUrls,
  moduleResult,
  fetchSiteBundleText
};
