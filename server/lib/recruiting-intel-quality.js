/**
 * Recruiting intel quality gates — hub card filtering + On3 entry verification.
 */

'use strict';

const { isPlaceholderSchool, isPlaceholderSkinny } = require('./recruiting-placeholder-school');

function hasRealSchool(school) {
  return Boolean(school) && !isPlaceholderSchool(school);
}

function hasMeaningfulOn3Fields(on3, identity) {
  if (!on3 || !on3.on3Id) return false;
  const hasRating =
    Number(on3.stars) > 0 ||
    (on3.rating != null && Number.isFinite(Number(on3.rating)) && Number(on3.rating) > 0);
  const hasMeasure = Boolean(on3.htWt || on3.pos);
  const hasSchool =
    hasRealSchool(on3.school) ||
    hasRealSchool(identity?.highSchool) ||
    hasRealSchool(identity?.school);
  return hasRating || hasMeasure || hasSchool;
}

function assessOn3Intel(resolved) {
  const on3 = resolved?.on3 || {};
  const identity = resolved?.identity || {};
  const recruitSlug = resolved?.recruitSlug || null;

  if (!recruitSlug) {
    return {
      ok: false,
      on3Verified: false,
      reason: 'no_on3_slug',
      message: 'On3 profile not found. Real On3 intel is required before saving.',
    };
  }

  if (!on3.on3Id) {
    return {
      ok: false,
      on3Verified: false,
      reason: 'no_on3_id',
      message: 'On3 player ID missing. Cannot enter intel without a verified On3 profile match.',
    };
  }

  if (!hasMeaningfulOn3Fields(on3, identity)) {
    return {
      ok: false,
      on3Verified: false,
      reason: 'thin_on3_profile',
      message:
        'On3 profile lacks verifiable ratings, measurables, or school data. Refresh On3 match or enter via beat-writer ingest.',
    };
  }

  return {
    ok: true,
    on3Verified: true,
    reason: 'verified',
    message: 'On3 profile verified.',
    on3ProfileUrl: on3.on3ProfileUrl || null,
    on3Id: on3.on3Id,
    recruitSlug,
  };
}

const JUNK_INTEL_PATTERNS = [
  /^s?\s*Florida Gators Hard Commit/i,
  /Hard Commit\s*-\s*\d/i,
  /Pos\s+[A-Z0-9]{1,4}\s+Height\s+\d/i,
  /entered official visit season with most of their 2027 class already in place/i,
  /Miami is still working to wrap up an elite recruiting class/i,
  /The Florida Gators continue to receive national recognition for what has been an impressive 2027 recruiting cycle/i,
  /The Florida Gators already have a 5-star cornerstone/i,
  /getting off to a strong start in 2028/i,
  /Rivals Industry/i,
  /One of the nation[''\u2019]s most versatile prospects/i,
  /The Longhorns are one of the hottest teams/i,
  /Some assistants added to already strong position groups/i,
  /^With Rivals,\s*Florida/i,
  /official visit week for the Florida Gators/i,
  /returned to Gainesville this weekend/i,
  /came out of official visit season/i,
  /still have room to climb in/i,
  /Beginning Thursday,\s*Florida will host/i,
  /Several of the Gators[''] commitments/i,
  /^On (Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),/i,
  /The Florida Gators have their (first )?commitment for the \d{4} cycle/i,
  /\b(has committed|commits|committed on (Sunday|Saturday|Monday|Tuesday|Wednesday|Thursday|Friday))\b/i,
  /\bflipped (his|her|their)? commitment to (the )?(Florida|Gators|\bUF\b)\b/i,
  /\b\d-star (wide )?receiver\b.*\bcommitted\b/i,
  /Ole Miss is stacking talent/i,
  /The Longhorns are one of the hottest teams on the recruiting trail/i,
  /The Rebels' newest addition is/i,
  /Texas bolstered its top-\d+ recruiting class/i,
];

