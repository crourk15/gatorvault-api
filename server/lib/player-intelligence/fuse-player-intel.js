/**
 * Phase 1 — multi-source player intel fusion.
 * Clusters intel rows for a slug, merges scouting store + visit/RPM context,
 * scores confidence, and persists fused snapshots.
 */
const { getPlayerIntelligence } = require('./index');
const intelStore = require('../recruiting-intel-store');
const { parseOn3BeatUrlIdentity } = require('../on3-recruit-discovery');
const { extractBeatFacts } = require('../autoposter/rewrite/beat-fact-extractor');
const { hasPartialFactsForPr789 } = require('../autoposter/rewrite/fact-gates');
const observationsStore = require('./observations-store');

const CONFIDENCE_PUBLISH = Number(process.env.FUSE_INTEL_PUBLISH_THRESHOLD || 0.75);
const CONFIDENCE_HOLD = Number(process.env.FUSE_INTEL_HOLD_THRESHOLD || 0.5);

function normalizeSlug(slug) {
  return String(slug || '').trim().toLowerCase();
}

function quoteExtract(text) {
  const quotes = [];
  const raw = String(text || '');
  for (const re of [/“([^”]{8,220})”/g, /"([^"]{8,220})"/g, /'([^']{8,220})'/g]) {
    let m;
    while ((m = re.exec(raw))) {
      const q = String(m[1] || '').trim();
      if (q) quotes.push(q);
    }
  }
  return [...new Set(quotes)];
}

function rowText(row) {
  return String(row?.detail || row?.skinny || row?.text || '').trim();
}

function clusterIntelRows(slug) {
  return (intelStore.getIntelForPlayer({ playerSlug: slug }) || [])
    .filter((row) => rowText(row))
    .sort((a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0));
}

function buildBeatTextFromCluster(rows) {
  const parts = [];
  const seen = new Set();
  for (const row of rows) {
    const chunk = rowText(row);
    if (!chunk || seen.has(chunk.toLowerCase())) continue;
    seen.add(chunk.toLowerCase());
    parts.push(chunk);
  }
  return parts.join(' ').trim();
}

function urlSlugMatchesPlayer(slug, rows) {
  for (const row of rows) {
    const url = row.articleUrl || row.sourceUrl || '';
    if (!url) continue;
    const id = parseOn3BeatUrlIdentity('', url);
    if (normalizeSlug(id?.playerSlug) === slug) return true;
  }
  return false;
}

function collectSources(rows, playerIntel) {
  const sources = [];
  const seen = new Set();
  for (const row of rows) {
    const url = row.articleUrl || row.sourceUrl;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    sources.push({
      label: row.analystName || row.source || 'Intel',
      url,
      observedAt: row.timestamp || row.createdAt || null,
      source: row.source || null
    });
  }
  const profile = playerIntel?.identity?.on3ProfileUrl;
  if (profile && !seen.has(profile)) {
    sources.push({
      label: 'On3',
      url: profile,
      observedAt: playerIntel.identity?.updatedAt || null,
      source: 'on3_profile'
    });
  }
  return sources;
}

function buildSignalFromPlayerIntel(slug, beatText, playerIntel) {
  const identity = playerIntel?.identity || {};
  const tokens = playerIntel?.rankingTokens || null;
  const competitors = (playerIntel?.competitors || []).map((row) => ({
    school: row.school || row.name,
    pct: row.pct != null ? Number(row.pct) : row.score != null ? Number(row.score) : null
  }));

  return {
    player: {
      name: identity.name,
      classYear: identity.classYear,
      pos: identity.pos,
      rankingTokens: tokens,
      stars: tokens?.on3Stars ?? null,
      natlRank: tokens?.on3NationalRank ?? null,
      posRank: tokens?.on3PositionRank ?? null,
      stateRank: tokens?.on3StateRank ?? null,
      state: identity.hometownState || null,
      hometownState: identity.hometownState || null
    },
    playerSlug: slug,
    beatText,
    metrics: {
      rpmTop: competitors.filter((row) => row.school),
      ufRpmPct: playerIntel?.rpm?.ufPct ?? null,
      rpm: playerIntel?.rpm?.ufPct ?? null
    }
  };
}

function computeConfidence({ slug, rows, beatText, playerIntel, urlSlugMatch }) {
  let c = 0.35;
  if (playerIntel?.identity?.name) c += 0.15;
  if (urlSlugMatch) c += 0.2;
  if (playerIntel?.rankingBlock?.valid) c += 0.12;
  else if (playerIntel?.identity?.on3Id) c += 0.05;
  if ((playerIntel?.visits || []).length) c += 0.08;
  if (playerIntel?.rpm?.ufPct != null && Number(playerIntel.rpm.ufPct) > 0) c += 0.05;
  const quotes = quoteExtract(beatText);
  if (quotes.length) c += 0.12;
  if (/staff|coach|visit|campus|gainesville|swamp|board|interest|standing out/i.test(beatText)) c += 0.08;
  if (beatText.length >= 120) c += 0.05;
  else if (beatText.length < 60) c -= 0.1;
  const beatRows = rows.filter((row) => /beat|on3-team-news|detectives|auto:on3/i.test(String(row.source || '')));
  if (beatRows.length >= 2) c += 0.05;
  if (normalizeSlug(slug) && rows.some((row) => normalizeSlug(row.playerSlug) === slug)) c += 0.05;
  const on3ArticleMatch = rows.some((row) => {
    if (!/on3-team-news/i.test(String(row.source || ''))) return false;
    const url = String(row.articleUrl || row.sourceUrl || '').toLowerCase();
    return url.includes(slug);
  });
  if (on3ArticleMatch) c += 0.12;
  return Math.min(1, Math.max(0, Math.round(c * 100) / 100));
}

