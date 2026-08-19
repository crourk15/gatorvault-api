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
  const raw = String(name || '').trim();
  // "Coach Sumrall Press" / "Coach Mike Holloway" — never a recruit cue
  if (/^coach\b/i.test(raw)) return true;
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

/** Media outlets / analysts / topic fragments that Title-Case as fake "players". */
const VAULT_FEED_NOISE_NAME_RES = [
  /^cbs\s+sports$/i,
  /^the\s+athletic$/i,
  /^usa\s+today$/i,
  /^espn$/i,
  /^ap\s+(top|poll|voters?)$/i,
  /^which\s+ap$/i,
  /^joel\s+klatt$/i,
  /^sec\s+(football|network|college\s+football)$/i,
  /^college\s+football$/i,
  /^combination\s+schedule$/i,
  /^uniform\s+combination/i,
  /^sarkisian\s+line$/i,
  /^o-?line\s+shakeup$/i,
  /^gators?'?\s+nil$/i,
  /^louder\s+after\s+two$/i,
  /^coach\s+.+\s+press$/i,
  /^press\s+conference$/i,
  /^media\s+(day|days|availability)$/i,
];

/** Beat body is program/media noise — not a recruit provision attempt. */
const VAULT_FEED_NOISE_TEXT_RES = [
  /\bpress\s+conference\b/i,
  /\bmedia\s+(availability|day|days)\b/i,
  /\bscrimmage\s+recap\b/i,
  /\bfall\s+camp\s+intel\b/i,
  /\buniform\s+combination\s+schedule\b/i,
  /\bpreseason\s+(ap\s+)?top\s*25\b/i,
  /\ball-american\s+teams?\b/i,
  /\bprojected\s+league\s+standings\b/i,
  /\bsec\s+college\s+football\s+predictions\b/i,
  /\bnil\s+(collective|deal|offer|pitch)/i,
  /\b\$[\d.,]+\s*m\b.*\b(nil|signing\s+bonus)\b/i,
];

function isVaultFeedNoiseName(name) {
  const n = String(name || '').trim();
  if (!n) return true;
  if (VAULT_FEED_NOISE_NAME_RES.some((re) => re.test(n))) return true;
  try {
    const blocked = require('./recruiting-blocked-players');
    if (blocked.isGarbageChaseName?.(n)) return true;
  } catch {
    /* optional */
  }
  // Topic fragments: no lowercase letters in a middle token that isn't a real surname pattern
  // e.g. "O-Line Shakeup", "Combination Schedule"
  if (/\b(shakeup|schedule|standings|predictions?|all-american|watch\s+list)\b/i.test(n)) {
    return true;
  }
  return false;
}

function isVaultFeedNoiseText(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (VAULT_FEED_NOISE_TEXT_RES.some((re) => re.test(t))) {
    // Keep real recruiting beats that ALSO mention a presser / NIL in passing
    // only when a strong HS recruit cue is present (class year + pos / visit / offer).
    const hasRecruitCue =
      /\b(202[8-9]|2030)\b/.test(t) &&
      /\b(QB|RB|WR|TE|OL|OT|OG|C|DL|DT|DE|EDGE|LB|CB|S|ATH|commit|offer|visit|OV|UOV|RPM)\b/i.test(t);
    if (!hasRecruitCue) return true;
  }
  try {
    const pre = require('./beat-intel-prefilter');
    if (pre.isGenericNonPlayerIntel?.(t) && !pre.hasStrongRecruitingSignals?.(t)) return true;
  } catch {
    /* optional */
  }
  return false;
}

function isCurrentRosterCue(name, slug) {
  try {
    const blocked = require('./recruiting-blocked-players');
    const probe = { name, slug: slug || null };
    if (blocked.currentRosterRecruitCollision?.(probe)) return true;
    const key = String(slug || '')
      .trim()
      .toLowerCase();
    if (key && blocked.BLOCKED_PLAYER_SLUGS?.has?.(key)) {
      // Explicit blocked slugs that are current roster (Baugh etc.) — not staff.
      if (!isBlockedStaff(name, slug)) return true;
    }
  } catch {
    /* optional */
  }
  return false;
}

/**
 * Bucket vault-feed refusals so Hub "Unresolved" is only actionable Desk Open work.
 * @returns {{ bucket: 'staff'|'roster'|'noise'|'review', reason: string }}
 */
