/**
 * Feed Beat Desk / On3 board intel into FutureCast targeting.
 *
 * Brand-new Florida-involved prospects → recruiting store + early watch +
 * (2028) admin allowlist + 2028 board seed + FC prediction seed.
 * Existing targets → refresh measurements/ranks/schools/visits and nudge UF %
 * toward On3 RPM (never overwrite Rivals PM).
 *
 * This is player/board data — not X post content.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const store = require('./recruiting-store');
const {
  toPercent,
  sanitizeRpmPct,
  loadRivalsOnlyUfPctBySlug,
} = require('./uf-probability-utils');
const { isAllowlistedTarget, canonicalTargetSlug } = require('./recruiting-target-allowlist');
const { isFloridaSchool } = require('./recruiting-target-filters');
const on3Recruit = require('./on3-recruit-client');

const ON3_RPM_PATH = path.join(__dirname, '..', 'data', 'war-room', 'on3-rpm-allowlist.json');
const ON3_SLUG_MAP_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'on3-allowlist-slugs-2028.json');

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function floridaOfferedOnPlayer(player) {
  if (!player) return false;
  if (player.ufOffer === true || player.hasUFOffer === true || player.ufOfferVerified === true) {
    return true;
  }
  if (/florida\s+offered|offered/i.test(String(player.ufStatus || ''))) return true;
  const offerLists = [player.offers, player.offerList].filter(Array.isArray);
  if (
    offerLists.some((list) =>
      list.some((o) => {
        const school = String(o?.school || o?.name || o || '');
        return /^florida$/i.test(school.trim()) || /^florida gators$/i.test(school.trim());
      })
    )
  ) {
    return true;
  }
  const teams = player.on3TopTeams || player.topTeams || [];
  const year = Number(player.classYear) || 2028;
  const uf = on3Recruit.getFloridaTeam(teams, year);
  return Boolean(uf && /offer/i.test(String(uf.status || '')));
}

function floridaVisitOnPlayer(player) {
  const trail = Array.isArray(player?.visitTrail) ? player.visitTrail : [];
  if (trail.some((v) => isFloridaSchool(v.school || ''))) return true;
  const teams = player?.on3TopTeams || player?.topTeams || [];
  const year = Number(player?.classYear) || 2028;
  const uf = on3Recruit.getFloridaTeam(teams, year);
  if (!uf) return false;
  return (
    Number(uf.officialVisitCount) > 0 ||
    Number(uf.unOfficialVisitCount) > 0 ||
    Boolean(uf.latestVisit)
  );
}

function shouldPromoteToFutureCast(player, classYear) {
  const year = Number(classYear || player?.classYear);
  // Closing Class is code-locked — never soft-expand.
  if (year === 2027) return false;
  if (year !== 2028) return false;
  if (!player?.name || !player?.on3Slug) return false;
  // Offer = real UF involvement. Visit-only national prospects (e.g. Trace Hawkins)
  // must not soft-expand the 2028 Home / underclassmen board.
  if (floridaOfferedOnPlayer(player)) return true;
  // Sanitize — never let residual 0.99→99 poison force a promote.
  const rpm = sanitizeRpmPct(player.ufRpmPct ?? player.ufProbability);
  // Extreme 90%+ on an uncommitted kid is residual poison, not a market call.
  if (rpm != null && rpm >= 15 && rpm < 90) return true;
  return false;
}

/**
 * Decide next UF targeting % (0–100).
 * Existing: blend toward On3 RPM with capped steps + signal bumps.
 * New: seed from On3 RPM (or offer baseline).
 */
