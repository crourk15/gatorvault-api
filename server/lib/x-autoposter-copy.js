/**
 * Autoposter copy — attribution rules, player extraction, structured templates.
 * Only attach "via [Analyst]" when player-specific intel is present.
 */

const SITE_URL = process.env.SITE_URL || 'https://gatorvaultinsider.com';

const INVALID_NAME_PARTS = new Set([
  'her',
  'his',
  'the',
  'new',
  'four',
  'five',
  'star',
  'class',
  'florida',
  'gators',
  'gator',
  'other',
  'top',
  'per',
  'via',
  'our',
  'own',
  'breaking',
  'official',
  'unofficial',
  'south',
  'north',
  'ole',
  'miss',
  'state',
  'carolina',
  'georgia',
  'alabama',
  'tennessee',
  'recruit',
  'recruits',
  'target',
  'targets',
  'nation',
  'machine',
  'prediction',
  'rivals',
  'online',
  'gators',
  'weekend',
  'this',
  'that',
  'with',
  'from',
  'they',
  'will',
  'now',
  'has',
  'have',
  'had',
  'for',
  'and',
  'to'
]);

const BROKEN_COPY_PATTERNS = [
  /\bour own pi\b/i,
  /\bHer — via\b/i,
  /\bHis — via\b/i,
  /\bThe — via\b/i,
  /\bNew — via\b/i,
  /\bFour — via\b/i,
  /\bOther — via\b/i,
  /— via [^🐊]+🐊?\s*https?:\/\/\S+\s*$/i // name missing before em dash via
];

const PLAYER_INTEL_SIGNALS = [
  /\b(commit(?:ted|ment)?|decommit(?:ted)?|flip(?:ped)?|portal|enroll(?:s|ed|ing)?)\b/i,
  /\b(official visit|\bov\b|\buv\b|unofficial visit|visit(?:ed|ing|s)? scheduled|cancel(?:led|s)?\s+(?:his|her|their)?\s*(?:ov|official))\b/i,
  /\b(prediction machine|futurecast|expert pick|crystal ball|forecast logged|prediction logged)\b/i,
  /\b(offer(?:ed|s)?|verb(?:ed|al)?)\b/i,
  /\bClass of 20\d{2}\b/i
];

