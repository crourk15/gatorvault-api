/**
 * UF Official discovery — any FloridaGators.com football news (broad capture).
 * Sources: football RSS + /sports/football page. Non-football sports excluded.
 */
const path = require('path');
const fetch = require('node-fetch');
const { parseRssItems } = require('../rss-parse');
const { intelFingerprint } = require('../commit-fingerprint');
const { DATA_DIR, readJson, writeJson, fpHash, stripHtml, newsCandidateFromBuilt } = require('./discovery-core');
const UF_OFFICIAL_SNAPSHOT_PATH = path.join(DATA_DIR, 'uf-official-news-snapshot.json');
const UF_FOOTBALL_RSS = process.env.X_AUTOPOST_UF_OFFICIAL_RSS || 'https://floridagators.com/rss.aspx?path=football';
const UF_FOOTBALL_NEWS_PAGE = process.env.X_AUTOPOST_UF_OFFICIAL_PAGE || 'https://floridagators.com/sports/football';
const NON_FOOTBALL_SPORT_RES = [
  /\b(basketball|baseball|softball|soccer|volleyball|gymnastics|track and field|swimming|tennis|lacrosse|wrestling|gator basketball)\b/i,
  /\/(basketball|baseball|softball|soccer|volleyball|gymnastics|track-and-field|swimming|tennis|lacrosse|wrestling)-/i
];
const FOOTBALL_SIGNAL_RES = [
  /\/football[-/]|path=football|\/sports\/football/i,
  /\b(football|gatorsfb|the swamp|sec football|quarterback|running back|wide receiver|touchdown|spring game|depth chart|coordinator|offensive line|defensive line|hall of fame|hof|recruiting|roster|spring practice|media day|game day|orange and blue)\b/i
];
function slugToTitle(slug) {
  return String(slug || '').split('-').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}
