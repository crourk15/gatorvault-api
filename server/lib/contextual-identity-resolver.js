/**
 * Contextual Identity Resolver (CNR + RBCM + BWCM + MOT)
 * Resolves vague beat-writer phrases against UF board, writer memory, and admin overrides.
 * Posts when confidence >= 70% (CTP).
 */
const fs = require('fs');
const path = require('path');
const { slugify } = require('./slug');
const { normalizeNameKey, buildSnapshot, similarSchool } = require('./player-identity-lookup');

const DATA_DIR = path.join(__dirname, '..', 'data', 'recruiting');
const MOT_PATH = path.join(DATA_DIR, 'identity-overrides.json');
const BWCM_PATH = path.join(DATA_DIR, 'beat-writer-context-memory.json');

const MIN_POST_CONFIDENCE = parseInt(process.env.IDENTITY_CTP_THRESHOLD || '70', 10);

const POS_ALIASES = {
  DL: ['DL', 'DE', 'DT', 'EDGE'],
  DE: ['DE', 'DL', 'EDGE', 'DT'],
  DT: ['DT', 'DL', 'DE'],
  EDGE: ['EDGE', 'DE', 'DL', 'OLB'],
  LB: ['LB', 'OLB', 'ILB'],
  CB: ['CB', 'DB', 'S'],
  S: ['S', 'DB', 'CB'],
  WR: ['WR', 'WRS'],
  RB: ['RB', 'HB'],
  QB: ['QB'],
  OL: ['OL', 'OT', 'OG', 'C'],
  OT: ['OT', 'OL'],
  OG: ['OG', 'OL'],
  C: ['C', 'OL'],
  ATH: ['ATH']
};

const POS_RE = /\b(QB|RB|WR|TE|OL|OT|OG|C|DL|DT|DE|EDGE|LB|CB|S|ATH|K|P)\b/i;

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return data;
}

