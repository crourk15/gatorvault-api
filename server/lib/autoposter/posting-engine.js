/**
 * Autoposter Posting Engine — post to X + pipeline eligibility/skip rules.
 */
const dataLayer = require('../x-autoposter-data-layer');
const postSpec = require('../x-autoposter-post-spec');
const gm2 = require('../gm2');
const insiderTone = require('./insider-tone');
const autoposterPolicy = require('./autoposter-policy');
const monitoring = require('./autoposter-monitoring');

const INTEL_FRESHNESS_MS = parseInt(
  process.env.X_AUTOPOST_INTEL_FRESHNESS_MS || String(48 * 60 * 60 * 1000),
  10
);

const GENERIC_QUOTE_RES = [
  /^had a great visit\.?$/i,
  /^great visit\.?$/i,
  /^loved (?:the )?visit\.?$/i,
  /^amazing (?:time|visit)\.?$/i
];

const STAT_LINE_RES = [
  /\b\d+\s*(?:yards|yds|tds|tackles|rec|receptions|points)\b/i,
  /\bfinal score\b/i,
  /\b\d+\s*-\s*\d+\b.*\b(?:win|loss|defeat)\b/i
];

async function postToX(rewrite, player, intel) {
  const xAutoposter = require('../x-autoposter');
  try {
    const result = await xAutoposter.postTweet({ text: rewrite.text || rewrite });
    monitoring.logAutoposterEvent('post_success', {
      playerId: player?.playerId,
      intelId: intel?.id,
      statusId: result.tweetId,
      tweetUrl: result.tweetUrl
    });
    return { ok: true, statusId: result.tweetId, tweetUrl: result.tweetUrl };
  } catch (err) {
    monitoring.logAutoposterEvent('post_failure', {
      playerId: player?.playerId,
      intelId: intel?.id,
      error: err.message
    });
    return { ok: false, error: err.message };
  }
}

function assessEligibility(intel = {}, built = {}) {
  const reasons = [];
  const beatText = intel.detail || intel.beatText || intel.text || built.validationMeta?.beatText || '';
  const player =
    built.player ||
    (intel.playerName || built.playerName
      ? { playerId: intel.playerSlug || intel.playerId, name: intel.playerName || built.playerName }
      : null);

  const policy = autoposterPolicy.assessEligibilityFromIntel(
    {
      ufRelevant: intel.ufRelevant ?? intel.directlyInvolvesUF ?? dataLayer.intelDirectlyInvolvesUF(intel, beatText),
      eventType: intel.eventType,
      isDuplicate: intel.isDuplicate || built.duplicate,
      sourceType: intel.sourceType
    },
    player
  );
  if (!policy.eligible) reasons.push(...policy.reasons);

  if (!intel.playerName && !built.playerName && !built.context?.name) {
    reasons.push('no_identifiable_player');
  }

  const ufCheck = dataLayer.intelDirectlyInvolvesUF(intel, beatText);
  if (ufCheck === false) reasons.push('no_uf_relevance');

  const ts = intel.timestamp || intel.reportedAt || intel.createdAt || built.sourceEventCreatedAt;
  if (ts) {
    const age = Date.now() - new Date(ts).getTime();
    if (age > INTEL_FRESHNESS_MS && !intel.manualOverride) reasons.push('stale_intel');
  }

  if (GENERIC_QUOTE_RES.some((re) => re.test(beatText.trim()))) reasons.push('generic_quote');
  if (insiderTone.isGenericFluff(built.text || '') || insiderTone.isGenericFluff(beatText)) {
    reasons.push('generic_beat_fluff');
  }
  if (STAT_LINE_RES.some((re) => re.test(beatText))) reasons.push('stat_line_or_recap');

  const situation = postSpec.detectSituation(beatText, intel.eventType);
  if (!situation && !intel.eventType && !built.templateBlocks) reasons.push('no_recruiting_context');

  return { eligible: reasons.length === 0, reasons };
}

function assessSkipReasons(candidate = {}) {
  const validation = require('../x-autoposter-validation');
  const qualityChecks = require('./quality-checks');
  const skips = [];
  const eligibility = assessEligibility(candidate, candidate);
  if (!eligibility.eligible) skips.push(...eligibility.reasons.map((r) => ({ type: r, message: r })));

  const qualityGate = validation.passesNewsQualityGate(candidate);
  if (!qualityGate.pass) {
    skips.push(...(qualityGate.scored?.hardSkips || []).map((s) => ({ type: s.type, message: s.message })));
  }

  if (!gm2.filterAutoposterCandidate(candidate)) {
    skips.push({ type: 'gm2_rejected', message: 'GM2 autoposter rules rejected candidate' });
  }

  const rewriteText = [candidate.templateBlocks?.context, candidate.templateBlocks?.insider].filter(Boolean).join(' ');
  const beatText = candidate.validationMeta?.beatText || '';
  if (rewriteText && beatText) {
    const qc = qualityChecks.runQualityChecks({ text: rewriteText, beatText, blocks: candidate.templateBlocks });
    if (!qc.ok) skips.push(...qc.errors.map((e) => ({ type: e, message: e })));
  }

  return { skip: skips.length > 0, skips };
}

function getPolicyRules() {
  const base = require('./autoposter-policy');
  return {
    eligibility: [
      'Valid player match',
      'UF-relevant intel',
      'Fresh within 48h (override via manualOverride)',
      'Not duplicate',
      'Not generic beat writer fluff',
      'Has recruiting context (visit, movement, prediction, staff contact)'
    ],
    skip: [
      'No identifiable player',
      'No UF relevance',
      'No recruiting context',
      'Generic quote ("had a great visit")',
      'Repost of someone else\'s insider content',
      'Unverified rumor',
      'Stat line or game recap',
      'Non-recruiting post'
    ],
    copyPrevention: [
      'Reject rewrite >20% similar to source',
      'Reject beat writer structure copy',
      'Reject rewrite <40 words',
      'Regenerate on rejection'
    ],
    tone: insiderTone.getToneGuide(),
    isEligibleIntel: base.isEligibleIntel
  };
}

module.exports = {
  INTEL_FRESHNESS_MS,
  postToX,
  assessEligibility,
  assessSkipReasons,
  getPolicyRules
};
