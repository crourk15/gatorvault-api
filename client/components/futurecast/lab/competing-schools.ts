import type { FcLabTarget } from './fc-lab-types';
import { ufPctFromFc } from './fc-lab-types';

export type CompetingSchoolSegment = {
  key: string;
  name: string;
  pct: number;
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
  const words = n.split(' ').filter(Boolean);
  return words[0]?.slice(0, 8) || n.slice(0, 8) || 'Peer';
}

/** Build segmented competitor bar from player model data (never static UGA/Bama template). */
export function resolveCompetingSchools(player: FcLabTarget): CompetingSchoolSegment[] {
  if (player.committedTo && isFlorida(player.committedTo)) {
    return [];
  }

  const uf = ufPctFromFc(player.ufProbability);
  const fromModel = (player.competingSchools ?? []).filter((s) => s.pct > 0);

  if (fromModel.length) {
    const total = fromModel.reduce((sum, s) => sum + s.pct, 0) || 100;
    return fromModel
      .slice(0, 4)
      .map((s, i) => ({
        key: `${player.slug}-${i}`,
        name: shortSchoolLabel(s.name),
        pct: Math.max(1, Math.round((s.pct / total) * 100)),
        tone: (isFlorida(s.name) ? 'uf' : i === 0 ? 'peer' : 'other') as CompetingSchoolSegment['tone'],
      }))
      .sort((a, b) => b.pct - a.pct);
  }

  if (player.predictors?.length) {
    const bySchool = new Map<string, number>();
    for (const p of player.predictors) {
      const label = shortSchoolLabel(p.name);
      bySchool.set(label, Math.max(bySchool.get(label) ?? 0, p.score));
    }
    const entries = [...bySchool.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const peerTotal = entries.reduce((sum, [, score]) => sum + score, 0) || 1;
    const segments: CompetingSchoolSegment[] = [
      {
        key: `${player.slug}-uf`,
        name: 'UF',
        pct: Math.max(1, Math.min(100, uf)),
        tone: 'uf',
      },
    ];
    for (const [name, score] of entries) {
      if (isFlorida(name)) continue;
      segments.push({
        key: `${player.slug}-${name}`,
        name,
        pct: Math.max(1, Math.round((score / peerTotal) * Math.max(0, 100 - uf))),
        tone: 'peer',
      });
    }
    return normalizeSegmentWidths(segments);
  }

  return [];
}

function normalizeSegmentWidths(segments: CompetingSchoolSegment[]): CompetingSchoolSegment[] {
  const total = segments.reduce((sum, s) => sum + s.pct, 0) || 1;
  return segments.map((s) => ({ ...s, pct: Math.max(1, Math.round((s.pct / total) * 100)) }));
}

export function competingSchoolsLabel(segments: CompetingSchoolSegment[]): string {
  if (!segments.length) return '';
  return segments.map((s) => `${s.name} ${s.pct}%`).join(' · ');
}
