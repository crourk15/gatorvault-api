/**
 * Team event beat fact extraction — kickoff, schedule, game week, staff, depth chart, injury.
 */
const OPPONENT_RE =
  /\b(?:Florida|Gators|UF)\s+(?:vs\.?|@)\s+([A-Z][A-Za-z0-9 .&'-]+?)(?:\s+(?:kickoff|on|at|in|week|game|set)|\s*—|,|\.|$)/i;
const REVERSE_OPPONENT_RE =
  /\b([A-Z][A-Za-z0-9 .&'-]+?)\s+(?:vs\.?|@)\s+(?:Florida|Gators|UF)\b/i;
const KICKOFF_TIME_RE =
  /\b(\d{1,2}:\d{2}\s*(?:a\.?m\.?|p\.?m\.?)\s*(?:ET|CT|EST|EDT|PT|PST|PDT)?|\d{1,2}:\d{2}\s*(?:ET|CT|EST|EDT|PT|PST|PDT))\b/i;
const NETWORK_RE =
  /\b(ESPN2?|ABC|CBS|SEC Network|Peacock|CBSSN|ESPNU|FS1|Prime Video|ACC Network|NBC|FOX)\b/i;
const VENUE_RE =
  /\b(Ben Hill Griffin Stadium|The Swamp|Ben Hill Griffin|Gainesville)\b/i;
const WEEK_RE = /\bweek\s+(\d{1,2})\b/i;
const STAFF_NAME_RE =
  /\b(?:Florida|Gators|UF)\s+(?:named|hired|promoted)\s+([A-Z][a-z'.-]+\s+[A-Z][a-z'.-]+)(?=\s+(?:co-|as |to |general |associate |assistant |offensive |defensive |special |director |,))/i;
const STAFF_NAME_ALT_RE =
  /\b([A-Z][a-z'.-]+(?:\s+[A-Z][a-z'.-]+){0,2})\s+(?:named|hired|promoted)\s+(?:as|to)\s+/i;
const STAFF_ROLE_RE =
  /\b((?:co-)?(?:offensive|defensive|special teams|wide receivers|quarterbacks|running backs|linebackers|defensive line|secondary)\s+(?:coordinator|coach)|(?:head|associate|assistant)\s+(?:coach|coordinator)|general manager|director of (?:player personnel|recruiting|strength(?:\s+and\s+conditioning)?))\b/i;
const POS_TOKEN = 'QB|RB|WR|TE|OL|OT|OG|C|DL|DE|EDGE|LB|CB|S|DB|ATH|K|P|FS|SS|NT|DT';
const DEPTH_CHART_PLAYER_RE =
  /\b([A-Z][a-z'.-]+(?:\s+[A-Z][a-z'.-]+)?)\s+at\s+([A-Z0-9]{1,4}|starter|WR\d|RB\d|QB\d|RB1|WR1|QB1|RB2|WR2)\b/i;
const DEPTH_CHART_LISTED_RE =
  /\b([A-Z][a-z'.-]+(?:\s+[A-Z][a-z'.-]+)?)\s+listed\s+at\s+([A-Z0-9]{1,4}|starter|WR\d|RB\d|QB\d)\b/i;
const DEPTH_CHART_MOVES_RE =
  /\b([A-Z][a-z'.-]+(?:\s+[A-Z][a-z'.-]+)?)\s+moves?\s+to\s+([A-Za-z0-9 ]+?)\s+on\s+the\b/i;
const POS_PLAYER_RE =
  new RegExp(`\\b(?:Florida|Gators|UF)\\s+(?:${POS_TOKEN})\\s+([A-Z][a-z'.-]+\\s+[A-Z][a-z'.-]+)\\b`, 'i');
const INJURY_PLAYER_RE =
  /\b([A-Z][a-z'.-]+(?:\s+[A-Z][a-z'.-]+)?)\s+(?:ruled out|out for|questionable|doubtful|expected to miss|listed as game-time decision|will miss|is out)\b/i;
