/** Match ticker animation speed to content width — fixed CSS durations feel too fast with long feeds. */
export function applyTickerScrollDuration(
  trackEl: HTMLElement | null,
  opts?: { minSec?: number; maxSec?: number; pxPerSec?: number }
): void {
  if (!trackEl) return;
  const minSec = opts?.minSec ?? 75;
  const maxSec = opts?.maxSec ?? 240;
  const pxPerSec = opts?.pxPerSec ?? 28;
  const halfWidth = trackEl.scrollWidth / 2;
  if (!halfWidth) return;
  const sec = Math.max(minSec, Math.min(maxSec, halfWidth / pxPerSec));
  trackEl.style.animationDuration = `${sec}s`;
}
