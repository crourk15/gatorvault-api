/**
 * Sweep verified portal targets into a last-good report for Portal Room.
 * On3 + beat intel + recruiting store. Empty sources stay empty.
 */
const fs = require('fs');
const path = require('path');
const { resolveRecruitingDataDir } = require('./recruiting-data-dir');
const {
  collectPortalTargetCandidates,
  rankPortalTargets,
  toScanChip,
  loadPffScanBoard,
} = require('./portal-target-finder');
const { getFanPortalPrep } = require('./portal-fan-prep');

const BUNDLE_REPORT = path.join(__dirname, '..', 'data', 'portal', 'winter-2027-targets.json');

function reportPath() {
  return path.join(resolveRecruitingDataDir(), 'portal-targets-last-report.json');
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function reportHasTargets(report) {
  if (!report || typeof report !== 'object') return false;
  if (Array.isArray(report.targets) && report.targets.length > 0) return true;
  const rooms = report.rooms || {};
  return Object.keys(rooms).some((key) => Array.isArray(rooms[key]) && rooms[key].length > 0);
}

function readLastReport() {
  const live = readJson(reportPath());
  const bundle = readJson(BUNDLE_REPORT);
  if (reportHasTargets(live)) return live;
  if (reportHasTargets(bundle)) return bundle;
  return live || bundle || { ok: true, targets: [], rooms: {} };
}

function writeLastReport(report) {
  const dest = reportPath();
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, `${JSON.stringify(report, null, 2)}\n`);
  return dest;
}

async function loadIncoming() {
  try {
    const store = require('./recruiting-store');
    const board = await store.getPortalBoard();
    return Array.isArray(board && board.incoming) ? board.incoming : [];
  } catch (err) {
    console.warn('[portal-target-sweep] board read failed', err && err.message);
    return [];
  }
}

function loadIntel() {
  try {
    const intelStore = require('./recruiting-intel-store');
    return intelStore.listIntel({ limit: 400 });
  } catch (err) {
    console.warn('[portal-target-sweep] intel read failed', err && err.message);
    return [];
  }
}

async function loadOn3(opts = {}) {
  if (opts.skipOn3) return [];
  try {
    const { fetchFloridaPortalWatch } = require('./on3-portal-watch');
    return await fetchFloridaPortalWatch({ timeout: opts.on3TimeoutMs || 8000 });
  } catch (err) {
    console.warn('[portal-target-sweep] On3 watch failed', err && err.message);
    return [];
  }
}

function roomsFromPrep(prep) {
  return (prep.rooms || []).map((row) => ({
    room: row.room,
    tier: row.tier,
    rank: row.rank,
  }));
}

async function runPortalTargetSweep(opts = {}) {
  const prep = getFanPortalPrep(opts.at || new Date());
  const [incoming, on3] = await Promise.all([loadIncoming(), loadOn3(opts)]);
  const intel = opts.intel || loadIntel();
  const scan = opts.skipScan ? [] : (opts.scan || loadPffScanBoard());
  const candidates = collectPortalTargetCandidates({
    incoming: opts.incoming || incoming,
    intel,
    on3: opts.on3 || on3,
    scan,
  });
  const ranked = rankPortalTargets(candidates, roomsFromPrep(prep));
  const rooms = {};
  const targets = [];
  for (const room of prep.rooms || []) {
    const rows = ranked.get(room.room) || [];
    rooms[room.room] = rows.map(toScanChip).filter(Boolean);
    for (const row of rows) targets.push(row);
  }
  const report = {
    ok: true,
    fanShip: false,
    updatedAt: new Date().toISOString(),
    window: prep.window,
    sources: {
      on3: (opts.on3 || on3).length,
      intel: intel.length,
      incoming: (opts.incoming || incoming).length,
      scan: scan.length,
    },
    targetCount: targets.length,
    rooms,
    targets: targets.map(toScanChip).filter(Boolean),
  };
  if (!opts.dryRun) writeLastReport(report);
  return report;
}

function scanTargetsForRoom(room, report = readLastReport()) {
  const key = String(room || '').trim();
  const rows = report && report.rooms && report.rooms[key];
  return Array.isArray(rows) ? rows : [];
}

module.exports = {
  BUNDLE_REPORT,
  reportPath,
  readLastReport,
  runPortalTargetSweep,
  scanTargetsForRoom,
};
