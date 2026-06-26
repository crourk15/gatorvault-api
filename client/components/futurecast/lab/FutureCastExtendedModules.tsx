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
import { FlipWatchScoreStack } from './FlipWatchScoreStack';
import { UfTrendSparkline } from '@/components/futurecast/UfTrendSparkline';
import { PlayerIntelTimelineStrip } from './PlayerIntelTimelineStrip';
import { ufPctFromFc, isBattleTarget } from './fc-lab-types';
import { FUTURECAST_LAB_ANCHORS, playerProfileRoute } from '@/lib/vault-route-map';
import { EarlyDiscoveryPreview } from '@/components/futurecast/EarlyDiscoveryPreview';
import {
  getPortalSeasonState,
  primaryRecruitingClassYear,
  shouldShowPortalWatchlist,
} from '@/lib/recruiting-cycle';

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
};

function formatUfDisplay(
  p: { ufProbability?: number | null; ufProbabilityLabel?: string | null }
): string {
  const pct = Math.round(p.ufProbability ?? 0);
  if (p.ufProbabilityLabel) return `${p.ufProbabilityLabel} ${pct}%`;
  return `${pct}%`;
}

function formatMetric(value: number | null | undefined, suffix = '%'): string {
  if (value == null || Number.isNaN(value)) return 'TBD';
  return `${Math.round(value)}${suffix}`;
}

