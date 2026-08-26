/**
 * Fan-facing recruiting copy — Home NOW / hub ticker / movement alerts.
 * Beat Desk + allowlist-intel ops language stays internal; never paint it for Gator Nation.
 */
'use strict';

const DESK_OPS_RE =
  /continuous allowlist intel sweep|from player card|allowlist board pulse|beat brief|beat desk|copy brief|open brief|staff note\s*—|gatorvault beat brief|auto:allowlist|provisional.*?film desk|film desk verified|\bon file\b/i;

const THIN_DESK_SUMMARY_RE =
  /^(staff note|visit update|beat intel|commit check-?ins)\b/i;

/** On3 / beat article dumps — too long for the NOW strip. */
const ARTICLE_PROSE_RE =
  /\b(four|three|five)-star\b|\btells?\s+@|\bNEW:\s*\d{4}\b|has not been on .{0,40}campus|visit the Swamp|along with \d+ other/i;

function isDeskOpsIntelCopy(text) {
  const raw = String(text || '').trim();
  if (!raw) return true;
  if (DESK_OPS_RE.test(raw)) return true;
  if (THIN_DESK_SUMMARY_RE.test(raw)) return true;
  return false;
}

function salvageFloridaProcess(text, playerName) {
  const src = String(text || '');
  const name = String(playerName || '').trim();
  if (/\bflorida\s+offer\b|\boffer from florida\b/i.test(src)) {
    return name ? name + ' — Florida offer' : 'Florida offer';
  }
  if (
    /\bflorida\s+(?:unofficial\s+|official\s+)?visit\b/i.test(src) ||
    /visit(?:ing|s)?\s+(?:the\s+)?(?:swamp|florida|gainesville)/i.test(src) ||
    /(?:florida|gainesville|the swamp)(?:['\u2019]s)?\s+campus/i.test(src) ||
    /on campus for flor/i.test(src) ||
    /gainesville visit/i.test(src)
  ) {
    const when = extractVisitWhen(src);
    const line = 'Florida visit' + when;
    return name ? name + ' — ' + line : line;
  }
  return null;
}

function extractVisitWhen(src) {
  const t = String(src || '');
  if (/\bthis fall\b/i.test(t)) return ' this fall';
  if (/\bthis weekend\b/i.test(t)) return ' this weekend';
  if (/\bthis week\b/i.test(t)) return ' this week';
  if (/\bnext week\b/i.test(t)) return ' next week';
  const m = t.match(
    /\b((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2})\b/i
  );
  if (m) return ' ' + m[1];
  return '';
}

function cleanFanFacingResidue(raw) {
  return String(raw || '')
    .replace(/^[\s·•\-—–|]+/, '')
    .replace(/[\s·•\-—–|]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strip allowlist / desk residue while keeping the fan fact. */
function stripDeskOpsResidue(text) {
  return String(text || '')
    .replace(/\s*Continuous allowlist intel sweep\.?/gi, '')
    .replace(/\s*from player card\.?/gi, '')
    .replace(/\s*\(allowlist board pulse\)\.?/gi, '')
    .replace(/\s+on file(?:\s*\([^)]*\))?\.?/gi, '')
    .replace(/^staff note\s*[—\-]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeArticleProse(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (t.length > 100) return true;
  if (/[…]|\.{3}\s*$/.test(t)) return true;
  if (ARTICLE_PROSE_RE.test(t)) return true;
  if ((t.match(/[.!?]/g) || []).length >= 2) return true;
  return false;
}

/**
 * Home NOW never mid-cuts a sentence with "…".
 * Prefer a finished clause; otherwise drop (caller may salvage).
 */
function finishWithoutEllipsis(text, maxLen) {
  const max = Number(maxLen) > 0 ? Number(maxLen) : 100;
  const t = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[…]|\.{2,}\s*$/g, '')
    .trim();
  if (!t) return null;
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sentenceBreak = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (sentenceBreak >= 28) return cut.slice(0, sentenceBreak + 1).trim();
  const clauseBreak = Math.max(cut.lastIndexOf('; '), cut.lastIndexOf(' — '), cut.lastIndexOf(' · '));
  if (clauseBreak >= 28) return cut.slice(0, clauseBreak).trim();
  const sp = cut.lastIndexOf(' ');
  if (sp >= 28) {
    return cut
      .slice(0, sp)
      .replace(/[,:;·•\-—–]+$/g, '')
      .trim();
  }
  return null;
}

function compressHomeNowProse(text, playerName, eventType) {
  const src = String(text || '');
  const name = String(playerName || '').trim();
  const et = String(eventType || '').toLowerCase();

  const salvaged = salvageFloridaProcess(src, name);
  if (salvaged) return salvaged;

  if (/offer/.test(et) && /florida/i.test(src)) {
    return name ? name + ' — Florida offer' : 'Florida offer';
  }
  if (/visit/.test(et) && /florida|swamp|gainesville/i.test(src)) {
    const when = extractVisitWhen(src);
    const line = 'Florida visit' + when;
    return name ? name + ' — ' + line : line;
  }

  return finishWithoutEllipsis(src, 100);
}

function toFanFacingIntelDetail(text, opts) {
  opts = opts || {};
  var eventType = opts.eventType || '';
  var playerName = opts.playerName || '';
  var raw = String(text || '').trim();
  if (!raw) return null;

  var et = String(eventType || '').toLowerCase();
  if (et === 'staff_note' || et === 'target_update' || et === 'note') {
    return null;
  }

  raw = cleanFanFacingResidue(stripDeskOpsResidue(raw));

  if (!raw || isDeskOpsIntelCopy(raw)) {
    return salvageFloridaProcess(text, playerName);
  }

  // Thin residue after stripping ops jargon — prefer named fan line.
  if (playerName && /^(florida\s+(?:offer|visit))$/i.test(raw)) {
    return salvageFloridaProcess(text, playerName) || raw;
  }

  // Article / beat blurbs → short finished chips. Never "along wi…".
  if (looksLikeArticleProse(raw)) {
    return compressHomeNowProse(raw, playerName, et);
  }

  if (raw.length > 100) {
    return compressHomeNowProse(raw, playerName, et);
  }

  return raw;
}

function toFanFacingHubSummary(summary, opts) {
  opts = opts || {};
  var eventType = opts.eventType || '';
  var et = String(eventType || '').toLowerCase();
  if (et === 'staff_note' || et === 'target_update') return null;
  var raw = String(summary || '').trim();
  if (!raw) return null;
  if (/^staff note\b/i.test(raw)) return null;
  if (/^visit update$/i.test(raw)) return null;
  if (isDeskOpsIntelCopy(raw)) {
    return toFanFacingIntelDetail(raw, { eventType: et });
  }
  // Prefer fan phrasing over offer-log "Offer from Florida".
  if (/^offer from florida$/i.test(raw)) return 'Florida offer';
  if (/^offer from\b/i.test(raw)) {
    const school = raw.replace(/^offer from\s+/i, '').replace(/\s+Aggies$/i, '').trim();
    return school ? 'Offer from ' + school : raw;
  }
  if (looksLikeArticleProse(raw)) {
    return toFanFacingIntelDetail(raw, { eventType: et });
  }
  return raw;
}

module.exports = {
  isDeskOpsIntelCopy: isDeskOpsIntelCopy,
  toFanFacingIntelDetail: toFanFacingIntelDetail,
  toFanFacingHubSummary: toFanFacingHubSummary,
  stripDeskOpsResidue: stripDeskOpsResidue,
  looksLikeArticleProse: looksLikeArticleProse,
  finishWithoutEllipsis: finishWithoutEllipsis,
};
