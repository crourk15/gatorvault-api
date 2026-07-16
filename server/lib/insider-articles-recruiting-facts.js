/**
 * Recruiting fact checks for insider drafts — hard-fail wrong commit/class claims.
 * Used by validateDraftQuality (generation + Approve).
 */
const fs = require('fs');
const path = require('path');
const { slugify } = require('./slug');
const { isActiveUfTarget, isFloridaSchool } = require('./recruiting-target-filters');
const { looksLikeFloridaCommit } = require('./recruiting-verified-commits');

const PLAYERS_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'players.json');

const OPEN_STATUS_RE =
  /\b(uncommitted|still open|remains? open|open battle|live (?:target|battle|closer)|closing window|soft lean|not (?:yet )?locked|still (?:a )?(?:target|closer)|waiting on a closer|treat(?:ed)? as open|open race|not committed)\b/i;

const LOCKED_STATUS_RE =
  /\b(florida commit|committed to florida|already (?:a )?florida commit|already in the class|locked in|has been committed|pledge(?:d)? to (?:florida|uf|the gators)|is (?:a )?florida commit|remains? (?:a )?commit)\b/i;

const YEAR_RE = /\b(202[6-9]|203[0-2])\b/g;

function stripHtml(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadPlayersSync(overridePlayers) {
  if (Array.isArray(overridePlayers)) return overridePlayers;
  try {
    const raw = JSON.parse(fs.readFileSync(PLAYERS_PATH, 'utf8'));
    return Array.isArray(raw) ? raw : raw.players || [];
  } catch {
    return [];
  }
}

function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPlayerIndex(players) {
  const bySlug = new Map();
  const byName = new Map();
  for (const p of players || []) {
    if (!p?.name) continue;
    const slug = String(p.slug || slugify(p.name) || '').toLowerCase();
    if (slug) bySlug.set(slug, p);
    const n = normalizeName(p.name);
    if (n) byName.set(n, p);
  }
  return { bySlug, byName, players: players || [] };
}

function isUfCommitPlayer(p) {
  if (!p) return false;
  if (looksLikeFloridaCommit(p)) return true;
  if (isFloridaSchool(p.committedTo || p.committed_to)) return true;
  try {
    const { isVerifiedUfCommitAnyYear } = require('./recruiting-verified-commits');
    const slug = String(p.slug || slugify(p.name) || '').toLowerCase();
    if (slug && isVerifiedUfCommitAnyYear(slug)) return true;
  } catch {
    /* optional */
  }
  return false;
}

/** Split draft into paragraph-sized units so proximity stays local. */
function draftTextUnits(draft) {
  const parts = [
    draft?.title,
    draft?.summary,
    draft?.thesis,
    ...(draft?.insiderAngles || []),
    draft?.body,
    draft?.scaffoldBody,
  ];
  for (const b of draft?.battles || []) {
    if (b?.targetName) parts.push(b.targetName);
    if (b?.copy) parts.push(b.copy);
  }
  const units = [];
  for (const part of parts.filter(Boolean)) {
    const raw = String(part);
    const chunks = raw
      .split(/<\/p>|<br\s*\/?>|\n+/i)
      .map((c) => stripHtml(c))
      .filter(Boolean);
    if (chunks.length) units.push(...chunks);
    else {
      const one = stripHtml(raw);
      if (one) units.push(one);
    }
  }
  return units;
}

function draftPlainText(draft) {
  return draftTextUnits(draft).join('\n');
}

function windowAround(text, index, radius = 140) {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return text.slice(start, end);
}

function findNameMentions(text, player) {
  const name = normalizeName(player.name);
  if (!name || name.length < 4) return [];
  const hay = text.toLowerCase();
  const needle = name;
  const hits = [];
  let from = 0;
  while (from < hay.length) {
    const idx = hay.indexOf(needle, from);
    if (idx < 0) break;
    hits.push(idx);
    from = idx + needle.length;
  }
  return hits;
}

/**
 * @returns {string[]} hard-fail reason codes
 */
function validateRecruitingFactClaims(draft, playersOverride) {
  const reasons = [];
  const players = loadPlayersSync(playersOverride);
  if (!players.length) return reasons;

  const index = buildPlayerIndex(players);
  const units = draftTextUnits(draft);
  if (!units.length) return reasons;

  // Battles must never feature UF commits.
  for (const battle of draft?.battles || []) {
    const name = battle?.targetName || battle?.name;
    if (!name) continue;
    const p =
      index.bySlug.get(String(battle.slug || slugify(name)).toLowerCase()) ||
      index.byName.get(normalizeName(name));
    if (p && isUfCommitPlayer(p)) {
      reasons.push(`fact_commit_in_live_battle:${slugify(name)}`);
    }
  }

  // Scan each unit separately so open/locked language must sit near the name.
  const flagged = new Set();
  for (const unit of units) {
    for (const p of index.players) {
      if (!p?.name) continue;
      const hits = findNameMentions(unit, p);
      if (!hits.length) continue;

      const slug = String(p.slug || slugify(p.name)).toLowerCase();
      const ufCommit = isUfCommitPlayer(p);
      const activeTarget = isActiveUfTarget(p);

      for (const idx of hits) {
        const win = windowAround(unit, idx, 100);

        if (ufCommit && OPEN_STATUS_RE.test(win)) {
          flagged.add(`fact_uf_commit_open_language:${slug}`);
          break;
        }
        if (activeTarget && !ufCommit && LOCKED_STATUS_RE.test(win)) {
          flagged.add(`fact_open_player_treated_as_commit:${slug}`);
          break;
        }

        const years = [...win.matchAll(YEAR_RE)].map((m) => Number(m[1]));
        const storeYear = Number(p.classYear ?? p.class_year);
        if (Number.isFinite(storeYear) && years.length) {
          const mismatch = years.find((y) => y !== storeYear);
          if (
            mismatch != null &&
            /(class|cycle|ov|commit|closer|target|\bte\b|\bcb\b|\biol\b|\bs\b|\bdl\b|\blb\b)/i.test(win)
          ) {
            flagged.add(`fact_class_year_mismatch:${slug}:${storeYear}_vs_${mismatch}`);
            break;
          }
        }
      }
    }
  }

  return [...new Set([...reasons, ...flagged])];
}

module.exports = {
  validateRecruitingFactClaims,
  loadPlayersSync,
  OPEN_STATUS_RE,
  LOCKED_STATUS_RE,
  draftPlainText,
};
