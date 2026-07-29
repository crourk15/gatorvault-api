'use strict';

/**
 * Pull On3 / Hudl highlight URLs into film-traits for Beat Desk.
 * Traits stay Vault-curated (Charles Power–style evaluation); ingest only attaches tape.
 */

const filmStore = require('./film-traits-store');
const { extractOn3Videos, filmSourcesFromOn3Videos } = require('./on3-recruit-videos');

function mergeSources(existing = [], incoming = []) {
  const byUrl = new Map();
  for (const s of existing || []) {
    const url = String(s?.url || '').trim();
    if (url) byUrl.set(url, { ...s });
  }
  for (const s of incoming || []) {
    const url = String(s?.url || '').trim();
    if (!url) continue;
    const prev = byUrl.get(url) || {};
    byUrl.set(url, {
      ...prev,
      ...s,
      // Keep human review stamps if already set
      reviewedAt: prev.reviewedAt || s.reviewedAt || null,
      reviewedBy: prev.reviewedBy && prev.reviewedBy !== 'on3-ingest' ? prev.reviewedBy : s.reviewedBy,
      traitsLocked: prev.traitsLocked,
    });
  }
  return [...byUrl.values()];
}

function needsSourceHydration(entry) {
  if (!entry) return true;
  const sources = Array.isArray(entry.sources) ? entry.sources : [];
  return sources.length === 0;
}

async function resolveOn3RecruitSlug({ slug, playerName, player, classYear } = {}) {
  const hydrate = require('./on3-board-hydrate');
  const year = Number(classYear || player?.classYear || player?.year || 2028) || 2028;
  const seedName = playerName || player?.name || player?.fullName || hydrate.humanizeSlugName(slug);
  // Prefer explicit On3 slug on player
  const candidates = [
    player?.on3Slug,
    player?.on3RecruitSlug,
    player?.recruitSlug,
  ]
    .map((s) => String(s || '').trim())
    .filter(Boolean);

  if (candidates.length) return { recruitSlug: candidates[0], classYear: year, name: seedName };

  try {
    const found = await hydrate.hydrateRecruitBoard({
      slug,
      name: seedName,
      player,
      classYear: year,
      pos: player?.pos || player?.position || null,
      force: true,
    });
    if (found?.recruitSlug) {
      return { recruitSlug: found.recruitSlug, classYear: year, name: seedName };
    }
  } catch {
    /* fall through */
  }

  // Last resort: slug as-is (works when Beat Desk slug already matches On3)
  return { recruitSlug: slug, classYear: year, name: seedName };
}

/**
 * Fetch On3 profile videos and upsert sources into film-traits.
 * Never overwrites curated traits / vaultFilmAngle / doNotClaim.
 */
