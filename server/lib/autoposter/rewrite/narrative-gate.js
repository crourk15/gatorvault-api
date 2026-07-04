/** PR-6 — tweet reads as one insider update, not disconnected blocks. */

function tokenOverlap(a, b) {
  const wordsA = new Set(
    String(a || '')
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 5)
  );
  const wordsB = String(b || '')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 5);
  let shared = 0;
  for (const w of wordsB) {
    if (wordsA.has(w)) shared += 1;
  }
  return shared;
}

function isNarrativeFlow(proseLines, pr5Pack = {}) {
  const lines = (proseLines || []).map((l) => String(l || '').trim()).filter(Boolean);
  const violations = [];

  if (lines.length < 1) {
    violations.push({ type: 'no_prose' });
    return { ok: false, violations };
  }

  if (lines.length >= 2) {
    const overlap = tokenOverlap(lines[0], lines[1]);
    if (overlap >= 4) {
      violations.push({ type: 'redundant_prose', overlap });
    }
  }

  const combined = lines.join(' ').toLowerCase();
  const visitWords = (combined.match(/\b(visit|trip|campus|swamp|gainesville)\b/g) || []).length;
  if (visitWords >= 4) {
    violations.push({ type: 'visit_repetition', visitWords });
  }

  const hasVisitArc =
    /\b(visit|trip|campus|swamp|gainesville|march|spring)\b/i.test(combined) ||
    pr5Pack?.strategyTrace?.chosenTypes?.includes('visit');
  const hasBoardArc =
    /\b(board|lane|traction|leaderboard|top schools)\b/i.test(combined) ||
    pr5Pack?.strategyTrace?.chosenTypes?.includes('board');
  const hasStaffArc =
    /\b(staff|coaches|texting|lean|capital)\b/i.test(combined) ||
    pr5Pack?.strategyTrace?.chosenTypes?.includes('staff');

  if (hasVisitArc && !hasBoardArc && !hasStaffArc && lines.length >= 2) {
    if (!/\b(lane|board|traction|next|pressing|positioned|separation|path)\b/i.test(lines[1])) {
      violations.push({ type: 'missing_strategy_arc' });
    }
  }

  return { ok: violations.length === 0, violations };
}

module.exports = {
  isNarrativeFlow,
  tokenOverlap
};
