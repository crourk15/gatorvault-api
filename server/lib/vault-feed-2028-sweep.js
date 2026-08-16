/**
 * Twice-daily 2028+ vault feed (7am / 7pm ET).
 *
 * Goal: gather trusted beat intel → update existing FutureCast/recruiting players
 * and carefully provision NEW 2028/2029/2030+ prospects into Vault (monitor-only)
 * so Lab math can move. Never auto-add 2027. Never create coach/staff phantoms.
 *
 * Proof: writes vault-feed-2028-last-report.json for Admin Hub verification.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { resolveRecruitingDataDir } = require('./recruiting-data-dir');

const CLASS_YEAR_MIN = 2028;
const CLASS_YEAR_MAX = 2030;

function reportPath() {
  return path.join(resolveRecruitingDataDir(), 'vault-feed-2028-last-report.json');
}

function readLastReport() {
  try {
    return JSON.parse(fs.readFileSync(reportPath(), 'utf8'));
  } catch {
    return null;
  }
}

function writeReport(report) {
  const file = reportPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return file;
}

function extractClassYears(text) {
  const years = [];
  const re = /\b(202[7-9]|2030)\b/g;
  let m;
  while ((m = re.exec(String(text || '')))) {
    years.push(Number(m[1]));
  }
  return [...new Set(years)];
}

function pickClassYear(text, hint) {
  const hintYear = parseInt(hint, 10);
  if (Number.isFinite(hintYear) && hintYear >= CLASS_YEAR_MIN && hintYear <= CLASS_YEAR_MAX) {
    return hintYear;
  }
  const years = extractClassYears(text).filter((y) => y >= CLASS_YEAR_MIN && y <= CLASS_YEAR_MAX);
  if (years.includes(2028)) return 2028;
  if (years.length) return Math.min(...years);
  // Default discovery band when year omitted but Florida HS recruiting context.
  return 2028;
}

function isBlockedStaff(name, slug) {
  try {
    const staff = require('./recruiting-staff-directory');
    if (name && staff.isStaffOrCoachName?.(name)) return true;
    if (slug && staff.isStaffPlayerSlug?.(slug)) return true;
  } catch {
    /* optional */
  }
  try {
    const blocked = require('./recruiting-blocked-players');
    if (slug && blocked.isBlocked?.({ slug })) return true;
    if (name && blocked.isBlocked?.({ name })) return true;
  } catch {
    /* optional */
  }
  return false;
}

function emptyReport(opts = {}) {
  return {
    ok: true,
    job: 'vault-feed-2028-sweep',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    dryRun: !!opts.dryRun,
    classYearMin: CLASS_YEAR_MIN,
    classYearMax: CLASS_YEAR_MAX,
    beatsFetched: 0,
    beatIngest: null,
    allowlistIntel: null,
    created: [],
    updated: [],
    skipped2027: [],
    blockedStaff: [],
    unresolved: [],
    skipped: [],
    errors: [],
    summary: null,
  };
}

function finalizeSummary(report) {
  report.finishedAt = new Date().toISOString();
  report.summary = {
    createdCount: report.created.length,
    updatedCount: report.updated.length,
    skipped2027Count: report.skipped2027.length,
    blockedStaffCount: report.blockedStaff.length,
    unresolvedCount: report.unresolved.length,
    skippedCount: report.skipped.length,
    errorCount: report.errors.length,
    allowlistCoveragePct: report.allowlistIntel?.coverage?.coveragePct ?? null,
    allowlistMissing: Array.isArray(report.allowlistIntel?.coverage?.missing)
      ? report.allowlistIntel.coverage.missing.length
      : null,
  };
  return report;
}

/**
 * Collect named prospect candidates from recent live beat posts.
 */
