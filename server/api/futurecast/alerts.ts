/**
 * GET /api/futurecast/alerts — merged intel + movement alerts for the alerts page.
 */
import { createRequire } from 'node:module';
import type { Request, Response } from 'express';
import { listAlerts } from '../../models/alerts';
import { asyncHandler, handlePredictionsApiError } from '../predictions/utils-api';
import { buildMovementIntelPayload } from './allowlist-board';
import { sendCachedJson } from './response-cache';
import { FUTURECAST_CLASS_YEAR } from './feed-filters';

const require = createRequire(import.meta.url);
const {
  buildFutureCastIntelAlerts,
  buildFutureCastIntelAlertsSync,
} = require('../../lib/futurecast-intel-alerts');
const {
  getAllowlistSet,
  canonicalTargetSlug,
} = require('../../lib/recruiting-target-allowlist');

type AlertRow = {
  id: string;
  playerId: string;
  playerSlug: string;
  playerName: string;
  type: string;
  message: string;
  createdAt: string;
  seen: boolean;
  category?: string;
};

function isGatorVaultBoardSlug(slug: string | null | undefined): boolean {
  const key = canonicalTargetSlug(slug);
  if (!key) return false;
  return getAllowlistSet(2027).has(key) || getAllowlistSet(2028).has(key);
}

/** Drop off-board phantoms (e.g. Ryan Peterson) from fan Board Intel. */
function keepBoardIntelAlert(row: AlertRow): boolean {
  const slug = canonicalTargetSlug(row.playerSlug || row.playerId);
  if (!slug) return true; // generic movement banners
  if (/ryan-peterson|jalanie-george|keoni-snipes|zylen-little|josiah-taylor/i.test(slug)) {
    return false;
  }
  // Named player alerts must be on the GatorVault 2027/2028 board.
  if (row.playerName || row.playerSlug) {
    return isGatorVaultBoardSlug(slug);
  }
  return true;
}

function dedupeAlerts(rows: AlertRow[]): AlertRow[] {
  const seen = new Set<string>();
  const out: AlertRow[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

async function buildFutureCastAlertsPayload() {
  const intel = await buildFutureCastIntelAlerts();
  const merged: AlertRow[] = [...intel];

  try {
    const movement = await buildMovementIntelPayload();
    for (const p of movement.risers.slice(0, 4)) {
      merged.push({
        id: `rise-${p.slug}`,
        playerId: p.id,
        playerSlug: p.slug,
        playerName: p.name,
        type: 'movement_riser',
        message: `${p.name} trending up (${Math.round(p.trendDelta7d ?? 0)}% UF)`,
        createdAt: movement.updatedAt,
        seen: false,
        category: 'Movement',
      });
    }
    for (const a of movement.alerts) {
      merged.push({
        id: a.id,
        playerId: a.id,
        playerSlug: '',
        playerName: '',
        type: 'movement_alert',
        message: a.message,
        createdAt: a.createdAt,
        seen: false,
        category: 'Movement',
      });
    }
  } catch {
    /* optional */
  }

  try {
    const db = await listAlerts(12, FUTURECAST_CLASS_YEAR);
    for (const a of db) {
      merged.push({
        id: a.id,
        playerId: a.playerId,
        playerSlug: a.playerSlug,
        playerName: a.playerName,
        type: a.type,
        message: a.message,
        createdAt: a.createdAt,
        seen: a.seen,
        category: 'Movement',
      });
    }
  } catch {
    /* optional */
  }

  const alerts = dedupeAlerts(merged)
    .filter(keepBoardIntelAlert)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 50);

  return {
    alerts,
    updatedAt: new Date().toISOString(),
  };
}

function softAlertsFromIntel(): { alerts: AlertRow[]; updatedAt: string; ok: true } {
  // Sync soft path: visit/flip intel only (no movement DB). Keeps Alerts feed live
  // while the full payload warms in the background.
  const intel = buildFutureCastIntelAlertsSync() as AlertRow[];
  const alerts = dedupeAlerts(intel)
    .filter(keepBoardIntelAlert)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 50);
  return { ok: true, alerts, updatedAt: new Date().toISOString() };
}

export const handleGetFutureCastAlerts = asyncHandler(async (_req: Request, res: Response) => {
  try {
    await sendCachedJson(res, 'futurecast:alerts:v3-board', buildFutureCastAlertsPayload, {
      softOnDeferred: softAlertsFromIntel,
      backgroundBuildOnSoft: true,
    });
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});