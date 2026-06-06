const fetch = require('node-fetch');

const BEEHIIV_API = 'https://api.beehiiv.com/v2';

function isBeehiivConfigured() {
  return !!(process.env.BEEHIIV_API_KEY && process.env.BEEHIIV_PUBLICATION_ID);
}

function getOnboardingAutomationId() {
  return process.env.BEEHIIV_ONBOARDING_AUTOMATION_ID || null;
}

async function beehiivRequest(path, { method = 'GET', body } = {}) {
  const apiKey = process.env.BEEHIIV_API_KEY;
  if (!apiKey) throw new Error('BEEHIIV_API_KEY not set');

  const res = await fetch(`${BEEHIIV_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (e) {
    json = { raw: text };
  }

  if (!res.ok) {
    const msg = json?.errors?.[0]?.message || json?.message || json?.error || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

/**
 * Enroll a new member in the Beehiiv publication + onboarding automation.
 * Automation must use "Added by API" trigger in Beehiiv.
 * Disable the default Beehiiv welcome email to avoid duplicates.
 */
async function enrollOnboarding({ email, name, tier }) {
  if (!isBeehiivConfigured()) {
    return { enrolled: false, provider: null, error: 'Beehiiv not configured (set BEEHIIV_API_KEY + BEEHIIV_PUBLICATION_ID)' };
  }

  const pubId = process.env.BEEHIIV_PUBLICATION_ID;
  const automationId = getOnboardingAutomationId();
  const payload = {
    email,
    reactivate_existing: false,
    send_welcome_email: false,
    utm_source: 'gatorvault',
    utm_medium: 'registration',
    utm_campaign: 'onboarding_sequence',
    referring_site: process.env.SITE_URL || 'https://gatorvaultinsider.com',
    custom_fields: [
      { name: 'first_name', value: name || email.split('@')[0] },
      { name: 'tier', value: tier || 'film' }
    ]
  };

  if (automationId) payload.automation_ids = [automationId];

  try {
    const result = await beehiivRequest(`/publications/${pubId}/subscriptions`, {
      method: 'POST',
      body: payload
    });
    return {
      enrolled: true,
      provider: 'beehiiv',
      subscriptionId: result?.data?.id || null,
      automationId: automationId || null,
      warning: automationId ? null : 'BEEHIIV_ONBOARDING_AUTOMATION_ID not set — subscriber added but automation not assigned'
    };
  } catch (err) {
    return { enrolled: false, provider: 'beehiiv', error: err.message };
  }
}

async function validateBeehiivOnBoot() {
  if (!isBeehiivConfigured()) {
    console.warn('[beehiiv] Not configured — onboarding emails will use EmailJS Day 0 fallback only.');
    console.warn('[beehiiv] Set BEEHIIV_API_KEY, BEEHIIV_PUBLICATION_ID, BEEHIIV_ONBOARDING_AUTOMATION_ID on Render.');
    return { ok: false, configured: false };
  }
  const automationId = getOnboardingAutomationId();
  if (!automationId) {
    console.warn('[beehiiv] BEEHIIV_ONBOARDING_AUTOMATION_ID missing — subscribers will be added without automation enrollment.');
    return { ok: false, configured: true, automationSet: false };
  }
  console.log('[beehiiv] Onboarding automation ready:', automationId);
  return { ok: true, configured: true, automationSet: true, publicationId: process.env.BEEHIIV_PUBLICATION_ID };
}

module.exports = {
  isBeehiivConfigured,
  getOnboardingAutomationId,
  enrollOnboarding,
  validateBeehiivOnBoot
};
