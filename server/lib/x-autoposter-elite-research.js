/**
 * Multi-Source Elite Autoposter — research layer.
 * Pulls On3, intel DB, predictions, scouting, breakdowns, beat writers, articles, visit logs.
 */
const fs = require('fs');
const path = require('path');
const template = require('./x-autoposter-template');

const DATA_DIR = path.join(__dirname, '..', 'data');

function readJson(rel, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, rel), 'utf8'));
  } catch {
    return fallback;
  }
}

function daysAgo(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.round(ms / (24 * 3600 * 1000)));
}

function formatVisitWindow(intel) {
  if (intel.visitStart && intel.visitEnd) return `${intel.visitStart}–${intel.visitEnd}`;
  if (intel.visitStart) return intel.visitStart;
  return null;
}

const on3Recruit = require('./on3-recruit-client');

const RPM_CLOSE_GAP = parseFloat(process.env.X_AUTOPOST_RPM_CLOSE_GAP || '8', 10);
const UF_BOARD_MATCH = /florida|gators|\buf\b/i;

function teamNameFromOn3(team) {
  return String(team?.name || team?.fullName || team?.abbreviation || '').trim();
}

function competitorsFromPlayer(player, limit = 4) {
  const list = Array.isArray(player?.competitors) ? player.competitors : [];
  return list
    .map((c) => ({
      school: String(c?.school || c?.schoolName || c?.name || '').trim(),
      pct: c?.score != null ? Number(c.score) : c?.pct != null ? Number(c.pct) : null
    }))
    .filter((c) => c.school && !UF_BOARD_MATCH.test(c.school))
    .sort((a, b) => (Number(b.pct) || 0) - (Number(a.pct) || 0))
    .slice(0, limit);
}

function competitorsFromOn3TopTeams(topTeams, classYear, limit = 4) {
  return on3Recruit
    .getYearTopTeams(topTeams || [], classYear)
    .filter((t) => !on3Recruit.isHighSchoolOrg(t) && !on3Recruit.isFloridaTeam(t))
    .map((t) => ({
      school: teamNameFromOn3(t.team),
      pct: t.percent != null ? Number(t.percent) : t.prediction != null ? Number(t.prediction) : null
    }))
    .filter((c) => c.school)
    .sort((a, b) => (Number(b.pct) || 0) - (Number(a.pct) || 0))
    .slice(0, limit);
}

function ufPctFromPlayerBoard(player, predictions = []) {
  if (player?.ufProbability != null && Number(player.ufProbability) > 0) {
    return Number(player.ufProbability);
  }
  if (player?.ufRpmPct != null && Number(player.ufRpmPct) > 0) {
    return Number(player.ufRpmPct);
  }
  for (const p of predictions) {
    const v = p?.confidencePct ?? p?.ufRpmPct;
    if (v != null && Number(v) > 0) return Number(v);
  }
  return null;
}

function ufPctFromOn3TopTeams(topTeams, classYear) {
  const uf = on3Recruit.getFloridaTeam(topTeams || [], classYear);
  if (!uf) return null;
  const v = uf.percent != null ? Number(uf.percent) : uf.prediction != null ? Number(uf.prediction) : null;
  return v != null && Number.isFinite(v) ? v : null;
}

function resolveOn3Board(research = {}) {
  const player = research.player || {};
  const classYear = player.classYear || research.intel?.classYear || 2027;
  let competitors = competitorsFromPlayer(player);
  if (!competitors.length && research.on3TopTeams?.length) {
    competitors = competitorsFromOn3TopTeams(research.on3TopTeams, classYear);
  }
  if (!competitors.length) {
    const beatSources = [research.intel?.detail, ...(research.beatSnippets || [])].filter(Boolean);
    for (const snippet of beatSources) {
      competitors = competitorsFromBeatText(snippet);
      if (competitors.length) break;
    }
  }
  let ufPct = ufPctFromPlayerBoard(player, research.predictions);
  if ((ufPct == null || ufPct <= 0) && research.on3TopTeams?.length) {
    ufPct = ufPctFromOn3TopTeams(research.on3TopTeams, classYear);
  }
  return { competitors, ufPct, classYear };
}

