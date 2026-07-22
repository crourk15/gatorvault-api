/**
 * Weekly fan digest — beat + recruiting movement + verified visits.
 * Sent via deliverEmail (Resend-first), Mondays via Render cron.
 */
const fs = require('fs');
const path = require('path');
const {
  emailShell,
  ctaButton,
  displayNameFrom,
  SITE_URL,
  VAULT_URL,
  VAULT_LINK_LABEL,
  VAULT_URL_DISPLAY,
  SUPPORT_EMAIL,
} = require('./onboarding-emails');
const { hasPaidAccess, trialState } = require('./subscription-service');
const { isoWeekKey } = require('./visit-intel-recap');

const DEFAULT_STATE_PATH = path.join(__dirname, '../data/ops/fan-digest-state.json');
const RECRUITING_URL = `${SITE_URL}/vault/recruiting/`;
const FUTURECAST_URL = `${SITE_URL}/vault/futurecast/`;

function statePath() {
  return process.env.GV_FAN_DIGEST_STATE_PATH || DEFAULT_STATE_PATH;
}

function digestEnabled() {
  // Default OFF — weekly digests flood members. Opt-in only via FAN_DIGEST_ENABLED=true.
  const disabled = String(process.env.FAN_DIGEST_DISABLED || '').toLowerCase();
  if (disabled === '1' || disabled === 'true' || disabled === 'yes') return false;
  const enabled = String(process.env.FAN_DIGEST_ENABLED || '').toLowerCase();
  return enabled === '1' || enabled === 'true' || enabled === 'yes';
}

function readState() {
  try {
    const state = JSON.parse(fs.readFileSync(statePath(), 'utf8'));
    return { version: 1, digests: [], ...state };
  } catch {
    return { version: 1, digests: [] };
  }
}

function writeState(state) {
  const filePath = statePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2)
  );
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(text, max = 160) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function hasSubscriberAccess(user) {
  if (!user) return false;
  if (hasPaidAccess(user)) return true;
  return !trialState(user).expired;
}

function listEligibleFanDigestRecipients(loadUsers) {
  const users = typeof loadUsers === 'function' ? loadUsers() || [] : [];
  return users.filter((user) => {
    if (!user?.email) return false;
    if (user.fanDigestOptOut === true) return false;
    return hasSubscriberAccess(user);
  });
}

function pickBeatItems(posts, limit = 4) {
  return (Array.isArray(posts) ? posts : [])
    .filter((p) => p && (p.text || p.title))
    .slice(0, limit)
    .map((p) => ({
      source: p.writerName || p.handle || p.source || 'Beat',
      text: truncate(p.text || p.title, 180),
      url: p.url || `${SITE_URL}/vault/`,
    }));
}

function pickMovementItems(items, limit = 5) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item && item.name)
    .slice(0, limit)
    .map((item) => ({
      name: item.name,
      summary: truncate(item.summary || item.movementNarrative || item.event || 'Board update', 140),
      url: item.profileUrl
        ? item.profileUrl.startsWith('http')
          ? item.profileUrl
          : `${SITE_URL}${item.profileUrl.startsWith('/') ? '' : '/'}${item.profileUrl}`
        : RECRUITING_URL,
    }));
}

function pickVisitItems(rows, limit = 5) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row && row.name)
    .slice(0, limit)
    .map((row) => {
      const dates = `${row.visitStart || ''}${
        row.visitEnd && row.visitEnd !== row.visitStart ? `–${row.visitEnd}` : ''
      }`;
      return {
        name: row.name,
        summary: truncate(
          [dates, row.visitSourceLabel || 'Verified', row.movementNarrative]
            .filter(Boolean)
            .join(' · '),
          160
        ),
        url: FUTURECAST_URL,
      };
    });
}

