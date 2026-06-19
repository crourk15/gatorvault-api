'use client';

import React from 'react';
import type { PortalSnapshotData } from './team-premium-types';

type Props = {
  data: PortalSnapshotData;
};

export function PortalSnapshotModule({ data }: Props): React.ReactElement {
  return (
    <div className="team-portal-snapshot">
      <article className="team-portal-snapshot__card team-portal-snapshot__card--gain">
        <span className="team-portal-snapshot__label">Additions</span>
        <span className="team-portal-snapshot__value">{data.additions.count}</span>
        <span className="team-portal-snapshot__meta">NIL {data.additions.nilRange}</span>
      </article>
      <article className="team-portal-snapshot__card team-portal-snapshot__card--loss">
        <span className="team-portal-snapshot__label">Losses</span>
        <span className="team-portal-snapshot__value">{data.losses.count}</span>
        <span className="team-portal-snapshot__meta">NIL {data.losses.nilRange}</span>
      </article>
      <article className="team-portal-snapshot__card">
        <span className="team-portal-snapshot__label">Net Impact Score</span>
        <span className="team-portal-snapshot__value team-portal-snapshot__value--positive">
          +{data.netImpact.toFixed(1)}
        </span>
      </article>
      <article className="team-portal-snapshot__card">
        <span className="team-portal-snapshot__label">Position Strength Change</span>
        <span className="team-portal-snapshot__meta team-portal-snapshot__meta--wide">{data.positionStrength}</span>
      </article>
    </div>
  );
}
