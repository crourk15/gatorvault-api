/**
 * Netflix-style introductory pricing — early members lock in at signup rate.
 * Year 1 (launch 2026): Locker $4.99 · Film $9.99 · War $19.99
 * Year 2: Locker $6.99 · Film $12.99 · War $24.99
 * Year 3+: Locker $9.99 · Film $19.99 · War $39.99
 */
const LAUNCH_YEAR = parseInt(process.env.GV_PRICING_LAUNCH_YEAR || '2026', 10);

const TIERS = {
  locker: {
    id: 'locker',
    name: 'Locker Room',
    icon: '🏟️',
    features: [
      'Live Dashboard & beat writer stream',
      '2026/2027 recruiting board & portal radar',
      'Weekly depth chart & roster profiles',
      'Community threads & breaking alerts',
      'Podcast hub & ticket/apparel links'
    ]
  },
  film: {
    id: 'film',
    name: 'Film Room',
    icon: '🎬',
    features: [
      'Everything in Locker Room',
      'GNFP 2026 film breakdowns (auto-updated)',
      'UF head coach press conferences (latest 5)',
      'Manual spring game film studies',
      'Game-week storyline cards'
    ]
  },
  war: {
    id: 'war',
    name: 'War Room',
    icon: '⚔️',
    features: [
      'Everything in Film Room',
      'Insider Scouting Database (Power, Bender, Ivins, Alderman, Simmons, Harden, Wiltfong)',
      'Heat Check — Crystal Ball & On3 RPM momentum',
      'War Room featured player reports',
      'Game Zone betting lines & win probability',
      'Priority Q&A & early access drops'
    ]
  }
};

const PRICING_BY_YEAR = {
  1: { locker: 4.99, film: 9.99, war: 19.99 },
  2: { locker: 6.99, film: 12.99, war: 24.99 },
  3: { locker: 9.99, film: 19.99, war: 39.99 }
};

function getPricingYear(date = new Date()) {
  const y = date.getFullYear();
  if (y <= LAUNCH_YEAR) return 1;
  if (y === LAUNCH_YEAR + 1) return 2;
  return 3;
}

function getTierPrices(pricingYear = getPricingYear()) {
  return PRICING_BY_YEAR[pricingYear] || PRICING_BY_YEAR[3];
}

function annualFromMonthly(monthly) {
  return Math.round(monthly * 12 * 0.8 * 100) / 100;
}

function buildPricingPayload() {
  const pricingYear = getPricingYear();
  const prices = getTierPrices(pricingYear);
  const tiers = ['locker', 'film', 'war'].map((id) => {
    const meta = TIERS[id];
    const monthly = prices[id];
    return {
      id,
      name: meta.name,
      icon: meta.icon,
      monthly,
      annual: annualFromMonthly(monthly),
      annualTotal: Math.round(monthly * 12 * 0.8 * 100) / 100,
      features: meta.features,
      label: `${meta.name} — $${monthly.toFixed(2)}/mo`
    };
  });
  return {
    ok: true,
    pricingYear,
    launchYear: LAUNCH_YEAR,
    grandfatherNote:
      'Charter members keep their signup rate forever. New members see current-year pricing.',
    yearLabels: {
      1: 'Intro pricing (Year 1)',
      2: 'Year 2 pricing',
      3: 'Standard pricing (Year 3+)'
    },
    currentLabel: { 1: 'Intro pricing (Year 1)', 2: 'Year 2 pricing', 3: 'Standard pricing (Year 3+)' }[
      pricingYear
    ],
    tiers
  };
}

module.exports = {
  LAUNCH_YEAR,
  TIERS,
  getPricingYear,
  getTierPrices,
  buildPricingPayload
};