function decideTargetingPct({
  priorPct = null,
  on3RpmPct = null,
  signalType = null,
  floridaOffered = false,
  isNew = false,
  rivalsLocked = false
} = {}) {
  if (rivalsLocked) {
    const prior = toPercent(priorPct);
    return {
      pct: prior || null,
      delta: 0,
      source: 'rivals_pm_locked',
      nudged: false
    };
  }

  const on3 = toPercent(on3RpmPct);
  const prior = toPercent(priorPct);
  const signal = String(signalType || '').toLowerCase().replace(/\s+/g, '_');

  if (isNew || prior <= 0) {
    if (on3 > 0) {
      return { pct: on3, delta: on3, source: 'on3_rpm_seed', nudged: true };
    }
    if (floridaOffered) {
      return { pct: 25, delta: 25, source: 'offer_seed', nudged: true };
    }
    return { pct: null, delta: 0, source: 'no_seed', nudged: false };
  }

  if (on3 <= 0) {
    const bump =
      signal === 'official_visit' || signal === 'ov'
        ? 6
        : signal === 'offer'
          ? 5
          : signal === 'trending' || signal === 'trending_up'
            ? 3
            : 0;
    if (!bump) {
      return { pct: prior, delta: 0, source: 'unchanged', nudged: false };
    }
    const next = clamp(prior + bump, 1, 95);
    return { pct: next, delta: next - prior, source: 'signal_nudge', nudged: next !== prior };
  }

  const maxStep =
    signal === 'official_visit' || signal === 'ov'
      ? 8
      : signal === 'offer'
        ? 6
        : signal === 'trending' || signal === 'trending_up'
          ? 5
          : 4;

  let next = prior + clamp(on3 - prior, -maxStep, maxStep);
  // Florida offer on file: catch up toward On3 board truth (cap +20 / feed).
  if (floridaOffered && on3 >= prior) {
    next = prior + clamp(on3 - prior, 0, Math.max(maxStep, 20));
  }
  next = clamp(Math.round(next), 1, 99);
  return {
    pct: next,
    delta: next - prior,
    source: 'on3_rpm_blend',
    nudged: next !== prior
  };
}

function sanitizeHighSchoolLabel(school) {
  let s = String(school || '').trim();
  if (!s) return null;
  // Identity validator rejects "City, ST" hometown shapes in school field.
  s = s.replace(/,\s*[A-Z]{2}\s*$/i, '').trim();
  s = s.replace(/\s+\(([A-Z]{2})\)\s*$/i, '').trim();
  return s || null;
}

function buildStorePatchFromHydrated(player, slug, targetingPct) {
  const key = String(slug || player?.slug || '').toLowerCase();
  const rpm = toPercent(player?.ufRpmPct ?? player?.ufProbability);
  const pct = targetingPct != null ? targetingPct : rpm || null;
  const rivals = Array.isArray(player?.rivals)
    ? player.rivals
    : Array.isArray(player?.competingSchools)
      ? player.competingSchools
      : [];
  const school = sanitizeHighSchoolLabel(player.school || player.highSchool || null);

  return {
    slug: key,
    name: player.name || player.fullName || key,
    classYear: player.classYear || player.year || null,
    pos: player.pos || player.position || null,
    school,
    state: player.state || player.hometownState || null,
    hometown: player.hometown || null,
    stars: player.stars ?? null,
    rating: player.rating ?? null,
    natlRank: player.natlRank ?? player.nationalRank ?? null,
    posRank: player.posRank ?? player.positionRank ?? null,
    stateRank: player.stateRank ?? null,
    height: player.height || null,
    weight: player.weight ?? null,
    htWt: player.htWt || null,
    on3Slug: player.on3Slug || null,
    on3Id: player.on3Id || null,
    on3ProfileUrl: player.on3ProfileUrl || null,
    on3TopTeams: player.on3TopTeams || player.topTeams || null,
    topTeams: player.on3TopTeams || player.topTeams || null,
    competingSchools: rivals.length ? rivals : player.competingSchools || null,
    rivals: rivals.length ? rivals : player.rivals || null,
    visitTrail: player.visitTrail || null,
    schoolLadder: player.schoolLadder || null,
    ufStaff: player.ufStaff || null,
    ufStatus: player.ufStatus || null,
    ufRpmPct: rpm || player.ufRpmPct || null,
    // Store as 0–100 for board/FutureCast consumers; readers use toPercent either way.
    ufProbability: pct,
    futurecastProbability: pct,
    deskIntelSyncedAt: new Date().toISOString(),
    on3Source: player.hydrationSource || 'desk-intel-futurecast-feed',
    category: player.category || 'target',
    status: player.status || (player.committedTo ? 'committed' : 'uncommitted')
  };
}

