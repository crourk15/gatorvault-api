/**
 * Team event beat fact extraction — kickoff, schedule, game week.
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

function inferEventType(beatText = '', ctx = {}) {
  const hinted = String(ctx.teamEventType || '').toLowerCase();
  if (hinted && hinted !== 'general') return hinted;
  const beat = normalizeBeat(beatText);
  if (/\b(kickoff|kick-off|start time|game time)\b/i.test(beat)) return 'kickoff';
  if (/\b(game week|pregame|matchup)\b/i.test(beat)) return 'game_week';
  if (/\b(schedule(?:d)?|week \d+|tv network)\b/i.test(beat)) return 'schedule';
  if (/\b(uniform|jersey|alternate|throwback|helmet combo|all[-\s]?orange)\b/i.test(beat)) return 'uniform';
  if (/\b(hired|promoted|named\b.*(?:coordinator|coach)|staff (?:update|change|addition))\b/i.test(beat)) {
    return 'staff';
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
    home_away: null
  };

  if (!beat) return facts;

  facts.opponent = extractOpponent(beat);
  facts.kickoff_time = beat.match(KICKOFF_TIME_RE)?.[1] || null;
  facts.network = beat.match(NETWORK_RE)?.[1] || null;
  facts.venue = beat.match(VENUE_RE)?.[1] || null;
  facts.week_number = beat.match(WEEK_RE)?.[1] || null;
  if (/\b@\s*[A-Z]/i.test(beat) || /\bFlorida\s+@\b/i.test(beat)) facts.home_away = 'away';
  else if (facts.opponent) facts.home_away = 'home';

  facts.event_type = inferEventType(beat, ctx);
  return facts;
}

function selectTeamArc(facts = {}) {
  const type = facts.event_type || 'general';
  if (type === 'kickoff') return 'kickoff';
  if (type === 'schedule') return 'schedule';
  if (type === 'game_week') return 'game_week';
  if (type === 'uniform') return 'uniform';
  return 'general';
}

module.exports = {
  extractTeamFacts,
  selectTeamArc,
  normalizeBeat,
  extractOpponent
};