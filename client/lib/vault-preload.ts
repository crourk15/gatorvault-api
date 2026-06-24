'use client';

import { VAULT_BOTTOM_NAV } from '@/lib/vault-routes';

type RouteAssets = {
  modules: string[];
  styles: string[];
};

type PlayerTemplateKey = 'roster' | 'recruiting' | 'futurecast' | 'portal';

type VaultRouteManifest = {
  version: number;
  buildId?: string | null;
  routes: Record<string, RouteAssets>;
  playerTemplates?: Record<PlayerTemplateKey, string>;
};

const PLAYER_ROUTE_RULES: { test: RegExp; templateKey: PlayerTemplateKey }[] = [
  { test: /^\/vault\/players\/[^/]+$/, templateKey: 'roster' },
  { test: /^\/vault\/recruiting\/player\/[^/]+$/, templateKey: 'recruiting' },
  { test: /^\/vault\/futurecast\/player\/[^/]+$/, templateKey: 'futurecast' },
  { test: /^\/vault\/portal\/player\/[^/]+$/, templateKey: 'portal' },
];

let manifestPromise: Promise<VaultRouteManifest | null> | null = null;
const htmlAssetCache = new Map<string, RouteAssets>();
const warmedRoutes = new Set<string>();
const inflightRoutes = new Map<string, Promise<void>>();

export function normalizeVaultPath(href: string): string {
  try {
    const path = new URL(href, 'https://gatorvaultinsider.com').pathname.replace(/\/$/, '') || '/';
    return path;
  } catch {
    return href.split('?')[0].split('#')[0].replace(/\/$/, '') || '/';
  }
}

