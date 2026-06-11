/**
 * GatorVault Confidence Meter (0–100) — six-signal recruiting heat score for autoposter.
 */
const postSpec = require('./x-autoposter-post-spec');

const LABEL_BANDS = [
  { min: 0, max: 20, label: 'Cold' },
  { min: 21, max: 40, label: 'Cool' },
  { min: 41, max: 60, label: 'Warm' },
  { min: 61, max: 75, label: 'Heating Up' },
  { min: 76, max: 89, label: 'Hot' },
  { min: 90, max: 100, label: 'Very Hot' }
];

const EXPLANATION_TEMPLATES = {
  cold: 'Florida has had limited contact here, and there\u2019s no real traction at this time.',
  cool: 'Florida is involved, but communication has been light and no major movement yet.',
  warm: 'Florida is in the mix, and communication has been steady as evaluations continue.',
  heatingUp:
    'Momentum is building for Florida, especially with the upcoming visit on the schedule.',
  hot: 'Florida is in a strong position here, and staff confidence has been rising behind the scenes.',
  veryHot:
    'Florida is trending here. Staff confidence is high, and the Gators are viewed as a top contender.'
};

function clampScore(score) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function labelForScore(score) {
  const s = clampScore(score);
  const band = LABEL_BANDS.find((b) => s >= b.min && s <= b.max);
  return band?.label || 'Cold';
}

function templateKeyForScore(score) {
  const s = clampScore(score);
  if (s <= 20) return 'cold';
  if (s <= 40) return 'cool';
  if (s <= 60) return 'warm';
  if (s <= 75) return 'heatingUp';
  if (s <= 89) return 'hot';
  return 'veryHot';
}

function displayLabel(score) {
  const base = labelForScore(score);
  if (score >= 90) return 'Very Hot';
  return base;
}

function haystack(input = {}) {
  return [
    input.beatText,
    input.intel?.detail,
    input.intel?.status,
    input.autoposterData?.context,
    input.newsEvent
  ]
    .filter(Boolean)
    .join(' ');
}

function scoreVisitSignal(input = {}) {
  const t = haystack(input).toLowerCase();
  const situation = input.situation || postSpec.detectSituation(t, input.intel?.eventType);
  const eventType = String(input.intel?.eventType || '').toLowerCase();
  const visitHistory = input.identity?.visitHistory || {};
  const ufOvStatus = String(visitHistory.ufOvStatus || input.intel?.ufOvStatus || '').toLowerCase();

  if (/cancel(?:led|ed)|visit cancel|ov cancel|dropped the visit/.test(t) || ufOvStatus === 'cancelled') {
    return { points: -20, reason: 'cancelled_visit' };
  }
  if (
    situation === 'visit' &&
    (/on campus|in gainesville|the swamp|hosted|took his ov|completed/.test(t) ||
      eventType === 'official_visit' ||
      eventType === 'unofficial_visit')
  ) {
    if (/official|\bov\b/.test(t) || eventType === 'official_visit') {
      if (/on campus|today|this weekend|hosted|completed|took/.test(t)) {
        return { points: 30, reason: 'ov_completed' };
      }
      return { points: 20, reason: 'ov_scheduled' };
    }
    if (/unofficial|\buv\b/.test(t) || eventType === 'unofficial_visit') {
      if (/on campus|today|hosted|completed/.test(t)) return { points: 15, reason: 'uv_completed' };
      return { points: 10, reason: 'uv_scheduled' };
    }
    if (/scheduled|set to|plans to|will visit|on the calendar/.test(t)) return { points: 20, reason: 'visit_scheduled' };
    if (/on campus|today|in gainesville/.test(t)) return { points: 25, reason: 'visit_active' };
  }
  if (ufOvStatus === 'scheduled') return { points: 20, reason: 'ov_scheduled_db' };
  return { points: 0, reason: 'no_visit_signal' };
}

function scoreCommunicationSignal(input = {}) {
  const t = haystack(input).toLowerCase();
  if (/daily contact|every day|texts daily|calls daily|in constant contact/.test(t)) {
    return { points: 20, reason: 'daily_contact' };
  }
  if (/multiple times (?:a |this )?week|several times|heavy contact|regular contact/.test(t)) {
    return { points: 15, reason: 'multiple_weekly' };
  }
  if (/weekly contact|once a week|weekly check|steady communication|communication has been steady/.test(t)) {
    return { points: 10, reason: 'weekly_contact' };
  }
  if (
    /light contact|early contact|some contact|checking in|in the mix|evaluations continue|staff hosted|reached out|pushing hard|staff push/.test(
      t
    )
  ) {
    return { points: 5, reason: 'light_contact' };
  }
  if (input.identity?.headliner || input.ctx?.isUFtarget) {
    return { points: 10, reason: 'priority_target_contact' };
  }
  return { points: 0, reason: 'no_contact_signal' };
}

function scoreStaffPrioritySignal(input = {}) {
  const t = haystack(input).toLowerCase();
  if (
    /head coach|sumrall|hc involved|head coach involved|met with sumrall|with the head coach/.test(t)
  ) {
    return { points: 20, reason: 'head_coach' };
  }
  if (
    /coordinator|oc involved|dc involved|faulkner|white involved|coordinator involved|passing game coordinator/.test(
      t
    )
  ) {
    return { points: 15, reason: 'coordinator' };
  }
  if (
    /position coach|wr coach|qb coach|dl coach|coach(es)? (?:are )?pushing|staff push|staff loves|staff priority|pushing hard/.test(
      t
    )
  ) {
    return { points: 10, reason: 'position_coach' };
  }
  if (input.research?.ufPosition === 'staff priority') {
    return { points: 10, reason: 'research_staff_priority' };
  }
  return { points: 0, reason: 'no_staff_push' };
}