function formatTrendDelta(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return 'TBD';
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

function formatCompetitorLabel(p: UnderclassmenPlayer): string {
  const top = p.competingSchools?.[0];
  if (!top?.name) return '';
  const short = top.name.replace(/\bUniversity\b/gi, '').trim().split(' ')[0]?.slice(0, 8) || top.name.slice(0, 8);
  const pct = top.pct != null && Number.isFinite(top.pct) ? Math.round(top.pct) : null;
  return pct != null ? ` · vs ${short} ${pct}%` : ` · vs ${short} TBD`;
}

function formatEarlyMovement(p: UnderclassmenPlayer): string {
  const move = p.earlyMovement ?? p.trendDelta7d;
  if (move == null || Number.isNaN(move) || Math.abs(move) < 0.005) return '';
  const pct = move <= 1 && move >= -1 ? Math.round(move * 100) : Math.round(move);
  return ` · Δ${pct > 0 ? '+' : ''}${pct}%`;
}

function formatUnderclassmenMeta(p: UnderclassmenPlayer): string {
  const tierLabel = p.tier === 'watchlist' ? 'Watch' : 'Target';
  const uf = formatMetric(p.ufConfidence);
  const fit = formatMetric(p.fitScore);
  const stars = Number(p.stars) > 0 ? `${Number(p.stars)}★` : '—★';
  return `${tierLabel} · UF ${uf} · Fit ${fit}${formatEarlyMovement(p)}${formatCompetitorLabel(p)} · ${stars}`;
}

function MovementNarrativeLine({ text }: { text: string | null | undefined }): React.ReactElement | null {
  if (!text) return null;
  return <p className="fc-lab-movement-narrative">{text}</p>;
}

function FitBar({ label, value }: { label: string; value: number }): React.ReactElement {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="fc-lab-fit-row">
      <span className="fc-lab-fit-row__label">{label}</span>
      <div className="fc-lab-fit-row__track">
        <div className="fc-lab-fit-row__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="fc-lab-fit-row__val">{pct}</span>
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

function SmartAlertsPanel({ alerts }: { alerts: IntelFeedItem[] }): React.ReactElement {
  return (
    <FutureCastPanelShell title="Smart Alerts" sub="Deduped movement, visits, and staff intel." testId="fc-lab-smart-alerts">
      {alerts.length === 0 ? (
        <p className="rh-cc-empty">No alerts — monitoring allowlist targets.</p>
      ) : (
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
      )}
      <p className="fc-lab-panel-footer">
        <a href="/vault/futurecast/alerts" data-testid="fc-lab-alerts-view-all">
          View all alerts →
        </a>
      </p>
    </FutureCastPanelShell>
  );
}

export function FutureCastExtendedModules({
  masterBoard,
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
  const activeTargets = useMemo(
    () =>
      masterBoard.players.filter(
        (p) => !p.committedTo || !/\bflorida\b|\bgators\b/i.test(String(p.committedTo))
      ),
    [masterBoard.players]
  );

  const earlyBattles = useMemo(
    () =>
      activeTargets
        .filter((p) => isBattleTarget(ufPctFromFc(p.ufConfidence)))
        .sort((a, b) => b.volatility7d - a.volatility7d)
        .slice(0, 8),
    [activeTargets]
  );

  const youngerProspects = useMemo(
    () =>
      underclassmen
        .filter((p) => (Number(p.classYear) || 0) >= 2028)
        .sort((a, b) => (b.ufConfidence ?? -1) - (a.ufConfidence ?? -1))
        .slice(0, 12),
    [underclassmen]
  );

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
    const up = trendingBoard.trendingUp.slice(0, 5);
    const down = trendingBoard.trendingDown.slice(0, 5);
    return { up, down };
  }, [trendingBoard]);

  const smartAlerts = useMemo(() => {
    const raw: IntelFeedItem[] = [];
    for (const p of movementIntel.risers.slice(0, 4)) {
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
    for (const p of movementIntel.highVolatility.slice(0, 3)) {
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
    for (const alert of movementIntel.alerts.slice(0, 4)) {
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
    for (const row of visitRecap.slice(0, 3)) {
      raw.push(
        buildIntelFeedItem({
          id: `recap-${row.slug}-${row.visitStart}`,
          playerName: row.name,
          headline: row.movementNarrative
            ? `${row.name} — ${row.movementNarrative}`
            : `${row.name} — verified UF OV completed (${row.visitStart}${row.visitEnd ? `–${row.visitEnd}` : ''})`,
          timestamp: row.visitEnd ?? row.visitStart,
          category: 'Visit',
          source: row.visitSourceLabel ?? undefined,
        })
      );
    }
    for (const row of movementNarratives.slice(0, 3)) {
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
    return dedupeIntelFeedItems(raw, 8);
  }, [movementIntel, flipWatch, visitRecap, upcomingVisitIntel, movementNarratives]);

  const fitLeaders = highPriority.slice(0, 3);
  const discoveryFocus = useMemo(
    () => !shouldShowPortalWatchlist(getPortalSeasonState()),
    []
  );
  const discoveryYear = primaryRecruitingClassYear();

  return (
    <>
      {discoveryFocus ? (
        <FutureCastPanelShell
          title={`${discoveryYear} Early Discovery`}
          sub="Underclassmen ranked by discovery score — Vault est. ratings until On3 sync."
          testId="fc-lab-early-discovery"
          action={
            <a href="/vault/futurecast/big-board" className="rh-cc-link">
              Full board →
            </a>
          }
        >
          <EarlyDiscoveryPreview
            query={{ class_year_gte: discoveryYear, limit: 4 }}
            footerHref="/vault/futurecast/big-board"
            footerLabel="Open Early Discovery board →"
          />
        </FutureCastPanelShell>
      ) : null}

      <FutureCastPanelShell
        title="Younger Prospects — Underclassmen Watchboard"
        sub="2028–2030 early intel from FutureCast discovery pipeline."
        testId="fc-lab-underclassmen"
      >
        <ModuleList
          empty="No underclassmen watchlist loaded."
          items={youngerProspects.map((p) => ({
            key: p.slug,
            primary: `${p.name} · ${p.position && p.position !== 'TBD' ? p.position : 'TBD'} · '${String(p.classYear || '').slice(2) || 'TBD'}`,
            meta: formatUnderclassmenMeta(p),
            href: playerProfileRoute(p.slug, 'futurecast'),
          }))}
        />
      </FutureCastPanelShell>

      <FutureCastPanelShell
        title="Early Battles to Monitor"
        sub="Allowlist targets in the 34–67% UF battle zone."
        testId="fc-lab-early-battles"
      >
        <ModuleList
          empty="No active battles on the board."
          items={earlyBattles.map((p) => ({
            key: p.slug,
            primary: p.name,
            meta: `${p.position} · UF ${ufPctFromFc(p.ufConfidence)}% · vol ${p.volatility7d.toFixed(1)}`,
            href: playerProfileRoute(p.slug, 'futurecast'),
          }))}
        />
      </FutureCastPanelShell>

      <FutureCastPanelShell title="Fit Score Breakdown" sub="Scheme, staff, and roster-fit leaders." testId="fc-lab-fit-breakdown">
        {fitLeaders.length === 0 ? (
          <p className="rh-cc-empty">Fit breakdown unavailable.</p>
        ) : (
          fitLeaders.map((p) => (
            <div key={p.slug} className="fc-lab-fit-card">
              <p className="fc-lab-fit-card__name">
                {p.name} · {p.position}
              </p>
              <FitBar label="Scheme / Fit" value={p.fitScore ?? 0} />
              <FitBar label="Staff confidence" value={p.staffConfidence ?? 0} />
              <FitBar label="UF likelihood" value={p.ufProbability ?? 0} />
              {(p.trendHistory?.length ?? 0) >= 2 ? (
                <UfTrendSparkline values={p.trendHistory.map((point) => point.confidence)} />
              ) : null}
              <FitBar label="Momentum" value={Math.max(0, Math.min(100, (p.movementDelta ?? 0) + 50))} />
            </div>
          ))
        )}
      </FutureCastPanelShell>

      <FutureCastPanelShell title="Staff Confidence Index (SCI)" sub="Analyst conviction on top targets." testId="fc-lab-sci">
        <ModuleList
          empty="SCI data unavailable."
          items={highPriority
            .slice()
            .sort((a, b) => (b.staffConfidence ?? 0) - (a.staffConfidence ?? 0))
            .slice(0, 6)
            .map((p) => ({
              key: p.slug,
              primary: p.name,
              meta: `SCI ${Math.round(p.staffConfidence ?? 0)} · UF ${formatUfDisplay(p)}`,
              href: playerProfileRoute(p.slug, 'futurecast'),
            }))}
        />
      </FutureCastPanelShell>

      <section id={FUTURECAST_LAB_ANCHORS.visits}>
      <FutureCastPanelShell
        title="2027 Visit Intel"
        sub="On3- and beat-verified official visit windows only. Unconfirmed schedules are not listed."
        testId="fc-lab-timeline"
      >
        <ModuleList
          empty="No verified upcoming official visits on file."
          items={upcomingVisitIntel.slice(0, 6).map((p) => ({
              key: p.slug,
              primary: p.name,
              badge: p.visitVerified !== false ? <GatorVaultConfirmedBadge sourceLabel={p.visitSourceLabel} compact /> : undefined,
              meta: p.visitStart
                ? `OV ${p.visitStart}${p.visitEnd ? `–${p.visitEnd}` : ''}${p.visitSourceLabel ? ` · ${p.visitSourceLabel}` : ''} · UF ${formatUfDisplay(p)}`
                : `${p.ufOvStatus ?? 'Visit intel'}${p.visitSourceLabel ? ` · ${p.visitSourceLabel}` : ''} · UF ${formatUfDisplay(p)}`,
              href: playerProfileRoute(p.slug, 'futurecast'),
            }))}
        />
      </FutureCastPanelShell>

      <FutureCastPanelShell
        title="Verified OV Recap"
        sub="Completed official visits with On3 or beat verification."
        testId="fc-lab-visit-recap"
      >
        <ModuleList
          empty="No verified completed official visits on file."
          items={visitRecap.slice(0, 6).map((row) => ({
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

      <FutureCastPanelShell
        title="Flip Watch"
        sub="Committed elsewhere after a verified UF official visit — composite flip score from UF %, OV recency, rival commit, and beat sentiment."
        testId="fc-lab-flip-watch"
      >
        <ModuleList
          empty="No flip-watch targets on file."
          items={flipWatch.slice(0, 6).map((row) => ({
            key: `flip-${row.slug}`,
            primary: row.name,
            badge: <GatorVaultConfirmedBadge sourceLabel={row.visitSourceLabel} compact />,
            meta: `${row.committedShort} commit · OV ${row.visitStart ?? '—'}${row.visitEnd ? `–${row.visitEnd}` : ''}${row.visitSourceLabel ? ` · ${row.visitSourceLabel}` : ''} · UF ${formatUfDisplay(row)}`,
            extra: (
              <>
                <MovementNarrativeLine text={row.movementNarrative} />
                <FlipWatchScoreStack row={row} />
                <PlayerIntelTimelineStrip slug={row.slug} staffNotes={staffNotes} />
              </>
            ),
            href: playerProfileRoute(row.slug, 'futurecast'),
          }))}
        />
      </FutureCastPanelShell>
      </section>

      <FutureCastPanelShell title="30-Day Trend Engine" sub="Rolling UF probability movers (30d window)." testId="fc-lab-trend-30">
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

      <SmartAlertsPanel alerts={smartAlerts} />
    </>
  );
}
