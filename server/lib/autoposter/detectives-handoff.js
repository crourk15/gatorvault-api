/** Detectives handoff gate — allowlist UF recruiting intel only. */
const DEDUPE_SKIP_REASONS = new Set([
  'duplicate_fingerprint',
  'duplicate_commit',
  'duplicate_text',
  'similar_post',
  'ladder_cycle',
  'invalid_candidate',
]);

const HANDOFF_ALLOW = new Set([
  'needs_resolution',
  'no_recruiting_signal',
  'no_identifiable_player',
  'identity_not_confirmed',
  'identity_unconfirmed',
  'single_name_only',
  'beat_skip',
  'filter_reject',
  'guard_reject',
  'enqueue_reject',
  'generic_phrase',
  'no_identifiable_player',
  'strategy_data_missing',
  'missing_situation',
  'copy_failed',
  'quality_gate',
  'recruiting_qa',
  'voice_required_no_legacy_fallback',
  'voice_qa_failed',
  'voice_compose_required',
  'invalid_hook',
]);

const VOICE_DETECTIVES_HANDOFF = new Set([
  'voice_required_no_legacy_fallback',
  'voice_qa_failed',
  'voice_compose_required',
  'invalid_hook',
  'voice_required'
]);

function normalizeDetectivesHandoffReason(reason) {
  const r = String(reason || '').trim();
  if (VOICE_DETECTIVES_HANDOFF.has(r)) return 'strategy_data_missing';
  return r;
}

const HANDOFF_BLOCK = new Set([
  ...DEDUPE_SKIP_REASONS,
  'missing_uf_context',
  'other_program_without_uf',
  'no_player_name',
  'no_football_signal',
  'program_news',
  'team_event',
  'class_year_below_2027',
  'class_year_out_of_scope',
  'disallowed_account',
  'duplicate',
  'intel_duplicate',
  'snapshot',
  'stale',
  'stale_intel',
  'corrupted_headline',
  'empty_text',
  'other_program',
]);

function beatTextFromPayload(payload = {}) {
  const beat = payload.beatPost || {};
  const cand = payload.candidate || {};
  const hints = payload.hints || {};
  return String(
    beat.text || beat.summary || cand.beatText || cand.text || cand.triggerPhrase || hints.beatText || ''
  ).trim();
}

function isJunkBeatText(text) {
  const t = String(text || '');
  if (!t) return true;
  if (/\b(?:greatest runs|top \d+ greatest|My top \d+)\b/i.test(t)) return true;
  if (/\b(?:power ranking|top \d+ best|best \d+ recruits)\b/i.test(t) && /\b(?:#GoCanes|miami recruits)\b/i.test(t)) return true;
  if (/\b#GoCanes\b/i.test(t) && !/\b(?:florida|gators|\buf\b|gainesville|swamp)\b/i.test(t)) return true;
  if (/\bNo\.\s*\d+\s*[—–-]\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?['’]s\s+\d+-yard\b/i.test(t)) return true;
  if (/\bbaseball roster\b/i.test(t)) return true;
  if (/\b(?:World Cup|LET'S GO 🇺🇸|Survive and Advance)\b/i.test(t)) return true;
  if (/\bcommitted to (?:Washington|Colorado|Oregon|Auburn|Ducks)\b/i.test(t) && !/\b(?:florida|gators|\buf\b|gainesville|swamp)\b/i.test(t)) return true;
  if (/\bGator Nation Twitter\b/i.test(t)) return true;
  if (/^👀\s*https?:\/\//i.test(t) && t.length < 80) return true;
  return false;
}

function hasUfRecruitingSignal(text) {
  const t = String(text || '');
  if (!t) return false;
  const hasUf = /\b(?:florida|gators|\buf\b|gainesville|swamp|the swamp)\b/i.test(t);
  if (!hasUf) return false;
  if (/\b20(?:2[7-9]|3[0-2])\b/.test(t)) return true;
  if (/\b(?:swamp|gainesville|the swamp|friday night lights|\bfnl\b)\b/i.test(t)) return true;
  if (/\b(?:recruit|visit|commit|offer|top three|eye on florida|official visit|unofficial visit)\b/i.test(t)) return true;
  if (/\b(?:rpm|prediction|decision day|futurecast)\b/i.test(t)) return true;
  if (/\b(?:commitment date|sets commitment|commit date)\b/i.test(t)) return true;
  if (/\b(?:flip targets|pending decisions|2028 class|recruiting storyline|July is here and the Florida Gators)\b/i.test(t)) return true;
  if (/\b(?:4|5)[- ]star\b/i.test(t)) return true;
  return false;
}

function shouldHandoff(reason, payload = {}) {
  const r = normalizeDetectivesHandoffReason(reason);
  if (!r || HANDOFF_BLOCK.has(r)) return false;
  if (!HANDOFF_ALLOW.has(r)) return false;
  const text = beatTextFromPayload(payload);
  if (isJunkBeatText(text)) return false;
  if (r === 'needs_resolution') return hasUfRecruitingSignal(text);
  if (r === 'no_identifiable_player') return hasUfRecruitingSignal(text);
  if (r === 'no_recruiting_signal') return hasUfRecruitingSignal(text);
  if (r === 'strategy_data_missing' || r === 'missing_situation') return hasUfRecruitingSignal(text);
  return hasUfRecruitingSignal(text);
}

function isDismissibleCase(caseItem) {
  if (!caseItem) return true;
  return !shouldHandoff(caseItem.skipReason, caseItem);
}

function casePriority(caseItem) {
  const text = beatTextFromPayload(caseItem);
  let score = 0;
  if (caseItem?.skipReason === 'needs_resolution') score += 100;
  if (/\b20(?:2[7-9]|3[0-2])\b/.test(text)) score += 50;
  if (/\b(?:swamp|fnl|friday night lights|official visit|unofficial visit)\b/i.test(text)) score += 40;
  if (/\b(?:DL|QB|RB|WR|EDGE|IOL|ATH)\b/i.test(text)) score += 15;
  const identity = (caseItem?.investigationLog || []).find((l) => l.phase === 'identity');
  if (identity?.playerName) score += 25;
  if (caseItem?.status === 'investigating') score += 10;
  score -= Math.min(20, Number(caseItem?.attempts) || 0);
  return score;
}

function sortCasesForProcessing(rows) {
  return [...rows].sort((a, b) => casePriority(b) - casePriority(a) || new Date(a.createdAt) - new Date(b.createdAt));
}

module.exports = {
  DEDUPE_SKIP_REASONS,
  HANDOFF_ALLOW,
  HANDOFF_BLOCK,
  shouldHandoff,
  isDismissibleCase,
  isJunkBeatText,
  casePriority,
  sortCasesForProcessing,
  beatTextFromPayload,
  hasUfRecruitingSignal,
  normalizeDetectivesHandoffReason,
  VOICE_DETECTIVES_HANDOFF,
};
