/**
 * High School profile tab.
 */
import React from 'react';
import type { HighSchoolProfile, PlayerCore } from '../../../lib/player-api';
import { formatHeight, formatWeight } from '../../../lib/player-derived';

export interface HighSchoolTabProps {
  player: PlayerCore;
  profile: HighSchoolProfile | null;
}

function filmLinks(stats: Record<string, unknown>): { label: string; url: string }[] {
  const links: { label: string; url: string }[] = [];
  const hudl = stats.hudl ?? stats.hudl_url ?? stats.hudlUrl;
  const youtube = stats.youtube ?? stats.youtube_url ?? stats.youtubeUrl ?? stats.film;
  if (typeof hudl === 'string' && hudl.startsWith('http')) links.push({ label: 'HUDL', url: hudl });
  if (typeof youtube === 'string' && youtube.startsWith('http')) links.push({ label: 'YouTube', url: youtube });
  return links;
}

export function HighSchoolTab({ player, profile }: HighSchoolTabProps): React.ReactElement {
  if (!profile) {
    return <p className="fc-profile-empty">No high school profile on file.</p>;
  }

  const stats = profile.stats ?? {};
  const stars = player.stars ?? stats.stars;
  const natl = player.rankingNational ?? stats.natl_rank ?? stats.national_rank;
  const pos = player.rankingPosition ?? stats.pos_rank ?? stats.position_rank;
  const stateRank = player.rankingState ?? stats.state_rank;
  const films = filmLinks(stats);
  const measurables = stats.measurables ?? stats.verified_measurables ?? stats;

  return (
    <div className="fc-profile-panel" data-testid="tab-high-school">
      <section className="fc-profile-section">
        <h2>School & Location</h2>
        <dl className="fc-profile-dl">
          <div><dt>High School</dt><dd>{player.highSchool || (typeof stats.school === 'string' ? stats.school : '') || '—'}</dd></div>
          <div><dt>Location</dt><dd>{[player.hometown, player.state].filter(Boolean).join(', ') || '—'}</dd></div>
          <div><dt>Height / Weight</dt><dd>{formatHeight(player.height)} · {formatWeight(player.weight)}</dd></div>
        </dl>
      </section>

      <section className="fc-profile-section">
        <h2>Rankings</h2>
        <dl className="fc-profile-dl">
          {stars != null && <div><dt>Stars</dt><dd>{String(stars)}★</dd></div>}
          {natl != null && <div><dt>National</dt><dd>#{String(natl)}</dd></div>}
          {pos != null && <div><dt>Position</dt><dd>#{String(pos)}</dd></div>}
          {stateRank != null && <div><dt>State</dt><dd>#{String(stateRank)}</dd></div>}
          {profile.discoveryScore != null && (
            <div><dt>Discovery Score</dt><dd>{profile.discoveryScore}</dd></div>
          )}
        </dl>
      </section>

      {Object.keys(measurables).length > 0 && (
        <section className="fc-profile-section">
          <h2>Measurables</h2>
          <dl className="fc-profile-dl">
            {Object.entries(measurables)
              .filter(([k]) => !['stars', 'natl_rank', 'pos_rank', 'state_rank', 'on3_id', 'school'].includes(k))
              .slice(0, 12)
              .map(([k, v]) => (
                <div key={k}><dt>{k.replace(/_/g, ' ')}</dt><dd>{String(v)}</dd></div>
              ))}
          </dl>
        </section>
      )}

      {profile.offers.length > 0 && (
        <section className="fc-profile-section">
          <h2>Offers</h2>
          <ul className="fc-offer-list">
            {profile.offers.map((offer, i) => (
              <li key={`${offer.school}-${i}`}>
                <strong>{offer.school ?? 'Unknown'}</strong>
                {offer.date && <span className="fc-profile-muted"> · {offer.date}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {films.length > 0 && (
        <section className="fc-profile-section">
          <h2>Film</h2>
          <div className="fc-film-links">
            {films.map((f) => (
              <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer">
                {f.label}
              </a>
            ))}
          </div>
        </section>
      )}

      {profile.recruitingNotes && (
        <section className="fc-profile-section">
          <h2>Recruiting Notes</h2>
          <p>{profile.recruitingNotes}</p>
        </section>
      )}
    </div>
  );
}
