/**
 * College profile tab.
 */
import React from 'react';
import type { CollegeProfile } from '../../../lib/player-api';
import { depthChartTier, snapSharePercent } from '../../../lib/player-derived';

export interface CollegeTabProps {
  profile: CollegeProfile | null;
}

function statEntries(stats: Record<string, unknown>): [string, string][] {
  const groups = ['passing', 'rushing', 'receiving', 'defense', 'defensive'];
  const out: [string, string][] = [];

  for (const [key, val] of Object.entries(stats)) {
    if (val == null || val === '') continue;
    if (typeof val === 'object' && !Array.isArray(val)) {
      for (const [sub, subVal] of Object.entries(val as Record<string, unknown>)) {
        if (subVal != null && subVal !== '') out.push([`${key} ${sub}`, String(subVal)]);
      }
    } else {
      out.push([key.replace(/_/g, ' '), String(val)]);
    }
  }

  if (!out.length && groups.some((g) => stats[g])) {
    for (const g of groups) {
      const block = stats[g] as Record<string, unknown> | undefined;
      if (!block) continue;
      for (const [k, v] of Object.entries(block)) {
        if (v != null) out.push([`${g} ${k}`, String(v)]);
      }
    }
  }

  return out.slice(0, 24);
}

export function CollegeTab({ profile }: CollegeTabProps): React.ReactElement {
  if (!profile) {
    return <p className="fc-profile-empty">No college profile on file.</p>;
  }

  const snapShare = snapSharePercent(profile);
  const tier = depthChartTier(profile);
  const stats = profile.stats ?? {};
  const statRows = statEntries(stats);

  return (
    <div className="fc-profile-panel" data-testid="tab-college">
      <section className="fc-profile-section">
        <h2>Program</h2>
        <dl className="fc-profile-dl">
          <div><dt>College</dt><dd>{profile.college}</dd></div>
          {profile.yearsPlayed != null && <div><dt>Years</dt><dd>{profile.yearsPlayed}</dd></div>}
          {profile.gamesPlayed != null && <div><dt>Games</dt><dd>{profile.gamesPlayed}</dd></div>}
          {snapShare != null && <div><dt>Snap Share</dt><dd>{snapShare}%</dd></div>}
          {tier && <div><dt>Depth Chart Tier</dt><dd>{tier}</dd></div>}
        </dl>
      </section>

      {profile.depthHistory.length > 0 && (
        <section className="fc-profile-section">
          <h2>Depth Chart History</h2>
          <ul className="fc-depth-list">
            {profile.depthHistory.map((entry, i) => (
              <li key={i}>
                {typeof entry === 'object' && entry !== null
                  ? JSON.stringify(entry).replace(/[{}"]/g, '').replace(/,/g, ' · ')
                  : String(entry)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {statRows.length > 0 && (
        <section className="fc-profile-section">
          <h2>Stats</h2>
          <dl className="fc-profile-dl">
            {statRows.map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        </section>
      )}

      {stats.injury_notes != null && (
        <section className="fc-profile-section">
          <h2>Injury Notes</h2>
          <p>{String(stats.injury_notes ?? stats.injuryNotes)}</p>
        </section>
      )}
    </div>
  );
}
