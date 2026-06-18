'use client';

import React, { useMemo } from 'react';
import type { HeatCheckItem } from '@/lib/recruiting-api';
import type { RecruitingBoardResponse } from '@/lib/recruiting-board-api';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import type { MovementSummary } from '@/lib/recruiting-movement-api';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import type { HighPriorityIntelItem } from '@/components/recruiting-hub/HighPriorityIntel/types';
import { formatIntelUpdated } from '@/components/recruiting-hub/utils/formatDate';
import { UFProbabilityMeter } from './UFProbabilityMeter';
import { ufPctFromRaw } from './primitives';

type Props = {
  rankings: RecruitingBoardResponse['rankings'];
  highPriority: HighPriorityPlayer[];
  movementSummary: MovementSummary | null;
  staffDashboard: StaffDashboardResponse | null;
  intelItems: HighPriorityIntelItem[];
  rising: HeatCheckItem[];
  cooling: HeatCheckItem[];
  lastUpdated?: string | null;
};

function blueChipPct(players: HighPriorityPlayer[]): string {
  if (!players.length) return '—';
  const chips = players.filter((p) => (Number(p.stars) || 0) >= 4).length;
  return `${Math.round((chips / players.length) * 100)}%`;
}

function avgRating(players: HighPriorityPlayer[]): string {
  const rated = players.filter((p) => p.rating != null && Number(p.rating) > 0);
  if (!rated.length) return '—';
  return (rated.reduce((a, p) => a + Number(p.rating), 0) / rated.length).toFixed(4);
}

export function HeroPulse({
  rankings,
  highPriority,
  movementSummary,
  staffDashboard,
  intelItems,
  rising,
  cooling,
  lastUpdated,
}: Props): React.ReactElement {
  const avgUfProb = useMemo(() => {
    if (!highPriority.length) return 0;
    const sum = highPriority.reduce((acc, p) => acc + ufPctFromRaw(p.ufProbability), 0);
    return Math.round(sum / highPriority.length);
  }, [highPriority]);

  const avgDelta = useMemo(() => {
    if (!highPriority.length) return 0;
    const sum = highPriority.reduce(
      (acc, p) => acc + (p.delta7d ?? p.movementDelta ?? 0),
      0
    );
    return Math.round(sum / highPriority.length);
  }, [highPriority]);

  const alerts = useMemo(() => {
    const fromStaff = (staffDashboard?.alerts ?? []).slice(0, 3).map((a) => ({
      icon: a.type === 'VISIT' ? '📍' : a.type === 'OFFER' ? '🎯' : '⚠️',
      text: `${a.playerName}: ${a.message}`,
    }));
    if (fromStaff.length >= 3) return fromStaff;
    const fromIntel = intelItems.slice(0, 3 - fromStaff.length).map((item) => ({
      icon: item.intelType === 'VISIT' ? '📍' : item.intelType === 'RPM' ? '🎯' : '⚠️',
      text: item.intelSummary,
    }));
    return [...fromStaff, ...fromIntel];
  }, [staffDashboard?.alerts, intelItems]);

  const movementLine = useMemo(() => {
    const r = movementSummary?.rising ?? rising.length;
    const f = movementSummary?.falling ?? cooling.length;
    const v = movementSummary?.volatile ?? 0;
    return `UF trending up on ${r} targets, down on ${f}, volatile on ${v}.`;
  }, [movementSummary, rising.length, cooling.length]);

  const updatedLabel = lastUpdated
    ? formatIntelUpdated(lastUpdated)
    : movementSummary?.lastUpdated
      ? formatIntelUpdated(movementSummary.lastUpdated)
      : null;

  return (
    <section className="rh-cc-hero" data-testid="rh-cc-hero-pulse">
      <div className="rh-cc-hero__bg" aria-hidden />
      <div className="rh-cc-hero__inner rh-frame">
        <div className="rh-cc-hero__grid">
          <div className="rh-cc-hero__col rh-cc-hero__col--pulse">
            <p className="rh-cc-hero__eyebrow">UF Recruiting Command Center</p>
            <h1 className="rh-cc-hero__title">UF Recruiting Pulse — 2027 Class</h1>
            <p className="rh-cc-hero__sub">
              Live intel, movement, and FutureCast for UF targets.
            </p>
            <div className="rh-cc-hero__metrics">
              <div className="rh-cc-hero__metric rh-cc-hero__metric--rank">
                <span className="rh-cc-hero__metric-label">Class Rank</span>
                <strong className="rh-cc-hero__metric-value">
                  {rankings?.nationalRank != null ? `#${rankings.nationalRank}` : '—'}
                </strong>
              </div>
              <div className="rh-cc-hero__metric">
                <span className="rh-cc-hero__metric-label">Blue Chip %</span>
                <strong className="rh-cc-hero__metric-value">{blueChipPct(highPriority)}</strong>
              </div>
              <div className="rh-cc-hero__metric">
                <span className="rh-cc-hero__metric-label">Avg Rating</span>
                <strong className="rh-cc-hero__metric-value">{avgRating(highPriority)}</strong>
              </div>
              <div className="rh-cc-hero__metric">
                <span className="rh-cc-hero__metric-label">Total Points</span>
                <strong className="rh-cc-hero__metric-value">
                  {rankings?.classScore != null ? Number(rankings.classScore).toFixed(1) : '—'}
                  <span className="rh-cc-hero__trend" aria-hidden>
                    {avgDelta >= 0 ? ' ↑' : ' ↓'}
                  </span>
                </strong>
              </div>
            </div>
            {updatedLabel ? (
              <p className="rh-cc-hero__updated">Last updated: {updatedLabel}</p>
            ) : null}
          </div>

          <div className="rh-cc-hero__col rh-cc-hero__col--meter">
            <UFProbabilityMeter value={avgUfProb} delta7d={avgDelta} />
          </div>

          <div className="rh-cc-hero__col rh-cc-hero__col--alerts">
            <h2 className="rh-cc-hero__panel-title">Movement Summary</h2>
            <p className="rh-cc-hero__movement-line">{movementLine}</p>
            <h3 className="rh-cc-hero__alerts-title">Live Alerts</h3>
            <ul className="rh-cc-hero__alerts">
              {alerts.length === 0 ? (
                <li className="rh-cc-hero__alert">No live alerts yet — monitoring targets.</li>
              ) : (
                alerts.map((alert, i) => (
                  <li key={`${alert.text}-${i}`} className="rh-cc-hero__alert">
                    <span aria-hidden>{alert.icon}</span> {alert.text}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
