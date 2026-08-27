/**
 * Last-mile scrub for iOS Home NOW / recruiting hub.
 * Capacitor hits gatorvaultinsider.com/api/* (Netlify → Render). Even when
 * Render is clean, WKWebView URLCache / stale CDN can replay
 * "Tranard Roberts — unofficial visit · Auburn Tigers". Scrub here so the
 * App Store binary picks up the wipe without Codemagic.
 */
const DENIED = [{ nameRe: /tranard\s+roberts/i, schoolRe: /auburn/i }];

function isDeniedVisitText(text) {
  const t = String(text || '');
  if (!t.trim()) return false;
  if (!/\b(unofficial|official)\s+visit\b|\bUOV\b|\bOV\b/i.test(t) && !/\bvisit\b/i.test(t)) {
    return false;
  }
  return DENIED.some((r) => r.nameRe.test(t) && r.schoolRe.test(t));
}

function scrubTickerLines(lines) {
  if (!Array.isArray(lines)) return lines;
  return lines.filter((line) => !isDeniedVisitText(line));
}

function scrubMovementItems(items) {
  if (!Array.isArray(items)) return items;
  return items.filter((item) => {
    if (!item || typeof item !== 'object') return true;
    const blob = `${item.name || ''} ${item.summary || ''} ${item.detail || ''} ${item.school || ''}`;
    return !isDeniedVisitText(blob);
  });
}

function scrubVisitsArray(visits, slug) {
  if (!Array.isArray(visits)) return visits;
  const slugOk = !slug || /tranard-roberts/i.test(String(slug));
  if (!slugOk) return visits;
  return visits.filter((v) => {
    const school =
      typeof v === 'string'
        ? v
        : String(v?.school || v?.visitSchool || v?.host || '');
    return !/auburn/i.test(school);
  });
}

function scrubPayload(data, pathname) {
  if (!data || typeof data !== 'object') return { data, changed: false };
  let changed = false;
  const out = Array.isArray(data) ? data.slice() : { ...data };

  if (Array.isArray(out.items) && out.items.length && typeof out.items[0] === 'string') {
    const next = scrubTickerLines(out.items);
    if (next.length !== out.items.length) changed = true;
    out.items = next;
  }
  if (Array.isArray(out.items) && out.items.length && out.items[0] && typeof out.items[0] === 'object') {
    const next = scrubMovementItems(out.items);
    if (next.length !== out.items.length) changed = true;
    out.items = next;
  }
  if (Array.isArray(out.ticker)) {
    const next = scrubTickerLines(out.ticker);
    if (next.length !== out.ticker.length) changed = true;
    out.ticker = next;
  }
  if (Array.isArray(out.movementFeed)) {
    const next = scrubMovementItems(out.movementFeed);
    if (next.length !== out.movementFeed.length) changed = true;
    out.movementFeed = next;
  }

  const slugMatch = String(pathname || '').match(/\/(?:players|player|intelligence)\/([^/]+)/i);
  const slug = slugMatch ? decodeURIComponent(slugMatch[1]) : '';
  if (/tranard-roberts/i.test(slug) || /tranard-roberts/i.test(JSON.stringify(out.player || out.intelligence || {}))) {
    if (out.player && Array.isArray(out.player.visits)) {
      const next = scrubVisitsArray(out.player.visits, 'tranard-roberts');
      if (next.length !== out.player.visits.length) changed = true;
      out.player = { ...out.player, visits: next };
    }
    if (out.intelligence && Array.isArray(out.intelligence.visits)) {
      const next = scrubVisitsArray(out.intelligence.visits, 'tranard-roberts');
      if (next.length !== out.intelligence.visits.length) changed = true;
      out.intelligence = { ...out.intelligence, visits: next };
    }
    if (out.visits) {
      const next = scrubVisitsArray(out.visits, 'tranard-roberts');
      if (next.length !== out.visits.length) changed = true;
      out.visits = next;
    }
    if (out.highSchoolProfile && Array.isArray(out.highSchoolProfile.visitHistory)) {
      const next = scrubVisitsArray(out.highSchoolProfile.visitHistory, 'tranard-roberts');
      if (next.length !== out.highSchoolProfile.visitHistory.length) changed = true;
      out.highSchoolProfile = { ...out.highSchoolProfile, visitHistory: next };
    }
  }

  return { data: out, changed };
}

export default async (request, context) => {
  const url = new URL(request.url);
  // Always hit origin with a bust token so CDN/URLCache cannot replay pre-scrub JSON.
  const origin = new URL(`https://gatorvault-api.onrender.com${url.pathname}${url.search}`);
  origin.searchParams.set('gvScrub', 't9');

  let upstream;
  try {
    upstream = await fetch(origin.toString(), {
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });
  } catch {
    return context.next();
  }

  const contentType = upstream.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return upstream;
  }

  let payload;
  try {
    payload = await upstream.json();
  } catch {
    return upstream;
  }

  const { data, changed } = scrubPayload(payload, url.pathname);
  const body = JSON.stringify(data);
  const headers = new Headers(upstream.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store, must-revalidate');
  headers.set('pragma', 'no-cache');
  headers.set('x-gv-visit-scrub', changed ? '1' : '0');
  // Bust WKWebView HTTP cache for this origin so iOS stops replaying Auburn UV.
  headers.set('clear-site-data', '"cache"');
  headers.delete('content-length');
  headers.delete('etag');
  headers.delete('age');

  return new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
};
