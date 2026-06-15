'use client';

import React from 'react';
import type { HeatCheckItem } from '@/lib/recruiting-api';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import { heatmapSparkPct } from '@/lib/vault-dashboard-api';
import { findPlayerInPool, schoolLogoInitials } from '@/lib/recruiting-hub-utils';
import { playerProfilePath } from '@/lib/player-routes';
import { playerPos } from '@/lib/recruiting-board-utils';
import { ensurePlayerSlug } from '@/lib/slug';
import { GV_COPY } from '@/lib/gatorvault-copy';

function heatRow(
  item: HeatCheckItem,
  pct: number,
  up: boolean,
  pool: RecruitingBoardPlayer[]
): React.ReactElement {
  const href = playerProfilePath(
    ensurePlayerSlug(item.playerSlug, item.playerName),
    'HIGH_SCHOOL',
    true,
    item.playerName,
    'recruiting'
  );
  const match = findPlayerInPool(item.playerSlug, item.playerName, pool);
  const pos = match ? playerPos(match) : '—';
  const schools = [
    { name: 'Florida', pct: up ? pct : Math.max(10, 100 - pct) },
    ...(item.predictionSchool
      ? [{ name: item.predictionSchool, pct: Math.max(10, 100 - pct) }]
      : []),
  ].slice(0, 2);

  return (
    <div key={`${item.playerName}-${item.recordedAt}`} className="gv-rh-heat__row">
      <div className="gv-rh-heat__row-main">
        <a href={href} className="gv-rh-heat__name">
          {item.playerName}
        </a>
        <span className="gv-rh-heat__pos">{pos}</span>
        <span
          className={`gv-rh-heat__arrow${up ? ' gv-rh-heat__arrow--up' : ' gv-rh-heat__arrow--down'}`}
          aria-hidden="true"
        >
          {up ? '▲' : '▼'}
        </span>
      </div>
      <div className="gv-rh-heat__schools">
        {schools.map((s) => (
          <span key={s.name} className="gv-rh-heat__school" title={s.name}>
            <span className="gv-rh-heat__school-logo">{schoolLogoInitials(s.name)}</span>
          </span>
        ))}
      </div>
      <div className="gv-rh-heat__bar-wrap">
        <div className="gv-rh-heat__bar">
          <div className="gv-rh-heat__bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

type Props = {
  rising: HeatCheckItem[];
  cooling: HeatCheckItem[];
  staff: StaffDashboardResponse | null;
  playerPool: RecruitingBoardPlayer[];
};

export function HeatCheckPanel({ rising, cooling, staff, playerPool }: Props): React.ReactElement {
  const sparkPct = staff ? heatmapSparkPct(staff.heatmap.buckets) : 0;
  const windowDays = staff?.movementWindowDays || 7;

  return (
    <div className="gv-rh-heat" data-testid="recruiting-heat-check">
      <div className="gv-rh-heat__panel gv-rh-heat__panel--up">
        <h2 className="gv-rh-heat__panel-title">Trending Up</h2>
        {rising.length === 0 && <p className="gv-rh-section-sub">No risers right now.</p>}
        {rising.map((item, i) => heatRow(item, Math.max(40, 95 - i * 8), true, playerPool))}
      </div>

      <div className="gv-rh-heat__panel gv-rh-heat__panel--down">
        <h2 className="gv-rh-heat__panel-title">Trending Down</h2>
        {cooling.length === 0 && <p className="gv-rh-section-sub">No cooling signals.</p>}
        {cooling.map((item, i) => heatRow(item, Math.max(35, 90 - i * 8), false, playerPool))}
      </div>

      <div className="gv-rh-heat__footer" style={{ gridColumn: '1 / -1' }}>
        <div className="gv-rh-heat__volatility">
          <div>
            <p className="gv-rh-heat__vol-label">{windowDays}-day volatility score</p>
            <div className="gv-rh-heat__vol-bar">
              <div className="gv-rh-heat__vol-fill" style={{ width: `${sparkPct}%` }} />
            </div>
          </div>
          <p className="gv-rh-heat__vol-value">{sparkPct}%</p>
        </div>
        <a
          href="/vault/futurecast/movement"
          className="gv-btn gv-btn--primary gv-rh-heat__cta"
        >
          {GV_COPY.microcopy.openMovementIntel}
        </a>
      </div>
    </div>
  );
}

/** @deprecated use HeatCheckPanel */
export const RecruitingHeatCheckPanel = HeatCheckPanel;
