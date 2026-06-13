'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  isPortalRosterPlayer,
  portalRosterLabel,
  type RosterPlayer,
} from '@/lib/roster-api';
import {
  fetchScoutingBreakdownBySlug,
  scoutingTypeLabel,
  type ScoutingBreakdown,
} from '@/lib/scouting-api';
import { playerProfilePath } from '@/lib/player-routes';

const ACE_PORTAL_SLUG = 'eric-singleton-jr';

type RosterTab = 'overview' | 'depth' | 'scouting';

function playerInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function headshotCandidates(player: RosterPlayer): string[] {
  const urls: string[] = [];
  if (player.headshotUrl) urls.push(player.headshotUrl);
  urls.push(
    `/headshots/${encodeURIComponent(player.slug)}.jpg`,
    `/headshots/${encodeURIComponent(player.slug)}.png`
  );
  return urls;
}

function RosterProfileTabs({
  active,
  onChange,
}: {
  active: RosterTab;
  onChange: (tab: RosterTab) => void;
}): React.ReactElement {
  const tabs: { id: RosterTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'depth', label: 'Depth Role' },
    { id: 'scouting', label: 'Scouting' },
  ];
  return (
    <div className="gv-roster-profile__tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`gv-roster-profile__tab${active === tab.id ? ' is-active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function ScoutingPanel({ breakdown }: { breakdown: ScoutingBreakdown | null }): React.ReactElement {
  if (!breakdown) {
    return (
      <p className="gv-roster-profile__empty">
        No verified insider evaluation available for this player yet.
      </p>
    );
  }
  if (breakdown.locked) {
    return (
      <div className="gv-roster-profile__locked">
        <span className="gv-roster-profile__lock-badge">War Room</span>
        <p>Upgrade to War Room for full scouting reports from verified analysts.</p>
        {breakdown.featured && <p className="gv-roster-profile__featured">Featured evaluation available.</p>}
      </div>
    );
  }
  return (
    <div className="gv-roster-profile__scouting">
      <p className="gv-roster-profile__scout-type">
        {scoutingTypeLabel(breakdown.playerType)}
        {breakdown.sources?.length ? ` · ${breakdown.sources.join(' · ')}` : ''}
      </p>
      {breakdown.strengths && (
        <section>
          <h3>Strengths</h3>
          <p>{breakdown.strengths}</p>
        </section>
      )}
      {breakdown.weaknesses && (
        <section>
          <h3>Weaknesses</h3>
          <p>{breakdown.weaknesses}</p>
        </section>
      )}
      {breakdown.comparison && (
        <section>
          <h3>Comparison</h3>
          <p>{breakdown.comparison}</p>
        </section>
      )}
      {breakdown.projection && (
        <section>
          <h3>Projection</h3>
          <p>{breakdown.projection}</p>
        </section>
      )}
    </div>
  );
}

