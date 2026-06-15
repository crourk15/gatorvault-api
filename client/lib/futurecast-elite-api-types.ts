/**
 * FutureCast Elite API Response Types (client mirror)
 *
 * Canonical server definitions: `server/types/futurecast-elite-api.ts`
 *
 * These fields power the Elite Player Cards and all FutureCast UI surfaces.
 *
 * ufProbability (number):
 *    - FutureCast model commit likelihood for Florida.
 *    - Represents the statistical probability UF lands the player.
 *
 * staffConfidence (number):
 *    - Insider / staff sentiment score.
 *    - Reflects internal confidence based on notes, evaluations, and recruiting feel.
 *
 * fitScore (number):
 *    - Scheme + roster + athletic fit score.
 *    - Represents how well the player fits Florida’s system and positional needs.
 *
 * priorityScore (number):
 *    - Weighted importance metric for UF’s class strategy.
 *    - Represents how big of a priority the player is for the 2027 class.
 *    - Not a probability — this is an importance ranking.
 *
 * Additional shared fields:
 *    - playerName (string)
 *    - playerSlug (string | undefined)
 *    - position (string)
 *    - school (string)
 *    - city (string)
 *    - state (string)
 *    - compositeScore (number)
 *    - nationalRank (number)
 *    - positionRank (number)
 *    - stateRank (number)
 *    - fitScore (number)
 *    - createdAt (string | Date)
 */

export interface FutureCastEliteCoreMetrics {
  ufProbability: number;
  staffConfidence: number;
  fitScore: number;
  priorityScore: number;
}

export interface FutureCastElitePlayerFields {
  playerName: string;
  playerSlug?: string;
  position: string;
  school: string;
  city?: string;
  state?: string;
  compositeScore: number;
  nationalRank: number;
  positionRank: number;
  stateRank: number;
  createdAt: string | Date;
}

export interface FutureCastElitePlayerResponse
  extends FutureCastEliteCoreMetrics,
    FutureCastElitePlayerFields {}
