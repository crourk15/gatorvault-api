/**
 * Recruiting Hub Elite — payload builders for /api/recruiting/hub/*
 */
const store = require('./recruiting-store');
const { enrichBoard } = require('./recruiting-board-enrich');
const { buildHeatCheck } = require('./heat-check-store');

const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE', 'OL', 'OT', 'OG', 'C', 'DL', 'EDGE', 'LB', 'CB', 'S', 'ATH', 'K', 'P'];

function playerPos(player) {
  return player.position || player.pos || '—';
}

function normalizePos(raw) {
  const p = String(raw || '').toUpperCase().trim();
  if (p === 'EDGE' || p === 'DE' || p === 'DT') return 'DL';
  return p || '—';
}

function parseUfPct(raw) {
  if (raw == null || !Number.isFinite(Number(raw))) return 0;
  const num = Number(raw);
  return Math.min(100, Math.max(0, Math.round(num <= 1 ? num * 100 : num)));
}

function futureCastTag(pct) {
  if (pct >= 70) return 'Lean UF';
  if (pct >= 34) return 'Battle';
  return 'Lean Elsewhere';
}

function trendDisplay(trend) {
  if (trend === 'up') return 'Rising';
  if (trend === 'down') return 'Falling';
  return 'Stable';
}

function trendFromDelta(delta) {
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'stable';
}

function buildSparkline(base, trend) {
  const points = 7;
  const values = [];
  for (let i = 0; i < points; i += 1) {
    const progress = i / (points - 1);
    const drift = trend === 'up' ? progress * 12 : trend === 'down' ? (1 - progress) * 12 : 0;
    values.push(Math.max(0, Math.round(base - 6 + drift + (i % 2 === 0 ? 1 : 0))));
  }
  return values;
}

function blueChipPct(players) {
  if (!players.length) return null;
  const blue = players.filter((p) => (Number(p.stars) || 0) >= 4).length;
  return Math.round((blue / players.length) * 100);
}

function avgRating(players) {
  const ratings = players
    .map((p) => p.rating ?? p.displayRating ?? p.vaultGrade)
    .filter((v) => v != null && Number.isFinite(Number(v)) && Number(v) > 0);
  if (!ratings.length) return null;
  return ratings.reduce((sum, v) => sum + Number(v), 0) / ratings.length;
}

function formatRating(raw) {
  if (raw == null || !Number.isFinite(Number(raw))) return '—';
  const n = Number(raw);
  return n <= 1 ? (n * 100).toFixed(2) : n.toFixed(1);
}

function formatRank(rank) {
  if (rank == null || !Number.isFinite(Number(rank))) return '—';
  return `#${rank}`;
}

