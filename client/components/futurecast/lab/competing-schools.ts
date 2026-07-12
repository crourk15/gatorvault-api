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
  const words = n.split(' ').filter(Boolean);
  return words[0]?.slice(0, 8) || n.slice(0, 8) || 'Peer';
}

/**
 * Build competitor RPM bar from confirmed school % only.
 * Never invents UGA/Bama fillers or predictor-synthetic shares.
 */
export function resolveCompetingSchools(player: FcLabTarget): CompetingSchoolSegment[] {
  if (player.committedTo && isFlorida(player.committedTo)) {
    return [];
  }

  const uf = ufPctFromFc(player.ufProbability);
  const fromRpm = (player.competingSchools ?? [])
    .filter((s) => s?.name && Number(s.pct) > 0 && !isFlorida(s.name))
    .sort((a, b) => Number(b.pct) - Number(a.pct))
    .slice(0, 3);

  // No confirmed RPM board → show nothing (not fake rivals).
  if (!fromRpm.length) return [];

  const rows: Array<{ name: string; absPct: number; tone: CompetingSchoolSegment['tone'] }> = [
    { name: 'UF', absPct: Math.max(0, uf), tone: 'uf' },
  ];
  fromRpm.forEach((s, i) => {
    rows.push({
      name: shortSchoolLabel(s.name),
      absPct: Math.round(Number(s.pct)),
      tone: i === 0 ? 'peer' : 'other',
    });
  });

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
