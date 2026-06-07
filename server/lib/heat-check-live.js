const fs = require('fs');
const path = require('path');
const store = require('./recruiting-store');
const { getBeatPosts } = require('./live-beat');
const on3 = require('./on3-recruit-client');

const HISTORY_PATH = path.join(store.DATA_DIR, 'heat-check-history.json');
const CLASS_YEAR = parseInt(process.env.HEAT_CHECK_CLASS_YEAR || '2027', 10);
const MAX_PROFILES = parseInt(process.env.HEAT_CHECK_MAX_PROFILES || '35', 10);
const FETCH_CONCURRENCY = parseInt(process.env.HEAT_CHECK_CONCURRENCY || '6', 10);

const MAJOR_COMPETITORS = [
  'Georgia',
  'Alabama',
  'Florida State',
  'Tennessee',
  'Ole Miss',
  'Ohio State',
  'Texas',
  'LSU',
  'Auburn',
  'Miami',
  'Clemson',
  'Oklahoma'
];

const INSIDER_HANDLES = new Set([
  'corey_bender',
  'blake_alderman',
  'zachabolverdi',
  'stevewiltfong',
  'gatorsonline',
  'keithniebuhr'
]);

const TRIGGER_LABELS = {
  crystal_ball_uf: 'Crystal Ball → Florida',
  rpm_uf: 'On3 RPM → Florida',
  insider_prediction_uf: 'Insider prediction → Florida',
  visit_uf_leads: 'Visit intel · UF leads',
  staff_momentum: 'Staff momentum',
  decision_soon_uf: 'Decision window · UF trending',
  player_favorite_uf: 'Player favorite · Florida',
  prediction_other: 'Crystal Ball · other school',
  visit_shift_away: 'Visit shifted momentum',
  insider_slipping: 'Insider intel · UF slipping',
  competitor_offer: 'Major competitor offer'
};

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function loadHistory() {
  const legacy = readJson(path.join(store.DATA_DIR, 'heat-predictions.json'), null);
  const hist = readJson(HISTORY_PATH, { history: {} });
  if (legacy?.history && !Object.keys(hist.history || {}).length) {
    hist.history = legacy.history;
    saveHistory(hist);
  }
  return hist;
}

function saveHistory(data) {
  writeJson(HISTORY_PATH, data);
}

function fmtPct(n) {
  return typeof n === 'number' && !Number.isNaN(n) ? n.toFixed(1) : '—';
}

function normalizeNameKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function buildVisitIndex(visits) {
  const byName = new Map();
  const slugs = new Set();
  for (const v of visits) {
    const slug = v.player?.slug;
    if (slug) slugs.add(slug);
    const key = normalizeNameKey(v.player?.fullName);
    if (key && slug) byName.set(key, slug);
  }
  return { byName, slugs: [...slugs] };
}

async function discoverRecruitSlugs(classYear) {
  const visits = await on3.fetchTeamVisits(classYear);
  const { byName, slugs } = buildVisitIndex(visits);

  const board = await store.getBoard(classYear);
  for (const t of board.targets || []) {
    const slug = on3.resolveRecruitSlug(t, byName);
    if (slug) slugs.push(slug);
  }

  const unique = [...new Set(slugs.filter(Boolean))];
  const prioritized = unique.slice(0, MAX_PROFILES);
  return { slugs: prioritized, visitCount: visits.length };
}

function parseBeatIntel(beatPosts) {
  const intel = [];
  for (const post of beatPosts || []) {
    const handle = String(post.handle || '').toLowerCase();
    if (!INSIDER_HANDLES.has(handle)) continue;
    const text = String(post.text || '');
    const lower = text.toLowerCase();
    const insider = post.writerName || post.handle;

    if (/slipping|losing|cooling|concern|long shot|behind|trail/.test(lower) && /florida|gators|\buf\b/.test(lower)) {
      intel.push({ type: 'cooling', insider, text, url: post.url, publishedAt: post.publishedAt });
    }
    if (/trending|lead|favorite|momentum|flip|commit soon|decision|visiting|official/.test(lower) && /florida|gators|\buf\b/.test(lower)) {
      intel.push({ type: 'rising', insider, text, url: post.url, publishedAt: post.publishedAt });
    }
    if (/crystal ball|prediction|rpm|247|wiltfong|bender|alderman/.test(lower)) {
      intel.push({ type: 'prediction', insider, text, url: post.url, publishedAt: post.publishedAt });
    }
  }
  return intel;
}

function matchBeatForPlayer(name, beatIntel) {
  const parts = String(name || '').toLowerCase().split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1];
  if (!last || last.length < 3) return [];
  return beatIntel.filter((b) => b.text.toLowerCase().includes(last) && parts.some((p) => b.text.toLowerCase().includes(p)));
}

