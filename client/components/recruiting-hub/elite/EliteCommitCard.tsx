'use client';

import React from 'react';
import type { RhHubCommit } from '@/lib/recruiting-hub-elite-api';

type Props = {
  commit: RhHubCommit;
  year: number;
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }): React.ReactElement | null {
  if (value == null || value === '' || value === '—') return null;
  return (
    <div className="rh-elite-commit-detail">
      <span className="rh-elite-commit-detail__label">{label}</span>
      <span className="rh-elite-commit-detail__value">{value}</span>
    </div>
  );
}

export function EliteCommitCard({ commit, year }: Props): React.ReactElement {
  const isActive = year >= 2027;

  return (
    <article className="rh-commit-card rh-elite-commit-card">
      <div className="rh-commit-header">
        <div>
          <a href={commit.profileUrl} className="rh-commit-name">
            {commit.name}
          </a>
          <div className="rh-commit-pos">{commit.position}</div>
        </div>
        {commit.statusBadge ? <span className="rh-badge">{commit.statusBadge}</span> : null}
      </div>
      <div className="rh-commit-body">{commit.rankNote}</div>

      {isActive ? (
        <>
          <DetailRow label="Stability" value={commit.stabilityMeter} />
          <DetailRow label="UF %" value={commit.ufPercent} />
          <DetailRow label="Movement" value={commit.movement} />
          <DetailRow label="Projection" value={commit.projection} />
          <DetailRow label="Insider intel" value={commit.insiderIntel} />
        </>
      ) : (
        <>
          <DetailRow label="Jersey" value={commit.jerseyNumber ?? 'TBA'} />
          <DetailRow label="Position room fit" value={commit.positionRoomFit} />
          <DetailRow label="Early impact" value={commit.earlyImpactProjection} />
        </>
      )}

      <DetailRow label="Strengths" value={commit.strengths} />
      <DetailRow label="Weaknesses" value={commit.weaknesses} />
      <DetailRow label="Player comp" value={commit.playerComp} />
      <DetailRow label="GatorVault Grade" value={commit.gvGrade} />
      <DetailRow label="NIL estimate" value={commit.nilEstimate} />

      <div className="rh-commit-footer">
        <span>Rating {commit.rating}</span>
        <span>Committed {commit.commitDate}</span>
      </div>
    </article>
  );
}
