/**
 * Parse Rivals FutureCast / Prediction Machine signals from beat-writer posts.
 */
const beatFilters = require('./beat-writer-filters');

const RIVALS_PREDICTION_KEYWORDS = [
  /futurecast/i,
  /prediction machine/i,
  /prediction logged/i,
  /expert pick/i,
  /\bforecast\b/i,
  /pick in favor of florida/i,
  /pick in favor of uf/i,
  /florida trending/i
];

function isRivalsPredictionPost(text) {
  const t = String(text || '');
  return RIVALS_PREDICTION_KEYWORDS.some((re) => re.test(t));
}

function parseConfidence(text) {
  const m = String(text || '').match(/(\d{1,3})\s*%\s*(?:confidence|conf|pick)?/i);
  if (m) return Math.min(100, parseInt(m[1], 10));
  return null;
}

function parseClassYear(text) {
  const m = String(text || '').match(/\b(202[6-9]|2030)\b/);
  return m ? parseInt(m[1], 10) : null;
}

function parseAnalystName(post) {
  return post.writerName || post.outlet || post.handle || 'Rivals analyst';
}

/** Beat post → normalized prediction row (UF only). */
function parseBeatPostForPrediction(post) {
  const text = String(post.text || '').trim();
  if (!text || !isRivalsPredictionPost(text)) return null;
  if (!beatFilters.shouldIncludeBeatPost(post)) return null;
  if (!beatFilters.isFloridaRelatedPost(post)) return null;

  const playerName = beatFilters.extractPlayerFromText(text);
  if (!playerName) return null;

  const classYear = parseClassYear(text) || 2027;
  const analystName = parseAnalystName(post);
  const confidence = parseConfidence(text);
  const timestamp = post.publishedAt || new Date().toISOString();
  const slugBase = playerName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return {
    pickKey: null,
    playerName,
    playerSlug: slugBase,
    on3Id: `beat_${slugBase}`,
    classYear,
    pos: '',
    school: '',
    analystName,
    confidence,
    timestamp,
    articleUrl: post.url || null,
    predictionSchool: 'Florida Gators',
    source: `Rivals beat · ${analystName}`,
    sourceType: 'beat',
    fingerprint: `rivals_beat_${slugBase}_${analystName.toLowerCase().replace(/\s+/g, '_')}_${timestamp.slice(0, 10)}`
  };
}

module.exports = {
  RIVALS_PREDICTION_KEYWORDS,
  isRivalsPredictionPost,
  parseBeatPostForPrediction
};
