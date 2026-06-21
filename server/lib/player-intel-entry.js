/**
 * Player Intel Entry — name + class year + offer → full profile, board placement, snapshots.
 */
const fs = require('fs');
const path = require('path');
const store = require('./recruiting-store');
const on3Recruit = require('./on3-recruit-client');
const identityLookup = require('./player-identity-lookup');
const { rebuildPlayerIdentityFromOn3, healPlayerRecord } = require('./identity-record-validator');
const { addToAdminAllowlist } = require('./admin-allowlist-store');
const { isFloridaSchool } = require('./recruiting-target-filters');
const { enrichRecruitingPlayer } = require('./profile-enrichment/uf-premium-enrich');
const { getBreakdownBySlug, upsertBreakdown } = require('./war-room-store');
const { rebuildRecruitingSnapshots } = require('./recruiting-snapshot-rebuild');
const { buildOn3ProfileUrl } = require('./on3-urls');

const EARLY_WATCHLIST_PATH = path.join(__dirname, '..', 'data', 'futurecast', 'early-watchlist.json');
const TARGET_BOARD_2028_PATH = path.join(__dirname, '..', 'data', 'recruiting', '2028-target-board.json');

function parseOfferFlag(offer) {
  if (offer === true || offer === 1) return true;
  const v = String(offer || '').trim().toLowerCase();
  return v === 'uf' || v === 'florida' || v === 'gators' || v === 'yes' || v === 'true';
}

function formatHtWt(heightIn, weightLb) {
  const h = Number(heightIn);
  const w = Number(weightLb);
  if (!Number.isFinite(h) || !Number.isFinite(w) || h < 48) return null;
  const feet = Math.floor(h / 12);
  const inches = Math.round(h % 12);
  return `${feet}-${inches} / ${w}`;
}

function parseOn3Extended(pp, classYear) {
  if (!pp?.player) return {};
  const player = pp.player;
  const recruitment =
    (pp.recruitments || []).find((r) => Number(r.year) === Number(classYear)) ||
    (pp.recruitments || []).find((r) => r.year === 2027 || r.year === 2028) ||
    (pp.recruitments || [])[0];
  const rating = pp.rankingsPlayer || recruitment?.rating || {};
  const heightIn = player.height || recruitment?.height || player.measurables?.height;
  const weightLb = player.weight || recruitment?.weight || player.measurables?.weight;
  const htWt = formatHtWt(heightIn, weightLb);
  const uf = on3Recruit.getFloridaTeam(pp.topTeams?.list || pp.topTeams || [], classYear);
  const commit = on3Recruit.getCollegeCommit(pp.topTeams?.list || pp.topTeams || [], classYear);
  const committedTo = commit
    ? (commit.team?.fullName || commit.team?.name || commit.team?.abbreviation || null)
    : null;

  return {
    htWt,
    height: htWt ? htWt.split('/')[0].trim() : null,
    weight: weightLb || null,
    pos:
      player.positionAbbr ||
      recruitment?.positionAbbreviation ||
      player.position?.abbr ||
      null,
    stars: rating.stars ?? rating.consensusStars ?? null,
    posRank: rating.positionRank ?? rating.consensusPositionRank ?? null,
    stateRank: rating.stateRank ?? rating.consensusStateRank ?? null,
    rating: rating.consensusRating ?? rating.rating ?? rating.consensusRatingValue ?? null,
    state: player.homeTown?.stateAbbr || player.hometown?.stateAbbr || null,
    twitterHandle: player.twitterHandle || player.twitter || null,
    instagramProfile: player.instagramProfile || player.instagram || null,
    hudlUrl: player.hudlProfile || player.hudlUrl || pp.hudlUrl || null,
    on3ProfileUrl: player.slug ? `https://www.on3.com/rivals/${String(player.slug).replace(/^\//, '')}/` : null,
    on3Slug: player.slug || null,
    on3Id: player.key || player.id || null,
    ufProbability: uf?.prediction != null ? Math.round(Number(uf.prediction)) : null,
    committedTo: commit && on3Recruit.isFloridaTeam(commit) ? 'Florida' : committedTo,
    status: committedTo ? 'committed' : 'uncommitted',
    category: commit && on3Recruit.isFloridaTeam(commit) ? 'recruit' : 'target',
    commitDate: commit?.committedDate || null,
  };
}

