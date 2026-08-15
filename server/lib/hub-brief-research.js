/**
 * Hub desk research — recruit names + nameless star/pos cues for team/program briefs.
 * Hub Copy Brief used to skip research (thin tweet dump). Visitor/Swamp stories need
 * Vault board resolve so "5-star edge" does not stay anonymous in Cursor paste.
 */
'use strict';

const POS_ALIASES = {
  edge: ['EDGE', 'DE', 'OLB'],
  de: ['EDGE', 'DE'],
  dl: ['DL', 'DT', 'DE', 'EDGE'],
  wr: ['WR'],
  qb: ['QB'],
  rb: ['RB'],
  te: ['TE'],
  ol: ['OL', 'OT', 'OG', 'C'],
  ot: ['OT', 'OL'],
  lb: ['LB', 'OLB', 'ILB'],
  cb: ['CB'],
  s: ['S', 'SAF'],
  ath: ['ATH']
};

function normalizePos(pos) {
  return String(pos || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

function posMatches(playerPos, cuePos) {
  const p = normalizePos(playerPos);
  const c = normalizePos(cuePos);
  if (!p || !c) return false;
  if (p === c) return true;
  const aliases = POS_ALIASES[c.toLowerCase()] || [c];
  return aliases.some((a) => a === p || p.includes(a));
}

function hasFloridaVisit(player) {
  const visits = Array.isArray(player?.visits) ? player.visits : [];
  return visits.some((v) => /florida|gators/i.test(String(v.school || v.schoolName || '')));
}

function recruitSignalInText(text) {
  const t = String(text || '');
  if (!t.trim()) return false;
  return /\b(visit|visits|visitor|visitors|recruit|recruiting|target|targets|offer|offers|commit|commitment|flip|ov\b|unofficial|official visit|5-star|five-star|4-star|four-star|3-star|top\s*\d+|no\.\s*1)\b/i.test(
    t
  );
}

/**
 * Parse nameless board cues: "5-star edge", "five-star WR", "No. 1 WR in the country".
 */
function extractNamelessCues(text) {
  const t = String(text || '');
  const cues = [];
  const seen = new Set();

  const push = (cue) => {
    const key = `${cue.stars || ''}|${cue.no1 ? 'no1' : ''}|${cue.pos}`;
    if (seen.has(key)) return;
    seen.add(key);
    cues.push(cue);
  };

  const starPos =
    /\b(?:(\d)|five|four|three)[-\s]?star\s+(EDGE|DE|DL|WR|QB|RB|TE|OL|OT|LB|CB|S|ATH|edge|de|wr|qb|rb)\b/gi;
  let m;
  while ((m = starPos.exec(t))) {
    let stars = null;
    const raw = String(m[1] || m[0]).toLowerCase();
    if (/^\d$/.test(m[1] || '')) stars = Number(m[1]);
    else if (/five/.test(raw) || /five[-\s]?star/.test(m[0])) stars = 5;
    else if (/four/.test(raw) || /four[-\s]?star/.test(m[0])) stars = 4;
    else if (/three/.test(raw) || /three[-\s]?star/.test(m[0])) stars = 3;
    // "5-star edge" → group1 is 5; "five-star edge" → group1 undefined
    if (!stars) {
      if (/five/i.test(m[0])) stars = 5;
      else if (/four/i.test(m[0])) stars = 4;
      else if (/three/i.test(m[0])) stars = 3;
    }
    push({
      raw: m[0],
      stars,
      pos: String(m[2]).toUpperCase(),
      no1: false
    });
  }

  const no1Pos =
    /\b(?:the\s+)?(?:no\.?\s*1|number\s+one|#1)\s+(?:overall\s+)?(?:player|prospect|recruit)?(?:\s+in\s+the\s+country)?(?:\s+(?:WR|QB|RB|TE|EDGE|DE|DL|OL|CB|S|ATH))?|\b(?:the\s+)?(?:no\.?\s*1|number\s+one|#1)\s+(WR|QB|RB|TE|EDGE|DE|DL|OL|CB|S|ATH)\b/gi;
  while ((m = no1Pos.exec(t))) {
    const posHit = m[1] ? String(m[1]).toUpperCase() : /\bWR\b/i.test(m[0]) ? 'WR' : null;
    push({
      raw: m[0].trim(),
      stars: null,
      pos: posHit || 'WR',
      no1: true
    });
  }

  // "the No. 1 WR in the country" (pos after No. 1)
  const no1Wr = /\b(?:no\.?\s*1|number\s+one|#1)\s+WR\b/gi;
  while ((m = no1Wr.exec(t))) {
    push({ raw: m[0], stars: null, pos: 'WR', no1: true });
  }

  return cues;
}

function scorePlayerForCue(player, cue) {
  let score = 0;
  const stars = Number(player.stars || 0);
  const natl = Number(player.natlRank || player.rankingNational || 0);
  const posRank = Number(player.posRank || player.rankingPosition || 0);
  const fit = Number(player.fitScore || player.ufFitScore || 0);

  if (cue.stars != null) {
    if (stars === cue.stars) score += 40;
    else if (stars > 0) score -= 80; // wrong star band is a hard miss
  }
  if (!posMatches(player.pos || player.position, cue.pos)) return -999;
  score += 25;

  if (cue.no1) {
    if (natl === 1) score += 50;
    else if (posRank === 1 && natl > 0 && natl <= 5) score += 30;
    else if (posRank === 1) score += 15;
    else if (natl > 0 && natl <= 3) score += 20;
  }

  if (hasFloridaVisit(player)) score += 20;
  if (fit >= 70) score += 8;
  if (player.classYear === 2028 || player.classYear === 2027) score += 5;
  // Prefer better national ranks when tying on star+pos
  if (natl > 0) score += Math.max(0, 15 - Math.min(natl, 15));
  return score;
}

async function loadBoardPlayers() {
  const store = require('./recruiting-store');
  if (typeof store.initRecruitingStore === 'function') {
    await store.initRecruitingStore().catch(() => {});
  } else if (typeof store.init === 'function') {
    await store.init().catch(() => {});
  }
  const all = await store.getAllPlayers();
  return Array.isArray(all) ? all : [];
}

async function resolveCueAgainstBoard(cue, players) {
  let best = null;
  let bestScore = 0;
  for (const p of players) {
    const score = scorePlayerForCue(p, cue);
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  if (!best || bestScore < 50) return null;
  return {
    cue: cue.raw,
    playerName: best.name || best.fullName,
    playerSlug: best.slug,
    stars: best.stars,
    pos: best.pos || best.position,
    classYear: best.classYear,
    natlRank: best.natlRank || best.rankingNational || null,
    posRank: best.posRank || best.rankingPosition || null,
    floridaVisit: hasFloridaVisit(best),
    matchScore: bestScore,
    matchMode: cue.no1 ? 'board_no1_cue' : 'board_star_pos_cue'
  };
}

async function hydrateNamed(name, playersBySlug, playersByName) {
  const key = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
  let player = playersByName.get(key) || null;
  if (!player) {
    try {
      const { slugify } = require('./slug');
      const slug = slugify(name);
      player = playersBySlug.get(slug) || null;
      if (!player) {
        const store = require('./recruiting-store');
        player = (await store.getPlayerBySlug(slug)) || null;
      }
    } catch {
      player = null;
    }
  }
  if (!player) {
    return { playerName: name, playerSlug: null, matchMode: 'text_name_only' };
  }
  return {
    playerName: player.name || player.fullName || name,
    playerSlug: player.slug,
    stars: player.stars,
    pos: player.pos || player.position,
    classYear: player.classYear,
    natlRank: player.natlRank || null,
    posRank: player.posRank || null,
    floridaVisit: hasFloridaVisit(player),
    matchMode: 'named_in_beat'
  };
}

function collectNamesFromText(text) {
  const names = [];
  const seen = new Set();
  const push = (n) => {
    const name = String(n || '').trim();
    if (!name) return;
    const k = name.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    names.push(name);
  };

  try {
    const gate = require('./beat-recruiting-ingest-gate');
    const hit = gate.resolvePlayerFromTextSync(text);
    if (hit?.playerName) push(hit.playerName);
  } catch {
    /* optional */
  }

  try {
    const copy = require('./x-autoposter-copy');
    const { isValidPlayerName } = require('./x-autoposter-player-context');
    for (const n of copy.extractAllPlayerNameCandidates?.(text) || []) {
      if (isValidPlayerName(n)) push(n);
    }
    const one = copy.extractPlayerFromText?.(text);
    if (one && isValidPlayerName(one)) push(one);
  } catch {
    /* optional */
  }

  try {
    const allowlist = require('./recruiting-target-allowlist');
    const map = allowlist.getMergedCanonicalNames?.() || {};
    for (const n of Object.values(map)) {
      const re = new RegExp(`\\b${String(n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (re.test(text)) push(n);
    }
  } catch {
    /* optional */
  }

  // Year + POS + Name patterns the gate sometimes misses as secondary names
  const structured =
    /\b(?:20(?:2[7-9]|30)\s+)?(?:\d+[-\s]?star\s+)?(?:QB|RB|WR|TE|OL|OT|OG|C|DL|DT|DE|EDGE|LB|CB|S|ATH)\s+([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,3}(?:\s+Jr\.?)?)/g;
  let m;
  while ((m = structured.exec(String(text || '')))) {
    push(m[1].replace(/\s+/g, ' ').trim());
  }

  return names;
}

function formatPlayerLine(row) {
  const bits = [
    row.playerName,
    row.stars != null ? `${row.stars}★` : null,
    row.pos || null,
    row.classYear || null,
    row.natlRank ? `#${row.natlRank} natl` : null,
    row.floridaVisit ? 'Florida visit(s) on file' : null
  ].filter(Boolean);
  return `- ${bits.join(' · ')}${row.playerSlug ? ` [${row.playerSlug}]` : ''}`;
}

/**
 * Research hub beat rows for Cursor paste.
 * @param {Array} beatRows
 * @param {{ players?: Array }} [opts]
 */
async function researchHubBeatRows(beatRows = [], opts = {}) {
  const rows = Array.isArray(beatRows) ? beatRows : [];
  const combined = rows
    .map((r) => String(r.detail || r.skinny || r.text || '').trim())
    .filter(Boolean)
    .join('\n');

  if (!combined || !recruitSignalInText(combined)) {
    return {
      ok: true,
      ran: false,
      reason: 'no_recruit_signal',
      named: [],
      cueResolves: [],
      pasteBlock: null
    };
  }

  const players = opts.players || (await loadBoardPlayers());
  const playersBySlug = new Map();
  const playersByName = new Map();
  for (const p of players) {
    if (p?.slug) playersBySlug.set(p.slug, p);
    const nk = String(p.name || p.fullName || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
    if (nk) playersByName.set(nk, p);
  }

  const named = [];
  const namedSeen = new Set();
  const nameKey = (n) =>
    String(n || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  for (const row of rows) {
    const body = String(row.detail || row.skinny || row.text || '');
    for (const name of collectNamesFromText(body)) {
      const k = nameKey(name);
      if (!k || namedSeen.has(k)) continue;
      namedSeen.add(k);
      const hydrated = await hydrateNamed(name, playersBySlug, playersByName);
      if (hydrated.playerSlug) namedSeen.add(nameKey(hydrated.playerSlug));
      namedSeen.add(nameKey(hydrated.playerName));
      named.push(hydrated);
    }
  }

  // Optional: expand On3 teasers when network allowed
  if (opts.expandTeasers !== false && opts.skipNetwork !== true) {
    try {
      const teaser = require('./beat-teaser-resolve');
      for (const row of rows.slice(0, 6)) {
        const post = {
          text: String(row.detail || row.skinny || row.text || ''),
          url: row.articleUrl || row.url || null,
          articleUrl: row.articleUrl || null
        };
        const resolved = await teaser.resolvePlayerFromBeatPost(post, {
          timeoutMs: opts.timeoutMs || 3500,
          fetchImpl: opts.fetchImpl || null
        });
        if (resolved?.playerName) {
          const k = nameKey(resolved.playerName);
          if (k && !namedSeen.has(k)) {
            namedSeen.add(k);
            const hydrated = await hydrateNamed(
              resolved.playerName,
              playersBySlug,
              playersByName
            );
            if (hydrated.playerSlug) namedSeen.add(nameKey(hydrated.playerSlug));
            namedSeen.add(nameKey(hydrated.playerName));
            named.push({
              ...hydrated,
              matchMode: resolved.matchMode || 'teaser_resolve',
              on3ArticleUrl: resolved.on3ArticleUrl || null
            });
          }
        }
      }
    } catch {
      /* network optional */
    }
  }

  const cues = extractNamelessCues(combined);
  const cueResolves = [];
  const cueSeen = new Set();
  for (const cue of cues) {
    const hit = await resolveCueAgainstBoard(cue, players);
    if (!hit) continue;
    const k = `${cue.raw}|${hit.playerSlug}`;
    if (cueSeen.has(k)) continue;
    cueSeen.add(k);
    // Don't duplicate if already named the same player
    if (named.some((n) => n.playerSlug && n.playerSlug === hit.playerSlug)) {
      cueResolves.push({ ...hit, alreadyNamed: true });
    } else {
      cueResolves.push(hit);
    }
  }

  const lines = [
    'RESEARCH (hub — Vault board + beat names; USE THESE NAMES)',
    '----------------------------------------------------------'
  ];
  if (named.length) {
    lines.push('Named in stacked beats:');
    for (const n of named) lines.push(formatPlayerLine(n));
  } else {
    lines.push('Named in stacked beats: (none resolved)');
  }
  lines.push('');
  if (cueResolves.length) {
    lines.push('Nameless cue resolves (DO NOT leave anonymous in copy):');
    for (const c of cueResolves) {
      lines.push(
        `- "${c.cue}" → ${c.playerName} (${[c.stars != null ? `${c.stars}★` : null, c.pos, c.natlRank ? `#${c.natlRank} natl` : null, c.floridaVisit ? 'FL visits on file' : null]
          .filter(Boolean)
          .join(' · ')}) [${c.playerSlug}]`
      );
    }
  } else if (cues.length) {
    lines.push('Nameless cues found but no confident board match:');
    for (const c of cues) lines.push(`- "${c.raw}" (${c.stars ? `${c.stars}★` : 'rank'} ${c.pos}${c.no1 ? ' · No.1' : ''})`);
  } else {
    lines.push('Nameless star/pos cues: none');
  }
  lines.push('');
  lines.push(
    'AGENT RULE: When RESEARCH names a prospect for a cue (e.g. "5-star edge" → Asher Ghioto), put that name in the post. Never write anonymous "5-star edge" / "No. 1 WR" teases when a Vault match is listed above.'
  );

  return {
    ok: true,
    ran: true,
    reason: 'recruit_signal',
    named,
    cueResolves,
    cues,
    pasteBlock: lines.join('\n')
  };
}

module.exports = {
  recruitSignalInText,
  extractNamelessCues,
  scorePlayerForCue,
  resolveCueAgainstBoard,
  researchHubBeatRows,
  collectNamesFromText,
  hasFloridaVisit,
  posMatches
};