function parseAssetsFromHtml(html: string): RouteAssets {
  const moduleRe = /\/(?:js\/vault-chunks|_next\/static\/chunks)\/[^"'\s<>]+\.js/g;
  const styleRe = /\/_next\/static\/css\/[^"'\s<>]+\.css/g;
  const modules = [...new Set([...html.matchAll(moduleRe)].map((m) => m[0]))];
  const styles = [...new Set([...html.matchAll(styleRe)].map((m) => m[0]))].filter(
    (href) => !html.includes(`data-gv-vault-shell-css="bundle" href="${href}"`)
  );
  return { modules, styles };
}

async function loadManifest(): Promise<VaultRouteManifest | null> {
  if (typeof window === 'undefined') return null;
  if (!manifestPromise) {
    manifestPromise = fetch('/js/vault-route-manifest.json', { cache: 'no-cache' })
      .then((res) => (res.ok ? (res.json() as Promise<VaultRouteManifest>) : null))
      .catch(() => null);
  }
  return manifestPromise;
}

function resolveManifestRoute(path: string, manifest: VaultRouteManifest): string | null {
  if (manifest.routes[path]) return path;

  for (const rule of PLAYER_ROUTE_RULES) {
    if (!rule.test.test(path)) continue;
    const template = manifest.playerTemplates?.[rule.templateKey];
    if (template && manifest.routes[template]) return template;
  }

  let cur = path;
  while (cur.startsWith('/vault')) {
    if (manifest.routes[cur]) return cur;
    const idx = cur.lastIndexOf('/');
    if (idx <= 0) break;
    cur = cur.slice(0, idx) || '/vault';
  }
  return manifest.routes['/vault'] ? '/vault' : null;
}

async function resolveRouteAssets(path: string): Promise<RouteAssets | null> {
  const manifest = await loadManifest();
  if (manifest) {
    const key = resolveManifestRoute(path, manifest);
    if (key && manifest.routes[key]) return manifest.routes[key];
  }

  if (htmlAssetCache.has(path)) return htmlAssetCache.get(path)!;

  const fetchPath = path.endsWith('/') ? path : `${path}/`;
  try {
    const res = await fetch(fetchPath, {
      credentials: 'same-origin',
      headers: { Accept: 'text/html' },
    });
    if (!res.ok) return null;
    const assets = parseAssetsFromHtml(await res.text());
    htmlAssetCache.set(path, assets);
    return assets;
  } catch {
    return null;
  }
}

function preloadLinkExists(href: string, rel: string): boolean {
  return Boolean(document.querySelector(`link[data-gv-vault-preload="${rel}:${href}"]`));
}

/** modulepreload for vault route bundles (+ script preload for webpack IIFE chunks). */
function injectModulePreload(href: string): void {
  if (preloadLinkExists(href, 'modulepreload')) return;
  const mod = document.createElement('link');
  mod.rel = 'modulepreload';
  mod.href = href;
  mod.setAttribute('data-gv-vault-preload', `modulepreload:${href}`);
  document.head.appendChild(mod);

  if (preloadLinkExists(href, 'script')) return;
  const script = document.createElement('link');
  script.rel = 'preload';
  script.as = 'script';
  script.href = href;
  script.setAttribute('data-gv-vault-preload', `script:${href}`);
  document.head.appendChild(script);
}

function injectStylePreload(href: string): void {
  if (document.querySelector(`link[rel="stylesheet"][href="${href}"]`)) return;
  if (preloadLinkExists(href, 'style')) return;
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'style';
  link.href = href;
  link.setAttribute('data-gv-vault-preload', `style:${href}`);
  document.head.appendChild(link);
}

function injectDocumentPrefetch(path: string): void {
  const href = path.endsWith('/') ? path : `${path}/`;
  if (document.querySelector(`link[rel="prefetch"][href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = href;
  link.setAttribute('data-gv-vault-preload', `prefetch:${href}`);
  document.head.appendChild(link);
}

function injectAssets(assets: RouteAssets): void {
  for (const href of assets.modules) injectModulePreload(href);
  for (const href of assets.styles) injectStylePreload(href);
}

function scheduleIdle(task: () => void): void {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(task, { timeout: 2500 });
  } else {
    window.setTimeout(task, 120);
  }
}

/** Warm route JS (modulepreload) + critical CSS for a vault path. */
export function warmVaultRoute(href: string): void {
  if (typeof window === 'undefined') return;
  const path = normalizeVaultPath(href);
  if (!path.startsWith('/vault')) return;
  if (warmedRoutes.has(path)) return;

  const existing = inflightRoutes.get(path);
  if (existing) return;

  const job = (async () => {
    injectDocumentPrefetch(path);
    const assets = await resolveRouteAssets(path);
    if (assets) injectAssets(assets);
    warmedRoutes.add(path);
  })().finally(() => {
    inflightRoutes.delete(path);
  });

  inflightRoutes.set(path, job);
}

/** Preload player/profile route bundles (slug URLs share template assets). */
export function warmVaultPlayerRoute(href: string): void {
  warmVaultRoute(href);
}

/** Drawer / menu routes — community, membership, FutureCast, team, recruiting. */
export const VAULT_DRAWER_WARM_ROUTES = [
  '/vault/futurecast',
  '/vault/community',
  '/vault/membership',
  '/vault/team',
  '/vault/recruiting',
] as const;

/** Preload bottom-nav pillar routes after shell mount. */
export function warmVaultBottomNavRoutes(currentPath?: string): void {
  if (typeof window === 'undefined') return;
  const active = currentPath ? normalizeVaultPath(currentPath) : null;
  const targets = VAULT_BOTTOM_NAV.map((item) => normalizeVaultPath(item.href)).filter(
    (href) => href !== active
  );

  scheduleIdle(() => {
    targets.forEach((href, index) => {
      window.setTimeout(() => warmVaultRoute(href), index * 100);
    });
  });
}

/** Preload secondary routes opened from the vault menu (UGC, membership, FutureCast). */
export function warmVaultDrawerRoutes(currentPath?: string): void {
  if (typeof window === 'undefined') return;
  const active = currentPath ? normalizeVaultPath(currentPath) : null;
  const targets = VAULT_DRAWER_WARM_ROUTES.map((href) => normalizeVaultPath(href)).filter(
    (href) => href !== active
  );

  scheduleIdle(() => {
    targets.forEach((href, index) => {
      window.setTimeout(() => warmVaultRoute(href), 400 + index * 120);
    });
  });
}

/** Legacy name — full preload pipeline (HTML prefetch + modulepreload + CSS). */
export function prefetchVaultHref(href: string): void {
  warmVaultRoute(href);
}
