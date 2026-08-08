'use client';

import React, { useMemo } from 'react';
import type { MasterBoardResponse, MovementIntelResponse, StaffNotesResponse, TrendingBoardResponse } from '@/lib/futurecast-board-types';
import type { HighPriorityPlayer, VisitRecapRow, FlipWatchRow, MovementNarrativeRow } from '@/lib/futurecast-high-priority-api';
import type { UnderclassmenPlayer } from '@/lib/futurecast-underclassmen-api';
import {
  buildIntelFeedItem,
  dedupeIntelFeedItems,
  formatIntelTimestamp,
  type IntelFeedItem,
} from '@/lib/recruiting-intel-feed';
import { FutureCastPanelShell } from './primitives';
import { GatorVaultConfirmedBadge } from './GatorVaultConfirmedBadge';
import { UfTrendSparkline } from '@/components/futurecast/UfTrendSparkline';
import type { RosterPlayer } from '@/lib/roster-api';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import { PlayerIntelTimelineStrip } from './PlayerIntelTimelineStrip';
import { ufPctFromFc } from './fc-lab-types';
import { FUTURECAST_LAB_ANCHORS, playerProfileRoute } from '@/lib/vault-route-map';
import { EarlyDiscoveryPreview } from '@/components/futurecast/EarlyDiscoveryPreview';
import { useFutureCastLabCycle } from './FutureCastLabCycleContext';
import {
  groupYoungerProspectsByYear,
  YOUNGER_PROSPECT_LAB_CAPS,
  YOUNGER_PROSPECT_YEARS,
  formatYoungerLabMeta,
  isAthHeavyShownPlayers,
  isLabYoungerProspect,
  type YoungerProspectYearGroup,
} from '@/lib/younger-prospects';

type Props = {
  masterBoard: MasterBoardResponse;
  trendingBoard: TrendingBoardResponse;
  movementIntel: MovementIntelResponse;
  staffNotes: StaffNotesResponse;
  highPriority: HighPriorityPlayer[];
  visitIntel?: HighPriorityPlayer[];
  visitRecap?: VisitRecapRow[];
  flipWatch?: FlipWatchRow[];
  movementNarratives?: MovementNarrativeRow[];
  underclassmen: UnderclassmenPlayer[];
  roster?: RosterPlayer[];
  commits2027?: RecruitingBoardPlayer[];
};

function formatUfDisplay(
  p: { ufProbability?: number | null; ufProbabilityLabel?: string | null }
): string {
  const pct = Math.round(p.ufProbability ?? 0);
  if (p.ufProbabilityLabel) return `${p.ufProbabilityLabel} ${pct}%`;
  return `${pct}%`;
}

