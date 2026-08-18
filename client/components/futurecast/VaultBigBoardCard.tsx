'use client';

import React from 'react';
import type { BigBoardPlayer } from '@/lib/big-board-api';
import type { EarlyDiscoveryPlayer } from '@/lib/early-discovery-api';
import type { FeedPrediction } from '@/lib/predictions-api';
import type { PortalWatchlistPlayer } from '@/lib/portal-api';
import type { PortalWatchlistHomePlayer } from '@/lib/futurecast-home-api';
import type { UfFitWatchlistPlayer } from '@/lib/uf-fit-api';
import { formatRecruitSchoolLabel } from '@/lib/recruiting-display-utils';
import { playerProfilePath } from '@/lib/player-routes';
import type { PlayerProfileContext } from '@/lib/vault-route-map';
import { VaultNavLink } from '@/components/vault/VaultNavLink';

export type VaultBigBoardMode =
  | 'intel'
  | 'best-fits'
  | 'early-discovery'
  | 'portal'
  | 'prediction';

type StampTone = 'hot' | 'fit' | 'intel' | 'signal' | 'board' | 'chase';

type MetricCell = { label: string; value: string };

export type VaultBigBoardCardModel = {
  slug: string;
  name: string;
  position: string | null;
  stars: number | null;
  school: string;
  classYear: number | null;
  inState: boolean;
  onBoard: boolean;
  ratingLabel: string;
  ratingValue: string;
  skinny: string;
  stamp: { label: string; tone: StampTone };
  metrics: [MetricCell, MetricCell, MetricCell];
};

function positionMark(position: string | null | undefined): string {
  const raw = String(position || '').trim().toUpperCase();
  if (!raw) return '-';
  return raw.length <= 4 ? raw : raw.slice(0, 3);
}

function schoolLooksInState(school: string | null | undefined, state?: string | null): boolean {
  if (state && String(state).toUpperCase() === 'FL') return true;
  return /\bFL\b|\(FL\)|,\s*FL\b|Florida/i.test(String(school || ''));
}

function fmtScore(n: number | null | undefined, fallback = '-'): string {
  if (n == null || !Number.isFinite(Number(n)) || Number(n) <= 0) return fallback;
  return String(Math.round(Number(n)));
}

function fmtRating(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n)) || Number(n) <= 0) return '-';
  const v = Number(n);
  return v >= 10 ? v.toFixed(1) : String(Math.round(v));
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n)) || Number(n) <= 0) return '-';
  const raw = Number(n);
  const pct = raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
  return `${pct}%`;
}

function lastName(name: string): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((p) => !/^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(p));
  return parts.length ? parts[parts.length - 1] : name;
}

/** Intelligence Rank — Intel / Signals / Fit */
export function modelFromIntel(player: BigBoardPlayer): VaultBigBoardCardModel {
  const name = player.fullName;
  const school =
    formatRecruitSchoolLabel(player.school ?? undefined, player.state ?? undefined) ||
    String(player.school || 'High school TBD');
  const onBoard = false; // broad feed — board badge only when we know allowlist
  const composite = player.compositeScore ?? player.rating ?? null;
  const isLiveOn3 = (player.nationalRank ?? player.natlRank ?? 0) > 0 && Number(composite) > 0;
  const inState = Boolean(player.inState) || schoolLooksInState(school, player.state);
  const signals = Math.max(0, Math.round(Number(player.signalCount) || 0));
  const stampTone: StampTone = player.rank <= 3 ? 'intel' : signals >= 8 ? 'signal' : 'intel';
  const stampLabel = player.rank <= 5 ? `Intel #${player.rank}` : signals >= 8 ? 'Signals' : `Intel #${player.rank}`;
  return {
    slug: player.slug,
    name,
    position: player.position || null,
    stars: player.stars ?? null,
    school,
    classYear: player.classYear ?? null,
    inState,
    onBoard,
    ratingLabel: isLiveOn3 ? 'Composite' : 'Vault est.',
    ratingValue: fmtRating(composite),
    skinny:
      player.rank === 1
        ? `Most FutureCast signal heat on this board — Intelligence Rank tracks attention + Fit, not chase Priority.`
        : `Signal stack keeps ${lastName(name)} on Intelligence Rank — broad feed, not Best Fits or Priority Chase order.`,
    stamp: { label: stampLabel, tone: stampTone },
    metrics: [
      { label: 'Intel', value: `#${player.rank}` },
      { label: 'Signals', value: signals > 0 ? String(signals) : '-' },
      { label: 'Fit', value: fmtScore(player.ufFitScore) },
    ],
  };
}

