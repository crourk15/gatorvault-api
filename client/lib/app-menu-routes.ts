/**
 * Full app menu — secondary destinations opened from bottom-nav Menu item.
 */
import { SITE_ROUTES, TOP_NAV_ITEMS, type SiteSectionId } from './site-routes';

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

  const more: AppMenuItem[] = overflowPillars.map((item) => ({
    id: item.id,
    label: item.label,
    href: item.href,
  }));

  const account: AppMenuItem[] = [
    {
      id: 'membership',
      label: 'Membership & Account',
      href: sitePath(inVault, '/join', '/vault/membership'),
      icon: '👤',
    },
    {
      id: 'alerts',
      label: 'My Alerts',
      href: sitePath(inVault, '/futurecast/alerts', '/vault/alerts'),
      icon: '🔔',
    },
    {
      id: 'tickets',
      label: 'Tickets',
      href: sitePath(inVault, SITE_ROUTES.schedule, '/vault/schedule'),
      icon: '🎟️',
    },
  ];

  const media: AppMenuItem[] = [
    {
      id: 'podcasts',
      label: 'Podcasts',
      href: sitePath(inVault, SITE_ROUTES.gatorNationLive, '/vault/live/podcasts'),
      icon: '🎙️',
    },
    {
      id: 'apparel',
      label: 'Shop & Apparel',
      href: sitePath(inVault, '/vault/apparel', '/vault/apparel'),
      icon: '👕',
    },
  ];

  if (!inVault) {
    media.push({
      id: 'vault',
      label: 'Vault (Legacy)',
      href: '/vault',
      icon: '🏛️',
    });
  }

  return [
    { title: 'Explore', items: more },
    { title: 'Media & Shop', items: media },
    { title: 'Account', items: account },
  ];
}
