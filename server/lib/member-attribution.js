/**
 * Sanitize + summarize first-touch attribution on member signup.
 * Members never see an extra step — client cookies/localStorage carry UTMs silently.
 */
'use strict';

const MAX_FIELD = 120;

function trimField(value) {
  const s = String(value == null ? '' : value).trim().slice(0, MAX_FIELD);
  return s || null;
}

/**
 * @param {unknown} raw
 * @returns {null|{source:string|null,medium:string|null,campaign:string|null,content:string|null,term:string|null,gclid:string|null,fbclid:string|null,referrer:string|null,landingPath:string|null,capturedAt:string}}
 */
function sanitizeFirstTouch(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw;
  const source = trimField(o.source ?? o.utm_source);
  const medium = trimField(o.medium ?? o.utm_medium);
  const campaign = trimField(o.campaign ?? o.utm_campaign);
  const content = trimField(o.content ?? o.utm_content);
  const term = trimField(o.term ?? o.utm_term);
  const gclid = trimField(o.gclid);
  const fbclid = trimField(o.fbclid);
  const referrer = trimField(o.referrer);
  const landingPath = trimField(o.landingPath);
  let capturedAt = trimField(o.capturedAt);
  if (!capturedAt || !Number.isFinite(Date.parse(capturedAt))) {
    capturedAt = new Date().toISOString();
  }
  const hasSignal = Boolean(
    source || medium || campaign || content || term || gclid || fbclid || referrer
  );
  if (!hasSignal) return null;
  return {
    source,
    medium,
    campaign,
    content,
    term,
    gclid,
    fbclid,
    referrer,
    landingPath,
    capturedAt,
  };
}

function outletLabel(firstTouch) {
  if (!firstTouch || typeof firstTouch !== 'object') return 'direct';
  if (firstTouch.source) return String(firstTouch.source).toLowerCase();
  if (firstTouch.referrer) return String(firstTouch.referrer).toLowerCase();
  if (firstTouch.gclid) return 'google';
  if (firstTouch.fbclid) return 'meta';
  return 'direct';
}

/**
 * Count outlets for Admin Hub rollup (filtered member rows).
 * @param {Array<{source?: string|null, firstTouch?: object|null}>} rows
 */
function countBySource(rows) {
  const counts = Object.create(null);
  for (const row of rows || []) {
    const key = String(row?.source || outletLabel(row?.firstTouch) || 'direct').toLowerCase();
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.keys(counts)
    .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b))
    .map((source) => ({ source, count: counts[source] }));
}

module.exports = {
  sanitizeFirstTouch,
  outletLabel,
  countBySource,
};
