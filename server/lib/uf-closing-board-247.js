/**
 * 247Sports Florida targets page sync for Closing Class (2027).
 * Used to discover / force elsewhere-commits and UF commits — NOT to dump the
 * offer list onto the hunt board. Board membership is Charles allowlist only.
 */
const fs = require('fs');
const path = require('path');
const { slugify } = require('./slug');
const { isFloridaSchool, isActiveUfTarget } = require('./recruiting-target-filters');

const BOARD_SOURCE = '247-uf-board-sync';
const DEFAULT_CLASS_YEAR = 2027;
const DEFAULT_URL =
  process.env.UF_CLOSING_BOARD_247_URL ||
  'https://247sports.com/college/florida/Season/2027-Football/Targets/';
const SNAPSHOT_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'uf-closing-board-247-2027.json');

/**
 * Beat/owner corrections when 247's open UF target list lags an elsewhere-commit.
 * These always win over a stale open-list row during Closing Class sync.
 * Keep this list current — offer-list lag is how dead names embarrass the brand.
 */
const FORCED_ELSEWHERE_COMMITS = [
  {
    slug: 'adryan-cole',
    name: 'Adryan Cole',
    pos: 'S',
    school: 'Buford (Buford, GA)',
    classYear: 2027,
    committedTo: 'Georgia',
    status: 'committed',
  },
  {
    slug: 'andre-hyppolite',
    name: 'Andre Hyppolite',
    pos: 'S',
    school: 'North Miami Beach (Miami, FL)',
    classYear: 2027,
    committedTo: 'Miami',
    status: 'committed',
  },
  {
    slug: 'jaylyn-jones',
    name: 'Jaylyn Jones',
    pos: 'S',
    school: 'McArthur (Hollywood, FL)',
    classYear: 2027,
    committedTo: 'Miami',
    status: 'committed',
  },
  {
    slug: 'ace-alston',
    name: 'Ace Alston',
    pos: 'CB',
    school: 'Anderson (Cincinnati, OH)',
    classYear: 2027,
    committedTo: 'Notre Dame',
    status: 'committed',
  },
  {
    slug: 'monshun-sales',
    name: 'Monshun Sales',
    pos: 'WR',
    school: 'Lawrence North (Indianapolis, IN)',
    classYear: 2027,
    committedTo: 'Indiana',
    status: 'committed',
  },
  {
    slug: 'tashawn-poole',
    name: "Ta'Shawn Poole",
    pos: 'S',
    school: 'Howard (Macon, GA)',
    classYear: 2027,
    committedTo: 'Florida State',
    status: 'committed',
  },
  {
    slug: 'easton-royal',
    name: 'Easton Royal',
    pos: 'WR',
    school: 'IMG Academy (Bradenton, FL)',
    classYear: 2027,
    committedTo: 'Texas',
    status: 'committed',
  },
  {
    slug: 'keldrid-ben',
    name: 'Keldrid Ben',
    pos: 'ATH',
    school: 'IMG Academy (Bradenton, FL)',
    classYear: 2027,
    committedTo: 'Oklahoma',
    status: 'committed',
  },
  {
    slug: 'angelo-smith',
    name: 'Angelo Smith',
    pos: 'ATH',
    school: 'IMG Academy (Bradenton, FL)',
    classYear: 2027,
    committedTo: 'Ohio State',
    status: 'committed',
  },
  {
    slug: 'avrian-pauley',
    name: 'Avrian Pauley',
    pos: 'ATH',
    school: 'IMG Academy (Bradenton, FL)',
    classYear: 2027,
    committedTo: 'Alabama',
    status: 'committed',
  },
  {
    slug: 'max-brown',
    name: 'Max Brown',
    pos: 'ATH',
    school: 'IMG Academy (Bradenton, FL)',
    classYear: 2027,
    committedTo: 'Clemson',
    status: 'committed',
  },
];

function loadSnapshotCommittedElsewhere() {
  try {
    const snap = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
    return (snap.committed || []).filter(
      (row) => row?.slug && row.committedTo && !isFloridaSchool(row.committedTo)
    );
  } catch {
    return [];
  }
}

