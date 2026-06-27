#!/usr/bin/env node
/** One-shot patch: extend visit-intel-utils for board snapshot + recap + source labels. */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'lib', 'visit-intel-utils.js');
let src = fs.readFileSync(filePath, 'utf8');

if (src.includes('getVisitIntelBoardSnapshot')) {
  console.log('[patch] already applied');
  process.exit(0);
}

const insert = `
function formatVisitSourceLabel(source) {
  const src = String(source || '').toLowerCase();
  if (src === 'on3') return 'On3';
  if (src === 'manual') return 'Manual';
  if (src === 'rivals_pm') return 'Rivals';
  if (/beat/.test(src)) return 'Beat verified';
  return source ? String(source) : 'Verified';
}

function dedupeVisitWindowKey(entry, window) {
  return \`\${String(entry.playerSlug || '').toLowerCase()}|\${window.visitStart}\`;
}

function countVerifiedUpcomingVisits(visitLogs, asOf = new Date()) {
  const today = todayYmd(asOf);
  const seen = new Set();
  let count = 0;
  for (const entry of visitLogs || []) {
    const window = getVerifiedFloridaVisitWindow(entry);
    if (!window) continue;
    const key = dedupeVisitWindowKey(entry, window);
    if (seen.has(key)) continue;
    if (window.visitEnd >= today || window.visitStart >= today) {
      seen.add(key);
      count += 1;
    }
  }
  return count;
}

function countVerifiedCompletedVisits(visitLogs, asOf = new Date()) {
  const today = todayYmd(asOf);
  const seen = new Set();
  let count = 0;
  for (const entry of visitLogs || []) {
    const window = getVerifiedFloridaVisitWindow(entry);
    if (!window) continue;
    const key = dedupeVisitWindowKey(entry, window);
    if (seen.has(key)) continue;
    if (window.visitEnd < today) {
      seen.add(key);
      count += 1;
    }
  }
  return count;
}

function buildVerifiedVisitRecapRows(players, visitLogs, asOf = new Date(), { limit = 8, classYear = 2027 } = {}) {
  const recap = listRecentVerifiedFloridaOfficialVisits(visitLogs, { classYear, limit: limit * 2, asOf }).filter(
    (row) => row.completed
  );
  const playerBySlug = new Map((players || []).map((p) => [String(p.slug || '').toLowerCase(), p]));

  return recap.slice(0, limit).map((row) => {
    const player = playerBySlug.get(String(row.slug || '').toLowerCase());
    return {
      slug: row.slug,
      name: row.name || player?.name || row.slug,
      visitStart: row.visitStart,
      visitEnd: row.visitEnd,
      visitSource: row.source,
      visitSourceLabel: formatVisitSourceLabel(row.source),
      ufProbability: player?.ufProbability ?? null,
    };
  });
}

function getVisitIntelBoardSnapshot(visitLogs, asOf = new Date()) {
  return {
    upcomingCount: countVerifiedUpcomingVisits(visitLogs, asOf),
    recapCount: countVerifiedCompletedVisits(visitLogs, asOf),
  };
}
`;

src = src.replace(
  'module.exports = {',
  `${insert}\nmodule.exports = {`
);

src = src.replace(
  '  listRecentVerifiedFloridaOfficialVisits,\n};',
  `  listRecentVerifiedFloridaOfficialVisits,
  formatVisitSourceLabel,
  countVerifiedUpcomingVisits,
  countVerifiedCompletedVisits,
  buildVerifiedVisitRecapRows,
  getVisitIntelBoardSnapshot,
};`
);

src = src.replace(
  '    visitSource: verified.source,\n  };',
  `    visitSource: verified.source,
    visitSourceLabel: formatVisitSourceLabel(verified.source),
  };`
);

src = src.replace(
  '      visitSource: null,\n    };',
  `      visitSource: null,
      visitSourceLabel: null,
    };`
);

fs.writeFileSync(filePath, src, { encoding: 'utf8' });
console.log('[patch] visit-intel-utils extended');
