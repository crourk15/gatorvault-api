/**
 * Server-side onboarding drip + trial-ending convert emails (EmailJS / configured provider).
 * Beehiiv enrollment is optional and parallel — this scheduler is the source of truth.
 */
const {
  ONBOARDING_SEQUENCE,
  TRIAL_REMINDER_SEQUENCE,
  getOnboardingEmailByDay,
  getTrialReminderEmail,
} = require('./onboarding-emails');
const { onboardingMaxSendsPerTick, onboardingSaveEvery } = require('./fanout-util');

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // hourly
let timer = null;
let queueTail = Promise.resolve();

function dripEnabled() {
  // Sole kill switch for trial drip. Do NOT also gate on X_SCHEDULED_JOBS_ENABLED —
  // that flag stays false on Starter for heavy X/hub work and previously silenced drip.
  const raw = String(process.env.ONBOARDING_DRIP_DISABLED || '').toLowerCase();
  return !(raw === '1' || raw === 'true' || raw === 'yes');
}

function shouldUseServerScheduler() {
  return dripEnabled();
}

function daysSinceSignup(user, now = new Date()) {
  const raw = user?.createdAt || user?.trialStart || null;
  if (!raw) return 0;
  const start = new Date(raw);
  if (!Number.isFinite(start.getTime())) return 0;
  const ms = now.getTime() - start.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

function trialDaysLeft(user, now = new Date()) {
  if (!user?.trialEnd) return null;
  const end = new Date(user.trialEnd);
  if (!Number.isFinite(end.getTime())) return null;
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
}

function formatTrialEnd(user) {
  if (!user?.trialEnd) return null;
  const end = new Date(user.trialEnd);
  if (!Number.isFinite(end.getTime())) return null;
  return end.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function asSentSet(list) {
  return new Set(Array.isArray(list) ? list.map((x) => (typeof x === 'number' ? x : String(x))) : []);
}

/** Day-25 drip and d5 are the same "Stay with Gator Nation — weekday" letter. */
const TRIAL_ENDING_DRIP_DAY = 25;
const TRIAL_ENDING_REMINDER_KEY = 'd5';

function hasTrialEndingLetter(user) {
  const drip = asSentSet(user?.onboardingSent);
  const reminders = new Set(
    Array.isArray(user?.trialRemindersSent) ? user.trialRemindersSent.map(String) : []
  );
  return drip.has(TRIAL_ENDING_DRIP_DAY) || drip.has(String(TRIAL_ENDING_DRIP_DAY)) || reminders.has(TRIAL_ENDING_REMINDER_KEY);
}

function markTrialEndingLetterSent(user) {
  const drip = Array.isArray(user.onboardingSent) ? user.onboardingSent.slice() : [];
  if (!drip.some((d) => Number(d) === TRIAL_ENDING_DRIP_DAY || String(d) === String(TRIAL_ENDING_DRIP_DAY))) {
    drip.push(TRIAL_ENDING_DRIP_DAY);
  }
  const reminders = Array.isArray(user.trialRemindersSent) ? user.trialRemindersSent.slice() : [];
  if (!reminders.map(String).includes(TRIAL_ENDING_REMINDER_KEY)) {
    reminders.push(TRIAL_ENDING_REMINDER_KEY);
  }
  user.onboardingSent = drip;
  user.trialRemindersSent = reminders;
}

function dueDripDays(user, now = new Date()) {
  const elapsed = daysSinceSignup(user, now);
  const sent = asSentSet(user.onboardingSent);
  const skipDay25 = hasTrialEndingLetter(user);
  return ONBOARDING_SEQUENCE
    .filter((e) => e.day > 0 && elapsed >= e.delayDays && !sent.has(e.day) && !sent.has(String(e.day)))
    .filter((e) => !(e.day === TRIAL_ENDING_DRIP_DAY && skipDay25))
    .map((e) => e.day);
}

function dueTrialReminderKeys(user, now = new Date()) {
  if (!user?.trialEnd) return [];
  const end = new Date(user.trialEnd);
  if (!Number.isFinite(end.getTime()) || end.getTime() < now.getTime()) return [];
  const left = trialDaysLeft(user, now);
  if (left == null) return [];
  const sent = new Set(Array.isArray(user.trialRemindersSent) ? user.trialRemindersSent.map(String) : []);
  // Catch up if the exact day was missed (outage): fire when daysLeft <= target and not sent.
  // Prefer the tightest unmet reminder (d1 before d5 when both due).
  const due = TRIAL_REMINDER_SEQUENCE
    .filter((e) => left <= e.daysLeft && !sent.has(e.key))
    .filter((e) => !(e.key === TRIAL_ENDING_REMINDER_KEY && hasTrialEndingLetter(user)))
    .sort((a, b) => a.daysLeft - b.daysLeft);
  return due.length ? [due[0].key] : [];
}

async function sendBuiltEmail(deliverEmail, to, built) {
  return deliverEmail(to, built.subject, built.html, {
    name: built.templateParams.name,
    tier: built.templateParams.tier,
    tierName: built.tier,
    tierBenefits: built.templateParams.tier_benefits,
    bodyHtml: built.templateParams.body_html,
    emailSubject: built.subject,
    html: built.html,
    vault_url: built.templateParams.vault_url,
    vault_link_label: built.templateParams.vault_link_label,
  });
}

/**
 * Process one pass of drip + trial reminders.
 * @returns {{ processed: number, sent: number, changed: boolean, disabled?: boolean, details: object[] }}
 */
async function processOnboardingQueue(opts = {}) {
  const run = queueTail.then(
    () => processOnboardingQueueUnlocked(opts),
    () => processOnboardingQueueUnlocked(opts)
  );
  queueTail = run.catch(() => {});
  return run;
}

async function processOnboardingQueueUnlocked({
  loadUsers,
  saveUsers,
  deliverEmail,
  hasPaidAccess,
  now = new Date(),
  pushEmailLog,
  maxSends = onboardingMaxSendsPerTick(),
  saveEvery = onboardingSaveEvery(),
} = {}) {
  if (!dripEnabled()) {
    return { processed: 0, sent: 0, changed: false, disabled: true, details: [] };
  }
  if (typeof loadUsers !== 'function' || typeof saveUsers !== 'function' || typeof deliverEmail !== 'function') {
    throw new Error('processOnboardingQueue requires loadUsers, saveUsers, deliverEmail');
  }

  const paidCheck = typeof hasPaidAccess === 'function'
    ? hasPaidAccess
    : (() => {
        try {
          return require('./subscription-service').hasPaidAccess;
        } catch {
          return () => false;
        }
      })();

  const users = loadUsers() || [];
  let changed = false;
  let sent = 0;
  let sinceSave = 0;
  let hitBudget = false;
  const details = [];
  const budget = Math.max(1, Number(maxSends) || 40);
  const checkpointEvery = Math.max(1, Number(saveEvery) || 5);

  function checkpoint() {
    if (!changed) return;
    saveUsers(users);
    sinceSave = 0;
  }

  for (let i = 0; i < users.length; i += 1) {
    if (sent >= budget) {
      hitBudget = true;
      break;
    }
    const user = users[i];
    if (!user?.email) continue;
    if (paidCheck(user)) continue;

    const trialEndStr = formatTrialEnd(user);
    const daysLeft = trialDaysLeft(user, now);
    const opts = {
      email: user.email,
      name: user.name,
      tier: user.tier || 'locker',
      trialEndStr,
      daysLeft,
    };

    let dripDays = dueDripDays(user, now);
    let reminderKeys = dueTrialReminderKeys(user, now);
    // Same letter: day-25 drip and d5. Send once; stamp both.
    if (dripDays.includes(TRIAL_ENDING_DRIP_DAY) && reminderKeys.includes(TRIAL_ENDING_REMINDER_KEY)) {
      dripDays = dripDays.filter((day) => day !== TRIAL_ENDING_DRIP_DAY);
    }
    for (const day of dripDays) {
      if (sent >= budget) {
        hitBudget = true;
        break;
      }
      const built = getOnboardingEmailByDay(day, opts);
      if (!built) continue;
      try {
        const delivery = await sendBuiltEmail(deliverEmail, user.email, built);
        if (delivery?.sent) {
          if (Number(day) === TRIAL_ENDING_DRIP_DAY) markTrialEndingLetterSent(user);
          else user.onboardingSent = Array.isArray(user.onboardingSent) ? [...user.onboardingSent, day] : [day];
          user.onboardingProvider = user.onboardingProvider || 'server';
          user.onboardingLastSentAt = now.toISOString();
          changed = true;
          sent += 1;
          sinceSave += 1;
          details.push({ email: user.email, type: 'drip', day, ok: true });
          if (typeof pushEmailLog === 'function') {
            pushEmailLog({
              level: 'success',
              message: `Onboarding drip day ${day} sent`,
              detail: { email: user.email, day },
              source: 'onboarding-scheduler',
            });
          }
          if (sinceSave >= checkpointEvery) checkpoint();
        } else {
          details.push({ email: user.email, type: 'drip', day, ok: false, error: delivery?.error || 'not_sent' });
        }
      } catch (err) {
        details.push({ email: user.email, type: 'drip', day, ok: false, error: err.message });
        if (typeof pushEmailLog === 'function') {
          pushEmailLog({
            level: 'error',
            message: `Onboarding drip day ${day} failed`,
            detail: { email: user.email, day, error: err.message },
            source: 'onboarding-scheduler',
          });
        }
      }
    }

    if (hitBudget) break;

    for (const key of reminderKeys) {
      if (sent >= budget) {
        hitBudget = true;
        break;
      }
      const def = TRIAL_REMINDER_SEQUENCE.find((e) => e.key === key);
      if (!def) continue;
      const built = getTrialReminderEmail(def.daysLeft, opts);
      if (!built) continue;
      try {
        const delivery = await sendBuiltEmail(deliverEmail, user.email, built);
        if (delivery?.sent) {
          if (key === TRIAL_ENDING_REMINDER_KEY) markTrialEndingLetterSent(user);
          else {
            user.trialRemindersSent = Array.isArray(user.trialRemindersSent)
              ? [...user.trialRemindersSent, key]
              : [key];
          }
          user.onboardingLastSentAt = now.toISOString();
          changed = true;
          sent += 1;
          sinceSave += 1;
          details.push({ email: user.email, type: 'trial_reminder', key, ok: true });
          if (typeof pushEmailLog === 'function') {
            pushEmailLog({
              level: 'success',
              message: `Trial reminder ${key} sent`,
              detail: { email: user.email, key },
              source: 'onboarding-scheduler',
            });
          }
          if (sinceSave >= checkpointEvery) checkpoint();
        } else {
          details.push({ email: user.email, type: 'trial_reminder', key, ok: false, error: delivery?.error || 'not_sent' });
        }
      } catch (err) {
        details.push({ email: user.email, type: 'trial_reminder', key, ok: false, error: err.message });
      }
    }

    users[i] = user;
  }

  if (changed && sinceSave > 0) saveUsers(users);
  return {
    processed: users.length,
    sent,
    changed,
    details,
    hitBudget,
    maxSends: budget,
  };
}

function startOnboardingScheduler(deps = {}) {
  if (!dripEnabled()) {
    console.log('[onboarding-scheduler] disabled via ONBOARDING_DRIP_DISABLED');
    return null;
  }
  if (timer) return timer;

  const intervalMs = Math.max(
    5 * 60 * 1000,
    Number(process.env.ONBOARDING_SCHEDULER_INTERVAL_MS) || DEFAULT_INTERVAL_MS
  );

  const tick = () => {
    processOnboardingQueue(deps).catch((err) => {
      console.warn('[onboarding-scheduler] tick failed', err.message);
    });
  };

  // First pass after the instance is past Render's deploy health window.
  // 45s after scheduler start was still inside the 502-loop window.
  const firstTickMs = Math.max(
    180000,
    parseInt(process.env.ONBOARDING_SCHEDULER_BOOT_DELAY_MS || '180000', 10) || 180000
  );
  setTimeout(tick, firstTickMs);
  timer = setInterval(tick, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
  console.log(`[onboarding-scheduler] drip + trial reminders every ${Math.round(intervalMs / 60000)}m`);
  return timer;
}

function stopOnboardingScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = {
  daysSinceSignup,
  trialDaysLeft,
  dueDripDays,
  dueTrialReminderKeys,
  hasTrialEndingLetter,
  processOnboardingQueue,
  startOnboardingScheduler,
  stopOnboardingScheduler,
  shouldUseServerScheduler,
  dripEnabled,
};
