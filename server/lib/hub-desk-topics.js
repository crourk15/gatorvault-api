/**
 * Hub desk topics — team / program / staff beats (not recruit board packets).
 * GatorVault covers the whole program: camp, staff, schedule, facilities, etc.
 */
'use strict';

const TEAM_LABELS = {
  camp: 'Fall camp / practice',
  staff: 'Staff news',
  kickoff: 'Kickoff / game time',
  schedule: 'Schedule / TV',
  uniform: 'Uniforms',
  depth_chart: 'Depth chart',
  roster: 'Roster move',
  game_week: 'Game week',
  injury: 'Injury report',
  general: 'Team news',
};

const PROGRAM_LABELS = {
  stadium_facility: 'Stadium / facilities',
  nil_infrastructure: 'NIL / collective',
  athletic_release: 'Athletic dept release',
  sec_tv: 'SEC / TV',
  realignment: 'Conference / realignment',
  branding: 'Brand / identity',
  general: 'Program news',
};

function normalizeSlug(slug) {
  return String(slug || '').trim().toLowerCase();
}

function hubDeskSlug(kind, type) {
  const k = kind === 'program' ? 'program' : 'team';
  const t = String(type || 'general')
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'general';
  return `uf-${k}-${t}`;
}

function parseHubDeskSlug(slug) {
  const m = normalizeSlug(slug).match(/^uf-(team|program)-(.+)$/);
  if (!m) return null;
  return {
    kind: m[1],
    type: m[2].replace(/-/g, '_'),
  };
}

function isHubDeskSlug(slug) {
  return !!parseHubDeskSlug(slug);
}

function hubDeskLabel(kind, type) {
  const t = String(type || 'general');
  if (kind === 'program') return PROGRAM_LABELS[t] || PROGRAM_LABELS.general;
  return TEAM_LABELS[t] || TEAM_LABELS.general;
}

function hasNamedRecruitSignal(text) {
  const t = String(text || '');
  if (!/\b(offer|offers|visit|visits|\bov\b|official visit|unofficial|commit|commitment|target|targets|recruit|recruiting|in the mix|near the top)\b/i.test(t)) {
    return false;
  }
  try {
    const { extractPlayerFromText } = require('./x-autoposter-copy');
    const { isValidPlayerName } = require('./x-autoposter-player-context');
    const name = extractPlayerFromText(t);
    return !!(name && isValidPlayerName(name));
  } catch {
    return false;
  }
}

/** Nameless On3+ teasers (EDGE prospect + visit) must not become Team news. */
function looksLikeNamelessRecruitTeaser(text, post = null) {
  const t = String(text || '');
  if (!t) return false;
  const recruitCue =
    /\b(EDGE|WR|QB|RB|TE|OL|DL|LB|CB|ATH|prospect|pass rusher|4-star|five-star|four-star|3-star)\b/i.test(
      t
    ) &&
    /\b(visit|visited|offer|offered|target|recruit|momentum|in the mix|frontrunner)\b/i.test(t);
  if (!recruitCue) return false;
  try {
    const teaser = require('./beat-teaser-resolve');
    if (teaser.hasResolvableOn3Article?.(post) || teaser.collectPostUrls?.(post)?.some((u) => /t\.co\//i.test(u))) {
      return true;
    }
  } catch {
    /* fall through */
  }
  return /on3\+|t\.co\//i.test(t);
}

/**
 * Classify a beat into a hub desk row (team/program) or null.
 * Subscribe promos return null (caller should skip).
 */
function classifyHubDeskBeat(text, post = null) {
  const prefilter = require('./beat-intel-prefilter');
  const t = String(text || '').trim();
  if (!t) return null;
  if (prefilter.isSubscribePromoIntel?.(t)) return null;

  if (looksLikeNamelessRecruitTeaser(t, post)) {
    return null;
  }

  if (prefilter.isProgramNewsIntel?.(t, post) && !hasNamedRecruitSignal(t)) {
    const type = prefilter.classifyProgramNewsType?.(t) || 'general';
    return {
      deskKind: 'program',
      eventType: 'program_news',
      topicType: type,
      playerSlug: hubDeskSlug('program', type),
      playerName: hubDeskLabel('program', type),
    };
  }

  if (prefilter.isTeamEventIntel?.(t, post) && !hasNamedRecruitSignal(t)) {
    const type = prefilter.classifyTeamEventType?.(t) || 'general';
    return {
      deskKind: 'team',
      eventType: 'team_event',
      topicType: type,
      playerSlug: hubDeskSlug('team', type),
      playerName: hubDeskLabel('team', type),
    };
  }

  return null;
}

module.exports = {
  TEAM_LABELS,
  PROGRAM_LABELS,
  hubDeskSlug,
  parseHubDeskSlug,
  isHubDeskSlug,
  hubDeskLabel,
  looksLikeNamelessRecruitTeaser,
  hasNamedRecruitSignal,
  classifyHubDeskBeat,
  normalizeSlug,
};
