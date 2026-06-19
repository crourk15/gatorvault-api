'use client';

import React, { useEffect, useState } from 'react';
import { fetchRecruitingBoard } from '@/lib/recruiting-board-api';
import { TeamPremiumModule } from './TeamPremiumModule';
import { PipelineMap } from './PipelineMap';
import { PipelineCommitsList } from './PipelineCommitsList';
import { PipelineTargetsList } from './PipelineTargetsList';
import { PipelineMetricsRow } from './PipelineMetricsRow';
import { buildPipelinePreview } from './team-premium-metrics';

export function TeamRecruitingPipelineSection(): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(() => buildPipelinePreview(null));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const board = await fetchRecruitingBoard(2027);
        if (!cancelled) setData(buildPipelinePreview(board));
      } catch {
        /* keep fallback preview */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="team-premium-section" id="recruiting-pipeline" data-section="recruiting-pipeline">
      <TeamPremiumModule
        title="Recruiting Pipeline"
        subtitle="2027 class — commits, targets, and state footprint"
        stamp={loading ? 'Loading…' : '2027 Board'}
      >
        <PipelineMetricsRow
          avgFitScore={data.avgFitScore}
          avgFutureCastProb={data.avgFutureCastProb}
        />
        <div className="team-pipeline-layout">
          <PipelineMap states={data.stateCounts} />
          <div className="team-pipeline-layout__lists">
            <PipelineCommitsList commits={data.topCommits} />
            <PipelineTargetsList targets={data.topTargets} />
          </div>
        </div>
      </TeamPremiumModule>
    </div>
  );
}
