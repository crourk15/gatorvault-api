/**
 * Fan-facing presentation for FutureCast / My Alerts feed items.
 * Hides snake_case types and model jargon from the UI.
 */
import type { FutureCastAlert } from '@/lib/alerts-api';

export type FanAlertTone = 'rise' | 'fall' | 'visit' | 'flip' | 'heat' | 'intel';

export type FanAlertCard = {
  id: string;
  playerName: string;
  playerSlug: string;
  lifecycle?: string | null;
  chip: string;
  tone: FanAlertTone;
  headline: string;
  detail: string | null;
  createdAt: string;
  /** Lower = show first */
  rank: number;
};

function parseConfidenceMove(message: string): { from: number; to: number } | null {
  const m = String(message || '').match(/(\d+)\s*%\s*(?:->|->)\s*(\d+)\s*%/);
  if (!m) return null;
  return { from: Number(m[1]), to: Number(m[2]) };
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const mins = Math.round((Date.now() - t) / 60000);
  // Future timestamps (e.g. upcoming visit start) must not read as "Just now".
  if (mins < -60) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 36) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatAlertTime(iso: string): string {
  return relativeTime(iso);
}

/**
 * Turn a raw API alert into a fan card. Returns null for noisy model noise
 * we should not surface (e.g. bare volatility spikes).
 */
export function toFanAlertCard(alert: FutureCastAlert): FanAlertCard | null {
  const type = String(alert.type || '').toLowerCase();
  const category = String(alert.category || '').toLowerCase();
  const name = String(alert.playerName || 'Recruit').trim() || 'Recruit';
  const message = String(alert.message || '').trim();

  // Volatility spikes are internal model noise — skip for fans.
  if (type === 'volatility_spike') return null;

  if (
    type === 'visit_upcoming' ||
    type.includes('visit_upcoming') ||
    /upcoming|scheduled/i.test(message)
  ) {
    return {
      id: alert.id,
      playerName: name,
      playerSlug: alert.playerSlug,
      lifecycle: alert.lifecycle,
      chip: 'Visit',
      tone: 'visit',
      headline: `${name} has a Florida visit coming up`,
      detail: cleanVisitDetail(message, name),
      createdAt: alert.createdAt,
      rank: 1,
    };
  }

  if (type === 'visit_uv' || type.includes('visit_uv') || /unofficial visit/i.test(message)) {
    return {
      id: alert.id,
      playerName: name,
      playerSlug: alert.playerSlug,
      lifecycle: alert.lifecycle,
      chip: 'UV',
      tone: 'visit',
      headline: `${name} took an unofficial Florida visit`,
      detail: cleanVisitDetail(message, name),
      createdAt: alert.createdAt,
      rank: 1,
    };
  }

  if (type === 'visit_recap' || type.includes('visit_recap') || category === 'visit') {
    return {
      id: alert.id,
      playerName: name,
      playerSlug: alert.playerSlug,
      lifecycle: alert.lifecycle,
      chip: 'Visit',
      tone: 'visit',
      headline: `${name} wrapped a Florida visit`,
      detail: cleanVisitDetail(message, name),
      createdAt: alert.createdAt,
      rank: 1,
    };
  }

  if (type === 'flip_watch' || category === 'flip watch' || category === 'flip_watch') {
    return {
      id: alert.id,
      playerName: name,
      playerSlug: alert.playerSlug,
      lifecycle: alert.lifecycle,
      chip: 'Flip watch',
      tone: 'flip',
      headline: `${name} is on Florida's flip radar`,
      detail: cleanFlipDetail(message, name),
      createdAt: alert.createdAt,
      rank: 2,
    };
  }

  if (type === 'movement_riser' || type === 'movement_alert') {
    const uf = message.match(/(\d+)\s*%/);
    return {
      id: alert.id,
      playerName: name,
      playerSlug: alert.playerSlug,
      lifecycle: alert.lifecycle,
      chip: 'Rising',
      tone: 'rise',
      headline: uf
        ? `${name} is climbing — Florida now at ${uf[1]}%`
        : `${name} is climbing on Florida's board`,
      detail: null,
      createdAt: alert.createdAt,
      rank: 3,
    };
  }

  if (type === 'confidence_movement' || category === 'movement') {
    const move = parseConfidenceMove(message);
    if (!move) {
      return {
        id: alert.id,
        playerName: name,
        playerSlug: alert.playerSlug,
        lifecycle: alert.lifecycle,
        chip: 'Board move',
        tone: 'intel',
        headline: `${name} moved on the Florida board`,
        detail: null,
        createdAt: alert.createdAt,
        rank: 5,
      };
    }
    const delta = move.to - move.from;
    const rising = delta > 0;
    // Tiny wiggles are noise.
    if (Math.abs(delta) < 5) return null;
    return {
      id: alert.id,
      playerName: name,
      playerSlug: alert.playerSlug,
      lifecycle: alert.lifecycle,
      chip: rising ? 'Heating up' : 'Cooling',
      tone: rising ? 'rise' : 'fall',
      headline: rising
        ? `${name} is heating up — Florida ${move.from}% -> ${move.to}%`
        : `${name} cooled off — Florida ${move.from}% -> ${move.to}%`,
      detail: null,
      createdAt: alert.createdAt,
      rank: rising ? 4 : 6,
    };
  }

  // Fallback — never show snake_case type to fans.
  return {
    id: alert.id,
    playerName: name,
    playerSlug: alert.playerSlug,
    lifecycle: alert.lifecycle,
    chip: alert.category || 'Intel',
    tone: 'intel',
    headline: message.includes(name) ? message : `${name} — ${message}`,
    detail: null,
    createdAt: alert.createdAt,
    rank: 7,
  };
}

function cleanVisitDetail(message: string, name: string): string | null {
  let t = message.replace(new RegExp(`^${escapeReg(name)}\\s*[—\\-:]\\s*`, 'i'), '').trim();
  t = t.replace(/\bverified\b/gi, '').replace(/\s{2,}/g, ' ').trim();
  if (!t || /^visit/i.test(t) && t.length < 12) return null;
  return t;
}

function cleanFlipDetail(message: string, name: string): string | null {
  let t = message.replace(new RegExp(`^${escapeReg(name)}(?:\\s*\\([^)]*\\))?\\s*[—\\-:]\\s*`, 'i'), '').trim();
  t = t
    .replace(/\bUF Est\.?\b/gi, 'Florida')
    .replace(/\bFlip score\b/gi, 'Flip heat')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return t || null;
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildFanAlertCards(alerts: FutureCastAlert[]): FanAlertCard[] {
  const seen = new Set<string>();
  const cards: FanAlertCard[] = [];
  for (const alert of alerts) {
    const card = toFanAlertCard(alert);
    if (!card) continue;
    // Dedupe identical story + player in a short window.
    const key = `${card.playerSlug}|${card.chip}|${card.headline}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cards.push(card);
  }
  cards.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  return cards.slice(0, 18);
}
