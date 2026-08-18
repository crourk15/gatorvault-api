/**
 * Enrich 2028 High Priority chase cards from live visit/offer/intel stores.
 * Fan-facing visitHistory + notePreview — API-only (no client bake).
 * Does NOT invent delta7d / Rising.
 */
'use strict';

const visitLogStore = require('./recruiting-visit-log-store');
const {
  isFloridaSchool,
} = require('./recruiting-target-filters');
const {
  isOfficialVisit,
  isUnofficialVisit,
  isHomeVisit,
} = require('./uf-chase-score');

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_VISIT_DAYS = 180;

function slugKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function isFloridaVisitLog(entry) {
  const school = String(entry?.school || 'Florida');
  return isFloridaSchool(school) || /\bgators\b|\buf\b|gainesville/i.test(school);
}

function parseVisitTs(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const t = Date.parse(s.slice(0, 10));
    return Number.isFinite(t) ? t : null;
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

function shortVisitDate(ts) {
  if (!ts) return null;
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(ts));
  } catch {
    return null;
  }
}

/**
 * Build fan-facing VisitBadge[] from Florida visit logs.
 * Labels drive chase card visit line + Why we chase (client maps label → visitLabels).
 */
function buildVisitHistoryFromLogs(slug, visitLogs, { days = DEFAULT_VISIT_DAYS, nowMs = Date.now() } = {}) {
  const key = slugKey(slug);
  if (!key) return [];
  const cutoff = nowMs - Math.max(1, Number(days) || DEFAULT_VISIT_DAYS) * DAY_MS;

  /** @type {Array<{ type: string, label: string, ts: number, rank: number }>} */
  const candidates = [];

  for (const row of visitLogs || []) {
    if (slugKey(row.playerSlug || row.player_slug || row.slug) !== key) continue;
    if (!isFloridaVisitLog(row)) continue;
    const ts = parseVisitTs(row.date || row.visitStart || row.reportedAt);
    if (ts != null && ts < cutoff) continue;
    const vt = row.visitType || row.eventType;
    const detail = row.detail || row.notes || '';
    const dateBit = shortVisitDate(ts);

    if (isHomeVisit(vt, detail)) {
      candidates.push({
        type: 'UV',
        label: dateBit ? `Home visit · ${dateBit}` : 'Home visit',
        ts: ts || 0,
        rank: 3,
      });
      continue;
    }
    if (isOfficialVisit(vt)) {
      candidates.push({
        type: 'OV',
        label: dateBit ? `OV · ${dateBit}` : 'OV',
        ts: ts || 0,
        rank: 2,
      });
      continue;
    }
    // Default campus presence (UV / junior day / unspecified FL visit).
    if (isUnofficialVisit(vt) || /junior\s*day|camp|visit/i.test(String(vt || 'visit'))) {
      const junior = /junior\s*day/i.test(`${vt} ${detail}`);
      candidates.push({
        type: junior ? 'Junior Day' : 'UV',
        label: junior
          ? dateBit
            ? `Junior Day · ${dateBit}`
            : 'Junior Day'
          : dateBit
            ? `UV · ${dateBit}`
            : 'UV',
        ts: ts || 0,
        rank: junior ? 1 : 1,
      });
    }
  }

  candidates.sort((a, b) => b.rank - a.rank || b.ts - a.ts);

  const out = [];
  const seenTypes = new Set();
  for (const c of candidates) {
    // Keep one Home / OV / UV plate — newest of each family.
    const family = c.type === 'OV' ? 'OV' : c.label.startsWith('Home') ? 'Home' : c.type;
    if (seenTypes.has(family)) continue;
    seenTypes.add(family);
    out.push({ type: c.type, label: c.label });
    if (out.length >= 3) break;
  }
  return out;
}

const TRAIT_NOTE_RE =
  /\b(fits|comps? to|first-step|press\/man|bend|burst|arc|length|twitch|physicality|scheme|frame|prototype)\b/i;
const RANK_PLATE_RE = /^\d★\s+\w+\s*·/;
const CHASE_NOTE_RE =
  /\b(?:offer|visit|push|priority|target|chase|staff|lead|UV|OV|unofficial|official|Gainesville|Florida)\b/i;

function looksLikeTraitOrRankPlate(text) {
  const t = String(text || '').trim();
  if (!t) return true;
  if (TRAIT_NOTE_RE.test(t)) return true;
  if (RANK_PLATE_RE.test(t)) return true;
  return false;
}

