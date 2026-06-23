/**
 * Shared retry, backoff, and API warm-check helpers for ingest cron jobs and external fetches.
 */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientError(err) {
  if (!err) return false;
  const status = err.status || err.statusCode;
  if (typeof status === 'number' && [408, 429, 500, 502, 503, 504].includes(status)) return true;
  const msg = String(err.message || err);
  return /HTTP (408|429|500|502|503|504)|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed|network|socket|abort|timeout|unavailable|cold/i.test(
    msg
  );
}

async function withRetries(fn, opts = {}) {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const baseDelayMs = opts.baseDelayMs ?? 1000;
  const backoff = opts.backoff ?? 2;
  const label = opts.label || 'operation';
  const shouldRetry = opts.shouldRetry || isTransientError;
  let lastErr;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      const retryable = attempt < attempts - 1 && shouldRetry(err, attempt);
      if (!retryable) break;
      const delayMs = baseDelayMs * backoff ** attempt;
      console.warn(
        `[ingest-resilience] ${label} failed (attempt ${attempt + 1}/${attempts}): ${err.message}; retry in ${delayMs}ms`
      );
      await sleep(delayMs);
    }
  }
  throw lastErr;
}

async function warmApi(apiBase, opts = {}) {
  const healthPath = opts.healthPath ?? '/api/health';
  const attempts = opts.attempts ?? 3;
  const waitMs = opts.waitMs ?? 5000;
  const timeoutMs = opts.timeoutMs ?? 20000;
  const base = String(apiBase || '').replace(/\/$/, '');
  const url = `${base}${healthPath}`;
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'gatorvault-ingest-warm/1.0' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) {
        let body = null;
        try {
          body = await res.json();
        } catch {
          body = null;
        }
        console.log(`[ingest-resilience] API warm (${res.status}) attempt ${attempt + 1}/${attempts}`);
        return { ok: true, status: res.status, body, attempt: attempt + 1 };
      }
      lastError = new Error(`health HTTP ${res.status}`);
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        console.warn(`[ingest-resilience] API cold or redeploying (${res.status}); waiting ${waitMs}ms`);
        await sleep(waitMs);
        continue;
      }
      console.warn(`[ingest-resilience] health check HTTP ${res.status}`);
      if (attempt < attempts - 1) await sleep(waitMs);
    } catch (err) {
      lastError = err;
      console.warn(`[ingest-resilience] health check failed (${attempt + 1}/${attempts}): ${err.message}`);
      if (attempt < attempts - 1) await sleep(waitMs);
    }
  }

  return { ok: false, error: lastError?.message || 'API health check failed' };
}

module.exports = {
  sleep,
  withRetries,
  isTransientError,
  warmApi,
};
