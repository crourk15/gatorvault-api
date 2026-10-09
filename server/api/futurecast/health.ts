/**
 * GET /api/futurecast/health — Postgres connectivity + prediction table probe + freshness.
 */
import { createRequire } from 'node:module';
import type { Request, Response } from 'express';
import { db } from '../../models/db';

const require = createRequire(import.meta.url);

function loadFreshness() {
  try {
    const ufTrend = require('../../lib/uf-trend-snapshot');
    const trend = ufTrend.getUfTrendStoreInfo();
    let rivalsPmLastRun: string | null = null;
    try {
      const fs = require('node:fs');
      const path = require('node:path');
      const candidates = [
        '/var/data/recruiting/rivals-pm-snapshot.json',
        path.join(__dirname, '../../data/recruiting/rivals-pm-snapshot.json'),
      ];
      for (const candidate of candidates) {
        if (!fs.existsSync(candidate)) continue;
        const raw = JSON.parse(fs.readFileSync(candidate, 'utf8'));
        rivalsPmLastRun = raw?.lastRun || null;
        if (rivalsPmLastRun) break;
      }
    } catch {
      rivalsPmLastRun = null;
    }
    const latestMs = trend.latestDate ? Date.parse(`${trend.latestDate}T00:00:00.000Z`) : NaN;
    const ageDays = Number.isFinite(latestMs)
      ? Math.max(0, Math.round((Date.now() - latestMs) / (24 * 60 * 60 * 1000)))
      : null;
    let labPromote = null;
    try {
      labPromote = require('../../lib/lab-promotions-store').getStoreInfo();
    } catch {
      labPromote = null;
    }
    let allowlistIntel = null;
    try {
      const cov = require('../../lib/allowlist-intel-sweep').measureAllowlistIntelCoverage(2028, {
        days: 30,
      });
      allowlistIntel = {
        coveragePct: cov.coveragePct,
        recentCoveragePct: cov.recentCoveragePct,
        missingCount: Array.isArray(cov.missing) ? cov.missing.length : 0,
        missingWithVisitsCount: Array.isArray(cov.missingWithVisits) ? cov.missingWithVisits.length : 0,
        stale: Number(cov.recentCoveragePct) < 50 || (cov.missingWithVisits || []).length > 0,
      };
    } catch {
      allowlistIntel = null;
    }
    let vaultFeed = null;
    try {
      const report = require('../../lib/vault-feed-2028-sweep').readLastReport({ healStale: true });
      vaultFeed = report
        ? {
            status: report.status || null,
            slotId: report.slotId || null,
            ok: report.ok !== false && report.status !== 'error',
            finishedAt: report.finishedAt || null,
            needsRetry: report.status === 'error' || report.status === 'running',
          }
        : null;
    } catch {
      vaultFeed = null;
    }
    return {
      ufTrend: {
        durable: trend.durable === true,
        updatedAt: trend.updatedAt,
        latestDate: trend.latestDate,
        slugCount: trend.slugCount,
        multiPointSlugs: trend.multiPointSlugs,
        ageDays,
        stale: ageDays == null ? true : ageDays > 2,
      },
      rivalsPmLastRun,
      labPromote,
      allowlistIntel,
      vaultFeed,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function handleGetFutureCastHealth(_req: Request, res: Response): Promise<void> {
  const started = Date.now();
  const freshness = loadFreshness();
  try {
    const { rows: playerRows } = await db.query<{ count: string }>(
      'select count(*)::text as count from futurecast.players'
    );
    const { rows: predictionRows } = await db.query<{ count: string }>(
      "select count(*)::text as count from futurecast.predictions where status = 'ACTIVE'"
    );
    res.json({
      ok: true,
      connected: true,
      latencyMs: Date.now() - started,
      players: parseInt(playerRows[0]?.count || '0', 10),
      activePredictions: parseInt(predictionRows[0]?.count || '0', 10),
      databaseConfigured: !!(process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL),
      ssl: process.env.FUTURECAST_DB_SSL === 'true' || process.env.NODE_ENV === 'production',
      freshness,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(503).json({
      ok: false,
      connected: false,
      latencyMs: Date.now() - started,
      error: message,
      databaseConfigured: !!(process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL),
      freshness,
    });
  }
}
