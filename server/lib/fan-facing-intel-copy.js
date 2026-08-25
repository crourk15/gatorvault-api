/**
 * Fan-facing recruiting copy — Home NOW / hub ticker / movement alerts.
 * Beat Desk + allowlist-intel ops language stays internal; never paint it for Gator Nation.
 */
'use strict';

const DESK_OPS_RE =
  /continuous allowlist intel sweep|from player card|allowlist board pulse|beat brief|beat desk|copy brief|open brief|staff note\s*—|gatorvault beat brief|auto:allowlist|provisional.*?film desk|film desk verified/i;

const THIN_DESK_SUMMARY_RE =
  /^(staff note|visit update|beat intel|commit check-?ins)\b/i;

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
  if (/\bflorida\s+offer\b/i.test(src)) {
    return name ? name + ' — Florida offer' : 'Florida offer';
  }
  if (/\bflorida\s+(?:unofficial\s+|official\s+)?visit\b/i.test(src)) {
    return name ? name + ' — Florida visit' : 'Florida visit';
  }
  return null;
}

function cleanFanFacingResidue(raw) {
  return String(raw || '')
    .replace(/^[\s·•\-—–|]+/, '')
    .replace(/[\s·•\-—–|]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
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

  raw = raw
    .replace(/\s*Continuous allowlist intel sweep\.?/gi, '')
    .replace(/\s*from player card\.?/gi, '')
    .replace(/\s*\(allowlist board pulse\)\.?/gi, '')
    .replace(/^staff note\s*[—\-]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  raw = cleanFanFacingResidue(raw);

  if (!raw || isDeskOpsIntelCopy(raw)) {
    return salvageFloridaProcess(text, playerName);
  }

  // Thin residue after stripping ops jargon — prefer named fan line.
  if (playerName && /^(florida\s+(?:offer|visit))$/i.test(raw)) {
    return salvageFloridaProcess(text, playerName) || raw;
  }

  return raw.length > 140 ? raw.slice(0, 137) + '\u2026' : raw;
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
  return raw;
}

module.exports = {
  isDeskOpsIntelCopy: isDeskOpsIntelCopy,
  toFanFacingIntelDetail: toFanFacingIntelDetail,
  toFanFacingHubSummary: toFanFacingHubSummary,
};
