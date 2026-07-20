/**
 * Full app menu — secondary destinations opened from bottom-nav Menu item.
 */
import { SITE_ROUTES, TOP_NAV_ITEMS, type SiteSectionId } from './site-routes';
import { VAULT_PILLAR_ROUTES } from './vault-route-map';

/** Canonical /vault/* paths — keep users in VaultShell (Home must not fall through to `/`). */
const VAULT_PATH_BY_SECTION: Record<SiteSectionId, string> = {
  dashboard: `${VAULT_PILLAR_ROUTES.home}/`,
  recruiting: `${VAULT_PILLAR_ROUTES.recruiting}/`,
  futurecast: `${VAULT_PILLAR_ROUTES.futurecast}/`,
  team: `${VAULT_PILLAR_ROUTES.team}/`,
  gatorNationLive: `${VAULT_PILLAR_ROUTES.liveFeed}/`,
  schedule: `${VAULT_PILLAR_ROUTES.schedule}/`,
  filmRoom: `${VAULT_PILLAR_ROUTES.filmRoom}/`,
  gameWeek: '/vault/game-week/',
  liveScores: '/vault/live-scores/',
  articles: `${VAULT_PILLAR_ROUTES.articles}/`,
  community: `${VAULT_PILLAR_ROUTES.community}/`,
  gameZone: '/vault/game-zone/',
  nil: `${VAULT_PILLAR_ROUTES.nil}/`,
};

export type AppMenuItem = {
  id: string;
  label: string;
  href: string;
  icon?: string;
};

export type AppMenuSection = {
  title: string;
  items: AppMenuItem[];
};

/** Bottom-nav primary tabs — excluded from the overflow menu. */
const BOTTOM_NAV_IDS = new Set<SiteSectionId>([
  'dashboard',
  'recruiting',
  'team',
  'gatorNationLive',
]);

function sitePath(inVault: boolean, flatPath: string, vaultPath: string): string {
  return inVault ? vaultPath : flatPath;
}

/** Grouped menu for AppShell (flat routes) or VaultShell (/vault/*). */
export function getAppMenuSections(inVault: boolean): AppMenuSection[] {
  const overflowPillars = TOP_NAV_ITEMS.filter((item) => !BOTTOM_NAV_IDS.has(item.id));

  const MENU_ICON_BY_SECTION: Partial<Record<SiteSectionId, string>> = {
    futurecast: 'futurecast',
    schedule: 'schedule',
    filmRoom: 'film',
    gameWeek: 'gameweek',
    liveScores: 'scores',
    articles: 'articles',
    community: 'community',
    gameZone: 'gamezone',
    nil: 'nil',
  };

  const more: AppMenuItem[] = overflowPillars.map((item) => ({
    id: item.id,
    label: item.label,
    href: inVault ? VAULT_PATH_BY_SECTION[item.id] : item.href,
    icon: MENU_ICON_BY_SECTION[item.id],
  }));

  const account: AppMenuItem[] = [
    {
      id: 'membership',
      label: 'Membership & Account',
      href: sitePath(inVault, '/join/?mode=signin', '/vault/membership/'),
      icon: 'account',
    },
    {
      id: 'alerts',
      label: 'My Alerts',
      href: sitePath(inVault, '/futurecast/alerts', '/vault/alerts'),
      icon: 'alerts',
    },
  ];

  const media: AppMenuItem[] = [
    {
      id: 'podcasts',
      label: 'Podcasts',
      href: sitePath(inVault, SITE_ROUTES.gatorNationLive, '/vault/live/podcasts/'),
      icon: 'podcasts',
    },
    {
      id: 'apparel',
      label: 'Shop & Apparel',
      href: sitePath(inVault, '/vault/apparel', '/vault/apparel'),
      icon: 'apparel',
    },
  ];

  if (!inVault) {
    media.push({
      id: 'vault',
      label: 'Vault (Legacy)',
      href: '/vault',
      icon: 'vault',
    });
  }

  return [
    { title: 'Explore', items: more },
    { title: 'Media & Shop', items: media },
    { title: 'Account', items: account },
  ];
}