function scoreMomentumSignal(input = {}) {
  const t = haystack(input).toLowerCase();
  const situation = input.situation || '';
  let points = 0;
  const reasons = [];

  if (situation === 'trending' || /rpm|forecast|prediction|crystal ball|futurecast|momentum|heating up|trending/.test(t)) {
    points += 10;
    reasons.push('rpm_or_forecast');
  }
  if (/insider buzz|per multiple|sources say|behind the scenes|staff confidence|confidence rising|buzz/.test(t)) {
    points += 10;
    reasons.push('insider_buzz');
  } else if (/national chatter|nationally|top prospect|ranked|composite/.test(t)) {
    points += 5;
    reasons.push('national_chatter');
  }

  const rpm = input.identity?.ufRpmPct ?? input.intel?.ufRpmPct ?? input.autoposterData?.ufRpmPct;
  if (rpm >= 50) {
    points = Math.max(points, 10);
    reasons.push('strong_rpm');
  } else if (rpm >= 25) {
    points = Math.max(points, 5);
    reasons.push('moderate_rpm');
  }

  return { points: Math.min(15, points), reason: reasons.join('+') || 'no_momentum' };
}

function scoreCompetitionSignal(input = {}) {
  const research = input.research || {};
  const ufPosition = research.ufPosition;
  const rpm = input.identity?.ufRpmPct ?? input.intel?.ufRpmPct;
  const t = haystack(input).toLowerCase();

  if (ufPosition === 'leading' || ufPosition === 'committed' || /uf leads|florida leads|gators lead|top choice.*florida/.test(t)) {
    return { points: 10, reason: 'uf_leads' };
  }
  if (rpm >= 60 || /top two|top 2|final two|short list|top group/.test(t)) {
    return { points: 5, reason: 'uf_top_two' };
  }
  if (rpm >= 40 || /top three|top 3|in the mix|firmly in the mix/.test(t)) {
    return { points: 3, reason: 'uf_top_three' };
  }
  if (/heavy competition|crowded|lsu and|georgia and|alabama and|multiple schools/.test(t)) {
    return { points: -10, reason: 'heavy_competition' };
  }
  if (/trailing|behind|slipping|cooling|other school leads|leaning elsewhere|favoring/.test(t)) {
    return { points: -15, reason: 'uf_trailing' };
  }
  if (ufPosition === 'tracking') return { points: 0, reason: 'neutral_competition' };
  return { points: 0, reason: 'unknown_competition' };
}

function scoreBehaviorSignal(input = {}) {
  const t = haystack(input).toLowerCase();
  let points = 0;
  const reasons = [];

  if (/social media|posted.*florida|gators on|uf gear|gator gear|committed on social/.test(t)) {
    points += 10;
    reasons.push('social_uf');
  }
  if (/mentioned florida|mentioned the gators|interview.*florida|praised florida|loves florida/.test(t)) {
    points += 10;
    reasons.push('mentions_uf');
  }
  if (/follows uf|followed.*coach|follows.*staff|followed bender|followed gators/.test(t)) {
    points += 5;
    reasons.push('follows_staff');
  }

  return { points: Math.min(15, points), reason: reasons.join('+') || 'no_behavior_signal' };
}

/**
 * Compute full confidence meter from six signals.
 */
function computeConfidenceMeter(input = {}) {
  const signals = {
    visit: scoreVisitSignal(input),
    communication: scoreCommunicationSignal(input),
    staffPriority: scoreStaffPrioritySignal(input),
    momentum: scoreMomentumSignal(input),
    competition: scoreCompetitionSignal(input),
    behavior: scoreBehaviorSignal(input)
  };

  const raw =
    signals.visit.points +
    signals.communication.points +
    signals.staffPriority.points +
    signals.momentum.points +
    signals.competition.points +
    signals.behavior.points;

  const score = clampScore(raw);
  const label = displayLabel(score);
  const templateKey = templateKeyForScore(score);
  const explanation = EXPLANATION_TEMPLATES[templateKey];
  const header = `Confidence Meter: ${score} (${label})`;

  return {
    score,
    label,
    displayLabel: label,
    explanation,
    header,
    templateKey,
    signals,
    breakdown: {
      visitPoints: signals.visit.points,
      communicationPoints: signals.communication.points,
      staffPriorityPoints: signals.staffPriority.points,
      momentumPoints: signals.momentum.points,
      competitionPoints: signals.competition.points,
      behaviorPoints: signals.behavior.points,
      rawTotal: raw
    }
  };
}

function formatConfidenceBlock(meter) {
  if (!meter?.header) return null;
  return `${meter.header}\n${meter.explanation}`;
}

function isEnabled() {
  return process.env.X_AUTOPOST_CONFIDENCE_METER !== 'false';
}

module.exports = {
  LABEL_BANDS,
  EXPLANATION_TEMPLATES,
  clampScore,
  labelForScore,
  displayLabel,
  computeConfidenceMeter,
  formatConfidenceBlock,
  scoreVisitSignal,
  scoreCommunicationSignal,
  scoreStaffPrioritySignal,
  scoreMomentumSignal,
  scoreCompetitionSignal,
  scoreBehaviorSignal,
  isEnabled
};
