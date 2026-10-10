/**
 * South Carolina expected visitors the installed iOS app paints from
 * GET /api/schedule. Render 502s leave last-good stuck on Easton Royal.
 * The edge serves this board when origin is down, and swaps a Royal-only
 * scar panel for the full list when origin is up but stale.
 */
import { scheduleFallback } from './schedule-board-fallback.mjs';

export { scheduleFallback };

export function scarVisitorPanel() {
  const game = (scheduleFallback.games || []).find((g) => g && g.id === 'scar');
  const panel = game && game.expectedVisitors;
  if (!panel || !Array.isArray(panel.visitors) || !panel.visitors.length) return null;
  return panel;
}

export function pinScarExpectedVisitors(payload) {
  const panel = scarVisitorPanel();
  if (!panel || !payload || typeof payload !== 'object' || !Array.isArray(payload.games)) {
    return { data: payload, changed: false };
  }
  const required = panel.visitors.map((v) => String(v.slug || '').trim()).filter(Boolean);
  let changed = false;
  const games = payload.games.map((g) => {
    if (!g || g.id !== 'scar') return g;
    const have = new Set(
      ((g.expectedVisitors && g.expectedVisitors.visitors) || []).map((v) =>
        String(v && v.slug || '').trim()
      )
    );
    const missing = required.filter((slug) => slug && !have.has(slug));
    if (!missing.length) return g;
    changed = true;
    return { ...g, expectedVisitors: panel };
  });
  if (!changed) return { data: payload, changed: false };
  return { data: { ...payload, games }, changed: true };
}
