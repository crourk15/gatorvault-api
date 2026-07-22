/**
 * Recruiting Hub — unified dataset + payload builders (Phase 3).
 * Single source of truth for enriched players and hub section rows.
 */
const fs = require('fs');
const path = require('path');
const store = require('./recruiting-store');
const intelStore = require('./recruiting-intel-store');
const visitLogStore = require('./recruiting-visit-log-store');
const offerLogStore = require('./recruiting-offer-log-store');
const { enrichBoard } = require('./recruiting-board-enrich');
const {
  parseUfPct,
  getBattleDifficulty,
  getBattleColor,
  normalizePipelineScore,
} = require('./recruiting-hub-scoring');
const {
  extractRealCompetitors,
  topCompetitorScore,
  resolveStrictUfScore,
} = require('./recruiting-hub-competitors');
const { resolveStaffById } = require('./recruiting-staff-directory');
const {
  STATE_CENTROIDS,
  resolvePlayerState,
  normalizePlayerGeo,
} = require('./recruiting-geo-normalize');
const { isCuratedHubIntel, loadHubRecruitingPool } = require('./recruiting-hub-intel-store');
const { getAllowlistSet } = require('./recruiting-target-allowlist');
const {
  applyCommitmentPredictionOverride,
  isUfPredictionSuppressed,
  filterMovementIntelForPlayer,
} = require('./commitment-prediction-override');

const DEFAULT_CLASS_YEARS = [2026, 2027, 2028];
/** Intel / offers / visits eligible for the hub feed. */
const FEED_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
/** Commits older than this belong on Commit Class, not Movement. */
const COMMIT_FEED_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;
const RECENT_VISIT_MS = 14 * 24 * 60 * 60 * 1000;
const MOMENTUM_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const OFFER_INTEL_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
const PLAYERS_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'players.json');

const PUBLIC_VISIT = new Set(['official_visit', 'unofficial_visit', 'visit_cancelled', 'ov_change', 'visit']);

function playerPos(player) {
  return player?.position || player?.pos || '—';
}

function profileUrl(player) {
  const slug = player?.slug || String(player?.name || '').toLowerCase().replace(/\s+/g, '-');
  return `/vault/recruiting/player/${encodeURIComponent(slug)}`;
}

/** Movement feed: board pool + locked allowlist for underclassmen years. */
function hubFeedSlugAllowed(slug, focusYear, pool) {
  const key = String(slug || '').toLowerCase();
  if (!key || !pool.has(key)) return false;
  if (focusYear === 2027 || focusYear === 2028) {
    return getAllowlistSet(focusYear).has(key);
  }
  return true;
}