async function fetchOn3PageProps(recruitSlug, classYear) {
  if (!recruitSlug) return null;
  try {
    const url = `${on3Recruit.SITE}/rivals/${String(recruitSlug).replace(/^\//, '')}/`;
    return await on3Recruit.fetchNextPageProps(url, classYear);
  } catch {
    return null;
  }
}

async function resolveRecruitIdentity(name, classYear) {
  const trimmed = String(name || '').trim();
  const year = parseInt(classYear, 10);
  if (!trimmed) throw new Error('Player name is required');
  if (!Number.isFinite(year) || year < 2026 || year > 2032) throw new Error('Valid class year required');

  const baseSlug = store.slugify(trimmed);
  const existing = await identityLookup.findStorePlayer({ playerName: trimmed, playerSlug: baseSlug });
  const sources = await identityLookup.collectIdentitySources({
    playerName: trimmed,
    playerSlug: existing?.slug || baseSlug,
    classYear: year,
    player: existing,
  });
  const confirmation = identityLookup.confirmIdentity(sources);
  const merged = identityLookup.mergeMissingFields(
    {
      playerName: trimmed,
      playerSlug: existing?.slug || baseSlug,
      classYear: year,
      on3Id: existing?.on3Id,
    },
    confirmation.matchedSources
  );

  const recruitSlug = identityLookup.resolveRecruitSlug({
    playerSlug: merged.playerSlug || existing?.on3Slug || baseSlug,
    on3Id: merged.on3Id || existing?.on3Id,
    playerName: trimmed,
  });

  let pageProps = null;
  let extended = {};
  if (recruitSlug) {
    pageProps = await fetchOn3PageProps(recruitSlug, year);
    if (pageProps) extended = parseOn3Extended(pageProps, year);
  }

  const slug = canonicalEntrySlug({
    merged,
    existing,
    extended,
    baseSlug,
  });

  return {
    slug,
    name: merged.playerName || trimmed,
    classYear: year,
    identity: merged,
    confirmation,
    sources: (confirmation.matchedSources || []).map((s) => ({
      provider: s.provider,
      label: s.label,
      confidence: s.confidence,
    })),
    on3: extended,
    recruitSlug,
  };
}

function canonicalEntrySlug({ merged, existing, extended, baseSlug }) {
  if (existing?.slug) return existing.slug;
  if (merged.playerSlug && /\-\d+$/.test(merged.playerSlug)) return merged.playerSlug;
  if (extended.on3Slug && extended.on3Id) return `${store.slugify(merged.playerName || baseSlug)}-${extended.on3Id}`;
  if (extended.on3Slug) return String(extended.on3Slug).replace(/^\//, '');
  return baseSlug;
}

function applyUfOffer(player, hasOffer) {
  if (!hasOffer) return player;
  const today = new Date().toISOString().slice(0, 10);
  const offers = mergeOfferList(player.offers || player.offerList, {
    school: 'Florida',
    date: today,
    type: 'offer',
  });
  return {
    ...player,
    offers,
    offerList: offers,
    ufOvStatus: player.ufOvStatus || 'OFFERED',
    skinny: player.skinny || `${player.name} holds a Florida offer.`,
  };
}

function mergeOfferList(existing, next) {
  const list = Array.isArray(existing) ? [...existing] : [];
  const key = String(next.school || '').toLowerCase();
  if (!list.some((o) => String(o.school || o.name || '').toLowerCase() === key)) {
    list.push(next);
  }
  return list;
}

function placementForClassYear(classYear) {
  const year = parseInt(classYear, 10);
  if (year === 2027 || year === 2028) {
    return { section: 'master-board', allowlist: true, earlyWatch: year === 2028 };
  }
  if (year >= 2028 && year <= 2030) {
    return { section: 'underclassmen-watchboard', allowlist: year === 2028, earlyWatch: true };
  }
  return { section: 'recruiting-store', allowlist: false, earlyWatch: false };
}

function upsertEarlyWatchEntry({ slug, name, classYear, pos, school, stars, rating, tier }) {
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(EARLY_WATCHLIST_PATH, 'utf8'));
  } catch {
    doc = { version: 1, entries: [] };
  }
  doc.entries = doc.entries || [];
  const key = String(slug).toLowerCase();
  const next = {
    slug: key,
    name,
    classYear: Number(classYear),
    tier: tier || 'target',
    pos: pos || 'ATH',
    school: school || '',
    state: null,
    stars: stars || null,
    rating: rating || null,
    ufProbability: null,
    fitScore: null,
  };
  const idx = doc.entries.findIndex((e) => String(e.slug || '').toLowerCase() === key);
  if (idx >= 0) doc.entries[idx] = { ...doc.entries[idx], ...next };
  else doc.entries.push(next);
  doc.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(EARLY_WATCHLIST_PATH), { recursive: true });
  fs.writeFileSync(EARLY_WATCHLIST_PATH, `${JSON.stringify(doc, null, 2)}\n`);
  return next;
}

