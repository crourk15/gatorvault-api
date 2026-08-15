'use client';

import { useEffect, useState } from 'react';
import type { RosterPlayer } from '@/lib/roster-api';
import { fetchRosterPlayerBySlug } from '@/lib/roster-api';
import {
  prefetchFullProfile,
  resolvePlayerSlug,
  type ProfileRouteContext,
  type ResolvePlayerKind,
} from '@/lib/player-full-profile-api';
import { navigateVaultHref } from '@/lib/navigate-vault-href';
import { playerProfileRoute } from '@/lib/vault-route-map';

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

function canonicalProfileHref(
  canonicalSlug: string,
  kind: ResolvePlayerKind,
  context: ProfileRouteContext
): string {
  if (context === 'recruiting' || kind === 'recruiting-fallback') {
    return playerProfileRoute(canonicalSlug, 'recruiting');
  }
  if (context === 'roster' || kind === 'roster') {
    return playerProfileRoute(canonicalSlug, 'roster');
  }
  return playerProfileRoute(canonicalSlug, 'futurecast');
}

function optimisticProfileState(
  slug: string,
  context: ProfileRouteContext
): Extract<PlayerProfileRouteState, { phase: 'profile' }> {
  const canonicalSlug = slug.trim().toLowerCase();
  return {
    phase: 'profile',
    playerId: '',
    canonicalSlug,
    kind: context === 'recruiting' ? 'recruiting-fallback' : 'futurecast',
  };
}

export function usePlayerProfileRoute(
  slug: string | null,
  context: ProfileRouteContext = 'auto'
): PlayerProfileRouteState {
  const [state, setState] = useState<PlayerProfileRouteState>(() => {
    if (!slug) return { phase: 'error', message: 'No player slug in URL.' };
    // Roster must resolve before picking RosterProfilePage vs FutureCast shell.
    if (context === 'roster') return { phase: 'loading' };
    // Skip the resolve gate — mount profile immediately (skeleton/cache inside).
    return optimisticProfileState(slug, context);
  });

  useEffect(() => {
    if (!slug) {
      setState({ phase: 'error', message: 'No player slug in URL.' });
      return;
    }

    let cancelled = false;
    const normalized = slug.trim().toLowerCase();

    if (context === 'roster') {
      setState({ phase: 'loading' });
    } else {
      setState((prev) =>
        prev.phase === 'profile' && prev.canonicalSlug === normalized
          ? prev
          : optimisticProfileState(normalized, context)
      );
      prefetchFullProfile(normalized);
    }

    void (async () => {
      try {
        const resolved = await resolvePlayerSlug(slug, context);
        if (cancelled) return;

        // Team roster context must never leave /vault/players — even when an
        // older API still returns a PORTAL redirectHref for dual-listed players.
        if (context === 'roster') {
          if (resolved.kind === 'roster' && resolved.roster) {
            setState({
              phase: 'roster',
              playerId: resolved.playerId,
              canonicalSlug: resolved.canonicalSlug || normalized,
              roster: mapRoster(resolved.roster),
            });
            return;
          }
          const rosterPlayer = await fetchRosterPlayerBySlug(normalized);
          if (cancelled) return;
          if (rosterPlayer) {
            setState({
              phase: 'roster',
              playerId: rosterPlayer.id || rosterPlayer.slug || normalized,
              canonicalSlug: rosterPlayer.slug || normalized,
              roster: rosterPlayer,
            });
            return;
          }
          // Fall through to generic profile if roster row is missing.
        } else if (resolved.redirectHref) {
          // Capacitor-safe catch-all navigation (avoid Next replace into player shells).
          navigateVaultHref(resolved.redirectHref);
          setState({ phase: 'redirect', href: resolved.redirectHref });
          return;
        }

        if (
          resolved.canonicalSlug &&
          resolved.canonicalSlug.toLowerCase() !== normalized
        ) {
          const href = canonicalProfileHref(resolved.canonicalSlug, resolved.kind, context);
          navigateVaultHref(href);
          setState({ phase: 'redirect', href });
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
        setState((prev) => {
          const canonical = (resolved.canonicalSlug || normalized).toLowerCase();
          // Stay on optimistic mount — bumping playerId remounts the fetch and flashes skeleton.
          if (prev.phase === 'profile' && prev.canonicalSlug === canonical) {
            return prev;
          }
          return {
            phase: 'profile',
            playerId: resolved.playerId,
            canonicalSlug: canonical,
            kind: resolved.kind,
          };
        });
      } catch (err) {
        if (cancelled) return;
        if (context === 'roster') {
          try {
            const rosterPlayer = await fetchRosterPlayerBySlug(normalized);
            if (cancelled) return;
            if (rosterPlayer) {
              setState({
                phase: 'roster',
                playerId: rosterPlayer.id || rosterPlayer.slug || normalized,
                canonicalSlug: rosterPlayer.slug || normalized,
                roster: rosterPlayer,
              });
              return;
            }
          } catch {
            /* fall through */
          }
          setState({
            phase: 'error',
            message: err instanceof Error ? err.message : 'Player not found',
          });
          return;
        }
        // Non-roster: keep optimistic profile mounted — full-profile fetch owns the error UI.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, context]);

  return state;
}
