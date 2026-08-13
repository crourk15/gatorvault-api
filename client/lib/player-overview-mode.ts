/**
 * Universal player Overview modes — one shell, lifecycle-owned Stand/Context.
 */
import type { PlayerCore, CollegeProfile, PortalProfile } from './player-api';
import type { PlayerMetrics } from './player-derived';
import { fitTierLabel } from './player-derived';
import { isUfCommit } from './player-profile-normalize';
import { isFloridaSchool, resolveCommittedTo } from './recruiting-target-filters';
import type { FullProfileCompetingSchool, FullProfileFuturecastSummary } from './player-full-profile-api';
import type { RosterPlayer } from './roster-api';

export type ProfileOverviewMode =
  | 'target'
  | 'commit'
  | 'committed_elsewhere'
  | 'portal'
  | 'college'
  | 'roster'
  | 'unknown';

export type OverviewMetric = { label: string; value: string };

export type OverviewStand = {
  eyebrow: string;
  headline: string;
  metrics: OverviewMetric[];
  note: string | null;
};

export type OverviewContextRow = {
  label: string;
  value: string;
  emphasize?: boolean;
};

export function resolveProfileOverviewMode(
  player: Pick<PlayerCore, 'status' | 'committedTo'>
): ProfileOverviewMode {
  const status = String(player.status || '').toUpperCase();
  if (status === 'PORTAL') return 'portal';
  if (isUfCommit(player)) return 'commit';
  const committedTo = resolveCommittedTo(player);
  if (committedTo && !isFloridaSchool(committedTo)) return 'committed_elsewhere';
  if (status === 'COLLEGE') return 'college';
  if (status === 'HS') return 'target';
  return 'unknown';
}

function firstSentence(text: string | null | undefined): string | null {
  const t = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return null;
  const m = t.match(/^(.{12,160}?[.!?])(?:\s|$)/);
  if (m?.[1]) return m[1].trim();
  if (t.length <= 160) return t;
  return `${t.slice(0, 157).trim()}…`;
}

function pctLabel(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(Number(n))) return null;
  return `${Math.round(Number(n))}%`;
}

function buildBoardLeaderLine(
  ufPct: number | null,
  competingSchools: FullProfileCompetingSchool[]
): { leader: string; leaderPct: number; ufPct: number | null } | null {
  const rows: { school: string; pct: number }[] = [];
  if (ufPct != null && ufPct > 0) rows.push({ school: 'Florida', pct: ufPct });
  for (const c of competingSchools) {
    if (c.pct != null && c.pct > 0) rows.push({ school: c.school, pct: c.pct });
  }
  if (!rows.length) return null;
  rows.sort((a, b) => b.pct - a.pct);
  return { leader: rows[0].school, leaderPct: rows[0].pct, ufPct };
}

