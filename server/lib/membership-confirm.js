/**
 * One-time paid membership confirmation email after first successful IAP / grant.
 */
const { getPaidMembershipConfirmationEmail } = require('./onboarding-emails');
const { hasPaidAccess } = require('./subscription-service');
const { updateUser } = require('./user-store');

function formatExpiresAt(user) {
  const raw = user?.subscription?.expiresAt;
  if (!raw) return null;
  const end = new Date(raw);
  if (!Number.isFinite(end.getTime())) return null;
  return end.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function shouldSendPaidConfirmation(userBefore, userAfter) {
  if (!userAfter?.email) return false;
  if (userBefore?.paidConfirmationSentAt || userAfter?.paidConfirmationSentAt) return false;
  return hasPaidAccess(userAfter);
}

/**
 * Send paid confirmation once. Safe to call on restore / renew — no-ops after first send.
 * @returns {Promise<{ sent: boolean, skipped?: boolean, reason?: string, provider?: string, error?: string }>}
 */
async function maybeSendPaidMembershipConfirmation(userBefore, userAfter, { deliverEmail } = {}) {
  if (typeof deliverEmail !== 'function') {
    return { sent: false, skipped: true, reason: 'no_deliver_email' };
  }
  if (!shouldSendPaidConfirmation(userBefore, userAfter)) {
    return {
      sent: false,
      skipped: true,
      reason: userAfter?.paidConfirmationSentAt || userBefore?.paidConfirmationSentAt
        ? 'already_sent'
        : 'not_eligible',
    };
  }

  const built = getPaidMembershipConfirmationEmail({
    email: userAfter.email,
    name: userAfter.name,
    tier: userAfter.tier || userAfter.subscription?.tier || 'film',
    expiresAtStr: formatExpiresAt(userAfter),
  });

  try {
    const delivery = await deliverEmail(userAfter.email, built.subject, built.html, {
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
    if (delivery?.sent) {
      updateUser(userAfter.email, {
        paidConfirmationSentAt: new Date().toISOString(),
        paidConfirmationProvider: delivery.provider || null,
      });
      return { sent: true, provider: delivery.provider || null };
    }
    return {
      sent: false,
      reason: delivery?.error || 'delivery_failed',
      provider: delivery?.provider || null,
    };
  } catch (err) {
    return { sent: false, reason: err?.message || 'send_failed' };
  }
}

/** True for ASSN types that represent first paid activation (not renewals). */
function isInitialPaidActivationNotification(type, subtype) {
  const t = String(type || '').toUpperCase();
  const s = String(subtype || '').toUpperCase();
  if (t === 'SUBSCRIBED') return true;
  if (t === 'OFFER_REDEEMED') return true;
  if (t === 'DID_RENEW' || t === 'RENEWAL_EXTENDED') return false;
  if (t === 'DID_CHANGE_RENEWAL_STATUS') return false;
  // INITIAL_BUY subtype is the clearest Apple signal when present.
  if (s === 'INITIAL_BUY') return true;
  return false;
}

module.exports = {
  shouldSendPaidConfirmation,
  maybeSendPaidMembershipConfirmation,
  isInitialPaidActivationNotification,
  formatExpiresAt,
};