async function gatherFanDigestContent({ asOf = new Date(), classYear = 2027 } = {}) {
  const errors = [];
  let beatItems = [];
  let movementItems = [];
  let visitItems = [];
  let weekKey = isoWeekKey(asOf);

  try {
    const { getBeatPosts } = require('./live-beat');
    const beat = getBeatPosts(24);
    beatItems = pickBeatItems(beat?.posts || [], 4);
  } catch (err) {
    errors.push(`beat:${err.message || err}`);
  }

  try {
    const { buildHubMovementFeed } = require('./recruiting-hub-data');
    const feed = await buildHubMovementFeed(classYear);
    const items = Array.isArray(feed) ? feed : feed?.items || [];
    movementItems = pickMovementItems(items, 5);
  } catch (err) {
    errors.push(`movement:${err.message || err}`);
  }

  try {
    const {
      buildWeekendRecapRows,
      enrichRecapRowsWithMovementNarratives,
    } = require('./visit-intel-recap');
    const built = buildWeekendRecapRows(asOf, 7);
    weekKey = built.weekKey || weekKey;
    const enriched = enrichRecapRowsWithMovementNarratives(built.recapRows || [], asOf);
    visitItems = pickVisitItems(enriched, 5);
  } catch (err) {
    errors.push(`visits:${err.message || err}`);
  }

  return { weekKey, beatItems, movementItems, visitItems, errors };
}

function sectionListHtml(items, emptyLabel) {
  if (!items.length) {
    return `<p style="margin:0 0 16px;font-size:14px;color:#94a3b8;line-height:1.55;">${escapeHtml(emptyLabel)}</p>`;
  }
  const lis = items
    .map((item) => {
      const title = escapeHtml(item.name || item.source || 'Update');
      const summary = escapeHtml(item.text || item.summary || '');
      const href = escapeHtml(item.url || VAULT_URL);
      return `<li style="margin:0 0 10px;font-size:14px;color:#cbd5e1;line-height:1.55;"><a href="${href}" style="color:#e2e8f0;text-decoration:none;font-weight:600;">${title}</a>${summary ? ` — ${summary}` : ''}</li>`;
    })
    .join('');
  return `<ul style="margin:0 0 18px;padding-left:18px;">${lis}</ul>`;
}

function buildFanDigestBodyHtml({ name, email, weekKey, beatItems, movementItems, visitItems } = {}) {
  const displayName = displayNameFrom({ name, email });
  return `
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hey ${escapeHtml(displayName)},</p>
  <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">Your weekly GatorVault digest for <strong>${escapeHtml(weekKey)}</strong> — beat, recruiting movement, and verified visits in one pass.</p>
  <p style="margin:0 0 8px;font-size:13px;color:#FA4616;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Beat intel</p>
  ${sectionListHtml(beatItems, 'Quiet on the beat desk this week — open Home for the live feed.')}
  <p style="margin:0 0 8px;font-size:13px;color:#FA4616;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Recruiting movement</p>
  ${sectionListHtml(movementItems, 'No fresh board movement in the digest window.')}
  <p style="margin:0 0 8px;font-size:13px;color:#FA4616;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Verified visits</p>
  ${sectionListHtml(visitItems, 'No verified UF visit windows in this week’s recap.')}
  ${ctaButton(VAULT_URL, VAULT_LINK_LABEL)}
  <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;line-height:1.55;">${VAULT_URL_DISPLAY}</p>
  <p style="margin:12px 0 0;font-size:12px;color:#64748b;line-height:1.55;">Prefer fewer emails? Reply to this message or email <a href="mailto:${SUPPORT_EMAIL}" style="color:#94a3b8;">${SUPPORT_EMAIL}</a> and we’ll opt you out of the weekly digest.</p>
  <p style="margin:16px 0 0;font-size:14px;color:#94a3b8;line-height:1.6;">— GatorVault Media, LLC</p>`;
}

function getFanDigestEmail(opts = {}) {
  const weekKey = opts.weekKey || isoWeekKey();
  const subject = `GatorVault weekly digest — ${weekKey}`;
  const bodyInner = buildFanDigestBodyHtml({ ...opts, weekKey });
  const html = emailShell(bodyInner);
  return {
    kind: 'fan_digest_weekly',
    subject,
    html,
    weekKey,
    templateParams: {
      name: displayNameFrom(opts),
      email: opts.email || '',
      body_html: bodyInner,
      vault_url: VAULT_URL,
      vault_link_label: VAULT_LINK_LABEL,
      support_email: SUPPORT_EMAIL,
      email_subject: subject,
    },
  };
}

/**
 * Process one weekly fan digest pass.
 */
