/**
 * X AutoPoster cadence — human-paced posting with breaking-news overrides.
 * Normal: 1 post / 45 min · Night (12–6 AM ET): 1 / 2.5 hr · Urgent: burst min 7 min · Multi-breaking: 2 min
 */
const store = require('./x-autoposter-store');

const NORMAL_COOLDOWN_MS = parseInt(process.env.X_AUTOPOST_COOLDOWN_MS || String(45 * 60 * 1000), 10);
const BURST_COOLDOWN_MS = parseInt(process.env.X_AUTOPOST_BURST_MS || String(7 * 60 * 1000), 10);
const NIGHT_COOLDOWN_MS = parseInt(process.env.X_AUTOPOST_NIGHT_MS || String(150 * 60 * 1000), 10);
const BREAKING_BURST_MS = parseInt(process.env.X_AUTOPOST_BREAKING_BURST_MS || String(2 * 60 * 1000), 10);
const NIGHT_TZ = process.env.X_AUTOPOST_NIGHT_TZ || 'America/New_York';

const URGENT_LABELS = new Set([
  'commitment',
  'portal',
  'injury',
  'staff',
  'analysis',
  'major_beat'
]);

function isNightModeEst(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: NIGHT_TZ,
      hour: 'numeric',
      hour12: false
    }).formatToParts(date);
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '12', 10);
    return hour >= 0 && hour < 6;
  } catch {
    const h = date.getUTCHours() - 5;
    const est = h < 0 ? h + 24 : h;
    return est >= 0 && est < 6;
  }
}

function classifyItemUrgency(item) {
  if (!item) return { tier: 'normal', label: 'routine' };

  if (item.postUrgency === 'breaking' || item.urgencyLabel === 'breaking') {
    return { tier: 'breaking', label: 'breaking' };
  }

  const text = String(item.text || '');
  const lower = text.toLowerCase();
  const topic = String(item.topic || '').toLowerCase();
  const intelType = String(item.intelType || '').toLowerCase();
  const source = String(item.source || '').toLowerCase();
  const eventType = String(item.sourceEventType || item.eventType || intelType || '').toLowerCase();

  if (eventType === 'program_news' || topic === 'program' || source.includes('program-news')) {
    return { tier: 'breaking', label: 'breaking' };
  }
  if (/\bbreaking\b/i.test(text)) {
    return { tier: 'breaking', label: 'breaking' };
  }
  if (topic === 'portal' || /portal_in|portal_out|portal_headliner/.test(eventType) || source.includes('portal')) {
    return { tier: 'urgent', label: 'portal' };
  }
  if (/^(commit|flip|decommit)$/.test(eventType) || /\b(committed to florida|flips to florida|decommits from florida)\b/i.test(text)) {
    return { tier: 'urgent', label: 'commitment' };
  }
  if (/\b(injur(y|ed|ies)|out for the season|miss(?:es)? \d+ weeks?)\b/i.test(lower) || /injury/.test(intelType)) {
    return { tier: 'urgent', label: 'injury' };
  }
  if (topic === 'staff' || /\b(hired|fired|resigns|coordinator|interim head coach|defensive coordinator|offensive coordinator)\b/i.test(lower)) {
    return { tier: 'urgent', label: 'staff' };
  }
  if (source === 'auto:article' || item.urgencyLabel === 'analysis' || /\b(analysis|breakdown|film study)\b/i.test(lower)) {
    return { tier: 'urgent', label: 'analysis' };
  }
  if ((source === 'auto:beat-intel' || source === 'auto:beat-momentum') && item.playerName) {
    return { tier: 'urgent', label: 'major_beat' };
  }
  if (source === 'auto:intel' && item.playerName && /visit_cancel|visit_scheduled|rivals_prediction/.test(intelType)) {
    return { tier: 'urgent', label: 'major_beat' };
  }
  if (item.urgencyLabel && URGENT_LABELS.has(item.urgencyLabel)) {
    return { tier: 'urgent', label: item.urgencyLabel };
  }

  return { tier: 'normal', label: item.urgencyLabel || 'routine' };
}

function tierRank(tier) {
  return { breaking: 0, urgent: 1, normal: 2 }[tier] ?? 2;
}

