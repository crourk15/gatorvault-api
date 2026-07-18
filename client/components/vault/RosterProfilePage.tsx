'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  isPortalRosterPlayer,
  portalRosterLabel,
  type RosterPlayer,
} from '@/lib/roster-api';
import {
  careerSeasonsForPos,
  formatGameStatLine,
  formatRecentGameHeadline,
  formatSyncedAt,
  hasProductionStats,
  pickPrimarySeason,
  seasonStripItems,
} from '@/lib/roster-production-stats';
import {
  fetchScoutingBreakdownBySlug,
  scoutingTypeLabel,
  type ScoutingBreakdown,
} from '@/lib/scouting-api';
import { playerProfilePath } from '@/lib/player-routes';
import { buildRosterStand, buildRosterContext } from '@/lib/player-overview-mode';
import { OverviewFourSlot } from '@/components/player/OverviewFourSlot';
import { fetchFullProfile } from '@/lib/player-full-profile-api';
import { formatSignalValue, formatDate } from '@/lib/player-derived';
import { dedupeDiscoverySignals, isFeedSignal, signalTimestamp } from '@/lib/player-profile-normalize';
import type { DiscoverySignal } from '@/lib/player-api';
import { buildPlayerShareUrl } from '@/lib/player-api';
import { usePathname } from '@/lib/use-pathname';
import { isVaultPath } from '@/lib/vault-routes';
import { PlayerNavLink } from '@/components/vault/PlayerNavLink';
import { VaultNavLink } from '@/components/vault/VaultNavLink';

const ACE_PORTAL_SLUG = 'eric-singleton-jr';

type RosterTab = 'overview' | 'stats' | 'depth' | 'scouting';

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

function signalMeta(signal: { signalType: string; createdAt?: string | null }): string {
  const type = String(signal.signalType || '').toUpperCase();
  const date = formatDate(signal.createdAt);
  if (type === 'OFFER') {
    return date !== '—' ? date : 'Offer';
  }
  if (date !== '—') return date;
  return '';
}

function fallbackPulseText(player: RosterPlayer): string {
  const games = player.productionStats?.recentGames;
  if (games?.length) {
    const g = games[0];
    const head = formatRecentGameHeadline(g);
    const line = formatGameStatLine(g);
    if (line && line !== '—') return `${head}: ${line}`;
    return head;
  }
  return 'No recent pulse — check Scouting for the full evaluation.';
}

