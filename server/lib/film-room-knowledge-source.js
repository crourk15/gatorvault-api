/**
 * Film Room Knowledge Engine — verified coaching source policy.
 * Charles Power / GatorVault Film Desk / AI are NOT valid knowledge sources.
 */
const MIN_SOURCE_CONFIDENCE = 80;

const APPROVED_SOURCE_TYPES = new Set([
  'clinic',
  'oc_dc_interview',
  'analyst',
  'playbook',
  'film_study',
  'scouting_framework'
]);

const BLOCKED_SOURCE_PATTERNS = [
  /\bcharles\s*power\b/i,
  /\bchuck\s*power\b/i,
  /\bcharlespower\b/i,
  /\bgatorvault\s*film\s*desk\b/i,
  /\bcharles\s*from\s*bartow\b/i,
  /\bai[\s-]?generated\b/i,
  /\bchatgpt\b/i,
  /\bgpt[\s-]?4\b/i,
  /\bopenai\b/i,
  /\bllm\b/i,
  /\bhallucinat/i,
  /\bgatorvault\s*internal\b/i,
  /\bunsourced\b/i
];

function normalizeSourceType(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  return raw
    .replace(/\s+/g, '_')
    .replace(/oc\/dc/g, 'oc_dc')
    .replace(/-/g, '_');
}

function isBlockedSourceName(name) {
  const text = String(name || '').trim();
  if (!text) return true;
  return BLOCKED_SOURCE_PATTERNS.some((re) => re.test(text));
}

function hasSourceUrl(row) {
  const url = String(row?.source_url || '').trim();
  if (!url) return false;
  if (/^https?:\/\//i.test(url)) return true;
  if (/^doi:/i.test(url)) return true;
  return url.length >= 12;
}

function validateSourceMetadata(row, { table = 'record' } = {}) {
  const sourceName = String(row?.source_name || '').trim();
  const sourceType = normalizeSourceType(row?.source_type);
  const confidence = Number(row?.source_confidence);

  if (!sourceName) {
    return {
      ok: false,
      reason: 'source_incomplete',
      detail: row?.id,
      field: 'source_name',
      table
    };
  }

  if (isBlockedSourceName(sourceName)) {
    return {
      ok: false,
      reason: 'source_blocked',
      detail: row?.id,
      field: 'source_name',
      table,
      blocked: sourceName
    };
  }

  if (!APPROVED_SOURCE_TYPES.has(sourceType)) {
    return {
      ok: false,
      reason: 'source_type_invalid',
      detail: row?.id,
      field: 'source_type',
      table,
      value: row?.source_type
    };
  }

  if (!hasSourceUrl(row)) {
    return {
      ok: false,
      reason: 'source_incomplete',
      detail: row?.id,
      field: 'source_url',
      table
    };
  }

  if (!Number.isFinite(confidence) || confidence < MIN_SOURCE_CONFIDENCE) {
    return {
      ok: false,
      reason: 'source_low_confidence',
      detail: row?.id,
      field: 'source_confidence',
      table,
      confidence: Number.isFinite(confidence) ? confidence : null,
      minimum: MIN_SOURCE_CONFIDENCE
    };
  }

  return {
    ok: true,
    source: {
      source_name: sourceName,
      source_type: sourceType,
      source_url: String(row.source_url).trim(),
      source_confidence: confidence
    }
  };
}

function formatSourceCitation(row) {
  if (!row?.source_name) return null;
  const typeLabel = String(row.source_type || '').replace(/_/g, ' ');
  const conf = row.source_confidence != null ? ` (${row.source_confidence}% confidence)` : '';
  return `${row.source_name} [${typeLabel}]${conf} — ${row.source_url}`;
}

function collectSourcesFromResolved(resolved) {
  const seen = new Set();
  const sources = [];
  const rows = [
    resolved.lesson,
    resolved.concept,
    resolved.scheme,
    resolved.opponent,
    resolved.fitRule,
    ...(resolved.traits || []),
    ...(resolved.fitTraits || [])
  ].filter(Boolean);

  for (const row of rows) {
    const key = `${row.source_name}|${row.source_url}`;
    if (!row.source_name || seen.has(key)) continue;
    seen.add(key);
    sources.push({
      source_name: row.source_name,
      source_type: normalizeSourceType(row.source_type),
      source_url: row.source_url,
      source_confidence: row.source_confidence
    });
  }

  return sources.sort((a, b) => (b.source_confidence || 0) - (a.source_confidence || 0));
}

module.exports = {
  MIN_SOURCE_CONFIDENCE,
  APPROVED_SOURCE_TYPES,
  BLOCKED_SOURCE_PATTERNS,
  normalizeSourceType,
  isBlockedSourceName,
  validateSourceMetadata,
  formatSourceCitation,
  collectSourcesFromResolved
};
