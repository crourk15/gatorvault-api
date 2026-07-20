'use client';

import React from 'react';
import { GatorVaultWordmark } from '@/components/brand/GatorVaultWordmark';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import type { RecruitingBoardResponse } from '@/lib/recruiting-board-api';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import { computeMomentumPct, heatmapSparkPct } from '@/lib/vault-home-api';
import { momentumTrend } from '@/lib/recruiting-hub-utils';
import { playerProfilePath } from '@/lib/player-routes';
import { playerPos } from '@/lib/recruiting-board-utils';
import { ensurePlayerSlug } from '@/lib/slug';
import { ClassSummaryStats } from '@/components/vault/recruiting/RecruitingClassSummary';

type Props = {
  momentumPct: number;
  staff: StaffDashboardResponse | null;
  nextTargets: RecruitingBoardPlayer[];
  commits: RecruitingBoardPlayer[];
  rankings: RecruitingBoardResponse['rankings'];
  compareRankings?: RecruitingBoardResponse['rankings'];
  classYear?: number;
  priorClassYear?: number;
};

export function RecruitingHubHero({
  momentumPct,
  staff,
  nextTargets,
  commits,
  rankings,
  compareRankings,
  classYear = 2027,
  priorClassYear = 2026,
}: Props): React.ReactElement {
  const sparkPct = staff ? heatmapSparkPct(staff.heatmap.buckets) : 0;
  const bars = 7;
  const hotBars = Math.round((sparkPct / 100) * bars);
  const windowDays = staff?.movementWindowDays || 7;
  const trend = momentumTrend(momentumPct);

  return (
    <section
      className="gv-rh-hero gv-texture-stadium-lights gv-texture-swamp-mist"
      aria-label="Florida Recruiting"
    >
      <div className="gv-rh-hero__bg" aria-hidden="true" />
      <div className="gv-rh-hero__inner gv-rh-hub__frame">
        <div className="gv-rh-hero__header">
          <GatorVaultWordmark height={32} className="gv-rh-hero__wordmark" />
          <h1 className="gv-rh-hero__title">Florida Recruiting</h1>
          <p className="gv-rh-hero__subtitle">
            Who Florida is chasing — movement, board, and beat intel.
          </p>
        </div>

        <div className="gv-rh-hero__row gv-rh-hero__row--stats">
          <ClassSummaryStats
            inline
            commits={commits}
            rankings={rankings}
            classYear={classYear}
            priorClassYear={priorClassYear}
            compareRankings={compareRankings}
          />
        </div>

        <div className="gv-rh-hero__row gv-rh-hero__row--widgets">
          <div className="gv-rh-hero__widgets">
            <div className="gv-rh-hero__widget">
              <p className="gv-rh-hero__widget-label">Recruiting Momentum</p>
              <p className="gv-rh-hero__widget-value">
                {momentumPct}%
                {trend === 'up' && (
                  <span className="gv-rh-hero__trend gv-rh-hero__trend--up" aria-label="Trending up">
                    ↑
                  </span>
                )}
                {trend === 'down' && (
                  <span className="gv-rh-hero__trend gv-rh-hero__trend--down" aria-label="Trending down">
                    ↓
                  </span>
                )}
              </p>
              <div className="gv-rh-hero__meter" aria-hidden="true">
                <div
                  className="gv-rh-hero__meter-fill"
                  style={{ width: `${Math.min(100, momentumPct)}%` }}
                />
              </div>
            </div>

            <div className="gv-rh-hero__widget gv-rh-hero__next-commit">
              <p className="gv-rh-hero__widget-label">Next Commit Watch</p>
              {nextTargets.length === 0 ? (
                <p className="gv-rh-hero__widget-value">—</p>
              ) : (
                <ul className="gv-rh-hero__watch-list">
                  {nextTargets.slice(0, 3).map((t) => {
                    const href = playerProfilePath(
                      ensurePlayerSlug(t.slug, t.name),
                      'HIGH_SCHOOL',
                      true,
                      t.name,
                      'recruiting'
                    );
                    const conf =
                      t.ufProbability != null
                        ? `${Math.round(Number(t.ufProbability) * 100)}%`
                        : '—';
                    return (
                      <li key={t.slug}>
                        <a href={href}>{t.name}</a>
                        <span className="gv-rh-hero__watch-meta">
                          {playerPos(t)} · {conf}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="gv-rh-hero__widget">
              <p className="gv-rh-hero__widget-label">Who&apos;s heating up</p>
              <p className="gv-rh-hero__widget-value">{sparkPct}% volatility</p>
              <div className="gv-rh-hero__sparkline" aria-label={`${windowDays}-day volatility`}>
                {Array.from({ length: bars }, (_, i) => (
                  <div
                    key={i}
                    className={`gv-rh-hero__spark-bar${i < hotBars ? ' is-hot' : ''}`}
                    style={{ height: `${28 + (i % 4) * 16}%` }}
                  />
                ))}
              </div>
              <p className="gv-rh-hero__widget-sub">Last {windowDays} days</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function computeHubMomentum(
  staff: StaffDashboardResponse | null,
  classScore: number | null | undefined
): number {
  return computeMomentumPct(staff?.heatmap, classScore);
}
