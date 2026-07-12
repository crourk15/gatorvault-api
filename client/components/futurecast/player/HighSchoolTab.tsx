/**
 * High School profile tab.
 */
import React from 'react';
import type { HighSchoolProfile, PlayerCore } from '../../../lib/player-api';
import { formatHeight, formatWeight, formatDate, formatPlayerLocation, validStars } from '../../../lib/player-derived';
import { coerceDisplayText } from '../../../lib/coerce-text';

export interface HighSchoolTabProps {
  player: PlayerCore;
  profile: HighSchoolProfile | null;
}

/** Ranking / identity fields that must never render as physical measurables. */
const NON_MEASURABLE_KEYS = new Set([
  'stars',
  'natl_rank',
  'national_rank',
  'pos_rank',
  'position_rank',
  'state_rank',
  'on3_id',
  'on3id',
  'school',
  'natlrank',
  'posrank',
  'staterank',
  'rating',
  'discoveryscore',
  'composite',
  'compositerating',
]);

function filmLinks(stats: Record<string, unknown>): { label: string; url: string }[] {
  const links: { label: string; url: string }[] = [];
  const hudl = stats.hudl ?? stats.hudl_url ?? stats.hudlUrl;
  const youtube = stats.youtube ?? stats.youtube_url ?? stats.youtubeUrl ?? stats.film;
  if (typeof hudl === 'string' && hudl.startsWith('http')) links.push({ label: 'HUDL', url: hudl });
  if (typeof youtube === 'string' && youtube.startsWith('http')) links.push({ label: 'YouTube', url: youtube });
  return links;
}

function isMeasurableEntry(key: string, value: unknown): boolean {
  if (value == null || value === '') return false;
  if (NON_MEASURABLE_KEYS.has(key.replace(/_/g, '').toLowerCase())) return false;
  if (typeof value === 'object') return false;
  return true;
}

/** Only real physical fields — never fall back to dumping the whole stats bag. */
function pickMeasurables(
  stats: Record<string, unknown>,
  player: PlayerCore
): Array<[string, string]> {
  const raw = stats.measurables ?? stats.verified_measurables;
  const rows: Array<[string, string]> = [];

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (!isMeasurableEntry(k, v)) continue;
      rows.push([k.replace(/_/g, ' '), String(v)]);
    }
  }

  if (!rows.length) {
    if (player.height != null) rows.push(['Height', formatHeight(player.height)]);
    if (player.weight != null) rows.push(['Weight', formatWeight(player.weight)]);
  }

  return rows.slice(0, 12);
}

export function HighSchoolTab({ player, profile }: HighSchoolTabProps): React.ReactElement {
  if (!profile) {
    return <p className="fc-profile-empty">No high school profile on file.</p>;
  }

  const stats = profile.stats ?? {};
  const stars = validStars(player.stars) ?? validStars(stats.stars);
  const natl = player.rankingNational ?? stats.natl_rank ?? stats.national_rank;
  const pos = player.rankingPosition ?? stats.pos_rank ?? stats.position_rank;
  const stateRank = player.rankingState ?? stats.state_rank;
  const films = filmLinks(stats);
  const measurables = pickMeasurables(stats, player);
  const recruitingNotes = coerceDisplayText(profile.recruitingNotes);

  return (
    <div className="fc-profile-panel" data-testid="tab-high-school">
      <section className="fc-profile-section">
        <h2>School & Location</h2>
        <dl className="fc-profile-dl">
          <div><dt>High School</dt><dd>{player.highSchool || (typeof stats.school === 'string' ? stats.school : '') || '—'}</dd></div>
          <div><dt>Location</dt><dd>{formatPlayerLocation(player.hometown, player.state) || '—'}</dd></div>
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

      {measurables.length > 0 && (
        <section className="fc-profile-section">
          <h2>Measurables</h2>
          <dl className="fc-profile-dl">
            {measurables.map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        </section>
      )}

      {profile.offers.length > 0 && (
        <section className="fc-profile-section">
          <h2>Offers ({profile.offers.length})</h2>
          <p className="fc-profile-muted fc-profile-section__lede">
            Schools on file from On3 — dates shown only when known
          </p>
          <ul className="fc-offer-list">
            {profile.offers.map((offer, i) => {
              const knownDate = offer.date ? formatDate(offer.date) : '—';
              return (
                <li key={`${offer.school}-${i}`}>
                  <strong>{offer.school ?? 'Unknown'}</strong>
                  {knownDate !== '—' ? (
                    <span className="fc-profile-muted"> · {knownDate}</span>
                  ) : null}
                </li>
              );
            })}
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

      {recruitingNotes ? (
        <section className="fc-profile-section">
          <h2>Recruiting Notes</h2>
          <p>{recruitingNotes}</p>
        </section>
      ) : null}
    </div>
  );
}
