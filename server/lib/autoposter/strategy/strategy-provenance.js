/** PR-5 — every token must be traceable to beat, metrics, scouting, or UF context. */

function normalizeForMatch(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function haystackFromSources({ beatText, metrics = {}, scouting = {}, ufContext = {} }) {
  const parts = [
    beatText,
    metrics.visitDate,
    metrics.depthChartNote,
    metrics.schemeNote,
    metrics.rpm != null ? `${metrics.rpm}%` : null,
    metrics.rpm != null ? `${metrics.rpm}% RPM` : null,
    ...(metrics.compSchools || []),
    scouting.summary,
    ufContext.posNeed,
    ufContext.boardTier,
    ufContext.cyclePlan
  ].filter(Boolean);
  return normalizeForMatch(parts.join(' '));
}

function tokenInHaystack(token, haystack) {
  const t = normalizeForMatch(token);
  if (!t || t.length < 3) return false;
  if (haystack.includes(t)) return true;
  const words = t.split(' ').filter((w) => w.length >= 4);
  if (words.length >= 2) {
    const hits = words.filter((w) => haystack.includes(w));
    return hits.length >= Math.min(words.length, 2);
  }
  return false;
}

function validateSignalTokens(signals, sources) {
  const haystack = haystackFromSources(sources);
  const invalid = [];
  for (const sig of signals || []) {
    for (const token of sig.tokens || []) {
      if (sig.source === 'ufContext' && sig.type === 'trait') {
        if (tokenInHaystack(token, haystack)) continue;
      }
      if (!tokenInHaystack(token, haystack)) {
        invalid.push({ type: sig.type, token, source: sig.source });
      }
    }
  }
  return { ok: invalid.length === 0, invalid, haystack };
}

function containsBannedPhrase(text, bannedList) {
  const lower = String(text || '').toLowerCase();
  for (const phrase of bannedList) {
    if (lower.includes(phrase.toLowerCase())) return phrase;
  }
  return null;
}

module.exports = {
  normalizeForMatch,
  haystackFromSources,
  tokenInHaystack,
  validateSignalTokens,
  containsBannedPhrase
};
