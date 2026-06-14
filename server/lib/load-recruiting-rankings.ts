/**
 * Player-level composite + rank index from recruiting store (2027+ targets).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface PlayerRankingEntry {
  compositeScore: number | null;
  nationalRank: number | null;
  positionRank: number | null;
  stateRank: number | null;
  stars: number | null;
  classYear: number | null;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = path.join(__dirname, '../data/recruiting/players.json');

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

  try {
    const players = JSON.parse(fs.readFileSync(PLAYERS_PATH, 'utf8')) as Array<{
      id?: string;
      slug?: string;
      on3Id?: string;
      rating?: number;
      natlRank?: number;
      posRank?: number;
      stateRank?: number;
      stars?: number;
      classYear?: number;
    }>;

    for (const p of players) {
      const entry: PlayerRankingEntry = {
        compositeScore: normalizeComposite(p.rating),
        nationalRank: p.natlRank ?? null,
        positionRank: p.posRank ?? null,
        stateRank: p.stateRank ?? null,
        stars: p.stars ?? null,
        classYear: p.classYear ?? null,
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
