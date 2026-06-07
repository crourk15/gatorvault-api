/**
 * Server-side onboarding email sequence (Days 1–14).
 * Runs when Beehiiv automation is not handling the full sequence.
 */
const { ONBOARDING_SEQUENCE, onboardingEmailHtml } = require('./onboarding-emails');

const CHECK_INTERVAL_MS = 15 * 60 * 1000;

function daysSinceSignup(iso) {
  if (!iso) return 0;
  const start = new Date(iso);
  start.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}

function normalizeSent(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    if (raw.length === 1 && raw[0] === 'beehiiv') return ['beehiiv'];
    return raw.filter((d) => typeof d === 'number');
  }
  return [];
}

function shouldUseServerScheduler(user) {
  if (!user || !user.email) return false;
  const sent = normalizeSent(user.onboardingSent);
  if (sent.includes('beehiiv') || user.onboardingProvider === 'beehiiv') return false;
  return true;
}

async function sendOnboardingDay(user, emailDef, deliverEmail, pushEmailLog) {
  const html = onboardingEmailHtml(emailDef, { name: user.name });
  const tierLabel =
    user.tier === 'war' ? 'War Room' : user.tier === 'locker' ? 'Locker Room' : 'Film Room';
  const delivery = await deliverEmail(user.email, emailDef.subject, html, {
    name: user.name || user.email.split('@')[0],
    tierName: tierLabel,
    trialEnd: user.trialEnd || '',
    onboardingDay: emailDef.day,
    emailSubject: emailDef.subject
  });
  if (delivery.sent) {
    pushEmailLog({
      level: 'success',
      message: `Onboarding Day ${emailDef.day} sent`,
      detail: { email: user.email, day: emailDef.day, provider: delivery.provider },
      source: 'onboarding-scheduler'
    });
    return true;
  }
  pushEmailLog({
    level: 'error',
    message: `Onboarding Day ${emailDef.day} failed`,
    detail: { email: user.email, day: emailDef.day, error: delivery.error },
    source: 'onboarding-scheduler'
  });
  return false;
}

async function processOnboardingQueue({ loadUsers, saveUsers, deliverEmail, pushEmailLog }) {
  const users = loadUsers();
  let changed = false;
  for (const user of users) {
    if (!shouldUseServerScheduler(user)) continue;
    const sent = new Set(normalizeSent(user.onboardingSent));
    const elapsed = daysSinceSignup(user.createdAt);
    for (const emailDef of ONBOARDING_SEQUENCE) {
      if (emailDef.day === 0) continue;
      if (sent.has(emailDef.day)) continue;
      if (elapsed < emailDef.day) continue;
      try {
        const ok = await sendOnboardingDay(user, emailDef, deliverEmail, pushEmailLog);
        if (ok) {
          sent.add(emailDef.day);
          user.onboardingSent = Array.from(sent).sort((a, b) => a - b);
          user.onboardingProvider = user.onboardingProvider || 'server';
          changed = true;
        }
      } catch (err) {
        pushEmailLog({
          level: 'error',
          message: err.message,
          detail: { email: user.email, day: emailDef.day },
          source: 'onboarding-scheduler'
        });
        console.warn('[onboarding-scheduler]', user.email, 'day', emailDef.day, err.message);
      }
    }
  }
  if (changed) saveUsers(users);
  return { processed: users.length, changed };
}

function startOnboardingScheduler(deps) {
  const run = () => {
    processOnboardingQueue(deps).catch((err) => {
      console.warn('[onboarding-scheduler] run failed:', err.message);
    });
  };
  run();
  const timer = setInterval(run, CHECK_INTERVAL_MS);
  if (timer.unref) timer.unref();
  console.log('[onboarding-scheduler] started (interval', CHECK_INTERVAL_MS / 60000, 'min)');
  return timer;
}

module.exports = {
  daysSinceSignup,
  processOnboardingQueue,
  startOnboardingScheduler,
  shouldUseServerScheduler
};