const SCOUTING_TRAIT_KEYWORDS =
  /\b(speed|burst|frame|hands|length|power|athletic|technique|rush|coverage|blocking|route|vision|IQ|instincts|explosive|agile|size|strength|tackle|pass|run|block|catch|throw|arm|accuracy|mobility|footwork|pad level|leverage|motor|effort|competitive|physical|wins|creates|disrupts|quick|fast|strong|violent|flexible|aware|smart|instinctive|productive|consistent|elite|plus|prototypical|scheme|versatile|instinct|balance|coordination|acceleration|change of direction|COD|wins with|plays through|high point|ball skills|pass rush|run stop|run fit|block shed|get off|first step|hip fluidity|body control|toughness|intangibles|leadership|work ethic|coachable|upside|projectable|finishes|disengage|closing speed|coordination|physicality)\b/i;

const SCOUTING_TRAIT_REJECT = [
  /official visit/i,
  /returned to Gainesville/i,
  /^Some assistants\b/i,
  /^With Rivals/i,
  /^It['']s another important/i,
  /^Beginning Thursday/i,
  /^Several of the Gators/i,
  /still have room to climb/i,
  /came out of official visit/i,
  /^Florida (Gators )?(tight end )?commit/i,
  /this weekend for his/i,
  /over the next three/i,
  /clearer picture of where it stands/i,
  /^In some of those battles/i,
  /^\S+\s*\([A-Za-z.]+\)\s+\S+\s+(safety|quarterback|cornerback|linebacker|receiver|running back|tight end|offensive|defensive)\s*$/i,
  /^On (Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),/i,
  /\b(has committed|commits|committed on)\b/i,
  /first commitment for the \d{4} cycle/i,
  /\b\d-star (wide )?receiver\b/i,
];

