/** Phase 5 — UTM tagging + engagement-weighted candidate bias. */
const fs = require('fs');
const path = require('path');
const ENGAGEMENT_PATH = path.join(__dirname, '..', '..', 'data', 'x', 'autoposter-engagement.json');
function engagementEnabled() { return process.env.X_AUTOPOST_ENGAGEMENT_LOOP !== 'false'; }
function utmEnabled() { return process.env.X_AUTOPOST_UTM_ENABLED !== 'false'; }
const SOURCE_WEIGHTS = { 'auto:heat-mover': -1, 'auto:evergreen': -2, 'auto:program-history': 0, 'auto:research-ladder': 0, 'auto:beat-intel': -1, 'auto:uf-official-news': 0, 'auto:scouting-update': -1, commitment: -2, flip: -2, portal: -1 };
function readStore() { try { return JSON.parse(fs.readFileSync(ENGAGEMENT_PATH, 'utf8')); } catch { return { weights: {}, posts: [] }; } }
function writeStore(doc) { fs.mkdirSync(path.dirname(ENGAGEMENT_PATH), { recursive: true }); doc.updatedAt = new Date().toISOString(); fs.writeFileSync(ENGAGEMENT_PATH, JSON.stringify(doc, null, 2), 'utf8'); }
function appendAutopostUtm(url, item) {
  if (!url || !utmEnabled()) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('utm_source', 'twitter');
    u.searchParams.set('utm_medium', 'social');
    u.searchParams.set('utm_campaign', 'autopost');
    u.searchParams.set('utm_content', String(item && item.source || item && item.sourceEventType || 'news').slice(0, 64));
    if (item && item.tweetId) u.searchParams.set('utm_term', String(item.tweetId).slice(0, 32));
    return u.toString();
  } catch { return url; }
}
function tagPostText(text, item) {
  if (!text || !utmEnabled()) return text;
  const site = process.env.SITE_URL || 'https://gatorvaultinsider.com';
  const escaped = site.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(text).replace(new RegExp(escaped + '[^\\s]*', 'g'), (match) => appendAutopostUtm(match.split(/\s/)[0], item));
}
function defaultWeight(item) {
  const source = String(item && item.source || '');
  if (SOURCE_WEIGHTS[source] != null) return SOURCE_WEIGHTS[source];
  const et = String(item && item.sourceEventType || '').toLowerCase();
  if (SOURCE_WEIGHTS[et] != null) return SOURCE_WEIGHTS[et];
  return 0;
}
function candidateEngagementBoost(c) { if (!engagementEnabled()) return 0; return defaultWeight(c); }
function recordPostEngagement(item) {
  if (!engagementEnabled() || !item) return null;
  const row = { tweetId: item.tweetId || null, source: item.source || null, sourceEventType: item.sourceEventType || null, sentAt: item.sentAt || new Date().toISOString(), weight: defaultWeight(item) };
  const doc = readStore(); doc.posts = [row, ...(doc.posts || [])].slice(0, 200); writeStore(doc); return row;
}
function getEngagementSummary() { const doc = readStore(); return { enabled: engagementEnabled(), utmEnabled: utmEnabled(), recentPosts: (doc.posts || []).length }; }
module.exports = { engagementEnabled, utmEnabled, appendAutopostUtm, tagPostText, candidateEngagementBoost, recordPostEngagement, getEngagementSummary };
