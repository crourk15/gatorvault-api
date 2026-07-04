/** PR-6 — elite insider tone gate. */

const { GENERIC_BANNED, MECHANICAL_BANNED, INSIDER_VOCAB } = require('./rewrite-types');

function countInsiderVocab(text) {
  const lower = String(text || '').toLowerCase();
  let hits = 0;
  for (const term of INSIDER_VOCAB) {
    if (lower.includes(term)) hits += 1;
  }
  return hits;
}

function isEliteTone(text, { minInsiderHits = 2 } = {}) {
  const t = String(text || '').trim();
  if (!t) return { ok: false, violations: ['empty_text'] };

  const violations = [];
  for (const re of GENERIC_BANNED) {
    if (re.test(t)) violations.push({ type: 'generic_phrasing', pattern: re.source });
  }
  for (const re of MECHANICAL_BANNED) {
    if (re.test(t)) violations.push({ type: 'mechanical_structure', pattern: re.source });
  }
  if (/\s\+\s/.test(t)) violations.push({ type: 'plus_joiner' });
  if (/—[^.]*\.$/.test(t) && !/\b(lean|leaned|gave|opened|pushed|gaining|traction|responded)\b/i.test(t)) {
    violations.push({ type: 'em_dash_fragment' });
  }

  const insiderHits = countInsiderVocab(t);
  if (insiderHits < minInsiderHits) {
    violations.push({ type: 'missing_insider_vocab', insiderHits });
  }

  return { ok: violations.length === 0, violations, insiderHits };
}

function validatePackTone(proseLines) {
  const combined = (proseLines || []).join(' ');
  return isEliteTone(combined, { minInsiderHits: 3 });
}

module.exports = {
  isEliteTone,
  validatePackTone,
  countInsiderVocab
};
