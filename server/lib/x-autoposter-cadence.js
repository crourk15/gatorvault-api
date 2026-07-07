/**
 * X AutoPoster cadence — hub-first manual posting + limited auto (default 2/day).
 * Normal: 1 post / 4 hr · Urgent: 1 / 3 hr · Commit breaking: 1 / 1 hr · Night routine: 1 / 6 hr
 */
const store = require('./x-autoposter-store');

const NORMAL_COOLDOWN_MS = parseInt(process.env.X_AUTOPOST_COOLDOWN_MS || String(4 * 60 * 60 * 1000), 10);
const URGENT_COOLDOWN_MS = parseInt(process.env.X_AUTOPOST_URGENT_COOLDOWN_MS || String(3 * 60 * 60 * 1000), 10);
const BREAKING_COOLDOWN_MS = parseInt(
  process.env.X_AUTOPOST_BREAKING_COOLDOWN_MS || String(60 * 60 * 1000),
  10
);
const BURST_COOLDOWN_MS = parseInt(process.env.X_AUTOPOST_BURST_MS || String(60 * 60 * 1000), 10);
const NIGHT_COOLDOWN_MS = parseInt(process.env.X_AUTOPOST_NIGHT_MS || String(6 * 60 * 60 * 1000), 10);
const BREAKING_BURST_MS = parseInt(process.env.X_AUTOPOST_BREAKING_BURST_MS || String(45 * 60 * 1000), 10);
const DAILY_MAX_POSTS = parseInt(process.env.X_AUTOPOST_DAILY_MAX || '2', 10);
const DAILY_WINDOW_MS = parseInt(process.env.X_AUTOPOST_DAILY_WINDOW_MS || String(24 * 60 * 60 * 1000), 10);
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
    return { tier: 'normal', label: 'program_news' };
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
    return { tier: 'normal', label: 'analysis' };
  }
  if ((source === 'auto:beat-intel' || source === 'auto:beat-momentum') && item.playerName) {
    return { tier: 'urgent', label: 'major_beat' };
  }
  if (source === 'golden-four-enqueue' || item.validationMeta?.goldenFourEnqueue || item.validationMeta?.goldenFourFactCompose) {
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

function isCommitBreaking(item) {
  if (!item) return false;
  const et = String(item.sourceEventType || item.eventType || '').toLowerCase();
  if (/^(commit|flip|decommit)$/.test(et)) return true;
  return /\b(committed to florida|flips to florida|decommits from florida)\b/i.test(String(item.text || ''));
}

function countDailyPosts() {
  try {
    return require('./x-autoposter-sent-ledger').countRecentSentPosts(DAILY_WINDOW_MS);
  } catch {
    return 0;
  }
}

function requiredCooldownForItem(item, night) {
  if (isCommitBreaking(item)) return BREAKING_COOLDOWN_MS;
  const urgency = classifyItemUrgency(item);
  if (urgency.tier === 'breaking' || urgency.tier === 'urgent') return URGENT_COOLDOWN_MS;
  if (night) return NIGHT_COOLDOWN_MS;
  return NORMAL_COOLDOWN_MS;
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
  const dailyCount = countDailyPosts();

  if (dailyCount >= DAILY_MAX_POSTS && !isCommitBreaking(nextItem)) {
    return {
      allowed: false,
      reason: 'daily_cap',
      item: nextItem,
      ...urgency,
      nightMode: night,
      breakingCount,
      dailyCount,
      dailyMax: DAILY_MAX_POSTS,
      cooldownMs: DAILY_WINDOW_MS,
      waitMs: DAILY_WINDOW_MS
    };
  }

  if (!lastAt) {
    return {
      allowed: true,
      reason: 'first_post',
      item: nextItem,
      ...urgency,
      nightMode: night,
      breakingCount,
      dailyCount,
      dailyMax: DAILY_MAX_POSTS,
      cooldownMs: 0,
      waitMs: 0
    };
  }

  const requiredCooldown = requiredCooldownForItem(nextItem, night);
  if (elapsed < requiredCooldown) {
    const reason = isCommitBreaking(nextItem)
      ? 'breaking_cooldown'
      : urgency.tier === 'normal'
        ? night
          ? 'night_cooldown'
          : 'normal_cooldown'
        : 'urgent_cooldown';
    return {
      allowed: false,
      reason,
      item: nextItem,
      ...urgency,
      nightMode: night,
      breakingCount,
      dailyCount,
      dailyMax: DAILY_MAX_POSTS,
      cooldownMs: requiredCooldown,
      waitMs: requiredCooldown - elapsed
    };
  }

  return {
    allowed: true,
    reason: night ? 'night_cooldown_expired' : 'cooldown_expired',
    item: nextItem,
    ...urgency,
    nightMode: night,
    breakingCount,
    dailyCount,
    dailyMax: DAILY_MAX_POSTS,
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
    urgentCooldownMs: URGENT_COOLDOWN_MS,
    urgentCooldownMinutes: Math.round(URGENT_COOLDOWN_MS / 60000),
    breakingCooldownMs: BREAKING_COOLDOWN_MS,
    breakingCooldownMinutes: Math.round(BREAKING_COOLDOWN_MS / 60000),
    burstCooldownMs: BURST_COOLDOWN_MS,
    burstCooldownMinutes: Math.round(BURST_COOLDOWN_MS / 60000),
    nightCooldownMs: NIGHT_COOLDOWN_MS,
    nightCooldownMinutes: Math.round(NIGHT_COOLDOWN_MS / 60000),
    breakingBurstMs: BREAKING_BURST_MS,
    dailyMaxPosts: DAILY_MAX_POSTS,
    dailyWindowMs: DAILY_WINDOW_MS,
    nightModeHoursEt: '00:00–06:00',
    nightTimezone: NIGHT_TZ,
    urgentLabels: [...URGENT_LABELS, 'breaking'],
    description:
      'Hub-first · Auto max 2/day · Normal 4h · Urgent 3h · UF commit 1h · Night 6h · Manual posts via Post Studio (no API credits)'
  };
}

function isHubModeEnabled() {
  const v = String(process.env.X_AUTOPOST_HUB_MODE || 'true').trim().toLowerCase();
  return !(v === 'false' || v === '0' || v === 'off');
}

function autoCommitsEnabled() {
  return String(process.env.X_AUTOPOST_AUTO_COMMITS || 'false').trim().toLowerCase() === 'true';
}

function autoRoutineEnabled() {
  const v = String(process.env.X_AUTOPOST_AUTO_ROUTINE || 'true').trim().toLowerCase();
  return !(v === 'false' || v === '0' || v === 'off');
}

function autoQueueMax() {
  return Math.max(0, parseInt(process.env.X_AUTOPOST_AUTO_QUEUE_MAX || '2', 10));
}

function minHubReviewTarget() {
  return Math.max(1, parseInt(process.env.X_AUTOPOST_REFILL_MIN_HUB || '5', 10));
}

function isAutoEligibleItem(item) {
  if (!item) return false;
  if (isCommitBreaking(item)) return autoCommitsEnabled();
  return autoRoutineEnabled();
}

function resolveEnqueueStatus(item, { forcePending = false } = {}) {
  const pipelineGuards = require('./pipeline-guards');
  if (!pipelineGuards.autoposterSchedulerEnabled()) return 'hub_review';
  if (forcePending || !isHubModeEnabled()) return 'pending';
  if (!isAutoEligibleItem(item)) return 'hub_review';
  const pending = store.listQueue({ status: 'pending' }).length;
  const dailyCount = countDailyPosts();
  if (pending >= autoQueueMax() || dailyCount >= DAILY_MAX_POSTS) return 'hub_review';
  return 'pending';
}

function getHubStats() {
  const doc = store.loadQueue();
  const items = doc.items || [];
  const hubReview = items.filter((i) => i.status === 'hub_review');
  const pending = items.filter((i) => i.status === 'pending');
  return {
    hubMode: isHubModeEnabled(),
    hubReviewCount: hubReview.length,
    pendingAutoCount: pending.length,
    autoQueueMax: autoQueueMax(),
    dailySent: countDailyPosts(),
    dailyMax: DAILY_MAX_POSTS,
    autoCommits: autoCommitsEnabled(),
    autoRoutine: autoRoutineEnabled(),
    minHubReviewTarget: minHubReviewTarget()
  };
}

function getHubConfig() {
  const pipelineGuards = require('./pipeline-guards');
  return {
    hubMode: isHubModeEnabled(),
    schedulerEnabled: pipelineGuards.autoposterSchedulerEnabled(),
    composeEnabled: pipelineGuards.autoposterComposeEnabled(),
    autoCommits: autoCommitsEnabled(),
    autoRoutine: autoRoutineEnabled(),
    autoQueueMax: autoQueueMax(),
    minHubReview: minHubReviewTarget(),
    dailyMax: DAILY_MAX_POSTS,
    cadence: getCadenceConfig()
  };
}

module.exports = {
  NORMAL_COOLDOWN_MS,
  URGENT_COOLDOWN_MS,
  BREAKING_COOLDOWN_MS,
  BURST_COOLDOWN_MS,
  NIGHT_COOLDOWN_MS,
  DAILY_MAX_POSTS,
  classifyItemUrgency,
  isCommitBreaking,
  countDailyPosts,
  pickNextPost,
  evaluatePostWindow,
  tagCandidate,
  isNightModeEst,
  getCadenceConfig,
  isHubModeEnabled,
  autoCommitsEnabled,
  autoRoutineEnabled,
  autoQueueMax,
  minHubReviewTarget,
  isAutoEligibleItem,
  resolveEnqueueStatus,
  getHubStats,
  getHubConfig
};
