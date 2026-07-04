/** PR-7 — safe competition framing from PR-5 comp schools only. */

const { compLabel } = require('./rewrite-templates');

const UNSAFE_COMP_RE = [
  /\btook the lead over\b/i,
  /\bout front\b/i,
  /\bfell out of it\b/i,
  /\bearly favorite\b/i,
  /\bleader in this race\b/i,
  /\bpull(?:ed|ing)? ahead unless\b/i
];

const FAVORITE_ALLOWED_RE = /\b(favorite|leader|out front|early leader)\b/i;

function hasVisitSignal(pr5Pack) {
  const types = pr5Pack?.strategyTrace?.chosenTypes || [];
  return types.includes('visit') || /\b(visit|trip|campus|swamp|gainesville|march)\b/i.test(pr5Pack?.beatText || '');
}

function buildCompetitionLine(pr5Pack, signal = {}) {
  const compSchools = pr5Pack?.compSchools?.length
    ? pr5Pack.compSchools
    : signal?.metrics?.compSchools || [];
  if (!compSchools.length) return null;

  const primary = compSchools[0];
  const beat = String(pr5Pack?.beatText || '').toLowerCase();
  const visit = hasVisitSignal(pr5Pack);

  if (visit) {
    return {
      template: 'separation',
      primary,
      clause: `UF gained separation from ${primary} after that visit`
    };
  }

  if (compSchools.length >= 2) {
    const label = compLabel(compSchools);
    return {
      template: 'parallel_push',
      primary,
      clause: `UF is pressing early while ${label} recalibrate their approach`
    };
  }

  return {
    template: 'slowed_push',
    primary,
    clause: `${primary} slowed their push, and that opened a cleaner lane for Florida`
  };
}

function validateCompetitionLine(text, pr5Pack, signal = {}) {
  const violations = [];
  const t = String(text || '');

  for (const re of UNSAFE_COMP_RE) {
    if (re.test(t)) violations.push({ type: 'unsafe_comp_framing', pattern: re.source });
  }

  if (FAVORITE_ALLOWED_RE.test(t) && !FAVORITE_ALLOWED_RE.test(String(pr5Pack?.beatText || ''))) {
    violations.push({ type: 'invented_favorite' });
  }

  const allowed = (pr5Pack?.compSchools || signal?.metrics?.compSchools || []).map((c) =>
    String(c).toLowerCase()
  );
  const mentionRe =
    /\b(FSU|UGA|Alabama|Ohio State|Miami|Georgia|Clemson|Auburn|LSU|Tennessee|Bama)\b/gi;
  let m;
  while ((m = mentionRe.exec(t)) !== null) {
    const school = m[1].toLowerCase();
    const ok = allowed.some(
      (c) => c.includes(school) || school.includes(c.split(' ')[0]) || (school === 'uga' && c.includes('georgia'))
    );
    if (!ok) violations.push({ type: 'unknown_comp_school', school: m[1] });
  }

  return { ok: violations.length === 0, violations };
}

module.exports = {
  buildCompetitionLine,
  validateCompetitionLine,
  hasVisitSignal,
  UNSAFE_COMP_RE
};