/** Best Fits — Hot / Fit / Need */
export function modelFromBestFits(player: UfFitWatchlistPlayer): VaultBigBoardCardModel {
  const name = player.fullName;
  const school = formatRecruitSchoolLabel(player.school ?? undefined) || String(player.school || 'High school TBD');
  const onBoard = Boolean(player.chase?.allowlisted);
  const hot = player.hotScore != null ? Math.round(player.hotScore) : null;
  const fit = player.ufFitScore > 0 ? Math.round(player.ufFitScore) : null;
  const need =
    player.hotLanes?.positionalNeed != null && Number(player.hotLanes.positionalNeed) > 0
      ? Math.round(Number(player.hotLanes.positionalNeed))
      : null;
  const composite = player.compositeScore ?? null;
  const isLiveOn3 = player.ratingSource === 'on3' && Number(composite) > 0;
  const inState = Boolean(player.inState) || Boolean(player.hotBadges?.inState) || schoolLooksInState(school);
  let stamp: VaultBigBoardCardModel['stamp'];
  if (player.rank === 1) stamp = { label: '#1 Hot', tone: 'hot' };
  else if (fit != null && fit >= 80) stamp = { label: 'Top Fit', tone: 'fit' };
  else stamp = { label: `Hot #${player.rank}`, tone: 'chase' };

  return {
    slug: player.slug,
    name,
    position: player.position || null,
    stars: player.stars ?? null,
    school,
    classYear: player.classYear ?? null,
    inState,
    onBoard,
    ratingLabel: isLiveOn3 ? 'Composite' : 'Vault est.',
    ratingValue: fmtRating(composite),
    skinny:
      player.rank === 1
        ? `Hottest scheme fit on the board — Hot / Fit / Need put ${lastName(name)} at #1 (not Priority Chase order).`
        : onBoard
          ? `On Florida's board with strong scheme Fit — Best Fits ranks heat for UF, not chase Priority.`
          : `Scheme Fit keeps ${lastName(name)} high on Best Fits — Hot Targets math, not discovery score.`,
    stamp,
    metrics: [
      { label: 'Hot', value: hot != null ? String(hot) : '-' },
      { label: 'Fit', value: fit != null ? String(fit) : '-' },
      { label: 'Need', value: need != null ? String(need) : '-' },
    ],
  };
}

/** Early Discovery — Discovery / UF Shot / Fit */
export function modelFromEarlyDiscovery(player: EarlyDiscoveryPlayer): VaultBigBoardCardModel {
  const name = player.fullName;
  const school =
    formatRecruitSchoolLabel(player.school ?? undefined, player.state ?? undefined) ||
    String(player.school || 'High school TBD');
  const onBoard = player.allowlistTarget === true;
  const composite = player.compositeScore ?? null;
  const isLiveOn3 = player.ratingSource === 'on3' && Number(composite) > 0;
  const inState = Boolean(player.inState) || schoolLooksInState(school, player.state);
  const ufShot = player.ufProbability != null ? fmtPct(player.ufProbability) : '-';
  const stamp: VaultBigBoardCardModel['stamp'] = onBoard
    ? { label: 'UF Board', tone: 'board' }
    : { label: 'Rising', tone: 'signal' };

  return {
    slug: player.slug,
    name,
    position: player.position || null,
    stars: player.stars ?? null,
    school,
    classYear: player.classYear ?? null,
    inState,
    onBoard,
    ratingLabel: isLiveOn3 ? 'Composite' : 'Vault est.',
    ratingValue: fmtRating(composite),
    skinny: onBoard
      ? `On Florida's ${player.classYear} board — discovery ${fmtScore(player.discoveryScore)} keeps ${lastName(name)} high on the underclassmen radar.`
      : `Rising discovery heat — ${lastName(name)} is climbing the Early Discovery board before a hard UF board lock.`,
    stamp,
    metrics: [
      { label: 'Discovery', value: fmtScore(player.discoveryScore) },
      { label: 'UF Shot', value: ufShot },
      { label: 'Fit', value: fmtScore(player.ufFitScore) },
    ],
  };
}

