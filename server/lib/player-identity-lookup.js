/**
 * Player Identity Lookup — fill missing prediction-post identity from verified recruiting sources.
 * No AI guessing. Confirmation: 2 matching sources OR 1 source with confidence ≥ 90%.
 */
const on3Recruit = require('./on3-recruit-client');
const { slugify } = require('./slug');
const fetch = require('node-fetch');

const CITY_STATE_RE = /^[A-Za-z .'-]+,\s*[A-Z]{2}\b/;
const MIN_SINGLE_SOURCE_CONFIDENCE = 90;
const CLASS_YEARS = (process.env.IDENTITY_LOOKUP_CLASS_YEARS || '2026,2027,2028,2029')
  .split(',')
  .map((y) => parseInt(y.trim(), 10))
  .filter((y) => !Number.isNaN(y));

function normalizeNameKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function looksLikeCityState(value) {
  return CITY_STATE_RE.test(String(value || '').trim());
}

function hasValue(value) {
  if (value == null || value === '') return false;
  if (typeof value === 'number') return Number.isFinite(value);
  return String(value).trim().length > 0;
}

function parseStars(value) {
  const n = parseInt(value, 10);
  return n >= 1 && n <= 5 ? n : null;
}

function parseRpm(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : null;
}

function similarSchool(a, b) {
  const x = String(a || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const y = String(b || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

function buildSnapshot(raw) {
  if (!raw) return null;
  const playerName = String(raw.playerName || raw.name || '').trim();
  if (!playerName) return null;

  const schoolField = String(raw.school || '').trim();
  let highSchool = String(raw.highSchool || '').trim() || null;
  let hometownState = String(raw.hometownState || raw.hometown || '').trim() || null;

  if (!highSchool && schoolField && !looksLikeCityState(schoolField)) highSchool = schoolField;
  if (!hometownState && looksLikeCityState(schoolField)) hometownState = schoolField;

  return {
    playerName,
    playerSlug: raw.playerSlug || raw.slug || null,
    on3Id: raw.on3Id != null ? String(raw.on3Id) : null,
    stars: parseStars(raw.stars),
    pos: String(raw.pos || raw.position || '')
      .trim()
      .toUpperCase() || null,
    classYear: raw.classYear != null ? Number(raw.classYear) : null,
    highSchool,
    hometownState,
    natlRank: raw.natlRank != null ? Number(raw.natlRank) : null,
    ufRpmPct: parseRpm(raw.ufRpmPct)
  };
}

function snapshotsMatch(a, b) {
  if (!a || !b) return false;
  if (normalizeNameKey(a.playerName) !== normalizeNameKey(b.playerName)) return false;

  let score = 0;
  if (a.on3Id && b.on3Id && String(a.on3Id) === String(b.on3Id)) score += 3;
  if (a.classYear && b.classYear && Number(a.classYear) === Number(b.classYear)) score += 1;
  if (a.pos && b.pos && a.pos.toUpperCase() === b.pos.toUpperCase()) score += 1;
  if (a.highSchool && b.highSchool && similarSchool(a.highSchool, b.highSchool)) score += 1;
  if (a.hometownState && b.hometownState && a.hometownState.toLowerCase() === b.hometownState.toLowerCase()) {
    score += 1;
  }
  return score >= 2;
}

function confirmIdentity(sources) {
  const valid = (sources || []).filter((s) => s?.snapshot?.playerName && Number(s.confidence) > 0);

  const highConfidence = valid.find((s) => s.confidence >= MIN_SINGLE_SOURCE_CONFIDENCE);
  if (highConfidence) {
    return {
      confirmed: true,
      mode: 'single_high_confidence',
      confidence: highConfidence.confidence,
      sources: valid,
      matchedSources: [highConfidence]
    };
  }

  for (let i = 0; i < valid.length; i += 1) {
    for (let j = i + 1; j < valid.length; j += 1) {
      if (snapshotsMatch(valid[i].snapshot, valid[j].snapshot)) {
        return {
          confirmed: true,
          mode: 'dual_source_match',
          confidence: Math.min(valid[i].confidence, valid[j].confidence),
          sources: valid,
          matchedSources: [valid[i], valid[j]]
        };
      }
    }
  }

  return {
    confirmed: false,
    mode: 'unconfirmed',
    confidence: valid.length ? Math.max(...valid.map((s) => s.confidence)) : 0,
    sources: valid,
    matchedSources: []
  };
}

function mergeMissingFields(existing, matchedSources) {
  const merged = { ...(existing || {}) };
  const ordered = [...(matchedSources || [])].sort((a, b) => b.confidence - a.confidence);
  const fields = ['playerName', 'playerSlug', 'on3Id', 'stars', 'pos', 'classYear', 'highSchool', 'hometownState', 'natlRank', 'ufRpmPct'];

  for (const field of fields) {
    if (hasValue(merged[field])) continue;
    for (const src of ordered) {
      const val = src.snapshot?.[field];
      if (hasValue(val)) {
        merged[field] = val;
        break;
      }
    }
  }
  return merged;
}

function sourceFromGatorVault(player, { confidence = 90 } = {}) {
  if (!player?.name) return null;
  const schoolField = String(player.school || '').trim();
  return {
    provider: 'gatorvault_store',
    label: 'GatorVault recruiting store',
    confidence: player.on3Id ? confidence : Math.min(confidence, 78),
    snapshot: buildSnapshot({
      playerName: player.name,
      playerSlug: player.slug,
      on3Id: player.on3Id,
      stars: player.stars,
      pos: player.pos,
      classYear: player.classYear,
      school: schoolField,
      highSchool: player.fromSchool || player.highSchool,
      hometownState: looksLikeCityState(schoolField) ? schoolField : null,
      natlRank: player.natlRank,
      ufRpmPct: player.ufRpmPct
    })
  };
}

function sourceFromRivalsRow(row) {
  if (!row?.playerName) return null;
  return {
    provider: 'rivals_pm',
    label: 'Rivals Prediction Machine',
    confidence: row.on3Id && row.pos && row.stars ? 93 : 88,
    snapshot: buildSnapshot({
      playerName: row.playerName,
      playerSlug: row.playerSlug,
      on3Id: row.on3Id,
      stars: row.stars,
      pos: row.pos,
      classYear: row.classYear,
      highSchool: row.highSchool,
      hometownState: row.hometownState,
      school: row.school,
      natlRank: row.natlRank,
      ufRpmPct: row.ufRpmPct
    })
  };
}

function sourceFromIntel(intel) {
  if (!intel?.playerName) return null;
  const hasCore = intel.stars && intel.pos && intel.classYear;
  return {
    provider: 'intel_store',
    label: 'GatorVault intel store',
    confidence: hasCore ? 85 : 70,
    snapshot: buildSnapshot({
      playerName: intel.playerName,
      playerSlug: intel.playerSlug,
      on3Id: intel.playerId,
      stars: intel.stars,
      pos: intel.pos,
      classYear: intel.classYear,
      highSchool: intel.highSchool,
      hometownState: intel.hometownState,
      school: intel.school,
      natlRank: intel.natlRank,
      ufRpmPct: intel.ufRpmPct
    })
  };
}

function parseOn3PagePropsIdentity(pp, classYearHint) {
  if (!pp?.player) return null;
  const player = pp.player;
  const recruitment =
    (pp.recruitments || []).find((r) => r.year === classYearHint) ||
    (pp.recruitments || []).find((r) => r.year === 2027 || r.year === 2026) ||
    (pp.recruitments || [])[0];

  const rating = pp.rankingsPlayer?.consensusRating || pp.rankingsPlayer || recruitment?.rating || {};
  const classYear = recruitment?.year || classYearHint || player.classYear || null;
  const hometownState =
    player.hometown?.abbr ||
    (player.homeTown?.city && player.homeTown?.stateAbbr
      ? `${player.homeTown.city}, ${player.homeTown.stateAbbr}`
      : null);
  const highSchool = player.highSchoolName || player.highSchool?.name || '';
  const topTeams = pp.topTeams?.list || pp.topTeams || [];
  const uf = on3Recruit.getFloridaTeam(topTeams, classYear);
  const ufRpmPct = uf?.prediction != null ? Math.round(Number(uf.prediction) * 10) / 10 : null;

  return buildSnapshot({
    playerName: player.fullName || player.name,
    playerSlug: player.slug,
    on3Id: player.key || player.id,
    stars: rating.stars || rating.consensusStars,
    pos: player.positionAbbr || recruitment?.positionAbbreviation || player.position?.abbr,
    classYear,
    highSchool,
    hometownState,
    natlRank: rating.nationalRank || rating.consensusNationalRank,
    ufRpmPct
  });
}

async function sourceFromOn3Profile(recruitSlug, classYearHint) {
  if (!recruitSlug) return null;
  try {
    const url = `${on3Recruit.SITE}/rivals/${String(recruitSlug).replace(/^\//, '')}/`;
    const pp = await on3Recruit.fetchNextPageProps(url, classYearHint);
    const snapshot = parseOn3PagePropsIdentity(pp, classYearHint);
    if (!snapshot?.playerName) return null;
    return {
      provider: 'on3_profile',
      label: 'On3 recruit profile',
      confidence: snapshot.on3Id ? 95 : 90,
      snapshot,
      url: `https://www.on3.com/rivals/${recruitSlug.replace(/^\//, '')}/`
    };
  } catch {
    return null;
  }
}

function walk247PlayerNode(node, depth = 0, hits = []) {
  if (!node || depth > 14 || hits.length >= 3) return hits;
  if (typeof node !== 'object') return hits;

  const name =
    (node.firstName && node.lastName ? `${node.firstName} ${node.lastName}`.trim() : null) ||
    node.fullName ||
    node.name ||
    null;
  const stars = node.stars ?? node.starRating ?? node.rating?.stars ?? null;
  const pos =
    node.position ||
    node.primaryPosition ||
    node.positionAbbrev ||
    node.positionAbbr ||
    node.pos ||
    null;
  const classYear = node.classYear ?? node.gradYear ?? node.graduationYear ?? node.year ?? null;
  const highSchool = node.highSchool?.name || node.highSchoolName || node.highSchool || null;
  const city = node.city || node.hometown?.city || node.homeTown?.city || null;
  const state = node.state || node.hometown?.state || node.homeTown?.stateAbbr || node.stateAbbr || null;
  const hometownState = city && state ? `${city}, ${state}` : node.hometown?.abbr || null;
  const natlRank = node.nationalRank ?? node.rank ?? node.ranking?.national ?? node.compositeRank ?? null;
  const recruit247Id = node.playerId ?? node.id ?? node.key ?? null;

  if (name && (stars || pos || classYear || highSchool)) {
    hits.push({
      playerName: String(name).trim(),
      recruit247Id: recruit247Id != null ? String(recruit247Id) : null,
      stars,
      pos,
      classYear,
      highSchool,
      hometownState,
      natlRank
    });
  }

  if (Array.isArray(node)) {
    node.forEach((v) => walk247PlayerNode(v, depth + 1, hits));
    return hits;
  }

  Object.values(node).forEach((v) => walk247PlayerNode(v, depth + 1, hits));
  return hits;
}

async function sourceFrom247Profile({ recruit247Id, playerSlug, playerName, classYearHint }) {
  if (!recruit247Id && !playerSlug) return null;
  const slugPart = playerSlug ? String(playerSlug).replace(/-\d+$/, '') : slugify(playerName || '');
  const url = recruit247Id
    ? `https://247sports.com/player/${slugPart}-${recruit247Id}/`
    : `https://247sports.com/player/${slugPart}/`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
        'User-Agent':
          process.env.ON3_USER_AGENT ||
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      timeout: 30000
    });
    const html = await res.text();
    if (!res.ok) return null;

    let root = null;
    const nextMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextMatch) {
      try {
        root = JSON.parse(nextMatch[1]);
      } catch {
        root = null;
      }
    }
    if (!root) {
      const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/);
      if (stateMatch) {
        try {
          root = JSON.parse(stateMatch[1]);
        } catch {
          root = null;
        }
      }
    }
    if (!root) return null;

    const hits = walk247PlayerNode(root);
    const targetKey = normalizeNameKey(playerName);
    const hit =
      hits.find((h) => normalizeNameKey(h.playerName) === targetKey) ||
      hits.find((h) => targetKey && normalizeNameKey(h.playerName).includes(targetKey)) ||
      hits[0];
    if (!hit?.playerName) return null;

    const snapshot = buildSnapshot({
      playerName: hit.playerName,
      playerSlug,
      stars: hit.stars,
      pos: hit.pos,
      classYear: hit.classYear || classYearHint,
      highSchool: hit.highSchool,
      hometownState: hit.hometownState,
      natlRank: hit.natlRank
    });
    if (!snapshot?.playerName) return null;

    return {
      provider: '247_profile',
      label: '247Sports recruit profile',
      confidence: hit.recruit247Id ? 92 : 88,
      snapshot,
      url
    };
  } catch {
    return null;
  }
}

