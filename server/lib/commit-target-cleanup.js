/**
 * Remove UF commits from target-board seeds and normalize player rows at ingest time.
 * API-layer dedupe (recruiting-board-enrich) remains a backup defense.
 */
const fs = require('fs');
const path = require('path');
const { resolveTargetBoardPath } = require('./target-board-path');

const LOG_PATH = path.join(__dirname, '..', 'data', 'ops', 'commit-target-cleanup-log.json');
const BOARD_YEARS = [2027, 2028];

function isUfHubCommit(player) {
  if (!player) return false;
  const status = String(player.status || '').toLowerCase();
  const committedTo = String(player.committedTo || player.committed_to || '').trim();
  return (
    ['committed', 'commit', 'signed', 'enrolled'].includes(status) &&
    /^florida$/i.test(committedTo)
  );
}

function normalizeCommitPlayerFields(player) {
  if (!isUfHubCommit(player)) return player;
  return {
    ...player,
    category: 'recruit',
    status: 'committed',
    committedTo: player.committedTo || player.committed_to || 'Florida',
  };
}

function readTargetBoardDoc(classYear, rootDir) {
  const filePath = resolveTargetBoardPath(classYear, rootDir);
  try {
    return { filePath, doc: JSON.parse(fs.readFileSync(filePath, 'utf8')) };
  } catch {
    return { filePath, doc: null };
  }
}

function writeTargetBoardDoc(filePath, doc) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(doc, null, 2)}\n`);
}

function removeSlugFromTargetBoard(slug, classYear, rootDir) {
  const key = String(slug || '').trim().toLowerCase();
  if (!key) return { removed: false, classYear, reason: 'missing_slug' };

  const { filePath, doc } = readTargetBoardDoc(classYear, rootDir);
  if (!doc || !Array.isArray(doc.targets)) {
    return { removed: false, classYear, reason: 'board_missing' };
  }

  const before = doc.targets.length;
  doc.targets = doc.targets.filter((row) => String(row?.slug || '').toLowerCase() !== key);
  if (doc.targets.length === before) {
    return { removed: false, classYear, reason: 'not_on_board' };
  }

  writeTargetBoardDoc(filePath, doc);
  return { removed: true, classYear, before, after: doc.targets.length };
}

function appendCleanupLog(entry) {
  let doc = { version: 1, entries: [] };
  try {
    doc = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
  } catch {
    /* new log */
  }
  doc.entries = [entry, ...(doc.entries || [])].slice(0, 200);
  doc.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.writeFileSync(LOG_PATH, `${JSON.stringify(doc, null, 2)}\n`);
}

function applyCommitTargetCleanup(player, options = {}) {
  const slug = String(player?.slug || '').trim().toLowerCase();
  if (!slug || !isUfHubCommit(player)) {
    return { ok: false, skipped: true, reason: 'not_uf_commit', slug: slug || null };
  }

  const classYear = parseInt(player.classYear, 10);
  const years = Number.isFinite(classYear) ? [classYear, ...BOARD_YEARS] : BOARD_YEARS;
  const uniqueYears = [...new Set(years.filter((y) => BOARD_YEARS.includes(y)))];

  const boardResults = [];
  for (const year of uniqueYears) {
    boardResults.push(removeSlugFromTargetBoard(slug, year, options.rootDir));
  }

  const removedFromBoards = boardResults.filter((r) => r.removed).map((r) => r.classYear);
  const entry = {
    at: new Date().toISOString(),
    slug,
    name: player.name || null,
    classYear: player.classYear || null,
    source: options.source || 'upsert',
    removedFromBoards,
    boardResults,
  };
  if (!options.quiet) appendCleanupLog(entry);

  return {
    ok: true,
    slug,
    removedFromBoards,
    boardResults,
    normalized: normalizeCommitPlayerFields(player),
  };
}

async function reconcileCommittedTargetsFromStore(store, options = {}) {
  const players = await store.getAllPlayers();
  const committed = players.filter(isUfHubCommit);
  const results = [];
  for (const player of committed) {
    results.push(
      applyCommitTargetCleanup(player, {
        source: options.source || 'reconcile',
        quiet: options.quiet,
        rootDir: options.rootDir,
      })
    );
  }
  return {
    ok: true,
    scanned: committed.length,
    removedBoardEntries: results.filter((r) => r.removedFromBoards?.length).length,
    results,
  };
}

module.exports = {
  isUfHubCommit,
  normalizeCommitPlayerFields,
  removeSlugFromTargetBoard,
  applyCommitTargetCleanup,
  reconcileCommittedTargetsFromStore,
  BOARD_YEARS,
};