export function buildRecruitingStand(input: {
  player: PlayerCore;
  metrics: PlayerMetrics;
  competingSchools: FullProfileCompetingSchool[];
  futurecastSummary: FullProfileFuturecastSummary | null;
  staffNote: string | null;
  evaluationNote: string | null;
}): OverviewStand {
  const mode = resolveProfileOverviewMode(input.player);
  // On3 Florida = live RPM only. Never treat unlabeled ufProbability / GV as market %.
  const on3Uf = input.futurecastSummary?.on3UfProbability ?? null;
  const gvUf = input.futurecastSummary?.gvProbability ?? null;
  // movementDelta is only attached for real On3/RPM history by the profile overlay.
  const delta = on3Uf != null ? input.futurecastSummary?.movementDelta ?? null : null;
  const marketSchools = input.competingSchools.filter(
    (c) => String((c as { source?: string }).source || '').toLowerCase() !== 'legacy'
  );
  const board = buildBoardLeaderLine(on3Uf, marketSchools);
  const staffTake = firstSentence(input.staffNote);
  const evalTake = firstSentence(input.evaluationNote);
  const metrics: OverviewMetric[] = [];

  if (input.metrics.ufFitScore > 0) {
    metrics.push({
      label: 'UF Fit',
      value: `${Math.round(input.metrics.ufFitScore)} · ${
        input.metrics.ufFitLabel ?? fitTierLabel(input.metrics.ufFitTier)
      }`,
    });
  }

  if (mode === 'commit') {
    if (gvUf != null) metrics.push({ label: 'GV model', value: pctLabel(gvUf) || '—' });
    return {
      eyebrow: 'Locked in',
      headline: staffTake || `Committed to Florida · Class of ${input.player.classYear}`,
      metrics,
      note: staffTake ? evalTake : null,
    };
  }

  if (mode === 'committed_elsewhere') {
    const school = resolveCommittedTo(input.player) || 'another program';
    return {
      eyebrow: 'Committed elsewhere',
      headline: staffTake || `Committed to ${school}`,
      metrics,
      note: null,
    };
  }

  if (mode === 'portal') {
    if (!input.metrics.portalHidden && input.metrics.portalLikelihoodPct != null) {
      metrics.push({
        label: 'Portal likelihood',
        value: `${input.metrics.portalLikelihoodPct}%`,
      });
    }
    const status = String(input.player.status || 'PORTAL');
    return {
      eyebrow: 'Portal watch',
      headline: staffTake || `Portal watch · ${status.replace(/_/g, ' ')}`,
      metrics,
      note: null,
    };
  }

  if (mode === 'college') {
    if (!input.metrics.portalHidden && input.metrics.portalLikelihoodPct != null) {
      metrics.push({
        label: 'Portal likelihood',
        value: `${input.metrics.portalLikelihoodPct}%`,
      });
    }
    return {
      eyebrow: 'On campus',
      headline: staffTake || 'College roster — Florida interest tracked when signals land',
      metrics,
      note: null,
    };
  }

  // target / unknown
  if (on3Uf != null) metrics.push({ label: 'On3 Florida', value: pctLabel(on3Uf) || '—' });
  if (gvUf != null) metrics.push({ label: 'GV model', value: pctLabel(gvUf) || '—' });

  let headline: string;
  if (staffTake) {
    headline = staffTake;
  } else if (board) {
    if (/^florida$/i.test(board.leader)) {
      headline = `Florida leads the board at ${Math.round(board.leaderPct)}%`;
    } else if (board.ufPct != null && board.ufPct > 0) {
      headline = `${board.leader} leads at ${Math.round(board.leaderPct)}% · Florida at ${Math.round(board.ufPct)}%`;
    } else {
      headline = `${board.leader} leads at ${Math.round(board.leaderPct)}%`;
    }
  } else if (delta != null && Math.abs(delta) >= 1) {
    headline =
      delta > 0
        ? `Florida momentum up ${Math.round(delta)} pts recently`
        : `Florida momentum down ${Math.abs(Math.round(delta))} pts recently`;
  } else if (input.metrics.ufFitScore > 0) {
    headline = `Florida fit rates ${fitTierLabel(input.metrics.ufFitTier).toLowerCase()} on this board`;
  } else {
    headline = 'Limited Florida intel on file — check back as signals land';
  }

  return {
    eyebrow: 'Board picture',
    headline,
    metrics,
    note: staffTake ? evalTake : null,
  };
}

