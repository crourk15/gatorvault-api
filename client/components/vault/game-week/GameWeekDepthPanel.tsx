'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { DepthChartGrid } from '@/components/team/DepthChartGrid';
import { DepthChartTabs } from '@/components/team/DepthChartTabs';
import {
  fallbackDepthChartBoard,
  fetchDepthChartBoard,
  type DepthChartBoard,
} from '@/lib/depth-chart-api';
import type { DepthChartTab } from '@/lib/team-hub-types';

function positionsForTab(board: DepthChartBoard, tab: DepthChartTab) {
  if (tab === 'defense') return board.depthChart.defense;
  if (tab === 'specialTeams') return board.depthChart.specialTeams;
  return board.depthChart.offense;
}

/**
 * Official two-deep inside Game Week — same board as Team hub.
 * Replaces the placeholder QB/WR/OL column dump.
 */
export function GameWeekDepthPanel(): React.ReactElement {
  const [tab, setTab] = useState<DepthChartTab>('offense');
  const [board, setBoard] = useState<DepthChartBoard>(() => fallbackDepthChartBoard());

  useEffect(() => {
    let cancelled = false;
    fetchDepthChartBoard()
      .then((live) => {
        if (!cancelled) setBoard(live);
      })
      .catch(() => {
        /* keep fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const positions = useMemo(() => positionsForTab(board, tab), [board, tab]);
  const dek = board.subtitle || board.label || 'Official two-deep.';

  return (
    <div className="gv-gw-depth-elite" data-testid="gw-depth-chart">
      <p className="gv-gw-depth-elite__dek">{dek}</p>
      <div className="gv-gw-depth-elite__legend" aria-label="Depth status key">
        <span className="gv-gw-depth-elite__pill gv-gw-depth-elite__pill--locked">Locked</span>
        <span className="gv-gw-depth-elite__pill gv-gw-depth-elite__pill--battle">Battle</span>
        <span className="gv-gw-depth-elite__pill gv-gw-depth-elite__pill--watch">Watch</span>
      </div>
      <DepthChartTabs active={tab} onChange={setTab} />
      <DepthChartGrid positions={positions} />
    </div>
  );
}