function upsert2028TargetBoardSeed(player) {
  if (Number(player.classYear) !== 2028) return null;
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(TARGET_BOARD_2028_PATH, 'utf8'));
  } catch {
    doc = { version: 1, description: 'UF 2028 target board seed', targets: [] };
  }
  doc.targets = doc.targets || [];
  const key = String(player.slug).toLowerCase();
  const row = {
    slug: key,
    name: player.name,
    pos: player.pos || 'ATH',
    school: player.school || 'Florida HS pipeline',
    state: player.state || 'FL',
    stars: player.stars || null,
    rating: player.rating || null,
    natlRank: player.natlRank || null,
    posRank: player.posRank || null,
    stateRank: player.stateRank || null,
    inState: String(player.state || '').toUpperCase() === 'FL',
    committedTo: player.committedTo || null,
    ufProbability: player.ufProbability != null ? Number(player.ufProbability) / 100 : null,
  };
  const idx = doc.targets.findIndex((t) => String(t.slug || '').toLowerCase() === key);
  if (idx >= 0) doc.targets[idx] = { ...doc.targets[idx], ...row };
  else doc.targets.push(row);
  fs.writeFileSync(TARGET_BOARD_2028_PATH, `${JSON.stringify(doc, null, 2)}\n`);
  return row;
}

function buildPlayerPatch(resolved, hasOffer, existing) {
  const { slug, name, classYear, identity, on3 } = resolved;
  let patch = {
    slug,
    name,
    classYear,
    pos: on3.pos || identity.pos || 'ATH',
    school: identity.highSchool || identity.hometownState || on3.school || null,
    fromSchool: identity.highSchool || null,
    hometownState: identity.hometownState || null,
    state: on3.state || null,
    stars: identity.stars || on3.stars || null,
    natlRank: identity.natlRank || on3.natlRank || null,
    posRank: on3.posRank || null,
    stateRank: on3.stateRank || null,
    rating: on3.rating || null,
    htWt: on3.htWt || null,
    height: on3.height || null,
    weight: on3.weight || null,
    on3Id: on3.on3Id || identity.on3Id || null,
    on3Slug: on3.on3Slug || identity.playerSlug || null,
    on3ProfileUrl: on3.on3ProfileUrl || buildOn3ProfileUrl({ slug, on3Slug: on3.on3Slug, on3Id: on3.on3Id }),
    twitterHandle: on3.twitterHandle || null,
    instagramProfile: on3.instagramProfile || null,
    hudlUrl: on3.hudlUrl || null,
    ufProbability: on3.ufProbability ?? identity.ufRpmPct ?? null,
    committedTo: on3.committedTo || null,
    status: on3.status || 'uncommitted',
    category: on3.category || 'target',
    commitDate: on3.commitDate || null,
    on3Source: 'player-intel-entry',
    updatedAt: new Date().toISOString(),
  };

  if (isFloridaSchool(patch.committedTo)) {
    patch.category = 'recruit';
    patch.status = 'committed';
  } else if (patch.committedTo) {
    patch.category = 'target';
    patch.status = 'committed';
  } else {
    patch.category = 'target';
    patch.status = 'uncommitted';
  }

  patch = applyUfOffer(patch, hasOffer);
  return healPlayerRecord(patch, existing);
}

async function enrichPlayerProfile(slug) {
  const player = await store.getPlayerBySlug(slug);
  if (!player) return null;
  const breakdown = getBreakdownBySlug(slug);
  const enriched = enrichRecruitingPlayer(player, breakdown, new Map());
  return store.upsertPlayer(enriched);
}

