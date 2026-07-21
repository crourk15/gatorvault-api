'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchRecruitingHubBundle,
  RECRUITING_HUB_ELITE_YEAR,
  type RhHubBundle,
} from '@/lib/recruiting-hub-elite-api';
import {
  getRecruitingHubBundleSeed,
  recruitingHubBundleHasSignal,
} from '@/lib/recruiting-hub-bundle-seed';
import { fetchWithWarmPoll } from '@/lib/api-warm-poll';
import { hubBundleWarmPollProfile } from '@/lib/warm-poll-profile';
import type { RecruitingHubBundleState } from '@/components/recruiting-hub/elite/RecruitingHubBundleContext';
import { initGvHydrate } from '@/lib/gv-hydrate';
import '@/lib/recruiting-hub-window';

const HUB_BUNDLE_CACHE_PREFIX = 'gv_hub_bundle_v1';
const HUB_BUNDLE_CACHE_TTL_MS = 30 * 60 * 1000;
const HUB_AUTO_RETRY_MS = 8_000;

function readHubBundleCache(year: number): RhHubBundle | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`${HUB_BUNDLE_CACHE_PREFIX}:${year}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; bundle: RhHubBundle };
    if (!parsed?.bundle || Date.now() - parsed.at > HUB_BUNDLE_CACHE_TTL_MS) return null;
    return parsed.bundle;
  } catch {
    return null;
  }
}

function initialHubBundle(year: number): RhHubBundle | null {
  return readHubBundleCache(year) ?? getRecruitingHubBundleSeed(year);
}

function writeHubBundleCache(year: number, bundle: RhHubBundle): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      `${HUB_BUNDLE_CACHE_PREFIX}:${year}`,
      JSON.stringify({ at: Date.now(), bundle })
    );
  } catch {
    /* sessionStorage quota */
  }
}

function initHubMonitor(year: number): number {
  if (typeof window === 'undefined') return 0;
  const start = window.__GV_HUB__?.start ?? performance.now();
  window.__GV_HUB__ = {
    ...window.__GV_HUB__,
    start,
    year,
    ok: false,
  };
  initGvHydrate();
  return start;
}

/** Poll hub bundle while API warms — covers Starter cold hub builds (~60s). */
async function fetchHubBundleWithWarmPoll(year: number): Promise<RhHubBundle> {
  return fetchWithWarmPoll(() => fetchRecruitingHubBundle(year), hubBundleWarmPollProfile());
}

/** Single /api/recruiting/hub/bundle fetch for the elite landing page. */
export function useRecruitingHubBundle(year = RECRUITING_HUB_ELITE_YEAR): RecruitingHubBundleState {
  const [data, setData] = useState<RhHubBundle | null>(() => initialHubBundle(year));
  const [loading, setLoading] = useState(() => !recruitingHubBundleHasSignal(initialHubBundle(year)));
  const [warming, setWarming] = useState(() => !recruitingHubBundleHasSignal(initialHubBundle(year)));
  const [error, setError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    let cancelled = false;
    const start = initHubMonitor(year);
    const seeded = initialHubBundle(year);
    const hasSeedPaint = recruitingHubBundleHasSignal(seeded);
    if (seeded) {
      setData(seeded);
      setLoading(false);
      setWarming(false);
    }

    async function run(): Promise<void> {
      if (!hasSeedPaint) {
        setLoading(true);
        setWarming(true);
      }
      setError(false);
      let gotBundle = false;
      try {
        const t0 = performance.now();
        const bundle = await fetchHubBundleWithWarmPoll(year);
        const bundleLoadMs = Math.round(performance.now() - t0);
        if (cancelled) return;
        // Keep seed/cache when live is empty/cold — never wipe a painted hub.
        if (!recruitingHubBundleHasSignal(bundle) && hasSeedPaint) {
          setWarming(false);
          setError(false);
          gotBundle = true;
          return;
        }
        writeHubBundleCache(year, bundle);
        if (typeof window !== 'undefined') {
          window.__GV_HUB__ = {
            ...window.__GV_HUB__,
            start,
            bundleLoadMs,
            year,
            ok: true,
            heroRenderMs: window.__GV_HUB__?.heroRenderMs,
            hydrationMs: window.__GV_HUB__?.hydrationMs,
            bundleToHeroMs: window.__GV_HUB__?.bundleToHeroMs,
            hydrationQueueMs: window.__GV_HYDRATE_TIMINGS__,
          };
        }
        if (process.env.NODE_ENV !== 'production') {
          console.info(`[recruiting-hub] bundle loaded in ${bundleLoadMs}ms`);
        }
        setData(bundle);
        gotBundle = true;
        setWarming(false);
        setError(false);
      } catch {
        if (cancelled) return;
        const fallback = initialHubBundle(year);
        if (recruitingHubBundleHasSignal(fallback)) {
          setData(fallback);
          setError(false);
          setWarming(false);
          gotBundle = true;
        } else {
          if (typeof window !== 'undefined') {
            window.__GV_HUB__ = { ...window.__GV_HUB__, start, year, ok: false };
          }
          // Keep warming UI + auto-retry — never dump fans into a dead error page.
          setError(false);
          setWarming(true);
          window.setTimeout(() => {
            if (!cancelled) setReloadToken((token) => token + 1);
          }, HUB_AUTO_RETRY_MS);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          if (gotBundle) setWarming(false);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [year, reloadToken]);

  return { data, loading, warming, error, reload };
}
