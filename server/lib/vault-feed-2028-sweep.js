/**
 * Twice-daily 2028+ vault feed (7am / 7pm ET).
 *
 * Goal: gather trusted beat intel → update existing FutureCast/recruiting players
 * and carefully provision NEW 2028/2029/2030+ prospects into Vault (monitor-only)
 * so Lab math can move. Never auto-add 2027. Never create coach/staff phantoms.
 *
 * Proof: writes vault-feed-2028-last-report.json for Admin Hub verification.
 *
 * Cron must accept-and-background. The 7am pass often takes ~30 minutes; a
 * 4-minute HTTP wait + retries will 502 the Starter dyno and the 7pm stamp
 * never writes. A missed 7am stays owed until 7pm; a missed 7pm stays owed
 * until the next 7am — so an 11:03 restart or a noon deploy still pours.
 * Scheduled cron skips allowlist, full beat-ingest, and the X/Nitter writer
 * pull. Cheap 7am/7pm + Hub Run skip beat-ingest (ingest 502'd Starter)
 * and must not wait on the heavy-job gate. An in-process lock only blocks
 * while the disk heartbeat is live or the lock is younger than 15 min.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { resolveRecruitingDataDir } = require('./recruiting-data-dir');

const CLASS_YEAR_MIN = 2028;
const CLASS_YEAR_MAX = 2030;
/** No heartbeat for this long → prior run is dead; catch-up may start. */
const STALE_HEARTBEAT_MS = 15 * 60 * 1000;
/** Hard cap when someone opts into a beat refresh on this pass. */
const BEAT_REFRESH_BUDGET_MS = 90 * 1000;
/** On3 team-news fetch must not hold the 7am/7pm stamp open. */
const ON3_ARTICLE_BUDGET_MS = 20 * 1000;
/** Kill a hung accept pass. Healthy cronLite can take ~30 min — do not cut it off. */
const SWEEP_DEADLINE_MS = 45 * 60 * 1000;

/** Process-local lock — disk heartbeat can go stale while the writer loop is still up. */
let _vaultFeedInFlight = null;

function reportPath() {
  return path.join(resolveRecruitingDataDir(), 'vault-feed-2028-last-report.json');
}

function readLastReport(opts = {}) {
  let report = null;
  try {
    report = JSON.parse(fs.readFileSync(reportPath(), 'utf8'));
  } catch {
    return null;
  }
  if (opts.healStale === true) report = healStaleRunningReport(report);
  return report;
}

/** Turn a dead "running" stamp into an error so Hub is not stuck on running. */
function healStaleRunningReport(report) {
  if (!report || report.status !== 'running') return report;
  if (isActiveVaultFeedRun(report)) return report;
  const dead = {
    ...report,
    ok: false,
    status: 'error',
    finishedAt: new Date().toISOString(),
    heartbeatAt: new Date().toISOString(),
    errors: [...(report.errors || []), { step: 'heartbeat', error: 'stale_running_no_heartbeat' }],
    message:
      'Vault feed started but did not finish — no heartbeat. Hourly catch-up retries this slot until the next 7am / 7pm.',
  };
  try {
    writeReport(dead);
  } catch {
    /* still return honest status */
  }
  return dead;
}

function writeReport(report) {
  const file = reportPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return file;
}

function etParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: Number(get('hour')),
  };
}

/** 7am slot is owed 7–18 ET; 7pm slot is owed 19–23 and overnight 0–6. */
function vaultFeedSlotHour(etHour) {
  const h = Number(etHour);
  if (h >= 7 && h < 19) return 7;
  return 19;
}

function previousEtYmd(p) {
  const utcNoon = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day) - 1, 12, 0, 0);
  return etParts(new Date(utcNoon));
}

function vaultFeedSlotId(date = new Date()) {
  try {
    const p = etParts(date);
    if (p.hour >= 7 && p.hour < 19) {
      return `${p.year}-${p.month}-${p.day}T07`;
    }
    if (p.hour >= 19) {
      return `${p.year}-${p.month}-${p.day}T19`;
    }
    const prev = previousEtYmd(p);
    return `${prev.year}-${prev.month}-${prev.day}T19`;
  } catch {
    return null;
  }
}

