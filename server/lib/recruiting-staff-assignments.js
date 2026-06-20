/**
 * Seed-based staff lead assignments for hub-class recruits (until CRM exists).
 */
const fs = require('fs');
const path = require('path');
const store = require('./recruiting-store');
const { normalizeStaffId } = require('./recruiting-staff-directory');

const ASSIGNMENTS_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'staff-assignments.json');
const HUB_CLASS_YEARS = [2027, 2028, 2029];

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function loadStaffAssignmentsDoc() {
  return readJson(ASSIGNMENTS_PATH, { version: 1, assignments: {} });
}

function getAssignmentMap() {
  const doc = loadStaffAssignmentsDoc();
  return doc.assignments || {};
}

function applyStaffAssignmentsToPlayer(player) {
  if (!player?.slug) return player;
  const map = getAssignmentMap();
  const key = String(player.slug).toLowerCase();
  const row = map[key];
  if (!row) return player;

  const patch = { ...player };
  if (row.staff_lead_id) {
    patch.staff_lead_id = normalizeStaffId(row.staff_lead_id);
    patch.staffLeadId = patch.staff_lead_id;
  }
  if (row.secondary_recruiter_id) {
    patch.secondary_recruiter_id = normalizeStaffId(row.secondary_recruiter_id);
    patch.secondaryRecruiterId = patch.secondary_recruiter_id;
  }
  return patch;
}

async function syncStaffAssignments() {
  const map = getAssignmentMap();
  const slugs = Object.keys(map);
  if (!slugs.length) {
    return { staffAssignedCount: 0, skipped: 0, errors: [] };
  }

  let staffAssignedCount = 0;
  let skipped = 0;
  const errors = [];

  const all = await store.getAllPlayers();
  const hubPlayers = all.filter((p) => HUB_CLASS_YEARS.includes(Number(p.classYear)));

  for (const player of hubPlayers) {
    const slug = String(player.slug || '').toLowerCase();
    if (!map[slug]) continue;

    try {
      const merged = applyStaffAssignmentsToPlayer(player);
      if (
        merged.staff_lead_id === player.staff_lead_id &&
        merged.secondary_recruiter_id === player.secondary_recruiter_id
      ) {
        skipped += 1;
        continue;
      }
      await store.upsertPlayer(merged, { subsystem: 'staff-assignments-sync' });
      staffAssignedCount += 1;
    } catch (err) {
      errors.push({ slug, message: err.message });
    }
  }

  return { staffAssignedCount, skipped, errors, seedCount: slugs.length };
}

module.exports = {
  ASSIGNMENTS_PATH,
  loadStaffAssignmentsDoc,
  getAssignmentMap,
  applyStaffAssignmentsToPlayer,
  syncStaffAssignments,
};
