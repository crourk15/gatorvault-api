'use client';

import { useEffect, useState } from 'react';
import { fetchRecruitingBoard } from '@/lib/recruiting-board-api';
import { fetchHighPriorityIntel } from '@/lib/recruiting-ui-api';
import { ACTIVE_RECRUITING_CLASS_YEAR } from '@/lib/recruiting-cycle';

export type HighPriorityPlayer = {
  slug: string;
  name: string;
  position: string;
  school: string;
  ufProbability: number;
  fitScore: number;
};

function boardPlayerLookup(
  board: Awaited<ReturnType<typeof fetchRecruitingBoard>> | null
): Map<string, { name: string; position: string; school: string }> {
  const map = new Map<string, { name: string; position: string; school: string }>();
  if (!board) return map;

  const players = [
    ...(board.players ?? []),
    ...(board.targets ?? []),
    ...(board.commits ?? []),
    ...(board.tiers?.flatMap((tier) => tier.players) ?? []),
  ];

  for (const player of players) {
    const slug = player.slug?.trim();
    if (!slug || map.has(slug)) continue;
    map.set(slug, {
      name: player.name,
      position: player.position ?? player.pos ?? '—',
      school: player.school ?? '—',
    });
  }
  return map;
}

export function useHighPriorityIntelPreview(): HighPriorityPlayer[] | null {
  const [players, setPlayers] = useState<HighPriorityPlayer[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      fetchHighPriorityIntel(),
      fetchRecruitingBoard(ACTIVE_RECRUITING_CLASS_YEAR).catch(() => null),
    ])
      .then(([items, board]) => {
        if (cancelled) return;
        const lookup = boardPlayerLookup(board);
        setPlayers(
          items.slice(0, 6).map((item) => {
            const slug = String(item.playerSlug || item.playerId || item.id || '').trim();
            const profile = slug ? lookup.get(slug) : undefined;
            const ufProbability = Math.round(item.ufProbability);
            return {
              slug: slug || item.id,
              name: profile?.name ?? item.text.split('—')[0]?.trim() ?? 'UF Target',
              position: profile?.position ?? '—',
              school: profile?.school ?? '—',
              ufProbability,
              fitScore: Math.min(100, Math.round(ufProbability * 0.95)),
            };
          })
        );
      })
      .catch(() => {
        if (!cancelled) setPlayers([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return players;
}
