/** PR-5 — beat-first signal extraction with provenance tokens. */

function stripUrls(text) {
  return String(text || '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pushSignal(signals, seen, payload) {
  const key = `${payload.type}:${payload.tokens.join('|')}`;
  if (seen.has(key)) return;
  seen.add(key);
  signals.push(payload);
}

function extractQuote(beat) {
  const m = beat.match(/"([^"]{4,120})"/) || beat.match(/"([^"]{4,120})"/);
  if (!m) return null;
  return m[1].trim();
}

const COMP_ALIASES = [
  { re: /\bUGA\b|\bGeorgia\b/i, token: 'UGA' },
  { re: /\bAlabama\b|\bBama\b/i, token: 'Alabama' },
  { re: /\bOhio State\b/i, token: 'Ohio State' },
  { re: /\bFSU\b|\bFlorida State\b/i, token: 'FSU' },
  { re: /\bMiami\b/i, token: 'Miami' }
];

function extractCompTokens(beat) {
  const found = [];
  for (const { re, token } of COMP_ALIASES) {
    if (re.test(beat)) found.push(token);
  }
  return [...new Set(found)];
}

function extractVisitToken(beatLower, beatRaw) {
  if (/first trip to the swamp|first trip to the swamp/i.test(beatRaw)) {
    return { token: 'first trip to The Swamp', confidence: 'high' };
  }
  if (/first visit to gainesville|first visit/i.test(beatLower)) {
    return { token: 'first visit to Gainesville', confidence: 'high' };
  }
  if (/friday night lights|\bfnl\b/i.test(beatLower)) {
    return { token: 'FNL weekend', confidence: 'high' };
  }
  if (/on campus this spring|spring practice|spring game/i.test(beatLower)) {
    return { token: 'on campus this spring', confidence: 'medium' };
  }
  if (/another trip to gainesville|trip to gainesville could happen/i.test(beatLower)) {
    return { token: 'another trip to Gainesville', confidence: 'high' };
  }
  if (/on campus at florida|was on campus|first trip/i.test(beatLower)) {
    return { token: 'campus visit', confidence: 'medium' };
  }
  if (/visit|campus|gainesville|the swamp/i.test(beatLower)) {
    return { token: 'Gainesville visit window', confidence: 'medium' };
  }
  return null;
}

function extractBoardToken(beatLower) {
  if (/top of my board|one of those schools at the top of my board/i.test(beatLower)) {
    return { token: 'top of my board', confidence: 'high' };
  }
  if (/cracked his early leaderboard|cracked.*leaderboard/i.test(beatLower)) {
    return { token: 'cracked his early leaderboard', confidence: 'high' };
  }
  if (/one of my top schools|definitely one of my top schools|top schools/i.test(beatLower)) {
    return { token: 'top schools', confidence: 'high' };
  }
  if (/top school|top-tier staff signal|top school for/i.test(beatLower)) {
    return { token: 'top school', confidence: 'medium' };
  }
  return null;
}

function extractStaffToken(beatLower) {
  if (/all three.*db coaches|all three.*coaches texting/i.test(beatLower)) {
    return { token: 'all three DB coaches texting', confidence: 'high' };
  }
  if (/coaches texting|staff energy|staff contact|face time/i.test(beatLower)) {
    return { token: 'staff contact', confidence: 'medium' };
  }
  if (/we want you and we're going to get you|want you and/i.test(beatLower)) {
    return { token: 'staff priority message', confidence: 'high' };
  }
  return null;
}

function extractUfAngleToken(beatLower) {
  if (/didn't need an offer|did not need an offer/i.test(beatLower)) {
    return { token: "didn't need an offer", confidence: 'high' };
  }
  if (/stands out for a specific reason|what was different/i.test(beatLower)) {
    return { token: 'stands out for a specific reason', confidence: 'medium' };
  }
  if (/really like the gators/i.test(beatLower)) {
    return { token: 'I really like the Gators', confidence: 'medium' };
  }
  return null;
}

function extractTraitToken(beatLower) {
  if (/length\/power|\bsec frame\b|big-bodied|\b6-foot-5\b.*\b265/i.test(beatLower)) {
    const m = beatLower.match(/\b(\d+-foot-\d+,?\s*\d+-pound\s*(?:dl|edge|cb)?)/i);
    if (m) return { token: m[1].trim(), confidence: 'medium' };
    return { token: 'trait fit', confidence: 'low' };
  }
  return null;
}

function extractSignalsFromBeat(beatText, identity = {}) {
  const beatRaw = stripUrls(beatText);
  const beat = beatRaw.toLowerCase();
  const signals = [];
  const seen = new Set();

  if (!beat || beat.length < 24) return signals;

  const visit = extractVisitToken(beat, beatRaw);
  if (visit) {
    pushSignal(signals, seen, {
      type: 'visit',
      tokens: [visit.token],
      source: 'beat',
      confidence: visit.confidence
    });
  }

  const board = extractBoardToken(beat);
  if (board) {
    pushSignal(signals, seen, {
      type: 'board',
      tokens: [board.token],
      source: 'beat',
      confidence: board.confidence
    });
  }

  const staff = extractStaffToken(beat);
  if (staff) {
    pushSignal(signals, seen, {
      type: 'staff',
      tokens: [staff.token],
      source: 'beat',
      confidence: staff.confidence
    });
  }

  const compTokens = extractCompTokens(beatRaw);
  if (compTokens.length) {
    pushSignal(signals, seen, {
      type: 'comp',
      tokens: compTokens,
      source: 'beat',
      confidence: compTokens.length >= 2 ? 'medium' : 'low'
    });
  }

  const ufAngle = extractUfAngleToken(beat);
  if (ufAngle) {
    pushSignal(signals, seen, {
      type: 'ufAngle',
      tokens: [ufAngle.token],
      source: 'beat',
      confidence: ufAngle.confidence
    });
  }

  const trait = extractTraitToken(beat);
  if (trait) {
    pushSignal(signals, seen, {
      type: 'trait',
      tokens: [trait.token],
      source: 'beat',
      confidence: trait.confidence
    });
  }

  const quote = extractQuote(beatRaw);
  if (quote) {
    pushSignal(signals, seen, {
      type: 'quote',
      tokens: [quote],
      source: 'beat',
      confidence: quote.length >= 12 ? 'medium' : 'low'
    });
  }

  return signals;
}

module.exports = {
  stripUrls,
  extractSignalsFromBeat,
  extractQuote
};
