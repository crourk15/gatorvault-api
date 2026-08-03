/**
 * Sumrall-staff scheme Fit evidence + coverage gate.
 *
 * Fit % is Scheme Match for Jon Sumrall / Buster Faulkner / Brad White.
 * No War Room / film evidence → no invented Fit number (null).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RUBRIC_PATH = path.join(__dirname, '../data/scheme-fit-rubrics.json');

let _rubric = null;

function loadRubric() {
  if (_rubric) return _rubric;
  _rubric = JSON.parse(fs.readFileSync(RUBRIC_PATH, 'utf8'));
  return _rubric;
}

function slugKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function normalizePos(pos) {
  const p = String(pos || '')
    .trim()
    .toUpperCase();
  if (!p) return '';
  if (p === 'DE') return 'EDGE';
  if (p === 'OLB') return 'OLB';
  if (p === 'ILB' || p === 'MLB') return 'LB';
  if (p === 'OG' || p === 'G') return 'IOL';
  if (p === 'OC') return 'C';
  if (p === 'OT' || p === 'T') return 'OT';
  if (p === 'OL') return 'OL';
  return p;
}

function clamp100(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function loadWarRoom(slug) {
  try {
    return require('./war-room-store').getBreakdownBySlug(slugKey(slug));
  } catch {
    return null;
  }
}

function loadFilm(slug) {
  try {
    return require('./film-traits-store').getFilmTraitsBySlug(slugKey(slug));
  } catch {
    return null;
  }
}

function evidenceBlob(warRoom, film) {
  const parts = [
    ...(Array.isArray(warRoom?.strengths) ? warRoom.strengths : []),
    warRoom?.schemeFit,
    warRoom?.comparison,
    warRoom?.projection,
    warRoom?.insiderNotes,
    warRoom?.scoutingSummary,
    ...(Array.isArray(film?.traits) ? film.traits : []),
    film?.vaultFilmAngle,
  ];
  return parts.filter(Boolean).join(' · ');
}

/**
 * Evidence levels:
 * - none  → Fit must be null (airtight)
 * - thin  → Fit capped at 60
 * - full  → Fit may use full 0–100 range
 */
function assessFitEvidence(slug, opts = {}) {
  const warRoom = opts.warRoom !== undefined ? opts.warRoom : loadWarRoom(slug);
  const film = opts.film !== undefined ? opts.film : loadFilm(slug);

  const strengths = Array.isArray(warRoom?.strengths)
    ? warRoom.strengths.map((s) => String(s || '').trim()).filter(Boolean)
    : [];
  const schemeFit = String(warRoom?.schemeFit || '').trim();
  const comparison = String(warRoom?.comparison || '').trim();
  const projection = String(warRoom?.projection || '').trim();
  const traits = Array.isArray(film?.traits)
    ? film.traits.map((t) => String(t || '').trim()).filter(Boolean)
    : [];

  const bits = [
    schemeFit.length >= 40,
    strengths.length >= 2,
    comparison.length >= 20 && projection.length >= 20,
    traits.length >= 3,
  ].filter(Boolean).length;

  let level = 'none';
  if (bits >= 2) level = 'full';
  else if (bits === 1) level = 'thin';

  return {
    level,
    bits,
    hasSchemeFit: schemeFit.length >= 40,
    strengthCount: strengths.length,
    traitCount: traits.length,
    hasCompProjection: comparison.length >= 20 && projection.length >= 20,
    warRoom: Boolean(warRoom),
    film: Boolean(film && (traits.length || film.vaultFilmAngle)),
  };
}

function positionRubric(pos) {
  const rubric = loadRubric();
  const key = normalizePos(pos);
  return rubric.positions?.[key] || rubric.positions?.ATH || null;
}

/** 0–100 how well evidence language matches Sumrall-staff position rubric. */
function scoreRubricMatch(pos, warRoom, film) {
  const row = positionRubric(pos);
  const rubric = loadRubric();
  const wanted = [...(row?.wanted || []), ...(rubric.programTraits || [])];
  const blob = evidenceBlob(warRoom, film).toLowerCase();
  if (!blob || !wanted.length) return 0;

  let hits = 0;
  for (const trait of wanted) {
    const t = String(trait || '').toLowerCase().trim();
    if (t && blob.includes(t)) hits += 1;
  }
  const ratio = hits / wanted.length;
  // Require real overlap — don't reward empty matches.
  if (hits === 0) return 18;
  if (hits === 1) return 42;
  return clamp100(42 + ratio * 58 + Math.min(12, hits * 2));
}

/**
 * Apply coverage gate to a raw Fit candidate.
 * @returns {number|null}
 */
function applyFitCoverageGate(rawScore, evidence) {
  if (!evidence || evidence.level === 'none') return null;
  const n = Number(rawScore);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (evidence.level === 'thin') return Math.min(60, clamp100(n));
  return clamp100(n);
}

/**
 * Evidence-backed Fit % for board cards.
 * Uses War Room / film when present; never forges Fit from star rating alone.
 */
function resolveEvidenceBackedFitScore(player, opts = {}) {
  const slug = slugKey(player?.slug || player?.id || opts.slug);
  const pos = player?.pos || player?.position || opts.pos;
  const evidence = assessFitEvidence(slug, opts);
  if (evidence.level === 'none') {
    return { fitScore: null, evidence, source: 'unscored' };
  }

  const warRoom = opts.warRoom !== undefined ? opts.warRoom : loadWarRoom(slug);
  const film = opts.film !== undefined ? opts.film : loadFilm(slug);
  const rubricScore = scoreRubricMatch(pos, warRoom, film);

  // Prefer existing model/store Fit only when evidence exists, then blend with rubric.
  const existing = Number(opts.existingFit ?? player?.fitScore ?? player?.ufFitScore);
  let raw;
  if (Number.isFinite(existing) && existing > 0) {
    raw = existing * 0.55 + rubricScore * 0.45;
  } else {
    raw = rubricScore;
  }

  // Full evidence + written schemeFit gets a small authenticity bump (capped).
  if (evidence.level === 'full' && evidence.hasSchemeFit) {
    raw = Math.min(100, raw + 4);
  }

  const fitScore = applyFitCoverageGate(raw, evidence);
  return {
    fitScore,
    evidence,
    source: evidence.level === 'full' ? 'evidence-full' : 'evidence-thin',
    rubricScore,
  };
}

/** scheme_score (0–100) for uf-fit seed — rubric when evidence exists, else low placeholder. */
function schemeScoreFromEvidence(player, opts = {}) {
  const resolved = resolveEvidenceBackedFitScore(player, opts);
  if (resolved.fitScore == null) return null;
  return resolved.rubricScore ?? resolved.fitScore;
}

module.exports = {
  loadRubric,
  normalizePos,
  assessFitEvidence,
  scoreRubricMatch,
  applyFitCoverageGate,
  resolveEvidenceBackedFitScore,
  schemeScoreFromEvidence,
  positionRubric,
};
