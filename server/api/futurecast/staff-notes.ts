/**
 * GET /api/futurecast/staff-notes?year=2027 — live staff intel for FutureCast.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Request, Response } from 'express';
import { asyncHandler, handlePredictionsApiError } from '../predictions/utils-api';
import { FUTURECAST_CLASS_YEAR } from './eligibility';
import { sendCachedJson } from './response-cache';
import { enrichFeedPlayers } from './ranking-enrichment';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { ALLOWLIST_2027 } = require('../../lib/recruiting-target-allowlist');
const { filterBlockedRecruits } = require('../../lib/recruiting-blocked-players');
const { resolveCommitmentOverride } = require('../../lib/commitment-prediction-override');
const RECRUITING_PLAYERS_PATH = path.join(__dirname, '../../data/recruiting/players.json');

interface RecruitingMeta {
  classYear: number | null;
  position: string | null;
  school: string | null;
}

interface WarRoomBreakdown {
  playerSlug: string;
  playerName: string;
  playerType?: string;
  projection?: string | null;
  insiderNotes?: string | null;
  staffNotes?: string | null;
  recruitingStory?: string | null;
  comparison?: string | null;
  schemeFit?: string | null;
  analystName?: string | null;
  updatedAt?: string | null;
}

function parseMinYear(raw: unknown): number {
  const n = parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) ? n : FUTURECAST_CLASS_YEAR;
}

function loadRecruitingMetaBySlug(): Map<string, RecruitingMeta> {
  const map = new Map<string, RecruitingMeta>();
  try {
    const raw = fs.readFileSync(RECRUITING_PLAYERS_PATH, 'utf8');
    const players = JSON.parse(raw) as Array<{
      slug?: string;
      classYear?: number;
      pos?: string;
      position?: string;
      school?: string;
      highSchool?: string;
    }>;
    for (const p of players) {
      if (!p.slug) continue;
      const classYear =
        typeof p.classYear === 'number' && Number.isFinite(p.classYear) ? p.classYear : null;
      map.set(p.slug, {
        classYear,
        position: p.pos || p.position || null,
        school: p.school || p.highSchool || null,
      });
    }
  } catch {
    /* optional */
  }
  return map;
}

function inferClassYearFromText(b: WarRoomBreakdown): number | null {
  const text = `${b.recruitingStory ?? ''} ${b.projection ?? ''} ${b.insiderNotes ?? ''}`.toLowerCase();
  const years = [...text.matchAll(/\b20(2[6-9]|3[0-9])\b/g)].map((m) => parseInt(m[0], 10));
  if (!years.length) return null;
  return Math.max(...years);
}

function resolveClassYear(b: WarRoomBreakdown, meta: RecruitingMeta | undefined): number | null {
  if (meta?.classYear != null && meta.classYear >= FUTURECAST_CLASS_YEAR) return meta.classYear;
  if (meta?.classYear === 2026) return 2026;
  const inferred = inferClassYearFromText(b);
  if (inferred != null) return inferred;
  if (meta?.classYear != null) return meta.classYear;
  return null;
}

function isStale2026(classYear: number | null, b: WarRoomBreakdown): boolean {
  if (classYear === 2026) return true;
  const text = `${b.recruitingStory ?? ''} ${b.projection ?? ''}`.toLowerCase();
  return /\b2026\b/.test(text) && !/\b2027\b/.test(text) && !/\b2028\b/.test(text);
}

function hasNoteContent(b: WarRoomBreakdown): boolean {
  return Boolean(
    b.insiderNotes?.trim() ||
      b.staffNotes?.trim() ||
      b.projection?.trim() ||
      b.recruitingStory?.trim()
  );
}

function serializeStaffNote(b: WarRoomBreakdown, metaMap: Map<string, RecruitingMeta>) {
  const meta = metaMap.get(b.playerSlug);
  const classYear = resolveClassYear(b, meta);
  const note =
    b.staffNotes?.trim() ||
    b.insiderNotes?.trim() ||
    b.projection?.trim() ||
    b.recruitingStory?.trim() ||
    '';

  return {
    playerSlug: b.playerSlug,
    playerName: b.playerName,
    position: meta?.position ?? null,
    school: meta?.school ?? null,
    classYear,
    year: classYear,
    playerType: b.playerType ?? 'recruit',
    projection: b.projection ?? null,
    staffNotes: b.staffNotes ?? null,
    insiderNotes: b.insiderNotes ?? null,
    recruitingStory: b.recruitingStory ?? null,
    comparison: b.comparison ?? null,
    schemeFit: b.schemeFit ?? null,
    analystName: b.analystName ?? null,
    notePreview: note.length > 320 ? `${note.slice(0, 320)}…` : note,
    updatedAt: b.updatedAt ?? null,
  };
}

