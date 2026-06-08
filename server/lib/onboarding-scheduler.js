/**
 * Follow-up onboarding emails are disabled — welcome email only (sent on signup).
 */
function startOnboardingScheduler() {
  console.log('[onboarding-scheduler] disabled — single welcome email on signup only');
  return null;
}

async function processOnboardingQueue() {
  return { processed: 0, changed: false, disabled: true };
}

module.exports = {
  daysSinceSignup: () => 0,
  processOnboardingQueue,
  startOnboardingScheduler,
  shouldUseServerScheduler: () => false
};
