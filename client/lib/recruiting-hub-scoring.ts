/**
 * Client-side recruiting hub scoring helpers (mirrors server/lib/recruiting-hub-scoring.js).
 */

export type BattleColor = 'blue' | 'orange' | 'red';

export function getBattleColor(ufScore: number): BattleColor {
  if (ufScore >= 70) return 'blue';
  if (ufScore >= 40) return 'orange';
  return 'red';
}

export function getPinColor(
  pinType: 'commit' | 'target' | 'portal' | 'battle',
  ufScore: number,
  battleDifficulty?: string
): string {
  if (pinType === 'commit') return '#0021A5';
  if (battleDifficulty === 'flip' || pinType === 'battle') return '#9333EA';
  if (ufScore >= 50) return '#F97316';
  if (ufScore < 40) return '#DC2626';
  return '#F97316';
}

export function getHeatColor(pipelineScore: number): string {
  if (pipelineScore >= 60) return '#0021A5';
  if (pipelineScore >= 30) return '#F97316';
  return '#9CA3AF';
}

export function getOutlineColor(ufScore: number): string {
  if (ufScore >= 70) return '#0021A5';
  if (ufScore >= 40) return '#F97316';
  return '#DC2626';
}

export function momentumSymbol(momentum: 'up' | 'down' | 'flat'): string {
  if (momentum === 'up') return '▲';
  if (momentum === 'down') return '▼';
  return '→';
}
