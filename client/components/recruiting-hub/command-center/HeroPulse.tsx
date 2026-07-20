'use client';

import React, { useMemo } from 'react';
import type { HeatCheckItem } from '@/lib/recruiting-api';
import type { RecruitingBoardPlayer, RecruitingBoardResponse } from '@/lib/recruiting-board-api';
import type { MovementSummary } from '@/lib/recruiting-movement-api';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import type { HighPriorityIntelItem } from '@/components/recruiting-hub/HighPriorityIntel/types';
import { formatIntelUpdated } from '@/components/recruiting-hub/utils/formatDate';
import {
  buildIntelFeedItem,
  dedupeIntelFeedItems,
  formatIntelTimestamp,
} from '@/lib/recruiting-intel-feed';
import { UFProbabilityMeter } from './UFProbabilityMeter';
import { ufPctFromRaw } from './primitives';

type Props = {
  rankings: RecruitingBoardResponse['rankings'];
  targets: RecruitingBoardPlayer[];
  movementSummary: MovementSummary | null;
  staffDashboard: StaffDashboardResponse | null;
  intelItems: HighPriorityIntelItem[];
  rising: HeatCheckItem[];
  cooling: HeatCheckItem[];
  lastUpdated?: string | null;
};

function blueChipPct(players: RecruitingBoardPlayer[]): string {
  if (!players.length) return '—';
  const chips = players.filter((p) => (Number(p.stars) || 0) >= 4).length;
  return `${Math.round((chips / players.length) * 100)}%`;
}

function avgRating(players: RecruitingBoardPlayer[]): string {
  const rated = players.filter((p) => p.rating != null && Number(p.rating) > 0);
  if (!rated.length) return '—';
  return (rated.reduce((a, p) => a + Number(p.rating), 0) / rated.length).toFixed(4);
}

function movementDelta(player: RecruitingBoardPlayer): number {
  if (player.movementDirection === 'up') return 3;
  if (player.movementDirection === 'down') return -3;
  return 0;
}

export function HeroPulse({
  rankings,
  targets,
  movementSummary,
  staffDashboard,
  intelItems,
  rising,
  cooling,
  lastUpdated,
}: Props): React.ReactElement {
  const avgUfProb = useMemo(() => {
    const withProb = targets.filter((p) => p.ufProbability != null);
    if (!withProb.length) return 0;
    const sum = withProb.reduce((acc, p) => acc + ufPctFromRaw(p.ufProbability), 0);
    return Math.round(sum / withProb.length);
  }, [targets]);

  const avgDelta = useMemo(() => {
    if (!targets.length) return 0;
    const sum = targets.reduce((acc, p) => acc + movementDelta(p), 0);
    return Math.round(sum / targets.length);
  }, [targets]);

  const alerts = useMemo(() => {
    const raw = [];

    for (const alert of staffDashboard?.alerts ?? []) {
      const category =
        alert.type === 'VISIT' ? 'Visit' : alert.type === 'OFFER' ? 'Offer' : 'Movement';
      raw.push(
        buildIntelFeedItem({
          id: `staff-${alert.playerName}-${alert.message}`,
          playerName: alert.playerName,
          headline: `${alert.playerName}: ${alert.message}`,
          timestamp: alert.createdAt || lastUpdated,
          category,
          volatile: alert.type !== 'VISIT' && alert.type !== 'OFFER' && /volatile|spike/i.test(alert.message),
        })
      );
    }

    for (const item of intelItems) {
      raw.push(
        buildIntelFeedItem({
          id: `intel-${item.slug}-${item.intelSummary}`,
          playerName: item.name,
          headline: `${item.name}: ${item.intelSummary}`,
          timestamp: lastUpdated,
          category:
            item.intelType === 'VISIT'
              ? 'Visit'
              : item.intelType === 'RPM'
                ? 'Offer'
                : item.intelType === 'BATTLE'
                  ? 'Movement'
                  : 'Update',
          volatile: item.intelType === 'BATTLE',
        })
      );
    }

    if (movementSummary && movementSummary.volatile > 0) {
      raw.push(
        buildIntelFeedItem({
          id: 'movement-volatile-summary',
          headline: `UF volatility spike on ${movementSummary.volatile} targets`,
          timestamp: movementSummary.lastUpdated,
          category: 'Movement',
          volatile: true,
        })
      );
    }

    for (const item of rising.slice(0, 2)) {
      raw.push(
        buildIntelFeedItem({
          id: `rising-${item.playerSlug || item.playerName}`,
          playerName: item.playerName,
          headline: `${item.playerName} heating up on the UF board`,
          timestamp: lastUpdated,
          category: 'Movement',
        })
      );
    }

    return dedupeIntelFeedItems(raw, 6);
  }, [staffDashboard?.alerts, intelItems, movementSummary, rising, lastUpdated]);

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
            <p className="rh-cc-hero__eyebrow">Florida Recruiting</p>
            <h1 className="rh-cc-hero__title">Who Florida is chasing</h1>
            <p className="rh-cc-hero__sub">
              Movement, beat intel, and the board — the story of this class.
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
                <strong className="rh-cc-hero__metric-value">{blueChipPct(targets)}</strong>
              </div>
              <div className="rh-cc-hero__metric">
                <span className="rh-cc-hero__metric-label">Avg Rating</span>
                <strong className="rh-cc-hero__metric-value">{avgRating(targets)}</strong>
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
                alerts.map((alert) => (
                  <li key={alert.id} className="rh-cc-hero__alert rh-cc-hero__alert--card">
                    <span className="rh-cc-hero__alert-icon" aria-hidden>
                      {alert.icon}
                    </span>
                    <div className="rh-cc-hero__alert-body">
                      <span className="rh-cc-hero__alert-text">{alert.headline}</span>
                      <span className="rh-cc-hero__alert-meta">
                        {alert.category} · {formatIntelTimestamp(alert.timestamp)}
                      </span>
                    </div>
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