function intelReferencesPlayer(text, playerName) {
  const s = String(text || '').trim();
  if (!s) return false;
  const last = playerLastName(playerName);
  if (!last || last.length < 3) return true;
  return new RegExp(`\\b${last.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(s);
}

function playerLastName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    // Strip generational suffixes so "Anthony Howard Jr." → Howard (not Jr.).
    .filter((p) => !/^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(p));
  return parts.length ? parts[parts.length - 1] : '';
}

/** Chase / process copy — not player scouting. Never use as commit skinny. */
const CHASE_PROCESS_PATTERNS = [
  /shown interest in Florida/i,
  /scheduled for an official visit/i,
  /expected on campus again/i,
  /evaluate (him|her|them) as a (priority|secondary)\b/i,
  /remains on Florida['']s (priority|secondary)\b/i,
  /Florida['']s (priority|secondary) .{0,12} board/i,
  /GV Scout Update/i,
  /Getting to Know:/i,
  /COMMIT YouTube/i,
  /\bYouTube:\s*$/i,
  /Goes \d-for-\d at\b/i,
  /DETAILS:\s*\(On3\+?\)/i,
  /projects as a secondary .{1,20} addition for the Gators/i,
  /caught up with .{0,40}commit to learn more about/i,
  /spoke with .{0,40}commit to learn more about/i,
  /recruiting (journey|process|process,)/i,
  /how he fell in love with/i,
  /finding his love/i,
  /is scheduled for an? (official|unofficial) visit/i,
  /visit this week/i,
  /continue[sd]? to evaluate (him|her|them)/i,
  /^Committed to Florida on \d{4}-\d{2}-\d{2}/i,
  /\bcommitted to Florida on (January|February|March|April|May|June|July|August|September|October|November|December)\b/i,
  /projects as a (priority|secondary) .{1,28} addition for the Gators/i,
  /Fantasy Football|Dynasty TE|premium top \d+/i,
  /\d+ days ago\b/i,
  /By [A-Z][a-z]+ [A-Z][a-z]+\s+\d+ days ago/i,
];

/**
 * Recruiting-process / chase / article-scrape text — not "who is this player" skinny.
 * Safe to call without a player name.
 */
function isChaseProcessIntel(text) {
  const s = String(text || '').trim();
  if (!s) return true;
  if (CHASE_PROCESS_PATTERNS.some((re) => re.test(s))) return true;
  // Visit-template + scout-update mashups (common on commit cards).
  if (/official visit/i.test(s) && /target\./i.test(s)) return true;
  if (/Scout Update/i.test(s) && /Evaluation from/i.test(s)) return true;
  return false;
}

/**
 * Film-desk provenance / upsert meta — not fan-facing commit-card brief copy.
 * Belongs in staff notes, not the untitled skinny on EliteCommitCard.
 */
function isFilmDeskMeta(text) {
  const s = String(text || '').trim();
  if (!s) return true;
  if (/^vault film desk\b/i.test(s)) return true;
  if (/\bvia on3\s*(->|->|—|-)?\s*hudl\b/i.test(s)) return true;
  if (/\bfilm desk verified\b/i.test(s)) return true;
  if (/\btape traits below drive fit evidence\b/i.test(s)) return true;
  return false;
}

/** Beat-article snippet or mis-attributed On3 scrape — not player-specific scouting intel. */
function isGenericBeatArticle(text, playerName) {
  const s = String(text || '').trim();
  if (!s || s.length < 10) return true;
  if (isChaseProcessIntel(s)) return true;
  if (isFilmDeskMeta(s)) return true;
  if (JUNK_INTEL_PATTERNS.some((re) => re.test(s))) return true;
  if (/^The Florida Gators\b/i.test(s)) return true;
  if (/^Miami is still working\b/i.test(s)) return true;
  if (/^Florida's offensive line class\b/i.test(s)) return true;
  if (/^Florida continues to build\b/i.test(s)) return true;
  if (/^Florida tight end commit\b/i.test(s)) return true;
  if (/^When this week is over\b/i.test(s)) return true;
  if (/^It['']s another important official visit week\b/i.test(s)) return true;
  const last = playerLastName(playerName);
  if (last && last.length > 2 && new RegExp(`\\b${last.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(s)) {
    if (/\b(first commitment for the \d{4} cycle|committed on (Sunday|Saturday|Monday))\b/i.test(s)) {
      return true;
    }
    if (/^\bOn (Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),/i.test(s)) return true;
    if (/\b(has committed|commits|flipped (his|her|their)? commitment)\b/i.test(s)) return true;
    return false;
  }
  return false;
}

function isLowQualityIntelText(text) {
  return isGenericBeatArticle(text, '');
}

function isCompositeBio(text) {
  const s = String(text || '').trim();
  if (!s) return true;
  // On3 rank dump: "Name is a 4-star WR · listed at 6-0 / 185 · from …"
  if (/\bis a \d+-star\b/i.test(s) && /\blisted at\b/i.test(s)) return true;
  if (/\bis a \d+-star\b/i.test(s) && /\bfrom\b/i.test(s) && /#\d+\s+nationally/i.test(s)) return true;
  // Broken synthetic: "Name is a listed at 6-3 / 235 · from …"
  if (/\bis a listed at\b/i.test(s)) return true;
  if (/Still an open board target — not a Florida commit/i.test(s) && /\blisted at\b/i.test(s)) {
    return true;
  }
  return false;
}

function firstVerifiedIntel(player, fields, playerName) {
  const name = playerName || player?.name;
  for (const key of fields) {
    const val = player[key];
    if (val == null) continue;
    const s = String(val).trim();
    if (
      s &&
      !isGenericBeatArticle(s, name) &&
      !isCompositeBio(s) &&
      !isChaseProcessIntel(s)
    ) {
      return s;
    }
  }
  return null;
}

/** Strip player name tokens so last names like "Strong" cannot fake trait keywords. */
function textWithoutPlayerName(text, playerName) {
  let s = String(text || '');
  const name = String(playerName || '').trim();
  if (!name) return s;
  for (const token of name.split(/\s+/).filter((t) => t.length >= 3)) {
    const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    s = s.replace(re, ' ');
  }
  return s.replace(/\s+/g, ' ').trim();
}

/** Scouting trait line — not visit news, composite bios, or program-level beat copy. */
function isVerifiedScoutingTrait(text, playerName) {
  const s = String(text || '').trim();
  if (!s || s.length < 4 || s.length > 250) return false;
  if (isGenericBeatArticle(s, playerName)) return false;
  if (isCompositeBio(s)) return false;
  if (SCOUTING_TRAIT_REJECT.some((re) => re.test(s))) return false;
  // Keyword match must survive without the player's own name (e.g. Armani Strong).
  return SCOUTING_TRAIT_KEYWORDS.test(textWithoutPlayerName(s, playerName));
}

function verifiedStrengthsList(player) {
  const list = player.strengths;
  if (!Array.isArray(list) || !list.length) return null;
  const cleaned = list
    .map((item) => String(item || '').trim())
    .filter((s) => isVerifiedScoutingTrait(s, player.name) && !isCompositeBio(s));
  return cleaned.length ? cleaned.slice(0, 2).join(' · ') : null;
}

function breakdownIsCorrupt(entry, player) {
  if (!entry) return true;
  const name = typeof player === 'string' ? player : player?.name || entry.playerName || '';
  const fields = [
    entry.insiderNotes,
    entry.projection,
    ...(entry.strengths || []),
  ].filter(Boolean);
  if (!fields.length) return true;
  return fields.some(
    (text) =>
      isGenericBeatArticle(String(text), name) ||
      !intelReferencesPlayer(String(text), name)
  );
}

function buildVerifiedOn3Summary(player) {
  const pos = player.pos || player.position || 'prospect';
  const stars = Number(player.stars);
  const parts = [];
  if (stars) parts.push(`${stars}-star ${pos}`);
  if (player.htWt) parts.push(`listed at ${player.htWt}`);
  if (player.school) parts.push(`from ${player.school}`);
  const ranks = [];
  if (player.natlRank != null) ranks.push(`#${player.natlRank} nationally`);
  if (player.posRank != null) ranks.push(`#${player.posRank} at ${pos}`);
  if (player.stateRank != null) ranks.push(`#${player.stateRank} in state`);
  if (ranks.length) parts.push(ranks.join(', '));

  let body = `${player.name} is a ${parts.join(' · ')}.`;
  const profileNote = String(player.profileNote || '').trim();
  if (
    profileNote &&
    profileNote.length >= 40 &&
    !isGenericBeatArticle(profileNote, player.name)
  ) {
    body += ` ${profileNote}`;
  } else {
    const committedToUf =
      !!player.commitDate ||
      /^(committed|signed|enrolled)$/i.test(String(player.status || '').trim()) ||
      /florida|gators/i.test(String(player.committedTo || ''));
    if (committedToUf) {
      body += player.commitDate
        ? ` Committed to Florida on ${player.commitDate}.`
        : ' Committed to Florida.';
    } else {
      const ufStake = String(player.ufStatus || player.status || '').trim();
      if (ufStake && !/^uncommitted$/i.test(ufStake)) {
        body += ` UF board status: ${ufStake}.`;
      } else {
        body += ' Still an open board target — not a Florida commit.';
      }
    }
  }
  return body.length >= 80 ? body : null;
}

function buildSyntheticBreakdown(player) {
  const summary = buildVerifiedOn3Summary(player);
  if (!summary) return null;
  const projection =
    summary.match(/\b(?:He|She|They)\s+projects?\s+as[^.]+\./i)?.[0]?.trim() || null;
  return {
    playerSlug: player.slug,
    playerName: player.name,
    playerType: player.status === 'committed' ? 'commit' : 'recruit',
    verified: true,
    sources: [
      {
        writer: 'Charles Power',
        writerId: 'power',
        outlet: 'On3 verified composite',
        url: player.on3ProfileUrl || null,
        publishedAt: new Date().toISOString().slice(0, 10),
      },
    ],
    // Identity/rank dump is not a scouting strength — leave empty until real traits exist.
    strengths: [],
    weaknesses: [],
    comparison: null,
    schemeFit: null,
    staffNotes: null,
    projection,
    insiderNotes: summary,
    recruitingStory: player.commitDate
      ? `Committed to Florida on ${player.commitDate}${player.school ? ` · ${player.school}` : ''}`
      : null,
    nflProjection: null,
    featured: false,
    updatedAt: new Date().toISOString(),
  };
}

module.exports = {
  isPlaceholderSkinny,
  hasRealSchool,
  hasMeaningfulOn3Fields,
  assessOn3Intel,
  isGenericBeatArticle,
  isChaseProcessIntel,
  isFilmDeskMeta,
  isCompositeBio,
  isLowQualityIntelText,
  isVerifiedScoutingTrait,
  firstVerifiedIntel,
  verifiedStrengthsList,
  intelReferencesPlayer,
  playerLastName,
  breakdownIsCorrupt,
  buildVerifiedOn3Summary,
  buildSyntheticBreakdown,
};