async function hydrateFilmTraitsFromOn3({
  slug,
  playerName,
  player = null,
  classYear = null,
  force = false,
  dryRun = false,
  evaluate = true,
} = {}) {
  const key = filmStore.normalizeSlug(slug);
  if (!key) {
    return { ok: false, error: 'missing_slug' };
  }

  // Load recruiting-store player so we prefer on3Slug with numeric id (videos live there).
  if (!player) {
    try {
      const store = require('./recruiting-store');
      player = (await store.getPlayerBySlug(key)) || null;
    } catch {
      player = null;
    }
  }
  if (!playerName) {
    playerName = player?.name || player?.fullName || null;
  }

  const existing = filmStore.getFilmTraitsBySlug(key);
  if (!force && existing && !needsSourceHydration(existing)) {
    return {
      ok: true,
      skipped: true,
      reason: 'sources_already_on_file',
      slug: key,
      filmTraits: existing,
      sourceCount: (existing.sources || []).length,
      traitCount: (existing.traits || []).length,
    };
  }

  const on3 = require('./on3-recruit-client');
  const resolved = await resolveOn3RecruitSlug({
    slug: key,
    playerName,
    player,
    classYear,
  });

  let profile;
  try {
    profile = await on3.fetchRecruitProfile(resolved.recruitSlug, resolved.classYear);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      slug: key,
      recruitSlug: resolved.recruitSlug,
    };
  }

  if (!profile || profile.error) {
    return {
      ok: false,
      error: profile?.error || 'on3_profile_unavailable',
      slug: key,
      recruitSlug: resolved.recruitSlug,
    };
  }

  // Prefer videos already mapped on profile; else extract from raw pageProps if present
  let videos = Array.isArray(profile.videos) ? profile.videos : [];
  if (!videos.length && profile.pageProps) {
    videos = extractOn3Videos(profile.pageProps);
  }

  // If fetchRecruitProfile doesn't yet attach videos, refetch pageProps once
  if (!videos.length) {
    try {
      const url = profile.on3ProfileUrl || `https://www.on3.com/rivals/${resolved.recruitSlug}/`;
      const pp = await on3.fetchNextPageProps(url, resolved.classYear);
      videos = extractOn3Videos(pp);
    } catch {
      videos = [];
    }
  }

  // Bare /rivals/{name}/ pages often lack videos — retry with id-suffixed On3 slug.
  if (!videos.length) {
    let altSlug = player?.on3Slug || player?.on3RecruitSlug || null;
    if (!altSlug && profile.on3ProfileUrl) {
      const m = String(profile.on3ProfileUrl).match(/rivals\/([^/]+)/i);
      altSlug = m ? m[1] : null;
    }
    if (altSlug) altSlug = String(altSlug).replace(/^\/+|\/+$/g, '');
    if (altSlug && altSlug !== resolved.recruitSlug) {
      try {
        const altProfile = await on3.fetchRecruitProfile(altSlug, resolved.classYear);
        if (altProfile && !altProfile.error) {
          profile = altProfile;
          resolved.recruitSlug = altSlug;
          videos = Array.isArray(altProfile.videos) ? altProfile.videos : [];
        }
      } catch {
        /* keep empty */
      }
    }
  }

  const incoming = filmSourcesFromOn3Videos(videos);
  if (!incoming.length) {
    // Still create a stub so desk knows we looked
    if (dryRun) {
      return {
        ok: true,
        dryRun: true,
        slug: key,
        recruitSlug: resolved.recruitSlug,
        sourceCount: 0,
        traitCount: (existing?.traits || []).length,
        note: 'no_videos_on_on3_profile',
      };
    }
    const stub = filmStore.upsertFilmTraits(key, {
      playerName: profile.name || playerName || existing?.playerName || key,
      position: profile.pos || player?.position || player?.pos || existing?.position || null,
      classYear: profile.classYear || resolved.classYear,
      sources: existing?.sources || [],
      traits: existing?.traits || [],
      vaultFilmAngle: existing?.vaultFilmAngle || '',
      doNotClaim: existing?.doNotClaim || [],
      clipNotes:
        existing?.clipNotes ||
        'On3 profile checked — no highlight video listed yet. Re-hydrate later.',
      ingestStatus: 'no_video',
      on3RecruitSlug: resolved.recruitSlug,
      on3ProfileUrl: profile.on3ProfileUrl || null,
      lastIngestAt: new Date().toISOString(),
    });
    return {
      ok: true,
      slug: key,
      recruitSlug: resolved.recruitSlug,
      sourceCount: 0,
      traitCount: (stub.traits || []).length,
      filmTraits: stub,
      note: 'no_videos_on_on3_profile',
    };
  }

  const mergedSources = mergeSources(existing?.sources || [], incoming);
  const payload = {
    playerName: profile.name || playerName || existing?.playerName || key,
    position: profile.pos || player?.position || player?.pos || existing?.position || null,
    classYear: profile.classYear || resolved.classYear,
    sources: mergedSources,
    traits: existing?.traits || [],
    vaultFilmAngle: existing?.vaultFilmAngle || '',
    doNotClaim: existing?.doNotClaim || [],
    clipNotes: (() => {
      const prev = String(existing?.clipNotes || '').trim();
      const stubNoVideo = /no highlight video listed/i.test(prev);
      if (existing?.traits?.length && prev && !stubNoVideo) return prev;
      if (prev && !stubNoVideo && !/pending/i.test(prev)) return prev;
      return 'Tape linked from On3/Hudl. Vault traits pending review — watch the reel, then upsert traits.';
    })(),
    ingestStatus: existing?.traits?.length ? 'traits_ready' : 'sources_ready',
    on3RecruitSlug: resolved.recruitSlug,
    on3ProfileUrl: profile.on3ProfileUrl || null,
    lastIngestAt: new Date().toISOString(),
  };

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      slug: key,
      recruitSlug: resolved.recruitSlug,
      sourceCount: mergedSources.length,
      traitCount: (payload.traits || []).length,
      sources: mergedSources,
    };
  }

  let saved = filmStore.upsertFilmTraits(key, payload);
  let evalResult = null;
  if (evaluate && !dryRun && (!(saved.traits && saved.traits.length) || force)) {
    try {
      const ai = require('./film-traits-ai-eval');
      evalResult = await ai.evaluateFilmTraitsForSlug(key, { force: true, player });
      if (evalResult?.ok && evalResult.filmTraits) saved = evalResult.filmTraits;
    } catch (err) {
      evalResult = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
  return {
    ok: true,
    slug: key,
    recruitSlug: resolved.recruitSlug,
    sourceCount: (saved.sources || []).length,
    traitCount: (saved.traits || []).length,
    filmTraits: saved,
    isNew: !existing,
    traitsPending: !(saved.traits && saved.traits.length),
    eval: evalResult,
  };
}

async function hydrateFilmTraitsBatch(items = [], { concurrency = 2, force = false } = {}) {
  const list = Array.isArray(items) ? items : [];
  const results = [];
  let i = 0;

  async function worker() {
    while (i < list.length) {
      const idx = i++;
      const item = list[idx] || {};
      try {
        const out = await hydrateFilmTraitsFromOn3({
          slug: item.slug || item.playerSlug,
          playerName: item.playerName || item.name,
          player: item.player || null,
          classYear: item.classYear,
          force,
        });
        results[idx] = out;
      } catch (err) {
        results[idx] = {
          ok: false,
          slug: item.slug || item.playerSlug,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }

  const n = Math.max(1, Math.min(concurrency, 4));
  await Promise.all(Array.from({ length: n }, () => worker()));
  const ok = results.filter((r) => r && r.ok).length;
  const failed = results.filter((r) => r && !r.ok).length;
  const withVideo = results.filter((r) => r && r.ok && (r.sourceCount || 0) > 0).length;
  return { ok: true, total: list.length, hydrated: ok, failed, withVideo, results };
}

module.exports = {
  mergeSources,
  needsSourceHydration,
  resolveOn3RecruitSlug,
  hydrateFilmTraitsFromOn3,
  hydrateFilmTraitsBatch,
};