async function findStorePlayer({ playerName, playerSlug, on3Id }) {
  const store = require('./recruiting-store');
  if (playerSlug) {
    const bySlug = await store.getPlayerBySlug(playerSlug);
    if (bySlug) return bySlug;
  }
  const all = await store.getAllPlayers();
  if (on3Id) {
    const byOn3 = all.find((p) => p.on3Id && String(p.on3Id) === String(on3Id));
    if (byOn3) return byOn3;
  }
  if (playerName) {
    const key = String(playerName).toLowerCase();
    return all.find((p) => String(p.name || '').toLowerCase() === key) || null;
  }
  return null;
}

function resolveRecruitSlug({ playerSlug, on3Id, playerName }) {
  if (playerSlug && /\-\d+$/.test(playerSlug)) return playerSlug;
  if (on3Id && playerName) return `${slugify(playerName)}-${on3Id}`;
  return playerSlug || null;
}

async function collectIdentitySources({ playerName, playerSlug, classYear, row, intel, player }) {
  const sources = [];
  const storePlayer = player || (await findStorePlayer({ playerName, playerSlug, on3Id: row?.on3Id || intel?.playerId }));

  if (storePlayer) {
    const src = sourceFromGatorVault(storePlayer);
    if (src) sources.push(src);
  }

  if (row) {
    const src = sourceFromRivalsRow(row);
    if (src) sources.push(src);
  }

  if (intel) {
    const src = sourceFromIntel(intel);
    if (src) sources.push(src);
  }

  const slug =
    resolveRecruitSlug({
      playerSlug: playerSlug || row?.playerSlug || intel?.playerSlug || storePlayer?.slug,
      on3Id: row?.on3Id || intel?.playerId || storePlayer?.on3Id,
      playerName: playerName || row?.playerName || intel?.playerName || storePlayer?.name
    }) || storePlayer?.on3Slug;

  if (slug) {
    const on3Src = await sourceFromOn3Profile(slug, classYear || row?.classYear || intel?.classYear || storePlayer?.classYear);
    if (on3Src) sources.push(on3Src);
  }

  const recruit247Id = storePlayer?.recruit247Id || row?.recruit247Id || intel?.recruit247Id;
  const profile247 = await sourceFrom247Profile({
    recruit247Id,
    playerSlug: slug || playerSlug || row?.playerSlug || intel?.playerSlug || storePlayer?.slug,
    playerName: playerName || row?.playerName || intel?.playerName || storePlayer?.name,
    classYearHint: classYear || row?.classYear || intel?.classYear || storePlayer?.classYear
  });
  if (profile247) sources.push(profile247);

  const deduped = [];
  const seen = new Set();
  for (const src of sources) {
    const key = `${src.provider}|${normalizeNameKey(src.snapshot?.playerName)}|${src.snapshot?.on3Id || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(src);
  }
  return deduped;
}

function identityPatchFromSnapshot(snapshot) {
  if (!snapshot) return {};
  return {
    name: snapshot.playerName,
    playerName: snapshot.playerName,
    playerSlug: snapshot.playerSlug,
    on3Id: snapshot.on3Id,
    stars: snapshot.stars,
    pos: snapshot.pos,
    classYear: snapshot.classYear,
    highSchool: snapshot.highSchool,
    hometownState: snapshot.hometownState,
    school: snapshot.highSchool || snapshot.hometownState,
    natlRank: snapshot.natlRank,
    ufRpmPct: snapshot.ufRpmPct
  };
}

function listMissingIdentityFields(fields) {
  const missing = [];
  if (!parseStars(fields.stars)) missing.push('rating');
  if (!String(fields.pos || '').trim()) missing.push('position');
  if (!fields.classYear || Number.isNaN(Number(fields.classYear))) missing.push('classYear');
  if (!String(fields.highSchool || '').trim()) missing.push('school');
  if (!String(fields.hometownState || '').trim()) missing.push('hometownState');
  if (parseRpm(fields.ufRpmPct) == null) missing.push('ufRpmPct');
  return missing;
}

/** Visit / intel autoposter — no RPM requirement; stars OR natlRank for rank signal. */
function listMissingVisitIdentityFields(fields) {
  const missing = [];
  if (!parseStars(fields.stars) && !(fields.natlRank > 0)) missing.push('rating');
  if (!String(fields.pos || '').trim()) missing.push('position');
  if (!fields.classYear || Number.isNaN(Number(fields.classYear))) missing.push('classYear');
  if (!String(fields.highSchool || fields.school || '').trim()) missing.push('school');
  if (!String(fields.hometownState || '').trim()) missing.push('hometownState');
  return missing;
}

async function persistIdentityToIntel(intelId, snapshot, confirmation) {
  if (!intelId || !snapshot) return null;
  try {
    const intelStore = require('./recruiting-intel-store');
    return intelStore.updateIntelIdentity(intelId, {
      playerName: snapshot.playerName,
      playerSlug: snapshot.playerSlug,
      playerId: snapshot.on3Id,
      stars: snapshot.stars,
      pos: snapshot.pos,
      classYear: snapshot.classYear,
      highSchool: snapshot.highSchool,
      hometownState: snapshot.hometownState,
      school: snapshot.highSchool || snapshot.hometownState,
      natlRank: snapshot.natlRank,
      ufRpmPct: snapshot.ufRpmPct,
      identityConfirmed: true,
      identityConfirmationMode: confirmation?.mode || null,
      identityConfirmedAt: new Date().toISOString(),
      identitySources: (confirmation?.matchedSources || []).map((s) => ({
        provider: s.provider,
        label: s.label,
        confidence: s.confidence
      }))
    });
  } catch {
    return null;
  }
}

async function persistIdentityToPlayer(snapshot) {
  if (!snapshot?.playerName) return null;
  try {
    const store = require('./recruiting-store');
    const slug = snapshot.playerSlug || slugify(snapshot.playerName);
    return store.upsertPlayer({
      slug,
      name: snapshot.playerName,
      on3Id: snapshot.on3Id,
      stars: snapshot.stars,
      pos: snapshot.pos,
      classYear: snapshot.classYear,
      school: snapshot.hometownState || snapshot.highSchool,
      fromSchool: snapshot.highSchool,
      natlRank: snapshot.natlRank,
      ufRpmPct: snapshot.ufRpmPct,
      category: 'target',
      status: 'uncommitted'
    });
  } catch {
    return null;
  }
}

/**
 * Lookup + confirmation + merge for prediction posts.
 * Skips only after lookup and confirmation both fail.
 */
async function enrichAndConfirmPredictionIdentity({
  fields,
  playerName,
  playerSlug,
  row = null,
  intel = null,
  player = null,
  intelId = null,
  classYear = null
} = {}) {
  const baseSnapshot = buildSnapshot({
    playerName: fields?.playerName || playerName,
    playerSlug,
    stars: fields?.stars,
    pos: fields?.pos,
    classYear: fields?.classYear || classYear,
    highSchool: fields?.highSchool,
    hometownState: fields?.hometownState,
    natlRank: fields?.natlRank,
    ufRpmPct: fields?.ufRpmPct,
    on3Id: row?.on3Id || intel?.playerId
  });

  const sources = await collectIdentitySources({
    playerName: baseSnapshot?.playerName || playerName,
    playerSlug,
    classYear: baseSnapshot?.classYear || classYear,
    row,
    intel,
    player
  });

  const confirmation = confirmIdentity(sources);
  if (!confirmation.confirmed) {
    return {
      confirmed: false,
      reason: 'identity_not_confirmed',
      confirmation,
      missingBefore: listMissingIdentityFields(baseSnapshot || {}),
      sources: sources.map((s) => ({ provider: s.provider, confidence: s.confidence }))
    };
  }

  const mergedSnapshot = mergeMissingFields(baseSnapshot || {}, confirmation.matchedSources);
  const missingAfter = listMissingIdentityFields(mergedSnapshot);

  if (missingAfter.length) {
    return {
      confirmed: false,
      reason: 'identity_incomplete_after_lookup',
      confirmation,
      missingAfter,
      mergedSnapshot,
      sources: sources.map((s) => ({ provider: s.provider, confidence: s.confidence }))
    };
  }

  const identityPatch = identityPatchFromSnapshot(mergedSnapshot);

  if (intelId) await persistIdentityToIntel(intelId, mergedSnapshot, confirmation);
  await persistIdentityToPlayer(mergedSnapshot);

  return {
    confirmed: true,
    confirmation,
    mergedSnapshot,
    identityPatch,
    intelPatch: {
      stars: mergedSnapshot.stars,
      pos: mergedSnapshot.pos,
      classYear: mergedSnapshot.classYear,
      highSchool: mergedSnapshot.highSchool,
      hometownState: mergedSnapshot.hometownState,
      school: mergedSnapshot.highSchool || mergedSnapshot.hometownState,
      natlRank: mergedSnapshot.natlRank,
      ufRpmPct: mergedSnapshot.ufRpmPct,
      playerSlug: mergedSnapshot.playerSlug
    },
    sources: sources.map((s) => ({ provider: s.provider, confidence: s.confidence, label: s.label }))
  };
}

/**
 * Lookup + confirmation + merge for visit/beat intel posts (no RPM required).
 */
async function enrichAndConfirmIntelIdentity({
  fields,
  playerName,
  playerSlug,
  row = null,
  intel = null,
  player = null,
  intelId = null,
  classYear = null
} = {}) {
  const baseSnapshot = buildSnapshot({
    playerName: fields?.playerName || playerName,
    playerSlug,
    stars: fields?.stars,
    pos: fields?.pos,
    classYear: fields?.classYear || classYear,
    highSchool: fields?.highSchool || fields?.school,
    hometownState: fields?.hometownState,
    natlRank: fields?.natlRank,
    on3Id: row?.on3Id || intel?.playerId
  });

  const sources = await collectIdentitySources({
    playerName: baseSnapshot?.playerName || playerName,
    playerSlug,
    classYear: baseSnapshot?.classYear || classYear,
    row,
    intel,
    player
  });

  const confirmation = confirmIdentity(sources);
  if (!confirmation.confirmed) {
    return {
      confirmed: false,
      reason: 'identity_not_confirmed',
      confirmation,
      missingBefore: listMissingVisitIdentityFields(baseSnapshot || {}),
      sources: sources.map((s) => ({ provider: s.provider, confidence: s.confidence }))
    };
  }

  const mergedSnapshot = mergeMissingFields(baseSnapshot || {}, confirmation.matchedSources);
  const missingAfter = listMissingVisitIdentityFields(mergedSnapshot);

  if (missingAfter.length) {
    return {
      confirmed: false,
      reason: 'identity_incomplete_after_lookup',
      confirmation,
      missingAfter,
      mergedSnapshot,
      sources: sources.map((s) => ({ provider: s.provider, confidence: s.confidence }))
    };
  }

  const identityPatch = identityPatchFromSnapshot(mergedSnapshot);

  if (intelId) await persistIdentityToIntel(intelId, mergedSnapshot, confirmation);
  await persistIdentityToPlayer(mergedSnapshot);

  return {
    confirmed: true,
    confirmation,
    mergedSnapshot,
    identityPatch,
    intelPatch: {
      stars: mergedSnapshot.stars,
      pos: mergedSnapshot.pos,
      classYear: mergedSnapshot.classYear,
      highSchool: mergedSnapshot.highSchool,
      hometownState: mergedSnapshot.hometownState,
      school: mergedSnapshot.highSchool || mergedSnapshot.hometownState,
      natlRank: mergedSnapshot.natlRank,
      playerSlug: mergedSnapshot.playerSlug,
      playerId: mergedSnapshot.on3Id
    },
    sources: sources.map((s) => ({ provider: s.provider, confidence: s.confidence, label: s.label }))
  };
}

module.exports = {
  MIN_SINGLE_SOURCE_CONFIDENCE,
  normalizeNameKey,
  looksLikeCityState,
  buildSnapshot,
  snapshotsMatch,
  confirmIdentity,
  mergeMissingFields,
  collectIdentitySources,
  sourceFrom247Profile,
  enrichAndConfirmPredictionIdentity,
  enrichAndConfirmIntelIdentity,
  persistIdentityToIntel,
  listMissingIdentityFields,
  listMissingVisitIdentityFields,
  identityPatchFromSnapshot
};
