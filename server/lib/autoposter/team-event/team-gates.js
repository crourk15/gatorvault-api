/**
 * Team event elite compose gates — rumor block, recruiting mix, validation.
 */
const { normalizeBeat } = require('./team-fact-extractor');

const RUMOR_RE =
  /\b(rumor|rumors|hearing|heard that|could land|might land|may land|sources? tell|per sources|nothing confirmed|unconfirmed|still fluid|take this with a grain|expected to miss|likely out|game-time decision)\b/i;

const RECRUITING_DOMINANT_RE =
  /\b(20\d{2}\s+(?:(?:\d+|[a-z]+)-star|[0-9]\.?\d*)\s*(?:QB|RB|WR|TE|OL|OT|OG|C|DL|DE|EDGE|LB|CB|S|ATH|K|P)\b|\b(?:official\s+)?visit\b|\brecruit(?:ing|ment)\b|\btarget\b|\bprospect\b|\boffer(?:ed|s)?\b|\bcommit(?:ted|ment)?\b)/i;

const TEAM_SIGNAL_RE =
  /\b(kickoff|kick-off|start time|game time|schedule(?:d)?|week \d+|game week|pregame|matchup|vs\.|@\s+[A-Z]|espn|sec network|peacock|the swamp|ben hill griffin|hired|promoted|named\b.*(?:coordinator|coach)|staff (?:update|change|addition))\b/i;

const THIN_FALLBACK_RE =
  /Florida (?:schedule|team|staff) update:|Monitoring (?:staff|roster|depth chart) impact/i;

function isRumorBeat(beatText = '') {
  return RUMOR_RE.test(normalizeBeat(beatText));
}

function isRecruitingDominantTeamBeat(beatText = '') {
  const beat = normalizeBeat(beatText);
  if (!beat) return false;
  return RECRUITING_DOMINANT_RE.test(beat) && TEAM_SIGNAL_RE.test(beat);
}

function hasTeamSignal(beatText = '') {
  return TEAM_SIGNAL_RE.test(normalizeBeat(beatText));
}

function isFloridaRelevant(beatText = '') {
  return /\b(florida|gators|gator|uf\b|swamp|gainesville)\b/i.test(normalizeBeat(beatText));
}

function passesTeamDetectionGate(beatText = '', post = null) {
  const beat = normalizeBeat(beatText);
  if (!beat) return { ok: false, reason: 'empty_beat' };
  if (!isFloridaRelevant(beat)) return { ok: false, reason: 'not_uf' };
  if (isRumorBeat(beat)) return { ok: false, reason: 'rumor_blocked' };
  if (isRecruitingDominantTeamBeat(beat)) return { ok: false, reason: 'recruiting_dominant' };
  if (!hasTeamSignal(beat) && !post?.teamEventType) {
    return { ok: false, reason: 'no_team_signal' };
  }
  return { ok: true };
}

function hasFactCompleteness(facts = {}, ctx = {}) {
  if (!facts) return false;
  const hinted = String(ctx.teamEventType || facts.event_type || '').toLowerCase();
  switch (hinted) {
    case 'kickoff':
      return Boolean(facts.opponent && (facts.kickoff_time || facts.network));
    case 'schedule':
      return Boolean(facts.opponent || facts.week_number || facts.network);
    case 'game_week':
      return Boolean(facts.opponent);
    case 'uniform':
      return /\b(uniform|jersey|alternate|throwback|helmet|all[-\s]?orange)\b/i.test(facts.beatText || '');
    case 'staff':
      return Boolean(facts.staff_name && facts.staff_role);
    default:
      return Boolean(facts.opponent || facts.kickoff_time || facts.network || facts.week_number);
  }
}

function validateTeamCompose(text = '') {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t || t.length < 40) return { ok: false, reason: 'too_short' };
  if (THIN_FALLBACK_RE.test(t)) return { ok: false, reason: 'thin_fallback' };
  if (RUMOR_RE.test(t)) return { ok: false, reason: 'rumor_copy' };
  return { ok: true };
}

module.exports = {
  RUMOR_RE,
  THIN_FALLBACK_RE,
  isRumorBeat,
  isRecruitingDominantTeamBeat,
  passesTeamDetectionGate,
  validateTeamCompose,
  hasFactCompleteness,
  hasTeamSignal
};