export function buildRecruitingContext(input: {
  mode: ProfileOverviewMode;
  player: PlayerCore;
  collegeProfile: CollegeProfile | null;
  portalProfile: PortalProfile | null;
  competingSchools: FullProfileCompetingSchool[];
  futurecastSummary: FullProfileFuturecastSummary | null;
}): { title: string; rows: OverviewContextRow[]; empty: string | null } | null {
  const { mode, player, collegeProfile, portalProfile, competingSchools, futurecastSummary } = input;

  if (mode === 'target' || mode === 'unknown') {
    const ufPct = futurecastSummary?.on3UfProbability ?? null;
    const rows: OverviewContextRow[] = [];
    if (ufPct != null && ufPct > 0) {
      rows.push({ label: 'Florida', value: `${Math.round(ufPct)}%`, emphasize: true });
    }
    for (const c of competingSchools) {
      if (c.pct == null || c.pct <= 0) continue;
      if (String((c as { source?: string }).source || '').toLowerCase() === 'legacy') continue;
      rows.push({
        label: c.school,
        value: `${Math.round(c.pct)}%`,
        emphasize: false,
      });
    }
    rows.sort((a, b) => Number(b.value.replace('%', '')) - Number(a.value.replace('%', '')));
    const top = rows.slice(0, 3);
    if (!top.length) {
      return {
        title: 'The field',
        rows: [],
        empty: 'No public board percentages yet',
      };
    }
    return { title: 'The field', rows: top, empty: null };
  }

  if (mode === 'commit') {
    return {
      title: 'Commit details',
      rows: [
        { label: 'School', value: 'Florida', emphasize: true },
        { label: 'Class', value: String(player.classYear), emphasize: false },
        ...(player.highSchool
          ? [{ label: 'High school', value: player.highSchool, emphasize: false }]
          : []),
      ],
      empty: null,
    };
  }

  if (mode === 'committed_elsewhere') {
    return {
      title: 'Context',
      rows: [
        {
          label: 'Committed to',
          value: resolveCommittedTo(player) || '—',
          emphasize: true,
        },
        { label: 'Class', value: String(player.classYear), emphasize: false },
      ],
      empty: null,
    };
  }

  if (mode === 'portal') {
    const rows: OverviewContextRow[] = [];
    if (portalProfile?.portalStatus) {
      rows.push({
        label: 'Status',
        value: portalProfile.portalStatus.replace(/_/g, ' '),
        emphasize: true,
      });
    }
    if (portalProfile?.previousSchool || collegeProfile?.college) {
      rows.push({
        label: 'From',
        value: portalProfile?.previousSchool || collegeProfile?.college || '—',
        emphasize: false,
      });
    }
    if (portalProfile?.destinationSchool) {
      rows.push({
        label: 'Destination',
        value: portalProfile.destinationSchool,
        emphasize: false,
      });
    }
    if (!rows.length) {
      return { title: 'Context', rows: [], empty: 'Portal details coming soon' };
    }
    return { title: 'Context', rows, empty: null };
  }

  if (mode === 'college') {
    const rows: OverviewContextRow[] = [];
    if (collegeProfile?.college) {
      rows.push({ label: 'College', value: collegeProfile.college, emphasize: true });
    }
    if (collegeProfile?.yearsPlayed != null) {
      rows.push({
        label: 'Years played',
        value: String(collegeProfile.yearsPlayed),
        emphasize: false,
      });
    }
    if (!rows.length) {
      return { title: 'Context', rows: [], empty: 'College details coming soon' };
    }
    return { title: 'Context', rows, empty: null };
  }

  return null;
}

/**
 * Roster Stand: one Florida take + up to two metrics not already in the header.
 * Stars/jersey/class/pos belong in Who or the hero — do not repeat them here.
 */
export function buildRosterStand(player: RosterPlayer): OverviewStand {
  const pos = player.pos || player.position || 'player';
  const tier = player.depthChartTier?.trim() || null;
  const take = firstSentence(player.bio);
  const metrics: OverviewMetric[] = [];
  if (player.vaultGrade != null) {
    metrics.push({ label: 'Vault grade', value: String(player.vaultGrade) });
  }

  if (take) {
    return {
      eyebrow: 'On the roster',
      headline: take,
      metrics: metrics.slice(0, 2),
      note: tier ? `${tier} on the Florida depth chart` : null,
    };
  }

  return {
    eyebrow: 'On the roster',
    headline: tier
      ? `${tier} ${pos} on the Florida depth chart`
      : `Florida roster · ${pos}`,
    metrics: metrics.slice(0, 2),
    note: null,
  };
}

/**
 * Roster Context: only facts not already in the header / Who.
 * Hide the slot entirely when there is nothing unique to say.
 */
export function buildRosterContext(player: RosterPlayer): {
  title: string;
  rows: OverviewContextRow[];
  empty: string | null;
} | null {
  const rows: OverviewContextRow[] = [];
  const pathInfo = player.transferInfo?.trim();
  if (pathInfo) {
    rows.push({ label: 'Path', value: pathInfo, emphasize: true });
  }
  if (!rows.length) return null;
  return { title: 'Context', rows, empty: null };
}

export function shouldShowFutureCastPicks(mode: ProfileOverviewMode): boolean {
  return mode === 'target' || mode === 'portal' || mode === 'college' || mode === 'unknown';
}
