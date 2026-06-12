/** Top Targets tab — links to UF Fit Watchlist API-backed page */
import React from 'react';
import { UfFitWatchlistGrid } from '../../../components/futurecast/UfFitWatchlistGrid';

export interface TopTargetsTabProps {
  classYear?: number;
}

export default function TopTargetsTab({ classYear = 2026 }: TopTargetsTabProps): React.ReactElement {
  return (
    <div data-testid="tab-top-targets">
      <p style={{ marginBottom: '0.75rem' }}>
        <a href="/futurecast/uf-fit-watchlist" style={{ color: '#fa4616', fontWeight: 600 }}>
          Open full UF Fit Watchlist →
        </a>
      </p>
      <UfFitWatchlistGrid
        query={{ class_year: classYear, sort: 'ufFitScore', minScore: 70, limit: 100 }}
      />
    </div>
  );
}
