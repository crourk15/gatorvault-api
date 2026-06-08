const fs = require('fs');
const path = require('path');
const store = require('./recruiting-store');
const on3 = require('./on3-client');
const { buildOn3ProfileUrl } = require('./on3-urls');
const { clearHeatCheckCache } = require('./heat-check-store');

const SNAPSHOT_PATH = path.join(store.DATA_DIR, 'on3-snapshot.json');
const INGEST_LOG_PATH = path.join(store.DATA_DIR, 'on3-ingest-log.json');

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

function loadSnapshot() {
  return readJson(SNAPSHOT_PATH, { initialized: false, years: {}, lastRun: null });
}

function saveSnapshot(snapshot) {
  writeJson(SNAPSHOT_PATH, snapshot);
}

function pushLog(entry) {
  const log = readJson(INGEST_LOG_PATH, []);
  log.unshift({ ts: new Date().toISOString(), ...entry });
  writeJson(INGEST_LOG_PATH, log.slice(0, 100));
}

function indexCommits(commits) {
  const map = {};
  (commits || []).forEach((p) => {
    const key = on3.playerKey(p);
    if (key) map[key] = p;
  });
  return map;
}

function buildSkinny(player) {
  if (player.skinny) return player.skinny;
  const bits = [
    player.pos,
    player.stars ? `${player.stars}★` : null,
    player.school,
    player.natlRank ? `#${player.natlRank} natl` : null
  ].filter(Boolean);
  return bits.join(' · ');
}

async function findExistingPlayer(player) {
  const all = await store.getAllPlayers();
  if (player.on3Id) {
    const byOn3 = all.find((p) => p.on3Id && String(p.on3Id) === String(player.on3Id));
    if (byOn3) return byOn3;
  }
  const slug = store.slugify(player.name);
  return all.find((p) => p.slug === slug) || null;
}

async function recentlyFired(slug, eventType) {
  const events = await store.getEvents({ limit: 30 });
  const since = Date.now() - 2 * 60 * 60 * 1000;
  return events.some(
    (e) =>
      e.playerSlug === slug &&
      e.eventType === eventType &&
      e.source === 'on3' &&
      new Date(e.createdAt).getTime() > since
  );
}

async function firePlayerEvent(eventType, player, extra) {
  const existing = await findExistingPlayer(player);
  const slug = existing?.slug || store.slugify(player.name);
  if (await recentlyFired(slug, eventType)) {
    return { skipped: true, reason: 'recent_duplicate', slug, eventType };
  }

  const isFlip =
    eventType === 'commit' &&
    existing &&
    (existing.category === 'target' || existing.status === 'target' || existing.committedTo !== 'Florida');

  const resolvedType = isFlip ? 'flip' : eventType;
  const payload = {
    eventType: resolvedType,
    player: {
      slug,
      name: player.name,
      pos: player.pos,
      classYear: player.classYear,
      school: player.school,
      htWt: player.htWt,
      stars: player.stars,
      rating: player.rating,
      natlRank: player.natlRank,
      posRank: player.posRank,
      stateRank: player.stateRank,
      inState: player.inState,
      category: resolvedType.startsWith('portal') ? 'portal' : 'recruit',
      on3Id: player.on3Id,
      commitDate: player.commitDate || null,
      committedTo: 'Florida',
      skinny: buildSkinny(player),
      profileNote: extra?.detail || ''
    },
    skinny: buildSkinny(player),
    detail: extra?.detail || '',
    source: 'on3'
  };

  const result = await store.fireRecruitingEvent(payload);
  return { fired: true, eventType: resolvedType, slug, eventId: result.event?.id };
}

async function fireRankingChange(classYear, rankings, prev) {
  const changed =
    !prev ||
    prev.nationalRank !== rankings.nationalRank ||
    prev.secRank !== rankings.secRank ||
    prev.classScore !== rankings.classScore;
  if (!changed) return null;

  const saved = await store.upsertRanking(rankings);
  const event = await store.createEvent({
    playerSlug: `class-${classYear}`,
    eventType: 'ranking_change',
    title: `${classYear} class rankings updated (On3)`,
    detail: `National #${saved.nationalRank} · SEC #${saved.secRank} · Score ${saved.classScore}`,
    skinny: `UF ${classYear} class now #${saved.nationalRank} nationally per On3`,
    classYear,
    source: 'on3',
    payload: { rankings: saved, previous: prev || null }
  });
  return { fired: true, eventType: 'ranking_change', classYear, eventId: event.id };
}

function parseClassYears(input) {
  const raw = input || process.env.ON3_CLASS_YEARS || '2026,2027';
  return String(raw)
    .split(',')
    .map((y) => parseInt(y.trim(), 10))
    .filter((y) => !Number.isNaN(y));
}

function starsDisplay(stars) {
  const n = Math.min(5, Math.max(0, parseInt(stars, 10) || 0));
  return '★'.repeat(n);
}

