/**
 * GatorVault tier system — payment tiers (content access) and points tiers (status + perks).
 * Payment tiers ALWAYS control paid content. Points tiers NEVER override payment tiers.
 */
const { TIER_LEVELS, tierLevel } = require('./session-auth');

const PAYMENT_TIERS = {
  locker: {
    id: 'locker',
    name: 'Locker Room',
    icon: '🏟️',
    level: 0,
    features: [
      'Basic premium articles',
      'Depth chart',
      'Press conferences',
      'Highlights',
      'Basic recruiting + portal updates'
    ]
  },
  film: {
    id: 'film',
    name: 'Film Room',
    icon: '🎬',
    level: 1,
    features: [
      'Everything in Locker Room',
      'Weekly Scheme School',
      'Play of the Week Breakdown',
      'Player Development Tracker',
      'Recruit Fit Evaluations',
      'Matchup Spotlight',
      'Film Room Q&A',
      '"What the Coaches See" positional insights',
      '"Why This Matters" micro-lessons'
    ]
  },
  war: {
    id: 'war',
    name: 'War Room',
    icon: '⚔️',
    level: 2,
    features: [
      'Everything in Film Room',
      'Full War Room intel',
      'Heat Check (full access)',
      'Momentum shifts',
      'Insider recruiting intel',
      'Portal intel',
      'Priority notifications'
    ]
  }
};

const POINTS_TIERS = {
  scout: {
    id: 'scout',
    name: 'Scout',
    icon: '🔍',
    minPoints: 0,
    maxPoints: 499,
    level: 0,
    perks: ['Basic free access', 'Basic player profiles', 'Community & headlines']
  },
  insider: {
    id: 'insider',
    name: 'Insider',
    icon: '📰',
    minPoints: 500,
    maxPoints: 1999,
    level: 1,
    perks: [
      'Everything in Scout',
      'Enhanced free features',
      'Expanded player profiles',
      'Visit tracker',
      'Commitment tracker',
      'Recruiting boards (read-only)',
      'Heat Check (read-only)',
      'Insider notifications'
    ]
  },
  elite: {
    id: 'elite',
    name: 'Vault Elite',
    icon: '⚡',
    minPoints: 2000,
    maxPoints: null,
    level: 2,
    perks: [
      'Everything in Insider',
      'Elite badge',
      'Early notifications',
      'Priority Q&A',
      'Exclusive giveaways',
      'Elite-only alerts',
      'Elite-only Knowledge Engine alerts'
    ]
  }
};

/** Paid content — requires payment tier only (points cannot unlock). */
const PAYMENT_GATED = {
  premium_articles: 'locker',
  depth_chart: 'locker',
  recruiting_basic: 'locker',
  portal_basic: 'locker',
  film_room_full: 'film',
  knowledge_engine: 'film',
  scheme_library: 'film',
  concept_breakdowns: 'film',
  recruiting_fit_lessons: 'film',
  opponent_prep: 'film',
  position_traits: 'film',
  war_room_intel: 'war',
  heat_check_full: 'war',
  momentum_shifts: 'war',
  insider_recruiting_intel: 'war',
  portal_intel: 'war',
  priority_notifications: 'war',
  scouting_database: 'war'
};

/** Free/perk features — points tier only; never substitutes for paid content. */
const POINTS_PERKS = {
  highlights_free: 'scout',
  press_conferences_free: 'scout',
  basic_player_profiles: 'scout',
  expanded_player_profiles: 'insider',
  visit_tracker: 'insider',
  commitment_tracker: 'insider',
  recruiting_boards_readonly: 'insider',
  heat_check_readonly: 'insider',
  insider_notifications: 'insider',
  elite_badge: 'elite',
  early_notifications: 'elite',
  priority_qa_perk: 'elite',
  exclusive_giveaways: 'elite',
  elite_alerts: 'elite',
  elite_film_breakdowns: 'elite'
};

const POINTS_TIER_ORDER = { scout: 0, insider: 1, elite: 2 };

function pointsTierFromPoints(points) {
  const n = Math.max(0, parseInt(points, 10) || 0);
  if (n >= POINTS_TIERS.elite.minPoints) return 'elite';
  if (n >= POINTS_TIERS.insider.minPoints) return 'insider';
  return 'scout';
}

function pointsTierLevel(tierId) {
  return POINTS_TIER_ORDER[String(tierId || 'scout').toLowerCase()] ?? 0;
}

function hasPaymentTier(sessionOrTier, minTier) {
  const tier = typeof sessionOrTier === 'object' ? sessionOrTier?.tier : sessionOrTier;
  return tierLevel(tier) >= tierLevel(minTier);
}

function hasPointsPerk(points, perkId) {
  const required = POINTS_PERKS[perkId];
  if (!required) return false;
  const userTier = pointsTierFromPoints(points);
  return pointsTierLevel(userTier) >= pointsTierLevel(required);
}

function canAccessPaymentFeature(sessionOrTier, featureId) {
  const min = PAYMENT_GATED[featureId];
  if (!min) return true;
  return hasPaymentTier(sessionOrTier, min);
}

function nextPointsTierInfo(points) {
  const current = pointsTierFromPoints(points);
  if (current === 'elite') {
    return { current, next: null, pointsToNext: 0, label: 'Vault Elite — max tier' };
  }
  if (current === 'insider') {
    return {
      current,
      next: 'elite',
      pointsToNext: Math.max(0, POINTS_TIERS.elite.minPoints - points),
      label: `Vault Elite at ${POINTS_TIERS.elite.minPoints} points`
    };
  }
  return {
    current,
    next: 'insider',
    pointsToNext: Math.max(0, POINTS_TIERS.insider.minPoints - points),
    label: `Insider at ${POINTS_TIERS.insider.minPoints} points`
  };
}

function buildTierSystemPayload() {
  return {
    ok: true,
    rule: 'Payment tiers control paid content. Points tiers add perks only — never override payment tiers.',
    paymentTiers: Object.values(PAYMENT_TIERS),
    pointsTiers: Object.values(POINTS_TIERS),
    paymentGated: PAYMENT_GATED,
    pointsPerks: POINTS_PERKS
  };
}

module.exports = {
  PAYMENT_TIERS,
  POINTS_TIERS,
  PAYMENT_GATED,
  POINTS_PERKS,
  TIER_LEVELS,
  pointsTierFromPoints,
  pointsTierLevel,
  hasPaymentTier,
  hasPointsPerk,
  canAccessPaymentFeature,
  nextPointsTierInfo,
  buildTierSystemPayload
};