async function processFanDigestWeekly({
  loadUsers,
  saveUsers,
  deliverEmail,
  asOf = new Date(),
  dryRun = false,
  force = false,
  classYear = 2027,
} = {}) {
  if (!digestEnabled()) {
    return { ok: true, sent: 0, skipped: true, reason: 'disabled', details: [] };
  }
  if (typeof loadUsers !== 'function' || typeof deliverEmail !== 'function') {
    throw new Error('processFanDigestWeekly requires loadUsers and deliverEmail');
  }

  const content = await gatherFanDigestContent({ asOf, classYear });
  const weekKey = content.weekKey;
  const state = readState();
  const already = (state.digests || []).some((d) => d.weekKey === weekKey && d.completed);
  if (already && !force) {
    return {
      ok: true,
      sent: 0,
      skipped: true,
      reason: 'already_sent_this_week',
      weekKey,
      details: [],
    };
  }

  const recipients = listEligibleFanDigestRecipients(loadUsers);
  if (!recipients.length) {
    if (!dryRun) {
      state.digests = [
        { weekKey, sentAt: new Date().toISOString(), sent: 0, completed: true, reason: 'no_recipients' },
        ...(state.digests || []),
      ].slice(0, 24);
      writeState(state);
    }
    return { ok: true, sent: 0, skipped: true, reason: 'no_recipients', weekKey, details: [] };
  }

  let sent = 0;
  const details = [];
  const users = loadUsers() || [];
  let changed = false;

  for (const recipient of recipients) {
    if (!force && recipient.fanDigestLastWeekKey === weekKey) {
      details.push({ email: recipient.email, sent: false, reason: 'already_sent_user' });
      continue;
    }
    const built = getFanDigestEmail({
      email: recipient.email,
      name: recipient.name,
      weekKey,
      beatItems: content.beatItems,
      movementItems: content.movementItems,
      visitItems: content.visitItems,
    });

    if (dryRun) {
      details.push({ email: recipient.email, sent: false, dryRun: true, subject: built.subject });
      continue;
    }

    try {
      const delivery = await deliverEmail(recipient.email, built.subject, built.html, {
        name: built.templateParams.name,
        bodyHtml: built.templateParams.body_html,
        emailSubject: built.subject,
        html: built.html,
        vault_url: built.templateParams.vault_url,
        vault_link_label: built.templateParams.vault_link_label,
      });
      if (delivery?.sent) {
        sent += 1;
        const idx = users.findIndex(
          (u) => String(u.email || '').toLowerCase() === String(recipient.email).toLowerCase()
        );
        if (idx >= 0) {
          users[idx] = {
            ...users[idx],
            fanDigestLastWeekKey: weekKey,
            fanDigestLastSentAt: new Date().toISOString(),
          };
          changed = true;
        }
        details.push({ email: recipient.email, sent: true, provider: delivery.provider || null });
      } else {
        details.push({
          email: recipient.email,
          sent: false,
          reason: delivery?.error || 'delivery_failed',
        });
      }
    } catch (err) {
      details.push({ email: recipient.email, sent: false, reason: err.message || 'send_failed' });
    }
  }

  if (changed && typeof saveUsers === 'function') {
    saveUsers(users);
  }

  if (!dryRun) {
    state.digests = [
      {
        weekKey,
        sentAt: new Date().toISOString(),
        sent,
        completed: true,
        recipients: recipients.length,
        content: {
          beat: content.beatItems.length,
          movement: content.movementItems.length,
          visits: content.visitItems.length,
        },
        errors: content.errors,
      },
      ...(state.digests || []),
    ].slice(0, 24);
    writeState(state);
  }

  return {
    ok: true,
    sent,
    skipped: false,
    weekKey,
    recipients: recipients.length,
    content: {
      beat: content.beatItems.length,
      movement: content.movementItems.length,
      visits: content.visitItems.length,
    },
    errors: content.errors,
    details,
  };
}

module.exports = {
  digestEnabled,
  isoWeekKey,
  listEligibleFanDigestRecipients,
  gatherFanDigestContent,
  getFanDigestEmail,
  buildFanDigestBodyHtml,
  processFanDigestWeekly,
  pickBeatItems,
  pickMovementItems,
  pickVisitItems,
  statePath,
  DEFAULT_STATE_PATH,
};
