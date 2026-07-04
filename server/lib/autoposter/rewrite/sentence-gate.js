/** PR-6 — complete sentence validation (extends PR-5 gate). */

const {
  isCompleteSentence: pr5Complete,
  wordCount,
  ensurePeriod
} = require('../strategy/strategy-sentences');

function hasRepeatedSubject(lines) {
  const subjects = [];
  for (const line of lines) {
    const m = String(line || '').match(/^([A-Z][a-z]+(?:'s)?)/);
    if (m) subjects.push(m[1].toLowerCase());
  }
  if (subjects.length < 2) return false;
  const first = subjects[0].replace(/'s$/, '');
  return subjects.every((s) => s.replace(/'s$/, '') === first);
}

function isCompleteSentence(text) {
  return pr5Complete(text);
}

function validateSentences(lines) {
  const violations = [];
  const cleaned = (lines || []).map((l) => String(l || '').trim()).filter(Boolean);
  for (const line of cleaned) {
    if (!isCompleteSentence(line)) {
      violations.push({ type: 'incomplete_sentence', line });
    }
  }
  if (hasRepeatedSubject(cleaned) && cleaned.length >= 2) {
    violations.push({ type: 'repeated_subject_opener' });
  }
  return { ok: violations.length === 0, violations };
}

module.exports = {
  isCompleteSentence,
  validateSentences,
  wordCount,
  ensurePeriod,
  hasRepeatedSubject
};