function analyzeProfile(profile, beatMatches) {
  if (!profile || profile.error) return { excluded: true, reason: 'fetch_error' };

  const classYear = profile.classYear || CLASS_YEAR;
  const commit = on3.getCollegeCommit(profile.topTeams, classYear);
  if (commit) {
    return {
      excluded: true,
      reason: 'committed',
      committedTo: commit.team?.name || commit.team?.fullName,
      committedDate: commit.committedDate
    };
  }

  const uf = on3.getFloridaTeam(profile.topTeams, classYear);
  if (!uf) return { excluded: true, reason: 'no_uf_interest' };

  const teams = on3
    .getYearTopTeams(profile.topTeams, classYear)
    .filter((t) => typeof t.prediction === 'number' && t.prediction > 0)
    .sort((a, b) => b.prediction - a.prediction);

  const leader = teams[0];
  const ufLeads = leader && on3.isFloridaTeam(leader);
  const ufPct = uf.prediction;
  const leaderName = leader?.team?.name || leader?.team?.fullName || '';
  const leaderPct = leader?.prediction;

  const visitTs = uf.latestVisit?.dateOccurred;
  const recentVisit =
    visitTs != null && Date.now() / 1000 - visitTs < 21 * 86400;

  const signals = [];
  const playerSlug = profile.slug || on3.slugify(profile.name);

  if (ufLeads && ufPct >= 12) {
    signals.push({
      playerSlug,
      playerName: profile.name,
      pos: profile.pos,
      classYear,
      direction: 'rising',
      trigger: 'rpm_uf',
      predictionType: 'rpm',
      predictionSchool: 'Florida',
      source: 'on3',
      insider: 'On3 RPM',
      headline: `${profile.name} — Florida leads On3 RPM`,
      detail: `On3 Recruiting Prediction Machine: Florida ${fmtPct(ufPct)}% · next closest ${teams[1]?.team?.name || 'field'} ${fmtPct(teams[1]?.prediction)}%`,
      recordedAt: profile.fetchedAt
    });
  }

  if (recentVisit && (ufLeads || (teams[1] && on3.isFloridaTeam(teams[1])))) {
    signals.push({
      playerSlug,
      playerName: profile.name,
      pos: profile.pos,
      classYear,
      direction: 'rising',
      trigger: 'visit_uf_leads',
      predictionType: 'visit',
      predictionSchool: 'Florida',
      source: 'on3',
      insider: 'On3',
      headline: `UF visit on the board — ${profile.name}`,
      detail: `Recent Florida visit logged on On3 · RPM ${fmtPct(ufPct)}% · ${uf.officialVisitCount || 0} official / ${uf.unOfficialVisitCount || 0} unofficial`,
      recordedAt: profile.fetchedAt
    });
  }

  if (uf.classRank != null && uf.classRank <= 6 && ufPct >= 18) {
    signals.push({
      playerSlug,
      playerName: profile.name,
      pos: profile.pos,
      classYear,
      direction: 'rising',
      trigger: 'decision_soon_uf',
      predictionType: 'rpm',
      predictionSchool: 'Florida',
      source: 'on3',
      insider: 'On3',
      headline: `UF class priority — ${profile.name}`,
      detail: `Florida class rank #${uf.classRank} on On3 board · ${fmtPct(ufPct)}% RPM`,
      recordedAt: profile.fetchedAt
    });
  }

  if (!ufLeads && leader && !on3.isFloridaTeam(leader)) {
    const isMajor = MAJOR_COMPETITORS.some((c) => leaderName.includes(c));
    signals.push({
      playerSlug,
      playerName: profile.name,
      pos: profile.pos,
      classYear,
      direction: 'cooling',
      trigger: isMajor ? 'competitor_offer' : 'prediction_other',
      predictionType: 'rpm',
      predictionSchool: leaderName,
      source: 'on3',
      insider: 'On3 RPM',
      headline: `${leaderName} leads — ${profile.name}`,
      detail: `${leaderName} ${fmtPct(leaderPct)}% On3 RPM · Florida ${fmtPct(ufPct)}%`,
      recordedAt: profile.fetchedAt
    });
  }

  for (const beat of beatMatches) {
    if (beat.type === 'rising' || beat.type === 'prediction') {
      signals.push({
        playerSlug,
        playerName: profile.name,
        pos: profile.pos,
        classYear,
        direction: 'rising',
        trigger: beat.type === 'prediction' ? 'insider_prediction_uf' : 'staff_momentum',
        predictionType: 'insider',
        predictionSchool: 'Florida',
        source: 'gators_online',
        insider: beat.insider,
        headline: `Insider momentum — ${profile.name}`,
        detail: String(beat.text).slice(0, 220),
        recordedAt: beat.publishedAt || profile.fetchedAt
      });
    }
    if (beat.type === 'cooling') {
      signals.push({
        playerSlug,
        playerName: profile.name,
        pos: profile.pos,
        classYear,
        direction: 'cooling',
        trigger: 'insider_slipping',
        predictionType: 'insider',
        predictionSchool: leaderName || 'Field',
        source: 'gators_online',
        insider: beat.insider,
        headline: `UF slipping — ${profile.name}`,
        detail: String(beat.text).slice(0, 220),
        recordedAt: beat.publishedAt || profile.fetchedAt
      });
    }
  }

  const deduped = [];
  const seen = new Set();
  for (const s of signals) {
    const key = `${s.direction}:${s.trigger}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(s);
  }

  if (!deduped.length) return { excluded: true, reason: 'no_momentum' };

  return { excluded: false, signals: deduped };
}

function appendHistory(historyDoc, signal) {
  if (!signal.playerSlug) return;
  historyDoc.history = historyDoc.history || {};
  const list = historyDoc.history[signal.playerSlug] || [];
  const last = list[list.length - 1];
  const changed =
    !last ||
    last.direction !== signal.direction ||
    last.trigger !== signal.trigger ||
    last.predictionSchool !== signal.predictionSchool;
  if (!changed) return;
  list.push({
    direction: signal.direction,
    trigger: signal.trigger,
    predictionSchool: signal.predictionSchool || null,
    insider: signal.insider || null,
    recordedAt: signal.recordedAt || new Date().toISOString()
  });
  historyDoc.history[signal.playerSlug] = list.slice(-12);
}

function enrichWithHistory(signal, historyDoc) {
  const history = historyDoc.history?.[signal.playerSlug] || [];
  const movement =
    history.length >= 2 && history[history.length - 1].direction !== history[history.length - 2].direction
      ? history[history.length - 1].direction === 'rising'
        ? 'Moved to RISING'
        : 'Moved to COOLING'
      : null;
  const prior = history.length > 1 ? history[history.length - 2] : null;

  return {
    ...signal,
    triggerLabel: TRIGGER_LABELS[signal.trigger] || signal.trigger,
    movement,
    priorDirection: prior ? prior.direction : null,
    priorTriggerLabel: prior ? TRIGGER_LABELS[prior.trigger] || prior.trigger : null
  };
}

function consolidateByPlayer(items) {
  const map = new Map();
  for (const item of items) {
    const key = `${item.playerSlug}:${item.direction}`;
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()];
}

async function buildLiveHeatCheck() {
  const started = Date.now();
  const historyDoc = loadHistory();
  const beat = getBeatPosts(60);
  const beatIntel = parseBeatIntel(beat.posts);

  let discovery = { slugs: [], visitCount: 0 };
  let errors = [];

  try {
    discovery = await discoverRecruitSlugs(CLASS_YEAR);
  } catch (e) {
    errors.push({ stage: 'visits', error: e.message });
  }

  const profiles = await on3.mapPool(discovery.slugs, FETCH_CONCURRENCY, async (slug) => {
    try {
      return await on3.fetchRecruitProfile(slug);
    } catch (e) {
      errors.push({ slug, error: e.message });
      return null;
    }
  });

  let rising = [];
  let cooling = [];
  let excludedCommitted = 0;

  for (const profile of profiles) {
    if (!profile) continue;
    const beatMatches = matchBeatForPlayer(profile.name, beatIntel);
    const result = analyzeProfile(profile, beatMatches);
    if (result.excluded) {
      if (result.reason === 'committed') excludedCommitted += 1;
      continue;
    }
    for (const signal of result.signals) {
      appendHistory(historyDoc, signal);
      const item = enrichWithHistory(signal, historyDoc);
      if (item.direction === 'rising') rising.push(item);
      else cooling.push(item);
    }
  }

  historyDoc.updatedAt = new Date().toISOString();
  saveHistory(historyDoc);

  rising.sort((a, b) => new Date(b.recordedAt || 0) - new Date(a.recordedAt || 0));
  cooling.sort((a, b) => new Date(b.recordedAt || 0) - new Date(a.recordedAt || 0));

  rising = consolidateByPlayer(rising);
  cooling = consolidateByPlayer(cooling);

  return {
    ok: true,
    tier: 'war',
    live: true,
    sources: ['on3', 'gators_online', '247_via_on3_rpm'],
    rising,
    cooling,
    updatedAt: new Date().toISOString(),
    meta: {
      classYear: CLASS_YEAR,
      profilesFetched: profiles.filter(Boolean).length,
      visitCandidates: discovery.visitCount,
      slugsDiscovered: discovery.slugs.length,
      excludedCommitted,
      beatPostsScanned: (beat.posts || []).length,
      fetchMs: Date.now() - started,
      errors: errors.slice(0, 5)
    },
    counts: { rising: rising.length, cooling: cooling.length }
  };
}

module.exports = {
  HISTORY_PATH,
  buildLiveHeatCheck,
  TRIGGER_LABELS,
  loadHistory,
  saveHistory
};
