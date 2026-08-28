/**
 * iOS Capacitor surfaces Render 502/connection-reset as bare "Load failed".
 * Retry auth POSTs at the Netlify edge so App Store binaries (no client retry)
 * still sign in while the API is warming / flapping.
 */
const RETRY_STATUSES = new Set([502, 503, 504]);
const MAX_ATTEMPTS = 4;
const GAP_MS = 700;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export default async (request, context) => {
  if (request.method !== 'POST' && request.method !== 'OPTIONS') {
    return context.next();
  }

  const url = new URL(request.url);
  const originUrl = `https://gatorvault-api.onrender.com${url.pathname}${url.search}`;

  // Preflight — pass through once.
  if (request.method === 'OPTIONS') {
    try {
      return await fetch(originUrl, {
        method: 'OPTIONS',
        headers: request.headers,
      });
    } catch {
      return context.next();
    }
  }

  const body = await request.arrayBuffer();
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set('cache-control', 'no-cache');
  headers.set('pragma', 'no-cache');

  let lastErr = null;
  let lastRes = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch(originUrl, {
        method: 'POST',
        headers,
        body: body.byteLength ? body.slice(0) : undefined,
      });
      lastRes = res;
      if (!RETRY_STATUSES.has(res.status) || attempt === MAX_ATTEMPTS) {
        const outHeaders = new Headers(res.headers);
        outHeaders.set('cache-control', 'no-store, must-revalidate');
        outHeaders.set('pragma', 'no-cache');
        outHeaders.set('x-gv-auth-retry', String(attempt));
        outHeaders.delete('content-length');
        outHeaders.delete('etag');
        return new Response(await res.arrayBuffer(), {
          status: res.status,
          statusText: res.statusText,
          headers: outHeaders,
        });
      }
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_ATTEMPTS) break;
    }
    await sleep(GAP_MS * attempt);
  }

  if (lastRes) {
    const outHeaders = new Headers(lastRes.headers);
    outHeaders.set('x-gv-auth-retry', 'exhausted');
    return new Response(await lastRes.arrayBuffer(), {
      status: lastRes.status,
      statusText: lastRes.statusText,
      headers: outHeaders,
    });
  }

  return new Response(
    JSON.stringify({
      ok: false,
      code: 'api_warming',
      error: 'Server is waking up — wait a few seconds and try again.',
    }),
    {
      status: 503,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-gv-auth-retry': 'exhausted',
      },
    }
  );
};