function formatCommitDate(player) {
  if (!player.commitDate) return 'Recently';
  const d = new Date(player.commitDate);
  if (Number.isNaN(d.getTime())) return String(player.commitDate);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function commitStatusBadge(player) {
  if (player.headliner) return 'Headliner';
  if ((Number(player.stars) || 0) >= 5) return 'Locked';
  if ((Number(player.stars) || 0) >= 4) return 'Solid';
  return undefined;
}

function rankNote(player) {
  const preview = player.skinny ?? player.notePreview ?? player.notes ?? player.profileNote;
  if (preview && String(preview).trim()) return String(preview).trim();
  const pos = playerPos(player);
  return `NATL ${formatRank(player.natlRank ?? player.natl)} · POS ${formatRank(player.posRank)} (${pos})`;
}

function profileUrl(player) {
  const slug = player.slug || String(player.name || '').toLowerCase().replace(/\s+/g, '-');
  return `/vault/recruiting/player/${encodeURIComponent(slug)}`;
}

async function loadEnrichedBoard(year) {
  const board = await store.getBoard(year);
  return enrichBoard(board, false);
}

async function buildHubTicker(year = 2027) {
  const enriched = await loadEnrichedBoard(year);
  const commits = enriched.commits || [];
  const targets = enriched.targets || [];
  const rank = enriched.rankings?.nationalRank;
  const chip = blueChipPct([...commits, ...targets]);
  const items = [];

  if (rank) items.push(`${year} class trending nationally — UF at #${rank}`);
  if (chip != null) items.push(`Blue chip % at ${chip}% and climbing`);
  if (commits.length) items.push(`${commits.length} commits locked for ${year}`);
  items.push('Battles heating up on the board — movement intel live');

  try {
    const heat = await buildHeatCheck();
    for (const row of (heat.rising || []).slice(0, 2)) {
      const label = row.headline || row.triggerLabel || `${row.playerName} trending up`;
      items.push(label);
    }
  } catch {
    /* optional heat feed */
  }

  const fallbacks = [
    'Staff locked in for summer evals and camps',
    'FutureCast tracking multiple UF leaners',
    'Portal watch active — movement on the board',
  ];

  return [...items, ...fallbacks].slice(0, 4);
}

async function buildHubClassOverview(year = 2027) {
  const enriched = await loadEnrichedBoard(year);
  const commits = enriched.commits || [];
  const targets = enriched.targets || [];
  const pool = [...commits, ...targets];
  const chip = blueChipPct(pool);
  const avg = avgRating(pool);

  let rising = 0;
  let falling = 0;
  try {
    const { buildMovementSummaryPayload } = require('../api/recruiting/movement-summary.ts');
    const summary = await buildMovementSummaryPayload();
    rising = summary.rising ?? 0;
    falling = summary.falling ?? 0;
  } catch {
    rising = targets.filter((p) => p.movementDirection === 'up').length;
    falling = targets.filter((p) => p.movementDirection === 'down').length;
  }

  const rankTrend = trendFromDelta(falling - rising);
  const chipTrend = chip != null && chip >= 70 ? 'up' : 'stable';
  const commitTrend = commits.length > 0 ? 'up' : 'stable';
  const ratingTrend = rising >= 2 ? 'up' : rising === 0 && falling > 0 ? 'down' : 'stable';

  return {
    classRank: enriched.rankings?.nationalRank != null ? `#${enriched.rankings.nationalRank}` : '—',
    blueChip: chip != null ? `${chip}%` : '—',
    commits: commits.length ? String(commits.length) : '—',
    avgRating: avg != null ? formatRating(avg) : '—',
    trendRank: trendDisplay(rankTrend),
    trendBlueChip: trendDisplay(chipTrend),
    trendCommits: trendDisplay(commitTrend),
    trendRating: trendDisplay(ratingTrend),
    sparklines: {
      classRank: buildSparkline(enriched.rankings?.nationalRank ?? 10, rankTrend === 'up' ? 'down' : rankTrend),
      blueChip: buildSparkline(chip ?? 60, chipTrend),
      commits: buildSparkline(commits.length || 18, commitTrend),
      avgRating: buildSparkline(Math.round((avg ?? 90) - 80), ratingTrend),
    },
  };
}

function movementLabel(player) {
  if (player.movementDirection === 'up') return 'Trending up';
  if (player.movementDirection === 'down') return 'Trending down';
  return 'Stable';
}

function stabilityMeter(player) {
  const raw = player.stabilityScore ?? player.fitScore ?? parseUfPct(player.ufProbability);
  if (raw >= 80) return 'Locked In';
  if (raw >= 55) return 'Steady';
  if (raw >= 35) return 'Tracking';
  return 'Volatile';
}

function formatNilEstimate(player) {
  const raw = player.nilEstimate ?? player.nilValue ?? player.nilProjection;
  if (raw != null && raw !== '') {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return raw >= 1000 ? `$${Math.round(raw / 1000)}K` : `$${Math.round(raw)}`;
    }
    return String(raw);
  }
  const stars = Number(player.stars) || 0;
  if (stars >= 5) return '$400K–$750K';
  if (stars >= 4) return '$75K–$250K';
  if (stars >= 3) return '$15K–$75K';
  return null;
}

function formatStrengths(player) {
  const list = player.strengths;
  if (Array.isArray(list) && list.length) return list.slice(0, 2).join(' · ');
  return null;
}

function formatWeaknesses(player) {
  const list = player.weaknesses;
  if (Array.isArray(list) && list.length) return list.slice(0, 2).join(' · ');
  return null;
}