async function ensureScoutingBreakdown(player) {
  const slug = player.slug;
  const existing = getBreakdownBySlug(slug);
  if (existing?.strengths?.length) return existing;
  const template = enrichRecruitingPlayer(player, null, new Map());
  return upsertBreakdown(slug, {
    strengths: template.strengths || [],
    weaknesses: template.weaknesses || [],
    schemeFit: template.schemeFit || null,
    projection: template.projection || null,
    comparison: template.playerComp || null,
    recruitingStory: player.skinny || null,
    verified: false,
    sources: [{ label: 'Player Intel Entry', type: 'manual' }],
  });
}

async function previewPlayerIntel(input) {
  const resolved = await resolveRecruitIdentity(input.name, input.classYear);
  const hasOffer = parseOfferFlag(input.offer);
  const existing = await store.getPlayerBySlug(resolved.slug);
  const patch = buildPlayerPatch(resolved, hasOffer, existing);
  const placement = placementForClassYear(input.classYear);
  return {
    ok: true,
    preview: true,
    slug: resolved.slug,
    name: resolved.name,
    classYear: resolved.classYear,
    hasUfOffer: hasOffer,
    placement,
    player: patch,
    identity: resolved.identity,
    sources: resolved.sources,
    on3ProfileUrl: patch.on3ProfileUrl,
  };
}

async function enterPlayerIntel(input) {
  const resolved = await resolveRecruitIdentity(input.name, input.classYear);
  const hasOffer = parseOfferFlag(input.offer);
  const placement = placementForClassYear(input.classYear);
  const steps = [];

  if (placement.allowlist) {
    const allow = addToAdminAllowlist({
      slug: resolved.slug,
      name: resolved.name,
      classYear: resolved.classYear,
    });
    steps.push({ step: 'allowlist', ...allow });
  }

  let patch = buildPlayerPatch(resolved, hasOffer, await store.getPlayerBySlug(resolved.slug));
  let saved = await store.upsertPlayer(patch);
  steps.push({ step: 'upsert', slug: saved.slug });

  try {
    const identity = await rebuildPlayerIdentityFromOn3(resolved.slug, { classYear: resolved.classYear });
    if (identity.ok && identity.player) {
      saved = await store.upsertPlayer({
        ...saved,
        ...identity.player,
        slug: resolved.slug,
        classYear: resolved.classYear,
      });
      steps.push({ step: 'on3_identity_rebuild', ok: true });
    } else {
      steps.push({ step: 'on3_identity_rebuild', ok: false, error: identity.error });
    }
  } catch (err) {
    steps.push({ step: 'on3_identity_rebuild', ok: false, error: err.message });
  }

  saved = await enrichPlayerProfile(resolved.slug);
  steps.push({ step: 'premium_enrich', slug: saved.slug });

  await ensureScoutingBreakdown(saved);
  steps.push({ step: 'war_room_breakdown', slug: saved.slug });

  if (placement.earlyWatch) {
    const watch = upsertEarlyWatchEntry({
      slug: saved.slug,
      name: saved.name,
      classYear: saved.classYear,
      pos: saved.pos,
      school: saved.school,
      stars: saved.stars,
      rating: saved.rating,
      tier: 'target',
    });
    steps.push({ step: 'early_watchlist', slug: watch.slug });
  }

  if (Number(saved.classYear) === 2028) {
    upsert2028TargetBoardSeed(saved);
    steps.push({ step: '2028_target_board_seed', slug: saved.slug });
  }

  let snapshots = null;
  if (input.rebuildSnapshots === true) {
    snapshots = await rebuildRecruitingSnapshots();
    steps.push({ step: 'snapshot_rebuild', elapsedMs: snapshots.elapsedMs });
  }

  return {
    ok: true,
    slug: saved.slug,
    name: saved.name,
    classYear: saved.classYear,
    placement,
    player: saved,
    steps,
    snapshots,
    profileUrl: `/vault/recruiting/player/${saved.slug}`,
  };
}

module.exports = {
  previewPlayerIntel,
  enterPlayerIntel,
  parseOfferFlag,
  placementForClassYear,
  resolveRecruitIdentity,
};
