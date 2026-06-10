/**
 * Autoposter freshness — last-post.json source of truth + GV-OM status evaluation.
 */
const fs = require('fs');
const path = require('path');
const opsMonitor = require('./ops-monitor');

const DATA_DIR = path.join(__dirname, '..', 'data', 'autoposter');
const LAST_POST_PATH = path.join(DATA_DIR, 'last-post.json');
const HEALTH_PATH = path.join(DATA_DIR, 'health.json');
const NIGHT_TZ = process.env.X_AUTOPOST_NIGHT_TZ || 'America/New_York';

function nowIso() {
  return new Date().toISOString();
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function getHourEt(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: NIGHT_TZ,
      hour: 'numeric',
      hour12: false
    }).formatToParts(date);
    return parseInt(parts.find((p) => p.type === 'hour')?.value || '12', 10);
  } catch {
    const h = date.getUTCHours() - 5;
    return h < 0 ? h + 24 : h;
  }
}

function getActivityWindow(date = new Date()) {
  const hour = getHourEt(date);
  if (hour >= 0 && hour < 6) return 'overnight';
  if (hour >= 6 && hour < 9) return 'low';
  if (hour >= 22) return 'low';
  return 'normal';
}

function minutesSince(iso) {
  if (!iso) return null;
  return Math.round((Date.now() - new Date(iso).getTime()) / 60000);
}

function formatMinutesAgo(minutes) {
  if (minutes == null) return 'never';
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hours === 1 && !rem) return '1 hour ago';
  if (!rem) return `${hours} hours ago`;
  return `${hours}h ${rem}m ago`;
}

function readLastPost() {
  return readJson(LAST_POST_PATH, { lastPostAt: null });
}

function syncLastPostFromScheduler(scheduler = {}) {
  const existing = readLastPost();
  if (existing.lastPostAt) return existing;
  const legacy = scheduler.lastPostSuccess || scheduler.lastPostAt || null;
  if (legacy) return recordLastPost(legacy);
  return existing;
}

function recordLastPost(at = nowIso()) {
  writeJson(LAST_POST_PATH, { lastPostAt: at });
  const health = readHealth();
  health.identityFailStreak = 0;
  health.updatedAt = at;
  writeJson(HEALTH_PATH, health);
  return { lastPostAt: at };
}

function readHealth() {
  return readJson(HEALTH_PATH, {
    identityFailStreak: 0,
    lastIdentityFailAt: null,
    lastStaleWarningAt: null,
    updatedAt: null
  });
}

function recordIdentityFail() {
  const health = readHealth();
  health.identityFailStreak = (health.identityFailStreak || 0) + 1;
  health.lastIdentityFailAt = nowIso();
  writeJson(HEALTH_PATH, health);
  return health.identityFailStreak;
}

function resetIdentityFailStreak() {
  const health = readHealth();
  health.identityFailStreak = 0;
  writeJson(HEALTH_PATH, health);
}

function postsLast24h() {
  return opsMonitor.countEventsSince('autoposter', 86400000, 'success');
}

function evaluateFreshness({
  lastPostAt = null,
  lastPostAttempt = null,
  errors24h = 0,
  identityFailStreak = 0,
  heartbeat = null
} = {}) {
  const resolvedLast = lastPostAt || readLastPost().lastPostAt;
  const minutes = minutesSince(resolvedLast);
  const window = getActivityWindow();
  const greenMax = window === 'overnight' ? 360 : window === 'low' ? 120 : 45;

  let status = 'green';
  let staleReason = null;

  if (errors24h > 3 || identityFailStreak >= 10) {
    status = 'red';
    staleReason = errors24h > 3 ? 'repeated_errors' : 'identity_fail_streak';
  } else if (heartbeat?.lastStatus === 'error' && (heartbeat.failureStreak || 0) >= 2) {
    status = 'red';
    staleReason = 'heartbeat_errors';
  } else if (!resolvedLast) {
    status = 'red';
    staleReason = 'no_posts_yet';
  } else if (window === 'normal' && minutes > 180) {
    status = 'red';
    staleReason = 'no_recent_posts';
  } else if (minutes > greenMax) {
    status = 'yellow';
    staleReason = 'no_recent_posts';
  }

  return {
    lastPostAt: resolvedLast,
    lastPostAttempt: lastPostAttempt || null,
    minutesSinceLastPost: minutes,
    lastPostLabel: formatMinutesAgo(minutes),
    postsLast24h: postsLast24h(),
    status,
    activityWindow: window,
    greenThresholdMinutes: greenMax,
    staleReason,
    identityFailStreak
  };
}

function maybeLogStaleWarning(freshness) {
  if (freshness.status === 'green') return null;
  if (freshness.staleReason !== 'no_recent_posts') return null;

  const health = readHealth();
  const lastWarn = health.lastStaleWarningAt ? new Date(health.lastStaleWarningAt).getTime() : 0;
  if (Date.now() - lastWarn < 30 * 60 * 1000) return null;

  health.lastStaleWarningAt = nowIso();
  writeJson(HEALTH_PATH, health);

  opsMonitor.logEvent({
    subsystem: 'autoposter',
    status: 'warning',
    message: 'autoposter:no_recent_posts',
    details: { minutesSinceLastPost: freshness.minutesSinceLastPost ?? null, activityWindow: freshness.activityWindow }
  });

  return true;
}

function getAutoposterStatus({ scheduler = {} } = {}) {
  syncLastPostFromScheduler(scheduler);
  const health = readHealth();
  const hb = opsMonitor.getHeartbeat('autoposter:queue') || opsMonitor.getHeartbeat('autoposter:predictions') || {};
  const errors24h = opsMonitor.getErrorCount24h('autoposter');
  const lastPost = readLastPost();

  const freshness = evaluateFreshness({
    lastPostAt: lastPost.lastPostAt || scheduler.lastPostAt || scheduler.lastPostSuccess || null,
    lastPostAttempt: scheduler.lastPostAttempt || null,
    errors24h,
    identityFailStreak: health.identityFailStreak || 0,
    heartbeat: hb
  });

  maybeLogStaleWarning(freshness);

  return {
    ok: true,
    ...freshness,
    schedulerEnabled: process.env.X_AUTOPOST_ENABLED === 'true',
    queuePending: scheduler.queuePending ?? null,
    errors24h
  };
}

module.exports = {
  LAST_POST_PATH,
  getHourEt,
  getActivityWindow,
  minutesSince,
  formatMinutesAgo,
  readLastPost,
  recordLastPost,
  syncLastPostFromScheduler,
  readHealth,
  recordIdentityFail,
  resetIdentityFailStreak,
  postsLast24h,
  evaluateFreshness,
  maybeLogStaleWarning,
  getAutoposterStatus
};
