/**
 * FutureCast prediction card — VaultBigBoardCard chrome.
 */
'use client';

import React from 'react';
import { type FeedPrediction } from '../lib/predictions-api';
import { VaultBigBoardCard, modelFromPrediction } from '@/components/futurecast/VaultBigBoardCard';

export interface PredictionCardData {
  playerId: string;
  playerSlug?: string;
  playerName: string;
  position: string;
  class: number | string;
  team: string;
  confidence: number;
  delta?: number;
  ufFitScore?: number | null;
  ufProbability?: number | null;
  stabilityScore?: number;
  volatilityScore?: number;
  createdAt: string;
  compositeScore?: number;
  nationalRank?: number | null;
  positionRank?: number | null;
  stateRank?: number | null;
  stars?: number | null;
  rating?: number | null;
  natlRank?: number | null;
}

export interface PredictionCardProps {
  prediction: PredictionCardData;
}

export function feedPredictionToCard(p: FeedPrediction): PredictionCardData {
  return {
    playerId: p.playerId,
    playerSlug: p.playerSlug,
    playerName: p.fullName,
    position: p.position,
    class: p.classYear,
    team: p.school,
    confidence: p.confidence,
    delta: p.delta,
    ufFitScore: p.ufFitScore,
    ufProbability: p.ufProbability,
    stabilityScore: p.stabilityScore,
    volatilityScore: p.volatilityScore,
    createdAt: p.createdAt,
    compositeScore: p.compositeScore,
    nationalRank: p.nationalRank,
    positionRank: p.positionRank,
    stateRank: p.stateRank,
    stars: p.stars,
    rating: p.rating,
    natlRank: p.natlRank,
  };
}

function cardDataToFeed(data: PredictionCardData): FeedPrediction {
  return {
    id: data.playerId,
    playerId: data.playerId,
    playerSlug: data.playerSlug ?? data.playerId,
    fullName: data.playerName,
    classYear: Number(data.class) || 2027,
    position: data.position,
    lifecycle: 'HIGH_SCHOOL',
    school: data.team,
    confidence: data.confidence,
    delta: data.delta,
    sourceType: 'MODEL',
    predictorId: 'model',
    status: 'ACTIVE',
    createdAt: data.createdAt,
    updatedAt: data.createdAt,
    ufFitScore: data.ufFitScore,
    ufProbability: data.ufProbability,
    stabilityScore: data.stabilityScore,
    volatilityScore: data.volatilityScore,
    compositeScore: data.compositeScore ?? 0,
    nationalRank: data.nationalRank ?? null,
    positionRank: data.positionRank ?? null,
    stateRank: data.stateRank ?? null,
    stars: data.stars ?? undefined,
    rating: data.rating ?? undefined,
    natlRank: data.natlRank ?? undefined,
  };
}

export function PredictionCard({ prediction }: PredictionCardProps): React.ReactElement {
  return (
    <div data-testid="prediction-card">
      <VaultBigBoardCard model={modelFromPrediction(cardDataToFeed(prediction))} profileContext="futurecast" />
    </div>
  );
}
