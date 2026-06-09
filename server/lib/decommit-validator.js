/**
 * Decommit validation — never infer decommits from missing snapshot/API data.
 * A decommit may ONLY fire with explicit verified source + Florida → Open status change.
 */
const fs = require('fs');
const path = require('path');
const store = require('./recruiting-store');
const on3Recruit = require('./on3-recruit-client');

const INTERNAL_ALERTS_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'internal-alerts.json');
const DECOMMIT_LOG_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'decommit-block-log.json');

const VERIFIED_SOURCE_TYPES = new Set([
  'on3_profile',
  'rivals_profile',
  '247_profile',
  'player_announcement',
  'beat_writer',
  'manual_verified'
]);

const INFERENCE_BLOCK_REASONS = new Set([
  'snapshot_absence',
  'missing_from_board',
  'null_commit_field',
  'empty_commit_field',
  'offer_update',
  'profile_refresh',
  'new_player_entry',
  'manual_json_update',
  'unverified_on3_ingest'
]);

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

function normalizeSchool(val) {
  const s = String(val || '')
    .trim()
    .toLowerCase();
  if (!s || s === 'none' || s === 'open' || s === 'uncommitted' || s === 'null') return null;
  if (/^florida$|\bgators\b|\buf\b/.test(s)) return 'Florida';
  return String(val).trim();
}

function isFloridaCommitValue(val) {
  return normalizeSchool(val) === 'Florida';
}

function appendDecommitLog(entry) {
  const doc = readJson(DECOMMIT_LOG_PATH, { version: 1, entries: [] });
  doc.entries = doc.entries || [];
  doc.entries.unshift({ at: new Date().toISOString(), ...entry });
  doc.entries = doc.entries.slice(0, 500);
  doc.updatedAt = new Date().toISOString();
  writeJson(DECOMMIT_LOG_PATH, doc);
}

function appendInternalAlert({ playerName, playerSlug, reason, detail }) {
  const doc = readJson(INTERNAL_ALERTS_PATH, { version: 1, alerts: [] });
  const id = `decommit_block_${playerSlug || 'unknown'}_${Date.now()}`;
  const alert = {
    id,
    type: 'commit_mismatch',
    title: `Commit mismatch detected for ${playerName || playerSlug || 'Unknown'}. Event blocked.`,
    detail: detail || reason,
    playerSlug: playerSlug || null,
    playerName: playerName || null,
    reason,
    createdAt: new Date().toISOString(),
    read: false
  };
  doc.alerts = doc.alerts || [];
  doc.alerts.unshift(alert);
  doc.alerts = doc.alerts.slice(0, 300);
  doc.updatedAt = new Date().toISOString();
  writeJson(INTERNAL_ALERTS_PATH, doc);
  return alert;
}

async function findPlayerRecord(player) {
  if (!player) return null;
  if (player.slug) {
    const bySlug = await store.getPlayerBySlug(player.slug);
    if (bySlug) return bySlug;
  }
  if (player.on3Id) {
    const all = await store.getAllPlayers();
    return all.find((p) => p.on3Id && String(p.on3Id) === String(player.on3Id)) || null;
  }
  if (player.name) {
    const all = await store.getAllPlayers();
    const key = String(player.name).toLowerCase();
    return all.find((p) => String(p.name || '').toLowerCase() === key) || null;
  }
  return null;
}

async function isOnDecommitWhitelist(player, existingPlayer) {
  const record = existingPlayer || (await findPlayerRecord(player));
  if (!record) return false;
  if (store.isFloridaCommit(record)) return true;
  if (record.category === 'target') return true;
  if (record.category === 'recruit' && String(record.status || '').toLowerCase() === 'committed') {
    return isFloridaCommitValue(record.committedTo);
  }
  return false;
}

function resolveOn3RecruitSlug(player, existingPlayer) {
  return (
    player?.on3Slug ||
    existingPlayer?.on3Slug ||
    (player?.on3Id ? `${store.slugify(player.name)}-${player.on3Id}` : null) ||
    (existingPlayer?.on3Id ? `${existingPlayer.slug}-${existingPlayer.on3Id}` : existingPlayer?.slug)
  );
}

async function verifyOn3ProfileNotFlorida(player, existingPlayer) {
  const slug = resolveOn3RecruitSlug(player, existingPlayer);
  if (!slug) return { ok: false, reason: 'no_on3_slug_for_profile_check' };

  try {
    const profile = await on3Recruit.fetchRecruitProfile(slug);
    if (!profile || profile.error) {
      return { ok: false, reason: 'on3_profile_fetch_failed', error: profile?.error };
    }
    const classYear = player?.classYear || existingPlayer?.classYear || profile.classYear;
    const commit = on3Recruit.getCollegeCommit(profile.topTeams, classYear);
    if (commit && on3Recruit.isFloridaTeam(commit)) {
      return { ok: false, reason: 'on3_still_shows_florida_commit', currentCommit: 'Florida' };
    }
    const currentCommit = commit?.team?.name || commit?.team?.fullName || 'Open';
    return { ok: true, currentCommit, profileUrl: `https://www.on3.com/rivals/${slug}/` };
  } catch (e) {
    return { ok: false, reason: 'on3_profile_error', error: e.message };
  }
}

