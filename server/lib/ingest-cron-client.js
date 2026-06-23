/**
 * HTTP client for Render ingest cron jobs — warm check, retries, soft per-step failures.
 */
const { withRetries, isTransientError, warmApi } = require('./ingest-resilience');

async function postIngest(apiBase, cronSecret, path, body = {}, opts = {}) {
  if (!cronSecret) {
    throw new Error('MONITORING_CRON_SECRET or INGEST_CRON_SECRET is not set');
  }
  const timeoutMs = opts.timeoutMs ?? 240000;
  const userAgent = opts.userAgent || 'gatorvault-ingest-cron/1.0';
  const url = `${String(apiBase).replace(/\/$/, '')}${path}`;

  return withRetries(
    async () => {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Ingest-Secret': cronSecret,
          'x-monitoring-cron': cronSecret,
          'User-Agent': userAgent,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      let payload = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }
      if (!res.ok) {
        const err = new Error(`${path} HTTP ${res.status}`);
        err.status = res.status;
        err.payload = payload;
        throw err;
      }
      if (payload && payload.ok === false && payload.softFailure !== true) {
        const err = new Error(payload.error || `${path} returned ok:false`);
        err.payload = payload;
        throw err;
      }
      return payload;
    },
    {
      label: path,
      attempts: opts.attempts ?? 3,
      shouldRetry: (err) => isTransientError(err) || [502, 503, 504, 429, 408].includes(err.status),
    }
  );
}

async function runIngestSteps({ apiBase, cronSecret, steps, warm = true, logPrefix = 'ingest-cron' }) {
  const summary = { failures: [], steps: [], startedAt: new Date().toISOString() };

  if (warm) {
    summary.warm = await warmApi(apiBase);
    if (!summary.warm.ok) {
      console.warn(`[${logPrefix}] API not warm after health checks; continuing with retries`);
    }
  }

  for (const step of steps) {
    try {
      const result = await postIngest(apiBase, cronSecret, step.path, step.body || {}, step.opts || {});
      const stepSummary = step.summarize ? step.summarize(result) : null;
      summary.steps.push({ name: step.name, ok: true, ...(stepSummary != null ? { result: stepSummary } : {}) });
    } catch (err) {
      console.error(`[${logPrefix}] soft failure — ${step.name}:`, err.message);
      if (err.payload) console.error(JSON.stringify(err.payload));
      summary.failures.push({ name: step.name, error: err.message });
      summary.steps.push({ name: step.name, ok: false, softFailure: true, error: err.message });
    }
  }

  summary.finishedAt = new Date().toISOString();
  summary.ok = summary.failures.length === 0;
  return summary;
}

module.exports = {
  postIngest,
  runIngestSteps,
  warmApi,
};
