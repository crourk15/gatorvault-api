/**
 * Parse OV cancel / visit-change signals from beat-writer posts (Hayes Fawcett, etc.).
 */
const beatFilters = require('./beat-writer-filters');

const OV_CANCEL_PATTERNS = [
  /cancel(?:led|s)?\s+(?:his|her|their)?\s*(?:ov|official\s+visit).*?(?:florida|gators|\buf\b|gainesville)/i,
  /(?:ov|official\s+visit).*?(?:florida|gators|\buf\b|gainesville).*cancel/i,
  /cancel(?:led|s)?\s+(?:his|her|their)?\s*(?:florida|gators|\buf\b|gainesville)\s*(?:ov|official\s+visit)/i
];

const NEXT_VISIT_RE =
  /(?:will\s+now\s+visit|now\s+(?:visit|visiting)|headed\s+to|visiting)\s+((?:South\s+Carolina|North\s+Carolina|Ole\s+Miss|[A-Z][a-z]+(?:\s+State)?))(?:\s+this\s+weekend|\s+on\b|,|\.|$|\s)/i;

function isVisitCancelPost(text) {
  const t = String(text || '');
  return OV_CANCEL_PATTERNS.some((re) => re.test(t));
}

function parseNextVisitSchool(text) {
  const m = String(text || '').match(NEXT_VISIT_RE);
  if (!m) return null;
  return m[1].trim();
}

function parseClassYear(text) {
  const m = String(text || '').match(/\b(202[6-9]|2030)\b/);
  return m ? parseInt(m[1], 10) : null;
}

function parseBeatPostForVisitChange(post) {
  const text = String(post.text || '').trim();
  if (!text || !isVisitCancelPost(text)) return null;
  if (!beatFilters.shouldIncludeBeatPost(post)) return null;
  if (!beatFilters.isFloridaRelatedPost(post)) return null;

  const playerName = beatFilters.extractPlayerFromText(text);
  if (!playerName) return null;

  const analystName = post.writerName || post.outlet || post.handle || 'Insider';
  const nextVisitSchool = parseNextVisitSchool(text);
  const classYear = parseClassYear(text) || 2027;
  const timestamp = post.publishedAt || new Date().toISOString();
  const slugBase = playerName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const day = timestamp.slice(0, 10);

  return {
    playerName,
    playerSlug: slugBase,
    on3Id: `beat_${slugBase}`,
    classYear,
    pos: '',
    eventType: 'visit_cancelled',
    status: 'OV Cancelled · Florida',
    cancelledSchool: 'Florida',
    nextVisitSchool,
    detail: text.replace(/\s+/g, ' ').slice(0, 280),
    timestamp,
    articleUrl: post.url || null,
    source: analystName,
    sourceHandle: post.handle || null,
    sourceType: 'beat',
    fingerprint: `visit_cancel_${slugBase}_${day}_${analystName.toLowerCase().replace(/\s+/g, '_')}`
  };
}

module.exports = {
  OV_CANCEL_PATTERNS,
  isVisitCancelPost,
  parseBeatPostForVisitChange
};
