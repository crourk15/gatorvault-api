/** PR-5 — context line with ≥2 beat-derived tokens. */

const { bestSignal, hasSignalType } = require('./strategy-metrics');
const { extractQuote } = require('./strategy-extract');
const { containsBannedPhrase } = require('./strategy-provenance');
const { BANNED_STRATEGY_PHRASES, MAX_CONTEXT_QUOTE_CHARS } = require('./strategy-types');

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

function abbreviateToken(token) {
  const t = String(token || '').trim();
  if (!t) return t;
  if (/first visit to gainesville/i.test(t)) return 'Gainesville visit';
  if (/first trip to the swamp/i.test(t)) return 'Swamp visit';
  if (/on campus this spring/i.test(t)) return 'spring campus visit';
  if (/cracked his early leaderboard/i.test(t)) return 'early leaderboard';
  if (/all three db coaches texting/i.test(t)) return 'DB coaches texting';
  if (/top schools/i.test(t)) return 'top schools';
  if (/top of my board/i.test(t)) return 'top of board';
  if (t.length > 34) return t.slice(0, 31) + '…';
  return t;
}

function buildContextLine(signals, identity = {}, ufContext = {}, beatText = '') {
  const visit = bestSignal(signals, 'visit');
  const board = bestSignal(signals, 'board');
  const staff = bestSignal(signals, 'staff');
  const comp = bestSignal(signals, 'comp');
  const quote = bestSignal(signals, 'quote');
  const pos = identity.pos || identity.position || 'prospect';
  const classYear = identity.classYear || identity.year || '';
  const name = identity.playerName || identity.name || 'This prospect';

  const parts = [];
  if (visit?.tokens?.[0]) parts.push(abbreviateToken(visit.tokens[0]));
  if (board?.tokens?.[0]) parts.push(abbreviateToken(board.tokens[0]));
  if (staff?.tokens?.[0]) parts.push(abbreviateToken(staff.tokens[0]));
  if (comp?.tokens?.[0]) parts.push(abbreviateToken(comp.tokens[0]));

  let line = '';
  if (parts.length >= 2) {
    line = `${name} (${classYear} ${pos}): ${parts[0]} + ${parts[1]} on UF's board.`;
  } else if (quote?.tokens?.[0]) {
    const q = quote.tokens[0].length > MAX_CONTEXT_QUOTE_CHARS
      ? `${quote.tokens[0].slice(0, MAX_CONTEXT_QUOTE_CHARS - 1)}…`
      : quote.tokens[0];
    line = `"${q}" — UF context for ${classYear ? `${classYear} ` : ''}${pos} ${name.split(' ').pop()}.`;
  } else if (visit?.tokens?.[0]) {
    line = `${name} (${classYear} ${pos}): ${visit.tokens[0]} is the live UF board signal.`;
  } else if (board?.tokens?.[0]) {
    line = `${name} has ${board.tokens[0]} — Florida is in the conversation.`;
  } else if (comp?.tokens?.length) {
    const compLabel =
      comp.tokens.length >= 2 ? `${comp.tokens[0]} and ${comp.tokens[1]}` : comp.tokens[0];
    line = `${name}${classYear ? ` (${classYear} ${pos})` : ''} — Florida is recruiting against ${compLabel} in this cycle.`;
  } else if (bestSignal(signals, 'cycle')?.tokens?.[0]) {
    const cycle = bestSignal(signals, 'cycle').tokens[0];
    line = `Florida is in the ${cycle} with ${name}${classYear ? ` (${classYear} ${pos})` : ''} on the board.`;
  } else if (ufContext.posNeed) {
    line = `UF ${ufContext.posNeed} need intersects ${name}'s timeline this cycle.`;
  } else {
    const fromBeat = beatTokens(beatText);
    if (fromBeat.length >= 2) {
      line = `Beat intel: ${fromBeat[0]} and ${fromBeat[1]} matter for UF's ${pos} board.`;
    }
  }

  if (!line || containsBannedPhrase(line, BANNED_STRATEGY_PHRASES)) {
    return null;
  }

  return line;
}

module.exports = {
  beatTokens,
  buildContextLine
};