function isUfOfficialFootballItem(item) {
  if (process.env.X_AUTOPOST_UF_OFFICIAL_FOOTBALL_ONLY === 'false') return true;
  if (item?._fromFootballPage || item?._fromFootballRss) return true;
  const link = String(item?.link || '').toLowerCase();
  const title = String(item?.title || '').toLowerCase();
  const summary = String(item?.summary || item?.description || '').toLowerCase();
  const combined = `${link} ${title} ${summary}`;
  if (NON_FOOTBALL_SPORT_RES.some((re) => re.test(combined))) return false;
  return FOOTBALL_SIGNAL_RES.some((re) => re.test(combined));
}
function parseNewsDateFromPath(link) {
  const m = String(link || '').match(/\/news\/(\d{4})\/(\d{1,2})\/(\d{1,2})\//);
  if (!m) return new Date().toISOString();
  const iso = `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}T12:00:00.000Z`;
  const ts = new Date(iso).getTime();
  return Number.isFinite(ts) ? new Date(ts).toISOString() : new Date().toISOString();
}
async function fetchUfOfficialHtmlItems(limit = 12) {
  const res = await fetch(UF_FOOTBALL_NEWS_PAGE, { timeout: 20000, headers: { 'User-Agent': 'GatorVaultAutoposter/1.0', Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' } });
  if (!res.ok) throw new Error('UF news page HTTP ' + res.status);
  const html = await res.text();
  const items = [];
  const seen = new Set();
  const blockRe = /<article[^>]*class="[^"]*c-stories__item[^"]*"[\s\S]*?<\/article>/gi;
  const blocks = html.match(blockRe) || [];
  for (const block of blocks) {
    if (items.length >= limit) break;
    const linkMatch = block.match(/href="(\/news\/[^"]+)"/i);
    if (!linkMatch) continue;
    const link = linkMatch[1].startsWith('http') ? linkMatch[1] : `https://floridagators.com${linkMatch[1]}`;
    if (seen.has(link)) continue;
    seen.add(link);
    const titleMatch = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i) || block.match(/<a[^>]+class="[^"]*c-stories__headline[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    const title = stripHtml(titleMatch?.[1] || slugToTitle(link.split('/').pop()));
    if (!title) continue;
    items.push({ title, link, summary: '', pubDate: parseNewsDateFromPath(link), _fromFootballPage: true });
  }
  if (items.length) return items;
  const linkRe = /href="(\/news\/\d{4}\/\d{1,2}\/\d{1,2}\/[^"]+)"/gi;
  let match;
  while ((match = linkRe.exec(html)) && items.length < limit) {
    const link = `https://floridagators.com${match[1]}`;
    if (seen.has(link)) continue;
    seen.add(link);
    items.push({ title: slugToTitle(match[1].split('/').pop()), link, summary: '', pubDate: parseNewsDateFromPath(link), _fromFootballPage: true });
  }
  return items;
}
async function fetchUfOfficialRssItems(limit = 12) {
  const res = await fetch(UF_FOOTBALL_RSS, { timeout: 20000, headers: { 'User-Agent': 'GatorVaultAutoposter/1.0', Accept: 'application/rss+xml, application/xml, text/xml, */*' } });
  if (!res.ok) throw new Error('UF RSS HTTP ' + res.status);
  const xml = await res.text();
  if (!xml || !xml.trim()) return [];
  return parseRssItems(xml, limit).map((row) => ({ ...row, _fromFootballRss: true }));
}
async function fetchUfOfficialNewsItems(limit = 12) {
  let items = [];
  try { items = await fetchUfOfficialRssItems(limit); } catch (err) { console.warn('[discovery] UF official RSS failed:', err.message); }
  if (!items.length) {
    try { items = await fetchUfOfficialHtmlItems(limit); } catch (err) { console.warn('[discovery] UF official HTML fallback failed:', err.message); }
  }
  return items;
}
async function buildCandidateFromUfOfficialItem(item) {
  const { decodeEntities } = require('../rss-parse');
  const title = decodeEntities(stripHtml(item.title));
  const summary = decodeEntities(stripHtml(item.summary || item.description || ''));
  if (!title) return null;
  const beatText = summary ? (title + ' — ' + summary).slice(0, 280) : title;
  const synthetic = { handle: 'GatorsFB', writerName: 'Florida Gators', outlet: 'UF Official', text: beatText, publishedAt: item.pubDate || item.published || new Date().toISOString(), url: item.link || 'https://floridagators.com/sports/football' };
  const copy = require('../x-autoposter-copy');
  const prefilter = require('../beat-intel-prefilter');
  const combined = title + ' ' + summary;
  const teamEventType = prefilter.classifyTeamEventType(combined);
  const programNewsType = prefilter.classifyProgramNewsType(combined) || 'program_update';
  let built = null;
  if (teamEventType) {
    built = await copy.buildTeamEventCopyAsync(synthetic, { triggerType: 'team_event', teamEventType });
  } else {
    built = await copy.buildProgramNewsCopyAsync(synthetic, { triggerType: 'program_news', programNewsType });
  }
  if (!built?.text || built.skipReason) return null;
  const isProgram = built.triggerType === 'program_news' || teamEventType == null;
  return newsCandidateFromBuilt(built, { topic: isProgram ? 'program' : 'team', urgencyLabel: isProgram ? 'breaking' : 'major_beat', postUrgency: isProgram ? 'breaking' : null, triggerType: isProgram ? 'program_news' : 'team_event', programNewsType: isProgram ? programNewsType : null, teamEventType: isProgram ? null : teamEventType, sourceEventType: isProgram ? 'program_news' : 'team_event', sources: [{ label: 'Florida Gators', url: synthetic.url }], source: 'auto:uf-official-news', intelFingerprint: intelFingerprint(item.link || title, 'uf_official_news', synthetic.publishedAt), sourceEventCreatedAt: synthetic.publishedAt, sourcePublishedAt: synthetic.publishedAt, identityConfirmed: true, validationMeta: { programNews: true, ufOfficialFootball: true, eliteCompose: true, officialHeadline: title } });
}
async function collectUfOfficialNewsCandidates({ forcePost = false, limit } = {}) {
  if (process.env.X_AUTOPOST_UF_OFFICIAL_NEWS === 'false') return [];
  const maxItems = limit || parseInt(process.env.X_AUTOPOST_UF_OFFICIAL_LIMIT || (forcePost ? '12' : '8'), 10);
  const snapshot = readJson(UF_OFFICIAL_SNAPSHOT_PATH, { fingerprints: {} });
  let items = [];
  try { items = await fetchUfOfficialNewsItems(maxItems); } catch (err) { console.warn('[discovery] UF official news failed:', err.message); return []; }
  const candidates = [];
  for (const item of items) {
    if (!isUfOfficialFootballItem(item)) continue;
    const hash = fpHash(item.link || item.title);
    if (!forcePost && snapshot.fingerprints[hash]) continue;
    const row = await buildCandidateFromUfOfficialItem(item);
    if (row) { candidates.push(row); snapshot.fingerprints[hash] = new Date().toISOString(); }
  }
  if (candidates.length) { snapshot.lastRun = new Date().toISOString(); writeJson(UF_OFFICIAL_SNAPSHOT_PATH, snapshot); }
  return candidates;
}
module.exports = { UF_OFFICIAL_SNAPSHOT_PATH, isUfOfficialFootballItem, fetchUfOfficialNewsItems, collectUfOfficialNewsCandidates };