function normalizePhrase(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordStars(text) {
  const t = String(text || '').toLowerCase();
  if (/\bfive-star\b|\b5-star\b|\b5 star\b/.test(t)) return 5;
  if (/\bfour-star\b|\b4-star\b|\b4 star\b/.test(t)) return 4;
  if (/\bthree-star\b|\b3-star\b|\b3 star\b/.test(t)) return 3;
  const m = t.match(/\b([1-5])-star\b/);
  return m ? parseInt(m[1], 10) : null;
}

function posMatches(want, have) {
  if (!want || !have) return false;
  const w = String(want).toUpperCase();
  const h = String(have).toUpperCase();
  if (w === h) return true;
  const group = POS_ALIASES[w] || [w];
  return group.includes(h);
}

function parseCollegeSchool(text) {
  const t = String(text || '');
  const patterns = [
    /\b(?:from|at)\s+([A-Z][A-Za-z0-9 .&'-]+(?:Tech|State|A&M|University|College)?)\b/,
    /\b([A-Z][A-Za-z0-9 .&'-]+(?: Tech| State| A&M))\s+(?:five-star|four-star|three-star|[1-5]-star)\b/i,
    /\b(Texas Tech|Georgia|Alabama|LSU|Tennessee|Ole Miss|South Carolina|Clemson|Miami|Ohio State|Michigan|Notre Dame|Oklahoma|Texas|Florida State|FSU|Auburn|Missouri|Kentucky|Arkansas|Mississippi State|Vanderbilt)\b/i
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function parseFirstName(text) {
  const t = String(text || '');
  const patterns = [
    /\b(?:five-star|four-star|three-star|[1-5]-star)\s+(?:DL|DE|EDGE|DT|LB|CB|S|WR|RB|TE|OL|OT|OG|C|ATH|QB)\s+([A-Z][a-z'.-]{2,})\b/i,
    /\b(?:DL|DE|EDGE|DT|LB|CB|S|WR|RB|TE|OL|OT|OG|C|ATH|QB)\s+([A-Z][a-z'.-]{2,})\b/,
    /\b20\d{2}\s+(?:\d+-star\s+)?(?:DL|DE|EDGE|DT|LB|CB|S|WR|RB|TE|OL|OT|OG|C|ATH|QB)\s+([A-Z][a-z'.-]{2,})\b/i
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m?.[1] && !/^(Florida|Gators|Texas|Georgia|Star|Five|Four)$/i.test(m[1])) return m[1].trim();
  }
  return null;
}

function parseVagueClues(text, hints = {}) {
  const raw = String(text || '').trim();
  const stars = hints.stars ?? wordStars(raw);
  const posMatch = raw.match(POS_RE);
  const pos = (hints.pos || posMatch?.[1] || '').toUpperCase() || null;
  const firstName = hints.firstName || parseFirstName(raw);
  const school = hints.school || hints.highSchool || parseCollegeSchool(raw);
  const classYear = hints.classYear || (raw.match(/\b(202[6-9]|2030)\b/)?.[1] ? parseInt(raw.match(/\b(202[6-9]|2030)\b/)[1], 10) : null);
  const rawPhrase = normalizePhrase(raw.slice(0, 120));

  const hasSignal = Boolean(stars || pos || firstName || school || hints.playerName);
  const displayName = hints.playerName || (firstName ? firstName : null);

  return {
    raw,
    rawPhrase,
    stars,
    pos,
    firstName,
    school,
    classYear,
    hasSignal,
    displayName
  };
}

function loadManualOverrides() {
  const doc = readJson(MOT_PATH, { version: 1, items: [] });
  return Array.isArray(doc.items) ? doc.items : [];
}

function loadBeatWriterMemory() {
  return readJson(BWCM_PATH, { version: 1, writers: {} });
}

function lookupManualOverride(phrase) {
  const key = normalizePhrase(phrase);
  if (!key) return null;
  const items = loadManualOverrides();
  let best = null;
  for (const item of items) {
    const itemKey = normalizePhrase(item.phrase);
    if (!itemKey) continue;
    if (key === itemKey || key.includes(itemKey) || itemKey.includes(key)) {
      if (!best || itemKey.length > normalizePhrase(best.phrase).length) best = item;
    }
  }
  return best;
}

function patternSpecificity(patKey) {
  const tokens = patKey.split(' ').filter(Boolean);
  let score = tokens.length;
  if (tokens.some((t) => t.length >= 4 && !/^\d+$/.test(t) && !['star', 'commit'].includes(t))) {
    score += 2;
  }
  return score;
}

function lookupIdentityPattern(phrase, entries) {
  const key = normalizePhrase(phrase);
  if (!key || !entries?.length) return null;

  const matches = [];
  const seen = new Set();
  for (const entry of entries) {
    if (!entry?.slug) continue;
    for (const pat of entry.patterns || []) {
      const patKey = normalizePhrase(pat);
      if (!patKey) continue;
      const dedupeKey = `${entry.slug}:${patKey}`;
      if (seen.has(dedupeKey)) continue;
      if (key === patKey || key.includes(patKey) || patKey.includes(key)) {
        seen.add(dedupeKey);
        matches.push({
          slug: entry.slug,
          name: entry.name,
          pattern: pat,
          patKey,
          specificity: patternSpecificity(patKey)
        });
      }
    }
  }

  if (!matches.length) return null;
  matches.sort((a, b) => b.specificity - a.specificity || b.patKey.length - a.patKey.length);

  const top = matches[0];
  const runner = matches.find((m) => m.slug !== top.slug || m.patKey !== top.patKey);
  if (runner && top.specificity === runner.specificity && top.patKey.length === runner.patKey.length) {
    return null;
  }
  if (
    runner &&
    top.specificity - runner.specificity <= 1 &&
    top.patKey.length === runner.patKey.length &&
    runner.slug !== top.slug
  ) {
    return null;
  }

  return {
    slug: top.slug,
    name: top.name,
    matchedPattern: top.pattern,
    confidence: Math.min(96, 72 + top.specificity * 4)
  };
}

async function loadIdentityPatternEntries() {
  try {
    const store = require('./identity-patterns-store');
    return await store.listAllPatterns();
  } catch {
    return [];
  }
}

function lookupBeatWriterPattern(handle, phrase) {
  const writers = loadBeatWriterMemory().writers || {};
  const h = String(handle || '').toLowerCase();
  const key = normalizePhrase(phrase);
  const writer = writers[h];
  if (!writer?.patterns) return null;

  for (const pat of writer.patterns) {
    const patKey = normalizePhrase(pat.phrase);
    if (!patKey) continue;
    if (key.includes(patKey) || patKey.includes(key)) {
      return pat;
    }
  }
  return null;
}

function scoreBoardCandidate(player, clues) {
  let score = 0;
  const reasons = [];
  const name = String(player.name || '');
  const parts = name.split(/\s+/);
  const first = parts[0] || '';
  const last = parts.slice(1).join(' ');

  if (clues.firstName) {
    const fn = clues.firstName.toLowerCase();
    if (first.toLowerCase() === fn) {
      score += 32;
      reasons.push('first_name_exact');
    } else if (first.toLowerCase().startsWith(fn) || name.toLowerCase().includes(fn)) {
      score += 18;
      reasons.push('first_name_partial');
    } else if (fn.length >= 4 && normalizeNameKey(name).includes(normalizeNameKey(fn))) {
      score += 12;
      reasons.push('name_substring');
    }
  }

  if (clues.stars && player.stars && Number(player.stars) === Number(clues.stars)) {
    score += 22;
    reasons.push('stars');
  }

  if (clues.pos && player.pos && posMatches(clues.pos, player.pos)) {
    score += 18;
    reasons.push('position');
  }

  if (clues.school) {
    const fields = [player.school, player.fromSchool, player.highSchool, player.committedTo].filter(Boolean);
    if (fields.some((f) => similarSchool(f, clues.school))) {
      score += 24;
      reasons.push('school');
    }
  }

  if (clues.classYear && player.classYear && Number(player.classYear) === Number(clues.classYear)) {
    score += 10;
    reasons.push('classYear');
  }

  if (player.category === 'target' || player.status === 'uncommitted' || !player.committedTo) {
    score += 4;
    reasons.push('active_target');
  }

  if (player.natlRank > 0 && player.natlRank <= 100) {
    score += 4;
    reasons.push('ranked');
  }

  return { score: Math.min(score, 100), reasons };
}

async function getBoardPlayers() {
  const store = require('./recruiting-store');
  const all = await store.getAllPlayers();
  return all.filter((p) => {
    const cat = String(p.category || '').toLowerCase();
    const status = String(p.status || '').toLowerCase();
    if (cat === 'portal' || cat === 'roster') return false;
    if (status === 'committed' && p.committedTo && !/florida|gators|\buf\b/i.test(String(p.committedTo))) {
      return false;
    }
    return true;
  });
}

async function resolvePlayerFromSlug(slug, playerName) {
  const store = require('./recruiting-store');
  const player = slug ? await store.getPlayerBySlug(slug) : null;
  if (player) return player;
  if (playerName) {
    const all = await store.getAllPlayers();
    return all.find((p) => normalizeNameKey(p.name) === normalizeNameKey(playerName)) || null;
  }
  return null;
}

async function resolveContextualIdentity(opts = {}) {
  let result = await resolveContextualIdentityOnce(opts);
  if (result.confirmed) return result;

  const slug =
    result.candidates?.[0]?.slug ||
    (result.clues?.firstName
      ? (await getBoardPlayers()).find((p) => {
          const first = String(p.name || '').split(/\s+/)[0] || '';
          return first.toLowerCase() === String(result.clues.firstName).toLowerCase();
        })?.slug
      : null);

  if (!slug) return result;

  try {
    const patternStore = require('./identity-patterns-store');
    const store = require('./recruiting-store');
    const player = await store.getPlayerBySlug(slug);
    if (player) {
      await patternStore.syncPatternsForPlayer(player);
      result = await resolveContextualIdentityOnce(opts);
      if (result.confirmed) return { ...result, patternRebuildAttempted: true };
    }
  } catch {
    /* optional rebuild */
  }

  return result;
}

async function resolveContextualIdentityOnce({ text, sourceHandle, writerName, hints = {} } = {}) {
  const clues = parseVagueClues(text, hints);
  if (!clues.hasSignal && !text) {
    return { confirmed: false, confidence: 0, reason: 'no_clues' };
  }

  const override = lookupManualOverride(clues.rawPhrase || text);
  if (override) {
    let player = await resolvePlayerFromSlug(override.playerSlug, override.playerName);
    if (!player && override.playerName) {
      player = {
        name: override.playerName,
        slug: override.playerSlug,
        stars: clues.stars,
        pos: clues.pos,
        classYear: clues.classYear,
        school: clues.school,
        category: 'target',
        status: 'uncommitted'
      };
    }
    if (player) {
      return buildResolution({
        player,
        confidence: 100,
        mode: 'manual_override',
        inferred: false,
        reasons: ['manual_override_table'],
        clues,
        sourceHandle
      });
    }
  }

  const patternEntries = await loadIdentityPatternEntries();
  const patternHit = lookupIdentityPattern(clues.rawPhrase || text, patternEntries);
  if (patternHit?.slug) {
    let player = await resolvePlayerFromSlug(patternHit.slug, patternHit.name);
    if (player) {
      return buildResolution({
        player,
        confidence: patternHit.confidence || 92,
        mode: 'identity_pattern',
        inferred: false,
        reasons: ['identity_patterns_auto', `pattern:${patternHit.matchedPattern}`],
        clues,
        sourceHandle
      });
    }
    try {
      const patternStore = require('./identity-patterns-store');
      await patternStore.deletePatternEntry(patternHit.slug);
    } catch {
      /* stale entry cleanup optional */
    }
  }

  const bwPat = lookupBeatWriterPattern(sourceHandle, clues.rawPhrase || text);
  if (bwPat?.playerSlug) {
    const player = await resolvePlayerFromSlug(bwPat.playerSlug);
    if (player) {
      return buildResolution({
        player,
        confidence: bwPat.confidence || 88,
        mode: 'beat_writer_memory',
        inferred: false,
        reasons: ['beat_writer_context_memory'],
        clues,
        sourceHandle
      });
    }
  }

  const board = await getBoardPlayers();
  const scored = board
    .map((player) => {
      const { score, reasons } = scoreBoardCandidate(player, clues);
      let finalScore = score;
      if (bwPat?.boost) {
        finalScore += bwPat.boost;
        reasons.push('bwcm_boost');
      }
      return { player, score: Math.min(finalScore, 100), reasons };
    })
    .filter((row) => row.score >= MIN_POST_CONFIDENCE)
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  if (top && !(scored.length > 1 && top.score - scored[1].score < 8)) {
    return buildResolution({
      player: top.player,
      confidence: top.score,
      mode: 'recruiting_board_cross_match',
      inferred: top.score < 90,
      reasons: top.reasons,
      clues,
      sourceHandle
    });
  }

  const cnrHit = await resolveCnrFallback(clues, board, sourceHandle);
  if (cnrHit) return cnrHit;

  if (!top) {
    return {
      confirmed: false,
      confidence: 0,
      reason: 'board_no_match',
      clues,
      candidates: scored.slice(0, 3).map((c) => ({ name: c.player.name, score: c.score }))
    };
  }

  return {
    confirmed: false,
    confidence: top.score,
    reason: 'ambiguous_board_match',
    clues,
    candidates: scored.slice(0, 3).map((c) => ({ name: c.player.name, score: c.score, slug: c.player.slug }))
  };
}

const CNR_FALLBACK_MIN = parseInt(process.env.IDENTITY_CNR_FALLBACK_MIN || '55', 10);

async function resolveCnrFallback(clues, board, sourceHandle) {
  if (!clues.hasSignal) return null;

  const scored = board
    .map((player) => {
      const { score, reasons } = scoreBoardCandidate(player, clues);
      return { player, score, reasons };
    })
    .filter((row) => row.score >= CNR_FALLBACK_MIN && row.score < MIN_POST_CONFIDENCE)
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  if (!top) return null;
  if (scored.length > 1 && top.score - scored[1].score < 6) return null;

  const signalCount = [clues.stars, clues.pos, clues.firstName, clues.school, clues.classYear].filter(Boolean).length;
  if (signalCount < 2 && top.score < 65) return null;

  return buildResolution({
    player: top.player,
    confidence: top.score,
    mode: 'cnr_fallback',
    inferred: true,
    reasons: [...top.reasons, 'cnr_clue_parsing'],
    clues,
    sourceHandle
  });
}

function buildResolution({ player, confidence, mode, inferred, reasons, clues, sourceHandle }) {
  const snapshot = buildSnapshot({
    playerName: player.name,
    playerSlug: player.slug,
    on3Id: player.on3Id,
    stars: player.stars,
    pos: player.pos,
    classYear: player.classYear,
    school: player.school,
    highSchool: player.fromSchool || player.highSchool,
    hometownState: player.hometownState,
    natlRank: player.natlRank,
    ufRpmPct: player.ufRpmPct
  });

  return {
    confirmed: confidence >= MIN_POST_CONFIDENCE,
    confidence,
    mode,
    inferred,
    reasons,
    clues,
    sourceHandle,
    player,
    mergedSnapshot: snapshot,
    identityPatch: {
      name: player.name,
      playerName: player.name,
      playerSlug: player.slug,
      on3Id: player.on3Id,
      stars: player.stars,
      pos: player.pos,
      classYear: player.classYear,
      school: player.school,
      highSchool: player.fromSchool || player.highSchool,
      hometownState: player.hometownState,
      natlRank: player.natlRank,
      ufRpmPct: player.ufRpmPct,
      identityInferred: inferred,
      identityConfidence: confidence,
      identityResolutionMode: mode
    }
  };
}

function listManualOverrides() {
  const doc = readJson(MOT_PATH, { version: 1, items: [] });
  return { items: doc.items || [], updatedAt: doc.updatedAt };
}

function upsertManualOverride({ phrase, playerSlug, playerName, note }) {
  if (!phrase || !playerSlug) throw new Error('phrase and playerSlug required');
  const doc = readJson(MOT_PATH, { version: 1, items: [] });
  const key = normalizePhrase(phrase);
  const existing = doc.items.find((i) => normalizePhrase(i.phrase) === key);
  const entry = {
    id: existing?.id || `mot_${Date.now()}`,
    phrase: String(phrase).trim(),
    playerSlug,
    playerName: playerName || null,
    note: note || null,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (existing) {
    Object.assign(existing, entry);
  } else {
    doc.items.unshift(entry);
  }
  writeJson(MOT_PATH, doc);
  return entry;
}

function deleteManualOverride(id) {
  const doc = readJson(MOT_PATH, { version: 1, items: [] });
  doc.items = doc.items.filter((i) => i.id !== id);
  writeJson(MOT_PATH, doc);
  return { deleted: id };
}

module.exports = {
  MIN_POST_CONFIDENCE,
  parseVagueClues,
  normalizePhrase,
  lookupManualOverride,
  lookupIdentityPattern,
  lookupBeatWriterPattern,
  scoreBoardCandidate,
  resolveContextualIdentity,
  listManualOverrides,
  upsertManualOverride,
  deleteManualOverride
};
