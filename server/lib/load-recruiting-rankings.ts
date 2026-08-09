/**
 * Player-level composite + rank index from recruiting store (2027+ targets).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type RecruitingRatingSource = 'on3' | 'seed';

const PLACEHOLDER_RECRUIT_SCHOOL = 'florida hs pipeline';

function isPlaceholderRecruitSchool(school?: string | null): boolean {
  const s = String(school ?? '').trim().toLowerCase();
  return !s || s === PLACEHOLDER_RECRUIT_SCHOOL || s === 'florida hs pipelines';
}

function resolveSchoolLabel(raw?: string | null): string | null {
  if (isPlaceholderRecruitSchool(raw)) return null;
  const trimmed = String(raw ?? '').trim();
  return trimmed || null;
}

export interface PlayerRankingEntry {
  compositeScore: number | null;
  nationalRank: number | null;
  positionRank: number | null;
  stateRank: number | null;
  stars: number | null;
  classYear: number | null;
  ratingSource: RecruitingRatingSource | null;
  school: string | null;
  inState: boolean;
  position: string | null;
}

export function resolveRatingSource(on3Source: unknown): RecruitingRatingSource {
  const s = String(on3Source ?? '').trim().toLowerCase();
  if (!s) return 'seed';
  if (s.startsWith('http')) return 'on3';
  // Any On3-derived store stamp counts as industry composite (not Vault est.).
  if (s.includes('on3')) return 'on3';
  return 'seed';
}

function editorialPosition(slug: string | undefined, fallback: string | null): string | null {
  if (!slug) return fallback;
  try {
    const { getEditorialPosition } = require('./recruiting-editorial-positions') as {
      getEditorialPosition: (s: string, y?: number) => { pos?: string | null } | null;
    };
    const row = getEditorialPosition(slug, 2028);
    if (row?.pos) return row.pos;
  } catch {
    /* optional */
  }
  return fallback;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE_PLAYERS_PATH = path.join(__dirname, '../data/recruiting/players.json');
const BUNDLE_BOARD_PATH = path.join(__dirname, '../data/recruiting/2028-target-board.json');

function resolvePlayersPath(): string {
  try {
    const { resolveRecruitingDataDir } = require('./recruiting-data-dir') as {
      resolveRecruitingDataDir: () => string;
    };
    const durable = path.join(resolveRecruitingDataDir(), 'players.json');
    if (fs.existsSync(durable)) return durable;
  } catch {
    /* optional */
  }
  return BUNDLE_PLAYERS_PATH;
}

function resolveBoardPath(): string {
  try {
    const { resolveRecruitingDataDir } = require('./recruiting-data-dir') as {
      resolveRecruitingDataDir: () => string;
    };
    const durable = path.join(resolveRecruitingDataDir(), '2028-target-board.json');
    if (fs.existsSync(durable)) return durable;
  } catch {
    /* optional */
  }
  return BUNDLE_BOARD_PATH;
}

interface BoardRow {
  slug?: string;
  school?: string | null;
  state?: string | null;
  inState?: boolean;
  rating?: number | null;
  natlRank?: number | null;
  posRank?: number | null;
  stateRank?: number | null;
  stars?: number | null;
}

function loadEditorialBoardIndex(): Map<string, BoardRow> {
  const index = new Map<string, BoardRow>();
  try {
    const board = JSON.parse(fs.readFileSync(resolveBoardPath(), 'utf8')) as { targets?: BoardRow[] };
    for (const row of board.targets || []) {
      const slug = indexKey(row.slug);
      if (slug) index.set(slug, row);
    }
  } catch {
    /* optional */
  }
  return index;
}

const CACHE_TTL_MS = 60_000;
let cachedIndex: Map<string, PlayerRankingEntry> | null = null;
let cachedAt = 0;

function normalizeComposite(rating: unknown): number | null {
  if (rating == null || !Number.isFinite(Number(rating))) return null;
  const n = Number(rating);
  return n <= 1 ? Math.round(n * 10000) / 100 : Math.round(n * 100) / 100;
}

function indexKey(value: unknown): string | null {
  if (value == null || value === '') return null;
  return String(value).toLowerCase().trim();
}

export function loadRecruitingRankings(): Map<string, PlayerRankingEntry> {
  if (cachedIndex && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedIndex;
  }

  const index = new Map<string, PlayerRankingEntry>();
  const editorial = loadEditorialBoardIndex();

  try {
    const players = JSON.parse(fs.readFileSync(resolvePlayersPath(), 'utf8')) as Array<{
      id?: string;
      slug?: string;
      on3Id?: string;
      pos?: string;
      rating?: number;
      natlRank?: number;
      posRank?: number;
      stateRank?: number;
      stars?: number;
      classYear?: number;
      on3Source?: string | null;
      school?: string | null;
      inState?: boolean;
      state?: string | null;
    }>;

    for (const p of players) {
      const slugKey = indexKey(p.slug);
      const board = slugKey ? editorial.get(slugKey) : undefined;
      const school =
        resolveSchoolLabel(p.school) ??
        resolveSchoolLabel(board?.school) ??
        null;
      const state = String(p.state || board?.state || '').trim().toUpperCase() || null;
      const entry: PlayerRankingEntry = {
        compositeScore: normalizeComposite(p.rating ?? board?.rating),
        nationalRank: p.natlRank ?? board?.natlRank ?? null,
        positionRank: p.posRank ?? board?.posRank ?? null,
        stateRank: p.stateRank ?? board?.stateRank ?? null,
        stars: p.stars ?? board?.stars ?? null,
        classYear: p.classYear ?? null,
        ratingSource:
          resolveRatingSource(p.on3Source) === 'on3' ||
          (board?.natlRank != null && Number(board.natlRank) > 0)
            ? 'on3'
            : 'seed',
        school,
        inState: board?.inState != null ? Boolean(board.inState) : state === 'FL',
        position: editorialPosition(slugKey ?? undefined, p.pos ? String(p.pos).trim().toUpperCase() : null),
      };

      const keys = new Set<string>();
      for (const raw of [p.slug, p.id, p.on3Id]) {
        const k = indexKey(raw);
        if (k) keys.add(k);
      }

      for (const k of keys) {
        index.set(k, entry);
      }
    }
  } catch {
    /* empty index on read failure */
  }

  cachedIndex = index;
  cachedAt = Date.now();
  return index;
}

export function clearRecruitingRankingsCache(): void {
  cachedIndex = null;
  cachedAt = 0;
}