function pickNextPost(pendingItems) {
  const due = (pendingItems || []).filter(
    (i) => i.status === 'pending' && new Date(i.scheduledAt).getTime() <= Date.now()
  );
  if (!due.length) return null;

  return [...due].sort((a, b) => {
    const ua = classifyItemUrgency(a);
    const ub = classifyItemUrgency(b);
    if (tierRank(ua.tier) !== tierRank(ub.tier)) return tierRank(ua.tier) - tierRank(ub.tier);
    return new Date(a.scheduledAt) - new Date(b.scheduledAt);
  })[0];
}

function countBreakingPending(pendingItems) {
  return (pendingItems || []).filter((i) => i.status === 'pending' && classifyItemUrgency(i).tier === 'breaking').length;
}

function evaluatePostWindow({ pendingItems, lastPostAt, now = Date.now() } = {}) {
  const nextItem = pickNextPost(pendingItems);
  if (!nextItem) {
    return { allowed: false, reason: 'no_due_posts', nextItem: null };
  }

  const urgency = classifyItemUrgency(nextItem);
  const breakingCount = countBreakingPending(pendingItems);
  const night = isNightModeEst(new Date(now));
  const lastAt = lastPostAt ? new Date(lastPostAt).getTime() : null;
  const elapsed = lastAt ? now - lastAt : Infinity;

  if (!lastAt) {
    return {
      allowed: true,
      reason: 'first_post',
      item: nextItem,
      ...urgency,
      nightMode: night,
      breakingCount,
      cooldownMs: 0,
      waitMs: 0
    };
  }

  let minGapMs = BURST_COOLDOWN_MS;
  if (urgency.tier === 'breaking' && breakingCount >= 2) {
    minGapMs = BREAKING_BURST_MS;
  }

  if (elapsed < minGapMs) {
    return {
      allowed: false,
      reason: breakingCount >= 2 && urgency.tier === 'breaking' ? 'breaking_burst' : 'burst_cooldown',
      item: nextItem,
      ...urgency,
      nightMode: night,
      breakingCount,
      cooldownMs: minGapMs,
      waitMs: minGapMs - elapsed
    };
  }

  if (urgency.tier === 'breaking' || urgency.tier === 'urgent') {
    return {
      allowed: true,
      reason: urgency.tier === 'breaking' ? 'breaking_override' : 'urgent_override',
      item: nextItem,
      ...urgency,
      nightMode: night,
      breakingCount,
      cooldownMs: minGapMs,
      waitMs: 0
    };
  }

  const requiredCooldown = night ? NIGHT_COOLDOWN_MS : NORMAL_COOLDOWN_MS;
  if (elapsed < requiredCooldown) {
    return {
      allowed: false,
      reason: night ? 'night_cooldown' : 'normal_cooldown',
      item: nextItem,
      ...urgency,
      nightMode: night,
      breakingCount,
      cooldownMs: requiredCooldown,
      waitMs: requiredCooldown - elapsed
    };
  }

  return {
    allowed: true,
    reason: night ? 'night_cooldown_expired' : 'normal_cooldown_expired',
    item: nextItem,
    ...urgency,
    nightMode: night,
    breakingCount,
    cooldownMs: requiredCooldown,
    waitMs: 0
  };
}

/** Attach urgency metadata before enqueue (ingestion unchanged). */
function tagCandidate(raw) {
  const urgency = classifyItemUrgency(raw);
  return {
    ...raw,
    postUrgency: urgency.tier,
    urgencyLabel: urgency.label
  };
}

function getCadenceConfig() {
  return {
    normalCooldownMs: NORMAL_COOLDOWN_MS,
    normalCooldownMinutes: Math.round(NORMAL_COOLDOWN_MS / 60000),
    burstCooldownMs: BURST_COOLDOWN_MS,
    burstCooldownMinutes: Math.round(BURST_COOLDOWN_MS / 60000),
    nightCooldownMs: NIGHT_COOLDOWN_MS,
    nightCooldownMinutes: Math.round(NIGHT_COOLDOWN_MS / 60000),
    breakingBurstMs: BREAKING_BURST_MS,
    nightModeHoursEt: '00:00–06:00',
    nightTimezone: NIGHT_TZ,
    urgentLabels: [...URGENT_LABELS, 'breaking'],
    description:
      'Normal 45m · Urgent/breaking bypass interval · Burst min 7m (2m when 2+ breaking) · Night 2.5h for routine posts'
  };
}

module.exports = {
  NORMAL_COOLDOWN_MS,
  BURST_COOLDOWN_MS,
  NIGHT_COOLDOWN_MS,
  classifyItemUrgency,
  pickNextPost,
  evaluatePostWindow,
  tagCandidate,
  isNightModeEst,
  getCadenceConfig
};
