'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchNilDashboard, type NilDashboard } from '@/lib/nil-api';
import {
  fetchHighPriorityTargets,
  type HighPriorityPlayer,
  type HighPriorityResponse,
} from '@/lib/futurecast-high-priority-api';

export type NilPortalImpactRow = {
  id: string;
  name: string;
  position: string;
  range: string;
  trend: 'up' | 'down' | 'flat';
  note: string;
};

export type NilEliteData = {
  dashboard: NilDashboard | null;
  players: HighPriorityPlayer[];
  portalGains: NilPortalImpactRow[];
  portalLosses: NilPortalImpactRow[];
  loading: boolean;
  error: string | null;
  reload: () => void;
};

function buildPortalImpact(players: HighPriorityPlayer[], dashboard: NilDashboard | null) {
  const gains: NilPortalImpactRow[] = [];
  const losses: NilPortalImpactRow[] = [];

  for (const ev of dashboard?.recentEvents ?? []) {
    if (ev.recruitingCorrelation !== 'positive') continue;
    const headline = ev.title.toLowerCase();
    if (headline.includes('portal') || headline.includes('commitment') || headline.includes('package')) {
      gains.push({
        id: ev.id ?? ev.title,
        name: ev.title,
        position: ev.impact?.split(',')[0]?.trim() || 'Portal',
        range: '$400K–$900K',
        trend: 'up',
        note: ev.summary ?? 'UF collective activity correlated with portal win.',
      });
    }
  }

  for (const p of players) {
    const delta = p.delta7d ?? p.movementDelta ?? 0;
    if (p.committedTo && !String(p.committedTo).toLowerCase().includes('florida')) {
      losses.push({
        id: `loss-${p.slug}`,
        name: p.name,
        position: p.position,
        range: `$${Math.max(250, parseNil(p) - 40)}K–$${parseNil(p) + 80}K`,
        trend: 'down',
        note: `Committed elsewhere — NIL gap cited in movement intel.`,
      });
    } else if (delta >= 4) {
      gains.push({
        id: `gain-${p.slug}`,
        name: p.name,
        position: p.position,
        range: `$${parseNil(p)}K–$${parseNil(p) + 120}K`,
        trend: 'up',
        note: 'Valuation trending up — UF in competitive range.',
      });
    } else if (delta <= -4) {
      losses.push({
        id: `cool-${p.slug}`,
        name: p.name,
        position: p.position,
        range: `$${Math.max(180, parseNil(p) - 60)}K–$${parseNil(p)}K`,
        trend: 'down',
        note: 'Cooling valuation — peer programs gaining leverage.',
      });
    }
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
  const [dashboard, setDashboard] = useState<NilDashboard | null>(null);
  const [players, setPlayers] = useState<HighPriorityPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dash, hp] = await Promise.all([
        fetchNilDashboard(),
        fetchHighPriorityTargets().catch((): HighPriorityResponse => ({ classYear: 2027, count: 0, updatedAt: '', players: [] })),
      ]);
      setDashboard(dash);
      setPlayers(hp.players ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load NIL tracker.');
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
