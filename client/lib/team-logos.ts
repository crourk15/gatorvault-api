/** Official ESPN team logos for Game Week matchup widgets (img src). */

export const UF_ESPN_TEAM_ID = 57;

export const OPPONENT_ESPN_IDS: Record<string, number> = {
  fau: 2226,
  campbell: 2097,
  auburn: 2,
  olemiss: 145,
  missouri: 142,
  texas: 251,
  uga: 61,
  oklahoma: 201,
  kentucky: 96,
  vandy: 238,
  scar: 2579,
  fsu: 52,
};

export function espnTeamLogoUrl(teamId: number): string {
  return `https://a.espncdn.com/i/teamlogos/ncaa/500/${teamId}.png`;
}

export function ufLogoUrl(): string {
  return espnTeamLogoUrl(UF_ESPN_TEAM_ID);
}

export function opponentLogoUrl(gameId: string): string {
  const id = OPPONENT_ESPN_IDS[gameId];
  if (!id) return espnTeamLogoUrl(UF_ESPN_TEAM_ID);
  return espnTeamLogoUrl(id);
}

export function homeLogoUrl(): string {
  return ufLogoUrl();
}

export function awayLogoUrl(gameId: string): string {
  return opponentLogoUrl(gameId);
}
