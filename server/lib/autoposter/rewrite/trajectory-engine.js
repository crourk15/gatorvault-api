/** PR-8 — cycle / position trajectory framing (generic, no invented timelines). */

const INVENTED_TIMELINE_RE = [
  /\bcommitted before\b/i,
  /\bdecision day is set\b/i,
  /\bwill commit\b/i,
  /\bbefore signing day\b/i,
  /\bby august\b/i,
  /\bthis month\b/i
];

function normalizePos(pos) {
  return String(pos || '').trim().toUpperCase();
}

function buildTrajectoryLine(pr5Pack, signal = {}) {
  const player = signal?.player || {};
  const pos = normalizePos(player.pos || pr5Pack?.position);
  const classYear = player.classYear || pr5Pack?.classYear || '';
  const beat = String(pr5Pack?.beatText || '').toLowerCase();

  if (pos && classYear) {
    return {
      template: 'positional_priority',
      clause: `${pos} is a priority eval spot in the ${classYear} cycle, and UF wants this lane widened early`
    };
  }

  if (/spring|summer|eval|march/i.test(beat)) {
    return {
      template: 'eval_window',
      clause: 'UF is pushing now before summer evals reset the board'
    };
  }

  return {
    template: 'cycle_framing',
    clause: 'That visit matters in this cycle, where early traction at this spot often sticks'
  };
}

function validateTrajectoryLine(text, pr5Pack, signal = {}) {
  const violations = [];
  const t = String(text || '');
  const beat = String(pr5Pack?.beatText || '');

  for (const re of INVENTED_TIMELINE_RE) {
    if (re.test(t) && !re.test(beat)) violations.push({ type: 'invented_timeline', pattern: re.source });
  }

  const playerPos = normalizePos(signal?.player?.pos || pr5Pack?.position);
  const posMention = t.match(/\b(CB|S|EDGE|WR|DL|QB|RB|TE|IOL|ATH|LB|OL|DB)\b/g);
  if (posMention && playerPos) {
    for (const mentioned of posMention) {
      if (mentioned !== playerPos && !playerPos.includes(mentioned) && mentioned !== 'DB' && playerPos !== 'CB') {
        if (mentioned === 'CB' && playerPos === 'S') continue;
        violations.push({ type: 'position_mismatch', expected: playerPos, got: mentioned });
      }
    }
  }

  return { ok: violations.length === 0, violations };
}

module.exports = {
  buildTrajectoryLine,
  validateTrajectoryLine,
  normalizePos,
  INVENTED_TIMELINE_RE
};
