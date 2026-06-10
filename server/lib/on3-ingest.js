const fs = require('fs');
const path = require('path');
const store = require('./recruiting-store');
const on3 = require('./on3-client');
const { buildOn3ProfileUrl } = require('./on3-urls');
const { clearHeatCheckCache } = require('./heat-check-store');
const { commitFingerprint } = require('./commit-fingerprint');
const monitoring = require('./recruiting-monitoring');

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

function registerCommitFingerprint(snapshot, player, meta = {}) {
  const fp = commitFingerprint(player);
  if (!fp) return null;
  snapshot.commitFingerprints = snapshot.commitFingerprints || {};
  const date = player.commitDate || null;
  const existing = snapshot.commitFingerprints[fp];
  if (!existing) {
    snapshot.commitFingerprints[fp] = {
      commitDate: date,
      registeredAt: new Date().toISOString(),
      ...meta
    };
    return fp;
  }
  if (date && existing.commitDate !== date) {
    snapshot.commitFingerprints[fp] = {
      ...existing,
      commitDate: date,
      updatedAt: new Date().toISOString(),
      ...meta
    };
  }
  return fp;
}

async function backfillAllKnownCommits(snapshot) {
  snapshot.commitFingerprints = snapshot.commitFingerprints || {};

  for (const year of Object.keys(snapshot.years || {})) {
    const commits = snapshot.years[year]?.commits || {};
    for (const p of Object.values(commits)) {
      registerCommitFingerprint(snapshot, p, { source: 'snapshot', classYear: year });
    }
  }

  const players = await store.getAllPlayers();
  for (const p of players) {
    if (p.category !== 'recruit' || p.status !== 'committed' || p.committedTo !== 'Florida') continue;
    registerCommitFingerprint(snapshot, p, { source: 'players' });
  }

  const events = await store.getEvents({ limit: 1000 });
  for (const e of events) {
    if (e.source !== 'on3' || !['commit', 'flip'].includes(e.eventType)) continue;
    const pl = e.payload?.player;
    if (pl) registerCommitFingerprint(snapshot, pl, { source: 'event', eventId: e.id });
  }

  return Object.keys(snapshot.commitFingerprints).length;
}

function shouldAlertNewCommit(player, snapshot) {
  const fp = commitFingerprint(player);
  if (!fp) return { alert: true, fingerprint: null, reason: 'missing_fingerprint' };

  const prev = snapshot.commitFingerprints?.[fp];
  if (!prev) return { alert: true, fingerprint: fp, reason: 'new_commit' };

  const date = player.commitDate || null;
  if (date && prev.commitDate && prev.commitDate !== date) {
    return { alert: true, fingerprint: fp, reason: 'commit_date_updated', priorDate: prev.commitDate };
  }

  return {
    alert: false,
    fingerprint: fp,
    reason: 'duplicate_fingerprint',
    priorRegisteredAt: prev.registeredAt,
    commitDate: prev.commitDate
  };
}

function commitAlertKey(player) {
  return commitFingerprint(player) || `slug:${store.slugify(player.name)}`;
}

function loadFiredAlerts(snapshot) {
  return snapshot.firedAlerts || {};
}

function saveFiredAlert(snapshot, player, eventType, eventId) {
  const fp = commitFingerprint(player);
  snapshot.firedAlerts = snapshot.firedAlerts || {};
  snapshot.firedAlerts[commitAlertKey(player)] = {
    eventType,
    commitDate: player.commitDate || null,
    fingerprint: fp,
    eventId: eventId || null,
    firedAt: new Date().toISOString()
  };
  if (fp) registerCommitFingerprint(snapshot, player, { source: 'fired_alert', eventId });
}

async function shouldSkipCommitAlert(eventType, player, snapshot) {
  if (!['commit', 'flip'].includes(eventType)) return null;

  const slug = store.slugify(player.name);
  const gate = shouldAlertNewCommit(player, snapshot);
  if (!gate.alert) {
    return {
      reason: gate.reason,
      fingerprint: gate.fingerprint,
      slug,
      commitDate: player.commitDate || null,
      priorRegisteredAt: gate.priorRegisteredAt
    };
  }

  const events = await store.getEvents({ limit: 500 });
  const fp = gate.fingerprint;
  const prior = events.find((e) => {
    if (e.source !== 'on3' || !['commit', 'flip'].includes(e.eventType)) return false;
    const efp = commitFingerprint(e.payload?.player || { slug: e.playerSlug, on3Id: e.payload?.player?.on3Id });
    if (fp && efp === fp) return true;
    return (
      e.playerSlug === slug ||
      (player.on3Id && String(e.payload?.player?.on3Id) === String(player.on3Id))
    );
  });

  if (prior) {
    const priorDate = prior.payload?.player?.commitDate || null;
    const date = player.commitDate || null;
    if (priorDate === date || (!date && !priorDate)) {
      registerCommitFingerprint(snapshot, player, { source: 'existing_event', eventId: prior.id });
      return {
        reason: 'duplicate_commit_event',
        fingerprint: fp,
        slug,
        commitDate: date,
        priorEventId: prior.id,
        priorFiredAt: prior.createdAt
      };
    }
  }

  return null;
}

