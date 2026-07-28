/**
 * Admin Hub — FutureCast + allowlist control surface helpers.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  loadAdminAllowlist,
  addToAdminAllowlist,
  removeFromAdminAllowlist,
} = require('./admin-allowlist-store');
const {
  ALLOWLIST_2027,
  ALLOWLIST_2028,
  CANONICAL_TARGET_NAMES,
} = require('./recruiting-target-allowlist');

const BOARD_2028 = path.join(__dirname, '..', 'data', 'recruiting', '2028-target-board.json');
const EARLY_WATCH = path.join(__dirname, '..', 'data', 'futurecast', 'early-watchlist.json');
const ON3_RPM = path.join(__dirname, '..', 'data', 'war-room', 'on3-rpm-allowlist.json');

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function boardTargets(classYear) {
  const file =
    classYear === 2028
      ? BOARD_2028
      : path.join(__dirname, '..', 'data', 'recruiting', `${classYear}-target-board.json`);
  const doc = readJson(file, { targets: [] });
  return Array.isArray(doc.targets) ? doc.targets : [];
}

function earlyWatchEntries() {
  const doc = readJson(EARLY_WATCH, { entries: [] });
  const list = Array.isArray(doc.entries) ? doc.entries : Array.isArray(doc) ? doc : [];
  return list
    .map((e) => ({
      slug: String(e.slug || e.playerSlug || '').toLowerCase(),
      name: e.name || e.playerName || null,
      classYear: e.classYear || e.year || null,
      source: e.source || e.reason || null,
      updatedAt: e.updatedAt || e.addedAt || null,
    }))
    .filter((e) => e.slug);
}

function on3RpmEntries() {
  const doc = readJson(ON3_RPM, { entries: [] });
  return Array.isArray(doc.entries) ? doc.entries : [];
}

function buildFutureCastHubSummary() {
  const admin = loadAdminAllowlist();
  const board2028 = boardTargets(2028);
  const board2027 = boardTargets(2027);
  const watch = earlyWatchEntries();
  const rpm = on3RpmEntries();

  const adminRows = (admin.slugs2028 || []).map((slug) => ({
    slug,
    name: admin.names?.[slug] || CANONICAL_TARGET_NAMES[slug] || slug,
    classYear: 2028,
    source: 'admin_allowlist',
  }));

  const boardSample = board2028.slice(0, 40).map((t) => ({
    slug: String(t.slug || '').toLowerCase(),
    name: t.name || t.slug,
    pos: t.pos || t.position || null,
    ufPct: t.ufPct ?? t.targetingPct ?? t.ufProbability ?? null,
    source: t.source || 'target_board',
  }));

  return {
    ok: true,
    updatedAt: new Date().toISOString(),
    counts: {
      locked2027: (ALLOWLIST_2027 || []).length,
      locked2028: (ALLOWLIST_2028 || []).length,
      admin2028: adminRows.length,
      board2027: board2027.length,
      board2028: board2028.length,
      earlyWatch: watch.length,
      on3RpmTracked: rpm.length,
    },
    notes: {
      closingClass2027: 'Hard-locked — admin allowlist cannot expand 2027.',
      deskFeed:
        'Beat Desk Open feeds FutureCast (board fields + UF% nudge / seed) when Florida involvement is real.',
    },
    adminAllowlist2028: adminRows,
    board2028Sample: boardSample,
    earlyWatch: watch.slice(0, 40),
  };
}

function addAllowlistTarget({ slug, name, classYear }) {
  return addToAdminAllowlist({ slug, name, classYear: classYear || 2028 });
}

function removeAllowlistTarget({ slug, classYear }) {
  return removeFromAdminAllowlist({ slug, classYear: classYear || 2028 });
}

module.exports = {
  buildFutureCastHubSummary,
  addAllowlistTarget,
  removeAllowlistTarget,
  boardTargets,
  earlyWatchEntries,
};
