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
    .filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

/** Beat-article snippet or mis-attributed On3 scrape — not player-specific scouting intel. */
function isGenericBeatArticle(text, playerName) {
  const s = String(text || '').trim();
  if (!s || s.length < 10) return true;
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

function firstVerifiedIntel(player, fields, playerName) {
  const name = playerName || player?.name;
  for (const key of fields) {
    const val = player[key];
    if (val == null) continue;
    const s = String(val).trim();
    if (s && !isGenericBeatArticle(s, name)) return s;
  }
  return null;
}

/** Scouting trait line — not visit news or program-level beat copy. */
function isVerifiedScoutingTrait(text, playerName) {
  const s = String(text || '').trim();
  if (!s || s.length < 4 || s.length > 250) return false;
  if (isGenericBeatArticle(s, playerName)) return false;
  if (SCOUTING_TRAIT_REJECT.some((re) => re.test(s))) return false;
  return SCOUTING_TRAIT_KEYWORDS.test(s);
}

function verifiedStrengthsList(player) {
  const list = player.strengths;
  if (!Array.isArray(list) || !list.length) return null;
  const cleaned = list
    .map((item) => String(item || '').trim())
    .filter((s) => isVerifiedScoutingTrait(s, player.name));
  return cleaned.length ? cleaned.slice(0, 2).join(' · ') : null;
}

module.exports = {
  isPlaceholderSkinny,
  hasRealSchool,
  hasMeaningfulOn3Fields,
  assessOn3Intel,
  isGenericBeatArticle,
  isLowQualityIntelText,
  isVerifiedScoutingTrait,
  firstVerifiedIntel,
  verifiedStrengthsList,
  intelReferencesPlayer,
  playerLastName,
};
