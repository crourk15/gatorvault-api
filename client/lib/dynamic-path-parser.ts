/** Parse dynamic segments from pathname (static-export rewrite safe). */

function pathsToTry(pathname: string): string[] {
  const paths: string[] = [];
  if (pathname) paths.push(pathname);
  if (typeof window !== 'undefined') {
    const browser = window.location.pathname;
    if (browser && !paths.includes(browser)) paths.unshift(browser);
  }
  return paths;
}

export function segmentFromPath(pathname: string, pattern: RegExp): string {
  for (const path of pathsToTry(pathname)) {
    const match = path.match(pattern);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return '';
}

export const DYNAMIC_PATH_PATTERNS = {
  recruitingPlayer: /\/recruiting\/player\/([^/]+)\/?$/,
  futurecastPlayer: /\/futurecast\/player\/([^/]+)\/?$/,
  teamPlayer: /\/team\/player\/([^/]+)\/?$/,
  scheduleSeason: /\/schedule\/([^/]+)\/?$/,
  gameWeekGame: /\/game-week\/([^/]+)\/?$/,
  article: /\/articles\/([^/]+)\/?$/,
  communityThread: /\/community\/thread\/([^/]+)\/?$/,
  gameZoneGame: /\/game-zone\/([^/]+)\/?$/,
  /** Legacy vault paths still supported during transition */
  vaultRecruitingPlayer: /\/vault\/recruiting\/player\/([^/]+)\/?$/,
  vaultFuturecastPlayer: /\/vault\/futurecast\/player\/([^/]+)\/?$/,
  vaultTeamPlayer: /\/vault\/players\/([^/]+)\/?$/,
} as const;