function classifyVaultFeedCandidate(candidate = {}, provisionReason = null) {
  const name = String(candidate.playerName || '').trim();
  const slug = String(candidate.playerSlug || '').trim().toLowerCase() || null;
  const text = String(candidate.text || '');
  const rawReason = String(provisionReason || '').trim();
  const reasonCode = rawReason.split(':')[0].trim().toLowerCase() || '';

  if (isBlockedStaff(name, slug) || reasonCode === 'blocked_staff' || reasonCode === 'staff_not_recruit') {
    // Roster RBs were mislabeled staff_not_recruit by enterPlayerIntel — prefer roster when true.
    if (isCurrentRosterCue(name, slug) || /baugh|pryor/i.test(name)) {
      return { bucket: 'roster', reason: 'current_roster_player' };
    }
    return { bucket: 'staff', reason: reasonCode === 'staff_not_recruit' ? 'staff_not_recruit' : 'staff_or_coach' };
  }
  if (isCurrentRosterCue(name, slug) || reasonCode === 'current_roster_player') {
    return { bucket: 'roster', reason: 'current_roster_player' };
  }
  if (isVaultFeedNoiseName(name) || isVaultFeedNoiseText(text)) {
    return { bucket: 'noise', reason: 'program_or_media_noise' };
  }
  // HS coach named in a "head coach explains" beat — not a recruit shell
  if (/\b(head\s+coach|hs\s+coach|high\s+school\s+coach)\b/i.test(text) && !/\b(202[8-9]|2030)\b/.test(text)) {
    return { bucket: 'noise', reason: 'program_or_media_noise' };
  }

  if (
    reasonCode === 'on3_id_missing' ||
    reasonCode === 'missing_on3' ||
    reasonCode === 'no_on3_id' ||
    /on3 player id missing/i.test(rawReason) ||
    /missing on3/i.test(rawReason)
  ) {
    return { bucket: 'review', reason: 'on3_id_missing' };
  }
  if (rawReason) {
    // Default unknown provision failures stay reviewable
    return { bucket: 'review', reason: reasonCode || 'provision_failed' };
  }
  return { bucket: 'review', reason: 'needs_desk_open' };
}

function emptyReport(opts = {}) {
  return {
    ok: true,
    status: 'running',
    job: 'vault-feed-2028-sweep',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    dryRun: !!opts.dryRun,
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
    blockedRoster: [],
    noiseSkipped: [],
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
    blockedRosterCount: (report.blockedRoster || []).length,
    noiseSkippedCount: (report.noiseSkipped || []).length,
    // Actionable Desk Open only — noise/roster/staff live in their own buckets
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
  report.message =
    `created ${report.summary.createdCount}, updated ${report.summary.updatedCount}, unresolved ${report.summary.unresolvedCount}`
    + (report.summary.noiseSkippedCount ? `, noise ${report.summary.noiseSkippedCount}` : '')
    + (report.summary.blockedRosterCount ? `, roster ${report.summary.blockedRosterCount}` : '')
    + (report.emptyReason ? ` · ${report.emptyReason}` : '');
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
          const refreshed = await liveBeat.refreshBeatStream();
          report.beatRefresh = {
            ok: !refreshed?.error || !!refreshed?.postCount || !!refreshed?.posts?.length,
            postCount: refreshed?.postCount ?? refreshed?.posts?.length ?? null,
            source: refreshed?.source || null,
            error: refreshed?.error || null,
            softFailure: !!refreshed?.softFailure,
            cached: !!refreshed?.cached,
          };
        } catch (err) {
          report.beatRefresh = { ok: false, error: err.message };
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

    // 3) Merge On3 / Gators Online team-news articles into the beat candidate pool
    if (!opts.candidates && opts.skipOn3Articles !== true) {
      try {
        const on3 = await collectOn3ArticlePosts({
          lookbackHours: Math.max(lookbackHours, 96),
          maxArticles: opts.on3MaxArticles != null ? Number(opts.on3MaxArticles) : 40,
        });
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

      // Early bucket — keep Unresolved for actionable Desk Open only
      const earlyClass = classifyVaultFeedCandidate(candidate);
      if (earlyClass.bucket === 'staff' || isBlockedStaff(name, slugHint)) {
        report.blockedStaff.push({
          playerName: name,
          playerSlug: slugHint,
          reason: earlyClass.reason || 'staff_or_coach',
          handle: candidate.handle || null,
        });
        continue;
      }
      if (earlyClass.bucket === 'roster') {
        report.blockedRoster.push({
          playerName: name,
          playerSlug: slugHint,
          reason: 'current_roster_player',
          handle: candidate.handle || null,
          sourcePreview: String(candidate.text || '').slice(0, 120),
        });
        continue;
      }
      if (earlyClass.bucket === 'noise') {
        report.noiseSkipped.push({
          playerName: name,
          playerSlug: slugHint,
          reason: earlyClass.reason || 'program_or_media_noise',
          handle: candidate.handle || null,
          sourcePreview: String(candidate.text || '').slice(0, 120),
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
        const failReason = provisioned.reason || provisioned.error || 'provision_failed';
        const classified = classifyVaultFeedCandidate(candidate, failReason);
        const row = {
          playerName: name,
          playerSlug: candidate.playerSlug || null,
          classYear: candidate.classYear || null,
          reason: classified.reason,
          handle: candidate.handle || null,
          sourceUrl: candidate.url || null,
          sourcePreview: String(candidate.text || '').slice(0, 160),
        };
        if (classified.bucket === 'staff') {
          report.blockedStaff.push(row);
          continue;
        }
        if (classified.bucket === 'roster') {
          report.blockedRoster.push(row);
          continue;
        }
        if (classified.bucket === 'noise') {
          report.noiseSkipped.push(row);
          continue;
        }
        // Actionable only — enqueue for Beat Desk Open
        const queued = await enqueueUnresolved(candidate, classified.reason || failReason);
        report.unresolved.push({ ...row, queued });
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
  collectOn3ArticlePosts,
  pickClassYear,
  extractClassYears,
  isBlockedStaff,
  isVaultFeedNoiseName,
  isVaultFeedNoiseText,
  classifyVaultFeedCandidate,
  summarizeFeedResult,
  readLastReport,
  writeReport,
  reportPath,
  isVaultFeedEtWindow,
  CLASS_YEAR_MIN,
  CLASS_YEAR_MAX,
};
