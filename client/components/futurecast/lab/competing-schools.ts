import type { FcLabTarget } from './fc-lab-types';
import { ufPctFromFc } from './fc-lab-types';

export type CompetingSchoolSegment = {
  key: string;
  name: string;
  pct: number;
  /** Absolute confirmed RPM % (On3 / store) — used in labels. */
  absPct: number;
  tone: 'uf' | 'peer' | 'other';
};

function isFlorida(name: string): boolean {
  return /\bflorida\b|\bgators\b|\buf\b/i.test(name);
}

function normalizeSchool(name: string): string {
  return String(name || '')
    .replace(/\b(university|seminoles|bulldogs|crimson tide|longhorns)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function shortSchoolLabel(name: string): string {
  const n = normalizeSchool(name);
  if (isFlorida(n)) return 'UF';
  // Georgia Tech before Georgia — otherwise "Georgia Tech" becomes UGA.
  if (/georgia tech|yellow jackets/i.test(n)) return 'GT';
  if (/georgia/i.test(n)) return 'UGA';
  if (/alabama/i.test(n)) return 'Bama';
  if (/texas(?! a&m)/i.test(n)) return 'Texas';
  if (/texas a&m|tamu|aggies/i.test(n)) return 'TAMU';
  if (/miami/i.test(n)) return 'Miami';
  if (/ohio state/i.test(n)) return 'OSU';
  if (/clemson/i.test(n)) return 'Clemson';
  if (/tennessee/i.test(n)) return 'Tenn';
  if (/lsu/i.test(n)) return 'LSU';
  if (/florida state|fsu/i.test(n)) return 'FSU';
  if (/penn state/i.test(n)) return 'PSU';
  if (/kentucky/i.test(n)) return 'UK';
  if (/ole miss|mississippi(?!\s*state)/i.test(n)) return 'Ole Miss';
  const words = n.split(' ').filter(Boolean);
  return words[0]?.slice(0, 8) || n.slice(0, 8) || 'Peer';
}

/**
 * On3 market board bar — uses confirmed RPM competitor % + On3 UF RPM.
 * Does not use GatorVault likelihood (that stays on the primary bar).
 */
export function resolveCompetingSchools(player: FcLabTarget): CompetingSchoolSegment[] {
  if (player.committedTo && isFlorida(player.committedTo)) {
    return [];
  }

  const ufRpm =
    player.ufRpmPct != null && Number(player.ufRpmPct) > 0
      ? ufPctFromFc(player.ufRpmPct)
      : null;

  const fromRpm = (player.competingSchools ?? [])
    .filter((s) => s?.name && Number(s.pct) > 0 && !isFlorida(s.name))
    .sort((a, b) => Number(b.pct) - Number(a.pct))
    .slice(0, 3);

  // No peer board — still show Florida RPM alone (locked / no meaningful rivals).
  if (!fromRpm.length) {
    if (ufRpm != null && ufRpm > 0) {
      return [
        {
          key: `${player.slug}-Florida-0`,
          name: 'Florida',
          absPct: ufRpm,
          pct: 100,
          tone: 'uf',
        },
      ];
    }
    return [];
  }

  const rows: Array<{ name: string; absPct: number; tone: CompetingSchoolSegment['tone'] }> = [];
  if (ufRpm != null && ufRpm > 0) {
    rows.push({ name: 'Florida', absPct: ufRpm, tone: 'uf' });
  }
  fromRpm.forEach((s, i) => {
    rows.push({
      // Full school name so ESPN logo lookup works; UI can still truncate.
      name: String(s.name).trim() || shortSchoolLabel(s.name),
      absPct: Math.round(Number(s.pct)),
      tone: i === 0 ? 'peer' : 'other',
    });
  });

  if (!rows.length) return [];

  const widthTotal = rows.reduce((sum, r) => sum + Math.max(r.absPct, 1), 0) || 1;
  return rows.map((r, i) => ({
    key: `${player.slug}-${r.name}-${i}`,
    name: r.name,
    absPct: r.absPct,
    pct: Math.max(1, Math.round((Math.max(r.absPct, 1) / widthTotal) * 100)),
    tone: r.tone,
  }));
}

export function competingSchoolsLabel(segments: CompetingSchoolSegment[]): string {
  if (!segments.length) return '';
  return segments.map((s) => `${s.name} ${s.absPct}%`).join(' · ');
}

/**
 * Single biggest non-Florida threat from the On3 market board.
 * Returns null when no confirmed competitor % exists (no fake rivals).
 */
export function topThreatVsFlorida(
  player: FcLabTarget
): { name: string; label: string; pct: number } | null {
  if (player.committedTo && isFlorida(player.committedTo)) return null;

  const top = (player.competingSchools ?? [])
    .filter((s) => s?.name && Number(s.pct) > 0 && !isFlorida(s.name))
    .sort((a, b) => Number(b.pct) - Number(a.pct))[0];

  if (!top) return null;
  const pct = Math.round(Number(top.pct));
  if (!Number.isFinite(pct) || pct <= 0) return null;
  const label = shortSchoolLabel(String(top.name).trim());
  return { name: String(top.name).trim(), label, pct };
}

/**
 * Closing-class shortlist: UF still in play.
 * Live board rows may land before GV odds exist — still show them.
 * Drops longshots where a rival owns the market (e.g. 3% UF / 90% Georgia).
 */
export function isClosingClassInPlayTarget(player: FcLabTarget): boolean {
  if (player.ufProbability == null) return true;
  const uf = ufPctFromFc(player.ufProbability);
  if (uf < 15) return false;
  const threat = topThreatVsFlorida(player);
  if (threat && uf < 25 && threat.pct >= uf + 40) return false;
  if (threat && uf < 20 && threat.pct >= 70) return false;
  return true;
}

/** Rank closing targets by UF urgency, then how close the top rival is. */
export function closingClassUrgencyScore(player: FcLabTarget): number {
  const uf = ufPctFromFc(player.ufProbability);
  const threat = topThreatVsFlorida(player);
  const rivalGap = threat ? Math.max(0, threat.pct - uf) : 0;
  // Contested mid-board fights slightly ahead of locked UF leans with the same UF%.
  const battleBonus = uf >= 34 && uf < 67 ? 8 : 0;
  return uf * 1.2 + battleBonus - rivalGap * 0.15;
}