/** 2029–2030 Names to know — Natl / Stars / Pos (no chase UF% theater). */
export function modelFromYoungerProspect(player: {
  slug: string;
  name: string;
  position?: string | null;
  stars?: number | null;
  school?: string | null;
  state?: string | null;
  classYear?: number | null;
  natlRank?: number | null;
  rivalsNatlRank?: number | null;
  posRank?: number | null;
  composite?: number | null;
  tier?: string | null;
}): VaultBigBoardCardModel {
  const name = player.name;
  const school =
    formatRecruitSchoolLabel(player.school ?? undefined, player.state ?? undefined) ||
    String(player.school || 'High school TBD');
  const year = Number(player.classYear) || null;
  const natl = Number(player.natlRank ?? player.rivalsNatlRank);
  const hasNatl = Number.isFinite(natl) && natl > 0;
  const composite = player.composite != null && Number(player.composite) > 0 ? Number(player.composite) : null;
  const inState = schoolLooksInState(school, player.state);
  const earlyWatch = (year != null && year >= 2030) || player.tier === 'watchlist';
  const stamp: VaultBigBoardCardModel['stamp'] = hasNatl
    ? { label: `#${Math.round(natl)}`, tone: 'intel' }
    : earlyWatch
      ? { label: 'Early watch', tone: 'signal' }
      : { label: 'Early target', tone: 'board' };

  return {
    slug: player.slug,
    name,
    position: player.position || null,
    stars: player.stars ?? null,
    school,
    classYear: year,
    inState,
    onBoard: false,
    ratingLabel: composite != null ? 'Composite' : 'Vault est.',
    ratingValue: fmtRating(composite),
    skinny: hasNatl
      ? `Rivals/On3 early board — ${lastName(name)} checks in at #${Math.round(natl)} for the Class of ${year ?? '2029'}.`
      : `Early name to know for ${year ?? 2029} — Film Room watchboard before the chase board gets real.`,
    stamp,
    metrics: [
      { label: 'Natl', value: hasNatl ? `#${Math.round(natl)}` : '-' },
      { label: 'Stars', value: player.stars != null && Number(player.stars) >= 1 ? `${Math.round(Number(player.stars))}★` : '-' },
      { label: 'Pos', value: player.posRank != null && Number(player.posRank) > 0 ? `#${Math.round(Number(player.posRank))}` : '-' },
    ],
  };
}


/** Portal Watchlist — Portal / Depth / Vol */
export function modelFromPortal(
  player: PortalWatchlistPlayer | PortalWatchlistHomePlayer
): VaultBigBoardCardModel {
  const name = player.fullName;
  const portal = Math.round(Number(player.portalLikelihood) || 0);
  const depth = Math.round(Number(player.depthChartRisk) || 0);
  const vol = Math.round(Number(player.volatility) || 0);
  const stampTone: StampTone = portal >= 70 ? 'hot' : portal >= 40 ? 'chase' : 'intel';
  return {
    slug: player.slug,
    name,
    position: player.position || null,
    stars: null,
    school: 'Portal watchlist',
    classYear: player.classYear ?? null,
    inState: false,
    onBoard: false,
    ratingLabel: 'Portal',
    ratingValue: portal > 0 ? `${portal}%` : '-',
    skinny:
      portal >= 70
        ? `High portal likelihood — ${lastName(name)} sits near the top of the watchlist on exit risk + depth chart pressure.`
        : `Portal radar keeps ${lastName(name)} on the board — likelihood, depth-chart risk, and volatility only (not chase Priority).`,
    stamp: { label: `Portal #${player.rank}`, tone: stampTone },
    metrics: [
      { label: 'Portal', value: portal > 0 ? `${portal}%` : '-' },
      { label: 'Depth', value: depth > 0 ? `${depth}%` : '-' },
      { label: 'Vol', value: vol > 0 ? String(vol) : '-' },
    ],
  };
}

