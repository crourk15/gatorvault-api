'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchNilDashboard, type NilDashboard } from '@/lib/nil-api';
import {
  fetchHighPriorityTargets,
  type HighPriorityPlayer,
  type HighPriorityResponse,
} from '@/lib/futurecast-high-priority-api';
import { buildSeedNilEliteBundle } from '@/lib/nil-hub-seed';
import { isCommittedElsewhere, isFloridaSchool } from '@/lib/recruiting-target-filters';

export type NilPortalImpactRow = {
  id: string;
  name: string;
  position: string;
  range: string;
  trend: 'up' | 'down' | 'flat';
  note: string;
  /** FutureCast profile slug when the row is a real player. */
  slug?: string | null;
};

export type NilEliteData = {
  dashboard: NilDashboard | null;
  players: HighPriorityPlayer[];
  portalGains: NilPortalImpactRow[];
  portalLosses: NilPortalImpactRow[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

const SEED_NIL = buildSeedNilEliteBundle();
const HAS_SEED =
  Boolean(SEED_NIL.dashboard?.ufStanding) ||
  (SEED_NIL.dashboard?.secRankings?.length ?? 0) > 0;

function buildPortalImpact(players: HighPriorityPlayer[], dashboard: NilDashboard | null) {
  const gains: NilPortalImpactRow[] = [];
  const losses: NilPortalImpactRow[] = [];

  // Portal intel from dashboard events — honest headlines, no fabricated dollar bands.
  for (const ev of dashboard?.recentEvents ?? []) {
    const headline = String(ev.title || '').toLowerCase();
    const summary = String(ev.summary || '').toLowerCase();
    const isPortal = headline.includes('portal') || summary.includes('portal');
    if (!isPortal) continue;
    const positive = ev.recruitingCorrelation === 'positive';
    const row: NilPortalImpactRow = {
      id: ev.id ?? ev.title,
      name: ev.title,
      position: 'Portal intel',
      range: 'See note',
      trend: positive ? 'up' : 'flat',
      note: ev.summary || 'Portal-related NIL signal from recent intel.',
      slug: null,
    };
    if (positive) gains.push(row);
    else losses.push(row);
  }

  // Player-backed losses: committed elsewhere (modeled est. only).
  for (const p of players) {
    if (!isCommittedElsewhere(p)) continue;
    const school = String(p.committedTo || '').trim();
    losses.push({
      id: `loss-${p.slug}`,
      name: p.name,
      position: p.position,
      range: `Est. $${Math.max(180, parseNil(p) - 40)}K–$${parseNil(p) + 80}K`,
      trend: 'down',
      note: school
        ? `Committed to ${school}. Modeled NIL band — not a reported deal.`
        : 'Committed elsewhere. Modeled NIL band — not a reported deal.',
      slug: p.slug,
    });
  }

  // Player-backed gains: verified UF commits when present on the HP board.
  for (const p of players) {
    if (!p.committedTo || !isFloridaSchool(p.committedTo)) continue;
    gains.push({
      id: `gain-${p.slug}`,
      name: p.name,
      position: p.position,
      range: `Est. $${parseNil(p)}K–$${parseNil(p) + 120}K`,
      trend: 'up',
      note: 'UF commit — modeled NIL band, not a reported deal.',
      slug: p.slug,
    });
  }

  return {
    portalGains: gains.slice(0, 5),
    portalLosses: losses.slice(0, 5),
  };
}

function parseNil(p: HighPriorityPlayer): number {
  const stars = p.stars ?? 4;
  const rank = p.nationalRank ?? p.natlRank ?? 200;
  return Math.round(Math.max(35, 220 - rank / 2) * (stars >= 5 ? 1.4 : stars >= 4 ? 1 : 0.7));
}

export function useNilEliteData(): NilEliteData {
  const [dashboard, setDashboard] = useState<NilDashboard | null>(
    HAS_SEED ? SEED_NIL.dashboard : null
  );
  const [players, setPlayers] = useState<HighPriorityPlayer[]>(
    HAS_SEED ? SEED_NIL.players : []
  );
  // Seeded first paint is content-ready; live refresh still runs in background.
  const [loading, setLoading] = useState(!HAS_SEED);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Only show skeleton gate when we have nothing to paint.
    if (!HAS_SEED) setLoading(true);
    setError(null);
    try {
      const [dash, hp] = await Promise.all([
        fetchNilDashboard(),
        fetchHighPriorityTargets().catch((): HighPriorityResponse => ({ classYear: 2027, count: 0, updatedAt: '', players: [] })),
      ]);
      setDashboard(dash);
      setPlayers(hp.players ?? []);
    } catch (err) {
      // Keep seed painted if live wake fails.
      if (!HAS_SEED) {
        setError(err instanceof Error ? err.message : 'Could not load NIL tracker.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { portalGains, portalLosses } = buildPortalImpact(players, dashboard);

  return { dashboard, players, portalGains, portalLosses, loading, error, reload: load };
}
