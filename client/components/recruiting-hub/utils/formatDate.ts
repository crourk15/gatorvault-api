export { formatCommitDate as formatDate } from '@/lib/recruiting-board-utils';

export function formatIntelTimestamp(raw?: string | null): string {
  if (!raw) return 'Recently updated';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return 'Recently updated';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function formatIntelUpdated(raw?: string | null): string {
  if (!raw) return 'recently';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return 'recently';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