function formatNextVisit(player) {
  if (!player?.visitStart) return null;
  const d = new Date(player.visitStart);
  if (Number.isNaN(d.getTime())) return String(player.visitStart);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function shortNote(player) {
  const note = player?.notePreview ?? player?.skinny ?? player?.notes;
  if (!note || !String(note).trim()) return null;
  const text = String(note).trim();
  return text.length > 140 ? `${text.slice(0, 137)}…` : text;
}

function shortInsiderNote(player) {
  const note = player?.notePreview ?? player?.skinny ?? player?.notes;
  if (!note || !String(note).trim()) return null;
  const text = String(note).trim();
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

function isFloridaSchool(value) {
  return /florida|gators|\buf\b/i.test(String(value || ''));
}

function isRosterPlayer(player) {
  const lc = String(player?.lifecycle || '').toUpperCase();
  const cat = String(player?.category || '').toLowerCase();
  return lc === 'ROSTER' || cat === 'roster';
}

function isActivePortalTarget(player) {
  const cat = String(player?.category || '').toLowerCase();
  const st = String(player?.status || '').toLowerCase();
  const isPortal =
    cat === 'portal' ||
    st.includes('portal') ||
    String(player?.lifecycle || '').toUpperCase() === 'PORTAL';
  if (!isPortal) return false;
  if (player.isCommittedToUF) return false;
  if (player.committedTo && isFloridaSchool(player.committedTo)) return false;
  if (player.committedTo && !isFloridaSchool(player.committedTo)) return false;
  return (
    parseUfPct(player.ufProbability) >= 34 ||
    player.tier === 'TOP' ||
    player.tier === 'HIGH' ||
    player.isTarget
  );
}

function loadRawPlayerMap() {
  try {
    const raw = JSON.parse(fs.readFileSync(PLAYERS_PATH, 'utf8'));
    const map = new Map();
    for (const p of raw) {
      if (p.slug) map.set(String(p.slug).toLowerCase(), p);
    }
    return map;
  } catch {
    return new Map();
  }
}

function resolveStaffEntry(player) {
  const rawId =
    player.staff_lead_id ||
    player.staffLeadId ||
    player.secondary_recruiter_id ||
    player.secondaryRecruiterId ||
    null;
  if (!rawId) return null;
  return resolveStaffById(rawId);
}

function buildCompetitors(player, intelRows) {
  return extractRealCompetitors(player, intelRows).map((c) => ({
    school: c.school,
    logo: c.logo,
    score: c.score,
    trend: c.trend || 'flat',
  }));
}

function movementArrow(player) {
  const dir = player.movementDirection ?? player.trend;
  if (dir === 'up') return 'up';
  if (dir === 'down') return 'down';
  return 'flat';
}

function deriveMovementTrend(rawPlayer, intelRows) {
  if (rawPlayer.movementDirection === 'up' || rawPlayer.interestMeter === 'rising') return 'up';
  if (rawPlayer.movementDirection === 'down' || rawPlayer.interestMeter === 'falling') return 'down';

  const slug = String(rawPlayer.slug || '').toLowerCase();
  for (const row of intelRows) {
    if (String(row.playerSlug || row.player_slug || '').toLowerCase() !== slug) continue;
    const delta = Number(row.movementDelta);
    if (Number.isFinite(delta) && delta !== 0) return delta > 0 ? 'up' : 'down';
    const et = String(row.eventType || '').toLowerCase();
    if (et === 'momentum_up' || et === 'flip_watch') return 'up';
    if (et === 'momentum_down') return 'down';
  }
  return 'flat';
}

function isCommittedElsewhere(player) {
  const school = player.committedTo ?? null;
  return Boolean(school && !isFloridaSchool(school));
}

function futureCastTag(pct) {
  if (pct == null) return 'Battle';
  if (pct >= 70) return 'Lean UF';
  if (pct >= 34) return 'Battle';
  return 'Lean Elsewhere';
}

function computeHeatScore(enriched) {
  const uf = enriched.ufScore ?? 0;
  const fit = Number(enriched.fitScore);
  let heat = Math.max(uf, Number.isFinite(fit) ? Math.round(fit) : 0);

  if (enriched.tier === 'TOP') heat += 12;
  else if (enriched.tier === 'HIGH') heat += 6;

  const natl = enriched.natlRank ?? enriched.natl;
  if (natl != null && Number(natl) <= 100) heat += 12;
  else if (natl != null && Number(natl) <= 300) heat += 6;

  if (enriched.movementDirection === 'up') heat += 14;
  else if (enriched.movementDirection === 'down') heat -= 10;

  if (enriched.headliner) heat += 8;

  return Math.min(100, Math.max(0, Math.round(heat)));
}

function buildBattleContext(enrichedPlayer) {
  const competitors = enrichedPlayer.competitors || [];
  const topScore = enrichedPlayer.topCompetitorScore;
  const topEntry =
    competitors.find((c) => c.score != null && c.score === topScore) || competitors[0] || null;

  return {
    uf: enrichedPlayer.ufScore ?? null,
    competitor: topScore ?? null,
    competitorName: topEntry?.school ?? null,
  };
}

function buildMovementEvents(player, intelRows, visitLogs, offerLogs) {
  const events = [];
  const slug = String(player.slug || '').toLowerCase();

  for (const row of intelRows) {
    events.push({
      kind: 'intel',
      id: String(row.fingerprint || row.id),
      timestamp: row.reportedAt || row.timestamp || row.createdAt,
      eventType: row.eventType,
    });
  }

  for (const log of visitLogs) {
    if (String(log.playerSlug || '').toLowerCase() !== slug) continue;
    events.push({
      kind: 'visit_log',
      id: String(log.id || log.fingerprint),
      timestamp: log.reportedAt || log.date,
      visitType: log.visitType,
    });
  }

  for (const log of offerLogs) {
    if (String(log.playerSlug || '').toLowerCase() !== slug) continue;
    events.push({
      kind: 'offer_log',
      id: String(log.id || log.fingerprint),
      timestamp: log.reportedAt || log.date,
      school: log.school,
    });
  }

  return events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

function enrichHubPlayer(rawPlayer, ctx = {}) {
  const intelRows = ctx.intelRows || [];
  const visitLogs = ctx.visitLogs || [];
  const offerLogs = ctx.offerLogs || [];
  const slug = String(rawPlayer.slug || '').toLowerCase();
  const ufScore = resolveStrictUfScore(rawPlayer, intelRows);
  const competitors = buildCompetitors(rawPlayer, intelRows);
  const topComp = topCompetitorScore(competitors);
  const trend = deriveMovementTrend(rawPlayer, intelRows);
  const committedElsewhere = isCommittedElsewhere(rawPlayer);
  const geoPatch = normalizePlayerGeo(rawPlayer);

  const enriched = {
    ...rawPlayer,
    slug,
    position: playerPos(rawPlayer),
    ufScore,
    competitors,
    topCompetitorScore: topComp,
    battleDifficulty:
      ufScore != null && topComp != null
        ? getBattleDifficulty(ufScore, topComp, trend, { committedElsewhere })
        : ufScore != null && committedElsewhere
          ? getBattleDifficulty(ufScore, null, trend, { committedElsewhere })
          : 'unknown',
    battleColor: ufScore != null ? getBattleColor(ufScore) : null,
    movementEvents: buildMovementEvents(rawPlayer, intelRows, visitLogs, offerLogs),
    geo: {
      hometownState:
        geoPatch.hometownState || rawPlayer.hometownState || resolvePlayerState(rawPlayer) || null,
      hometownCity: geoPatch.hometownCity || rawPlayer.hometownCity || null,
      pinLat: rawPlayer.pinLat ?? rawPlayer.lat ?? geoPatch.pinLat ?? null,
      pinLng: rawPlayer.pinLng ?? rawPlayer.lng ?? geoPatch.pinLng ?? null,
    },
    staff: resolveStaffEntry(rawPlayer),
    nextVisit: formatNextVisit(rawPlayer),
    profileUrl: rawPlayer.profileUrl || profileUrl(rawPlayer),
    trend,
  };

  return applyCommitmentPredictionOverride(enriched);
}

const hubDatasetInflight = new Map();

function classYearsCacheKey(classYears) {
  return JSON.stringify([...classYears].sort((a, b) => a - b));
}

async function loadHubDatasetOnce(options = {}) {
  const classYears = options.classYears || DEFAULT_CLASS_YEARS;
  const rawMap = loadRawPlayerMap();
  const intelRows = intelStore.listIntel({ limit: 2000 });
  const visitLogs = visitLogStore.listVisitLogs({ limit: 2000 });
  const offerLogs = offerLogStore.listOfferLogs({ limit: 2000 });
  const players = new Map();
  const seen = new Set();

  function addPlayer(raw, meta = {}) {
    const slug = String(raw.slug || '').toLowerCase();
    if (!slug || seen.has(slug) || isRosterPlayer(raw)) return;
    seen.add(slug);
    const merged = { ...rawMap.get(slug), ...raw, ...meta, slug };
    const slugIntel = intelRows.filter(
      (r) => String(r.playerSlug || r.player_slug || '').toLowerCase() === slug
    );
    const slugVisits = visitLogs.filter(
      (l) => String(l.playerSlug || '').toLowerCase() === slug
    );
    const slugOffers = offerLogs.filter(
      (l) => String(l.playerSlug || '').toLowerCase() === slug
    );
    players.set(slug, enrichHubPlayer(merged, {
      intelRows: slugIntel,
      visitLogs: slugVisits,
      offerLogs: slugOffers,
    }));
  }

  for (const year of classYears) {
    const commits = await store.getHubCommits(year);
    const { enrichBoard } = require('./recruiting-board-enrich');
    const enriched = enrichBoard({ classYear: year, commits, targets: [], rankings: null }, false);
    for (const p of enriched.commits || []) {
      if (!p.slug) continue;
      addPlayer(p, { classYear: p.classYear || year, isCommit: true, isTarget: false });
    }
    const board = await store.getBoard(year);
    const enrichedBoard = enrichBoard(board, false);
    for (const p of enrichedBoard.targets || []) {
      if (!p.slug) continue;
      addPlayer(p, { classYear: p.classYear || year, isCommit: false, isTarget: true });
    }
  }

  const { getAllowlistSet, getMergedCanonicalNames } = require('./recruiting-target-allowlist');
  for (const year of classYears) {
    if (year !== 2027 && year !== 2028) continue;
    const names = getMergedCanonicalNames();
    for (const slug of getAllowlistSet(year)) {
      if (seen.has(slug)) continue;
      const raw =
        rawMap.get(slug) ||
        (await store.getPlayerBySlug(slug)) ||
        {
          slug,
          name: names[slug] || slug.replace(/-/g, ' '),
          classYear: year,
          category: 'target',
        };
      addPlayer(raw, { classYear: year, isCommit: false, isTarget: true });
    }
  }

  const all = await store.getAllPlayers();
  for (const p of all) {
    const slug = String(p.slug || '').toLowerCase();
    if (!slug || seen.has(slug) || isRosterPlayer(p)) continue;
    const raw = rawMap.get(slug) || {};
    const merged = { ...raw, ...p };
    if (isActivePortalTarget(merged)) {
      const cy = Number(p.classYear) || 2027;
      if (!classYears.includes(cy)) continue;
      addPlayer(merged, {
        classYear: cy,
        isCommit: false,
        isPortal: true,
        isTarget: true,
      });
    } else if (classYears.includes(Number(p.classYear)) && p.isTarget && !p.isCommittedToUF) {
      addPlayer(merged, {
        classYear: Number(p.classYear),
        isCommit: false,
        isTarget: true,
      });
    }
  }

  return {
    players,
    intelRows,
    visitLogs,
    offerLogs,
    loadedAt: new Date().toISOString(),
  };
}

async function loadHubDataset(options = {}) {
  const classYears = options.classYears || DEFAULT_CLASS_YEARS;
  const key = classYearsCacheKey(classYears);
  const inflight = hubDatasetInflight.get(key);
  if (inflight) return inflight;

  const promise = loadHubDatasetOnce({ classYears }).finally(() => {
    hubDatasetInflight.delete(key);
  });
  hubDatasetInflight.set(key, promise);
  return promise;
}

function isHuntListBattleEligible(player) {
  const year = Number(player.classYear);
  if (year !== 2027 && year !== 2028) return true;
  try {
    const {
      getAllowlistSet,
      canonicalTargetSlug,
      isFlipWatchAllowlisted,
    } = require('./recruiting-target-allowlist');
    const slug = canonicalTargetSlug(player.slug || player.id || player.name);
    if (!getAllowlistSet(year).has(slug)) return false;
    // Flip-watch elsewhere commits stay eligible; UF commits do not.
    if (player.isCommit || player.isCommittedToUF) {
      return isFlipWatchAllowlisted(slug, year);
    }
    return true;
  } catch {
    return false;
  }
}

function buildBattleBoardRows(enrichedPlayers) {
  const rows = [];

  for (const player of enrichedPlayers) {
    if ((player.isCommit || player.isCommittedToUF) && !isHuntListBattleEligible(player)) continue;
    if (!isHuntListBattleEligible(player)) continue;
    // Only confirmed On3 RPM numbers — never offer-list text / HS names / heat-as-RPM.
    const hasUfRpm = player.ufScore != null && Number.isFinite(Number(player.ufScore)) && Number(player.ufScore) > 0;
    const competitors = (player.competitors || []).filter(
      (c) =>
        c &&
        c.school &&
        !/[()]/.test(String(c.school)) &&
        c.score != null &&
        Number.isFinite(Number(c.score))
    );
    if (!hasUfRpm && !competitors.length) continue;

    rows.push({
      id: player.slug,
      name: player.name,
      position: player.position || playerPos(player),
      class: player.classYear,
      battleDifficulty: player.battleDifficulty,
      battleColor: player.battleColor,
      trend: player.trend || 'flat',
      competitors,
      ufScore: hasUfRpm ? Number(player.ufScore) : null,
      nextVisit: player.nextVisit,
      intel: shortNote(player) || null,
    });
  }

  rows.sort((a, b) => {
    const aScore = a.ufScore != null ? a.ufScore : -1;
    const bScore = b.ufScore != null ? b.ufScore : -1;
    if (bScore !== aScore) return bScore - aScore;
    const aComp = Math.max(0, ...(a.competitors || []).map((c) => Number(c.score) || 0));
    const bComp = Math.max(0, ...(b.competitors || []).map((c) => Number(c.score) || 0));
    return bComp - aComp;
  });
  return rows.slice(0, 12);
}

function buildHeatIndexRows(enrichedPlayers) {
  const scored = enrichedPlayers
    .filter(
      (p) =>
        !p.isCommit &&
        !p.ufPredictionSuppressed &&
        (p.tier === 'TOP' || p.tier === 'HIGH' || (p.ufScore != null && p.ufScore >= 34))
    )
    .map((player) => ({
      id: player.slug || player.name,
      name: player.name,
      position: player.position || playerPos(player),
      heat: computeHeatScore(player),
      movement: movementArrow(player),
      ufPercent: player.ufScore,
      battle: buildBattleContext(player),
      nextVisit: player.nextVisit,
      insiderNote: shortInsiderNote(player),
      profileUrl: player.profileUrl || profileUrl(player),
    }));

  scored.sort((a, b) => b.heat - a.heat);
  return scored.slice(0, 12);
}

function buildBattlesListRows(enrichedPlayers) {
  const battles = enrichedPlayers
    .filter((p) => !p.isCommit && !p.ufPredictionSuppressed && p.ufScore != null && p.ufScore >= 34)
    .map((player) => {
      const note = player.notePreview ?? player.notes ?? player.skinny ?? null;
      if (!note || !String(note).trim()) return null;
      return {
        id: player.slug || player.name,
        name: player.name,
        position: player.position || playerPos(player),
        ufPercent: `${player.ufScore}%`,
        tag: futureCastTag(player.ufScore),
        note: String(note).trim(),
        movement:
          player.trend === 'up' || player.movementDirection === 'up'
            ? 'Trending up'
            : player.trend === 'down' || player.movementDirection === 'down'
              ? 'Trending down'
              : player.ufScore >= 70
                ? 'Stable'
                : 'Stable',
      };
    })
    .filter(Boolean);

  battles.sort((a, b) => parseInt(b.ufPercent, 10) - parseInt(a.ufPercent, 10));
  return battles.slice(0, 6);
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isRelevantVisit(visitStart) {
  if (!visitStart) return false;
  const d = new Date(visitStart);
  if (Number.isNaN(d.getTime())) return false;
  const diffMs = startOfDay(d).getTime() - startOfDay(new Date()).getTime();
  return diffMs >= -RECENT_VISIT_MS;
}

function visitTimestamp(visitStart) {
  const d = new Date(visitStart);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function mapIntelEventType(row) {
  const et = String(row.eventType || '').toLowerCase();
  const delta = Number(row.movementDelta);
  if (PUBLIC_VISIT.has(et)) return 'visit';
  if (et === 'offer') return 'offer';
  if (delta > 0 || et === 'momentum_up' || et === 'flip_watch') return 'up';
  if (delta < 0 || et === 'momentum_down') return 'down';
  if (Number.isFinite(delta) && delta !== 0) return delta > 0 ? 'up' : 'down';
  return 'intel';
}

function buildIntelSummary(row, meta) {
  const et = String(row.eventType || '').toLowerCase();
  const detail = String(row.detail || row.text || '').trim();

  if (PUBLIC_VISIT.has(et)) {
    if (/cancel/i.test(et) || /cancel/i.test(detail)) return 'Visit canceled';
    if (row.visitDates || row.visitStart) return `Visit scheduled (${row.visitDates || row.visitStart})`;
    return 'Visit update';
  }
  if (et === 'offer') return 'Offer extended';
  if (et === 'ranking_change') return 'Ranking movement';
  if (et === 'prediction' || et === 'prediction_change' || et === 'rivals_futurecast') {
    return detail ? `Battle movement — ${detail.slice(0, 90)}` : 'Battle movement';
  }
  if (et === 'staff_note' || et === 'target_update') {
    return detail ? `Staff note — ${detail.slice(0, 100)}` : 'Staff note';
  }
  if (et === 'flip_watch' || et === 'commit_watch') {
    return detail ? detail.slice(0, 120) : 'Flip watch';
  }

  const delta = Number(row.movementDelta);
  if (Number.isFinite(delta) && delta !== 0) {
    return `UF momentum ${delta > 0 ? 'up' : 'down'} (${delta > 0 ? '+' : ''}${delta})`;
  }

  return detail.length > 140 ? `${detail.slice(0, 137)}…` : detail;
}

function mapIntelToFeedItem(row, meta) {
  return {
    id: String(row.fingerprint || row.id),
    timestamp: row.reportedAt || row.timestamp || row.createdAt,
    name: meta.name,
    position: meta.position,
    class: meta.classYear,
    event: mapIntelEventType(row),
    summary: buildIntelSummary(row, meta),
    profileUrl: meta.profileUrl,
  };
}

function mapVisitLogFeedItem(log, meta) {
  const name = meta?.name || log.playerName || log.playerSlug;
  const visitLabel = String(log.visitType || 'visit').replace(/_/g, ' ');
  const school = log.school || 'Florida';
  return {
    id: `visit-log-${log.id || log.fingerprint}`,
    timestamp: log.reportedAt || log.date || new Date().toISOString(),
    name,
    position: meta?.position || null,
    class: meta?.classYear || null,
    event: /cancel|ov_change/.test(String(log.visitType)) ? 'down' : 'visit',
    summary: `${visitLabel} · ${school}`,
    profileUrl: meta?.profileUrl || (log.playerSlug ? `/vault/recruiting/player/${log.playerSlug}` : null),
  };
}

function mapOfferLogFeedItem(log, meta) {
  const name = meta?.name || log.playerName || log.playerSlug;
  return {
    id: `offer-log-${log.id || log.fingerprint}`,
    timestamp: log.reportedAt || log.date || new Date().toISOString(),
    name,
    position: meta?.position || null,
    class: meta?.classYear || null,
    event: 'offer',
    summary: `Offer from ${log.school || 'Florida'}`,
    profileUrl: meta?.profileUrl || (log.playerSlug ? `/vault/recruiting/player/${log.playerSlug}` : null),
  };
}

function countFloridaOffers(player) {
  let count = 0;
  const lists = [player.offers, player.offerList].filter(Array.isArray);
  for (const list of lists) {
    for (const offer of list) {
      const school =
        typeof offer === 'string' ? offer : offer?.school || offer?.schoolName || offer?.name || '';
      if (isFloridaSchool(school)) count += 1;
    }
  }
  return count;
}

function hasRecordedOffer(player) {
  if (countFloridaOffers(player) > 0) return true;
  const ov = String(player.ufOvStatus || '').toUpperCase();
  return ov.includes('OFFER');
}

function boardVisitItem(meta) {
  const formatted = formatNextVisit(meta) || String(meta.visitStart);
  return {
    id: `board-visit-${meta.slug}`,
    timestamp: visitTimestamp(meta.visitStart),
    name: meta.name,
    position: meta.position,
    class: meta.classYear,
    event: 'visit',
    summary: `Visit scheduled (${formatted})`,
    profileUrl: meta.profileUrl,
  };
}

function boardOfferItem(meta) {
  return {
    id: `board-offer-${meta.slug}`,
    timestamp: new Date().toISOString(),
    name: meta.name,
    position: meta.position,
    class: meta.classYear,
    event: 'offer',
    summary: 'UF offer on record',
    profileUrl: meta.profileUrl,
  };
}

function commitFeedTimestamp(meta, raw = {}) {
  const date = raw.commitDate || meta.commitDate;
  if (date) {
    const parsed = new Date(date);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  const updated = raw.updatedAt || meta.updatedAt;
  if (updated) {
    const parsed = new Date(updated);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

function mapCommitFeedItem(meta, raw = {}) {
  const stars = Number(raw.stars || meta.stars) || null;
  const rank = raw.natlRank ?? meta.natlRank;
  const pos = meta.position || raw.pos || 'prospect';
  const parts = ['Commits to Florida'];
  if (stars) parts.push(`${stars}★ ${pos}`);
  else if (pos) parts.push(pos);
  if (rank != null && Number.isFinite(Number(rank))) parts.push(`#${rank} natl`);
  if (raw.headliner || meta.headliner) parts.push('Headliner');
  return {
    id: `commit-${meta.slug}`,
    timestamp: commitFeedTimestamp(meta, raw),
    name: meta.name,
    position: meta.position,
    class: meta.classYear,
    event: 'commit',
    summary: parts.join(' · '),
    profileUrl: meta.profileUrl,
  };
}

function boardCompetitorChangeItem(meta, row) {
  const school =
    row.predictionSchool ||
    row.nextVisitSchool ||
    row.competitorSchool ||
    'competitor';
  return {
    id: `board-competitor-${meta.slug}-${row.fingerprint || row.id}`,
    timestamp: row.reportedAt || row.timestamp || row.createdAt || new Date().toISOString(),
    name: meta.name,
    position: meta.position,
    class: meta.classYear,
    event: mapIntelEventType(row),
    summary: `Battle movement (${school})`,
    profileUrl: meta.profileUrl,
  };
}

function boardMovementItem(meta) {
  const summary =
    meta.notePreview ??
    meta.skinny ??
    (meta.movementDirection === 'up'
      ? 'UF trending up on the board'
      : 'UF trending down on the board');
  const stamp = meta.updatedAt || meta.movementUpdatedAt || meta.lastIntelAt;
  const parsed = stamp ? new Date(stamp) : null;
  const timestamp =
    parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();

  return {
    id: `board-${meta.slug}-${meta.movementDirection}`,
    timestamp,
    name: meta.name,
    position: meta.position,
    class: meta.classYear,
    event: meta.movementDirection === 'up' ? 'up' : 'down',
    summary: String(summary).slice(0, 140),
    profileUrl: meta.profileUrl,
  };
}

function isHubPlayerSuppressed(slug, rawMap, pool) {
  const key = String(slug || '').toLowerCase();
  const raw = rawMap.get(key) || {};
  const meta = pool.get(key) || {};
  return isUfPredictionSuppressed({ ...raw, ...meta, slug: key });
}

function resolveFeedMeta(slug, pool, rawMap) {
  const raw = rawMap.get(slug) || {};
  const meta = pool.get(slug);
  const committedElsewhere = isCommittedElsewhere(raw) || isCommittedElsewhere(meta || {});
  if (meta) {
    return committedElsewhere ? { ...meta, isCommit: true } : meta;
  }
  if (!raw || !raw.name) return null;
  return {
    slug,
    name: raw.name || slug.replace(/-/g, ' '),
    position: playerPos(raw),
    classYear: raw.classYear ?? null,
    profileUrl: profileUrl(raw),
    // Treat elsewhere-commits as commits so visit/offer heat cannot revive them.
    isCommit: committedElsewhere || Boolean(raw.isCommit),
  };
}

function slugFromFeedProfileUrl(url) {
  const m = String(url || '').match(/\/player\/([^/?#]+)/i);
  return m ? decodeURIComponent(m[1]).toLowerCase() : null;
}

function enrichMovementFeedWithNarratives(items, visitLogs, asOf = new Date()) {
  if (!items?.length) return items;
  const ufTrendSnapshot = require('./uf-trend-snapshot');
  const movementNarrative = require('./movement-narrative');
  const slugs = [...new Set(items.map((i) => slugFromFeedProfileUrl(i.profileUrl)).filter(Boolean))];
  const deltaBySlug = ufTrendSnapshot.buildDelta7dBySlug(slugs, asOf);
  return items.map((item) => {
    const slug = slugFromFeedProfileUrl(item.profileUrl);
    if (!slug) return item;
    const visit = movementNarrative.latestCompletedVisitForSlug(slug, visitLogs, asOf);
    const delta = deltaBySlug.get(slug);
    const narrative = movementNarrative.buildMovementNarrative({
      delta7d: delta,
      visitStart: visit?.visitStart,
      visitEnd: visit?.visitEnd,
    });
    if (!narrative) return item;
    // Keep summary factual; narrative is the separate "why it matters" line.
    return { ...item, movementNarrative: narrative };
  });
}

const FEED_EVENT_WEIGHT = {
  commit: 0,
  flip: 1,
  offer: 2,
  visit: 3,
  up: 4,
  down: 5,
  intel: 6,
};

function isThinVisitFeedItem(item) {
  if (item.event !== 'visit') return false;
  if (item.movementNarrative) return false;
  const summary = String(item.summary || '').toLowerCase();
  if (/official/.test(summary)) return false;
  if (/scheduled/.test(summary)) return false;
  // Bare unofficial / generic visit rows without context.
  return /unofficial visit|^(visit update|visit)\b/.test(summary);
}

/** Prefer fresh traction: recent commits/offers/swings over stale visit dumps. */
function curateHubMovementFeed(items) {
  const now = Date.now();
  const ranked = [...items]
    .filter((item) => {
      const ts = new Date(item.timestamp).getTime();
      if (!Number.isFinite(ts)) return false;
      if (item.event === 'commit' && now - ts > COMMIT_FEED_MAX_AGE_MS) return false;
      return true;
    })
    .sort((a, b) => {
      const score = (item) => {
        const ageHours = Math.max(0, (now - new Date(item.timestamp).getTime()) / 3_600_000);
        const eventBoost =
          {
            commit: 50,
            offer: 35,
            up: 40,
            down: 30,
            intel: 25,
            visit: 12,
          }[item.event] ?? 0;
        const narrativeBoost = item.movementNarrative ? 18 : 0;
        return eventBoost + narrativeBoost - ageHours;
      };
      return score(b) - score(a);
    });

  const out = [];
  let visitCount = 0;
  for (const item of ranked) {
    if (isThinVisitFeedItem(item)) continue;
    if (item.event === 'visit') {
      if (visitCount >= 2) continue;
      visitCount += 1;
    }
    out.push(item);
    if (out.length >= 8) break;
  }
  return out;
}

function feedMatchesClassYear(item, classYear) {
  if (classYear == null) return true;
  if (item.class == null) return true;
  return Number(item.class) === Number(classYear);
}

async function buildMovementFeedItems(enrichedPlayers, intelRows, logs = {}, options = {}) {
  const focusYear = options.classYear != null ? Number(options.classYear) : null;
  const pool = await loadHubRecruitingPool();
  const rawMap = loadRawPlayerMap();
  const cutoff = Date.now() - FEED_WINDOW_MS;
  const visitLogs = logs.visitLogs || visitLogStore.listVisitLogs({
    since: new Date(cutoff).toISOString(),
    limit: 200,
  });
  const offerLogs = logs.offerLogs || offerLogStore.listOfferLogs({
    since: new Date(cutoff).toISOString(),
    limit: 200,
  });
  const rows = intelRows || intelStore.listIntel({ limit: 600 });
  const items = [];
  const covered = new Set();

  for (const row of rows) {
    const ts = new Date(row.reportedAt || row.timestamp || row.createdAt).getTime();
    if (!Number.isFinite(ts) || ts < cutoff) continue;
    if (!isCuratedHubIntel(row, pool)) continue;
    const slug = String(row.playerSlug).toLowerCase();
    const meta = resolveFeedMeta(slug, pool, rawMap);
    if (!meta) continue;
    if (focusYear != null && Number(meta.classYear) !== focusYear) continue;
    const playerCtx = { ...(rawMap.get(slug) || {}), ...(meta || {}), slug };
    const filtered = filterMovementIntelForPlayer([row], playerCtx);
    if (!filtered.length) continue;
    items.push(mapIntelToFeedItem(filtered[0], meta));
    covered.add(slug);
  }

  if (focusYear != null) {
    const commits = await store.getHubCommits(focusYear);
    for (const raw of commits || []) {
      const slug = String(raw.slug || '').toLowerCase();
      if (!slug || covered.has(slug)) continue;
      if (!isFloridaSchool(raw.committedTo)) continue;
      const ts = new Date(commitFeedTimestamp({}, raw)).getTime();
      if (!Number.isFinite(ts) || ts < cutoff) continue;
      if (Date.now() - ts > COMMIT_FEED_MAX_AGE_MS) continue;
      const meta = {
        slug,
        name: raw.name,
        position: playerPos(raw),
        classYear: Number(raw.classYear) || focusYear,
        profileUrl: profileUrl(raw),
        headliner: raw.headliner,
        stars: raw.stars,
        natlRank: raw.natlRank,
        commitDate: raw.commitDate,
      };
      items.push(mapCommitFeedItem(meta, raw));
      covered.add(slug);
    }
  }

  for (const log of visitLogs) {
    const slug = String(log.playerSlug || '').toLowerCase();
    if (!slug || covered.has(slug) || !hubFeedSlugAllowed(slug, focusYear, pool)) continue;
    const meta = resolveFeedMeta(slug, pool, rawMap);
    if (!meta || meta.isCommit) continue;
    if (focusYear != null && Number(meta.classYear) !== focusYear) continue;
    items.push(mapVisitLogFeedItem(log, meta));
    covered.add(slug);
  }

  for (const log of offerLogs) {
    const slug = String(log.playerSlug || '').toLowerCase();
    if (!slug || covered.has(slug) || !hubFeedSlugAllowed(slug, focusYear, pool)) continue;
    const meta = resolveFeedMeta(slug, pool, rawMap);
    if (!meta || meta.isCommit) continue;
    if (focusYear != null && Number(meta.classYear) !== focusYear) continue;
    items.push(mapOfferLogFeedItem(log, meta));
    covered.add(slug);
  }

  for (const meta of pool.values()) {
    if (meta.isCommit) continue;
    if (focusYear != null && Number(meta.classYear) !== focusYear) continue;
    if (covered.has(meta.slug)) continue;
    const raw = rawMap.get(String(meta.slug).toLowerCase()) || {};
    const merged = { ...raw, ...meta };
    // Dead elsewhere-commits (Cole → Georgia, etc.) must not appear as visit heat.
    if (isCommittedElsewhere(merged) || (raw.verifiedCommit && isCommittedElsewhere(raw))) continue;

    if (isRelevantVisit(meta.visitStart)) {
      items.push(boardVisitItem(meta));
      covered.add(meta.slug);
      continue;
    }

    if (hasRecordedOffer(merged)) {
      items.push(boardOfferItem(meta));
      covered.add(meta.slug);
      continue;
    }

    const slugIntel = rows.filter(
      (r) => String(r.playerSlug || r.player_slug || '').toLowerCase() === String(meta.slug).toLowerCase()
    );
    const competitorRow = slugIntel.find((row) => {
      const ts = new Date(row.reportedAt || row.timestamp || row.createdAt).getTime();
      if (!Number.isFinite(ts) || ts < cutoff) return false;
      const et = String(row.eventType || '').toLowerCase();
      return (
        et === 'prediction_change' ||
        et === 'rivals_futurecast' ||
        et === 'prediction' ||
        row.predictionSchool ||
        row.nextVisitSchool
      );
    });
    if (competitorRow) {
      items.push(boardCompetitorChangeItem(meta, competitorRow));
      covered.add(meta.slug);
      continue;
    }

    if (isHubPlayerSuppressed(meta.slug, rawMap, pool)) continue;
    if (meta.movementDirection !== 'up' && meta.movementDirection !== 'down') continue;
    items.push(boardMovementItem(meta));
    covered.add(meta.slug);
  }

  void enrichedPlayers;

  const seen = new Set();
  const deduped = [];
  for (const item of items.sort((a, b) => {
    const wa = FEED_EVENT_WEIGHT[a.event] ?? 8;
    const wb = FEED_EVENT_WEIGHT[b.event] ?? 8;
    if (wa !== wb) return wa - wb;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  })) {
    const slugKey = String(item.name || '')
      .toLowerCase()
      .replace(/\s+/g, '-');
    const day = new Date(item.timestamp).toDateString();
    const key = `${slugKey}:${item.event}:${day}:${String(item.summary || '').slice(0, 64)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!feedMatchesClassYear(item, focusYear)) continue;
    deduped.push(item);
    if (deduped.length >= 40) break;
  }

  const enriched = enrichMovementFeedWithNarratives(deduped, visitLogs);
  return curateHubMovementFeed(enriched);
}

function countFloridaVisits(player) {
  let count = 0;
  if (player.visitStart && isFloridaSchool(player.nextVisitSchool)) count += 1;

  const visitArrays = [player.visits, player.visitHistory].filter(Array.isArray);
  for (const arr of visitArrays) {
    for (const visit of arr) {
      if (!visit) continue;
      const school =
        typeof visit === 'string'
          ? visit
          : visit.school || visit.visitSchool || visit.host || visit.location || '';
      if (isFloridaSchool(school)) count += 1;
    }
  }
  return count;
}

function classifyIntelSentiment(row) {
  const et = String(row.eventType || '').toLowerCase();
  const delta = Number(row.movementDelta);
  if (et === 'momentum_down' || et === 'visit_cancelled' || delta < 0) return 'negative';
  if (
    et === 'momentum_up' ||
    et === 'offer' ||
    et === 'official_visit' ||
    et === 'unofficial_visit' ||
    et === 'visit' ||
    et === 'flip_watch' ||
    delta > 0
  ) {
    return 'positive';
  }
  return null;
}

function buildFootprintPayload(enrichedPlayers, intelRows, logs = {}) {
  const visitLogs = logs.visitLogs || [];
  const offerLogs = logs.offerLogs || [];
  const now = Date.now();
  const cutoffMomentum = now - MOMENTUM_WINDOW_MS;
  const cutoffOffer = now - OFFER_INTEL_WINDOW_MS;
  const stateBuckets = new Map();

  function ensureState(st) {
    if (!stateBuckets.has(st)) {
      stateBuckets.set(st, {
        state: st,
        targets: 0,
        commits: 0,
        offers: 0,
        visits: 0,
        ufScores: [],
        positiveIntel: 0,
        negativeIntel: 0,
        competitorScores: [],
        playerRecords: [],
        staffMap: new Map(),
      });
    }
    return stateBuckets.get(st);
  }

  for (const player of enrichedPlayers) {
    const st = player.geo?.hometownState || resolvePlayerState(player);
    if (!st) continue;

    const bucket = ensureState(st);
    const slug = String(player.slug).toLowerCase();
    const playerIntel = intelRows.filter(
      (r) => String(r.playerSlug || r.player_slug || '').toLowerCase() === slug
    );

    const isCommit = player.isCommit || player.isCommittedToUF;
    const isTarget = !isCommit && (player.isTarget || player.isPortal);

    if (isCommit) bucket.commits += 1;
    if (isTarget) bucket.targets += 1;

    let offerCount = countFloridaOffers(player);
    let visitCount = countFloridaVisits(player);

    for (const row of playerIntel) {
      const ts = new Date(row.reportedAt || row.timestamp || row.createdAt).getTime();
      if (!Number.isFinite(ts)) continue;
      const et = String(row.eventType || '').toLowerCase();
      if (et === 'offer' && ts >= cutoffOffer) offerCount += 1;
      if (PUBLIC_VISIT.has(et)) visitCount += 1;
    }

    for (const log of offerLogs) {
      if (String(log.playerSlug || '').toLowerCase() !== slug) continue;
      if (isFloridaSchool(log.school)) offerCount += 1;
    }
    for (const log of visitLogs) {
      if (String(log.playerSlug || '').toLowerCase() !== slug) continue;
      if (isFloridaSchool(log.school)) visitCount += 1;
    }

    bucket.offers += offerCount;
    bucket.visits += visitCount;

    const ufScore = player.ufScore ?? resolveStrictUfScore(player, playerIntel);
    if (ufScore != null) bucket.ufScores.push(ufScore);

    const competitorScore = player.topCompetitorScore ?? topCompetitorScore(player.competitors || []);
    if (competitorScore != null) bucket.competitorScores.push(competitorScore);

    const trend = player.trend || 'flat';

    bucket.playerRecords.push({
      id: player.slug,
      name: player.name,
      position: playerPos(player),
      class: player.classYear,
      status: isCommit ? 'commit' : 'target',
      ufScore,
      competitorScore,
      trend,
      isPortal: Boolean(player.isPortal),
      battleDifficulty:
        ufScore != null && competitorScore != null
          ? getBattleDifficulty(ufScore, competitorScore, trend)
          : 'unknown',
      pinLat: player.geo?.pinLat ?? player.pinLat ?? null,
      pinLng: player.geo?.pinLng ?? player.pinLng ?? null,
    });

    const staff = player.staff || resolveStaffEntry(player);
    if (staff) {
      const staffKey = staff.staffId;
      const entry = bucket.staffMap.get(staffKey) || {
        staffId: staff.staffId,
        name: staff.name,
        role: staff.role,
        assignedPlayers: 0,
        wins: 0,
        losses: 0,
      };
      entry.assignedPlayers += 1;
      if (isCommit) entry.wins += 1;
      else if (player.movementDirection === 'down' || player.committedTo) entry.losses += 1;
      bucket.staffMap.set(staffKey, entry);
    }
  }

  for (const row of intelRows) {
    const slug = String(row.playerSlug || row.player_slug || '').toLowerCase();
    const player = enrichedPlayers.find((p) => String(p.slug).toLowerCase() === slug);
    if (!player) continue;
    const st = player.geo?.hometownState || resolvePlayerState(player);
    if (!st) continue;
    const ts = new Date(row.reportedAt || row.timestamp || row.createdAt).getTime();
    if (!Number.isFinite(ts) || ts < cutoffMomentum) continue;
    const sentiment = classifyIntelSentiment(row);
    if (!sentiment) continue;
    const bucket = ensureState(st);
    if (sentiment === 'positive') bucket.positiveIntel += 1;
    else bucket.negativeIntel += 1;
  }

  const pins = [];
  const states = [];

  for (const bucket of stateBuckets.values()) {
    const hasActivity =
      bucket.targets + bucket.commits + bucket.offers + bucket.visits > 0 ||
      bucket.positiveIntel + bucket.negativeIntel > 0;
    if (!hasActivity) continue;

    const ufScore = bucket.ufScores.length
      ? Math.round(bucket.ufScores.reduce((a, b) => a + b, 0) / bucket.ufScores.length)
      : null;

    const competitorPressure = bucket.competitorScores.length
      ? Math.round(bucket.competitorScores.reduce((a, b) => a + b, 0) / bucket.competitorScores.length)
      : null;

    const rawPipeline =
      bucket.commits * 10 +
      bucket.offers * 3 +
      bucket.visits * 4 +
      bucket.targets * 2 +
      bucket.positiveIntel * 5 -
      bucket.negativeIntel * 5;

    const pipelineScore = normalizePipelineScore(rawPipeline);
    if (pipelineScore <= 0 && !hasActivity) continue;

    let momentum = 'flat';
    if (bucket.positiveIntel > bucket.negativeIntel) momentum = 'up';
    else if (bucket.negativeIntel > bucket.positiveIntel) momentum = 'down';

    const topPlayers = [...bucket.playerRecords]
      .sort((a, b) => (b.ufScore ?? -1) - (a.ufScore ?? -1))
      .slice(0, 5)
      .map(({ trend, isPortal, battleDifficulty, ...rest }) => {
        void trend;
        void isPortal;
        void battleDifficulty;
        const centroid = STATE_CENTROIDS[bucket.state];
        return {
          ...rest,
          pinLat: rest.pinLat ?? centroid?.lat ?? null,
          pinLng: rest.pinLng ?? centroid?.lng ?? null,
        };
      });

    const staffActivity = [...bucket.staffMap.values()].filter((s) => s.assignedPlayers > 0);

    states.push({
      state: bucket.state,
      targets: bucket.targets,
      commits: bucket.commits,
      offers: bucket.offers,
      visits: bucket.visits,
      ufScore,
      competitorPressure,
      pipelineScore,
      momentum,
      topPlayers,
      staffActivity,
    });

    for (const rec of bucket.playerRecords) {
      const centroid = STATE_CENTROIDS[bucket.state];
      let lat = rec.pinLat ?? centroid?.lat ?? null;
      let lng = rec.pinLng ?? centroid?.lng ?? null;
      if (lat == null || lng == null) continue;

      const usedCentroid = rec.pinLat == null && rec.pinLng == null && centroid;
      if (usedCentroid) {
        const pinIdx = bucket.playerRecords.indexOf(rec);
        const col = pinIdx % 5;
        const rowIdx = Math.floor(pinIdx / 5) % 5;
        lat += (col - 2) * 0.12;
        lng += (rowIdx - 2) * 0.12;
      }

      let pinType = 'target';
      if (rec.status === 'commit') pinType = 'commit';
      else if (rec.isPortal) pinType = 'portal';
      else if (rec.battleDifficulty === 'flip' || rec.battleDifficulty === 'hard') pinType = 'battle';

      pins.push({
        id: rec.id,
        name: rec.name,
        state: bucket.state,
        lat,
        lng,
        status: rec.status,
        ufScore: rec.ufScore,
        pinType,
      });
    }
  }

  states.sort((a, b) => b.pipelineScore - a.pipelineScore);

  return {
    states,
    pins,
    meta: {
      playerCount: enrichedPlayers.length,
      stateCount: states.length,
      pinCount: pins.length,
    },
  };
}

async function buildHubMovementFeed(year = 2027) {
  const focusYear = Number(year) || 2027;
  const dataset = await loadHubDataset({ classYears: [focusYear] });
  return buildMovementFeedItems([...dataset.players.values()], dataset.intelRows, {
    visitLogs: dataset.visitLogs,
    offerLogs: dataset.offerLogs,
  }, { classYear: focusYear });
}

async function buildHubBattleBoard(year = 2027) {
  const focusYear = Number(year) || 2027;
  const dataset = await loadHubDataset({ classYears: [focusYear] });
  return buildBattleBoardRows(
    [...dataset.players.values()].filter(
      (p) => !p.isCommit && Number(p.classYear) === focusYear
    )
  );
}

async function buildHubFootprint(year = null) {
  const classYears =
    year != null && Number.isFinite(Number(year)) ? [Number(year)] : DEFAULT_CLASS_YEARS;
  const dataset = await loadHubDataset({ classYears });
  return buildFootprintPayload([...dataset.players.values()], dataset.intelRows, {
    visitLogs: dataset.visitLogs,
    offerLogs: dataset.offerLogs,
  });
}

module.exports = {
  loadHubDataset,
  enrichHubPlayer,
  buildBattleBoardRows,
  buildMovementFeedItems,
  buildFootprintPayload,
  buildHeatIndexRows,
  buildBattlesListRows,
  buildBattleContext,
  buildHubMovementFeed,
  buildHubBattleBoard,
  buildHubFootprint,
};
