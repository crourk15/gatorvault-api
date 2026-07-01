/**
 * Insider article formatting helpers and quality gates.
 */
const cycle = require('./insider-articles-cycle');
const sanitize = require('./insider-articles-sanitize');

const MIN_WORDS = 700;
const TARGET_WORDS = 900;
const MAX_WORDS = 1200;

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

function validateDraftQuality(draft) {
  if (!draft?.body) {
    return { ok: false, reasons: ['empty_body'], words: 0, minWords: MIN_WORDS, targetWords: TARGET_WORDS };
  }
  const body = draft.body;
  const words = sanitize.wordCount(body);
  const reasons = [];

  if (words < MIN_WORDS) reasons.push(`word_count_${words}`);
  if (words > MAX_WORDS + 200) reasons.push(`word_count_high_${words}`);
  if (sanitize.hasEmptyParentheses(body)) reasons.push('empty_parentheses');
  if (!sanitize.hasEliteRequiredSections(body)) reasons.push('missing_elite_sections');
  if (sanitize.hasBannedPhrases(body)) reasons.push('banned_phrase');
  if (sanitize.isNameOnlyListBody(body)) reasons.push('name_only_list');
  if (sanitize.isGenericBoilerplateBody(body)) reasons.push('generic_boilerplate');

  if (cycle.isRecruitingCategory(draft.category)) {
    const yr = cycle.parseYear(draft.classYear || cycle.RECRUITING_MIN_CLASS);
    if (yr != null && yr < cycle.RECRUITING_MIN_CLASS) reasons.push('recruiting_cycle_violation');
  }

  const angles = draft.insiderAngles || [];
  if (angles.length < 3) reasons.push('insufficient_insider_angles');

  const analysisBlock =
    body.match(/<h2>Insider Angles<\/h2>([\s\S]*?)(<h2>|$)/i)?.[1] ||
    body.match(/<h2>Analysis<\/h2>([\s\S]*?)(<h2>|$)/i)?.[1] ||
    '';
  const analysisParas = (analysisBlock.match(/<p>/gi) || []).length;
  if (analysisParas < 3) reasons.push('thin_analysis');

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