function truncateNote(text, max = 120) {
  const t = String(text || '').trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/**
 * Fan-facing chase note — process language only (not film traits / rank plates).
 */
function pickChaseNotePreview({ profileNote, skinny, intelRows = [] } = {}) {
  const note = String(profileNote || '').trim();
  if (note && !looksLikeTraitOrRankPlate(note) && CHASE_NOTE_RE.test(note)) {
    return truncateNote(note);
  }

  const intelSorted = [...(intelRows || [])].sort((a, b) => {
    const ta = Date.parse(a.reportedAt || a.createdAt || a.date || 0) || 0;
    const tb = Date.parse(b.reportedAt || b.createdAt || b.date || 0) || 0;
    return tb - ta;
  });

  for (const row of intelSorted.slice(0, 8)) {
    const blob = String(row.detail || row.status || row.headline || row.title || '').trim();
    if (!blob) continue;
    if (looksLikeTraitOrRankPlate(blob)) continue;
    if (!CHASE_NOTE_RE.test(blob) && !/\b(?:florida|gators|\buf\b)\b/i.test(blob)) continue;
    // Prefer short process lines over long auto-sweep boilerplate.
    const cleaned = blob
      .replace(/\s*Continuous allowlist intel sweep\.?/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length < 12) continue;
    return truncateNote(cleaned);
  }

  const sk = String(skinny || '').trim();
  if (sk && !looksLikeTraitOrRankPlate(sk) && CHASE_NOTE_RE.test(sk)) {
    return truncateNote(sk);
  }
  return null;
}

/**
 * Small additive board nudge from fresh process — never writes delta7d.
 * Caps low so staff heat / fit still dominate.
 */
function processFreshnessNudge(player, { visitHistory = [], intelRows = [], nowMs = Date.now() } = {}) {
  let nudge = 0;
  const hasVisitPlate = (visitHistory || []).some((v) => {
    const label = String(v?.label || v?.type || '');
    return /\b(UV|OV|Home visit|Junior Day)\b/i.test(label);
  });
  if (hasVisitPlate) nudge += 1.5;

  const freshIntel = (intelRows || []).some((row) => {
    const ts = Date.parse(row.reportedAt || row.createdAt || row.date || 0);
    return Number.isFinite(ts) && nowMs - ts < 21 * DAY_MS;
  });
  if (freshIntel) nudge += 2;

  const chase = player?.chase || {};
  if ((chase.flOffers || 0) > 0) nudge += 0.5;
  if ((chase.pursuit || 0) > 0) nudge += 1;

  return Math.round(Math.min(4.5, nudge) * 10) / 10;
}

/**
 * Enrich HP players in place-friendly map: visitHistory, notePreview, skinny, priority nudge.
 */
function enrichHighPriorityChaseCards(players, opts = {}) {
  const days = Number(opts.days) || DEFAULT_VISIT_DAYS;
  const nowMs = opts.nowMs != null ? Number(opts.nowMs) : Date.now();
  const visitLogs =
    opts.visitLogs ||
    (() => {
      try {
        return visitLogStore.listVisitLogs({ limit: 8000 });
      } catch {
        return [];
      }
    })();

  let recruitingBySlug = opts.recruitingBySlug || null;
  if (!recruitingBySlug) {
    recruitingBySlug = new Map();
    try {
      const store = require('./recruiting-store');
      for (const p of players || []) {
        const slug = slugKey(p?.slug);
        if (!slug || recruitingBySlug.has(slug)) continue;
        const local = typeof store.findBySlug === 'function' ? store.findBySlug(slug) : null;
        if (local) recruitingBySlug.set(slug, local);
      }
    } catch {
      /* optional */
    }
  }

  let intelBySlug = opts.intelBySlug || null;
  if (!intelBySlug) {
    intelBySlug = new Map();
    try {
      const intelStore = require('./recruiting-intel-store');
      const since = new Date(nowMs - days * DAY_MS).toISOString();
      const rows = intelStore.listIntel({ limit: 2500, since });
      for (const row of rows || []) {
        const key = slugKey(row.playerSlug || row.player_slug || row.slug);
        if (!key) continue;
        if (!intelBySlug.has(key)) intelBySlug.set(key, []);
        intelBySlug.get(key).push(row);
      }
    } catch {
      /* optional */
    }
  }

  const { mergeExpectedVisitHistory } = require('./game-week-visitors');

  return (players || []).map((player) => {
    const slug = slugKey(player?.slug);
    if (!slug) return player;
    const recruiting = recruitingBySlug.get(slug) || {};
    const intelRows = intelBySlug.get(slug) || [];

    const fromLogs = buildVisitHistoryFromLogs(slug, visitLogs, { days, nowMs });
    const visitHistory = mergeExpectedVisitHistory(slug, fromLogs);

    const notePreview = pickChaseNotePreview({
      profileNote: player.profileNote || recruiting.profileNote,
      skinny: player.skinny || recruiting.skinny,
      intelRows,
    });

    const skinny =
      player.skinny ||
      recruiting.skinny ||
      null;

    const nudge = processFreshnessNudge(player, { visitHistory, intelRows, nowMs });
    const basePriority = Number(player.priorityScore ?? player.hotScore) || 0;

    return {
      ...player,
      skinny: skinny || player.skinny || null,
      notePreview: notePreview || player.notePreview || null,
      visitHistory,
      // Keep hotScore pure; nudge only the chase sort key so intel/visits surface.
      priorityScore: Math.round((basePriority + nudge) * 10) / 10,
      processNudge: nudge,
    };
  });
}

module.exports = {
  buildVisitHistoryFromLogs,
  pickChaseNotePreview,
  processFreshnessNudge,
  enrichHighPriorityChaseCards,
  looksLikeTraitOrRankPlate,
  shortVisitDate,
  parseVisitTs,
};