function buildRpmAwareCompLine(research, { fallback = null } = {}) {
  const { competitors, ufPct } = resolveOn3Board(research);
  const leader = competitors[0];
  const second = competitors[1];
  const leaderPct = leader?.pct != null ? Math.round(leader.pct) : null;
  const secondPct = second?.pct != null ? Math.round(second.pct) : null;
  const ufRounded = ufPct != null ? Math.round(ufPct) : null;

  if (leader && ufRounded != null && leaderPct != null) {
    if (ufRounded >= leaderPct - RPM_CLOSE_GAP) {
      return second?.school
        ? `${second.school} is in, but Gainesville has the inside track.`
        : 'Florida sits in the lead group on the board.';
    }
    if (second?.school && secondPct != null && ufRounded >= secondPct - RPM_CLOSE_GAP) {
      return `${leader.school} leads On3 at ${leaderPct}% — UF second at ${ufRounded}%.`;
    }
    return `${leader.school} leads On3 at ${leaderPct}% — UF at ${ufRounded}% and pushing.`;
  }

  if (leader && second) {
    return `${leader.school} and ${second.school} top On3 — UF is active in the mix.`;
  }
  if (leader && leaderPct == null) {
    return `${leader.school} holds the On3 RPM edge — UF is pushing at the finish line.`;
  }
  if (leader) {
    return `${leader.school} leads On3 — UF staff is still pushing for movement.`;
  }

  return fallback || 'Staff contact has picked up as UF narrows the board.';
}