function mergeCommittedElsewhere(board) {
  const bySlug = new Map();
  for (const row of [...(board.committed || []), ...loadSnapshotCommittedElsewhere(), ...FORCED_ELSEWHERE_COMMITS]) {
    if (!row?.slug || !row.committedTo || isFloridaSchool(row.committedTo)) continue;
    bySlug.set(String(row.slug).toLowerCase(), row);
  }
  const forcedSlugs = new Set(bySlug.keys());
  const open = (board.open || []).filter((row) => !forcedSlugs.has(String(row.slug || '').toLowerCase()));
  return {
    ...board,
    open,
    committed: [...bySlug.values()],
  };
}

function defaultHeaders() {
  return {
    Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent':
      process.env.ON3_USER_AGENT ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    Referer: 'https://247sports.com/college/florida/',
  };
}

function parsePlayerId(href) {
  const m = String(href || '').match(/\/Player\/[^/]*?-(\d+)\/?/i);
  return m ? m[1] : null;
}

function parseStars(rowHtml) {
  return (String(rowHtml).match(/icon-starsolid yellow/g) || []).length || null;
}

function parseScore(rowHtml) {
  const m = String(rowHtml).match(/class="score">\s*([0-9.]+)\s*</);
  return m ? Number(m[1]) : null;
}

function parseRanks(rowHtml) {
  const natl = (String(rowHtml).match(/class="natrank"[^>]*>\s*(\d+)/) || [])[1];
  const pos = (String(rowHtml).match(/class="posrank"[^>]*>\s*(\d+)/) || [])[1];
  const state = (String(rowHtml).match(/class="sttrank"[^>]*>\s*(\d+)/) || [])[1];
  return {
    natlRank: natl ? Number(natl) : null,
    posRank: pos ? Number(pos) : null,
    stateRank: state ? Number(state) : null,
  };
}

function isCommittedRow(rowHtml) {
  const status = (String(rowHtml).match(/<div class="status">[\s\S]*?<\/div>/) || [])[0] || '';
  if (!status) return false;
  const alt = (status.match(/alt="([^"]+)"/) || [])[1] || '';
  return Boolean(alt.trim());
}