export function RosterProfilePage({
  player,
  backHref = '/vault/team',
  backLabel = '← Team',
}: {
  player: RosterPlayer;
  backHref?: string;
  backLabel?: string;
}): React.ReactElement {
  const portalTag = portalRosterLabel(player);
  const isAce = player.slug === ACE_PORTAL_SLUG;
  const [activeTab, setActiveTab] = useState<RosterTab>('overview');
  const [photoIndex, setPhotoIndex] = useState(0);
  const [scouting, setScouting] = useState<ScoutingBreakdown | null>(null);
  const photos = useMemo(() => headshotCandidates(player), [player]);

  useEffect(() => {
    let cancelled = false;
    void fetchScoutingBreakdownBySlug(player.slug)
      .then((row) => {
        if (!cancelled) setScouting(row);
      })
      .catch(() => {
        if (!cancelled) setScouting(null);
      });
    return () => {
      cancelled = true;
    };
  }, [player.slug]);

  const showPhoto = photoIndex < photos.length;

  return (
    <div className="gv-roster-profile gv-roster-profile--v2" data-testid="roster-profile-page">
      <nav className="fc-profile-back">
        <a href={backHref}>{backLabel}</a>
      </nav>

      <header className={`gv-roster-profile__header${isAce ? ' gv-roster-profile__header--ace' : ''}`}>
        <div className="gv-roster-profile__hero-row">
          <div className="gv-roster-profile__photo-wrap">
            {showPhoto ? (
              <img
                src={photos[photoIndex]}
                alt=""
                className="gv-roster-profile__photo"
                onError={() => setPhotoIndex((i) => i + 1)}
              />
            ) : (
              <div className="gv-roster-profile__photo gv-roster-profile__photo--placeholder" aria-hidden>
                {playerInitials(player.name)}
              </div>
            )}
          </div>
          <div className="gv-roster-profile__identity">
            {isAce && <span className="gv-roster-profile__ace-badge">ACE Portal Get</span>}
            {portalTag && <span className="gv-roster-profile__portal-tag">{portalTag}</span>}
            <h1 className="gv-roster-profile__name">{player.name}</h1>
            <p className="gv-roster-profile__meta">
              {player.pos || player.position}
              {player.jersey != null && ` · #${player.jersey}`}
              {' · '}
              {player.year || player.class || '—'}
              {player.height && player.weight && ` · ${player.height} / ${player.weight}`}
            </p>
            {player.hometown && <p className="gv-roster-profile__hometown">{player.hometown}</p>}
          </div>
        </div>

        <div className="gv-roster-profile__kpi-row">
          {player.vaultGrade != null && (
            <span className="gv-roster-profile__kpi">
              <strong>{player.vaultGrade}</strong>
              <small>Vault Grade</small>
            </span>
          )}
          {player.stars != null && (
            <span className="gv-roster-profile__kpi">
              <strong>{player.stars}★</strong>
              <small>Stars</small>
            </span>
          )}
          {player.depthChartTier && (
            <span className="gv-roster-profile__kpi">
              <strong>{player.depthChartTier}</strong>
              <small>Depth Tier</small>
            </span>
          )}
          {player.rank != null && (
            <span className="gv-roster-profile__kpi">
              <strong>#{player.rank}</strong>
              <small>Rank</small>
            </span>
          )}
        </div>
      </header>

      <RosterProfileTabs active={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview' && (
        <div className="gv-roster-profile__panel">
          {player.transferInfo && (
            <p className="gv-roster-profile__transfer">{player.transferInfo}</p>
          )}
          {player.bio ? (
            <p className="gv-roster-profile__bio">{player.bio}</p>
          ) : (
            <p className="gv-roster-profile__empty">Bio coming soon.</p>
          )}
          {isPortalRosterPlayer(player) && (
            <p className="gv-roster-profile__portal-link">
              <a href={playerProfilePath(player.slug, 'PORTAL', true)}>View Portal Intel →</a>
            </p>
          )}
        </div>
      )}

      {activeTab === 'depth' && (
        <div className="gv-roster-profile__panel">
          <dl className="gv-roster-profile__depth-dl">
            <div>
              <dt>Position</dt>
              <dd>{player.pos || player.position || '—'}</dd>
            </div>
            <div>
              <dt>Unit</dt>
              <dd>{player.unit || '—'}</dd>
            </div>
            <div>
              <dt>Depth Chart Tier</dt>
              <dd>{player.depthChartTier || 'TBD'}</dd>
            </div>
            <div>
              <dt>Class</dt>
              <dd>{player.year || player.class || '—'}</dd>
            </div>
          </dl>
          <p className="gv-roster-profile__depth-note">
            <a href="/vault/team?tab=depth">View full team depth chart →</a>
          </p>
        </div>
      )}

      {activeTab === 'scouting' && (
        <div className="gv-roster-profile__panel">
          <ScoutingPanel breakdown={scouting} />
        </div>
      )}
    </div>
  );
}