const INJURY_STATUS_RE =
  /\b(ruled out(?: for [^,.]+)?|out for the season|out for (?:the )?[A-Za-z0-9 .]+ game|questionable|doubtful|game-time decision|expected to miss|is out|will miss)\b/i;

function normalizeBeat(beatText = '') {
  return String(beatText || '').replace(/\s+/g, ' ').trim();
}

function extractOpponent(beatText = '') {
  const beat = normalizeBeat(beatText);
  const gameWeek = beat.match(/\bgame week\s+vs\.?\s+([A-Z][A-Za-z0-9 .&'-]+?)(?:\s+at|\s+on|\s+—|,|\.|$)/i);
  if (gameWeek?.[1]) return gameWeek[1].replace(/\s+$/, '').trim();
  const vs = beat.match(OPPONENT_RE);
  if (vs?.[1]) return vs[1].replace(/\s+$/, '').trim();
  const reverse = beat.match(REVERSE_OPPONENT_RE);
  if (reverse?.[1]) return reverse[1].replace(/\s+$/, '').trim();
  return null;
}

function extractStaffName(beatText = '') {
  const beat = normalizeBeat(beatText);
  const direct = beat.match(STAFF_NAME_RE);
  if (direct?.[1]) return direct[1].trim();
  const alt = beat.match(STAFF_NAME_ALT_RE);
  if (alt?.[1]) return alt[1].trim();
  return null;
}

function extractStaffRole(beatText = '') {
  const beat = normalizeBeat(beatText);
  const role = beat.match(STAFF_ROLE_RE);
  if (role?.[1]) return role[1].trim();
  const named = beat.match(/\bnamed\s+([A-Z][a-z'.-]+(?:\s+[A-Z][a-z'.-]+){0,3})\b/i);
  if (named?.[1] && !extractStaffName(beat)) return named[1].trim();
  return null;
}

function extractStaffAction(beatText = '') {
  const beat = normalizeBeat(beatText);
  if (/\bpromot(?:ed|ion)\b/i.test(beat)) return 'promoted';
  if (/\bhired\b/i.test(beat)) return 'hired';
  if (/\bnamed\b/i.test(beat)) return 'named';
  if (/\bresigned\b/i.test(beat)) return 'resigned';
  if (/\bfired\b/i.test(beat)) return 'fired';
  return null;
}

function extractPlayerName(beatText = '', ctx = {}) {
  const hinted = String(ctx.playerName || '').trim();
  if (hinted) return hinted;
  const beat = normalizeBeat(beatText);
  for (const re of [DEPTH_CHART_PLAYER_RE, DEPTH_CHART_LISTED_RE, DEPTH_CHART_MOVES_RE, INJURY_PLAYER_RE, POS_PLAYER_RE]) {
    const m = beat.match(re);
    if (m?.[1]) return m[1].trim();
  }
  try {
    const copy = require('../../x-autoposter-copy');
    const fromCopy = copy.extractPlayerFromText(beat);
    if (fromCopy) return fromCopy;
  } catch {
    /* optional */
  }
  return null;
}

function extractPlayerPos(beatText = '') {
  const beat = normalizeBeat(beatText);
  const posPlayer = beat.match(POS_PLAYER_RE);
  if (posPlayer?.[0]) {
    const pos = posPlayer[0].match(new RegExp(`\\b(${POS_TOKEN})\\b`, 'i'));
    if (pos?.[1]) return pos[1].toUpperCase();
  }
  const atPos = beat.match(new RegExp(`\\bat\\s+(${POS_TOKEN}|starter|WR\\d|RB\\d|QB\\d)\\b`, 'i'));
  if (atPos?.[1]) return atPos[1].toUpperCase();
  return null;
}

function extractDepthRole(beatText = '', playerName = null) {
  const beat = normalizeBeat(beatText);
  const name = playerName || extractPlayerName(beat);
  if (name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const roleRe = new RegExp(
      `${escaped}\\s+(?:at|listed at|moves? to)\\s+([A-Za-z0-9 ]+?)(?:\\s+on|\\s+for|,|\\.|$)`,
      'i'
    );
    const m = beat.match(roleRe);
    if (m?.[1]) return m[1].replace(/\s+$/, '').trim();
  }
  for (const re of [DEPTH_CHART_PLAYER_RE, DEPTH_CHART_LISTED_RE, DEPTH_CHART_MOVES_RE]) {
    const m = beat.match(re);
    if (m?.[2]) return m[2].replace(/\s+$/, '').trim();
  }
  return null;
}

function extractInjuryStatus(beatText = '') {
  const beat = normalizeBeat(beatText);
  const m = beat.match(INJURY_STATUS_RE);
  return m?.[1]?.trim() || null;
}

function inferEventType(beatText = '', ctx = {}) {
  const hinted = String(ctx.teamEventType || '').toLowerCase();
  if (hinted && hinted !== 'general') return hinted;
  const beat = normalizeBeat(beatText);
  if (/\b(kickoff|kick-off|start time|game time)\b/i.test(beat)) return 'kickoff';
  if (/\b(game week|pregame|matchup)\b/i.test(beat)) return 'game_week';
  if (/\b(schedule(?:d)?|week \d+|tv network)\b/i.test(beat)) return 'schedule';
  if (/\b(uniform|jersey|alternate|throwback|helmet combo|all[-\s]?orange)\b/i.test(beat)) return 'uniform';
  if (/\b(hired|promoted|resigned|fired|named\b.*(?:coordinator|coach)|staff (?:update|change|addition))\b/i.test(beat)) {
    return 'staff';
  }
  if (
    /\b(injury report|ruled out|out for the season|game-time decision|questionable|doubtful|expected to miss|ankle injury|knee injury|shoulder injury)\b/i.test(
      beat
    )
  ) {
    return 'injury';
  }
  if (/\b(depth chart|two-deep|starter|starting (?:qb|lineup)|rotation)\b/i.test(beat)) return 'depth_chart';
  if (extractOpponent(beat)) return 'game_week';
  return 'general';
}

function extractTeamFacts(beatText = '', ctx = {}) {
  const beat = normalizeBeat(beatText);
  const facts = {
    beatText: beat,
    event_type: null,
    opponent: null,
    kickoff_time: null,
    network: null,
    venue: null,
    week_number: null,
    home_away: null,
    staff_name: null,
    staff_role: null,
    staff_action: null,
    player_name: null,
    player_pos: null,
    depth_role: null,
    injury_status: null
  };

  if (!beat) return facts;

  facts.player_name = extractPlayerName(beat, ctx);
  facts.player_pos = extractPlayerPos(beat);
  facts.depth_role = extractDepthRole(beat, facts.player_name);
  facts.injury_status = extractInjuryStatus(beat);

  facts.opponent = extractOpponent(beat);
  facts.kickoff_time = beat.match(KICKOFF_TIME_RE)?.[1] || null;
  facts.network = beat.match(NETWORK_RE)?.[1] || null;
  facts.venue = beat.match(VENUE_RE)?.[1] || null;
  facts.week_number = beat.match(WEEK_RE)?.[1] || null;
  if (/\b@\s*[A-Z]/i.test(beat) || /\bFlorida\s+@\b/i.test(beat)) facts.home_away = 'away';
  else if (facts.opponent) facts.home_away = 'home';

  facts.staff_name = extractStaffName(beat);
  facts.staff_role = extractStaffRole(beat);
  facts.staff_action = extractStaffAction(beat);

  facts.event_type = inferEventType(beat, ctx);
  return facts;
}

function selectTeamArc(facts = {}) {
  const type = facts.event_type || 'general';
  if (type === 'kickoff') return 'kickoff';
  if (type === 'schedule') return 'schedule';
  if (type === 'game_week') return 'game_week';
  if (type === 'uniform') return 'uniform';
  if (type === 'staff') return 'staff';
  if (type === 'depth_chart') return 'depth_chart';
  if (type === 'injury') return 'injury';
  return 'general';
}

module.exports = {
  extractTeamFacts,
  selectTeamArc,
  normalizeBeat,
  extractOpponent,
  extractStaffName,
  extractStaffRole,
  extractPlayerName,
  extractDepthRole,
  extractInjuryStatus
};