function resolvePublishAction(confidence) {
  if (confidence >= CONFIDENCE_PUBLISH) return 'publish';
  if (confidence >= CONFIDENCE_HOLD) return 'hold';
  return 'archive';
}

function fusedBeatIntelEnqueueAllowed(fused, tier, intel) {
  if (!fused) return false;
  if (fused.publishAction === 'publish') return true;
  if (fused.publishAction === 'archive') return false;
  const src = String(intel?.source || fused.primaryIntelRow?.source || '');
  const beatIntel = /beat|on3-team-news|detectives|auto:on3/i.test(src);
  if (fused.publishAction !== 'hold' || !beatIntel) return false;
  if (tier === 'A') return true;
  if (tier === 'B' && fused.urlSlugMatch) return true;
  if (/auto:on3-team-news|on3-team-news/i.test(src) && fused.urlSlugMatch) return true;
  return false;
}

function on3SyncFromPlayerIntel(playerIntel) {
  const tokens = playerIntel?.rankingTokens || null;
  const valid = playerIntel?.rankingBlock?.valid === true;
  return {
    ok: valid,
    rankingValid: valid,
    stars: tokens?.on3Stars ?? null,
    natlRank: tokens?.on3NationalRank ?? null,
    posRank: tokens?.on3PositionRank ?? null,
    stateRank: tokens?.on3StateRank ?? null,
    rankingTokens: tokens
  };
}

function playerRowFromIntel(playerIntel) {
  const id = playerIntel?.identity || {};
  return {
    name: id.name,
    pos: id.pos,
    classYear: id.classYear,
    hometownState: id.hometownState,
    state: id.hometownState,
    competitors: (playerIntel?.competitors || []).map((row) => ({
      school: row.school || row.name,
      pct: row.pct != null ? Number(row.pct) : row.score != null ? Number(row.score) : null
    }))
  };
}

/**
 * @param {string} slugOrId
 * @param {object} [opts]
 * @param {boolean} [opts.persist=true]
 * @returns {Promise<object|null>}
 */
async function fusePlayerIntel(slugOrId, opts = {}) {
  const slug = normalizeSlug(slugOrId);
  if (!slug) return null;

  const playerIntel = await getPlayerIntelligence(slug, opts);
  if (!playerIntel) return null;

  const rows = clusterIntelRows(slug);
  const urlSlugMatch = urlSlugMatchesPlayer(slug, rows);
  const beatText = buildBeatTextFromCluster(rows);
  const quotes = quoteExtract(beatText);
  const signal = buildSignalFromPlayerIntel(slug, beatText, playerIntel);
  const facts = extractBeatFacts(beatText, {
    signal,
    metrics: signal.metrics,
    player: signal.player
  });

  const confidence = computeConfidence({ slug, rows, beatText, playerIntel, urlSlugMatch });
  const gaps = [...(playerIntel.gaps || [])];
  if (!beatText) gaps.push('missing_beat_text');
  if (!quotes.length && !hasPartialFactsForPr789(facts)) gaps.push('thin_beat_intel');

  const fused = {
    slug,
    beatText,
    signal,
    quotes,
    facts,
    confidence,
    publishAction: resolvePublishAction(confidence),
    gaps: [...new Set(gaps)],
    sources: collectSources(rows, playerIntel),
    intelRowCount: rows.length,
    primaryIntelRow: rows[0] || null,
    coverageTier: playerIntel.coverageTier,
    playerIntel,
    on3Sync: on3SyncFromPlayerIntel(playerIntel),
    playerRow: playerRowFromIntel(playerIntel),
    urlSlugMatch,
    fusedAt: new Date().toISOString()
  };

  if (opts.persist !== false) {
    observationsStore.appendSnapshot(slug, {
      ...playerIntel,
      fusedIntel: {
        beatText,
        confidence,
        publishAction: fused.publishAction,
        gaps: fused.gaps,
        quoteCount: quotes.length,
        intelRowCount: rows.length,
        urlSlugMatch,
        fusedAt: fused.fusedAt
      }
    });
  }

  return fused;
}

module.exports = {
  fusePlayerIntel,
  clusterIntelRows,
  buildBeatTextFromCluster,
  computeConfidence,
  resolvePublishAction,
  on3SyncFromPlayerIntel,
  playerRowFromIntel,
  CONFIDENCE_PUBLISH,
  CONFIDENCE_HOLD,
  fusedBeatIntelEnqueueAllowed
};