function persistOn3SlugMap(slug, on3Slug) {
  const key = String(slug || '').toLowerCase();
  const value = String(on3Slug || '').toLowerCase();
  if (!key || !value || !/-\d+$/.test(value)) return false;
  try {
    const doc = JSON.parse(fs.readFileSync(ON3_SLUG_MAP_PATH, 'utf8'));
    doc.slugs = doc.slugs || {};
    if (doc.slugs[key] === value) return false;
    doc.slugs[key] = value;
    doc.updatedAt = new Date().toISOString();
    fs.writeFileSync(ON3_SLUG_MAP_PATH, JSON.stringify(doc, null, 2) + '\n');
    return true;
  } catch {
    return false;
  }
}

function persistOn3RpmEntry({ slug, name, classYear, ufPct, profileUrl, priorUfPct }) {
  const key = String(slug || '').toLowerCase();
  const pct = toPercent(ufPct);
  if (!key || pct <= 0) return false;
  try {
    let doc = { version: 1, entries: [] };
    try {
      doc = JSON.parse(fs.readFileSync(ON3_RPM_PATH, 'utf8'));
    } catch {
      /* create */
    }
    doc.entries = Array.isArray(doc.entries) ? doc.entries : [];
    const idx = doc.entries.findIndex((e) => String(e.playerSlug || '').toLowerCase() === key);
    const row = {
      playerSlug: key,
      playerName: name || key,
      classYear: Number(classYear) || null,
      ufPct: pct,
      priorUfPct: priorUfPct != null ? toPercent(priorUfPct) : pct,
      profileUrl: profileUrl || null,
      source: 'On3 RPM · desk intel feed',
      syncedAt: new Date().toISOString()
    };
    if (idx >= 0) doc.entries[idx] = { ...doc.entries[idx], ...row };
    else doc.entries.push(row);
    doc.updatedAt = new Date().toISOString();
    fs.mkdirSync(path.dirname(ON3_RPM_PATH), { recursive: true });
    fs.writeFileSync(ON3_RPM_PATH, JSON.stringify(doc, null, 2));
    return true;
  } catch {
    return false;
  }
}

async function persistOfferVisitLogs(slug, player, profile) {
  try {
    const { persistOn3OfferVisitLogs, profilePatchFromOn3 } = require('./allowlist-target-sync');
    const year = Number(player.classYear) || 2028;
    const patch =
      profile && !profile.error
        ? profilePatchFromOn3(profile, year)
        : {
            on3Id: player.on3Id || null,
            name: player.name,
            offers: floridaOfferedOnPlayer(player)
              ? [{ school: 'Florida', offerType: 'offer', date: null }]
              : [],
            visits: []
          };
    // Prefer full profile patch when available.
    if (player.on3TopTeams?.length && (!profile || profile.error)) {
      patch.offers = patch.offers || [];
    }
    return persistOn3OfferVisitLogs(slug, player.name, patch, profile || { fetchedAt: new Date().toISOString() });
  } catch {
    return { offers: 0, visits: 0 };
  }
}

/**
 * Main entry: feed hydrated desk intel into FutureCast surfaces.
 */
function currentRosterCollision(slug) {
  try {
    const rosterStore = require('./roster-store');
    return rosterStore.getRosterPlayerBySlug(String(slug || '').toLowerCase()) || null;
  } catch {
    return null;
  }
}

