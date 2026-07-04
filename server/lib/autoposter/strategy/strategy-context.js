/** PR-5 — context line as a complete, readable sentence. */

const { bestSignal, hasSignalType } = require('./strategy-metrics');
const { containsBannedPhrase } = require('./strategy-provenance');
const { BANNED_STRATEGY_PHRASES } = require('./strategy-types');
const { ensurePeriod, isCompleteSentence, lastName } = require('./strategy-sentences');

function beatTokens(beatText) {
  const raw = String(beatText || '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = [];
  const patterns = [
    /\b(Gainesville|The Swamp|FNL|spring game|spring practice)\b/gi,
    /\b(top of my board|top schools|leaderboard|DB coaches|coaches texting)\b/gi,
    /\b(UGA|Alabama|Ohio State|FSU|Miami|Georgia)\b/g,
    /\b(Gators|Florida|UF)\b/gi,
    /\b(first visit|first trip|on campus)\b/gi
  ];
  for (const re of patterns) {
    let m;
    const r = new RegExp(re.source, re.flags);
    while ((m = r.exec(raw)) !== null) {
      tokens.push(m[0]);
    }
  }
  return [...new Set(tokens.map((t) => t.trim()).filter(Boolean))];
}

function buildContextLine(signals, identity = {}, ufContext = {}, beatText = '') {
  const name = identity.playerName || identity.name || 'This prospect';
  const ln = lastName(name);
  const visit = bestSignal(signals, 'visit');
  const board = bestSignal(signals, 'board');
  const staff = bestSignal(signals, 'staff');
  const comp = bestSignal(signals, 'comp');

  let line = '';

  if (hasSignalType(signals, 'visit') && hasSignalType(signals, 'board')) {
    if (/swamp|first trip/i.test(String(visit?.tokens?.[0] || ''))) {
      line = `${ln} said Florida is one of his top schools after The Swamp.`;
    } else if (/spring|top schools/i.test(`${visit?.tokens?.[0] || ''} ${board?.tokens?.[0] || ''}`)) {
      line = `${ln} told On3 the Gators are one of his top schools.`;
    } else if (/leaderboard|cracked/i.test(String(board?.tokens?.[0] || ''))) {
      line = `Florida cracked ${ln}'s board after that Gainesville visit.`;
    } else {
      line = `${ln} visited Florida recently and still lists the Gators among his top schools.`;
    }
  } else if (hasSignalType(signals, 'visit') && hasSignalType(signals, 'staff')) {
    if (/db coaches|coaches texting/i.test(String(staff?.tokens?.[0] || ''))) {
      line = `Florida's DB coaches are texting ${ln}, and his Gainesville visit moved the needle.`;
    } else {
      line = `Florida's staff contact picked up with ${ln} after his on-campus visit this spring.`;
    }
  } else if (hasSignalType(signals, 'board') && hasSignalType(signals, 'staff')) {
    line = `${ln} has Florida on his board while the Gators keep pushing staff contact.`;
  } else if (hasSignalType(signals, 'comp') && hasSignalType(signals, 'ufAngle')) {
    const compLabel =
      comp?.tokens?.length >= 2 ? `${comp.tokens[0]} and ${comp.tokens[1]}` : comp?.tokens?.[0];
    line = `Florida stands out with ${ln} for a specific reason while ${compLabel} stays in the mix.`;
  } else if (hasSignalType(signals, 'visit') && hasSignalType(signals, 'ufAngle')) {
    line = `${ln} said Florida's interest was clear before he even needed an offer.`;
  } else if (hasSignalType(signals, 'quote') && hasSignalType(signals, 'visit')) {
    line = `${ln} is open to another Gainesville trip and said Florida remains in the mix.`;
  } else if (visit?.tokens?.[0]) {
    line = `${ln} visited Florida's campus recently, and the Gators want more face time.`;
  } else if (board?.tokens?.[0]) {
    line = `${ln} told reporters Florida remains one of his top schools in this cycle.`;
  } else if (comp?.tokens?.length) {
    const compLabel = comp.tokens.length >= 2 ? `${comp.tokens[0]} and ${comp.tokens[1]}` : comp.tokens[0];
    line = `Florida is recruiting ${ln} against ${compLabel}.`;
  } else if (hasSignalType(signals, 'ufAngle')) {
    line = `${ln} said Florida's interest was clear before he even needed an offer.`;
  } else if (bestSignal(signals, 'cycle')?.tokens?.[0]) {
    line = `Florida remains in the decision window with ${ln} on the board.`;
  } else if (ufContext.posNeed) {
    line = `Florida's ${ufContext.posNeed} need fits what ${ln} is doing this cycle.`;
  }

  line = ensurePeriod(line);
  if (!line || containsBannedPhrase(line, BANNED_STRATEGY_PHRASES) || !isCompleteSentence(line)) {
    return null;
  }
  return line;
}

module.exports = {
  buildContextLine,
  beatTokens
};
