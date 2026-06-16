/** Player profile slug patterns — static export rewrites share one index.html per route. */
export const PLAYER_SLUG_PATTERNS = {
  roster: /\/(?:vault\/players|team\/player)\/([^/]+)\/?$/,
  recruiting: /\/(?:vault\/recruiting\/player|recruiting\/player)\/([^/]+)\/?$/,
  futurecast: /\/(?:vault\/futurecast\/player|futurecast\/player)\/([^/]+)\/?$/,
  portal: /\/vault\/portal\/player\/([^/]+)\/?$/,
  standalone: /\/player\/([^/]+)\/?$/,
} as const;

/** Read player slug synchronously from pathname + browser URL (static rewrite safe). */
export function playerSlugFromPath(pathname: string, pattern: RegExp): string {
  const paths: string[] = [];
  if (pathname) paths.push(pathname);
  if (typeof window !== 'undefined') {
    const browser = window.location.pathname;
    if (browser && !paths.includes(browser)) paths.unshift(browser);
  }
  for (const path of paths) {
    const match = path.match(pattern);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return '';
}