async function syncBoardCommitsToPlayers(commits) {
  let synced = 0;
  for (const p of commits || []) {
    const existing = await findExistingPlayer(p);
    const slug = existing?.slug || store.slugify(p.name);
    await store.upsertPlayer({
      ...(existing || {}),
      slug,
      name: p.name,
      pos: p.pos,
      classYear: p.classYear,
      school: p.school,
      htWt: p.htWt,
      stars: p.stars,
      rating: p.rating,
      natlRank: p.natlRank,
      posRank: p.posRank,
      stateRank: p.stateRank,
      inState: p.inState,
      category: 'recruit',
      status: 'committed',
      committedTo: 'Florida',
      commitDate: p.commitDate || existing?.commitDate || null,
      on3Id: p.on3Id,
      on3Slug: p.on3Slug || existing?.on3Slug || null,
      on3ProfileUrl: buildOn3ProfileUrl({ ...p, slug }),
      on3Source: p.on3Source || existing?.on3Source || null,
      skinny: buildSkinny(p),
      starsDisplay: starsDisplay(p.stars),
      updatedAt: new Date().toISOString()
    });
    synced += 1;
  }
  return synced;
}

async function firePlayerEvent(eventType, player, extra, snapshot) {
  const existing = await findExistingPlayer(player);
  const slug = existing?.slug || store.slugify(player.name);

  const skip = await shouldSkipCommitAlert(eventType, player, snapshot);
  if (skip) {
    console.log(
      '[on3-ingest] Skipped duplicate commit alert:',
      slug,
      skip.reason,
      skip.fingerprint || '',
      skip.priorEventId || skip.priorRegisteredAt || ''
    );
    registerCommitFingerprint(snapshot, player, { source: 'skipped_alert', reason: skip.reason });
    return { skipped: true, slug, eventType, ...skip };
  }

  const isFlip =
    eventType === 'commit' &&
    existing &&
    (existing.category === 'target' || existing.status === 'target' || existing.committedTo !== 'Florida');

  const resolvedType = isFlip ? 'flip' : eventType;
  const copy = require('./recruiting-alert-templates').buildRecruitingCopy({
    player: { ...player, committedTo: 'Florida' },
    eventType: resolvedType,
    row: { detail: extra?.detail }
  });
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
      skinny: copy.skinny || buildSkinny(player),
      profileNote: copy.profileNote
    },
    skinny: copy.skinny || buildSkinny(player),
    detail: copy.profileNote,
    source: 'on3'
  };

  try {
    const result = await store.fireRecruitingEvent(payload);
    if (['commit', 'flip', 'decommit'].includes(resolvedType)) {
      saveFiredAlert(snapshot, player, resolvedType, result.event?.id);
    }
    return { fired: true, eventType: resolvedType, slug, eventId: result.event?.id };
  } catch (e) {
    if (resolvedType === 'decommit' || /decommit blocked/i.test(e.message)) {
      await monitoring.sendMonitoringAlert({
        level: 'warning',
        type: 'ingest_mismatch',
        eventType: resolvedType,
        player: player.name,
        playerSlug: slug,
        reason: e.message,
        detail: 'Null or unverified decommit attempt blocked during On3 ingest',
        source: 'on3',
        meta: { snapshotAbsence: /snapshot|missing_from_board|unverified/i.test(e.message) }
      });
    }
    throw e;
  }
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
      headliner: prev?.headliner || false,
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

  if (live.errors.length) {
    for (const errRow of live.errors) {
      await monitoring.sendMonitoringAlert({
        level: errRow.type === 'fetch' ? 'error' : 'warning',
        type: 'ingest_mismatch',
        eventType: errRow.type || 'on3_fetch',
        player: errRow.year ? `Class ${errRow.year}` : 'On3',
        detail: errRow.error || 'On3 ingest fetch error',
        source: 'on3',
        meta: { year: errRow.year, errorType: errRow.type, unexpectedBoardRefresh: errRow.type === 'board_refresh' }
      });
    }
  }

  if (!result.ok && baseline) {
    const err = new Error(
      live.errors.map((e) => `${e.year}/${e.type}: ${e.error}`).join('; ') || 'On3 fetch failed'
    );
    pushLog({ level: 'error', message: err.message, baseline: true });
    throw err;
  }

  snapshot.years = snapshot.years || {};
  const fingerprintCount = await backfillAllKnownCommits(snapshot);
  result.knownCommitFingerprints = fingerprintCount;

  for (const year of classYears) {
    const commits = live.boards[year] || [];
    const currMap = indexCommits(commits);
    const prevMap = (snapshot.years[year] && snapshot.years[year].commits) || {};
    const prevRank = snapshot.years[year] && snapshot.years[year].rankings;
    const liveRank = live.rankings[year] || null;

    const synced = await syncBoardCommitsToPlayers(commits);
    result.synced = result.synced || {};
    result.synced[year] = synced;

    if (baseline) {
      for (const p of Object.values(currMap)) {
        registerCommitFingerprint(snapshot, p, { source: 'baseline', classYear: year });
      }
      snapshot.years[year] = { commits: currMap, rankings: liveRank };
      result.skipped.push({ year, reason: 'baseline_saved', commitCount: commits.length, synced });
      continue;
    }

    for (const key of Object.keys(currMap)) {
      const player = currMap[key];
      const inPrev = !!prevMap[key];
      const gate = shouldAlertNewCommit(player, snapshot);

      if (inPrev && gate.reason !== 'commit_date_updated') {
        registerCommitFingerprint(snapshot, player, { source: 'unchanged_snapshot', classYear: year });
        result.skipped.push({ year, key, reason: 'unchanged_in_snapshot', fingerprint: gate.fingerprint });
        continue;
      }

      if (!inPrev && !gate.alert) {
        registerCommitFingerprint(snapshot, player, { source: 'historical_known', classYear: year });
        result.skipped.push({ year, key, reason: gate.reason, fingerprint: gate.fingerprint });
        continue;
      }

      if (!inPrev || gate.reason === 'commit_date_updated') {
        if (!player?.name || !player?.on3Id) {
          await monitoring.sendMonitoringAlert({
            level: 'info',
            type: 'ingest_mismatch',
            eventType: 'commit',
            player: player?.name || key,
            detail: `Incomplete On3 payload (${!player?.name ? 'missing name' : 'missing on3Id'})`,
            source: 'on3',
            meta: { year, key, incompletePayload: true }
          });
        }
        if (player && player.commitDate == null && gate.reason === 'commit_date_updated') {
          await monitoring.sendMonitoringAlert({
            level: 'info',
            type: 'ingest_mismatch',
            eventType: 'commit',
            player: player.name || key,
            detail: 'Null commit field on commit date update',
            source: 'on3',
            meta: { year, key, nullCommitField: true }
          });
        }
        try {
          const out = await firePlayerEvent('commit', player, null, snapshot);
          if (out.fired) result.fired.push({ year, ...out });
          else result.skipped.push({ year, key, ...out });
        } catch (e) {
          result.errors.push({ year, key, type: 'commit', error: e.message });
          await monitoring.sendMonitoringAlert({
            level: 'warning',
            type: 'ingest_mismatch',
            eventType: 'commit',
            player: player?.name || key,
            reason: e.message,
            detail: 'Commit mismatch or validation failure during On3 ingest',
            source: 'on3',
            meta: { year, key, commitMismatch: true }
          });
        }
      }
    }

    for (const key of Object.keys(prevMap)) {
      if (currMap[key]) continue;
      const prevPlayer = prevMap[key];
      try {
        const decommitValidator = require('./decommit-validator');
        const blocked = await decommitValidator.handleSnapshotAbsence({
          player: prevPlayer,
          classYear: year,
          trigger: 'missing_from_board'
        });
        await monitoring.sendMonitoringAlert({
          level: 'info',
          type: 'ingest_mismatch',
          eventType: 'decommit',
          player: prevPlayer.name || key,
          playerSlug: prevPlayer.slug || store.slugify(prevPlayer.name || key),
          detail: 'Player missing from snapshot — event blocked',
          reason: blocked.reason || 'snapshot_absence',
          source: 'on3',
          meta: { year, key, snapshotAbsence: true, trigger: 'missing_from_board' }
        });
        result.blocked = result.blocked || [];
        result.blocked.push({ year, key, ...blocked });
      } catch (e) {
        result.errors.push({ year, key, type: 'decommit_blocked', error: e.message });
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