export const handleGetFutureCastStaffNotes = asyncHandler(async (req: Request, res: Response) => {
  try {
    const minYear = parseMinYear(req.query.year ?? req.query.class_year);
    if (minYear < FUTURECAST_CLASS_YEAR) {
      res.status(400).json({ error: `Only ${FUTURECAST_CLASS_YEAR}+ cycle is supported` });
      return;
    }

    const cacheKey = `futurecast:staff-notes:${minYear}`;

    await sendCachedJson(res, cacheKey, async () => {
      const warRoom = require('../../lib/war-room-store');
      const metaMap = loadRecruitingMetaBySlug();
      const all = (warRoom.getAllBreakdowns() as WarRoomBreakdown[]).filter(hasNoteContent);

      let staleFiltered = 0;
      const notes = all
        .map((b) => {
          const entry = serializeStaffNote(b, metaMap);
          return { entry, raw: b };
        })
        .filter(({ entry, raw }) => {
          if (isStale2026(entry.classYear, raw)) {
            staleFiltered += 1;
            return false;
          }
          if (entry.classYear != null && entry.classYear < minYear) {
            staleFiltered += 1;
            return false;
          }
          if (entry.classYear == null) {
            staleFiltered += 1;
            return false;
          }
          if (entry.playerType === 'roster') {
            staleFiltered += 1;
            return false;
          }
          return true;
        })
        .map(({ entry }) => entry)
        .sort((a, b) => String(a.playerName).localeCompare(String(b.playerName)));

      const allowedSet = new Set(ALLOWLIST_2027.map((s: string) => s.toLowerCase()));
      const filteredNotes = filterBlockedRecruits(
        notes.filter((n) => allowedSet.has(String(n.playerSlug || '').toLowerCase()))
      );

      let playerBySlug: Map<
        string,
        {
          fitScore: number | null;
          trendDelta7d: number | null;
          priority: string;
          ufPredictionSuppressed?: boolean;
          commitmentStatus?: string | null;
        }
      > = new Map();
      try {
        const { loadAllowlistedBoardPlayers } = await import('./allowlist-board');
        const boardPlayers = await loadAllowlistedBoardPlayers();
        playerBySlug = new Map(
          boardPlayers.map((p) => [
            p.slug,
            {
              fitScore: p.fitScore,
              trendDelta7d: p.trendDelta7d,
              priority: p.priority,
              ufPredictionSuppressed: p.ufPredictionSuppressed,
              commitmentStatus: p.commitmentStatus,
            },
          ])
        );
      } catch {
        /* optional */
      }

      const enrichedNotes = filteredNotes.map((note) => {
        const board = playerBySlug.get(String(note.playerSlug || '').toLowerCase());
        const override = resolveCommitmentOverride({
          slug: note.playerSlug,
          insiderNotes: note.insiderNotes,
          staffNotes: note.staffNotes,
          recruitingStory: note.recruitingStory,
        });
        if (board?.ufPredictionSuppressed || override) {
          const status =
            board?.commitmentStatus ||
            override?.commitmentStatus ||
            'Committed elsewhere — UF prediction suppressed';
          return {
            ...note,
            fitScore: null,
            trendDelta7d: null,
            priority: 'low',
            ufPredictionSuppressed: true,
            commitmentStatus: status,
            notePreview: status,
          };
        }
        return board
          ? { ...note, fitScore: board.fitScore, trendDelta7d: board.trendDelta7d, priority: board.priority }
          : note;
      });

      const updatedAt =
        enrichedNotes
          .map((n) => n.updatedAt)
          .filter(Boolean)
          .sort()
          .reverse()[0] ?? new Date().toISOString();

      return {
        classYear: minYear,
        updatedAt,
        count: enrichedNotes.length,
        totalNotes: enrichedNotes.length,
        staleFiltered,
        notes: enrichFeedPlayers(enrichedNotes),
      };
    });
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});