function isLikelyHighSchoolLocation(name, player) {
  const s = String(name || '').trim();
  if (!s) return true;
  if (/\b(high school|hs|prep|academy)\b/i.test(s)) return true;
  if (/^[A-Za-z .'-]+,\s*[A-Z]{2}$/.test(s)) return true;
  const school = String(player?.school || '').trim().toLowerCase();
  const hometown = String(player?.hometown || '').trim().toLowerCase();
  const key = s.toLowerCase();
  if (school && key === school) return true;
  if (hometown && (key === hometown || key.includes(hometown) || hometown.includes(key))) return true;
  return false;
}

function extractTopSchools(intelRows, player, limit = 4) {
  const fromOn3 = competitorsFromPlayer(player, limit);
  if (fromOn3.length) return fromOn3.map((c) => c.school);

  const schools = new Set();
  if (player?.committedTo) schools.add(player.committedTo);
  for (const row of intelRows) {
    if (row.predictionSchool) schools.add(row.predictionSchool);
    if (row.nextVisitSchool) schools.add(row.nextVisitSchool);
    if (row.cancelledSchool) schools.add(row.cancelledSchool);
  }
  return [...schools]
    .filter(Boolean)
    .filter((s) => !isLikelyHighSchoolLocation(s, player))
    .slice(0, limit);
}

function stripUrlsForBeatParse(text) {
  return String(text || '')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function rpmLeaderFromBeatText(text) {
  const m = String(text || '').match(/\b([A-Z][a-z]+(?:\s+State)?)\s+hold(?:s)?\s+the\s+edge\s+on\s+the\s+rpm\b/i);
  return m ? m[1].trim() : null;
}

function competitorsFromBeatText(text, limit = 4) {
  const leader = rpmLeaderFromBeatText(text);
  if (!leader) return [];
  return [{ school: leader, pct: null }].slice(0, limit);
}

function inferEventTypeFromText(text) {
  const t = stripUrlsForBeatParse(text);
  if (/decommit|decommitted|opened recruitment/i.test(t)) return 'decommit';
  if (/flip(?:ped)? to florida|flipped to uf/i.test(t)) return 'flip';
  if (
    /decision day|announcement (?:coming|at|today|this morning|this afternoon)|approaches a commitment decision|commits? at \d/i.test(
      t
    )
  ) {
    return 'decision_day';
  }
  if (/\bsurprised\b.*\bofficial visit\b/i.test(t) && /\b(florida|gators|\buf\b)/i.test(t)) return 'official_visit';
  if (/\b(?:committed|commits)\b.*\b(florida|gators|\buf\b)/i.test(t)) return 'commit';
  if (/cancel(?:led|s)?.*(?:ov|official visit).*(?:florida|gators|gainesville|\buf\b)/i.test(t)) return 'visit_cancelled';
  if (/\b(official visit|\bov\b).*?(?:florida|gators|gainesville|\buf\b)/i.test(t)) return 'official_visit';
  if (/\b(unofficial visit|\buv\b).*?(?:florida|gators|gainesville|\buf\b)/i.test(t)) return 'unofficial_visit';
  if (/\boffer(?:ed|s)?\b.*\b(florida|gators|\buf\b)/i.test(t)) return 'offer';
  if (/futurecast|prediction machine|\brpm\b|crystal ball/i.test(t) && /\b(florida|gators|\buf\b)/i.test(t)) return 'prediction';
  if (/\bportal\b/i.test(t) && /\b(florida|gators|\buf\b)/i.test(t)) return 'portal_in';
  if (/\bportal\b/i.test(t)) return 'portal_out';
  if (/\b(staff loves|coaches? (?:are )?pushing|in the mix|momentum|trending up|heating up)\b/i.test(t)) return 'trending';
  if (/\b(flip risk|could flip|watch list)\b/i.test(t)) return 'flip_risk';
  if (/\b(staff follow|followed by|coaching staff)\b/i.test(t)) return 'staff_push';
  return null;
}

function inferUfPosition(research) {
  const { intelRows, predictions, beatSnippets, eventType } = research;
  const conf = predictions.map((p) => p.confidencePct || p.ufRpmPct).filter((n) => n > 0);
  const maxConf = conf.length ? Math.max(...conf) : null;
  if (eventType === 'commit' || eventType === 'flip') return 'committed';
  if (eventType === 'decision_day') return 'in the mix';
  if (eventType === 'official_visit') return 'hosting OV';
  if (maxConf != null && maxConf >= 70) return 'leading';
  if (maxConf != null && maxConf >= 45) return 'in the mix';
  if (research.heatSignals.some((h) => h.trigger === 'staff_momentum')) return 'staff priority';
  if (/staff loves|pushing|priority|top group|short list/i.test(beatSnippets.join(' '))) return 'staff priority';
  if (eventType === 'offer') return 'offered';
  if (eventType === 'trending') return 'trending up';
  return 'tracking';
}

function inferEventType(research) {
  if (research.explicitNewsEvent) {
    const mapped = inferEventTypeFromText(research.explicitNewsEvent);
    if (mapped) return { type: mapped, confidence: 90, from: 'newsEvent' };
  }
  if (research.intel?.eventType) {
    return { type: research.intel.eventType, confidence: 88, from: 'intel' };
  }
  for (const row of research.intelRows) {
    if (row.eventType && row.eventType !== 'trending') {
      return { type: row.eventType, confidence: 82, from: 'intel_db' };
    }
  }
  const fromText = inferEventTypeFromText(research.combinedText);
  if (fromText) return { type: fromText, confidence: 75, from: 'text' };
  if (research.predictions.length) return { type: 'prediction', confidence: 70, from: 'predictions' };
  if (research.intelRows.some((r) => /visit/i.test(r.eventType || ''))) {
    return { type: 'official_visit', confidence: 65, from: 'visit_log' };
  }
  if (research.beatSnippets.length) return { type: 'trending', confidence: 55, from: 'beat' };
  return { type: 'update', confidence: 40, from: 'fallback' };
}

async function loadPlayerRecord(slug, name) {
  const store = require('./recruiting-store');
  if (slug) {
    const p = await store.getPlayerBySlug(slug);
    if (p) return p;
  }
  if (name) {
    const all = await store.getAllPlayers();
    const key = String(name).toLowerCase();
    return all.find((p) => String(p.name || '').toLowerCase() === key) || null;
  }
  return null;
}

function loadIntelForPlayer(playerId, slug, name, limit = 12) {
  const intelStore = require('./recruiting-intel-store');
  const items = intelStore.listIntel({ limit: 200 });
  const slugKey = slug ? String(slug).toLowerCase() : '';
  const nameKey = name ? String(name).toLowerCase() : '';
  return items
    .filter((i) => {
      if (playerId && i.playerId === playerId) return true;
      if (slugKey && String(i.playerSlug || '').toLowerCase() === slugKey) return true;
      if (nameKey && String(i.playerName || '').toLowerCase() === nameKey) return true;
      return false;
    })
    .slice(0, limit);
}

function loadPredictionsForPlayer(slug, name, intelRows) {
  const preds = [];
  for (const row of intelRows) {
    if (row.eventType === 'prediction' || row.eventType === 'rivals_futurecast') {
      preds.push({
        source: row.source || row.analystName || 'Analyst',
        confidencePct: row.confidencePct,
        ufRpmPct: row.ufRpmPct,
        detail: row.detail,
        analystName: row.analystName,
        reportedAt: row.reportedAt
      });
    }
  }
  const rivalsDoc = readJson('war-room/rivals-predictions.json', { picks: [] });
  const picks = rivalsDoc.picks || rivalsDoc.items || [];
  const key = name ? String(name).toLowerCase() : '';
  for (const pick of picks) {
    const pn = String(pick.playerName || pick.name || '').toLowerCase();
    if (key && pn === key) {
      preds.push({
        source: 'Rivals PM',
        confidencePct: pick.confidence || pick.percent,
        ufRpmPct: pick.ufPct || pick.ufRpm,
        detail: pick.note || pick.summary,
        analystName: pick.analyst || 'Rivals',
        reportedAt: pick.updatedAt || pick.date
      });
    }
  }
  return preds;
}

function loadBeatMentions(name, limit = 5) {
  if (!name) return [];
  try {
    const liveBeat = require('./live-beat');
    const posts = liveBeat.getBeatPosts(80) || [];
    const key = String(name).toLowerCase();
    return posts
      .filter((p) => String(p.text || '').toLowerCase().includes(key))
      .slice(0, limit)
      .map((p) => ({
        label: p.writerName || p.outlet || p.handle || 'Beat',
        text: template.stripEmojisHashtags(p.text),
        url: p.url || p.link,
        at: p.publishedAt || p.fetchedAt
      }));
  } catch {
    return [];
  }
}

function loadArticleBody(article) {
  if (!article) return { headline: '', body: '', source: null };
  const headline = article.title || article.headline || '';
  const body = [article.summary, article.excerpt, article.body, article.dek]
    .filter(Boolean)
    .join(' ')
    .trim();
  const source =
    (Array.isArray(article.sources) && article.sources[0]?.label) ||
    article.author ||
    article.source ||
    'GatorVault';
  return { headline, body, source };
}

function loadScouting(slug) {
  if (!slug) return null;
  try {
    return require('./scouting-database').getEntryBySlug(slug) || null;
  } catch {
    return null;
  }
}

function loadHeatCheckSignals(slug) {
  if (!slug) return [];
  const doc = readJson('recruiting/heat-check-history.json', { history: {} });
  const rows = doc.history?.[slug] || [];
  return rows.slice(0, 6).map((r) => ({
    direction: r.direction,
    trigger: r.trigger,
    predictionSchool: r.predictionSchool,
    insider: r.insider,
    recordedAt: r.recordedAt
  }));
}

function loadHayesFawcettMentions(name, limit = 3) {
  if (!name) return [];
  try {
    const beatFilters = require('./beat-writer-filters');
    const liveBeat = require('./live-beat');
    const posts = liveBeat.getBeatPosts(120) || [];
    const key = String(name).toLowerCase();
    return posts
      .filter((p) => beatFilters.isHayesFawcettPost(p) && String(p.text || '').toLowerCase().includes(key))
      .slice(0, limit)
      .map((p) => ({
        label: 'Hayes Fawcett',
        text: template.stripEmojisHashtags(p.text),
        url: p.url || p.link,
        at: p.publishedAt || p.fetchedAt
      }));
  } catch {
    return [];
  }
}

function load247Context(player) {
  if (!player?.recruit247Id && !player?.rivals247Id) return null;
  const id = player.recruit247Id || player.rivals247Id;
  const slug = player.slug || '';
  const url = slug
    ? `https://247sports.com/player/${slug}-${id}/`
    : `https://247sports.com/player/${id}/`;
  return { recruit247Id: String(id), url, label: '247Sports' };
}

function loadBreakdown(slug) {
  if (!slug) return null;
  try {
    const b = require('./war-room-store').getBreakdownBySlug(slug);
    return b?.verified ? b : null;
  } catch {
    return null;
  }
}

function extractPlayerNameFromText(text) {
  try {
    const copy = require('./x-autoposter-copy');
    return copy.extractPlayerFromText(text);
  } catch {
    return null;
  }
}

async function researchUpdate(input = {}) {
  const {
    headline = '',
    body = '',
    beatText = null,
    playerSlug = null,
    playerName = null,
    intel = null,
    article = null,
    sourceLabel = null,
    newsEvent = null,
    rewriteMetrics = null
  } = input;

  const articleBits = loadArticleBody(article);
  const combinedText = template.stripEmojisHashtags(
    [headline, body, beatText, articleBits.headline, articleBits.body, intel?.detail]
      .filter(Boolean)
      .join(' ')
  );

  const player = await loadPlayerRecord(playerSlug || intel?.playerSlug, playerName || intel?.playerName);
  const resolvedSlug = player?.slug || playerSlug || intel?.playerSlug || null;
  let on3TopTeams = player?.on3TopTeams || null;
  if (
    !on3TopTeams?.length &&
    player?.on3Slug &&
    process.env.X_AUTOPOST_ON3_LIVE_BOARD === 'true'
  ) {
    try {
      const on3Recruit = require('./on3-recruit-client');
      const slug = String(player.on3Slug).replace(/^\//, '');
      const profile = await on3Recruit.fetchRecruitProfile(slug, player.classYear || intel?.classYear || 2028);
      if (profile?.topTeams?.length) on3TopTeams = profile.topTeams;
    } catch {
      /* optional live On3 pull */
    }
  }

  let resolvedName = player?.name || playerName || intel?.playerName || null;
  if (!resolvedName && combinedText.length >= 20) {
    resolvedName = extractPlayerNameFromText(combinedText);
  }
  const playerId = player?.on3Id || player?.id || intel?.playerId || null;

  const intelRows = loadIntelForPlayer(playerId, resolvedSlug, resolvedName);
  const predictions = loadPredictionsForPlayer(resolvedSlug, resolvedName, intelRows);
  const beatMentions = loadBeatMentions(resolvedName);
  const hayesMentions = loadHayesFawcettMentions(resolvedName);
  const heatSignals = loadHeatCheckSignals(resolvedSlug);
  const scouting = loadScouting(resolvedSlug);
  const breakdown = loadBreakdown(resolvedSlug);
  const profile247 = load247Context(player);

  const sourcesUsed = [];
  const addSource = (id, label, snippet, url) => {
    if (!label) return;
    sourcesUsed.push({ id, label, snippet: String(snippet || '').slice(0, 160), url: url || null });
  };

  if (articleBits.headline) addSource('article', articleBits.source, articleBits.headline, article?.url);
  if (beatText) addSource('beat', sourceLabel || 'Beat writer', beatText.slice(0, 160));
  if (intel?.detail) addSource('intel', intel.source || 'Intel DB', intel.detail);
  for (const row of intelRows.slice(0, 4)) {
    addSource(`intel:${row.eventType}`, row.source || 'Intel', row.detail || row.status);
  }
  for (const p of predictions.slice(0, 2)) {
    addSource('prediction', p.source, p.detail || `${p.confidencePct || p.ufRpmPct}% UF`);
  }
  if (scouting?.scoutingSummary) addSource('scouting', scouting.analystName || 'Scouting DB', scouting.scoutingSummary.slice(0, 120));
  if (breakdown?.recruitingStory) addSource('war-room', breakdown.sources?.[0]?.writer || 'War Room', breakdown.recruitingStory.slice(0, 120));
  for (const bm of beatMentions.slice(0, 2)) {
    addSource('beat-archive', bm.label, bm.text.slice(0, 120), bm.url);
  }
  for (const hm of hayesMentions.slice(0, 2)) {
    addSource('hayes-fawcett', 'Hayes Fawcett', hm.text.slice(0, 120), hm.url);
  }
  for (const hs of heatSignals.slice(0, 2)) {
    addSource('heat-check', hs.insider || 'Heat Check', `${hs.trigger}: ${hs.predictionSchool || hs.direction}`);
  }
  if (profile247) addSource('247', profile247.label, `247 profile #${profile247.recruit247Id}`, profile247.url);
  if (player?.natlRank) addSource('on3', 'On3', `Natl #${player.natlRank}`);

  const beatSnippets = [
    beatText,
    ...hayesMentions.map((b) => b.text),
    ...beatMentions.map((b) => b.text),
    ...template.extractSentences(combinedText).slice(0, 6)
  ].filter(Boolean);

  const research = {
    player,
    playerSlug: resolvedSlug,
    playerName: resolvedName,
    on3TopTeams,
    intel,
    intelRows,
    predictions,
    beatMentions,
    hayesMentions,
    heatSignals,
    profile247,
    beatSnippets,
    scouting,
    breakdown,
    article: articleBits,
    combinedText,
    explicitNewsEvent: newsEvent,
    primarySource: sourceLabel || articleBits.source || intel?.source || beatMentions[0]?.label || 'On3',
    topSchools: extractTopSchools(intelRows, player),
    timing: {
      articleAgeDays: daysAgo(article?.publishedAt || article?.date),
      latestIntelDays: daysAgo(intelRows[0]?.reportedAt),
      visitWindow: formatVisitWindow(intelRows.find((r) => /visit/i.test(r.eventType || '')) || {})
    },
    sourcesUsed,
    rewriteMetrics: rewriteMetrics || intel?.rewriteMetrics || null
  };

  const inferred = inferEventType(research);
  research.eventType = inferred.type;
  research.eventTypeConfidence = inferred.confidence;
  research.eventTypeSource = inferred.from;
  research.ufPosition = inferUfPosition(research);

  const signalCount =
    sourcesUsed.length +
    (combinedText.length >= 40 ? 1 : 0) +
    (player ? 1 : 0) +
    intelRows.length;

  research.hasUsableSignal = signalCount >= 1 && (resolvedName || combinedText.length >= 30);

  return research;
}

module.exports = {
  researchUpdate,
  inferEventType,
  inferEventTypeFromText,
  inferUfPosition,
  extractTopSchools,
  buildRpmAwareCompLine,
  resolveOn3Board,
  competitorsFromPlayer,
  rpmLeaderFromBeatText,
  competitorsFromBeatText
};