function slotIdFromTimestamp(iso) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return null;
  return vaultFeedSlotId(new Date(t));
}

function windowLabelForSlot(slotId) {
  return String(slotId || '').endsWith('T19') ? '7pm' : '7am';
}

/** Always in a 7am or 7pm slot — hourly cron no-ops via alreadyFinishedThisSlot. */
function isVaultFeedEtWindow(date = new Date()) {
  try {
    return vaultFeedSlotId(date) != null;
  } catch {
    return true;
  }
}

function isActiveVaultFeedRun(report, now = Date.now()) {
  if (!report || report.status !== 'running') return false;
  const beat = Date.parse(report.heartbeatAt || report.startedAt || '') || 0;
  if (!beat) return false;
  return now - beat < STALE_HEARTBEAT_MS;
}

function alreadyFinishedThisSlot(report, date = new Date()) {
  // A crashed/healed error stamp must NOT count as done — hourly catch-up
  // retries the same slot until the next 7am / 7pm.
  if (!report || report.status === 'running' || report.status === 'error') return false;
  if (!report.finishedAt) return false;
  const slot = vaultFeedSlotId(date);
  if (!slot) return false;
  const reportSlot =
    report.slotId || slotIdFromTimestamp(report.startedAt) || slotIdFromTimestamp(report.finishedAt);
  return reportSlot === slot;
}

function touchVaultFeedHeartbeat(report, { skipPersist = false } = {}) {
  if (!report || typeof report !== 'object') return report;
  report.heartbeatAt = new Date().toISOString();
  if (!skipPersist) {
    try {
      writeReport(report);
    } catch {
      /* disk optional */
    }
  }
  return report;
}

function isVaultFeedInFlight() {
  return !!_vaultFeedInFlight;
}

function resetVaultFeedInFlightForTests() {
  _vaultFeedInFlight = null;
}

function setVaultFeedInFlightForTests(value) {
  _vaultFeedInFlight = value || { startedAt: Date.now(), slotId: 'test', trigger: 'test' };
}

/**
 * Block only while this process is mid-pass AND (disk heartbeat is live
 * or the lock is younger than 15 min). Negative lock age means the check
 * clock is a slot date behind wall-clock startedAt — that is a live lock.
 * A Saturday 9pm hang used to keep the lock for 14 hours and reject Sunday 7am.
 */
function isVaultFeedLockBlocking(now = Date.now()) {
  if (!_vaultFeedInFlight) return false;
  const prev = readLastReport();
  if (isActiveVaultFeedRun(prev, now)) return true;
  const started = Number(_vaultFeedInFlight.startedAt) || 0;
  if (!started) {
    _vaultFeedInFlight = null;
    return false;
  }
  const lockAge = now - started;
  if (lockAge < STALE_HEARTBEAT_MS) return true;
  _vaultFeedInFlight = null;
  return false;
}

/**
 * Never wait on an unbounded writer pull. Race the live-beat budget, then
 * pour from whatever is already in the beat cache.
 */
