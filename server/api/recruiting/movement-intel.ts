/**
 * GET /api/recruiting/movement-intel — UF% deltas + intel.json events.
 */
import { createRequire } from 'node:module';
import type { Request, Response } from 'express';
import {
  listRollingMovement,
  MOVEMENT_VOLATILITY_THRESHOLD,
  ROLLING_MOVEMENT_WINDOW_DAYS,
} from '../../models/predictions';
import { listCompetingVolatilityBoosts } from '../../models/competing-school-history';
import { asyncHandler, handlePredictionsApiError } from '../predictions/utils-api';
import { isFutureCastDataError, respondDatabaseUnavailable } from '../futurecast/db-fallback';
import { MOVEMENT_INTEL_MIN_CLASS_YEAR } from '../futurecast/eligibility';
import { filterMovementIntelRollingRows } from '../futurecast/feed-filters';
import { clearFuturecastCache } from '../futurecast/response-cache';

const require = createRequire(import.meta.url);
const { filterMovementRowsToLiveTargetsMulti } = require('../../lib/live-board-targets');

function isFloridaSchool(value: string | null | undefined): boolean {
  if (!value) return false;
  return /\bflorida\b|\bgators\b/i.test(String(value));
}

const MOVEMENT_FILTERS = {
  lifecycle: 'HS' as const,
  min_class_year: MOVEMENT_INTEL_MIN_CLASS_YEAR,
};

type MovementType = 'RISE' | 'FALL' | 'VOLATILE';

type IntelRow = Record<string, unknown>;

export type MovementIntelItem = {
  id: string;
  slug?: string;
  name: string;
  position: string;
  school: string;
  ufProb: number;
  delta: number;
  movementType: MovementType;
  lastUpdate: string;
  tags: string[];
};

export type MovementIntelAlert = {
  id: string;
  type: 'VISIT' | 'OFFER' | 'STAFF_NOTE' | 'PREDICTION_SHIFT';
  player: string;
  detail: string;
  timestamp: string;
};

function toPct(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0;
  if (value > 0 && value <= 1) return Math.round(value * 100);
  return Math.round(value);
}

function toDelta(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0;
  if (Math.abs(value) > 0 && Math.abs(value) <= 1) return Math.round(value * 100);
  return Math.round(value);
}

function classifyMovement(
  delta: number,
  volatilityScore: number,
  intelEvents: IntelRow[]
): MovementType | null {
  if (delta >= 5) return 'RISE';
  if (delta <= -5) return 'FALL';
  if (volatilityScore >= MOVEMENT_VOLATILITY_THRESHOLD || intelEvents.length > 0) return 'VOLATILE';
  return null;
}

function intelTag(eventType: string): string | null {
  const et = eventType.toLowerCase();
  if (/visit/.test(et)) return 'visit';
  if (et === 'offer') return 'offer';
  if (/staff|note/.test(et)) return 'staff-note';
  if (/prediction|rivals|compet/.test(et)) return 'prediction';
  return null;
}

function alertType(eventType: string): MovementIntelAlert['type'] | null {
  const et = eventType.toLowerCase();
  if (/visit/.test(et)) return 'VISIT';
  if (et === 'offer') return 'OFFER';
  if (/staff/.test(et) || et === 'note') return 'STAFF_NOTE';
  if (/prediction|rivals|compet/.test(et)) return 'PREDICTION_SHIFT';
  return null;
}

function playerKeys(row: IntelRow): string[] {
  const keys: string[] = [];
  const slug = String(row.playerSlug || row.player_slug || '').toLowerCase();
  const id = String(row.playerId || row.player_id || '').toLowerCase();
  if (slug) keys.push(slug);
  if (id) keys.push(id);
  return keys;
}

