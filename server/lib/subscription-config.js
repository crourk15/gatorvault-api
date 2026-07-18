/**
 * Subscription catalog — tier ↔ Apple product IDs for App Store Connect.
 * Create matching auto-renewable subscriptions in App Store Connect (Step 3a setup).
 */
const SUBSCRIPTION_TIERS = {
  locker: {
    id: 'locker',
    name: 'Locker Room',
    icon: '🏟️',
    monthlyUsd: 4.99,
    annualUsd: 47.88,
    apple: {
      groupId: 'gatorvault_insider',
      monthlyProductId: 'com.gatorvaultinsider.locker.monthly',
      annualProductId: 'com.gatorvaultinsider.locker.annual',
    },
  },
  film: {
    id: 'film',
    name: 'Film Room',
    icon: '🎬',
    monthlyUsd: 9.99,
    annualUsd: 95.88,
    popular: true,
    apple: {
      groupId: 'gatorvault_insider',
      monthlyProductId: 'com.gatorvaultinsider.film.monthly',
      annualProductId: 'com.gatorvaultinsider.film.annual',
    },
  },
  war: {
    id: 'war',
    name: 'War Room',
    icon: '⚔️',
    monthlyUsd: 19.99,
    annualUsd: 191.88,
    apple: {
      groupId: 'gatorvault_insider',
      monthlyProductId: 'com.gatorvaultinsider.war.monthly',
      annualProductId: 'com.gatorvaultinsider.war.annual',
    },
  },
};

const PRODUCT_TO_TIER = {};
for (const tier of Object.values(SUBSCRIPTION_TIERS)) {
  PRODUCT_TO_TIER[tier.apple.monthlyProductId] = tier.id;
  PRODUCT_TO_TIER[tier.apple.annualProductId] = tier.id;
}

function normalizeTier(tier) {
  const t = String(tier || 'film').toLowerCase();
  if (t === 'war' || t === 'elite') return 'war';
  if (t === 'locker' || t === 'vault') return 'locker';
  return 'film';
}

function tierFromProductId(productId) {
  return PRODUCT_TO_TIER[String(productId || '').trim()] || null;
}

function buildCatalogPayload() {
  const siteUrl = String(process.env.SITE_URL || 'https://gatorvaultinsider.com').replace(/\/$/, '');
  const apiBase = String(
    process.env.NEXT_PUBLIC_API_BASE || process.env.API_BASE || 'https://gatorvault-api.onrender.com'
  ).replace(/\/$/, '');
  const appAppleId = String(process.env.APPLE_APP_APPLE_ID || '6783848215').trim();
  return {
    ok: true,
    provider: 'apple',
    trialDays: 30,
    subscriptionGroup: 'gatorvault_insider',
    appAppleId,
    appStoreUrl: `https://apps.apple.com/app/id${appAppleId}`,
    notificationsUrl: `${apiBase}/api/subscription/apple/notifications`,
    membershipUrl: `${siteUrl}/vault/membership/`,
    tiers: Object.values(SUBSCRIPTION_TIERS).map((tier) => ({
      id: tier.id,
      name: tier.name,
      icon: tier.icon,
      monthlyUsd: tier.monthlyUsd,
      annualUsd: tier.annualUsd,
      popular: !!tier.popular,
      products: {
        monthly: tier.apple.monthlyProductId,
        annual: tier.apple.annualProductId,
      },
    })),
    iosPurchaseReady: Boolean(process.env.APPLE_IAP_VERIFICATION_ENABLED === 'true'),
  };
}

module.exports = {
  SUBSCRIPTION_TIERS,
  PRODUCT_TO_TIER,
  normalizeTier,
  tierFromProductId,
  buildCatalogPayload,
};
