'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RosterPlayer } from '@/lib/roster-api';
import {
  resolvePlayerSlug,
  type ProfileRouteContext,
  type ResolvePlayerKind,
} from '@/lib/player-full-profile-api';

export type PlayerProfileRouteState =
  | { phase: 'loading' }
  | { phase: 'redirect'; href: string }
  | { phase: 'roster'; playerId: string; canonicalSlug: string; roster: RosterPlayer }
  | {
      phase: 'profile';
      playerId: string;
      canonicalSlug: string;
      kind: ResolvePlayerKind;
    }
  | { phase: 'error'; message: string };

function mapRoster(raw: Record<string, unknown>): RosterPlayer {
  return raw as unknown as RosterPlayer;
}

export function usePlayerProfileRoute(
  slug: string | null,
  context: ProfileRouteContext = 'auto'
): PlayerProfileRouteState {
  const router = useRouter();
  const [state, setState] = useState<PlayerProfileRouteState>({ phase: 'loading' });

  useEffect(() => {
    if (!slug) {
      setState({ phase: 'error', message: 'No player slug in URL.' });
      return;
    }

    let cancelled = false;
    setState({ phase: 'loading' });

    void resolvePlayerSlug(slug, context)
      .then((resolved) => {
        if (cancelled) return;
        if (resolved.redirectHref) {
          router.push(resolved.redirectHref);
          setState({ phase: 'redirect', href: resolved.redirectHref });
          return;
        }
        if (resolved.kind === 'roster' && resolved.roster) {
          setState({
            phase: 'roster',
            playerId: resolved.playerId,
            canonicalSlug: resolved.canonicalSlug,
            roster: mapRoster(resolved.roster),
          });
          return;
        }
        setState({
          phase: 'profile',
          playerId: resolved.playerId,
          canonicalSlug: resolved.canonicalSlug,
          kind: resolved.kind,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          phase: 'error',
          message: err instanceof Error ? err.message : 'Player not found',
        });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolve once per slug/context
  }, [slug, context]);

  return state;
}
