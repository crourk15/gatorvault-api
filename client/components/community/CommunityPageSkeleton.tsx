'use client';

import React from 'react';

export function CommunityPageSkeleton(): React.ReactElement {
  return (
    <div className="gv-community__skeleton" aria-hidden="true">
      <div className="gv-community__skeleton-row gv-community__skeleton-row--wide" />
      <div className="gv-community__skeleton-row" />
      <div className="gv-community__skeleton-row" />
      <div className="gv-community__skeleton-row gv-community__skeleton-row--short" />
    </div>
  );
}

export function CommunityThreadSkeleton(): React.ReactElement {
  return (
    <div className="gv-community__skeleton gv-community__skeleton--thread" aria-hidden="true">
      <div className="gv-community__skeleton-row gv-community__skeleton-row--wide" />
      <div className="gv-community__skeleton-row" />
      <div className="gv-community__skeleton-row gv-community__skeleton-row--short" />
    </div>
  );
}