function validateVerificationPayload(verification) {
  if (!verification || typeof verification !== 'object') {
    return { ok: false, reason: 'missing_verification' };
  }
  const sourceType = String(verification.sourceType || verification.source || '').toLowerCase();
  if (!VERIFIED_SOURCE_TYPES.has(sourceType)) {
    return { ok: false, reason: 'unverified_source_type' };
  }
  if (!verification.explicitDecommit && sourceType !== 'manual_verified') {
    return { ok: false, reason: 'not_explicit_decommit' };
  }
  const previousCommit = normalizeSchool(verification.previousCommit);
  if (previousCommit !== 'Florida') {
    return { ok: false, reason: 'previous_commit_not_florida' };
  }
  const currentCommit = normalizeSchool(verification.currentCommit);
  if (currentCommit === 'Florida') {
    return { ok: false, reason: 'current_commit_still_florida' };
  }
  if (sourceType === 'beat_writer') {
    const text = String(verification.detail || verification.text || '').toLowerCase();
    if (!/\bdecommit/.test(text)) {
      return { ok: false, reason: 'beat_writer_missing_decommit_language' };
    }
  }
  return { ok: true, sourceType, previousCommit, currentCommit };
}

/**
 * Block inferred decommits from snapshot/API absence — log only, never post.
 */
async function handleSnapshotAbsence({ player, classYear, trigger = 'snapshot_absence' }) {
  const existing = await findPlayerRecord(player);
  const name = player?.name || existing?.name || 'Unknown';
  const slug = player?.slug || existing?.slug || store.slugify(name);
  const reason = INFERENCE_BLOCK_REASONS.has(trigger) ? trigger : 'snapshot_absence';

  console.warn(`[decommit-validator] BLOCKED inferred decommit (${reason}):`, name, slug);

  appendDecommitLog({
    action: 'blocked',
    reason,
    playerName: name,
    playerSlug: slug,
    classYear,
    trigger
  });

  appendInternalAlert({
    playerName: name,
    playerSlug: slug,
    reason,
    detail: `Commit mismatch detected for ${name}. Player missing from On3 ${classYear} board snapshot — NOT a verified decommit. Event blocked.`
  });

  return { allowed: false, blocked: true, reason, playerName: name, playerSlug: slug };
}

/**
 * Validate before firing any decommit recruiting event or feed alert.
 */
async function validateDecommitEvent({ player, existingPlayer, verification, inferenceTrigger = null }) {
  if (inferenceTrigger || !verification) {
    return handleSnapshotAbsence({
      player,
      classYear: player?.classYear,
      trigger: inferenceTrigger || 'unverified_on3_ingest'
    });
  }

  const name = player?.name || existingPlayer?.name;
  const slug = player?.slug || existingPlayer?.slug || store.slugify(name || '');

  const verifyPayload = validateVerificationPayload(verification);
  if (!verifyPayload.ok) {
    appendDecommitLog({ action: 'blocked', reason: verifyPayload.reason, playerName: name, playerSlug: slug });
    appendInternalAlert({
      playerName: name,
      playerSlug: slug,
      reason: verifyPayload.reason,
      detail: `Commit mismatch detected for ${name}. Event blocked (${verifyPayload.reason}).`
    });
    return { allowed: false, reason: verifyPayload.reason };
  }

  const record = existingPlayer || (await findPlayerRecord(player));
  const onWhitelist = await isOnDecommitWhitelist(player, record);
  if (!onWhitelist) {
    const reason = 'not_on_commit_or_target_whitelist';
    appendDecommitLog({ action: 'blocked', reason, playerName: name, playerSlug: slug });
    appendInternalAlert({
      playerName: name,
      playerSlug: slug,
      reason,
      detail: `Commit mismatch detected for ${name}. Player not on UF commit/target list. Event blocked.`
    });
    return { allowed: false, reason };
  }

  const hadFloridaCommit =
    store.isFloridaCommit(record) ||
    isFloridaCommitValue(record?.committedTo) ||
    verifyPayload.previousCommit === 'Florida';
  if (!hadFloridaCommit) {
    const reason = 'no_prior_florida_commit_on_record';
    appendDecommitLog({ action: 'blocked', reason, playerName: name, playerSlug: slug });
    appendInternalAlert({
      playerName: name,
      playerSlug: slug,
      reason,
      detail: `Commit mismatch detected for ${name}. No prior Florida commit on record. Event blocked.`
    });
    return { allowed: false, reason };
  }

  if (['on3_profile', 'rivals_profile', '247_profile', 'manual_verified'].includes(verifyPayload.sourceType)) {
    const on3Check = await verifyOn3ProfileNotFlorida(player, record);
    if (!on3Check.ok && on3Check.reason === 'on3_still_shows_florida_commit') {
      appendDecommitLog({
        action: 'blocked',
        reason: on3Check.reason,
        playerName: name,
        playerSlug: slug
      });
      appendInternalAlert({
        playerName: name,
        playerSlug: slug,
        reason: on3Check.reason,
        detail: `Commit mismatch detected for ${name}. On3 profile still shows Florida commit. Event blocked.`
      });
      return { allowed: false, reason: on3Check.reason };
    }
  }

  return {
    allowed: true,
    verified: true,
    sourceType: verifyPayload.sourceType,
    previousCommit: 'Florida',
    currentCommit: verifyPayload.currentCommit || 'Open',
    playerName: name,
    playerSlug: slug
  };
}

function isVerifiedDecommitEvent(event) {
  return !!(event?.payload?.verifiedDecommit || event?.payload?.verification?.explicitDecommit);
}

function isFalseInferredDecommitEvent(event) {
  if (event?.eventType !== 'decommit') return false;
  if (isVerifiedDecommitEvent(event)) return false;
  if (event?.source === 'on3') return true;
  if (!event?.payload?.verification) return true;
  return false;
}

module.exports = {
  VERIFIED_SOURCE_TYPES,
  INFERENCE_BLOCK_REASONS,
  validateDecommitEvent,
  handleSnapshotAbsence,
  verifyOn3ProfileNotFlorida,
  isOnDecommitWhitelist,
  isVerifiedDecommitEvent,
  isFalseInferredDecommitEvent,
  appendDecommitLog,
  appendInternalAlert
};