async function feedDeskIntelToFutureCast({
  slug,
  player = null,
  profile = null,
  research = null,
  signalType = null,
  dryRun = false,
  forceHydrate = false
} = {}) {
  const steps = [];
  const key = canonicalTargetSlug(slug || player?.slug || '');
  if (!key) return { ok: false, error: 'missing_slug', steps };

  // Never soft-create HS/FC targets from UF coaching staff (brandon-harris =
  // CB coach, not a 2028 Bolles S). Desk topic filters alone are not enough.
  try {
    const staff = require('./recruiting-staff-directory');
    const probeName = player?.name || research?.playerName || key.replace(/-/g, ' ');
    if (staff.isStaffPlayerSlug(key) || staff.isStaffOrCoachName(probeName)) {
      steps.push({ step: 'staff_collision_block', ok: true, blocked: true });
      return {
        ok: false,
        error: 'staff_not_recruit',
        slug: key,
        name: probeName,
        steps,
        allowlisted: false
      };
    }
  } catch {
    /* optional */
  }

  // Never soft-create under the wrong first-name slug (jamarcus-johnson ≠ Kamarion).
  try {
    const { hasSlugNameFirstMismatch, explainSlugNameMismatch } = require('./recruit-identity-collision');
    const probe = {
      slug: key,
      name: player?.name || research?.playerName || profile?.name || null
    };
    if (probe.name && hasSlugNameFirstMismatch(probe)) {
      steps.push({
        step: 'identity_collision_block',
        ok: true,
        blocked: true,
        ...explainSlugNameMismatch(probe)
      });
      return {
        ok: false,
        error: 'slug_name_identity_mismatch',
        slug: key,
        name: probe.name,
        steps,
        allowlisted: false
      };
    }
  } catch {
    /* optional */
  }

  // Never soft-create HS/FC targets from current UF roster names (weight-room /
  // depth-chart chatter). Bryce Lovett = R-Jr OL, not a 2028 ATH commit.
  const rosterHit = currentRosterCollision(key);
  if (rosterHit) {
    steps.push({
      step: 'roster_collision_block',
      ok: true,
      blocked: true,
      rosterPos: rosterHit.pos || rosterHit.position || null,
      rosterYear: rosterHit.year || rosterHit.class || null
    });
    return {
      ok: false,
      error: 'current_roster_player',
      slug: key,
      name: rosterHit.name || key,
      steps,
      allowlisted: false
    };
  }

  let board = player;
  let usedProfile = profile;

  if (forceHydrate || !board || !(board.on3TopTeams || board.topTeams)?.length || board.natlRank == null) {
    try {
      const hydrate = require('./on3-board-hydrate');
      const hydrated = await hydrate.hydrateRecruitBoard({
        slug: key,
        name: board?.name || research?.playerName || key,
        player: board,
        classYear: board?.classYear || research?.player?.classYear || 2028,
        pos: board?.pos || board?.position || null,
        force: !!forceHydrate
      });
      if (hydrated?.player) {
        board = hydrated.player;
        usedProfile = hydrated.profile || usedProfile;
        steps.push({
          step: 'hydrate',
          ok: true,
          source: hydrated.source,
          recruitSlug: hydrated.recruitSlug
        });
      } else {
        steps.push({ step: 'hydrate', ok: false, reason: 'no_profile' });
      }
    } catch (err) {
      steps.push({
        step: 'hydrate',
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  if (!board?.name && !board?.on3Slug) {
    return { ok: false, error: 'thin_board', slug: key, steps };
  }

  const classYear = Number(board.classYear || board.year || 2028);
  const existing = await store.getPlayerBySlug(key).catch(() => null);
  const isNew = !existing;
  const allowlisted = isAllowlistedTarget({ slug: key, classYear }, classYear);
  const rivalsLocked = loadRivalsOnlyUfPctBySlug().has(key);
  const offered = floridaOfferedOnPlayer(board);
  const signal = signalType || research?.eventType || research?.ufPosition || null;

  const decision = decideTargetingPct({
    priorPct: existing?.ufProbability ?? existing?.ufRpmPct ?? existing?.futurecastProbability,
    on3RpmPct: board.ufRpmPct ?? board.ufProbability,
    signalType: signal,
    floridaOffered: offered,
    isNew: isNew || !allowlisted,
    rivalsLocked
  });

  const patch = buildStorePatchFromHydrated(board, key, decision.pct);
  if (offered) {
    patch.ufOffer = true;
    patch.hasUFOffer = true;
  }

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      slug: key,
      isNew,
      allowlisted,
      promote: shouldPromoteToFutureCast(board, classYear),
      decision,
      patchPreview: {
        name: patch.name,
        classYear: patch.classYear,
        natlRank: patch.natlRank,
        ufRpmPct: patch.ufRpmPct,
        ufProbability: patch.ufProbability,
        htWt: patch.htWt
      },
      steps
    };
  }

  let saved = null;
  try {
    saved = await store.upsertPlayer({ ...(existing || {}), ...patch, slug: key });
    steps.push({ step: 'recruiting_store_upsert', ok: true, slug: key, isNew });
  } catch (err) {
    // Retry once with stripped school if identity validator rejected hometown-shaped school.
    try {
      const retry = {
        ...(existing || {}),
        ...patch,
        slug: key,
        school: sanitizeHighSchoolLabel(patch.school) || existing?.school || null
      };
      saved = await store.upsertPlayer(retry);
      steps.push({
        step: 'recruiting_store_upsert',
        ok: true,
        slug: key,
        isNew,
        retried: true,
        firstError: err instanceof Error ? err.message : String(err)
      });
    } catch (err2) {
      steps.push({
        step: 'recruiting_store_upsert',
        ok: false,
        error: err2 instanceof Error ? err2.message : String(err2)
      });
      return { ok: false, error: 'store_upsert_failed', slug: key, steps };
    }
  }

  if (board.on3Slug) {
    const mapped = persistOn3SlugMap(key, board.on3Slug);
    steps.push({ step: 'on3_slug_map', ok: true, wrote: mapped, on3Slug: board.on3Slug });
  }

  const rpmWrote = persistOn3RpmEntry({
    slug: key,
    name: board.name,
    classYear,
    ufPct: board.ufRpmPct ?? decision.pct,
    profileUrl: board.on3ProfileUrl,
    priorUfPct: existing?.ufRpmPct ?? existing?.ufProbability
  });
  steps.push({ step: 'on3_rpm_file', ok: rpmWrote });

  const logs = await persistOfferVisitLogs(key, board, usedProfile);
  steps.push({ step: 'offer_visit_logs', ...logs });

  // Early watch for underclassmen (including brand-new desk players).
  if (classYear >= 2028 && classYear <= 2030) {
    try {
      const { upsertEarlyWatchEntry } = require('./player-intel-entry');
      const watch = upsertEarlyWatchEntry({
        slug: key,
        name: saved.name,
        classYear,
        pos: saved.pos,
        school: saved.school,
        stars: saved.stars,
        rating: saved.rating,
        tier: allowlisted || shouldPromoteToFutureCast(board, classYear) ? 'target' : 'monitor'
      });
      steps.push({ step: 'early_watchlist', ok: true, slug: watch?.slug || key, tier: watch?.tier });
    } catch (err) {
      steps.push({
        step: 'early_watchlist',
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  let promoted = false;
  const promote = !allowlisted && shouldPromoteToFutureCast(board, classYear);
  if (promote) {
    try {
      const { addToAdminAllowlist } = require('./admin-allowlist-store');
      const allow = addToAdminAllowlist({
        slug: key,
        name: saved.name,
        classYear
      });
      steps.push({ step: 'admin_allowlist', ...allow, promoted: true });
      promoted = true;
    } catch (err) {
      steps.push({
        step: 'admin_allowlist',
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  } else {
    steps.push({
      step: 'admin_allowlist',
      skipped: true,
      reason: allowlisted ? 'already_allowlisted' : 'promote_gate_not_met'
    });
  }

  const onAllowlistNow =
    allowlisted || promoted || isAllowlistedTarget({ slug: key, classYear }, classYear);

  if (onAllowlistNow && classYear === 2028) {
    try {
      const { upsertEarlyWatchEntry } = require('./player-intel-entry');
      // Reuse 2028 board seed helper via enter path's local fn — call through require cycle-safe copy
      const entryMod = require('./player-intel-entry');
      // upsert2028TargetBoardSeed is not exported — duplicate minimal seed update here
      const boardPath = path.join(__dirname, '..', 'data', 'recruiting', '2028-target-board.json');
      let doc;
      try {
        doc = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
      } catch {
        doc = { version: 1, description: 'UF 2028 target board seed', targets: [] };
      }
      doc.targets = doc.targets || [];
      const row = {
        slug: key,
        name: saved.name,
        pos: saved.pos || 'ATH',
        school: saved.school || '',
        state: saved.state || '',
        stars: saved.stars || null,
        rating: saved.rating || null,
        natlRank: saved.natlRank || null,
        posRank: saved.posRank || null,
        stateRank: saved.stateRank || null,
        inState: String(saved.state || '').toUpperCase() === 'FL',
        committedTo: saved.committedTo || null,
        ufProbability: decision.pct != null ? decision.pct : null, // 0–100 points
        source: 'desk-intel-futurecast-feed',
        updatedAt: new Date().toISOString()
      };
      const idx = doc.targets.findIndex((t) => String(t.slug || '').toLowerCase() === key);
      if (idx >= 0) doc.targets[idx] = { ...doc.targets[idx], ...row };
      else doc.targets.push(row);
      doc.updatedAt = new Date().toISOString();
      fs.writeFileSync(boardPath, JSON.stringify(doc, null, 2));
      steps.push({ step: '2028_target_board_seed', ok: true, slug: key });
      // silence unused
      void entryMod;
    } catch (err) {
      steps.push({
        step: '2028_target_board_seed',
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      });
    }

    try {
      const { provisionAllowlistPredictionForSlug } = require('./allowlist-futurecast-provision');
      const fc = await provisionAllowlistPredictionForSlug(key, 2028);
      steps.push({ step: 'futurecast_prediction_seed', ...fc });
    } catch (err) {
      steps.push({
        step: 'futurecast_prediction_seed',
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  } else if (allowlisted && decision.nudged && !rivalsLocked) {
    // Existing allowlist: still try FC refresh when % moved (non-2028 skip board seed).
    try {
      const { provisionAllowlistPredictionForSlug } = require('./allowlist-futurecast-provision');
      const fc = await provisionAllowlistPredictionForSlug(key, classYear);
      steps.push({ step: 'futurecast_prediction_refresh', ...fc });
    } catch (err) {
      steps.push({
        step: 'futurecast_prediction_refresh',
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  return {
    ok: true,
    slug: key,
    name: saved?.name || board.name,
    classYear,
    isNew,
    allowlisted: onAllowlistNow,
    promoted,
    decision,
    player: {
      natlRank: saved?.natlRank ?? board.natlRank,
      posRank: saved?.posRank ?? board.posRank,
      stateRank: saved?.stateRank ?? board.stateRank,
      htWt: saved?.htWt ?? board.htWt,
      ufRpmPct: saved?.ufRpmPct ?? board.ufRpmPct,
      ufProbability: saved?.ufProbability ?? decision.pct,
      ufStatus: saved?.ufStatus ?? board.ufStatus
    },
    steps
  };
}

module.exports = {
  feedDeskIntelToFutureCast,
  decideTargetingPct,
  shouldPromoteToFutureCast,
  floridaOfferedOnPlayer,
  floridaVisitOnPlayer,
  buildStorePatchFromHydrated,
  sanitizeHighSchoolLabel,
  persistOn3RpmEntry,
  persistOn3SlugMap
};