function groupIntelByPlayer(intel: IntelRow[]): Map<string, IntelRow[]> {
  const map = new Map<string, IntelRow[]>();
  for (const row of intel) {
    for (const key of playerKeys(row)) {
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
  }
  return map;
}

function intelEventsForPlayer(
  map: Map<string, IntelRow[]>,
  slug: string,
  playerId: string
): IntelRow[] {
  return map.get(slug.toLowerCase()) ?? map.get(playerId.toLowerCase()) ?? [];
}

function mapTags(events: IntelRow[]): string[] {
  const tags = new Set<string>();
  for (const row of events) {
    const eventType = String(row.eventType || row.event_type || '');
    const tag = intelTag(eventType);
    if (tag) tags.add(tag);
  }
  return [...tags];
}

function buildAlerts(intel: IntelRow[], limit: number): MovementIntelAlert[] {
  const alerts: MovementIntelAlert[] = [];

  for (const row of intel) {
    const eventType = String(row.eventType || row.event_type || '').toLowerCase();
    if (!eventType || /article|podcast|film|content|community/i.test(eventType)) continue;

    const type = alertType(eventType);
    if (!type) continue;

    alerts.push({
      id: String(row.id || row.fingerprint || `alert_${alerts.length}`),
      type,
      player: String(row.playerName || row.player_name || row.playerSlug || 'Recruit'),
      detail: String(row.text || row.detail || 'New recruiting intel'),
      timestamp: String(row.reportedAt || row.timestamp || row.createdAt || new Date().toISOString()),
    });

    if (alerts.length >= limit) break;
  }

  return alerts;
}

async function loadRecruitingMetaBySlug(): Promise<
  Map<string, { school: string; committedTo: string | null }>
> {
  const store = require('../../lib/recruiting-store') as {
    getAllPlayers: () => Promise<
      { slug?: string; school?: string; highSchool?: string; committedTo?: string | null }[]
    >;
  };
  const players = await store.getAllPlayers().catch(() => []);
  const map = new Map<string, { school: string; committedTo: string | null }>();
  for (const player of players) {
    if (!player.slug) continue;
    map.set(player.slug.toLowerCase(), {
      school: player.school || player.highSchool || '—',
      committedTo: player.committedTo ?? null,
    });
  }
  return map;
}

function loadPublicIntel(): IntelRow[] {
  const gm2 = require('../../lib/gm2') as {
    getPublicIntel: (opts: { limit: number; subsystem: string }) => { intel: IntelRow[] };
  };
  const beatFilters = require('../../lib/beat-writer-filters') as {
    filterUfOnlyIntelRows: (rows: IntelRow[]) => IntelRow[];
  };
  const intel = gm2.getPublicIntel({ limit: 200, subsystem: 'recruiting-movement-intel' }).intel ?? [];
  return beatFilters.filterUfOnlyIntelRows(intel);
}

export async function buildRecruitingMovementIntelPayload(): Promise<{
  ok: boolean;
  updatedAt: string;
  lastUpdated: string;
  risers: MovementIntelItem[];
  fallers: MovementIntelItem[];
  volatile: MovementIntelItem[];
  alerts: MovementIntelAlert[];
}> {
  clearFuturecastCache();
  const boosts = await listCompetingVolatilityBoosts(ROLLING_MOVEMENT_WINDOW_DAYS).catch(
    () => new Map<string, number>()
  );
  const movementRowsRaw = filterMovementIntelRollingRows(
    await listRollingMovement(MOVEMENT_FILTERS, boosts)
  );
  const movementRows = await filterMovementRowsToLiveTargetsMulti(movementRowsRaw, [2027]);
  const [metaBySlug] = await Promise.all([loadRecruitingMetaBySlug()]);

  const intel = loadPublicIntel();
  const intelByPlayer = groupIntelByPlayer(intel);
  const items: MovementIntelItem[] = [];
  const seen = new Set<string>();

  for (const row of movementRows) {
    const slug = String(row.slug || '').toLowerCase();
    const meta = metaBySlug.get(slug);
    if (meta?.committedTo && isFloridaSchool(meta.committedTo)) continue;

    const ufProb = toPct(row.ufProbNow);
    const delta = toDelta(row.delta7d);
    const events = intelEventsForPlayer(intelByPlayer, row.slug, row.playerId);
    const movementType = classifyMovement(delta, row.volatilityScore, events);
    if (!movementType) continue;

    seen.add(row.playerId);
    items.push({
      id: row.playerId,
      slug: row.slug,
      name: row.fullName,
      position: row.position || '—',
      school: meta?.school || '—',
      ufProb,
      delta,
      movementType,
      lastUpdate: new Date().toISOString(),
      tags: mapTags(events),
    });
  }

  for (const row of intel) {
    const slug = String(row.playerSlug || row.player_slug || '').toLowerCase();
    const playerId = String(row.playerId || row.player_id || slug);
    if (!playerId || seen.has(playerId)) continue;
    if (slug) {
      const meta = metaBySlug.get(slug);
      if (meta?.committedTo && isFloridaSchool(meta.committedTo)) continue;
      const onLiveBoard = movementRows.some(
        (m) => String(m.slug || '').toLowerCase() === slug
      );
      if (!onLiveBoard) continue;
    }

    const events = intelEventsForPlayer(intelByPlayer, slug, playerId);
    if (events.length === 0) continue;

    const intelDelta =
      row.movementDelta != null
        ? toDelta(Number(row.movementDelta))
        : row.movement_delta != null
          ? toDelta(Number(row.movement_delta))
          : 0;
    const ufProb =
      row.confidencePct != null
        ? toPct(Number(row.confidencePct))
        : row.ufRpmPct != null
          ? toPct(Number(row.ufRpmPct))
          : 0;

    const movementType = classifyMovement(intelDelta, 0, events);
    if (movementType !== 'VOLATILE') continue;

    seen.add(playerId);
    items.push({
      id: playerId,
      slug: slug || undefined,
      name: String(row.playerName || row.player_name || 'Recruit'),
      position: String(row.pos || '—'),
      school: String(row.school || row.highSchool || row.high_school || '—'),
      ufProb,
      delta: intelDelta,
      movementType: 'VOLATILE',
      lastUpdate: String(row.reportedAt || row.timestamp || row.createdAt || new Date().toISOString()),
      tags: mapTags(events),
    });
  }

  const lastUpdated = new Date().toISOString();
  return {
    ok: true,
    updatedAt: lastUpdated,
    lastUpdated,
    risers: items
      .filter((item) => item.movementType === 'RISE')
      .sort((a, b) => b.delta - a.delta),
    fallers: items
      .filter((item) => item.movementType === 'FALL')
      .sort((a, b) => a.delta - b.delta),
    volatile: items
      .filter((item) => item.movementType === 'VOLATILE')
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
    alerts: buildAlerts(intel, 5),
  };
}

export const handleGetRecruitingMovementIntel = asyncHandler(async (_req: Request, res: Response) => {
  try {
    res.json(await buildRecruitingMovementIntelPayload());
  } catch (err) {
    if (isFutureCastDataError(err)) {
      const intel = loadPublicIntel();
      respondDatabaseUnavailable(
        res,
        {
          ok: true,
          updatedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          risers: [],
          fallers: [],
          volatile: [],
          alerts: buildAlerts(intel, 5),
        },
        err
      );
      return;
    }
    handlePredictionsApiError(res, err);
  }
});
