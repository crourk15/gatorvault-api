/** Serialize values for Postgres jsonb parameters (avoids pg array coercion). */
export function jsonbParam(value: unknown): string {
  return JSON.stringify(value ?? null);
}
