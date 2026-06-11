/**
 * GatorVault Heat Meter — RISING / HOLDING / COOLING momentum (24–72h window).
 * Measures whether Florida is gaining, losing, or holding ground — not overall likelihood.
 */
const postSpec = require('./x-autoposter-post-spec');

const HEAT_WINDOW_MS = parseInt(process.env.X_AUTOPOST_HEAT_WINDOW_MS || String(72 * 60 * 60 * 1000), 10);

const STATE = {
  RISING: 'RISING',
  HOLDING: 'HOLDING',
  COOLING: 'COOLING'
};

const RISING_THRESHOLD = 3;
const COOLING_THRESHOLD = -1;

function haystack(input = {}) {
  const parts = [input.beatText, input.intel?.detail, input.intel?.status, input.autoposterData?.context, input.newsEvent];
  if (Array.isArray(input.recentIntel)) {
    for (const row of input.recentIntel) {
      parts.push(row.detail, row.status, row.eventType);
    }
  }
  return parts.filter(Boolean).join(' ');
}

function textLower(input) {
  return haystack(input).toLowerCase();
}

function withinHeatWindow(iso, now = Date.now()) {
  if (!iso) return false;
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return false;
  return now - ms <= HEAT_WINDOW_MS;
}

function loadRecentIntelSync(playerSlug, playerName) {
  if (!playerSlug && !playerName) return [];
  try {
    const intelStore = require('./recruiting-intel-store');
    const rows = intelStore.getIntelForPlayer({ playerSlug, playerName }) || [];
    const cutoff = Date.now() - HEAT_WINDOW_MS;
    return rows.filter((r) => {
      const ts = new Date(r.timestamp || r.createdAt || 0).getTime();
      return !Number.isNaN(ts) && ts >= cutoff;
    });
  } catch {
    return [];
  }
}

function collectPositiveSignals(input = {}) {
  const t = textLower(input);
  const situation = input.situation || postSpec.detectSituation(t, input.intel?.eventType);
  const hits = [];

  if (/cancel/.test(t)) return hits;

  if (situation === 'visit' || /visit|on campus|in gainesville|the swamp|\bov\b|\buv\b/.test(t)) {
    if (/on campus|today|hosted|completed|just finished|took his ov|wrapped up/.test(t)) {
      if (/official|\bov\b/.test(t)) hits.push({ weight: 3, trigger: 'visit', reason: 'ov_completed' });
      else if (/unofficial|\buv\b/.test(t)) hits.push({ weight: 2, trigger: 'visit', reason: 'uv_completed' });
      else hits.push({ weight: 3, trigger: 'visit', reason: 'visit_active' });
    } else if (/scheduled|set to|plans to|on the calendar|will visit/.test(t)) {
      if (/official|\bov\b/.test(t)) hits.push({ weight: 3, trigger: 'visit', reason: 'ov_scheduled' });
      else hits.push({ weight: 1, trigger: 'visit', reason: 'uv_scheduled' });
    }
  }

  if (/staff contact|contact increased|communication picked up|pushing hard|in constant contact|multiple times/.test(t)) {
    hits.push({ weight: 2, trigger: 'communication spike', reason: 'staff_contact_up' });
  }

  if (situation === 'offer' || /offered|new offer|extended an offer|picked up an offer/.test(t)) {
    hits.push({ weight: 2, trigger: 'offer', reason: 'new_offer' });
  }

  if (
    situation === 'trending' ||
    /prediction|futurecast|crystal ball|rpm|forecast.*florida|florida.*forecast/.test(t)
  ) {
    hits.push({ weight: 3, trigger: 'prediction', reason: 'new_prediction' });
  }

  if (/insider buzz|buzz building|heating up|momentum|per multiple|sources say|behind the scenes/.test(t)) {
    hits.push({ weight: 2, trigger: 'staff push', reason: 'insider_buzz' });
  }

  if (/mentioned florida|mentioned the gators|loves florida|praised florida|interview.*florida/.test(t)) {
    hits.push({ weight: 1, trigger: 'communication spike', reason: 'player_mentions_uf' });
  }

  if (/top group|short list|final group|moved up.*florida|uf in the top/.test(t)) {
    hits.push({ weight: 2, trigger: 'staff push', reason: 'uf_top_group' });
  }

  if (
    (situation === 'portal' || /portal/.test(t)) &&
    /florida|gators|\buf\b|interest|evaluating|target/.test(t)
  ) {
    hits.push({ weight: 2, trigger: 'portal evaluation', reason: 'portal_interest' });
  }

  return hits;
}

