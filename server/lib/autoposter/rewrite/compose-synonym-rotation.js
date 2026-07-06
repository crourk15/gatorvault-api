/**
 * PR-789 Tier-2 synonym rotation + frequency suppression.
 * Beat facts override rotation; Tier-3 thin fallback is never rotated.
 */
const composeHistory = require('../compose-angle-history');

const FREQUENCY_THRESHOLD = parseInt(process.env.COMPOSE_ANGLE_FREQ_THRESHOLD || '3', 10);

const ANGLE_POOLS = Object.freeze({
  traction: [
    'traction',
    'momentum',
    'early push',
    'early movement',
    'early attention',
    'early involvement',
    'early signal',
    'early interest'
  ],
  priority: [
    'priority',
    'circled early',
    'high on the board',
    'early eval',
    'early focus',
    'early target',
    'early attention'
  ],
  in_the_mix: [
    'in the mix',
    'in the picture',
    'in the conversation',
    'on the radar',
    'part of the early group',
    'in the early cluster'
  ],
  standing_out: [
    'standing out early',
    'emerging early',
    'showing early signs',
    'early standout',
    'early signal'
  ],
  staff_contact: [
    'staff is in contact',
    'staff attention early',
    'communication is real',
    'early staff involvement',
    'staff traction'
  ],
  positional_fit: [
    'UF likes his traits',
    'positional fit is real',
    'early eval at position',
    'staff sees him as a legit eval'
  ],
  geographic: [
    'UF pushing despite distance',
    'traction despite geography',
    'early interest across regions'
  ],
  connection: [
    'commit in his circle',
    'teammate connection',
    'peer influence',
    'early relationship angle'
  ],
  board: ['on his board early', 'among his top schools', 'on the QB board early', 'in his top-school mix']
});

const THIN_FALLBACK_RE =
  /\bbuilding real traction with .+ early in (?:his|her|their) recruitment\b/i;

const BUCKET_LEMMA_RES = Object.freeze({
  traction: /\b(?:building )?real traction\b|\bearly traction\b|\bbuilding early traction\b/gi,
  priority: /\bmaking .+ a priority early\b|\bpriority early\b/gi,
  in_the_mix: /\bin the mix\b|\bclearly in the mix\b|\bin his mix\b|\bin her mix\b/gi,
  standing_out: /\bstanding out early\b|\bstanding out\b/gi,
  board: /\bon his board early\b|\bon the radar early\b|\bfirmly on .+'s radar early\b/gi
});

const SAFE_NEUTRAL = Object.freeze({
  traction: 'early attention',
  priority: 'early focus',
  in_the_mix: 'in the picture',
  standing_out: 'showing early signs',
  staff_contact: 'early staff involvement',
  positional_fit: 'early eval at position',
  geographic: 'early interest across regions',
  connection: 'early relationship angle',
  board: 'among his top schools'
});

function enabled() {
  return process.env.COMPOSE_SYNONYM_ROTATION !== 'false';
}

function isThinFallbackNarrative(text = '') {
  return THIN_FALLBACK_RE.test(String(text || ''));
}

function beatRequiresBucket(bucket, facts = {}, beatText = '') {
  const beat = String(beatText || facts.beatText || '').toLowerCase();
  switch (bucket) {
    case 'traction':
      return (
        /\btraction is real\b|\bgaining ground\b|\bbuilding traction\b|\breal traction\b/i.test(beat) &&
        !THIN_FALLBACK_RE.test(beat)
      );
    case 'priority':
      return facts.offerInterest === true || /\bmaking .+ a priority\b|\bpriority early\b/i.test(beat);
    case 'in_the_mix':
      return /\bin the mix\b|\bin the picture\b|\bon the radar\b|\bmutual interest\b/i.test(beat);
    case 'standing_out':
      return facts.programPitch === true || /\bstanding out\b/i.test(beat);
    case 'staff_contact':
      return facts.staffContact === true;
    case 'board':
      return facts.boardSignal === true || /\bon (?:his|the) board\b|\btop schools\b/i.test(beat);
    case 'geographic':
      return facts.geographicSignal === true;
    case 'connection':
      return !!facts.ufCommitTeammate?.name;
    case 'positional_fit':
      return /\btraits\b|\bpositional fit\b|\blegit eval\b/i.test(beat);
    default:
      return false;
  }
}

function isSynonymSafeForFacts(synonym, bucket, facts = {}) {
  const s = String(synonym || '').toLowerCase();
  if (bucket === 'staff_contact' || /staff is in contact|communication is real|staff traction/i.test(s)) {
    return facts.staffContact === true;
  }
  if (bucket === 'board' || /high on the board|on the board|top schools/i.test(s)) {
    return facts.boardSignal === true;
  }
  if (bucket === 'geographic' || /despite distance|despite geography|across regions/i.test(s)) {
    return facts.geographicSignal === true;
  }
  if (bucket === 'connection' || /commit in his circle|teammate connection|peer influence/i.test(s)) {
    return !!facts.ufCommitTeammate?.name;
  }
  if (/staff sees him as a legit eval|positional fit is real|uf likes his traits/i.test(s)) {
    return facts.programPitch === true || /\btraits\b|\beval\b/i.test(String(facts.beatText || ''));
  }
  return true;
}

