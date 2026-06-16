/** Safely coerce API/CMS values to displayable text (avoids React "object as child" errors). */
export function coerceDisplayText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}