function isValidPlayerName(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < 4 || trimmed.length > 48) return false;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return false;
  if (parts.some((p) => INVALID_NAME_PARTS.has(p.toLowerCase()))) return false;
  if (!parts.every((p) => /^[A-Za-z][A-Za-z'-]{1,}$/.test(p))) return false;
  return true;
}

function extractPlayerFromText(text) {
  const t = String(text || '');
  const patterns = [
    /\b(?:Class of 20\d{2})\s+(?:\d+-Star\s+)?(?:[A-Z]{1,4}\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+){1,2})\b/,
    /\b(?:BREAKING:)\s*(?:Class of 20\d{2}\s+)?(?:\d+-Star\s+)?(?:[A-Z]{1,4}\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+){1,2})\b/,
    /\b(?:pick|prediction|forecast)\s+for\s+([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+){1,2})\b/i,
    /\bfor\s+([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+){1,2})\s+to\s+Florida\b/i,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+){1,2})\s+(?:has|have)\s+(?:committed|cancelled|canceled|decommitted|flipped|enrolled|signed)\b/,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+){1,2})\s+(?:will|to)\s+(?:now\s+)?(?:visit|take)\b/
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m?.[1] && isValidPlayerName(m[1].trim())) return m[1].trim();
  }
  const m = t.match(/\b([A-Z][a-z]+\s+[A-Z][a-z'-]+)\b/);
  const fallback = m?.[1]?.trim() || null;
  return isValidPlayerName(fallback) ? fallback : null;
}

function hasPlayerSpecificIntel(text) {
  const t = String(text || '');
  if (!PLAYER_INTEL_SIGNALS.some((re) => re.test(t))) return false;
  return !!extractPlayerFromText(t);
}

function isGeneralBeatCommentary(text) {
  const lower = String(text || '').toLowerCase();
  if (hasPlayerSpecificIntel(text)) return false;
  if (
    /still working|still chasing|still pushing|in the hunt|on the trail|weekend ahead|busy weekend|several targets|plenty of|lot of targets|working on targets|recruiting well|good momentum|big weekend coming/i.test(
      lower
    )
  ) {
    return true;
  }
  return !extractPlayerFromText(text);
}

function isPredictionMachinePost(text) {
  return /prediction machine|futurecast|expert pick logged|prediction logged/i.test(String(text || ''));
}

function truncateAtWord(text, max) {
  const t = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  const out = (lastSpace > max * 0.55 ? cut.slice(0, lastSpace) : cut).trimEnd();
  return out.endsWith('…') ? out : `${out}…`;
}

function appendSite(text) {
  const body = String(text || '').trim();
  if (!body) return '';
  if (body.includes(SITE_URL.replace('https://', ''))) return body.slice(0, 280);
  return `${body.slice(0, 240)} ${SITE_URL}`.slice(0, 280);
}

function withAttribution(line, analyst) {
  const base = String(line || '').trim();
  const name = String(analyst || '').trim();
  if (!base || !name) return base;
  if (/— via /i.test(base)) return base;
  return `${base} — via ${name}`;
}

function buildPredictionMachineCopy(post) {
  const text = String(post.text || '').replace(/\s+/g, ' ').trim();
  const analyst = post.writerName || post.outlet || post.handle || 'Insider';
  const player = extractPlayerFromText(text);
  const matching = /matching.*prediction machine|prediction machine.*matching|logged a matching/i.test(text);
  const second = /\b(?:second|another|additional)\b.*prediction machine/i.test(text);

  if (matching && player) {
    return appendSite(`Gators Online has logged a matching Prediction Machine pick for ${player} — via ${analyst}. 🐊`);
  }
  if (matching) {
    return appendSite(`Gators Online has logged a matching Prediction Machine pick — via ${analyst}. 🐊`);
  }
  if (second) {
    return appendSite(`A second Prediction Machine pick has been logged for Florida — via ${analyst}. 🐊`);
  }
  if (player) {
    return appendSite(`${analyst} has submitted a Prediction Machine pick for ${player} (Florida). 🐊`);
  }
  return appendSite(`${analyst} has submitted a Prediction Machine pick for Florida. 🐊`);
}

function buildBeatIntelCopy(post) {
  const text = String(post.text || '').replace(/\s+/g, ' ').trim();
  if (!text || isGeneralBeatCommentary(text)) return null;
  if (!hasPlayerSpecificIntel(text)) return null;

  const analyst = post.writerName || post.outlet || post.handle || 'Insider';
  const player = extractPlayerFromText(text);

  if (isPredictionMachinePost(text)) {
    return buildPredictionMachineCopy(post);
  }

  if (/cancel(?:led|s)?\s+(?:his|her|their)?\s*(?:ov|official visit).*?(?:florida|gators|\buf\b)/i.test(text)) {
    const next = text.match(/visit\s+((?:South\s+Carolina|North\s+Carolina|Ole\s+Miss|[A-Z][a-z]+(?:\s+State)?))/i);
    const nextSchool = next?.[1] || null;
    const nextPart = nextSchool ? ` and will visit ${nextSchool} this weekend` : '';
    return appendSite(`${player} has cancelled his OV to Florida${nextPart} — via ${analyst} 🐊`);
  }

  if (player && /\b(commit(?:ted|ment)?|flip(?:ped)?|decommit|portal)\b/i.test(text)) {
    const summary = truncateAtWord(text, 160);
    return appendSite(`${summary} — via ${analyst} 🐊`);
  }

  if (player && /\b(official visit|\bov\b|unofficial visit|visit(?:ed|ing|s)?)\b/i.test(text)) {
    const summary = truncateAtWord(text, 160);
    return appendSite(`${summary} — via ${analyst} 🐊`);
  }

  if (player) {
    const summary = truncateAtWord(text, 160);
    return appendSite(`${summary} — via ${analyst} 🐊`);
  }

  return null;
}

function buildIntelCopy(intel) {
  if (!intel?.eventType) return null;
  const name = intel.playerName;
  const analyst = intel.analystName || intel.source || null;
  const visitRange =
    intel.visitStart && intel.visitEnd ? `${intel.visitStart}–${intel.visitEnd}` : intel.visitStart || '';

  if (intel.eventType === 'official_visit') {
    if (!isValidPlayerName(name)) return null;
    const line = `${name} (${intel.pos || 'Recruit'}) — Official visit to Gainesville${visitRange ? ` · ${visitRange}` : ''}`;
    return {
      text: appendSite(`${withAttribution(line, analyst || intel.source)} 🐊`),
      playerName: name
    };
  }

  if (intel.eventType === 'visit_cancelled' || intel.eventType === 'ov_change') {
    if (!isValidPlayerName(name)) return null;
    const next = intel.nextVisitSchool ? ` and will visit ${intel.nextVisitSchool} this weekend` : '';
    const line = `${name} has cancelled his OV to Florida${next}`;
    return {
      text: appendSite(`${withAttribution(line, analyst || intel.source)} 🐊`),
      playerName: name
    };
  }

  if (intel.eventType === 'prediction') {
    if (!isValidPlayerName(name)) return null;
    if (analyst) {
      const conf = intel.confidencePct != null ? ` (${intel.confidencePct}% confidence)` : '';
      return {
        text: appendSite(`Rivals analyst ${analyst} logs a Florida prediction for ${name}${conf}. 🐊`),
        playerName: name
      };
    }
    if (intel.detail && /prediction machine|futurecast/i.test(intel.detail)) {
      return {
        text: appendSite(`${intel.detail} 🐊`),
        playerName: name
      };
    }
    if (!intel.detail && !intel.status) return null;
    return {
      text: appendSite(`${name} — ${intel.detail || intel.status} 🐊`),
      playerName: name
    };
  }

  if (intel.eventType === 'trending' || intel.eventType === 'recruiting_momentum') {
    if (!isValidPlayerName(name)) return null;
    return {
      text: appendSite(`Florida trending for ${name} per ${intel.source} 🐊`),
      playerName: name
    };
  }

  if (!isValidPlayerName(name)) return null;
  if (!intel.detail && !intel.status) return null;
  return {
    text: appendSite(`${name} — ${intel.detail || intel.status} 🐊`),
    playerName: name
  };
}

function buildMomentumCopy(post) {
  const beatFilters = require('./beat-writer-filters');
  const text = String(post.text || '');
  if (!beatFilters.detectRecruitingMomentum(text)) return null;
  const player = extractPlayerFromText(text);
  if (!player) return null;
  const source = post.writerName || post.outlet || post.handle || 'Insider';
  return appendSite(`Florida trending for ${player} per ${source}. 🐊`);
}

function isBrokenCopy(text) {
  const t = String(text || '');
  if (!t.trim()) return true;
  if (BROKEN_COPY_PATTERNS.some((re) => re.test(t))) return true;
  if (/^[A-Z][a-z]{1,3} — via /i.test(t)) return true;
  if (/— via [^🐊]{0,3}$/.test(t)) return true;
  return false;
}

module.exports = {
  SITE_URL,
  isValidPlayerName,
  extractPlayerFromText,
  hasPlayerSpecificIntel,
  isGeneralBeatCommentary,
  isPredictionMachinePost,
  truncateAtWord,
  appendSite,
  withAttribution,
  buildPredictionMachineCopy,
  buildBeatIntelCopy,
  buildIntelCopy,
  buildMomentumCopy,
  isBrokenCopy
};