function formatTrendDelta(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return 'TBD';
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

function MovementNarrativeLine({ text }: { text: string | null | undefined }): React.ReactElement | null {
  if (!text) return null;
  return <p className="fc-lab-movement-narrative">{text}</p>;
}

function FitBar({
  label,
  value,
  emptyLabel = '—',
}: {
  label: string;
  value: number | null | undefined;
  emptyLabel?: string;
}): React.ReactElement {
  const hasValue = value != null && Number(value) > 0;
  const pct = hasValue ? Math.max(0, Math.min(100, Math.round(Number(value)))) : 0;
  return (
    <div className="fc-lab-fit-row">
      <span className="fc-lab-fit-row__label">{label}</span>
      <div className="fc-lab-fit-row__track">
        <div className="fc-lab-fit-row__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="fc-lab-fit-row__val">{hasValue ? pct : emptyLabel}</span>
    </div>
  );
}

function ModuleList({
  items,
  empty,
}: {
  items: Array<{
    key: string;
    primary: string;
    meta: string;
    href?: string;
    badge?: React.ReactNode;
    extra?: React.ReactNode;
  }>;
  empty: string;
}): React.ReactElement {
  if (!items.length) return <p className="rh-cc-empty">{empty}</p>;
  return (
    <ul className="fc-lab-ext-list">
      {items.map((item) => (
        <li key={item.key} className="fc-lab-ext-list__row">
          {item.href ? (
            <a href={item.href} className="fc-lab-ext-list__link">
              <div className="fc-lab-ext-list__head">
                <strong>{item.primary}</strong>
                {item.badge}
              </div>
              <span>{item.meta}</span>
              {item.extra}
            </a>
          ) : (
            <>
              <div className="fc-lab-ext-list__head">
                <strong>{item.primary}</strong>
                {item.badge}
              </div>
              <span>{item.meta}</span>
              {item.extra}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

function YoungerProspectsLabBoard({
  columns,
}: {
  columns: YoungerProspectYearGroup<UnderclassmenPlayer>[];
}): React.ReactElement | null {
  if (!columns.some((g) => g.players.length > 0)) return null;

  return (
    <FutureCastPanelShell
      title="Names to know — 2029 & 2030"
      sub="Early names by class — before the board gets real."
      testId="fc-lab-underclassmen"
    >
      <div className="fc-lab-younger-cols">
        {columns.map((group) => (
          <div key={group.year} className="fc-lab-younger-group" data-year={group.year}>
            <div className="fc-lab-younger-group__head">
              <strong className="fc-lab-younger-group__title">{group.label}</strong>
              <span className="fc-lab-younger-group__badge">{group.badge}</span>
              {group.players.length > 0 ? (
                <span className="fc-lab-younger-group__count">
                  {group.total > group.players.length
                    ? `${group.players.length} of ${group.total}`
                    : `${group.total} tracked`}
                </span>
              ) : null}
            </div>
            {isAthHeavyShownPlayers(group.players) ? (
              <p className="fc-lab-younger-group__ath-note fc-profile-muted">
                Positions still filling in for this class.
              </p>
            ) : null}
            <ModuleList
              empty={`No Class of ${group.year} names loaded yet.`}
              items={group.players.map((p) => ({
                key: p.slug,
                primary: `${p.name} · ${p.position && p.position !== 'TBD' ? p.position : 'ATH'}`,
                meta: formatYoungerLabMeta(p) || 'Early watch',
                href: playerProfileRoute(p.slug, 'futurecast'),
              }))}
            />
          </div>
        ))}
      </div>
    </FutureCastPanelShell>
  );
}

function SmartAlertsPanel({ alerts }: { alerts: IntelFeedItem[] }): React.ReactElement | null {
  if (alerts.length === 0) return null;
  return (
    <FutureCastPanelShell title="Smart Alerts" sub="Movement, visits, and staff intel — deduped." testId="fc-lab-smart-alerts">
      <ul className="fc-lab-alert-list">
        {alerts.map((a) => (
          <li key={a.id} className="fc-lab-alert-list__row">
            <span className="fc-lab-alert-list__icon" aria-hidden>
              {a.icon}
            </span>
            <div className="fc-lab-alert-list__body">
              <p className="fc-lab-alert-list__headline">
                {a.headline}
                {a.category === 'Visit' || a.category === 'Flip Watch' ? (
                  <GatorVaultConfirmedBadge sourceLabel={a.source} compact />
                ) : null}
              </p>
              <p className="fc-lab-alert-list__meta">
                <span className="fc-lab-alert-list__cat">{a.category}</span>
                {' · '}
                {formatIntelTimestamp(a.timestamp)}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p className="fc-lab-panel-footer">
        <a href="/vault/futurecast/alerts" data-testid="fc-lab-alerts-view-all">
          View all alerts →
        </a>
      </p>
    </FutureCastPanelShell>
  );
}

export function FutureCastExtendedModules({
  masterBoard: _masterBoard,
  trendingBoard,
  movementIntel,
  staffNotes,
  highPriority,
  visitIntel = [],
  visitRecap = [],
  flipWatch = [],
  movementNarratives = [],
  underclassmen,
}: Props): React.ReactElement {
  const { discoveryView: discoveryFocus } = useFutureCastLabCycle();

  const fitLeaders = useMemo(
    () =>
      highPriority
        .slice()
        .sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0) || (b.ufProbability ?? 0) - (a.ufProbability ?? 0))
        .slice(0, 3),
    [highPriority]
  );

  const sciLeaders = useMemo(
    () =>
      highPriority
        .filter((p) => Number(p.staffConfidence ?? 0) > 0)
        .slice()
        .sort((a, b) => (b.staffConfidence ?? 0) - (a.staffConfidence ?? 0))
        .slice(0, 6),
    [highPriority]
  );

  const youngerProspectColumns = useMemo(() => {
    const grouped = groupYoungerProspectsByYear(
      underclassmen.filter((p) => {
        const year = Number(p.classYear) || 0;
        return year >= 2029 && year <= 2030 && isLabYoungerProspect(p);
      }),
      YOUNGER_PROSPECT_YEARS,
      YOUNGER_PROSPECT_LAB_CAPS
    );
    const byYear = new Map(grouped.map((g) => [g.year, g]));
    return YOUNGER_PROSPECT_YEARS.map((year) => {
      const hit = byYear.get(year);
      if (hit) return hit;
      return {
        year,
        players: [] as UnderclassmenPlayer[],
        total: 0,
        label: `Class of ${year}`,
        badge: year >= 2030 ? 'Early watch' : 'Early target',
      };
    });
  }, [underclassmen]);

  /** Upcoming verified OVs only — never show completed/cleared rows in this panel. */
  const upcomingVisitIntel = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return visitIntel.filter((p) => {
      if (p.visitVerified === false) return false;
      if (String(p.ufOvStatus || '').toLowerCase() === 'completed') return false;
      if (p.visitStart && String(p.visitStart).slice(0, 10) < today) return false;
      return Boolean(p.visitStart) || p.visitVerified === true;
    });
  }, [visitIntel]);

  const narrativeBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of movementNarratives) {
      if (row.movementNarrative) map.set(row.slug, row.movementNarrative);
    }
    for (const row of visitRecap) {
      if (row.movementNarrative) map.set(row.slug, row.movementNarrative);
    }
    for (const row of flipWatch) {
      if (row.movementNarrative) map.set(row.slug, row.movementNarrative);
    }
    return map;
  }, [movementNarratives, visitRecap, flipWatch]);

  const trend30 = useMemo(() => {
    const up = (trendingBoard?.trendingUp ?? []).slice(0, 5);
    const down = (trendingBoard?.trendingDown ?? []).slice(0, 5);
    return { up, down };
  }, [trendingBoard]);

  const smartAlerts = useMemo(() => {
    const raw: IntelFeedItem[] = [];
    const risers = movementIntel?.risers ?? [];
    const volatile = movementIntel?.highVolatility ?? [];
    const alerts = movementIntel?.alerts ?? [];
    // Closing-class priority: movement + flip first; OV recap already has its own panel.
    for (const p of risers.slice(0, 4)) {
      raw.push(
        buildIntelFeedItem({
          id: `rise-${p.slug}`,
          playerName: p.name,
          headline: `${p.name} trending up (${formatTrendDelta(p.trendDelta7d)} UF)`,
          timestamp: movementIntel.updatedAt,
          category: 'Movement',
        })
      );
    }
    for (const row of (movementNarratives ?? []).slice(0, 4)) {
      raw.push(
        buildIntelFeedItem({
          id: `move-${row.slug}`,
          playerName: row.name,
          headline: `${row.name} — ${row.movementNarrative}`,
          timestamp: movementIntel.updatedAt,
          category: 'Movement',
        })
      );
    }
    for (const p of volatile.slice(0, 3)) {
      raw.push(
        buildIntelFeedItem({
          id: `vol-${p.slug}`,
          playerName: p.name,
          headline: `Volatility spike on ${p.name} (${p.position})`,
          timestamp: movementIntel.updatedAt,
          category: 'Movement',
          volatile: true,
        })
      );
    }
    for (const alert of alerts.slice(0, 4)) {
      raw.push(
        buildIntelFeedItem({
          id: alert.id,
          headline: alert.message,
          timestamp: alert.createdAt,
        })
      );
    }
    for (const row of flipWatch.slice(0, 3)) {
      raw.push(
        buildIntelFeedItem({
          id: `flip-${row.slug}`,
          playerName: row.name,
          headline: row.movementNarrative
            ? `${row.name} (${row.committedShort}) — ${row.movementNarrative}`
            : `${row.name} (${row.committedShort}) — Flip ${row.flipScore ?? '—'}${row.flipScoreLabel ? ` · ${row.flipScoreLabel}` : ''}`,
          timestamp: row.visitStart ?? movementIntel.updatedAt,
          category: 'Flip Watch',
        })
      );
    }
    for (const p of upcomingVisitIntel.slice(0, 2)) {
      raw.push(
        buildIntelFeedItem({
          id: `ov-up-${p.slug}`,
          playerName: p.name,
          headline: `Upcoming UF OV: ${p.name} (${p.visitStart ?? 'TBD'}${p.visitEnd ? `–${p.visitEnd}` : ''})`,
          timestamp: p.visitStart ?? movementIntel.updatedAt,
          category: 'Visit',
          source: p.visitSourceLabel ?? undefined,
        })
      );
    }
    // Completed OVs stay in Verified OV Recap — do not re-dump them here.
    return dedupeIntelFeedItems(raw, 6);
  }, [movementIntel, flipWatch, upcomingVisitIntel, movementNarratives]);

  const earlyDiscoveryPanel = (
    <FutureCastPanelShell
      title="2028 Early Discovery"
      sub="Prospects ranked by discovery score — Vault estimates until On3 syncs."
      testId="fc-lab-early-discovery"
      action={
        <a href="/vault/futurecast/big-board" className="rh-cc-link">
          Full board →
        </a>
      }
    >
      <EarlyDiscoveryPreview
        query={{ class_year_gte: 2028, limit: 4 }}
        footerHref="/vault/futurecast/big-board"
        footerLabel="Open Early Discovery board →"
      />
    </FutureCastPanelShell>
  );

  return (
    <>
      {/* Always mount 2028 Early Discovery — do not hide it behind the 2027 cycle tab. */}
      <div className="fc-lab-more-boards" data-testid="fc-lab-more-boards">
        <h2 className="fc-lab-more-boards__title">More boards</h2>
        <p className="fc-lab-more-boards__sub">
          {discoveryFocus
            ? 'Early discovery and younger classes — secondary to the 2028 UF targets above.'
            : '2028 Early Discovery stays available while you work the 2027 Closing Class.'}
        </p>

        {earlyDiscoveryPanel}

        {discoveryFocus ? <YoungerProspectsLabBoard columns={youngerProspectColumns} /> : null}
      </div>

      {!discoveryFocus ? (
        <>
          <YoungerProspectsLabBoard columns={youngerProspectColumns} />

          {fitLeaders.length > 0 ? (
            <FutureCastPanelShell
              title="Fit Score Breakdown"
              sub="Scheme, staff, and roster-fit leaders."
              testId="fc-lab-fit-breakdown"
            >
              {fitLeaders.map((p) => {
                const move = Number(p.movementDelta ?? p.delta7d ?? 0);
                const showMomentum = Number.isFinite(move) && Math.abs(move) >= 0.5;
                return (
                  <div key={p.slug} className="fc-lab-fit-card">
                    <p className="fc-lab-fit-card__name">
                      {p.name} · {p.position}
                    </p>
                    <FitBar label="Scheme / Fit" value={p.fitScore} />
                    <FitBar
                      label="Staff confidence"
                      value={Number(p.staffConfidence ?? 0) > 0 ? p.staffConfidence : null}
                    />
                    <FitBar label="UF likelihood" value={p.ufProbability} />
                    {(p.trendHistory?.length ?? 0) >= 2 ? (
                      <UfTrendSparkline values={p.trendHistory.map((point) => point.confidence)} />
                    ) : null}
                    {showMomentum ? (
                      <FitBar label="Momentum" value={Math.max(0, Math.min(100, move + 50))} />
                    ) : null}
                  </div>
                );
              })}
            </FutureCastPanelShell>
          ) : null}

          {sciLeaders.length > 0 ? (
            <FutureCastPanelShell
              title="Staff Conviction"
              sub="Analyst confidence on top targets."
              testId="fc-lab-sci"
            >
              <ModuleList
                empty="Staff conviction data unavailable."
                items={sciLeaders.map((p) => ({
                  key: p.slug,
                  primary: p.name,
                  meta: `Conviction ${Math.round(p.staffConfidence ?? 0)} · UF ${formatUfDisplay(p)}`,
                  href: playerProfileRoute(p.slug, 'futurecast'),
                }))}
              />
            </FutureCastPanelShell>
          ) : null}

          {(upcomingVisitIntel.length > 0 || visitRecap.length > 0 || flipWatch.length > 0) ? (
          <section id={FUTURECAST_LAB_ANCHORS.visits}>
            {upcomingVisitIntel.length > 0 ? (
              <FutureCastPanelShell
                title="2027 Visit Intel"
                sub="Verified official visit windows only — unconfirmed schedules stay off the board."
                testId="fc-lab-timeline"
              >
                <ModuleList
                  empty="No verified upcoming official visits on file."
                  items={upcomingVisitIntel.slice(0, 6).map((p) => ({
                    key: p.slug,
                    primary: p.name,
                    badge:
                      p.visitVerified !== false ? (
                        <GatorVaultConfirmedBadge sourceLabel={p.visitSourceLabel} compact />
                      ) : undefined,
                    meta: p.visitStart
                      ? `OV ${p.visitStart}${p.visitEnd ? `–${p.visitEnd}` : ''}${p.visitSourceLabel ? ` · ${p.visitSourceLabel}` : ''} · UF ${formatUfDisplay(p)}`
                      : `${p.ufOvStatus ?? 'Visit intel'}${p.visitSourceLabel ? ` · ${p.visitSourceLabel}` : ''} · UF ${formatUfDisplay(p)}`,
                    href: playerProfileRoute(p.slug, 'futurecast'),
                  }))}
                />
              </FutureCastPanelShell>
            ) : null}

            {visitRecap.length > 0 ? (
              <FutureCastPanelShell
                title="Verified OV Recap"
                sub="Recent completed official visits — On3 or beat verified."
                testId="fc-lab-visit-recap"
              >
                <ModuleList
                  empty="No verified completed official visits on file."
                  items={visitRecap.slice(0, 4).map((row) => ({
                    key: `recap-${row.slug}-${row.visitStart}`,
                    primary: row.name,
                    badge: <GatorVaultConfirmedBadge sourceLabel={row.visitSourceLabel} compact />,
                    meta: `OV ${row.visitStart}${row.visitEnd ? `–${row.visitEnd}` : ''}${row.visitSourceLabel ? ` · ${row.visitSourceLabel}` : ''}${row.ufProbability != null ? ` · UF ${formatUfDisplay({ ufProbability: row.ufProbability, ufProbabilityLabel: row.ufProbabilityLabel ?? null })}` : ''}`,
                    extra: (
                      <>
                        <MovementNarrativeLine text={row.movementNarrative} />
                        <PlayerIntelTimelineStrip slug={row.slug} staffNotes={staffNotes} />
                      </>
                    ),
                    href: playerProfileRoute(row.slug, 'futurecast'),
                  }))}
                />
              </FutureCastPanelShell>
            ) : null}

            {/* Flip Watch lives under Top UF Targets (FutureCastFlipWatchPanel). */}
          </section>
          ) : null}

          {trend30.up.length + trend30.down.length > 0 ? (
            <FutureCastPanelShell
              title="30-Day Trends"
              sub="UF probability movers over the last 30 days."
              testId="fc-lab-trend-30"
            >
              <div className="fc-lab-trend-grid">
                <div>
                  <h3 className="fc-lab-trend-grid__label">Trending up</h3>
                  <ModuleList
                    empty="No risers."
                    items={trend30.up.map((p) => ({
                      key: `up-${p.slug}`,
                      primary: p.name,
                      meta: `${formatTrendDelta(p.trendDelta7d)} · UF ${ufPctFromFc(p.ufConfidence)}%`,
                      extra: <MovementNarrativeLine text={narrativeBySlug.get(p.slug)} />,
                    }))}
                  />
                </div>
                <div>
                  <h3 className="fc-lab-trend-grid__label">Trending down</h3>
                  <ModuleList
                    empty="No fallers."
                    items={trend30.down.map((p) => ({
                      key: `dn-${p.slug}`,
                      primary: p.name,
                      meta: `${formatTrendDelta(p.trendDelta7d)} · UF ${ufPctFromFc(p.ufConfidence)}%`,
                      extra: <MovementNarrativeLine text={narrativeBySlug.get(p.slug)} />,
                    }))}
                  />
                </div>
              </div>
            </FutureCastPanelShell>
          ) : null}

          <SmartAlertsPanel alerts={smartAlerts} />
        </>
      ) : null}
    </>
  );
}