function mapHubCommit(player, classYear) {
  const pct = parseUfPct(player.ufProbability);
  const slug = player.slug || player.name;
  return {
    id: slug,
    name: player.name,
    position: playerPos(player),
    rating: formatRating(player.displayRating ?? player.rating ?? player.vaultGrade),
    rankNote: rankNote(player),
    commitDate: formatCommitDate(player),
    statusBadge: classYear >= 2027 ? commitStatusBadge(player) : 'Enrolled',
    profileUrl: profileUrl(player),
    stabilityMeter: stabilityMeter(player),
    ufPercent: pct > 0 ? `${pct}%` : '—',
    movement: movementLabel(player),
    enrolled: classYear <= 2026,
    jerseyNumber: player.jerseyNumber ?? player.jersey ?? null,
    positionRoomFit: player.schemeFit ?? (player.fitScore != null ? `Fit ${Math.round(Number(player.fitScore))}/100` : null),
    earlyImpactProjection: player.projection ?? player.earlyImpact ?? player.skinny ?? null,
    strengths: formatStrengths(player),
    weaknesses: formatWeaknesses(player),
    playerComp: player.playerComp ?? player.comp ?? null,
    gvGrade: formatRating(player.vaultGrade ?? player.displayRating ?? player.rating),
    nilEstimate: formatNilEstimate(player),
    projection: player.projection ?? player.skinny ?? player.profileNote ?? null,
    insiderIntel: player.notePreview ?? player.notes ?? player.insiderNotes ?? null,
  };
}

async function buildHubCommits(year = 2027) {
  const enriched = await loadEnrichedBoard(year);
  const commits = [...(enriched.commits || [])].sort((a, b) => {
    const ra = a.natlRank ?? a.natl ?? 9999;
    const rb = b.natlRank ?? b.natl ?? 9999;
    return ra - rb;
  });

  return commits.map((player) => mapHubCommit(player, year));
}

async function buildHubClassOverviewAll() {
  const years = [2026, 2027, 2028];
  const out = {};
  for (const year of years) {
    out[year] = await buildHubClassOverview(year);
  }
  return out;
}

async function buildHubBattles(year = 2027) {
  const enriched = await loadEnrichedBoard(year);
  const targets = enriched.targets || [];
  const battles = [];

  for (const player of targets) {
    const pct = parseUfPct(player.ufProbability);
    if (pct < 34) continue;
    battles.push({
      id: player.slug || player.name,
      name: player.name,
      position: playerPos(player),
      ufPercent: `${pct}%`,
      tag: futureCastTag(pct),
      note: player.notePreview ?? player.notes ?? player.skinny ?? 'Key battle on the board.',
      movement:
        player.movementDirection === 'up'
          ? 'Trending up'
          : player.movementDirection === 'down'
            ? 'Trending down'
            : pct >= 70
              ? 'Stable'
              : 'Stable',
    });
  }

  battles.sort((a, b) => parseInt(b.ufPercent, 10) - parseInt(a.ufPercent, 10));

  if (battles.length < 4) {
    try {
      const heat = await buildHeatCheck();
      for (const row of heat.rising || []) {
        if (battles.length >= 6) break;
        battles.push({
          id: row.playerSlug || row.playerName,
          name: row.playerName,
          position: '—',
          ufPercent: '—',
          tag: 'Battle',
          note: row.headline ?? row.triggerLabel ?? 'Movement heating up.',
          movement: 'Trending up',
        });
      }
    } catch {
      /* optional */
    }
  }

  return battles.slice(0, 6);
}

