/**
 * Member signup listing + owner notify helpers.
 * Source of truth: user-store (Render /var/data/users.json in prod).
 */
const { loadUsers, getUsersStoreInfo } = require('./user-store');

function asUserList(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') return Object.values(raw);
  return [];
}

function memberAccessLabel(user) {
  if (!user) return 'unknown';
  if (user.paid || (user.subscription && String(user.subscription.status || '').toLowerCase() === 'active')) {
    return 'paid';
  }
  const trialEnd = user.trialEnd ? Date.parse(user.trialEnd) : NaN;
  if (Number.isFinite(trialEnd)) {
    return trialEnd >= Date.now() ? 'trial' : 'trial_expired';
  }
  return user.tier || 'locker';
}

/** Public-safe member row for Admin Hub (never includes passwordHash). */
function toPublicMember(user) {
  if (!user || typeof user !== 'object') return null;
  const email = String(user.email || '').trim().toLowerCase();
  if (!email) return null;
  const sub = user.subscription && typeof user.subscription === 'object' ? user.subscription : null;
  return {
    email,
    name: String(user.name || '').trim() || null,
    tier: user.tier || 'locker',
    createdAt: user.createdAt || null,
    trialEnd: user.trialEnd || null,
    paid: Boolean(user.paid),
    access: memberAccessLabel(user),
    subscriptionStatus: sub ? String(sub.status || '') || null : null,
    subscriptionSource: sub ? String(sub.source || '') || null : null,
    onboardingSent: Array.isArray(user.onboardingSent) ? user.onboardingSent.length > 0 : Boolean(user.onboardingSent),
    beehiivEnrolled: Boolean(user.beehiivSubscriptionId),
  };
}

function listRecentMembers(opts = {}) {
  const limitRaw = parseInt(String(opts.limit == null ? 50 : opts.limit), 10);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 200);
  const needle = String(opts.q || '')
    .trim()
    .toLowerCase();
  const users = asUserList(loadUsers());
  let rows = users.map(toPublicMember).filter(Boolean);
  if (needle) {
    rows = rows.filter((u) => {
      const blob = `${u.email} ${u.name || ''}`.toLowerCase();
      return blob.includes(needle);
    });
  }
  rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const store = typeof getUsersStoreInfo === 'function' ? getUsersStoreInfo() : null;
  return {
    ok: true,
    total: users.length,
    count: rows.length,
    limit,
    members: rows.slice(0, limit),
    store: store
      ? {
          pathHint: store.path || null,
          durableEnv: Boolean(store.durableEnv),
          accountCount: store.count != null ? store.count : users.length,
        }
      : { accountCount: users.length },
    updatedAt: new Date().toISOString(),
  };
}

function getSignupNotifyEmail() {
  return (
    String(process.env.SIGNUP_NOTIFY_EMAIL || '').trim() ||
    String(process.env.OWNER_NOTIFY_EMAIL || '').trim() ||
    String(process.env.MONITORING_ALERT_EMAIL || '').trim() ||
    String(process.env.ALERT_EMAIL || '').trim() ||
    ''
  );
}

function buildSignupNotifyEmail({ email, name, createdAt, trialEnd, totalAccounts } = {}) {
  const who = String(name || '').trim() || 'New member';
  const addr = String(email || '').trim().toLowerCase();
  const when = createdAt ? new Date(createdAt).toLocaleString('en-US') : 'just now';
  const trial = trialEnd
    ? new Date(trialEnd).toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';
  const subject = `GatorVault signup: ${who} <${addr}>`;
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.45;color:#0a1628">
      <h2 style="margin:0 0 12px">New GatorVault signup</h2>
      <p style="margin:0 0 8px"><strong>Name:</strong> ${escapeHtml(who)}</p>
      <p style="margin:0 0 8px"><strong>Email:</strong> ${escapeHtml(addr)}</p>
      <p style="margin:0 0 8px"><strong>Signed up:</strong> ${escapeHtml(when)}</p>
      <p style="margin:0 0 8px"><strong>Trial ends:</strong> ${escapeHtml(trial)}</p>
      <p style="margin:0 0 16px"><strong>Total accounts:</strong> ${escapeHtml(String(totalAccounts != null ? totalAccounts : '—'))}</p>
      <p style="margin:0;font-size:14px;color:#475569">
        View all members in Admin Hub → Settings → Members
        (<code>/admin/hub#settings/members</code>).
      </p>
    </div>
  `.trim();
  return { subject, html, to: getSignupNotifyEmail() };
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Fire-and-forget owner alert. Never throws to the register path.
 */
async function notifyOwnerOfSignup(user, deliverEmail) {
  const to = getSignupNotifyEmail();
  if (!to) {
    return { sent: false, skipped: true, reason: 'no_notify_email' };
  }
  if (typeof deliverEmail !== 'function') {
    return { sent: false, skipped: true, reason: 'no_deliver_fn' };
  }
  let totalAccounts = null;
  try {
    totalAccounts = asUserList(loadUsers()).length;
  } catch {
    totalAccounts = null;
  }
  const built = buildSignupNotifyEmail({
    email: user && user.email,
    name: user && user.name,
    createdAt: user && user.createdAt,
    trialEnd: user && user.trialEnd,
    totalAccounts,
  });
  try {
    const delivery = await deliverEmail(built.to, built.subject, built.html, {
      template: 'signup_notify',
      email: built.to,
    });
    const sent = Boolean(delivery && (delivery.sent === true || delivery.ok === true || delivery.provider));
    return {
      sent,
      skipped: false,
      to: built.to,
      provider: delivery && delivery.provider ? delivery.provider : null,
    };
  } catch (err) {
    console.warn('[signup-notify] failed:', err && err.message ? err.message : err);
    return { sent: false, skipped: false, to: built.to, error: String(err && err.message ? err.message : err) };
  }
}

module.exports = {
  listRecentMembers,
  toPublicMember,
  memberAccessLabel,
  getSignupNotifyEmail,
  buildSignupNotifyEmail,
  notifyOwnerOfSignup,
};
