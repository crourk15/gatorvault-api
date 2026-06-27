/**
 * Self-Runner v3 — normalized Issue Object.
 */
const FIX_TYPES = ['data', 'config', 'cron', 'ingest', 'layout', 'code'];

function nowIso() {
  return new Date().toISOString();
}

function normalizeIssue(raw = {}) {
  const subsystem = String(raw.subsystem || raw.module || 'unknown').toLowerCase();
  const type = String(raw.type || raw.issueType || 'unknown').toLowerCase();
  const severity = normalizeSeverity(raw.severity);
  const evidence = normalizeEvidence(raw.evidence || raw.details || raw.detailsList || []);
  const fixType = normalizeFixType(raw.fixType || inferFixType(subsystem, type));

  return {
    id: raw.id || `issue_${subsystem}_${type}_${Date.now()}`,
    subsystem,
    severity,
    type,
    fixType,
    title: raw.title || `${subsystem}: ${type}`,
    evidence,
    timestamp: raw.timestamp || nowIso(),
    checkId: raw.checkId || null,
    source: raw.source || 'signal-collector',
    verified: evidence.length > 0 && raw.verified !== false,
    metadata: raw.metadata || {},
    playbookId: raw.playbookId || null
  };
}

function normalizeSeverity(sev) {
  const s = String(sev || 'medium').toLowerCase();
  return ['critical', 'high', 'medium', 'low', 'info'].includes(s) ? s : 'medium';
}

function normalizeEvidence(evidence) {
  if (!evidence) return [];
  if (Array.isArray(evidence)) {
    return evidence
      .map((e) => {
        if (typeof e === 'string') return e.trim();
        if (e?.message) return String(e.message).trim();
        if (e?.detail) return String(e.detail).trim();
        return JSON.stringify(e);
      })
      .filter(Boolean)
      .slice(0, 12);
  }
  return [String(evidence).trim()].filter(Boolean);
}

function inferFixType(subsystem, type) {
  const key = `${subsystem}:${type}`;
  const map = {
    'autoposter:stale': 'cron',
    'cron:auth_mismatch': 'cron',
    'recruiting:uuid_mismatch': 'data',
    'recruiting:ingest_failure': 'ingest',
    'portal:sync_stuck': 'ingest',
    'feed:dedupe': 'data'
  };
  if (map[key]) return map[key];
  if (/cron|scheduler|heartbeat|auth/.test(type)) return 'cron';
  if (/ingest|sync|portal/.test(type)) return 'ingest';
  if (/layout|css|ux/.test(type)) return 'layout';
  if (/react|component|route/.test(type)) return 'code';
  return 'data';
}

function normalizeFixType(fixType) {
  const ft = String(fixType || 'data').toLowerCase();
  return FIX_TYPES.includes(ft) ? ft : 'data';
}

function isActionable(issue) {
  return !!(issue?.evidence?.length) && issue.severity !== 'info';
}

module.exports = {
  FIX_TYPES,
  normalizeIssue,
  normalizeSeverity,
  normalizeEvidence,
  normalizeFixType,
  inferFixType,
  isActionable
};
