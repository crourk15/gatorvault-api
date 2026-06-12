/**
 * Big Board Intelligence Engine — scoring + sorting.
 */
import type { BigBoardRawPlayer } from '../../models/big-board';
import {
  SCORE_WEIGHTS,
  POSITION_SORT_ORDER,
  type BigBoardSort,
  signalScoreFromTypes,
} from './utils';
import {
  computePortalLikelihood,
  portalIntelFromBigBoardRow,
} from '../portal/engine';
import { computeUfFitScore, ufFitIntelFromBigBoardRow } from '../uf-fit/engine';

export interface BigBoardPlayer {
  id: string;
  fullName: string;
  slug: string;
  classYear: number;
  position: string;
  lifecycle: string;
  portalStatus: string | null;
  signalCount: number;
  portalLikelihood: number;
  ufFitScore: number;
  rank: number;
  totalScore: number;
}

function computeUfFitScoreFromRow(row: BigBoardRawPlayer): number {
  return computeUfFitScore(ufFitIntelFromBigBoardRow(row));
}

function computePortalLikelihoodFromRow(row: BigBoardRawPlayer): number {
  return computePortalLikelihood(portalIntelFromBigBoardRow(row));
}

function computeTotalScore(
  signalScore: number,
  portalLikelihood: number,
  ufFitScore: number
): number {
  const ufNormalized = ufFitScore / 100;
  return (
    signalScore * SCORE_WEIGHTS.signal +
    portalLikelihood * 100 * SCORE_WEIGHTS.portalLikelihood +
    ufNormalized * 100 * SCORE_WEIGHTS.ufFit
  );
}

function enrichRow(row: BigBoardRawPlayer): Omit<BigBoardPlayer, 'rank'> {
  const signalScore = signalScoreFromTypes(row.signal_types);
  const portalLikelihood = computePortalLikelihoodFromRow(row);
  const ufFitScore = computeUfFitScoreFromRow(row);
  const totalScore = computeTotalScore(signalScore, portalLikelihood, ufFitScore);

  return {
    id: row.id,
    fullName: row.full_name,
    slug: row.slug,
    classYear: row.class_year,
    position: row.position,
    lifecycle: row.lifecycle,
    portalStatus: row.portal_status,
    signalCount: row.signal_count,
    portalLikelihood: Math.round(portalLikelihood * 1000) / 1000,
    ufFitScore: Math.round(ufFitScore),
    totalScore: Math.round(totalScore * 100) / 100,
  };
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

export function sortBigBoardPlayers(
  rows: BigBoardRawPlayer[],
  sort: BigBoardSort,
  order: 'asc' | 'desc'
): BigBoardPlayer[] {
  const enriched = rows.map(enrichRow);

  const sorted = [...enriched].sort((a, b) => {
    let cmp = 0;
    switch (sort) {
      case 'rank':
        cmp = b.totalScore - a.totalScore;
        break;
      case 'signals':
        cmp = b.signalCount - a.signalCount;
        break;
      case 'portalLikelihood':
        cmp = b.portalLikelihood - a.portalLikelihood;
        break;
      case 'ufFit':
        cmp = b.ufFitScore - a.ufFitScore;
        break;
      case 'name':
        cmp = compareStrings(a.fullName, b.fullName);
        break;
      case 'position': {
        const aOrder = POSITION_SORT_ORDER[a.position] ?? 999;
        const bOrder = POSITION_SORT_ORDER[b.position] ?? 999;
        cmp = aOrder - bOrder || compareStrings(a.fullName, b.fullName);
        break;
      }
      default:
        cmp = b.totalScore - a.totalScore;
    }
    return order === 'asc' ? -cmp : cmp;
  });

  return sorted.map((player, index) => ({
    id: player.id,
    fullName: player.fullName,
    slug: player.slug,
    classYear: player.classYear,
    position: player.position,
    lifecycle: player.lifecycle,
    portalStatus: player.portalStatus,
    signalCount: player.signalCount,
    portalLikelihood: player.portalLikelihood,
    ufFitScore: player.ufFitScore,
    rank: index + 1,
  }));
}

export function buildBigBoard(
  rows: BigBoardRawPlayer[],
  sort: BigBoardSort,
  order: 'asc' | 'desc',
  limit: number
): BigBoardPlayer[] {
  return sortBigBoardPlayers(rows, sort, order).slice(0, limit);
}
