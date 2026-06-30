/** Game Week team logo keys — SVG components only (see TeamLogo.tsx). */

export const UF_TEAM_KEY = 'uf';

export const OPPONENT_TEAM_KEYS: Record<string, string> = {
  fau: 'fau',
  charlotte: 'charlotte',
  auburn: 'auburn',
  olemiss: 'olemiss',
  missouri: 'missouri',
  lsu: 'lsu',
  texas: 'texas',
  uga: 'uga',
  oklahoma: 'oklahoma',
  kentucky: 'kentucky',
  vandy: 'vandy',
  scar: 'scar',
  fsu: 'fsu',
};

export function opponentTeamKey(gameId: string): string {
  return OPPONENT_TEAM_KEYS[gameId] ?? gameId;
}

/** @deprecated Use TeamLogo component — PNG URLs removed per brand spec. */
export function ufLogoUrl(): string {
  return '/teams/uf.svg';
}

/** @deprecated Use TeamLogo component — PNG URLs removed per brand spec. */
export function opponentLogoUrl(gameId: string): string {
  return `/teams/${opponentTeamKey(gameId)}.svg`;
}
