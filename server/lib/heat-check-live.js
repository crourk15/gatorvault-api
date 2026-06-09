const fs = require('fs');
const path = require('path');
const store = require('./recruiting-store');
const intelStore = require('./recruiting-intel-store');
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
  'keithniebuhr',
  'jamieivins',
  'andrewpower',
  'chadsimmons_',
  'ttjharden8'
]);

const TRUSTED_INSIDER_PATTERN = /bender|alderman|wiltfong|ivins|power|abolverdi|niebuhr|chad\s*simmons|chadsimmons|tyler\s*harden|harden/i;

/** UF within this many RPM points of the leader = "close/neutral" for visit intel */
const RPM_CLOSE_GAP = parseFloat(process.env.HEAT_CHECK_RPM_CLOSE_GAP || '8', 10);

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

  for (const intel of intelStore.listIntel({ limit: 50 })) {
    if (intel.playerSlug) slugs.push(intel.playerSlug);
  }

  const unique = [...new Set(slugs.filter(Boolean))];
  const prioritized = unique.slice(0, MAX_PROFILES);
  return { slugs: prioritized, visitCount: visits.length };
}

function pickManualVisitIntel(manualIntel) {
  return (manualIntel || []).find(
    (i) => i.eventType === 'official_visit' && /scheduled|official/i.test(String(i.status || ''))
  );
}

function isTrustedInsider(post) {
  const handle = String(post.handle || '').toLowerCase();
  const writer = String(post.writerName || '');
  return INSIDER_HANDLES.has(handle) || TRUSTED_INSIDER_PATTERN.test(writer) || TRUSTED_INSIDER_PATTERN.test(handle);
}

