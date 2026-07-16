/**
 * Insider article formatting helpers and quality gates.
 */
const cycle = require('./insider-articles-cycle');
const sanitize = require('./insider-articles-sanitize');

const MIN_WORDS = 320;
const TARGET_WORDS = 420;
const MAX_WORDS = 700;

function esc(text) {
  return sanitize
    .sanitizeText(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function section(title, paragraphs) {
  const body = (paragraphs || []).filter(Boolean).map((p) => `<p>${p}</p>`).join('\n');
  if (!body) return '';
  return `<h2>${esc(title)}</h2>\n${body}`;
}

function playerLine(player, extra = '') {
  const name = sanitize.sanitizePlayerName(player?.name || player?.playerName);
  if (!name) return null;
  const pos = esc(player.pos || player.position || '');
  const stars = player.stars ? `${player.stars}★` : '';
  const school = esc(player.school || player.highSchool || '');
  const yr = player.classYear || cycle.RECRUITING_MIN_CLASS;
  const bits = [pos, stars, school, `${yr} class`].filter(Boolean).join(' · ');
  const tail = extra ? ` ${esc(extra)}` : '';
  return `<strong>${esc(name)}</strong> (${bits})${tail}.`;
}

const { hasForbiddenPublishedLabels } = require('./insider-articles-sections');
const { validateWarRoomBattles } = require('./war-room-battles');
const { isRecruitingBattleArticleType } = require('./insider-articles-types');

function validateDraftQuality(draft) {
  if (!draft?.body) {
    return { ok: false, reasons: ['empty_body'], words: 0, minWords: MIN_WORDS, targetWords: TARGET_WORDS };
  }
  const scaffold = draft.scaffoldBody || draft.body;
  const body = draft.body;
  const words = sanitize.wordCount(body);
  const reasons = [];
  const handPolished = (draft.qualityReasons || []).includes('hand_polished_for_approve');

  if (words < MIN_WORDS) reasons.push(`word_count_${words}`);
  if (words > MAX_WORDS + 200) reasons.push(`word_count_high_${words}`);
  if (sanitize.hasEmptyParentheses(body)) reasons.push('empty_parentheses');
  // Hand-polished Approve drafts use free-form sections; facts still hard-fail below.
  if (!handPolished && !sanitize.hasEliteRequiredSections(scaffold)) {
    reasons.push('missing_elite_sections');
  }
  if (hasForbiddenPublishedLabels(body)) reasons.push('internal_labels_in_publish');
  if (sanitize.hasBannedPhrases(body)) reasons.push('banned_phrase');
  if (sanitize.isNameOnlyListBody(body)) reasons.push('name_only_list');
  if (sanitize.isGenericBoilerplateBody(body)) reasons.push('generic_boilerplate');

  if (cycle.isRecruitingCategory(draft.category)) {
    const yr = cycle.parseYear(draft.classYear || cycle.RECRUITING_MIN_CLASS);
    if (yr != null && yr < cycle.RECRUITING_MIN_CLASS) reasons.push('recruiting_cycle_violation');
  }

  const angles = draft.insiderAngles || [];
  if (angles.length < 3) reasons.push('insufficient_insider_angles');

  if (!handPolished) {
    const analysisBlock =
      scaffold.match(/<h2>Insider Angles<\/h2>([\s\S]*?)(<h2>|$)/i)?.[1] ||
      body.match(/<h2>Insider Angles<\/h2>([\s\S]*?)(<h2>|$)/i)?.[1] ||
      body.match(/<h2>Analysis<\/h2>([\s\S]*?)(<h2>|$)/i)?.[1] ||
      '';
    const analysisParas = (analysisBlock.match(/<p>/gi) || []).length;
    if (analysisParas < 3) reasons.push('thin_analysis');

    if (isRecruitingBattleArticleType(draft.articleType)) {
      const warReasons = validateWarRoomBattles(draft.battles || [], body);
      for (const r of warReasons) reasons.push(r);
    }
  }

  try {
    const { validateRecruitingFactClaims } = require('./insider-articles-recruiting-facts');
    for (const r of validateRecruitingFactClaims(draft)) reasons.push(r);
  } catch (err) {
    reasons.push(`fact_check_error:${err?.message || 'unknown'}`);
  }


  // Scaffold mad-lib / scheme-dump gate — skip for hand-polished Approve drafts (facts still run above).
  if (!handPolished) {
    try {
      const { detectScaffoldBoilerplate } = require('./insider-articles-elite-gate');
      for (const r of detectScaffoldBoilerplate(draft)) reasons.push(r);
    } catch (err) {
      reasons.push(`elite_gate_error:${err?.message || 'unknown'}`);
    }
  }

  return {
    ok: reasons.length === 0,
    reasons,
    words,
    minWords: MIN_WORDS,
    targetWords: TARGET_WORDS,
  };
}

function buildArticleDraft(topic, signals) {
  const editorial = require('./insider-articles-editorial');
  if (!signals || !topic?.topicKey) return null;
  return editorial.generateDraftForTopic(topic, signals);
}

function generateDraftForTopic(topic, signals) {
  return buildArticleDraft(topic, signals);
}

module.exports = {
  MIN_WORDS,
  TARGET_WORDS,
  MAX_WORDS,
  esc,
  section,
  playerLine,
  validateDraftQuality,
  buildArticleDraft,
  generateDraftForTopic
};