/** Predictions feed — UF Shot / Fit / Conf */
export function modelFromPrediction(player: FeedPrediction): VaultBigBoardCardModel {
  const name = player.fullName;
  const school =
    formatRecruitSchoolLabel(player.school ?? undefined) || String(player.school || 'High school TBD');
  const composite = player.compositeScore ?? player.rating ?? null;
  const isLiveOn3 = (player.nationalRank ?? player.natlRank ?? 0) > 0 && Number(composite) > 0;
  const inState = schoolLooksInState(school);
  const conf = Math.round(Number(player.confidence) || 0);
  const delta = player.delta != null ? Number(player.delta) : 0;
  let stamp: VaultBigBoardCardModel['stamp'];
  if (delta > 0) stamp = { label: 'Rising', tone: 'signal' };
  else if (delta < 0) stamp = { label: 'Cooling', tone: 'chase' };
  else stamp = { label: conf >= 60 ? 'Lean UF' : 'Watch', tone: 'intel' };

  return {
    slug: player.playerSlug || player.playerId,
    name,
    position: player.position || null,
    stars: player.stars ?? null,
    school,
    classYear: typeof player.classYear === 'number' ? player.classYear : null,
    inState,
    onBoard: false,
    ratingLabel: isLiveOn3 ? 'Composite' : 'Vault est.',
    ratingValue: fmtRating(composite),
    skinny:
      delta > 0
        ? `Prediction heat rising for ${lastName(name)} — UF Shot / Fit / Conf from the FutureCast feed, not Priority Chase order.`
        : `FutureCast prediction stack for ${lastName(name)} — confidence + Fit, not Big Board Intelligence Rank.`,
    stamp,
    metrics: [
      { label: 'UF Shot', value: fmtPct(player.ufProbability ?? conf) },
      { label: 'Fit', value: fmtScore(player.ufFitScore) },
      { label: 'Conf', value: conf > 0 ? `${conf}%` : '-' },
    ],
  };
}

export function VaultBigBoardCard({
  model,
  profileContext = 'futurecast',
}: {
  model: VaultBigBoardCardModel;
  profileContext?: PlayerProfileContext;
}): React.ReactElement {
  const href = playerProfilePath(model.slug, 'HIGH_SCHOOL', true, model.name, profileContext);
  const lead = model.stamp.tone === 'hot' || model.stamp.tone === 'board';

  return (
    <article
      className={`gv-chase-card gv-bb-card${lead ? ' gv-chase-card--lead' : ''}`}
      data-testid="vault-big-board-card"
      data-stamp={model.stamp.tone}
    >
      <VaultNavLink href={href} className="gv-chase-card__link">
        <span className="gv-chase-card__watermark" aria-hidden>
          UF
        </span>

        <div className="gv-chase-card__top">
          <div className="gv-chase-card__mark" aria-hidden>
            <span className="gv-chase-card__pos">{positionMark(model.position)}</span>
            {model.stars != null && model.stars > 0 ? (
              <span className="gv-chase-card__stars">{model.stars}★</span>
            ) : null}
          </div>

          <div className="gv-chase-card__identity">
            <h3 className="gv-chase-card__name">{model.name}</h3>
            <p className="gv-chase-card__id-line">
              {model.stars != null && model.stars > 0 ? (
                <span className="gv-chase-card__id-stars">{model.stars}★</span>
              ) : null}
              {model.position ? <span className="gv-chase-card__id-pos">{model.position}</span> : null}
              {model.school ? <span className="gv-chase-card__id-home">{model.school}</span> : null}
            </p>
          </div>

          <span className={`gv-chase-card__stamp gv-chase-card__stamp--${model.stamp.tone}`}>
            {model.stamp.label}
          </span>
        </div>

        <ul className="gv-chase-card__rank-strip" aria-label="Board scores">
          {model.metrics.map((m) => (
            <li key={m.label} className="gv-chase-card__rank-cell">
              <span className="gv-chase-card__rank-num">{m.value}</span>
              <span className="gv-chase-card__rank-label">{m.label}</span>
            </li>
          ))}
        </ul>

        {(model.inState || model.onBoard) && (
          <div className="gv-chase-card__badges">
            {model.inState ? <span className="gv-chase-badge gv-chase-badge--instate">In-state</span> : null}
            {model.onBoard ? (
              <span className="gv-chase-badge gv-chase-badge--board">On the board</span>
            ) : null}
          </div>
        )}

        <p className="gv-chase-card__why-label">Why he&apos;s here</p>
        <p className="gv-chase-card__skinny">{model.skinny}</p>

        <div className="gv-chase-card__footer">
          <div className="gv-chase-card__footer-main">
            <span>{model.classYear ? `Class of ${model.classYear}` : 'High school'}</span>
            <span className="gv-chase-card__cta">Open profile →</span>
          </div>
          <div className="gv-chase-card__rating" aria-label={`${model.ratingLabel} ${model.ratingValue}`}>
            <span className="gv-chase-card__rating-label">{model.ratingLabel}</span>
            <span className="gv-chase-card__rating-value">{model.ratingValue}</span>
          </div>
        </div>
      </VaultNavLink>
    </article>
  );
}