function lastUsedSynonymMap(bucket, history = []) {
  const pool = ANGLE_POOLS[bucket] || [];
  const map = Object.fromEntries(pool.map((s) => [s.toLowerCase(), null]));
  for (const row of history) {
    if (String(row.angleUsed || '').toLowerCase() !== bucket) continue;
    const syn = String(row.synonymUsed || '').toLowerCase();
    if (!syn || !(syn in map)) continue;
    const ts = new Date(row.createdAt || 0).getTime();
    if (map[syn] == null || ts > map[syn]) map[syn] = ts;
  }
  return map;
}

function rotateSynonym(bucket, history = [], facts = {}) {
  const pool = ANGLE_POOLS[bucket] || [];
  if (!pool.length) return SAFE_NEUTRAL[bucket] || pool[0];

  const lastUsed = lastUsedSynonymMap(bucket, history);
  const safePool = pool.filter((syn) => isSynonymSafeForFacts(syn, bucket, facts));
  const candidates = safePool.length ? safePool : pool.filter((syn) => isSynonymSafeForFacts(syn, bucket, facts));
  const search = candidates.length ? candidates : [SAFE_NEUTRAL[bucket] || pool[0]];

  for (const syn of search) {
    if (lastUsed[String(syn).toLowerCase()] == null) return syn;
  }

  let pick = search[0];
  let oldest = Infinity;
  for (const syn of search) {
    const ts = lastUsed[String(syn).toLowerCase()];
    if (ts != null && ts < oldest) {
      oldest = ts;
      pick = syn;
    }
  }
  return pick;
}

function selectSynonymForBucket(bucket, facts = {}, beatText = '', history = null) {
  const rows = history || composeHistory.getRecentComposeHistory();
  const beatOverride = beatRequiresBucket(bucket, facts, beatText);
  const count = composeHistory.countAngleInHistory(bucket, rows);
  const suppressed = count >= FREQUENCY_THRESHOLD && !beatOverride;

  if (beatOverride) {
    return {
      bucket,
      synonym: ANGLE_POOLS[bucket]?.[0] || bucket,
      suppressed: false,
      beatOverride: true,
      frequency: count
    };
  }

  const synonym =
    suppressed || count >= 1
      ? rotateSynonym(bucket, rows, facts)
      : ANGLE_POOLS[bucket]?.[0] || bucket;

  const safeSynonym = isSynonymSafeForFacts(synonym, bucket, facts)
    ? synonym
    : SAFE_NEUTRAL[bucket] || rotateSynonym(bucket, rows, facts);

  return {
    bucket,
    synonym: safeSynonym,
    suppressed,
    beatOverride: false,
    frequency: count
  };
}

function detectBucketsInNarrative(narrative = '') {
  const text = String(narrative || '');
  const buckets = [];
  for (const [bucket, re] of Object.entries(BUCKET_LEMMA_RES)) {
    re.lastIndex = 0;
    if (re.test(text)) buckets.push(bucket);
  }
  return buckets;
}

function replaceBucketLemma(narrative, bucket, synonym) {
  const re = BUCKET_LEMMA_RES[bucket];
  if (!re || !synonym) return narrative;
  const s = String(synonym);
  re.lastIndex = 0;
  if (bucket === 'traction') {
    return String(narrative).replace(/\b(?:building )?real traction\b/gi, s).replace(/\bearly traction\b/gi, s);
  }
  if (bucket === 'priority') {
    return String(narrative).replace(/\ba priority early\b/gi, `${s}`);
  }
  if (bucket === 'in_the_mix') {
    return String(narrative)
      .replace(/\bclearly in the mix\b/gi, `clearly ${s}`)
      .replace(/\bin the mix\b/gi, s)
      .replace(/\bin his mix\b/gi, s);
  }
  return String(narrative).replace(re, s);
}

/**
 * Apply Tier-2 synonym rotation to composed narrative.
 * Returns null narrative when thin Tier-3 fallback is detected.
 */
function applyComposeSynonymRotation({
  narrative = '',
  facts = {},
  anglePick = {},
  playerSlug = null,
  beatText = ''
} = {}) {
  if (!narrative) return { ok: false, reason: 'empty_narrative', narrative: null };
  if (isThinFallbackNarrative(narrative)) {
    return { ok: false, reason: 'thin_fallback_blocked', narrative: null };
  }
  if (!enabled()) {
    return {
      ok: true,
      narrative,
      rotation: { enabled: false, buckets: [], applied: [] }
    };
  }

  const buckets = detectBucketsInNarrative(narrative);
  if (!buckets.length) {
    return {
      ok: true,
      narrative,
      rotation: { enabled: true, buckets: [], applied: [], dominantAngle: anglePick.angle || null }
    };
  }

  let out = narrative;
  const applied = [];
  const history = composeHistory.getRecentComposeHistory();

  for (const bucket of buckets) {
    const pick = selectSynonymForBucket(bucket, facts, beatText, history);
    if (!pick.synonym || pick.synonym === bucket) continue;
    const next = replaceBucketLemma(out, bucket, pick.synonym);
    if (next !== out) {
      out = next;
      applied.push(pick);
    }
  }

  return {
    ok: true,
    narrative: out,
    rotation: {
      enabled: true,
      buckets,
      applied,
      dominantAngle: anglePick.angle || null,
      playerSlug: playerSlug || null
    }
  };
}

module.exports = {
  enabled,
  FREQUENCY_THRESHOLD,
  ANGLE_POOLS,
  THIN_FALLBACK_RE,
  isThinFallbackNarrative,
  beatRequiresBucket,
  isSynonymSafeForFacts,
  selectSynonymForBucket,
  rotateSynonym,
  detectBucketsInNarrative,
  applyComposeSynonymRotation
};
