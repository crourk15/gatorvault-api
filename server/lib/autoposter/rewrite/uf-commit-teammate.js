/**
 * Resolve a named UF commit teammate when beat text cites one and roster data confirms same HS.
 */
const fs = require('fs');
const path = require('path');

let rosterCache = null;

function loadRosterSync() {
  if (rosterCache) return rosterCache;
  try {
    const file = path.join(__dirname, '../../../data/recruiting/players.json');
    rosterCache = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    rosterCache = [];
  }
  return rosterCache;
}

function clearRosterCacheForTests() {
  rosterCache = null;
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function parseSchoolLabel(raw) {
  const full = String(raw || '').trim();
  if (!full) return { hs: null, loc: null, full: '' };
  const paren = full.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (paren) {
    return { hs: paren[1].trim(), loc: paren[2].trim(), full };
  }
  if (/^[A-Za-z .'-]+,\s*[A-Z]{2}$/.test(full)) {
    return { hs: null, loc: full, full };
  }
  return { hs: full, loc: null, full };
}

function hsNameKey(hs) {
  return normalizeKey(hs);
}

function schoolsAreTeammates(subjectSchool, candidateSchool) {
  if (!subjectSchool || !candidateSchool) return false;
  const a = parseSchoolLabel(subjectSchool);
  const b = parseSchoolLabel(candidateSchool);
  if (normalizeKey(a.full) === normalizeKey(b.full)) return true;
  if (a.hs && b.hs && hsNameKey(a.hs) === hsNameKey(b.hs)) return true;
  if (a.hs && b.loc && normalizeKey(a.loc) === normalizeKey(b.loc)) return true;
  if (b.hs && a.loc && normalizeKey(a.loc) === normalizeKey(b.loc)) return true;
  if (a.loc && b.loc && normalizeKey(a.loc) === normalizeKey(b.loc) && (a.hs || b.hs)) return true;
  if (a.hs && normalizeKey(b.full).includes(hsNameKey(a.hs))) return true;
  if (b.hs && normalizeKey(a.full).includes(hsNameKey(b.hs))) return true;
  return false;
}

function isUfCommit(player) {
  if (!player) return false;
  const status = String(player.status || '').toLowerCase();
  const committedTo = String(player.committedTo || player.committed_to || '').trim();
  return (
    ['committed', 'commit', 'signed', 'enrolled'].includes(status) && /^florida$/i.test(committedTo)
  );
}

function subjectSchoolFromContext({ playerRow, player, intel } = {}) {
  return (
    playerRow?.school ||
    playerRow?.fromSchool ||
    playerRow?.highSchool ||
    player?.school ||
    player?.highSchool ||
    intel?.school ||
    intel?.highSchool ||
    null
  );
}

function beatHasUfCommitTeammateSignal(beatText = '') {
  return /\bteammates with a current florida commit\b/i.test(String(beatText || ''));
}

function subjectClassYear({ playerRow, player } = {}) {
  const cy = playerRow?.classYear ?? player?.classYear;
  const n = Number(cy);
  return Number.isFinite(n) ? n : null;
}

function candidateSchoolFields(player) {
  return [player?.school, player?.fromSchool, player?.skinny, player?.profileNote].filter(Boolean);
}

function candidateMatchesSubjectHs(subjectHs, candidate) {
  if (!subjectHs) return false;
  const key = hsNameKey(subjectHs);
  return candidateSchoolFields(candidate).some((field) => normalizeKey(field).includes(key));
}

/**
 * @returns {{ name: string, slug: string } | null}
 */
function resolveUfCommitTeammate({ slug, playerRow, player, beatText, roster, intel } = {}) {
  if (!beatHasUfCommitTeammateSignal(beatText)) return null;

  const subjectSlug = normalizeKey(slug);
  const subjectSchool = subjectSchoolFromContext({ playerRow, player, intel });
  if (!subjectSchool) return null;

  const players = Array.isArray(roster) ? roster : loadRosterSync();
  const candidates = players.filter((p) => {
    if (!p?.slug) return false;
    if (normalizeKey(p.slug) === subjectSlug) return false;
    if (!isUfCommit(p)) return false;
    return schoolsAreTeammates(subjectSchool, p.school || p.fromSchool);
  });

  if (candidates.length === 1) {
    return { name: candidates[0].name, slug: candidates[0].slug };
  }

  if (candidates.length > 1) {
    const subj = parseSchoolLabel(subjectSchool);
    const exact = candidates.filter((c) => candidateMatchesSubjectHs(subj.hs, c));
    if (exact.length === 1) {
      return { name: exact[0].name, slug: exact[0].slug };
    }

    const classYear = subjectClassYear({ playerRow, player });
    if (classYear != null) {
      const adjacent = candidates.filter((c) => {
        const cy = Number(c.classYear);
        return Number.isFinite(cy) && Math.abs(cy - classYear) <= 1;
      });
      if (adjacent.length === 1) {
        return { name: adjacent[0].name, slug: adjacent[0].slug };
      }
    }
  }

  return null;
}

module.exports = {
  beatHasUfCommitTeammateSignal,
  clearRosterCacheForTests,
  isUfCommit,
  loadRosterSync,
  parseSchoolLabel,
  resolveUfCommitTeammate,
  schoolsAreTeammates,
  subjectSchoolFromContext
};
