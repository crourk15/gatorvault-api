/**
 * UF recruiting staff directory — single source of truth for hub footprint overlays.
 */
const STAFF_DIRECTORY = {
  sumrall: { staffId: 'sumrall', name: 'Jon Sumrall', role: 'Head Coach' },
  faulkner: { staffId: 'faulkner', name: 'Buster Faulkner', role: 'Offensive Coordinator' },
  white: { staffId: 'white', name: 'Brad White', role: 'Defensive Coordinator' },
  chatman: { staffId: 'chatman', name: 'Gerald Chatman', role: 'Assistant Head Coach / DL' },
  collins: { staffId: 'collins', name: 'Chris Collins', role: 'Safeties Coach' },
  craddock: { staffId: 'craddock', name: 'Joe Craddock', role: 'Quarterbacks Coach' },
  davis: { staffId: 'davis', name: 'Marcus Davis', role: 'Outside Wide Receivers Coach' },
  foster: { staffId: 'foster', name: 'Chris Foster', role: 'Running Backs Coach' },
  galante: { staffId: 'galante', name: 'Johnathan Galante', role: 'Special Teams Coordinator' },
  gasparato: { staffId: 'gasparato', name: 'Greg Gasparato', role: 'Linebackers Coach' },
  hardmon: { staffId: 'hardmon', name: 'Bam Hardmon', role: 'Outside Linebackers Coach' },
  harris: { staffId: 'harris', name: 'Brandon Harris', role: 'Cornerbacks Coach' },
  mckissack: { staffId: 'mckissack', name: 'Evan McKissack', role: 'Tight Ends Coach' },
  mcknight: { staffId: 'mcknight', name: 'Trent McKnight', role: 'Passing Game Coordinator / WR' },
  trautwein: { staffId: 'trautwein', name: 'Phil Trautwein', role: 'Offensive Line Coach' },
  whitt: { staffId: 'whitt', name: 'Rusty Whitt', role: 'Director of Football Performance' },
  'katie-turner': { staffId: 'katie-turner', name: 'Katie Turner', role: 'Recruiting Operations' },
  'chris-prescott': { staffId: 'chris-prescott', name: 'Chris Prescott', role: 'Director of Player Personnel' },
  'drew-hughes': { staffId: 'drew-hughes', name: 'Drew Hughes', role: 'Director of High School Personnel' },
  'cody-collins': { staffId: 'cody-collins', name: 'Cody Collins', role: 'Director of High School Recruiting - Offense' },
  'nick-mcdonald': { staffId: 'nick-mcdonald', name: 'Nick McDonald', role: 'Director of High School Recruiting - Defense' },
  'drew-raucina': { staffId: 'drew-raucina', name: 'Drew Raucina', role: 'Director of College Personnel' },
  'joe-hamilton': { staffId: 'joe-hamilton', name: 'Joe Hamilton', role: 'Director of Scouting & Recruiting Relations' },
  'skylar-wise': { staffId: 'skylar-wise', name: 'Skylar Wise', role: 'Director of Recruiting Operations' },
};

const STAFF_ID_ALIASES = {
  prescott: 'chris-prescott',
  'chris prescott': 'chris-prescott',
  hughes: 'drew-hughes',
  'drew hughes': 'drew-hughes',
  'brandon harris': 'harris',
  'brandon-harris': 'harris',
  'phil trautwein': 'trautwein',
  'phil-trautwein': 'trautwein',
  foster: 'foster',
  'chris foster': 'foster',
  'chris-foster': 'foster',
};

function normalizeStaffId(id) {
  if (id == null || id === '') return null;
  const key = String(id).toLowerCase().trim();
  if (STAFF_DIRECTORY[key]) return key;
  if (STAFF_ID_ALIASES[key]) return STAFF_ID_ALIASES[key];
  for (const entry of Object.values(STAFF_DIRECTORY)) {
    if (entry.staffId === key || entry.name.toLowerCase() === key) return entry.staffId;
  }
  return key;
}

function resolveStaffById(id) {
  const normalized = normalizeStaffId(id);
  if (!normalized) return null;
  if (STAFF_DIRECTORY[normalized]) return STAFF_DIRECTORY[normalized];
  for (const entry of Object.values(STAFF_DIRECTORY)) {
    if (entry.staffId === normalized || entry.name.toLowerCase() === normalized) return entry;
  }
  return null;
}

function listStaff() {
  return Object.values(STAFF_DIRECTORY);
}

function isStaffOrCoachName(name) {
  const lower = String(name || '').trim().toLowerCase();
  if (!lower) return false;
  for (const entry of listStaff()) {
    if (entry.name.toLowerCase() === lower) return true;
  }
  try {
    const { getCanonicalCoachNames } = require('./official-coach-identity');
    for (const coach of getCanonicalCoachNames()) {
      if (String(coach).toLowerCase() === lower) return true;
    }
  } catch {
    /* optional */
  }
  return false;
}

/** True when a Beat Desk / intel slug is a UF staff id (brandon-harris, phil-trautwein, …). */
function isStaffPlayerSlug(slug) {
  const key = String(slug || '')
    .trim()
    .toLowerCase()
    .replace(/^@/, '');
  if (!key) return false;
  if (resolveStaffById(key)) return true;
  const spaced = key.replace(/-/g, ' ');
  if (isStaffOrCoachName(spaced)) return true;
  if (STAFF_ID_ALIASES[spaced] || STAFF_ID_ALIASES[key]) return true;
  for (const entry of listStaff()) {
    const nameSlug = String(entry.name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (nameSlug && nameSlug === key) return true;
    if (entry.staffId === key) return true;
  }
  return false;
}

module.exports = {
  STAFF_DIRECTORY,
  normalizeStaffId,
  resolveStaffById,
  listStaff,
  isStaffOrCoachName,
  isStaffPlayerSlug,
};
