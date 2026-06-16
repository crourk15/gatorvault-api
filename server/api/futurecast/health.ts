/**
 * GET /api/futurecast/health — Postgres connectivity + prediction table probe.
 */
import type { Request, Response } from 'express';
import { db } from '../../models/db';

export async function handleGetFutureCastHealth(_req: Request, res: Response): Promise<void> {
  const started = Date.now();
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
      ssl: process.env.FUTURECAST_DB_SSL === 'true' || process.env.NODE_ENV === 'production'
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(503).json({
      ok: false,
      connected: false,
      latencyMs: Date.now() - started,
      error: message,
      databaseConfigured: !!(process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL)
    });
  }
}
