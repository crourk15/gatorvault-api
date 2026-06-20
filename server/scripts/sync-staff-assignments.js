/**
 * Apply seed staff assignments to hub-class players.
 * Usage: node scripts/sync-staff-assignments.js
 */
const { syncStaffAssignments } = require('../lib/recruiting-staff-assignments');

(async () => {
  const result = await syncStaffAssignments();
  console.log('Staff sync complete:', result);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
