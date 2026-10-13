import test from 'node:test';
import assert from 'node:assert/strict';

test('queued hero hydration keeps the latest bundle paint', async () => {
  globalThis.requestIdleCallback = ((cb: IdleRequestCallback) => {
    setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline), 0);
    return 1;
  }) as typeof requestIdleCallback;
  const win = {
    matchMedia() {
      return { matches: false };
    },
  };
  (globalThis as unknown as { window: typeof win }).window = win;
  const { scheduleHeroHydration } = await import('./gv-hydrate.ts');
  const paints: string[] = [];
  scheduleHeroHydration(() => paints.push('seed'));
  scheduleHeroHydration(() => paints.push('live'));
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.deepEqual(paints, ['live']);
});