function parseBeatIntel(beatPosts) {
  const intel = [];
  for (const post of beatPosts || []) {
    if (!isTrustedInsider(post)) continue;
    const text = String(post.text || '');
    const lower = text.toLowerCase();
    const insider = post.writerName || post.handle;

    if (/slipping|losing|cooling|concern|long shot|behind|trail/.test(lower) && /florida|gators|\buf\b/.test(lower)) {
      intel.push({ type: 'cooling', insider, text, url: post.url, publishedAt: post.publishedAt });
    }
    if (/\b(uf|florida|gators)\b.*\b(lead|leading|favorite|top choice)\b|\b(lead|leading|favorite)\b.*\b(uf|florida|gators)\b/.test(lower)) {
      intel.push({ type: 'uf_leads', insider, text, url: post.url, publishedAt: post.publishedAt });
    } else if (/trending|momentum|flip|commit soon|decision|visiting|official/.test(lower) && /florida|gators|\buf\b/.test(lower)) {
      intel.push({ type: 'uf_leads', insider, text, url: post.url, publishedAt: post.publishedAt });
    }
    if (/crystal ball|prediction|rpm|247|wiltfong|bender|alderman|ivins|power|simmons|harden/.test(lower)) {
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

function pickInsiderUfLead(beatMatches) {
  return beatMatches.find((b) => b.type === 'uf_leads' || (b.type === 'prediction' && /\b(lead|leading|favorite|trend|flip)\b/i.test(b.text)));
}

function pickInsiderUfSlipping(beatMatches) {
  return beatMatches.find((b) => b.type === 'cooling');
}

function buildRpmContext(profile, classYear) {
  const uf = on3.getFloridaTeam(profile.topTeams, classYear);
  const teams = on3
    .getYearTopTeams(profile.topTeams, classYear)
    .filter((t) => typeof t.prediction === 'number' && t.prediction > 0)
    .sort((a, b) => b.prediction - a.prediction);

  const leader = teams[0] || null;
  const ufLeads = !!(leader && on3.isFloridaTeam(leader));
  const ufPct = uf?.prediction;
  const leaderName = leader?.team?.name || leader?.team?.fullName || '';
  const leaderPct = leader?.prediction;

  const otherLeadsRpm = !!(leader && !on3.isFloridaTeam(leader));

  const rpmNeutralOrClose =
    !teams.length ||
    ufLeads ||
    !otherLeadsRpm ||
    (typeof leaderPct === 'number' &&
      typeof ufPct === 'number' &&
      leaderPct - ufPct < RPM_CLOSE_GAP);

  return { uf, teams, leader, ufLeads, ufPct, leaderName, leaderPct, otherLeadsRpm, rpmNeutralOrClose };
}

function baseSignal(profile, classYear, playerSlug) {
  return {
    playerSlug,
    playerName: profile.name,
    pos: profile.pos,
    classYear,
    recordedAt: profile.fetchedAt
  };
}

function analyzeProfile(profile, beatMatches, manualIntel = []) {
  if (!profile || profile.error) return { excluded: true, reason: 'fetch_error' };

  const classYear = profile.classYear || CLASS_YEAR;
  const playerSlug = profile.slug || on3.slugify(profile.name);
  const manualVisit = pickManualVisitIntel(manualIntel);

  // Priority 1 — commitment to Florida removes player entirely
  const commit = on3.getCollegeCommit(profile.topTeams, classYear);
  if (commit && on3.isFloridaTeam(commit)) {
    return {
      excluded: true,
      reason: 'committed',
      committedTo: commit.team?.name || commit.team?.fullName,
      committedDate: commit.committedDate
    };
  }

  const committedElsewhere = commit && !on3.isFloridaTeam(commit);

  const uf = on3.getFloridaTeam(profile.topTeams, classYear);
  if (!uf && !manualVisit) return { excluded: true, reason: 'no_uf_interest' };

  const rpm = buildRpmContext(profile, classYear);
  const visitTs = uf?.latestVisit?.dateOccurred;
  const recentVisit = visitTs != null && Date.now() / 1000 - visitTs < 21 * 86400;

  const insiderUfLead = pickInsiderUfLead(beatMatches);
  const insiderSlipping = pickInsiderUfSlipping(beatMatches);

  // Trusted insider / manual intel — scheduled official UF visit (flip targets included)
  if (manualVisit) {
    const visitRange =
      manualVisit.visitStart && manualVisit.visitEnd
        ? `${manualVisit.visitStart}–${manualVisit.visitEnd}`
        : manualVisit.visitStart || '';
    return {
      excluded: false,
      signal: {
        ...baseSignal(profile, classYear, playerSlug),
        direction: 'rising',
        trigger: 'visit_uf_leads',
        predictionType: 'visit',
        predictionSchool: 'Florida',
        source: 'gators_online',
        insider: manualVisit.source || 'Insider',
        headline: `Official visit scheduled — ${profile.name}`,
        detail: `${manualVisit.status || 'Official visit'}${visitRange ? ` · ${visitRange}` : ''} · ${String(manualVisit.detail || '').slice(0, 160)}`,
        recordedAt: manualVisit.reportedAt || profile.fetchedAt,
        priority: 3
      }
    };
  }

  if (committedElsewhere) {
    return { excluded: true, reason: 'committed', committedTo: commit.team?.name || commit.team?.fullName };
  }

  // Priority 3 — trusted insider explicitly says UF leads (overrides RPM cooling)
  if (insiderUfLead) {
    return {
      excluded: false,
      signal: {
        ...baseSignal(profile, classYear, playerSlug),
        direction: 'rising',
        trigger: insiderUfLead.type === 'prediction' ? 'insider_prediction_uf' : 'staff_momentum',
        predictionType: 'insider',
        predictionSchool: 'Florida',
        source: 'gators_online',
        insider: insiderUfLead.insider,
        headline: `Insider: UF leads — ${profile.name}`,
        detail: String(insiderUfLead.text).slice(0, 220),
        recordedAt: insiderUfLead.publishedAt || profile.fetchedAt,
        priority: 3
      }
    };
  }

  // Priority 2 — another school leads On3 RPM → COOLING (overrides visit intel)
  if (rpm.otherLeadsRpm && rpm.leader) {
    const isMajor = MAJOR_COMPETITORS.some((c) => rpm.leaderName.includes(c));
    return {
      excluded: false,
      signal: {
        ...baseSignal(profile, classYear, playerSlug),
        direction: 'cooling',
        trigger: isMajor ? 'competitor_offer' : 'prediction_other',
        predictionType: 'rpm',
        predictionSchool: rpm.leaderName,
        source: 'on3',
        insider: 'On3 RPM',
        headline: `${rpm.leaderName} leads RPM — ${profile.name}`,
        detail: `${rpm.leaderName} ${fmtPct(rpm.leaderPct)}% On3 RPM · Florida ${fmtPct(rpm.ufPct)}%${recentVisit ? ' · UF visit does not override RPM lead' : ''}`,
        recordedAt: profile.fetchedAt,
        priority: 2
      }
    };
  }

  // Insider slipping when RPM is neutral/close (UF still in the mix)
  if (insiderSlipping && rpm.rpmNeutralOrClose) {
    return {
      excluded: false,
      signal: {
        ...baseSignal(profile, classYear, playerSlug),
        direction: 'cooling',
        trigger: 'insider_slipping',
        predictionType: 'insider',
        predictionSchool: rpm.leaderName || 'Field',
        source: 'gators_online',
        insider: insiderSlipping.insider,
        headline: `Insider: UF slipping — ${profile.name}`,
        detail: String(insiderSlipping.text).slice(0, 220),
        recordedAt: insiderSlipping.publishedAt || profile.fetchedAt,
        priority: 3
      }
    };
  }

  // UF leads RPM → RISING
  if (rpm.ufLeads && typeof rpm.ufPct === 'number' && rpm.ufPct >= 12) {
    return {
      excluded: false,
      signal: {
        ...baseSignal(profile, classYear, playerSlug),
        direction: 'rising',
        trigger: 'rpm_uf',
        predictionType: 'rpm',
        predictionSchool: 'Florida',
        source: 'on3',
        insider: 'On3 RPM',
        headline: `${profile.name} — Florida leads On3 RPM`,
        detail: `On3 RPM: Florida ${fmtPct(rpm.ufPct)}% · next ${rpm.teams[1]?.team?.name || 'field'} ${fmtPct(rpm.teams[1]?.prediction)}%`,
        recordedAt: profile.fetchedAt,
        priority: 2
      }
    };
  }

  // Priority 4 — visit intel only when RPM is neutral or UF is close
  if (recentVisit && rpm.rpmNeutralOrClose) {
    return {
      excluded: false,
      signal: {
        ...baseSignal(profile, classYear, playerSlug),
        direction: 'rising',
        trigger: 'visit_uf_leads',
        predictionType: 'visit',
        predictionSchool: 'Florida',
        source: 'on3',
        insider: 'On3',
        headline: `UF visit — ${profile.name}`,
        detail: `Recent Florida visit · RPM ${fmtPct(rpm.ufPct)}%${rpm.leaderName && !rpm.ufLeads ? ` · close to ${rpm.leaderName} ${fmtPct(rpm.leaderPct)}%` : ''}`,
        recordedAt: profile.fetchedAt,
        priority: 4
      }
    };
  }

  // UF class-board priority when RPM is close
  if (uf.classRank != null && uf.classRank <= 6 && rpm.rpmNeutralOrClose && typeof rpm.ufPct === 'number' && rpm.ufPct >= 15) {
    return {
      excluded: false,
      signal: {
        ...baseSignal(profile, classYear, playerSlug),
        direction: 'rising',
        trigger: 'decision_soon_uf',
        predictionType: 'rpm',
        predictionSchool: 'Florida',
        source: 'on3',
        insider: 'On3',
        headline: `UF board priority — ${profile.name}`,
        detail: `Florida class rank #${uf.classRank} · ${fmtPct(rpm.ufPct)}% RPM`,
        recordedAt: profile.fetchedAt,
        priority: 4
      }
    };
  }

  return { excluded: true, reason: 'no_momentum' };
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

function consolidateByPlayerSingle(items) {
  const map = new Map();
  for (const item of items) {
    if (!map.has(item.playerSlug)) map.set(item.playerSlug, item);
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
    const manualIntel = intelStore.getIntelForPlayer({
      playerSlug: profile.slug || on3.slugify(profile.name),
      playerName: profile.name,
      playerId: profile.on3Id
    });
    const result = analyzeProfile(profile, beatMatches, manualIntel);
    if (result.excluded) {
      if (result.reason === 'committed') excludedCommitted += 1;
      continue;
    }
    if (!result.signal) continue;
    appendHistory(historyDoc, result.signal);
    const item = enrichWithHistory(result.signal, historyDoc);
    if (item.direction === 'rising') rising.push(item);
    else cooling.push(item);
  }

  historyDoc.updatedAt = new Date().toISOString();
  saveHistory(historyDoc);

  rising.sort((a, b) => new Date(b.recordedAt || 0) - new Date(a.recordedAt || 0));
  cooling.sort((a, b) => new Date(b.recordedAt || 0) - new Date(a.recordedAt || 0));

  const all = consolidateByPlayerSingle([...rising, ...cooling]);
  rising = all.filter((x) => x.direction === 'rising');
  cooling = all.filter((x) => x.direction === 'cooling');

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