async function buildHubPositions(year = 2027) {
  const enriched = await loadEnrichedBoard(year);
  const commits = enriched.commits || [];
  const targets = enriched.targets || [];
  const rooms = new Map();

  for (const player of commits) {
    const label = normalizePos(playerPos(player));
    const entry = rooms.get(label) ?? { commits: 0, targets: 0 };
    entry.commits += 1;
    rooms.set(label, entry);
  }

  for (const player of targets) {
    if (player.tier !== 'TOP' && player.tier !== 'HIGH') continue;
    const label = normalizePos(playerPos(player));
    const entry = rooms.get(label) ?? { commits: 0, targets: 0 };
    entry.targets += 1;
    rooms.set(label, entry);
  }

  const sorted = [...rooms.entries()].sort((a, b) => {
    const ai = POSITION_ORDER.indexOf(a[0]);
    const bi = POSITION_ORDER.indexOf(b[0]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return sorted.slice(0, 8).map(([label, stats]) => ({
    id: label,
    label,
    commits: stats.commits,
    targets: stats.targets,
    note:
      stats.commits >= 2
        ? 'Room filling in'
        : stats.targets >= 2
          ? 'Active battles'
          : stats.commits >= 1
            ? 'Room anchored, selective'
            : 'Needs attention',
  }));
}

function movementArrow(player) {
  const dir = player.movementDirection;
  if (dir === 'up') return 'up';
  if (dir === 'down') return 'down';
  return 'flat';
}

function computeHeatScore(player) {
  const uf = parseUfPct(player.ufProbability);
  const fit = Number(player.fitScore);
  let heat = Math.max(uf, Number.isFinite(fit) ? Math.round(fit) : 0);

  if (player.tier === 'TOP') heat += 12;
  else if (player.tier === 'HIGH') heat += 6;

  const natl = player.natlRank ?? player.natl;
  if (natl != null && Number(natl) <= 100) heat += 12;
  else if (natl != null && Number(natl) <= 300) heat += 6;

  if (player.movementDirection === 'up') heat += 14;
  else if (player.movementDirection === 'down') heat -= 10;

  if (player.headliner) heat += 8;

  return Math.min(100, Math.max(0, Math.round(heat)));
}

function resolveBattle(player) {
  const uf = parseUfPct(player.ufProbability);
  const leader = player.leaderSchool ?? player.predictionLeader ?? player.topSchool ?? null;
  const leaderName =
    typeof leader === 'string'
      ? leader
      : leader?.name || leader?.school || 'Field';
  const isUfLeader = /florida|gators|\buf\b/i.test(String(leaderName));
  const competitor = isUfLeader
    ? Math.max(100 - uf, 8)
    : Math.min(Math.max(100 - uf, 20), 95);
  return {
    uf,
    competitor,
    competitorName: isUfLeader ? 'Field' : String(leaderName).slice(0, 24),
  };
}

function formatNextVisit(player) {
  if (!player.visitStart) return null;
  const d = new Date(player.visitStart);
  if (Number.isNaN(d.getTime())) return String(player.visitStart);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function shortInsiderNote(player) {
  const note = player.notePreview ?? player.skinny ?? player.notes;
  if (!note || !String(note).trim()) return null;
  const text = String(note).trim();
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

async function buildHubHeatIndex(year = 2027) {
  const enriched = await loadEnrichedBoard(year);
  const targets = (enriched.targets || []).filter(
    (p) => p.tier === 'TOP' || p.tier === 'HIGH' || parseUfPct(p.ufProbability) >= 34
  );

  const scored = targets.map((player) => ({
    id: player.slug || player.name,
    name: player.name,
    position: playerPos(player),
    heat: computeHeatScore(player),
    movement: movementArrow(player),
    ufPercent: parseUfPct(player.ufProbability),
    battle: resolveBattle(player),
    nextVisit: formatNextVisit(player),
    insiderNote: shortInsiderNote(player),
    profileUrl: profileUrl(player),
  }));

  scored.sort((a, b) => b.heat - a.heat);

  if (scored.length < 8) {
    try {
      const heat = await buildHeatCheck();
      for (const row of heat.rising || []) {
        if (scored.length >= 12) break;
        if (scored.some((s) => s.id === row.playerSlug || s.name === row.playerName)) continue;
        scored.push({
          id: row.playerSlug || row.playerName,
          name: row.playerName,
          position: row.position || '—',
          heat: Math.min(100, 55 + (row.score || 0)),
          movement: 'up',
          ufPercent: 0,
          battle: { uf: 0, competitor: 50, competitorName: 'Field' },
          nextVisit: null,
          insiderNote: row.headline ?? row.triggerLabel ?? null,
          profileUrl: profileUrl({ slug: row.playerSlug, name: row.playerName }),
        });
      }
    } catch {
      /* optional heat feed */
    }
  }

  return scored.slice(0, 12);
}

function mapMovementEventType(raw) {
  const et = String(raw || '').toLowerCase();
  if (/visit/.test(et)) return 'visit';
  if (et === 'offer' || /offer/.test(et)) return 'offer';
  if (/rise|up|trend|momentum|flip/.test(et)) return 'up';
  if (/fall|down|cool|slip/.test(et)) return 'down';
  return 'intel';
}

function feedItemFromIntel(row, playerMeta) {
  const slug = String(row.playerSlug || row.player_slug || playerMeta?.slug || '').trim();
  const name =
    String(row.playerName || row.player_name || playerMeta?.name || slug || 'Target').trim();
  const ts = row.reportedAt || row.timestamp || row.createdAt || new Date().toISOString();
  const event = mapMovementEventType(row.eventType || row.type || row.detail);
  const summary =
    String(row.text || row.detail || row.headline || 'Insider movement tracked on the board.').trim();

  return {
    id: String(row.id || row.fingerprint || `${slug}-${ts}`),
    timestamp: ts,
    name,
    position: playerMeta?.position || row.position || '—',
    event,
    summary,
    profileUrl: profileUrl({ slug, name }),
  };
}

async function buildHubMovementFeed(year = 2027) {
  const enriched = await loadEnrichedBoard(year);
  const bySlug = new Map();
  for (const p of [...(enriched.targets || []), ...(enriched.commits || [])]) {
    if (p.slug) bySlug.set(String(p.slug).toLowerCase(), p);
  }

  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const items = [];

  try {
    const { buildRecruitingMovementIntelPayload } = require('../api/recruiting/movement-intel.ts');
    const payload = await buildRecruitingMovementIntelPayload();
    for (const alert of payload.alerts || []) {
      const ts = alert.timestamp || new Date().toISOString();
      if (new Date(ts).getTime() < cutoff) continue;
      const event =
        alert.type === 'VISIT'
          ? 'visit'
          : alert.type === 'OFFER'
            ? 'offer'
            : alert.type === 'PREDICTION_SHIFT'
              ? 'up'
              : 'intel';
      items.push({
        id: alert.id,
        timestamp: ts,
        name: alert.player,
        position: '—',
        event,
        summary: alert.detail,
        profileUrl: '/vault/recruiting',
      });
    }

    for (const bucket of [payload.risers, payload.fallers, payload.volatile]) {
      for (const row of bucket || []) {
        const slug = String(row.slug || '').toLowerCase();
        const meta = bySlug.get(slug);
        const ts = row.lastUpdate || new Date().toISOString();
        if (new Date(ts).getTime() < cutoff) continue;
        items.push({
          id: row.id || slug,
          timestamp: ts,
          name: row.name,
          position: row.position || playerPos(meta || {}),
          event:
            row.movementType === 'FALL' ? 'down' : row.movementType === 'RISE' ? 'up' : 'intel',
          summary: `${row.name} — UF ${row.ufProb}% (${row.delta >= 0 ? '+' : ''}${row.delta} 7d)`,
          profileUrl: profileUrl(meta || { slug: row.slug, name: row.name }),
        });
      }
    }
  } catch {
    /* fallback below */
  }

  try {
    const gm2 = require('./gm2');
    const { intel } = gm2.getPublicIntel({ limit: 80, subsystem: 'recruiting-hub' });
    for (const row of intel) {
      const ts = row.reportedAt || row.timestamp || row.createdAt;
      if (!ts || new Date(ts).getTime() < cutoff) continue;
      const slug = String(row.playerSlug || '').toLowerCase();
      const meta = bySlug.get(slug);
      items.push(feedItemFromIntel(row, meta));
    }
  } catch {
    /* optional */
  }

  for (const player of enriched.targets || []) {
    if (player.movementDirection !== 'up' && player.movementDirection !== 'down') continue;
    items.push({
      id: `${player.slug}-movement`,
      timestamp: new Date().toISOString(),
      name: player.name,
      position: playerPos(player),
      event: player.movementDirection === 'up' ? 'up' : 'down',
      summary:
        player.notePreview ??
        player.skinny ??
        (player.movementDirection === 'up'
          ? 'Momentum building on the board.'
          : 'Cooling on the recruiting trail.'),
      profileUrl: profileUrl(player),
    });
  }

  const seen = new Set();
  const deduped = [];
  for (const item of items.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )) {
    const key = `${item.id}-${item.summary.slice(0, 40)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
    if (deduped.length >= 25) break;
  }

  if (deduped.length < 5) {
    try {
      const heat = await buildHeatCheck();
      for (const row of heat.rising || []) {
        if (deduped.length >= 12) break;
        deduped.push({
          id: `heat-${row.playerSlug || row.playerName}`,
          timestamp: row.updatedAt || new Date().toISOString(),
          name: row.playerName,
          position: row.position || '—',
          event: 'up',
          summary: row.headline ?? row.triggerLabel ?? 'Momentum building on the board.',
          profileUrl: profileUrl({ slug: row.playerSlug, name: row.playerName }),
        });
      }
    } catch {
      /* optional */
    }
  }

  return deduped.slice(0, 25);
}

module.exports = {
  buildHubTicker,
  buildHubClassOverview,
  buildHubClassOverviewAll,
  buildHubCommits,
  buildHubBattles,
  buildHubPositions,
  buildHubHeatIndex,
  buildHubMovementFeed,
};