function collectBeatCandidates(posts = [], { lookbackHours = 36 } = {}) {
  const cutoff = Date.now() - Math.max(1, lookbackHours) * 60 * 60 * 1000;
  const gate = require('./beat-recruiting-ingest-gate');
  const beatFilters = require('./beat-writer-filters');
  const out = [];
  const seen = new Set();

  for (const post of posts) {
    const text = String(post.text || post.detail || '').trim();
    if (!text) continue;
    const when = Date.parse(post.createdAt || post.publishedAt || post.date || '') || Date.now();
    if (when < cutoff) continue;

    const trusted =
      beatFilters.isTrustedBeatWriter?.(post) === true ||
      gate.isAllowedIngestAccount?.(post) === true ||
      gate.isUfOfficialAccount?.(post) === true;
    if (!trusted) continue;

    const years = extractClassYears(text);
    if (years.length && years.every((y) => y === 2027)) {
      out.push({
        kind: 'skip_2027',
        text,
        handle: post.handle || post.writerName || null,
        url: post.url || post.articleUrl || null,
      });
      continue;
    }
    if (years.length && years.every((y) => y < CLASS_YEAR_MIN)) continue;

    let hit = null;
    try {
      hit = gate.resolvePlayerFromTextSync(text);
    } catch {
      hit = null;
    }
    if (!hit?.playerName) {
      try {
        const teaser = require('./beat-teaser-resolve');
        hit = teaser.resolvePlayerFromBeatPostSync(post);
      } catch {
        hit = null;
      }
    }
    if (!hit?.playerName) continue;

    const name = String(hit.playerName).trim();
    const slug = String(hit.playerSlug || '').toLowerCase() || null;
    const key = `${slug || name.toLowerCase()}|${text.slice(0, 40)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      kind: 'named',
      playerName: name,
      playerSlug: slug,
      classYear: pickClassYear(text, hit.classYear),
      text,
      handle: post.handle || post.writerName || null,
      url: post.url || post.articleUrl || null,
      trusted: true,
      when: new Date(when).toISOString(),
    });
  }
  return out;
}

async function feedExistingSlug(slug, { signalType = null, dryRun = false } = {}) {
  const key = String(slug || '').toLowerCase();
  if (!key) return { ok: false, reason: 'missing_slug' };
  if (dryRun) return { ok: true, dryRun: true, slug: key, action: 'would_feed' };
  try {
    const { feedDeskIntelToFutureCast } = require('./desk-intel-futurecast-feed');
    return await feedDeskIntelToFutureCast({
      slug: key,
      forceHydrate: true,
      signalType: signalType || 'vault_feed_2028',
    });
  } catch (err) {
    return { ok: false, error: err.message, slug: key };
  }
}

async function provisionNewProspect(candidate, { dryRun = false } = {}) {
  const year = Number(candidate.classYear);
  if (year === 2027) {
    return { ok: false, reason: 'skip_2027' };
  }
  if (!Number.isFinite(year) || year < CLASS_YEAR_MIN || year > CLASS_YEAR_MAX) {
    return { ok: false, reason: 'class_year_out_of_scope', classYear: year };
  }
  if (isBlockedStaff(candidate.playerName, candidate.playerSlug)) {
    return { ok: false, reason: 'blocked_staff' };
  }
  if (!candidate.trusted) {
    return { ok: false, reason: 'untrusted_writer' };
  }
  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      action: 'would_provision_monitor',
      playerName: candidate.playerName,
      classYear: year,
    };
  }

  const { provisionBeatProspect } = require('./beat-writer-ingest');
  const store = require('./recruiting-store');
  const existing = candidate.playerSlug
    ? await store.getPlayerBySlug(candidate.playerSlug).catch(() => null)
    : null;

  const provision = await provisionBeatProspect({
    playerName: candidate.playerName,
    classYear: year,
    trustedWriter: true,
    existing,
  });

  if (!provision?.ok || !provision.slug) {
    return {
      ok: false,
      reason: provision?.reason || provision?.error || 'provision_failed',
      playerName: candidate.playerName,
    };
  }

  // Soft-feed FC path for 2028+ monitor entries (hydrate if board thin).
  let feed = null;
  try {
    feed = await feedExistingSlug(provision.slug, { signalType: 'vault_feed_provision' });
  } catch (err) {
    feed = { ok: false, error: err.message };
  }

  return {
    ok: true,
    action: 'provisioned_monitor',
    slug: provision.slug,
    playerName: candidate.playerName,
    classYear: year,
    monitorOnly: provision.monitorOnly !== false,
    feed,
  };
}

async function enqueueUnresolved(candidate, reason) {
  try {
    const { safeEnqueueUnresolvedPrediction } = require('./unresolved-predictions-detect');
    safeEnqueueUnresolvedPrediction({
      reason: reason || 'vault_feed_weak_identity',
      source: 'vault-feed-2028-sweep',
      title: String(candidate.playerName || candidate.text || 'Vault feed unresolved').slice(0, 160),
      textPreview: candidate.text,
      url: candidate.url || null,
      handle: candidate.handle || null,
      eventType: 'vault_feed',
      playerNameHint: candidate.playerName || null,
      playerSlugHint: candidate.playerSlug || null,
      classYearHint: candidate.classYear || null,
      requireMissingIdentity: true,
    });
    return true;
  } catch {
    return false;
  }
}

async function runVaultFeed2028SweepInner(opts = {}) {
  const dryRun = opts.dryRun === true;
  const lookbackHours = opts.lookbackHours != null ? Number(opts.lookbackHours) : 36;
  const maxCreates = opts.maxCreates != null ? Number(opts.maxCreates) : 40;
  const skipBeatIngest = opts.skipBeatIngest === true;
  const skipAllowlistIntel = opts.skipAllowlistIntel === true;
  const report = emptyReport(opts);

  // Allow 2029/2030 class cues during this pass (beat gate otherwise blocks ≥2029).
  const prevAllow2029 = process.env.BEAT_INGEST_ALLOW_CLASS_2029;
  process.env.BEAT_INGEST_ALLOW_CLASS_2029 = 'true';

  try {
    // 1) Load live beat pool
    let posts = [];
    try {
      const liveBeat = require('./live-beat');
      const pack = liveBeat.getBeatPosts?.(120) || {};
      posts = Array.isArray(pack) ? pack : pack.posts || [];
      report.beatsFetched = posts.length;
    } catch (err) {
      report.errors.push({ step: 'getBeatPosts', error: err.message });
    }

    // 2) Run normal beat-writer ingest (visit/offer/intel attach + trusted provision)
    if (!skipBeatIngest) {
      try {
        const { runBeatWriterIngest } = require('./beat-writer-ingest');
        if (!dryRun) {
          report.beatIngest = await runBeatWriterIngest({
            force: opts.force === true,
            posts: opts.posts || null,
          });
        } else {
          report.beatIngest = { ok: true, dryRun: true, skipped: true };
        }
      } catch (err) {
        report.errors.push({ step: 'beatWriterIngest', error: err.message });
        report.beatIngest = { ok: false, error: err.message };
      }
    }

    // 3) Candidate pass — update existing / provision new 2028+ / block phantoms
    const store = require('./recruiting-store');
    const candidates = Array.isArray(opts.candidates)
      ? opts.candidates
      : collectBeatCandidates(posts, { lookbackHours });

    let creates = 0;
    for (const candidate of candidates) {
      if (candidate.kind === 'skip_2027') {
        report.skipped2027.push({
          reason: 'class_2027_handpick_only',
          handle: candidate.handle || null,
          preview: String(candidate.text || '').slice(0, 120),
        });
        continue;
      }

      const name = candidate.playerName;
      const slugHint = candidate.playerSlug;
      if (isBlockedStaff(name, slugHint)) {
        report.blockedStaff.push({
          playerName: name,
          playerSlug: slugHint,
          reason: 'staff_or_coach',
          handle: candidate.handle || null,
        });
        continue;
      }

      if (Number(candidate.classYear) === 2027) {
        report.skipped2027.push({
          playerName: name,
          playerSlug: slugHint,
          reason: 'class_2027_handpick_only',
        });
        continue;
      }

      let existing = null;
      if (slugHint) {
        existing = await store.getPlayerBySlug(slugHint).catch(() => null);
      }
      if (!existing && name) {
        try {
          const { slugify } = require('./slug');
          existing = await store.getPlayerBySlug(slugify(name)).catch(() => null);
        } catch {
          existing = null;
        }
      }

      // Existing 2027 players: never feed via this job
      if (existing && Number(existing.classYear) === 2027) {
        report.skipped2027.push({
          playerName: existing.name || name,
          playerSlug: existing.slug,
          reason: 'existing_2027_handpick_only',
        });
        continue;
      }

      if (existing?.slug) {
        const year = Number(existing.classYear || candidate.classYear || 0);
        if (year && year < CLASS_YEAR_MIN) {
          report.skipped.push({
            playerName: existing.name || name,
            playerSlug: existing.slug,
            reason: 'class_year_below_min',
            classYear: year,
          });
          continue;
        }
        const fed = await feedExistingSlug(existing.slug, {
          signalType: 'vault_feed_2028_existing',
          dryRun,
        });
        report.updated.push({
          playerName: existing.name || name,
          playerSlug: existing.slug,
          classYear: existing.classYear || candidate.classYear,
          action: dryRun ? 'would_update' : 'fed_futurecast',
          feedOk: fed?.ok !== false,
          handle: candidate.handle || null,
          sourcePreview: String(candidate.text || '').slice(0, 100),
        });
        continue;
      }

      // New name — provision monitor-only (trusted + 2028+)
      if (creates >= maxCreates) {
        report.skipped.push({
          playerName: name,
          reason: 'max_creates_reached',
        });
        continue;
      }

      const provisioned = await provisionNewProspect(candidate, { dryRun });
      if (provisioned.reason === 'skip_2027') {
        report.skipped2027.push({ playerName: name, reason: 'skip_2027' });
        continue;
      }
      if (provisioned.reason === 'blocked_staff') {
        report.blockedStaff.push({ playerName: name, reason: 'blocked_staff' });
        continue;
      }
      if (!provisioned.ok) {
        const queued = await enqueueUnresolved(
          candidate,
          provisioned.reason || 'provision_failed'
        );
        report.unresolved.push({
          playerName: name,
          reason: provisioned.reason || 'provision_failed',
          queued,
          handle: candidate.handle || null,
        });
        continue;
      }

      creates += 1;
      report.created.push({
        playerName: name,
        playerSlug: provisioned.slug || null,
        classYear: provisioned.classYear || candidate.classYear,
        action: provisioned.action,
        monitorOnly: provisioned.monitorOnly !== false,
        handle: candidate.handle || null,
        sourcePreview: String(candidate.text || '').slice(0, 100),
        sourceUrl: candidate.url || null,
      });
    }

    // 4) Continuous allowlist intel for 2028 (existing chase targets)
    if (!skipAllowlistIntel) {
      try {
        const { runAllowlistIntelSweep } = require('./allowlist-intel-sweep');
        report.allowlistIntel = await runAllowlistIntelSweep({
          classYear: 2028,
          dryRun,
          maxCreates: opts.allowlistMaxCreates != null ? Number(opts.allowlistMaxCreates) : 200,
        });
      } catch (err) {
        report.errors.push({ step: 'allowlistIntel', error: err.message });
        report.allowlistIntel = { ok: false, error: err.message };
      }
    }

    // 5) Seed/refresh FC predictions for newly created 2028 slugs (movement deltas)
    if (!dryRun && report.created.length) {
      try {
        const { provisionAllowlistPredictionForSlug } = require('./allowlist-futurecast-provision');
        for (const row of report.created) {
          if (!row.playerSlug || Number(row.classYear) !== 2028) continue;
          try {
            await provisionAllowlistPredictionForSlug(row.playerSlug, 2028);
          } catch {
            /* optional */
          }
        }
      } catch (err) {
        report.errors.push({ step: 'provisionPredictions', error: err.message });
      }
    }
  } finally {
    if (prevAllow2029 == null) delete process.env.BEAT_INGEST_ALLOW_CLASS_2029;
    else process.env.BEAT_INGEST_ALLOW_CLASS_2029 = prevAllow2029;
  }

  finalizeSummary(report);
  if (!opts.skipPersist) {
    try {
      writeReport(report);
    } catch (err) {
      report.errors.push({ step: 'writeReport', error: err.message });
    }
  }

  try {
    const opsMonitor = require('./ops-monitor');
    opsMonitor.logEvent?.({
      subsystem: 'cron:vault-feed-2028-sweep',
      status: report.errors.length ? 'warning' : 'success',
      message: `vault-feed-2028 created=${report.summary.createdCount} updated=${report.summary.updatedCount} unresolved=${report.summary.unresolvedCount}`,
      details: report.summary,
    });
  } catch {
    /* optional */
  }

  return report;
}

async function runVaultFeed2028Sweep(opts = {}) {
  try {
    const { runHeavyJob } = require('./heavy-job-gate');
    return runHeavyJob('vault-feed-2028-sweep', () => runVaultFeed2028SweepInner(opts));
  } catch {
    return runVaultFeed2028SweepInner(opts);
  }
}

/** True when America/New_York local hour is 7 or 19 (7am / 7pm ET). */
function isVaultFeedEtWindow(date = new Date()) {
  try {
    const hour = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        hour12: false,
      }).format(date)
    );
    return hour === 7 || hour === 19;
  } catch {
    const utc = date.getUTCHours();
    // EDT approx: 11 and 23 UTC
    return utc === 11 || utc === 23;
  }
}

module.exports = {
  runVaultFeed2028Sweep,
  runVaultFeed2028SweepInner,
  collectBeatCandidates,
  pickClassYear,
  extractClassYears,
  isBlockedStaff,
  readLastReport,
  writeReport,
  reportPath,
  isVaultFeedEtWindow,
  CLASS_YEAR_MIN,
  CLASS_YEAR_MAX,
};
