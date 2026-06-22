/**
 * Progressive hydration scheduler — defers non-critical React mounts until idle or in-view.
 */

export type GvHydratePriority = 'hero' | 'top-fold' | 'below-fold' | 'analytics';

type HydrateJob = {
  id: string;
  fn: () => void;
  priority: GvHydratePriority;
  enqueuedAt: number;
};

declare global {
  interface Window {
    __GV_HYDRATE__?: (id: string, fn: () => void, priority?: GvHydratePriority) => void;
    __GV_HYDRATE_QUEUE__?: HydrateJob[];
    __GV_HYDRATE_TIMINGS__?: Record<string, number>;
  }
}

const PRIORITY_ORDER: GvHydratePriority[] = ['hero', 'top-fold', 'below-fold', 'analytics'];

function runIdle(fn: () => void): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => fn());
    return;
  }
  setTimeout(fn, 1);
}

function recordTiming(id: string, enqueuedAt: number): void {
  if (typeof window === 'undefined') return;
  const timings = window.__GV_HYDRATE_TIMINGS__ ?? {};
  timings[id] = Math.round(performance.now() - enqueuedAt);
  window.__GV_HYDRATE_TIMINGS__ = timings;
  const hub = window.__GV_HUB__;
  if (hub) {
    hub.hydrationQueueMs = timings;
  }
}

function heroBlocksProgress(): boolean {
  if (typeof document === 'undefined') return false;
  const heroPending = window.__GV_HYDRATE_QUEUE__?.some((job) => job.priority === 'hero');
  const heroHost = document.querySelector('[data-hydrate="hero"]');
  const heroNeedsHydration = Boolean(heroHost && !heroHost.hasAttribute('data-hydrated'));
  return Boolean(heroPending || heroNeedsHydration);
}

function flushQueue(): void {
  const queue = window.__GV_HYDRATE_QUEUE__;
  if (!queue?.length) return;

  for (const priority of PRIORITY_ORDER) {
    if (priority !== 'hero' && heroBlocksProgress()) break;

    const idx = queue.findIndex((job) => job.priority === priority);
    if (idx === -1) continue;
    const [job] = queue.splice(idx, 1);
    recordTiming(job.id, job.enqueuedAt);
    job.fn();
    break;
  }

  if (queue.length) runIdle(flushQueue);
}

/** Install window.__GV_HYDRATE__ once — hero after bundle, idle for top-fold, IO for below-fold. */
export function initGvHydrate(): void {
  if (typeof window === 'undefined' || window.__GV_HYDRATE__) return;

  window.__GV_HYDRATE_QUEUE__ = [];
  window.__GV_HYDRATE_TIMINGS__ = {};

  window.__GV_HYDRATE__ = (id, fn, priority = 'top-fold') => {
    const queue = window.__GV_HYDRATE_QUEUE__ ?? [];
    if (queue.some((job) => job.id === id)) return;
    queue.push({ id, fn, priority, enqueuedAt: performance.now() });
    window.__GV_HYDRATE_QUEUE__ = queue;
    runIdle(flushQueue);
  };
}

/** Schedule hero hydration after the hub bundle fetch resolves. */
export function scheduleHeroHydration(fn: () => void): void {
  initGvHydrate();
  window.__GV_HYDRATE__?.('hero', fn, 'hero');
}

/** Below-fold section — hydrates when near viewport. */
export function observeBelowFoldHydration(id: string, el: Element | null, fn: () => void): () => void {
  initGvHydrate();
  if (!el) {
    window.__GV_HYDRATE__?.(id, fn, 'below-fold');
    return () => undefined;
  }

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      window.__GV_HYDRATE__?.(id, fn, 'below-fold');
    },
    { rootMargin: '200px' }
  );

  observer.observe(el);
  return () => observer.disconnect();
}