/** Sync portal ht/wt/stars from On3 UF commits board transfer rows — no manual overrides. */
async function syncPortalFromOn3(options = {}) {
  const classYear = parseInt(options.classYear || process.env.ON3_PORTAL_CLASS_YEAR || '2026', 10);
  const { transfers, url } = await on3.fetchFloridaPortalTransfers(classYear);
  const existing = await store.getAllPlayers();
  const byOn3 = new Map(existing.filter((p) => p.on3Id).map((p) => [String(p.on3Id), p]));
  const bySlug = new Map(existing.map((p) => [p.slug, p]));

  let updated = 0;
  for (const t of transfers) {
    const slug = store.slugify(t.name);
    const prev = (t.on3Id && byOn3.get(String(t.on3Id))) || bySlug.get(slug) || null;
    const player = {
      ...(prev || {}),
      slug,
      name: t.name,
      pos: t.pos,
      classYear: t.classYear,
      school: t.fromSchool,
      fromSchool: t.fromSchool,
      htWt: t.htWt,
      stars: t.stars,
      rating: t.rating,
      natlRank: t.natlRank,
      posRank: t.posRank,
      stateRank: t.stateRank,
      category: 'portal',
      status: t.status === 'enrolled' ? 'enrolled' : t.status || 'enrolled',
      committedTo: 'Florida',
      commitDate: t.commitDate || prev?.commitDate || null,
      on3Id: t.on3Id,
      on3Slug: t.on3Slug,
      on3ProfileUrl: t.on3ProfileUrl || buildOn3ProfileUrl(t),
      on3Source: t.on3Source || url,
      starsDisplay: starsDisplay(t.stars),
      updatedAt: new Date().toISOString()
    };
    await store.upsertPlayer(player);
    updated += 1;
  }

  return { ok: true, classYear, url, updated, count: transfers.length };
}

async function runOn3Ingest(options = {}) {
  const classYears = options.classYears || parseClassYears();
  const forceBaseline = !!options.baselineOnly;
  const snapshot = loadSnapshot();
  const isFirstRun = !snapshot.initialized;
  const baseline = forceBaseline || isFirstRun;

  const live = await on3.fetchFloridaSnapshot(classYears);
  const result = {
    ok: live.errors.length === 0 || Object.values(live.boards).some((b) => b.length > 0),
    baseline,
    classYears,
    fired: [],
    skipped: [],
    errors: live.errors,
    lastRun: new Date().toISOString()
  };

  if (!result.ok && baseline) {
    const err = new Error(
      live.errors.map((e) => `${e.year}/${e.type}: ${e.error}`).join('; ') || 'On3 fetch failed'
    );
    pushLog({ level: 'error', message: err.message, baseline: true });
    throw err;
  }

  snapshot.years = snapshot.years || {};

  for (const year of classYears) {
    const commits = live.boards[year] || [];
    const currMap = indexCommits(commits);
    const prevMap = (snapshot.years[year] && snapshot.years[year].commits) || {};
    const prevRank = snapshot.years[year] && snapshot.years[year].rankings;
    const liveRank = live.rankings[year] || null;

    if (baseline) {
      snapshot.years[year] = { commits: currMap, rankings: liveRank };
      result.skipped.push({ year, reason: 'baseline_saved', commitCount: commits.length });
      continue;
    }

    for (const key of Object.keys(currMap)) {
      if (prevMap[key]) continue;
      try {
        const out = await firePlayerEvent('commit', currMap[key]);
        if (out.fired) result.fired.push({ year, ...out });
        else result.skipped.push({ year, key, ...out });
      } catch (e) {
        result.errors.push({ year, key, type: 'commit', error: e.message });
      }
    }

    for (const key of Object.keys(prevMap)) {
      if (currMap[key]) continue;
      try {
        const out = await firePlayerEvent('decommit', prevMap[key]);
        if (out.fired) result.fired.push({ year, ...out });
        else result.skipped.push({ year, key, ...out });
      } catch (e) {
        result.errors.push({ year, key, type: 'decommit', error: e.message });
      }
    }

    if (liveRank) {
      try {
        const rankOut = await fireRankingChange(year, liveRank, prevRank);
        if (rankOut) result.fired.push({ year, ...rankOut });
      } catch (e) {
        result.errors.push({ year, type: 'ranking_change', error: e.message });
      }
    }

    snapshot.years[year] = { commits: currMap, rankings: liveRank || prevRank || null };
  }

  snapshot.initialized = true;
  snapshot.lastRun = result.lastRun;
  saveSnapshot(snapshot);
  clearHeatCheckCache();

  try {
    const portalSync = await syncPortalFromOn3(options);
    result.portalSync = portalSync;
  } catch (e) {
    result.errors.push({ type: 'portal_sync', error: e.message });
  }

  pushLog({
    level: 'info',
    baseline: result.baseline,
    fired: result.fired.length,
    errors: result.errors.length
  });

  return result;
}

function getIngestStatus() {
  const snapshot = loadSnapshot();
  const log = readJson(INGEST_LOG_PATH, []);
  return {
    initialized: !!snapshot.initialized,
    lastRun: snapshot.lastRun,
    classYears: Object.keys(snapshot.years || {}),
    years: snapshot.years,
    recentLog: log.slice(0, 10)
  };
}

module.exports = {
  runOn3Ingest,
  syncPortalFromOn3,
  getIngestStatus,
  loadSnapshot,
  SNAPSHOT_PATH
};
