import type { FcLabTarget } from './fc-lab-types';
import { ufPctFromFc } from './fc-lab-types';
import { sanitizeRpmPct } from '../../../lib/uf-odds-scale';

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

  let peers = (player.competingSchools ?? [])
    .filter((s) => s?.name && Number(s.pct) > 0 && !isFlorida(s.name))
    .sort((a, b) => Number(b.pct) - Number(a.pct));

  // Drop fake 100% peer locks when a real mid-board rival exists (1→100 crumb poison).
  const mid = peers.find((s) => {
    const pct = Number(s.pct);
    return pct >= 15 && pct <= 90;
  });
  if (mid && Number(peers[0]?.pct) >= 95) {
    peers = peers.filter((s) => Number(s.pct) < 95);
  }

  const top = peers[0];
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

/** Rival crumbs below this do not count as a contested board (no "Leads GT by 61"). */
export const MIN_CREDIBLE_RIVAL_PCT = 12;

/** Top rival only when the market share is real enough to score against. */
export function credibleThreatVsFlorida(
  player: FcLabTarget
): { name: string; label: string; pct: number } | null {
  const threat = topThreatVsFlorida(player);
  if (!threat || threat.pct < MIN_CREDIBLE_RIVAL_PCT) return null;
  return threat;
}

/** True when Florida's share is strictly ahead of the top confirmed rival. */
export function isFloridaLeadingOnBoard(player: FcLabTarget): boolean {
  if (player.committedTo && isFlorida(player.committedTo)) return false;
  if (player.ufProbability == null) return false;
  const uf = ufPctFromFc(player.ufProbability);
  if (!(uf > 0)) return false;
  const threat = topThreatVsFlorida(player);
  const rpm = sanitizeRpmPct(player.ufRpmPct);

  if (threat) {
    // Industry trailing / residual UF market cannot be overridden by inflated GV odds.
    if (rpm != null && rpm > 0 && rpm <= threat.pct) return false;
    if (
      rpm != null &&
      rpm > 0 &&
      rpm < MIN_CREDIBLE_RIVAL_PCT &&
      threat.pct >= MIN_CREDIBLE_RIVAL_PCT
    ) {
      return false;
    }
    return uf > threat.pct;
  }

  // Sole / thin board — require a real share so soft unknowns don't flood Leading.
  if (rpm != null && rpm > 0 && rpm < 25 && uf >= 50) return false;
  // Empty peer board without a UF offer is how Girton-style disk poison ranked Closest
  // (fake ~96% lock, peers dropped). Real sole locks (West/Dominick) carry offers.
  const hasOffer =
    player.hasUFOffer === true || player.processEvidence?.hasUFOffer === true;
  if (!hasOffer) return false;
  return uf >= 25;
}

/**
 * Margin over a credible rival only.
 * Empty/thin rival boards return 0 so sole-board UF% cannot invent a giant lead.
 */
export function floridaLeadMargin(player: FcLabTarget): number {
  const uf = ufPctFromFc(player.ufProbability);
  const threat = credibleThreatVsFlorida(player);
  if (!threat) return 0;
  return Math.max(0, uf - threat.pct);
}

/**
 * Structured UF process on file — offer / visits / pursuit intel.
 * Closest to commit must not stamp from On3 % alone.
 */
export function hasClosestCommitProcessEvidence(player: FcLabTarget): boolean {
  if (player.closestCommitEligible === true) return true;
  const ev = player.processEvidence;
  if (!ev) return false;
  if (ev.closestEligible === true) return true;
  // Warm allowlist process: offer/visits/intel and still engaged.
  if (ev.allowlisted === false) return false;
  return Boolean(ev.hasProcess && ev.stillWarm);
}

/** Board lead with a real market read — not a thin sole-board soft %. */
export function hasCredibleBoardLead(player: FcLabTarget): boolean {
  if (!isFloridaLeadingOnBoard(player)) return false;
  const uf = ufPctFromFc(player.ufProbability);
  const rpm = sanitizeRpmPct(player.ufRpmPct) || 0;
  const threat = credibleThreatVsFlorida(player);
  if (threat) {
    // Contested industry board: UF market RPM must actually lead the rival.
    // GV alone over a rival-led / residual board is not Closest-eligible.
    if (!(rpm > 0) || rpm <= threat.pct || rpm < MIN_CREDIBLE_RIVAL_PCT) return false;
    return uf > threat.pct;
  }
  // No credible rival board — need a real market share + UF offer (not Est. noise / disk lie).
  const hasOffer =
    player.hasUFOffer === true || player.processEvidence?.hasUFOffer === true;
  if (!hasOffer) return false;
  return rpm >= 40 || uf >= 50;
}

/**
 * Closer score — who looks nearest to a Florida commit.
 * Contested boards (credible rival) outrank empty/thin sole-board leads.
 * Process evidence is gated separately in isNextCommitPick.
 */
export function nextCommitScore(player: FcLabTarget): number {
  if (!isFloridaLeadingOnBoard(player)) return -1;
  const uf = ufPctFromFc(player.ufProbability);
  const threat = credibleThreatVsFlorida(player);
  const margin = floridaLeadMargin(player);
  const delta = Number(player.delta7d);
  const momentum = Number.isFinite(delta) ? Math.max(-8, Math.min(18, delta * 1.35)) : 0;
  const shareBoost = uf >= 70 ? 16 : uf >= 60 ? 10 : uf >= 50 ? 4 : 0;
  const cushionBoost = threat
    ? margin >= 20
      ? 10
      : margin >= 12
        ? 6
        : margin >= 6
          ? 3
          : 0
    : 0;
  const contestedBoost = threat ? 14 : 0;
  const soleBoardPenalty = threat ? 0 : 18;
  return (
    uf * 1.15 + margin * 0.55 + momentum + shareBoost + cushionBoost + contestedBoost - soleBoardPenalty
  );
}

/** Top-tier closer cut — board lead + process evidence (offer/visits/intel). */
export function isNextCommitPick(player: FcLabTarget, minScore = 78): boolean {
  if (!hasClosestCommitProcessEvidence(player)) return false;
  if (!hasCredibleBoardLead(player)) return false;
  return nextCommitScore(player) >= minScore;
}

/** @deprecated use isNextCommitPick */
export function isLikelyNextCommit(player: FcLabTarget, minUfPct = 60): boolean {
  if (!isFloridaLeadingOnBoard(player)) return false;
  const uf = ufPctFromFc(player.ufProbability);
  if (uf < minUfPct) return false;
  return isNextCommitPick(player, 70);
}

