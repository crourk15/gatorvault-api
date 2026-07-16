/**
 * Elite scaffold gate — reject mad-lib Program Pulse / scheme-dump drafts.
 * Used by validateDraftQuality (generation + Approve). Hand-polished drafts skip these checks.
 */

const EVENT_FIRST_CATEGORIES = new Set([
  'heat_check',
  'post_visit',
  'post_visit_reaction',
  'official_visit',
  'official_visit_preview',
  'program_pulse',
]);

const SCHEME_DUMP_MARKERS = [
  'JACK and STAR',
  'eat doubles',
  'mid-October — not in December',
  'first fall scrimmage',
  'cover-and-rush bodies',
];

function stripHtml(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function draftScanText(draft) {
  const parts = [
    draft?.title,
    draft?.summary,
    draft?.thesis,
    draft?.body,
    draft?.scaffoldBody,
    ...(draft?.insiderAngles || []),
  ];
  return stripHtml(parts.filter(Boolean).join('\n'));
}

function isEventFirstCategory(category) {
  const c = String(category || '').toLowerCase().trim();
  if (!c) return false;
  if (EVENT_FIRST_CATEGORIES.has(c)) return true;
  if (c.startsWith('post_visit')) return true;
  if (c.startsWith('official_visit')) return true;
  if (c === 'heat_check') return true;
  return false;
}

function hasConcreteEventAnchor(text) {
  if (!text) return false;
  // Month Day ("July 6", "Jul 7", "September 12")
  if (/\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2}\b/i.test(text)) {
    return true;
  }
  // YYYY-MM-DD
  if (/\b20\d{2}-\d{2}-\d{2}\b/.test(text)) return true;
  // commitDate mention
  if (/\bcommit(?:ted)?\s*date\b/i.test(text)) return true;
  // "committed" with a nearby capitalized name
  if (/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\s+committed\b/.test(text)) return true;
  if (/\bcommitted\b[\s\S]{0,80}\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/.test(text)) return true;
  if (/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b[\s\S]{0,80}\bcommitted\b/.test(text)) return true;
  return false;
}

/**
 * @returns {string[]} hard-fail reason codes
 */
function detectScaffoldBoilerplate(draft) {
  const reasons = [];
  if (!draft || typeof draft !== 'object') return reasons;

  const text = draftScanText(draft);
  if (!text) return reasons;

  if (
    /miss one, and September gets expensive/i.test(text) ||
    (/running roster churn/i.test(text) && /scheme install/i.test(text) && /board closes/i.test(text))
  ) {
    reasons.push('not_elite_scaffold_program_pulse');
  }

  let schemeHits = 0;
  for (const marker of SCHEME_DUMP_MARKERS) {
    if (text.includes(marker)) schemeHits += 1;
  }
  if (schemeHits >= 3) {
    reasons.push('not_elite_scaffold_scheme_dump');
  }

  if (
    /Board focus:\s*\d+\s+live\s+20\d{2}\s+targets/i.test(text) ||
    /Intel desk:\s*\d+\s+verified signals/i.test(text)
  ) {
    reasons.push('not_elite_scaffold_board_focus');
  }

  if (/Heat desk:\s*0 rising prospects/i.test(text)) {
    reasons.push('not_elite_scaffold_heat_desk');
  }

  const handPolished = (draft.qualityReasons || []).includes('hand_polished_for_approve');
  if (
    !handPolished &&
    isEventFirstCategory(draft.category) &&
    !hasConcreteEventAnchor(text)
  ) {
    reasons.push('not_elite_no_event_anchor');
  }

  return reasons;
}

module.exports = {
  detectScaffoldBoilerplate,
  isEventFirstCategory,
  hasConcreteEventAnchor,
  EVENT_FIRST_CATEGORIES,
  SCHEME_DUMP_MARKERS,
};