async function refreshBeatsForVaultFeed(liveBeat, timeoutMs = BEAT_REFRESH_BUDGET_MS) {
  const budget = Math.max(50, Number(timeoutMs) || BEAT_REFRESH_BUDGET_MS);
  if (typeof liveBeat.isBeatRefreshInFlight === 'function' && liveBeat.isBeatRefreshInFlight()) {
    return {
      timedOut: false,
      cached: true,
      inFlight: true,
      softFailure: true,
      error: 'beat_refresh_already_running',
      source: 'cache',
    };
  }
  let timer = null;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      resolve({
        timedOut: true,
        cached: true,
        softFailure: true,
        error: 'beat_refresh_timeout',
        source: 'cache',
      });
    }, budget);
  });
  try {
    const refreshed = await Promise.race([
      Promise.resolve()
        .then(() =>
          liveBeat.refreshBeatStream({
            timeoutMs: budget,
            skipSideEffects: true,
          })
        )
        .catch((err) => ({
          error: err.message || String(err),
          cached: true,
          softFailure: true,
          source: 'cache',
        })),
      timeout,
    ]);
    return refreshed || {
      cached: true,
      softFailure: true,
      error: 'beat_refresh_empty',
      source: 'cache',
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function buildRunningReport({ dryRun = false, slotId = null, trigger = 'cron' } = {}) {
  const startedAt = new Date().toISOString();
  const slot = slotId || vaultFeedSlotId() || null;
  return {
    ok: true,
    status: 'running',
    job: 'vault-feed-2028-sweep',
    startedAt,
    heartbeatAt: startedAt,
    finishedAt: null,
    dryRun: !!dryRun,
    slotId: slot,
    trigger,
    window: windowLabelForSlot(slot),
    classYearMin: CLASS_YEAR_MIN,
    classYearMax: CLASS_YEAR_MAX,
    beatsFetched: 0,
    created: [],
    updated: [],
    skipped2027: [],
    blockedStaff: [],
    unresolved: [],
    skipped: [],
    errors: [],
    summary: {
      createdCount: 0,
      updatedCount: 0,
      unresolvedCount: 0,
      blockedStaffCount: 0,
      skipped2027Count: 0,
    },
    message: 'Vault feed running — proof fills when the 7am / 7pm pass finishes.',
  };
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
  const slotId = opts.slotId || vaultFeedSlotId() || null;
  const startedAt = new Date().toISOString();
  return {
    ok: true,
    status: 'running',
    job: 'vault-feed-2028-sweep',
    startedAt,
    heartbeatAt: startedAt,
    finishedAt: null,
    dryRun: !!opts.dryRun,
    slotId,
    trigger: opts.trigger || null,
    window: windowLabelForSlot(slotId),
    classYearMin: CLASS_YEAR_MIN,
    classYearMax: CLASS_YEAR_MAX,
    beatsFetched: 0,
    beatRefresh: null,
    beatSource: null,
    beatFetchedAt: null,
    candidatesNamed: 0,
    emptyReason: null,
    beatIngest: null,
    on3Articles: null,
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

function explainEmpty(report) {
  if (report.created.length || report.updated.length) return null;
  if (report.errors?.some((e) => e.step === 'getBeatPosts' || e.step === 'refreshBeatStream')) {
    return 'beat_fetch_failed';
  }
  if (!report.beatsFetched) return 'no_beat_posts_in_cache';
  if (!report.candidatesNamed) {
    return 'beats_present_but_no_named_2028_plus_in_lookback';
  }
  if (report.unresolved.length) return 'candidates_unresolved_only';
  if (report.skipped2027.length && !report.created.length) return 'only_2027_or_skipped';
  return 'no_creates_or_updates';
}

function finalizeSummary(report) {
  report.finishedAt = new Date().toISOString();
  report.emptyReason = explainEmpty(report);
  report.status = report.errors?.length ? 'warning' : 'success';
  report.summary = {
    createdCount: report.created.length,
    updatedCount: report.updated.length,
    skipped2027Count: report.skipped2027.length,
    blockedStaffCount: report.blockedStaff.length,
    unresolvedCount: report.unresolved.length,
    skippedCount: report.skipped.length,
    errorCount: report.errors.length,
    beatsFetched: report.beatsFetched || 0,
    candidatesNamed: report.candidatesNamed || 0,
    emptyReason: report.emptyReason,
    beatSource: report.beatSource || null,
    allowlistCoveragePct: report.allowlistIntel?.coverage?.coveragePct ?? null,
    allowlistMissing: Array.isArray(report.allowlistIntel?.coverage?.missing)
      ? report.allowlistIntel.coverage.missing.length
      : null,
  };
  report.message = `created ${report.summary.createdCount}, updated ${report.summary.updatedCount}, unresolved ${report.summary.unresolvedCount}`
    + (report.emptyReason ? ` · ${report.emptyReason}` : '');
  if (report.slotId) report.window = windowLabelForSlot(report.slotId);
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

    try {
      const pre = require('./beat-intel-prefilter');
      if (pre.isSubscribePromoIntel?.(text)) continue;
    } catch {
      /* optional */
    }

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
    try {
      const { isValidPlayerName } = require('./x-autoposter-player-context');
      if (!isValidPlayerName(name)) continue;
    } catch {
      /* optional */
    }
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

/**
 * Pull UF On3 / Gators Online team-news articles into the same candidate pool as tweets.
 * Articles are first-class intel — writers often publish GO pieces without a named X teaser
 * still sitting in the 80-post beat cache.
 */
async function collectOn3ArticlePosts({ lookbackHours = 72, maxArticles = 40 } = {}) {
  const cutoff = Date.now() - Math.max(1, lookbackHours) * 60 * 60 * 1000;
  const {
    fetchFloridaTeamNewsArticles,
    parseArticleIdentity,
    buildSyntheticBeatPostFromOn3Article,
  } = require('./uf-on3-news-discovery');

  let articles = [];
  try {
    articles = await fetchFloridaTeamNewsArticles();
  } catch (err) {
    return { posts: [], error: err.message, scanned: 0 };
  }

  const sorted = [...(articles || [])]
    .sort((a, b) => new Date(b.postDateGMT || b.postDate || 0) - new Date(a.postDateGMT || a.postDate || 0))
    .slice(0, Math.max(1, maxArticles));

  const posts = [];
  let skippedNoId = 0;
  let skippedOld = 0;
  for (const article of sorted) {
    const when = Date.parse(article?.postDateGMT || article?.postDate || '') || 0;
    if (when && when < cutoff) {
      skippedOld += 1;
      continue;
    }
    const identity = parseArticleIdentity(article);
    if (!identity?.playerName && !identity?.playerSlug) {
      skippedNoId += 1;
      continue;
    }
    const synthetic = buildSyntheticBeatPostFromOn3Article(article, identity);
    posts.push({
      ...synthetic,
      createdAt: synthetic.publishedAt,
      publishedAt: synthetic.publishedAt,
      detail: synthetic.text,
      source: 'on3_team_news',
      playerNameHint: identity.playerName || null,
      playerSlugHint: identity.playerSlug || null,
      classYearHint: identity.classYear || null,
    });
  }

  return {
    posts,
    scanned: sorted.length,
    skippedNoId,
    skippedOld,
    error: null,
  };
}

function summarizeFeedResult(fed) {
  if (!fed || typeof fed !== 'object') {
    return { whatChanged: 'no feed result', ufPct: null, promoted: false };
  }
  if (fed.ok === false) {
    return {
      whatChanged: 'Feed failed: ' + (fed.error || fed.reason || 'unknown'),
      ufPct: fed.player?.ufProbability ?? fed.decision?.pct ?? null,
      promoted: false,
    };
  }
  if (fed.dryRun) {
    return { whatChanged: 'dry-run would update', ufPct: null, promoted: false };
  }

  const decision = fed.decision || {};
  const pct = Number.isFinite(Number(decision.pct)) ? Number(decision.pct) : null;
  const delta = Number.isFinite(Number(decision.delta)) ? Number(decision.delta) : null;
  const prior =
    Number.isFinite(Number(decision.prior))
      ? Number(decision.prior)
      : pct != null && delta != null
        ? Math.round(pct - delta)
        : null;

  const sourceLabel = {
    on3_rpm_seed: 'On3 RPM seed',
    on3_rpm_blend: 'On3 RPM blend',
    offer_seed: 'offer seed',
    signal_nudge: 'signal nudge',
    unchanged: 'unchanged',
    no_seed: 'no seed',
    rivals_pm_locked: 'Rivals locked',
  };

  const parts = [];
  if (fed.isNew) parts.push('new Vault shell');
  if (fed.promoted) parts.push('promoted onto chase board');
  if (fed.allowlisted) parts.push('allowlisted');

  if (decision.nudged && pct != null) {
    const via = decision.source ? ` (${sourceLabel[decision.source] || decision.source})` : '';
    parts.push(
      prior != null && prior !== pct ? `UF% ${prior}→${pct}${via}` : `UF% → ${pct}${via}`
    );
  } else if (pct != null) {
    parts.push(`UF% held at ${pct}`);
  }

  if (fed.player?.natlRank != null) parts.push(`natl #${fed.player.natlRank}`);
  if (fed.player?.posRank != null) parts.push(`pos #${fed.player.posRank}`);

  const stepLabel = {
    hydrate: 'On3 hydrate',
    recruiting_store_upsert: 'store refresh',
    on3_rpm_file: 'On3 RPM file',
    offer_visit_logs: 'offer/visit logs',
    futurecast_prediction_refresh: 'FC prediction refresh',
    futurecast_prediction_seed: 'FC prediction seed',
    '2028_target_board_seed': '2028 board seed',
    admin_allowlist: 'allowlist',
    early_watchlist: 'early watch',
    on3_slug_map: 'On3 slug map',
  };
  if (Array.isArray(fed.steps) && fed.steps.length) {
    const interesting = fed.steps
      .map((s) => {
        const key = s?.step || s?.action || s?.name || null;
        if (!key) return null;
        if (s?.ok === false) return (stepLabel[key] || key) + ' failed';
        if (s?.blocked) return (stepLabel[key] || key) + ' blocked';
        if (key === 'hydrate' || key === 'recruiting_store_upsert' || key === 'futurecast_prediction_refresh'
          || key === 'futurecast_prediction_seed' || key === '2028_target_board_seed'
          || key === 'admin_allowlist' || key === 'early_watchlist') {
          return stepLabel[key] || key;
        }
        return null;
      })
      .filter(Boolean)
      .slice(0, 4);
    if (interesting.length) parts.push(interesting.join(', '));
  }

  if (!parts.length) parts.push('FutureCast intel re-applied from beat');
  return {
    whatChanged: parts.join(' · '),
    ufPct: fed.player?.ufProbability ?? pct,
    promoted: !!fed.promoted,
  };
}

async function feedExistingSlug(
  slug,
  { signalType = null, dryRun = false, forceHydrate = false, timeoutMs = 25000 } = {}
) {
  const key = String(slug || '').toLowerCase();
  if (!key) return { ok: false, reason: 'missing_slug' };
  if (dryRun) return { ok: true, dryRun: true, slug: key, action: 'would_feed' };
  try {
    const { feedDeskIntelToFutureCast } = require('./desk-intel-futurecast-feed');
    // Existing board rows already have On3/store data — force hydrate storms Render
    // (direct On3 403 → jina fallback × every candidate) and leaves Hub "running" forever.
    const feedPromise = feedDeskIntelToFutureCast({
      slug: key,
      forceHydrate: forceHydrate === true,
      signalType: signalType || 'vault_feed_2028',
    });
    const ms = Math.max(5000, Number(timeoutMs) || 25000);
    const fed = await Promise.race([
      feedPromise,
      new Promise((resolve) =>
        setTimeout(
          () => resolve({ ok: false, error: 'feed_timeout', slug: key, timeoutMs: ms }),
          ms
        )
      ),
    ]);
    return fed;
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
    feed = await feedExistingSlug(provision.slug, {
      signalType: 'vault_feed_provision',
      forceHydrate: true,
      timeoutMs: 45000,
    });
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
  if (!opts.skipPersist) touchVaultFeedHeartbeat(report, { skipPersist: false });

  // Allow 2029/2030 class cues during this pass (beat gate otherwise blocks ≥2029).
  const prevAllow2029 = process.env.BEAT_INGEST_ALLOW_CLASS_2029;
  process.env.BEAT_INGEST_ALLOW_CLASS_2029 = 'true';

  try {
    // 1) Refresh + load live beat pool (stale/empty cache → zero creates looks like "nothing happened")
    let posts = [];
    const skipBeatRefresh = opts.skipBeatRefresh === true;
    try {
      const liveBeat = require('./live-beat');
      if (!skipBeatRefresh && !opts.posts && !opts.candidates) {
        try {
          touchVaultFeedHeartbeat(report, { skipPersist: opts.skipPersist === true });
          const budget =
            opts.beatRefreshTimeoutMs != null
              ? Number(opts.beatRefreshTimeoutMs)
              : BEAT_REFRESH_BUDGET_MS;
          const refreshed = await refreshBeatsForVaultFeed(liveBeat, budget);
          report.beatRefresh = {
            ok:
              !refreshed?.error ||
              !!refreshed?.postCount ||
              !!refreshed?.posts?.length ||
              !!refreshed?.cached ||
              !!refreshed?.timedOut,
            postCount: refreshed?.postCount ?? refreshed?.posts?.length ?? null,
            source: refreshed?.source || null,
            error: refreshed?.error || null,
            softFailure: !!refreshed?.softFailure,
            cached: !!refreshed?.cached,
            timedOut: !!refreshed?.timedOut,
            inFlight: !!refreshed?.inFlight,
          };
        } catch (err) {
          report.beatRefresh = { ok: false, error: err.message, cached: true };
          report.errors.push({ step: 'refreshBeatStream', error: err.message });
        }
      } else {
        report.beatRefresh = { ok: true, skipped: true };
      }
      const pack = liveBeat.getBeatPosts?.(120) || {};
      posts = Array.isArray(pack) ? pack : pack.posts || [];
      report.beatsFetched = posts.length;
      report.beatSource = (!Array.isArray(pack) && pack.source) || report.beatRefresh?.source || null;
      report.beatFetchedAt = (!Array.isArray(pack) && pack.fetchedAt) || null;
      if (pack && !Array.isArray(pack) && pack.error) {
        report.errors.push({ step: 'beatCache', error: String(pack.error).slice(0, 240) });
      }
    } catch (err) {
      report.errors.push({ step: 'getBeatPosts', error: err.message });
    }
    touchVaultFeedHeartbeat(report, { skipPersist: opts.skipPersist === true });

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
    touchVaultFeedHeartbeat(report, { skipPersist: opts.skipPersist === true });

    // 3) Merge On3 / Gators Online team-news articles into the beat candidate pool
    if (!opts.candidates && opts.skipOn3Articles !== true) {
      try {
        const on3Budget =
          opts.on3TimeoutMs != null ? Number(opts.on3TimeoutMs) : ON3_ARTICLE_BUDGET_MS;
        const on3 = await Promise.race([
          collectOn3ArticlePosts({
            lookbackHours: Math.max(lookbackHours, 96),
            maxArticles: opts.on3MaxArticles != null ? Number(opts.on3MaxArticles) : 40,
          }),
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  posts: [],
                  scanned: 0,
                  skippedNoId: 0,
                  skippedOld: 0,
                  error: 'on3_article_timeout',
                  timedOut: true,
                }),
              Math.max(1000, on3Budget)
            )
          ),
        ]);
        report.on3Articles = {
          scanned: on3.scanned,
          posts: on3.posts.length,
          skippedNoId: on3.skippedNoId,
          skippedOld: on3.skippedOld,
          error: on3.error,
        };
        if (on3.error) {
          report.errors.push({ step: 'on3Articles', error: on3.error });
        }
        if (on3.posts.length) {
          posts = posts.concat(on3.posts);
          report.beatsFetched = posts.length;
        }
      } catch (err) {
        report.on3Articles = { ok: false, error: err.message };
        report.errors.push({ step: 'on3Articles', error: err.message });
      }
    }

    // 4) Candidate pass — update existing / provision new 2028+ / block phantoms
    const store = require('./recruiting-store');
    const candidates = Array.isArray(opts.candidates)
      ? opts.candidates
      : collectBeatCandidates(posts, { lookbackHours: Math.max(lookbackHours, 96) });
    report.candidatesNamed = candidates.filter((c) => c && c.kind === 'named').length;
    touchVaultFeedHeartbeat(report, { skipPersist: opts.skipPersist === true });

    let creates = 0;
    let candidateIndex = 0;
    for (const candidate of candidates) {
      candidateIndex += 1;
      if (candidateIndex % 5 === 0) {
        touchVaultFeedHeartbeat(report, { skipPersist: opts.skipPersist === true });
      }
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
        const feedSummary = summarizeFeedResult(fed);
        report.updated.push({
          playerName: existing.name || name,
          playerSlug: existing.slug,
          classYear: existing.classYear || candidate.classYear,
          action: dryRun ? 'would_update' : 'fed_futurecast',
          feedOk: fed?.ok !== false,
          feedError: fed?.error || fed?.reason || null,
          whatChanged: feedSummary.whatChanged,
          ufPct: feedSummary.ufPct,
          promoted: feedSummary.promoted,
          handle: candidate.handle || null,
          sourceUrl: candidate.url || null,
          sourcePreview: String(candidate.text || '').slice(0, 160),
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
          playerSlug: candidate.playerSlug || null,
          classYear: candidate.classYear || null,
          reason: provisioned.reason || 'provision_failed',
          queued,
          handle: candidate.handle || null,
          sourceUrl: candidate.url || null,
          sourcePreview: String(candidate.text || '').slice(0, 160),
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
    touchVaultFeedHeartbeat(report, { skipPersist: opts.skipPersist === true });

    // 5) Continuous allowlist intel for 2028 (existing chase targets)
    if (!skipAllowlistIntel) {
      try {
        const { runAllowlistIntelSweep, measureAllowlistIntelCoverage } = require('./allowlist-intel-sweep');
        report.allowlistIntel = await runAllowlistIntelSweep({
          classYear: 2028,
          dryRun,
          maxCreates: opts.allowlistMaxCreates != null ? Number(opts.allowlistMaxCreates) : 200,
        });
        // Always stamp coverage for Hub proof even if sweep returned partial/odd shape.
        if (!report.allowlistIntel?.coverage) {
          try {
            report.allowlistIntel = {
              ...(report.allowlistIntel || {}),
              coverage: measureAllowlistIntelCoverage(2028, { days: 30 }),
            };
          } catch {
            /* optional */
          }
        }
      } catch (err) {
        report.errors.push({ step: 'allowlistIntel', error: err.message });
        let coverage = null;
        try {
          coverage = require('./allowlist-intel-sweep').measureAllowlistIntelCoverage(2028, { days: 30 });
        } catch {
          coverage = null;
        }
        report.allowlistIntel = { ok: false, error: err.message, coverage };
      }
    }
    touchVaultFeedHeartbeat(report, { skipPersist: opts.skipPersist === true });

    // 6) Seed/refresh FC predictions for newly created 2028 slugs (movement deltas)
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

/**
 * Only an explicit writer pull belongs on the heavy-job FIFO.
 * Cron/Hub already skip that pull — queuing them behind on3-ingest is
 * what left Sunday 7pm running for 30+ minutes with 0 beats.
 */
function shouldQueueVaultFeedOnHeavyGate(opts = {}) {
  return opts.skipBeatRefresh === false;
}

/** Cron + Hub default to cache-only. Beat ingest has its own job and 502'd Starter. */
function resolveVaultFeedSkipFlags(opts = {}) {
  const trigger = opts.trigger || 'cron';
  const force = opts.force === true;
  const lite = (trigger === 'cron' && force !== true) || trigger === 'hub';
  const flag = (key) => (opts[key] != null ? opts[key] === true : lite);
  return {
    skipAllowlistIntel: flag('skipAllowlistIntel'),
    skipBeatIngest: flag('skipBeatIngest'),
    skipBeatRefresh: flag('skipBeatRefresh'),
  };
}

async function runVaultFeed2028Sweep(opts = {}) {
  if (!shouldQueueVaultFeedOnHeavyGate(opts)) {
    return runVaultFeed2028SweepInner(opts);
  }
  try {
    const { runHeavyJob } = require('./heavy-job-gate');
    return runHeavyJob('vault-feed-2028-sweep', () => runVaultFeed2028SweepInner(opts));
  } catch {
    return runVaultFeed2028SweepInner(opts);
  }
}

/**
 * Cron + Hub entry: write a running 7am/7pm stamp immediately, then finish
 * in the background so a 4-minute HTTP wait cannot kill the pass.
 */
function acceptVaultFeedSweep(opts = {}) {
  const trigger = opts.trigger || 'cron';
  const force = opts.force === true;
  const date = opts.now instanceof Date ? opts.now : new Date();
  const slotId = opts.slotId || vaultFeedSlotId(date);
  const prev = readLastReport();

  if (isVaultFeedLockBlocking()) {
    return {
      ok: true,
      started: false,
      alreadyRunning: true,
      accepted: true,
      inProcess: true,
      report: prev,
    };
  }
  // Disk "running" with a fresh heartbeat but no in-process lock is a
  // leftover from a restart. Waiting 15 min here is what blocked Hub Run
  // after the gate-fix deploy (Sunday 7:37 PM).
  if (!force && alreadyFinishedThisSlot(prev, date)) {
    return { ok: true, started: false, alreadyDone: true, accepted: true, report: prev };
  }
  if (prev && prev.status === 'running') {
    try {
      writeReport({
        ...prev,
        ok: false,
        status: 'error',
        finishedAt: new Date().toISOString(),
        errors: [...(prev.errors || []), { step: 'accept', error: 'stale_running_unlocked' }],
        message: 'Previous vault feed marked stale — starting a new 7am / 7pm pass.',
      });
    } catch {
      /* continue */
    }
  }

  const running = buildRunningReport({ dryRun: opts.dryRun === true, slotId, trigger });
  if (!opts.skipPersist) {
    try {
      writeReport(running);
    } catch (err) {
      return { ok: false, started: false, accepted: false, error: err.message, report: running };
    }
  }

  // Scheduled 7am/7pm + Hub Run: named-candidate feed only. Allowlist, full
  // beat-ingest, and the X/Nitter writer pull have their own crons. Hub force
  // used to still run beat-ingest and take the Starter dyno to 502.
  const skips = resolveVaultFeedSkipFlags(opts);

  const sweepOpts = {
    dryRun: opts.dryRun === true,
    force,
    maxCreates: opts.maxCreates,
    lookbackHours: opts.lookbackHours,
    skipBeatRefresh: skips.skipBeatRefresh,
    skipAllowlistIntel: skips.skipAllowlistIntel,
    skipBeatIngest: skips.skipBeatIngest,
    skipOn3Articles: opts.skipOn3Articles,
    skipPersist: opts.skipPersist,
    beatRefreshTimeoutMs: opts.beatRefreshTimeoutMs,
    slotId,
    trigger,
  };

  if (opts.launch === false) {
    return { ok: true, started: true, accepted: true, report: running };
  }

  _vaultFeedInFlight = { startedAt: Date.now(), slotId, trigger };

  const hb = setInterval(() => {
    try {
      const live = readLastReport();
      const base = live && live.status === 'running' ? live : running;
      touchVaultFeedHeartbeat(base, { skipPersist: opts.skipPersist === true });
    } catch {
      /* ignore */
    }
  }, 60 * 1000);
  if (typeof hb.unref === 'function') hb.unref();

  setImmediate(() => {
    const deadlineMs =
      opts.sweepDeadlineMs != null ? Number(opts.sweepDeadlineMs) : SWEEP_DEADLINE_MS;
    let deadlineTimer = null;
    const startDeadline = () =>
      new Promise((_, reject) => {
        deadlineTimer = setTimeout(
          () => reject(new Error('vault_feed_deadline')),
          Math.max(5000, deadlineMs)
        );
      });
    // Clock starts when the inner pass starts, not while we wait for On3.
    Promise.resolve()
      .then(() => Promise.race([runVaultFeed2028Sweep(sweepOpts), startDeadline()]))
      .catch((err) => {
        try {
          writeReport({
            ...running,
            ok: false,
            status: 'error',
            finishedAt: new Date().toISOString(),
            heartbeatAt: new Date().toISOString(),
            errors: [{ step: trigger, error: err.message || String(err) }],
            message: err.message || 'Vault feed failed',
          });
        } catch {
          /* ignore */
        }
      })
      .finally(() => {
        if (deadlineTimer) clearTimeout(deadlineTimer);
        clearInterval(hb);
        _vaultFeedInFlight = null;
      });
  });

  return { ok: true, started: true, accepted: true, report: running };
}

module.exports = {
  runVaultFeed2028Sweep,
  runVaultFeed2028SweepInner,
  acceptVaultFeedSweep,
  collectBeatCandidates,
  collectOn3ArticlePosts,
  pickClassYear,
  extractClassYears,
  isBlockedStaff,
  summarizeFeedResult,
  readLastReport,
  writeReport,
  reportPath,
  isVaultFeedEtWindow,
  vaultFeedSlotHour,
  vaultFeedSlotId,
  alreadyFinishedThisSlot,
  isActiveVaultFeedRun,
  healStaleRunningReport,
  buildRunningReport,
  CLASS_YEAR_MIN,
  CLASS_YEAR_MAX,
  STALE_HEARTBEAT_MS,
  BEAT_REFRESH_BUDGET_MS,
  refreshBeatsForVaultFeed,
  isVaultFeedInFlight,
  isVaultFeedLockBlocking,
  resetVaultFeedInFlightForTests,
  setVaultFeedInFlightForTests,
  ON3_ARTICLE_BUDGET_MS,
  SWEEP_DEADLINE_MS,
  shouldQueueVaultFeedOnHeavyGate,
  resolveVaultFeedSkipFlags,
};
