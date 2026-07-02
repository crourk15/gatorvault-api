/** Phase 4 — ET time-bucket topic bias for daily posting rhythm. */
const TZ = process.env.X_AUTOPOST_NIGHT_TZ || 'America/New_York';
function timeBucketEnabled() { return process.env.X_AUTOPOST_TIME_BUCKETS !== 'false'; }
function getEstHour(date) {
  date = date || new Date();
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }).formatToParts(date);
    return parseInt(parts.find((p) => p.type === 'hour').value || '12', 10);
  } catch { return date.getUTCHours() - 5; }
}
function getTimeBucket(date) {
  const h = getEstHour(date);
  if (h >= 0 && h < 6) return 'night';
  if (h >= 6 && h < 10) return 'morning';
  if (h >= 10 && h < 18) return 'day';
  if (h >= 18 && h < 23) return 'evening';
  return 'night';
}
const BUCKET_BOOSTS = {
  morning: { program_news: -2, uf_official_news: -2, team_event: -2, roster_delta: -2, evergreen: -1 },
  day: { commitment: -2, portal: -2, beat_intel: -1, heat_mover: -2, scouting_update: -1, research_ladder: -1 },
  evening: { game_week: -2, article: -1, heat_mover: -1, recruiting_momentum: -1 },
  night: { commitment: -1, portal: -1 },
};
function classifyCandidateBucketTopic(raw) {
  if (raw && (raw.triggerType === 'program_news' || raw.programNewsType)) return 'program_news';
  if (raw && (raw.triggerType === 'team_event' || raw.teamEventType)) return 'team_event';
  if (raw && raw.source === 'auto:uf-official-news') return 'uf_official_news';
  if (raw && raw.source === 'auto:roster-delta') return 'roster_delta';
  if (raw && raw.source === 'auto:game-zone') return 'game_week';
  if (raw && raw.source === 'auto:scouting-update') return 'scouting_update';
  if (raw && raw.source === 'auto:heat-mover') return 'heat_mover';
  if (raw && raw.source === 'auto:evergreen') return 'evergreen';
  const et = String(raw && raw.sourceEventType || '').toLowerCase();
  if (/commit|flip/.test(et)) return 'commitment';
  if (/portal/.test(et)) return 'portal';
  if (et === 'recruiting_momentum') return 'recruiting_momentum';
  if (raw && (raw.source === 'auto:article' || et === 'article')) return 'article';
  if (String(raw && raw.source || '').includes('beat')) return 'beat_intel';
  return 'general';
}
function candidateTimeBucketBoost(raw, bucket) {
  if (!timeBucketEnabled()) return 0;
  const map = BUCKET_BOOSTS[bucket || getTimeBucket()] || {};
  return map[classifyCandidateBucketTopic(raw)] || 0;
}
module.exports = { timeBucketEnabled, getEstHour, getTimeBucket, classifyCandidateBucketTopic, candidateTimeBucketBoost };
