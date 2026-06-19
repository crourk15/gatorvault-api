/**
 * Shared dedupe, category, and formatting for recruiting live feeds and alerts.
 */
import { timeAgo } from '@/components/vault/live/live-feed-utils';

export type IntelFeedCategory =
  | 'Movement'
  | 'Visit'
  | 'Offer'
  | 'Commit'
  | 'Portal'
  | 'NIL'
  | 'Staff Note'
  | 'Update';

export type IntelFeedItem = {
  id: string;
  playerName?: string;
  headline: string;
  timestamp: string;
  category: IntelFeedCategory;
  icon: string;
  source?: string;
  url?: string;
};

function normalizeKey(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/\b(jr\.?|sr\.?|iii|ii|iv)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function playerFromText(text: string): string {
  const m = text.match(/^([A-Z][a-z]+(?:['\u2019][A-Za-z]+)?(?:\s+[A-Z][a-z]+)+)/);
  return m ? normalizeKey(m[1]) : '';
}

export function classifyIntelCategory(blob: string): IntelFeedCategory {
  const t = blob.toLowerCase();
  if (/\bcommit|\bsigned\b|\bdecommit\b/.test(t)) return 'Commit';
  if (/\bportal|\btransfer\b/.test(t)) return 'Portal';
  if (/\bnil\b/.test(t)) return 'NIL';
  if (/\bvisit|\bov\b|\bon campus\b|\bjunior day\b/.test(t)) return 'Visit';
  if (/\boffer\b/.test(t)) return 'Offer';
  if (/\bstaff|\binsider|\bnote\b/.test(t)) return 'Staff Note';
  if (/\bmovement|\btrend|\brpm|\bprediction|\bvolatile|\bheating|\bcooling\b/.test(t)) {
    return 'Movement';
  }
  return 'Update';
}

export function categoryIcon(category: IntelFeedCategory, volatile = false): string {
  if (volatile) return '⚠️';
  switch (category) {
    case 'Commit':
      return '🔵';
    case 'Visit':
      return '📍';
    case 'Offer':
      return '🎯';
    case 'Portal':
      return '🟣';
    case 'NIL':
      return '💰';
    case 'Staff Note':
      return '📝';
    case 'Movement':
      return '🔁';
    default:
      return '🔥';
  }
}

export function formatIntelTimestamp(iso?: string | null): string {
  if (!iso) return 'Recently';
  const t = timeAgo(iso);
  return t === 'Just now' ? t : `${t} ago`;
}

export function dedupeIntelFeedItems(items: IntelFeedItem[], max = 16): IntelFeedItem[] {
  const kept: IntelFeedItem[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const playerKey = item.playerName ? normalizeKey(item.playerName) : playerFromText(item.headline);
    const cat = item.category;
    const headlineKey = normalizeKey(item.headline).slice(0, 100);
    const keys = [
      item.id,
      headlineKey.length > 16 ? headlineKey : '',
      playerKey && cat ? `${playerKey}|${cat}` : '',
      playerKey && /movement|visit|offer/.test(cat.toLowerCase()) ? `${playerKey}|${cat}|day` : '',
    ].filter(Boolean);

    if (keys.some((k) => seen.has(k))) continue;
    for (const k of keys) seen.add(k);
    kept.push(item);
    if (kept.length >= max) break;
  }

  return kept;
}

export function buildIntelFeedItem(input: {
  id: string;
  headline: string;
  timestamp?: string | null;
  playerName?: string;
  category?: IntelFeedCategory;
  volatile?: boolean;
  source?: string;
  url?: string;
}): IntelFeedItem {
  const category = input.category ?? classifyIntelCategory(input.headline);
  const volatile = input.volatile ?? (category === 'Movement' && /volatile|spike|⚠/i.test(input.headline));
  return {
    id: input.id,
    playerName: input.playerName,
    headline: input.headline,
    timestamp: input.timestamp || new Date().toISOString(),
    category,
    icon: categoryIcon(category, volatile),
    source: input.source,
    url: input.url,
  };
}
