/**
 * Player Card Metrics (FutureCast Elite)
 *
 * UF % (ufProbability / ufConfidence):
 *    - The FutureCast model’s commit likelihood for Florida.
 *    - Represents the statistical probability UF lands the player.
 *
 * Staff % (staffConfidence):
 *    - Insider / staff sentiment score.
 *    - Reflects internal confidence based on notes, evaluations, and recruiting feel.
 *
 * Fit % (fitScore):
 *    - Scheme + roster + athletic fit score.
 *    - Represents how well the player fits Florida’s system and positional needs.
 *
 * Priority Score (priorityScore):
 *    - Weighted importance metric for UF’s class strategy.
 *    - Represents how big of a priority the player is for the 2027 class.
 *    - Not a probability — this is an importance ranking.
 */

/** UF % — Likelihood (field: ufProbability on high-priority API, ufConfidence on board API). */
export const FC_METRIC_UF = {
  label: 'UF %',
  name: 'Likelihood',
  description: 'FutureCast model commit likelihood for Florida; statistical probability UF lands the player.',
  fields: ['ufConfidence', 'ufProbability'] as const,
} as const;

/** Staff % — Insider Confidence (field: staffConfidence). */
export const FC_METRIC_STAFF = {
  label: 'Staff %',
  name: 'Insider Confidence',
  description: 'Insider / staff sentiment based on notes, evaluations, and recruiting feel.',
  fields: ['staffConfidence'] as const,
} as const;

/** Fit % — Scheme Match (field: fitScore). */
export const FC_METRIC_FIT = {
  label: 'Fit %',
  name: 'Scheme Match',
  description: 'Scheme, roster, and athletic fit; how well the player fits Florida’s system and positional needs.',
  fields: ['fitScore'] as const,
} as const;

/** Priority Score — Importance (field: priorityScore). Not a probability. */
export const FC_METRIC_PRIORITY = {
  label: 'Priority Score',
  name: 'Importance',
  description: 'Weighted importance for UF’s 2027 class strategy; not a commit probability.',
  fields: ['priorityScore', 'priority'] as const,
} as const;

/** Shorthand labels for inline UI copy. */
export const FC_METRIC_LABELS = {
  uf: FC_METRIC_UF.label,
  staff: FC_METRIC_STAFF.label,
  fit: FC_METRIC_FIT.label,
  priority: FC_METRIC_PRIORITY.label,
} as const;

/** Normalize API values that may be 0–1 or already 0–100. */
export function normalizePercent(value: number | null | undefined): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  if (n >= 0 && n <= 1) return Math.round(n * 100);
  return Math.round(Math.min(100, Math.max(0, n)));
}

export function formatUfPercent(value: number | null | undefined): string {
  return `${normalizePercent(value)}%`;
}

export function formatStaffPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatFitPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatPriorityScore(value: number): string {
  return value.toFixed(1);
}

/** Inline metric line, e.g. "UF % · 72%" */
export function formatMetricLine(label: string, value: string): string {
  return `${label} · ${value}`;
}