function collectNegativeSignals(input = {}) {
  const t = textLower(input);
  const hits = [];

  if (/visit cancel|cancelled.*visit|ov cancel|dropped the visit|visit off/.test(t)) {
    hits.push({ weight: -3, trigger: 'cancelled visit', reason: 'visit_cancelled' });
  }

  if (/prediction.*(?:georgia|alabama|lsu|miami|fsu|tennessee|ole miss|texas|ohio state)/.test(t)) {
    hits.push({ weight: -3, trigger: 'prediction elsewhere', reason: 'prediction_other' });
  }
  if (/crystal ball.*(?!florida|gators|\buf\b)/.test(t) && !/florida|gators|\buf\b/.test(t)) {
    hits.push({ weight: -3, trigger: 'prediction elsewhere', reason: 'prediction_away' });
  }

  if (/contact slow|communication slow|gone quiet|cooled off|less contact|staff backed off/.test(t)) {
    hits.push({ weight: -2, trigger: 'reduced contact', reason: 'contact_slows' });
  }

  if (/trending elsewhere|leaning toward|favoring|top choice is|likely heading to/.test(t) && !/florida|gators|\buf\b/.test(t)) {
    hits.push({ weight: -2, trigger: 'reduced contact', reason: 'trending_elsewhere' });
  }

  if (/drops in|dropped in|fell in|slipping|uf slipping|momentum away/.test(t)) {
    hits.push({ weight: -2, trigger: 'reduced contact', reason: 'uf_drops_top_group' });
  }

  if (/portal.*cold|going cold|no interest|not pursuing|moving on/.test(t)) {
    hits.push({ weight: -2, trigger: 'reduced contact', reason: 'portal_cold' });
  }

  return hits;
}

function classifyState(total) {
  if (total >= RISING_THRESHOLD) return STATE.RISING;
  if (total <= COOLING_THRESHOLD) return STATE.COOLING;
  return STATE.HOLDING;
}

function headerForState(state) {
  switch (state) {
    case STATE.RISING:
      return 'Heat Meter: RISING \uD83D\uDD25';
    case STATE.COOLING:
      return 'Heat Meter: COOLING \u2744\uFE0F';
    default:
      return 'Heat Meter: HOLDING \u26AA';
  }
}

function buildRisingExplanation(trigger, input = {}) {
  const t = textLower(input);
  if (trigger === 'visit' && /today|on campus right now|on campus today/.test(t)) {
    return 'Florida is gaining momentum with today\u2019s visit.';
  }
  if (trigger === 'visit' && /scheduled|set to|on the calendar/.test(t)) {
    return 'Florida is gaining momentum with a visit on the schedule.';
  }
  if (trigger === 'prediction') {
    return 'Florida is gaining momentum here, especially with the recent prediction.';
  }
  if (trigger === 'portal evaluation') {
    return 'Florida is gaining momentum as they evaluate this portal target.';
  }
  return `Florida is gaining momentum here, especially with the recent ${trigger}.`;
}

function buildCoolingExplanation(trigger) {
  return `Momentum has slowed for Florida, especially after the recent ${trigger}.`;
}

function pickPrimaryTrigger(signals, fallback = 'movement') {
  if (!signals.length) return fallback;
  const sorted = [...signals].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  return sorted[0].trigger || fallback;
}

/**
 * Compute heat meter from momentum signals (current intel + 72h history).
 */
function computeHeatMeter(input = {}) {
  const recentIntel =
    input.recentIntel || loadRecentIntelSync(input.playerSlug || input.ctx?.playerSlug, input.ctx?.name);

  const enriched = { ...input, recentIntel };
  const positive = collectPositiveSignals(enriched);
  const negative = collectNegativeSignals(enriched);

  const positiveTotal = positive.reduce((sum, s) => sum + s.weight, 0);
  const negativeTotal = negative.reduce((sum, s) => sum + s.weight, 0);
  const total = positiveTotal + negativeTotal;

  const state = classifyState(total);
  const header = headerForState(state);

  let explanation;
  let trigger = null;

  if (state === STATE.RISING) {
    trigger = pickPrimaryTrigger(positive, 'movement');
    explanation = buildRisingExplanation(trigger, enriched);
  } else if (state === STATE.COOLING) {
    trigger = pickPrimaryTrigger(negative, 'setback');
    explanation = buildCoolingExplanation(trigger);
  } else {
    explanation =
      'Florida remains steady in this recruitment with no major movement over the last few days.';
  }

  return {
    state,
    header,
    explanation,
    trigger,
    total,
    windowHours: HEAT_WINDOW_MS / 3600000,
    positiveSignals: positive,
    negativeSignals: negative,
    breakdown: {
      positiveTotal,
      negativeTotal,
      netTotal: total
    }
  };
}

function isEnabled() {
  return process.env.X_AUTOPOST_HEAT_METER !== 'false';
}

module.exports = {
  STATE,
  HEAT_WINDOW_MS,
  RISING_THRESHOLD,
  COOLING_THRESHOLD,
  loadRecentIntelSync,
  collectPositiveSignals,
  collectNegativeSignals,
  classifyState,
  computeHeatMeter,
  isEnabled,
  withinHeatWindow
};
