/**
 * Live Florida remaining board for Closing Class (2027).
 * Source: 247Sports Florida season prospects page — uncommitted rows only.
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
  const classYear = Number(options.classYear) || DEFAULT_CLASS_YEAR;
  const board = options.board || (await fetchFloridaClosingBoard(classYear));
  const open = board.open || [];
  const openSlugs = new Set(open.map((p) => p.slug));

  try {
    fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
    fs.writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(board, null, 2)}\n`);
  } catch (_) {}

  let upserted = 0;
  let skippedCommit = 0;
  let demoted = 0;

  // Committed-elsewhere rows from the 247 page (and forced snapshot corrections).
  // Never re-open these as uncommitted targets even if 247's open list is stale.
  const committedElsewhereBySlug = new Map();
  for (const row of board.committed || []) {
    if (!row?.slug || !row.committedTo || isFloridaSchool(row.committedTo)) continue;
    committedElsewhereBySlug.set(String(row.slug).toLowerCase(), row);
  }

  for (const row of open) {
    const slug = String(row.slug || '').toLowerCase();
    const existing = await store.getPlayerBySlug(row.slug);
    if (committedElsewhereBySlug.has(slug)) {
      skippedCommit += 1;
      continue;
    }
    if (existing?.verifiedCommit && existing.committedTo && !isFloridaSchool(existing.committedTo)) {
      skippedCommit += 1;
      continue;
    }
    if (existing && !isActiveUfTarget(existing)) {
      skippedCommit += 1;
      continue;
    }
    if (existing && isFloridaSchool(existing.committedTo)) {
      skippedCommit += 1;
      continue;
    }

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
      status: 'uncommitted',
      committedTo: null,
      recruit247Id: row.recruit247Id || existing?.recruit247Id || null,
      boardSource: BOARD_SOURCE,
      on3Source: BOARD_SOURCE,
      profileNote:
        existing?.profileNote ||
        `${row.name} remains on Florida's 247Sports ${classYear} board.`,
      updatedAt: new Date().toISOString(),
    };

    await store.upsertPlayer(patch);
    upserted += 1;
  }

  // Apply committed-elsewhere from 247 page (incl. Charles allowlist rows still marked open).
  let markedCommitted = 0;
  for (const row of committedElsewhereBySlug.values()) {
    if (!row?.slug || !row.committedTo || isFloridaSchool(row.committedTo)) continue;
    const existing = await store.getPlayerBySlug(row.slug);
    if (!existing) {
      // Ensure dead targets exist in-store so board/feed filters can see the commit.
      await store.upsertPlayer({
        id: row.slug,
        slug: row.slug,
        name: row.name,
        pos: row.pos || 'ATH',
        classYear,
        school: row.school || null,
        htWt: row.htWt || null,
        stars: row.stars || null,
        rating: row.rating || null,
        natlRank: row.natlRank ?? null,
        posRank: row.posRank ?? null,
        stateRank: row.stateRank ?? null,
        inState: row.inState ?? false,
        committedTo: row.committedTo,
        category: 'recruit',
        status: 'committed',
        verifiedCommit: true,
        boardSource: BOARD_SOURCE,
        profileNote: `${row.name || row.slug} committed to ${row.committedTo}. Removed from UF target board.`,
        updatedAt: new Date().toISOString(),
      });
      markedCommitted += 1;
      continue;
    }
    if (Number(existing.classYear) !== classYear) continue;
    const already =
      String(existing.committedTo || '').toLowerCase() === String(row.committedTo).toLowerCase() &&
      existing.category !== 'target' &&
      existing.verifiedCommit;
    if (already) continue;
    await store.upsertPlayer({
      ...existing,
      committedTo: row.committedTo,
      category: 'recruit',
      status: 'committed',
      verifiedCommit: true,
      updatedAt: new Date().toISOString(),
      profileNote:
        `${row.name || existing.name} committed to ${row.committedTo}. Removed from UF target board.`,
    });
    markedCommitted += 1;
  }

  const all = await store.getAllPlayers();
  for (const p of all) {
    if (Number(p.classYear) !== classYear) continue;
    if (!isLiveUfBoardTarget(p)) continue;
    if (p.category !== 'target') continue;
    if (openSlugs.has(p.slug) && isActiveUfTarget(p)) continue;

    await store.upsertPlayer({
      ...p,
      category: 'recruit',
      status: p.committedTo || p.status === 'committed' ? p.status || 'committed' : 'uncommitted',
      boardSource: BOARD_SOURCE,
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
  parseFloridaProspectsHtml,
  fetchFloridaClosingBoard,
  syncFloridaClosingBoardToStore,
  isLiveUfBoardTarget,
};