function RosterProfileTabs({
  active,
  onChange,
  showStats,
}: {
  active: RosterTab;
  onChange: (tab: RosterTab) => void;
  showStats: boolean;
}): React.ReactElement {
  const tabs: { id: RosterTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    ...(showStats ? [{ id: 'stats' as const, label: 'Stats' }] : []),
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

function ProductionStatsOverview({ player }: { player: RosterPlayer }): React.ReactElement | null {
  if (!hasProductionStats(player) || !player.productionStats) return null;
  const season = pickPrimarySeason(player.productionStats, player.pos || player.position);
  const strip = seasonStripItems(season);
  const games = (player.productionStats.recentGames || []).slice(0, 5);
  const synced = formatSyncedAt(player.productionStats.syncedAt);
  if (!strip.length && !games.length) return null;

  return (
    <section className="gv-roster-prod" data-testid="roster-production-stats">
      {season && strip.length > 0 ? (
        <div className="gv-roster-prod__season">
          <div className="gv-roster-prod__season-head">
            <h3>
              {season.season}{' '}
              {String(season.category).replace(/^./, (c) => c.toUpperCase())}
            </h3>
            <span className="gv-roster-prod__team">{season.team}</span>
          </div>
          <div className="gv-roster-prod__strip">
            {strip.map((item) => (
              <div key={item.key} className="gv-roster-prod__stat">
                <strong>{item.value}</strong>
                <small>{item.label}</small>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {games.length > 0 ? (
        <div className="gv-roster-prod__games">
          <h3>Recent games</h3>
          <ul>
            {games.map((g) => (
              <li key={`${g.season}-${g.week}-${g.opponent}-${g.date}`}>
                <span className="gv-roster-prod__opp">{formatRecentGameHeadline(g)}</span>
                <span className="gv-roster-prod__line">{formatGameStatLine(g)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {synced ? <p className="gv-roster-prod__synced">Updated {synced}</p> : null}
    </section>
  );
}

function ProductionStatsTab({ player }: { player: RosterPlayer }): React.ReactElement {
  const stats = player.productionStats;
  if (!stats || !hasProductionStats(player)) {
    return <p className="gv-roster-profile__empty">No confirmed production stats yet.</p>;
  }
  const career = careerSeasonsForPos(stats, player.pos || player.position);
  const games = stats.recentGames || [];
  const synced = formatSyncedAt(stats.syncedAt);

  return (
    <div className="gv-roster-prod gv-roster-prod--tab" data-testid="tab-stats">
      {career.length > 0 ? (
        <section className="gv-roster-prod__career">
          <h3>Career by season</h3>
          <ul>
            {career.map((s) => {
              const strip = seasonStripItems(s);
              return (
                <li key={`${s.season}-${s.category}`}>
                  <div className="gv-roster-prod__season-head">
                    <strong>{s.season}</strong>
                    <span>{String(s.category)}</span>
                  </div>
                  <div className="gv-roster-prod__strip gv-roster-prod__strip--compact">
                    {strip.map((item) => (
                      <div key={item.key} className="gv-roster-prod__stat">
                        <strong>{item.value}</strong>
                        <small>{item.label}</small>
                      </div>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {games.length > 0 ? (
        <section className="gv-roster-prod__games">
          <h3>Game log</h3>
          <ul>
            {games.map((g) => (
              <li key={`${g.season}-${g.week}-${g.opponent}-full`}>
                <span className="gv-roster-prod__opp">
                  {g.season}
                  {g.week != null ? ` W${g.week}` : ''}
                  {' · '}
                  {formatRecentGameHeadline(g)}
                </span>
                <span className="gv-roster-prod__line">{formatGameStatLine(g)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {synced ? (
        <p className="gv-roster-prod__synced">
          Source: CollegeFootballData · Updated {synced}
        </p>
      ) : null}
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
  const pathname = usePathname();
  const inVault = isVaultPath(pathname);
  const portalTag = portalRosterLabel(player);
  const isAce = player.slug === ACE_PORTAL_SLUG;
  const showStats = hasProductionStats(player);
  const [activeTab, setActiveTab] = useState<RosterTab>('overview');
  const [photoIndex, setPhotoIndex] = useState(0);
  const [scouting, setScouting] = useState<ScoutingBreakdown | null>(null);
  const [pulseSignals, setPulseSignals] = useState<DiscoverySignal[] | null>(null);
  const [copied, setCopied] = useState(false);
  const photos = useMemo(() => headshotCandidates(player), [player]);
  const stand = useMemo(() => buildRosterStand(player), [player]);
  const context = useMemo(() => buildRosterContext(player), [player]);

  useEffect(() => {
    if (activeTab === 'stats' && !showStats) setActiveTab('overview');
  }, [activeTab, showStats]);
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

  useEffect(() => {
    let cancelled = false;
    setPulseSignals(null);
    void fetchFullProfile(player.slug)
      .then((payload) => {
        if (cancelled) return;
        const recent = dedupeDiscoverySignals(payload.signals ?? [])
          .filter(isFeedSignal)
          .sort((a, b) => signalTimestamp(b.createdAt) - signalTimestamp(a.createdAt))
          .slice(0, 3);
        setPulseSignals(recent);
      })
      .catch(() => {
        if (!cancelled) setPulseSignals([]);
      });
    return () => {
      cancelled = true;
    };
  }, [player.slug]);

  const onShare = useCallback(async () => {
    const url = buildPlayerShareUrl(player.slug, 'COLLEGE', inVault);
    try {
      if (navigator.share) {
        await navigator.share({ title: player.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* user cancelled share */
    }
  }, [player.name, player.slug, inVault]);

  const showPhoto = photoIndex < photos.length;
  const fallbackText = fallbackPulseText(player);
  const pulse =
    pulseSignals && pulseSignals.length > 0 ? (
      <ul className="fc-signal-feed fc-signal-feed--compact">
        {pulseSignals.map((s) => (
          <li key={s.id}>
            <span className="fc-signal-feed__type">{s.signalType.replace(/_/g, ' ')}</span>
            <span className="fc-signal-feed__value">{formatSignalValue(s)}</span>
            {signalMeta(s) ? (
              <span className="fc-signal-feed__meta">{signalMeta(s)}</span>
            ) : null}
          </li>
        ))}
      </ul>
    ) : (
      <p className="fc-profile-muted">{fallbackText}</p>
    );

  const who = (
    <dl className="fc-profile-dl fc-overview-who-dl">
      <div><dt>Position</dt><dd>{player.pos || player.position || '—'}</dd></div>
      {player.jersey != null && player.jersey !== '' ? (
        <div><dt>Jersey</dt><dd>#{player.jersey}</dd></div>
      ) : null}
      <div><dt>Class</dt><dd>{player.year || player.class || '—'}</dd></div>
      {player.hometown ? (
        <div><dt>Hometown</dt><dd>{player.hometown}</dd></div>
      ) : null}
    </dl>
  );

  return (
    <div className="gv-roster-profile gv-roster-profile--v2 fc-profile" data-testid="roster-profile-page">
      <nav className="fc-profile-back">
        <VaultNavLink
          href={backHref}
          onClick={(e) => {
            if (typeof window !== 'undefined' && window.history.length > 1) {
              const ref = document.referrer;
              if (ref.includes('/vault/team')) {
                e.preventDefault();
                window.history.back();
              }
            }
          }}
        >
          {backLabel}
        </VaultNavLink>
      </nav>

      <header
        className={`gv-roster-profile__header fc-profile-header${isAce ? ' gv-roster-profile__header--ace' : ''}`}
      >
        <div className="gv-roster-profile__hero-row fc-profile-header__top">
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
            <h1 className="gv-roster-profile__name fc-profile-header__name">{player.name}</h1>
            <p className="gv-roster-profile__meta">
              {player.pos || player.position}
              {player.jersey != null && ` · #${player.jersey}`}
              {' · '}
              {player.year || player.class || '—'}
              {player.height && player.weight && ` · ${player.height} / ${player.weight}`}
            </p>
            {player.hometown && <p className="gv-roster-profile__hometown">{player.hometown}</p>}
          </div>
          <button type="button" className="fc-profile-share" onClick={onShare}>
            {copied ? 'Link copied!' : 'Share'}
          </button>
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

      <RosterProfileTabs active={activeTab} onChange={setActiveTab} showStats={showStats} />

      {activeTab === 'overview' && (
        <div className="gv-roster-profile__panel fc-profile-panel" data-testid="tab-overview">
          <OverviewFourSlot
            mode="roster"
            idPrefix="roster-overview"
            who={who}
            stand={stand}
            context={context}
            pulse={pulse}
          />
          <ProductionStatsOverview player={player} />
          {isPortalRosterPlayer(player) ? (
            <p className="gv-roster-profile__portal-link">
              <PlayerNavLink href={playerProfilePath(player.slug, 'PORTAL', true, player.name, 'recruiting')}>
                View Portal Intel →
              </PlayerNavLink>
            </p>
          ) : null}
        </div>
      )}

      {activeTab === 'stats' && showStats && (
        <div className="gv-roster-profile__panel">
          <ProductionStatsTab player={player} />
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
            <VaultNavLink href="/vault/team?tab=depth">View full team depth chart →</VaultNavLink>
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
