/** PR-6 — rewrite must preserve PR-5 facts; no hallucination. */

const { beatTokens } = require('../strategy/strategy-context');

const INVENTION_PATTERNS = [
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b/i,
  /\bearly favorite\b/i,
  /\bcommitted to\b/i,
  /\boffered (?:him|her|a)\b/i,
  /\bverbally committed\b/i
];

function collectAllowedTokens(pr5Pack) {
  const trace = pr5Pack?.strategyTrace || pr5Pack?.trace || {};
  const beatText = pr5Pack?.beatText || '';
  const allowed = new Set();

  for (const sig of trace.signals || []) {
    for (const token of sig.tokens || []) {
      for (const word of String(token).toLowerCase().split(/\s+/)) {
        if (word.length >= 3) allowed.add(word);
      }
    }
  }

  for (const token of beatTokens(beatText)) {
    for (const word of String(token).toLowerCase().split(/\s+/)) {
      if (word.length >= 3) allowed.add(word);
    }
  }

  for (const school of pr5Pack?.compSchools || []) {
    for (const word of String(school).toLowerCase().split(/\s+/)) {
      if (word.length >= 2) allowed.add(word);
    }
  }

  ['florida', 'gators', 'uf', 'gainesville', 'swamp', 'staff', 'board', 'visit', 'campus', 'lane', 'traction'].forEach(
    (w) => allowed.add(w)
  );

  return allowed;
}

function extractCompMentions(text) {
  const comps = [];
  const re = /\b(FSU|UGA|Alabama|Ohio State|Miami|Georgia|Clemson|Auburn|LSU|Tennessee)\b/gi;
  let m;
  while ((m = re.exec(String(text || ''))) !== null) {
    comps.push(m[1]);
  }
  return [...new Set(comps.map((c) => c.toLowerCase()))];
}

function isProvenanceSafe(rewrittenText, pr5Pack) {
  const violations = [];
  const text = String(rewrittenText || '');

  for (const re of INVENTION_PATTERNS) {
    if (re.test(text) && !re.test(String(pr5Pack?.beatText || ''))) {
      violations.push({ type: 'invented_detail', pattern: re.source });
    }
  }

  const allowedComps = (pr5Pack?.compSchools || []).map((c) => String(c).toLowerCase());
  const mentionedComps = extractCompMentions(text);
  for (const comp of mentionedComps) {
    const normalized = comp === 'georgia' ? 'uga' : comp;
    const ok =
      allowedComps.some((c) => c.includes(normalized) || normalized.includes(c.replace(/\s/g, ''))) ||
      beatTokens(pr5Pack?.beatText || '').some((t) => t.toLowerCase().includes(normalized));
    if (!ok && !['florida', 'gators'].includes(normalized)) {
      violations.push({ type: 'invented_comp', comp });
    }
  }

  const original = `${pr5Pack?.intelLine || ''} ${pr5Pack?.contextLine || ''} ${pr5Pack?.strategyLine || ''}`.toLowerCase();
  if (/swamp/i.test(original) && !/swamp/i.test(text) && /first trip|visit/i.test(original)) {
    violations.push({ type: 'dropped_visit_fact' });
  }

  return { ok: violations.length === 0, violations };
}

module.exports = {
  isProvenanceSafe,
  collectAllowedTokens,
  extractCompMentions
};