function commitSchoolFromRow(rowHtml) {
  const status = (String(rowHtml).match(/<div class="status">[\s\S]*?<\/div>/) || [])[0] || '';
  return ((status.match(/alt="([^"]+)"/) || [])[1] || '').trim() || null;
}

function parseFloridaProspectsHtml(html, classYear = DEFAULT_CLASS_YEAR) {
  const rows = String(html).match(/<li class="ri-page__list-item[\s\S]*?<\/li>/gi) || [];
  const open = [];
  const committed = [];

  for (const row of rows) {
    const name = ((row.match(/ri-page__name-link[^>]*>([^<]+)</) || [])[1] || '').trim();
    if (!name) continue;
    const href = ((row.match(/ri-page__name-link[^>]*href="([^"]+)"/) || [])[1] || '').trim();
    const school = ((row.match(/class="meta">\s*([^<]+)/) || [])[1] || '').trim();
    const pos = ((row.match(/<div class="position">\s*([^<]+)/) || [])[1] || 'ATH').trim().toUpperCase();
    const htWt = ((row.match(/<div class="metrics">\s*([^<]+)/) || [])[1] || '').trim();
    const stars = parseStars(row);
    const rating = parseScore(row);
    const ranks = parseRanks(row);
    const recruit247Id = parsePlayerId(href);
    const slug = slugify(name);
    const profileUrl = href ? (href.startsWith('http') ? href : `https:${href}`) : null;
    const base = {
      slug,
      name,
      pos,
      school: school || null,
      htWt: htWt || null,
      stars,
      rating,
      ...ranks,
      classYear,
      recruit247Id,
      profileUrl,
      inState: /,\s*FL\b|\(FL\)/i.test(school),
    };

    if (isCommittedRow(row)) {
      committed.push({ ...base, committedTo: commitSchoolFromRow(row), status: 'committed' });
    } else {
      open.push({ ...base, committedTo: null, status: 'uncommitted' });
    }
  }

  return { open, committed, fetchedAt: new Date().toISOString(), sourceUrl: DEFAULT_URL };
}

async function fetchFloridaClosingBoardHtml(url = DEFAULT_URL) {
  const { fetchText } = require('./qa/qa-utils');
  const { text } = await fetchText(url, {
    headers: defaultHeaders(),
    retries: 3,
    timeout: parseInt(process.env.UF_CLOSING_BOARD_TIMEOUT_MS || '45000', 10) || 45000,
  });
  return text;
}

async function fetchFloridaClosingBoard(classYear = DEFAULT_CLASS_YEAR) {
  const html = await fetchFloridaClosingBoardHtml();
  return parseFloridaProspectsHtml(html, classYear);
}

function isLiveUfBoardTarget(player) {
  if (!player) return false;
  return (
    player.boardSource === BOARD_SOURCE ||
    String(player.on3Source || player.source || '').includes(BOARD_SOURCE)
  );
}

async function syncFloridaClosingBoardToStore(options = {}) {
  const store = require('./recruiting-store');
  const {
    getAllowlistSet,
    isFlipWatchAllowlisted,
    canonicalTargetSlug,
  } = require('./recruiting-target-allowlist');
  const classYear = Number(options.classYear) || DEFAULT_CLASS_YEAR;
  const huntSet = getAllowlistSet(classYear);
  const rawBoard = options.board || (await fetchFloridaClosingBoard(classYear));
  // Merge forced/snapshot elsewhere-commits so stale 247 open rows cannot revive them.
  const board = mergeCommittedElsewhere(rawBoard);
  const open = board.open || [];

  try {
    fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
    fs.writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(board, null, 2)}\n`);
  } catch (_) {}

  let upserted = 0;
  let skippedCommit = 0;
  let skippedOfferList = 0;
  let demoted = 0;

  // Committed-elsewhere rows from the 247 page (and forced snapshot corrections).
  // Never re-open these as uncommitted targets even if 247's open list is stale.
  const committedElsewhereBySlug = new Map();
  for (const row of board.committed || []) {
    if (!row?.slug || !row.committedTo || isFloridaSchool(row.committedTo)) continue;
    committedElsewhereBySlug.set(String(row.slug).toLowerCase(), row);
  }

  for (const row of open) {
    const slug = canonicalTargetSlug(row.slug || slugify(row.name));
    const existing = await store.getPlayerBySlug(row.slug);
    if (committedElsewhereBySlug.has(slug)) {
      skippedCommit += 1;
      continue;
    }
    if (existing?.verifiedCommit && existing.committedTo && !isFloridaSchool(existing.committedTo)) {
      skippedCommit += 1;
      continue;
    }
    if (existing && !isActiveUfTarget(existing) && !isFlipWatchAllowlisted(slug, classYear)) {
      skippedCommit += 1;
      continue;
    }
    if (existing && isFloridaSchool(existing.committedTo)) {
      skippedCommit += 1;
      continue;
    }

    // Brand rule: 247 open list ≠ hunt board. Only Charles allowlist / flip watch.
    if (!huntSet.has(slug)) {
      if (existing?.category === 'target') {
        await store.upsertPlayer({
          ...existing,
          category: 'recruit',
          status:
            existing.committedTo || existing.status === 'committed'
              ? existing.status || 'committed'
              : 'uncommitted',
          boardSource: existing.boardSource || BOARD_SOURCE,
          updatedAt: new Date().toISOString(),
          profileNote:
            existing.profileNote ||
            `${row.name} is on Florida's 247 offer list but is not a curated UF hunt target.`,
        });
        demoted += 1;
      } else {
        skippedOfferList += 1;
      }
      continue;
    }

    const flipWatch = isFlipWatchAllowlisted(slug, classYear);
    const patch = {
      ...(existing || {}),
      id: existing?.id || row.slug,
      slug: row.slug,
      name: row.name,
      pos: row.pos || existing?.pos || 'ATH',
      classYear,
      school: row.school || existing?.school || null,
      htWt: row.htWt || existing?.htWt || null,
      stars: row.stars || existing?.stars || null,
      rating: row.rating || existing?.rating || null,
      natlRank: row.natlRank ?? existing?.natlRank ?? null,
      posRank: row.posRank ?? existing?.posRank ?? null,
      stateRank: row.stateRank ?? existing?.stateRank ?? null,
      inState: row.inState ?? existing?.inState ?? false,
      category: 'target',
      status: flipWatch && existing?.committedTo ? existing.status || 'committed' : 'uncommitted',
      committedTo: flipWatch ? existing?.committedTo || null : null,
      flipWatch: flipWatch || existing?.flipWatch || false,
      recruit247Id: row.recruit247Id || existing?.recruit247Id || null,
      boardSource: BOARD_SOURCE,
      on3Source: BOARD_SOURCE,
      profileNote:
        existing?.profileNote ||
        `${row.name} is a curated Florida ${classYear} hunt target.`,
      updatedAt: new Date().toISOString(),
    };

    await store.upsertPlayer(patch);
    upserted += 1;
  }

  // Apply committed-elsewhere from 247 page (incl. Charles allowlist rows still marked open).
  let markedCommitted = 0;
  for (const row of committedElsewhereBySlug.values()) {
    if (!row?.slug || !row.committedTo || isFloridaSchool(row.committedTo)) continue;
    const slug = canonicalTargetSlug(row.slug);
    const flipWatch = isFlipWatchAllowlisted(slug, classYear);
    const existing = await store.getPlayerBySlug(row.slug);
    const basePatch = {
      id: existing?.id || row.slug,
      slug: row.slug,
      name: row.name || existing?.name,
      pos: row.pos || existing?.pos || 'ATH',
      classYear,
      school: row.school || existing?.school || null,
      htWt: row.htWt || existing?.htWt || null,
      stars: row.stars || existing?.stars || null,
      rating: row.rating || existing?.rating || null,
      natlRank: row.natlRank ?? existing?.natlRank ?? null,
      posRank: row.posRank ?? existing?.posRank ?? null,
      stateRank: row.stateRank ?? existing?.stateRank ?? null,
      inState: row.inState ?? existing?.inState ?? false,
      committedTo: row.committedTo,
      status: 'committed',
      verifiedCommit: true,
      flipWatch,
      boardSource: existing?.boardSource || BOARD_SOURCE,
      updatedAt: new Date().toISOString(),
    };

    if (!existing) {
      await store.upsertPlayer({
        ...basePatch,
        category: flipWatch ? 'target' : 'recruit',
        profileNote: flipWatch
          ? `${row.name || row.slug} committed to ${row.committedTo}. Kept on UF flip radar.`
          : `${row.name || row.slug} committed to ${row.committedTo}. Removed from UF target board.`,
      });
      markedCommitted += 1;
      continue;
    }
    if (Number(existing.classYear) !== classYear) continue;
    const already =
      String(existing.committedTo || '').toLowerCase() === String(row.committedTo).toLowerCase() &&
      existing.verifiedCommit &&
      (flipWatch ? existing.category === 'target' && existing.flipWatch : existing.category !== 'target');
    if (already) continue;
    await store.upsertPlayer({
      ...existing,
      ...basePatch,
      category: flipWatch ? 'target' : 'recruit',
      profileNote: flipWatch
        ? `${row.name || existing.name} committed to ${row.committedTo}. Kept on UF flip radar.`
        : `${row.name || existing.name} committed to ${row.committedTo}. Removed from UF target board.`,
    });
    markedCommitted += 1;
  }

  // Scrub any leftover offer-list targets that are not on the hunt allowlist.
  const all = await store.getAllPlayers();
  for (const p of all) {
    if (Number(p.classYear) !== classYear) continue;
    if (p.category !== 'target') continue;
    const slug = canonicalTargetSlug(p.slug || slugify(p.name));
    if (huntSet.has(slug)) continue;

    await store.upsertPlayer({
      ...p,
      category: 'recruit',
      status: p.committedTo || p.status === 'committed' ? p.status || 'committed' : 'uncommitted',
      updatedAt: new Date().toISOString(),
    });
    demoted += 1;
  }

  return {
    ok: true,
    classYear,
    openCount: open.length,
    committedOnPage: (board.committed || []).length,
    upserted,
    skippedCommit,
    skippedOfferList,
    markedCommitted,
    demoted,
    fetchedAt: board.fetchedAt,
    sourceUrl: board.sourceUrl || DEFAULT_URL,
  };
}

module.exports = {
  BOARD_SOURCE,
  DEFAULT_CLASS_YEAR,
  DEFAULT_URL,
  SNAPSHOT_PATH,
  FORCED_ELSEWHERE_COMMITS,
  parseFloridaProspectsHtml,
  fetchFloridaClosingBoard,
  syncFloridaClosingBoardToStore,
  isLiveUfBoardTarget,
  mergeCommittedElsewhere,
};
