/** Generation -> editorial transform -> publish-ready HTML. */
const { extractInternalSections, assemblePublishedHtml, hasForbiddenPublishedLabels } = require('./insider-articles-sections');
const { rewriteHeadersWithLlm, rewriteHeadersFallback } = require('./editorial-headers');
const { isLlmAllowed } = require('./insider-articles-config');
const { generateRecruitingBattles, buildBattleContextFromSignals, renderBattlesHtml, validateWarRoomBattles } = require('./war-room-battles');
const { isRecruitingBattleArticleType } = require('./insider-articles-types');
const sanitize = require('./insider-articles-sanitize');

async function transformDraftForPublish({ scaffoldBody, articleType, context, signals, season }) {
  const sections = extractInternalSections(scaffoldBody);
  const meta = {
    articleType,
    season: season || context?.season,
    portalCount: context?.portalContext?.incomingCount || 0,
  };

  let battles = [];
  let recruitingHtml = null;

  if (isRecruitingBattleArticleType(articleType)) {
    const battleCtx = buildBattleContextFromSignals(signals, context);
    battles = generateRecruitingBattles(battleCtx);
    if (battles.length < 2) {
      throw new Error('Recruiting battle draft failed: not enough verified battles');
    }
    recruitingHtml = renderBattlesHtml(battles);
    const warReasons = validateWarRoomBattles(battles, recruitingHtml);
    if (warReasons.length) {
      throw new Error('Recruiting battle draft failed quality gate: ' + warReasons.join(','));
    }
  }

  const headers = isLlmAllowed()
    ? await rewriteHeadersWithLlm(sections, meta)
    : rewriteHeadersFallback(sections, meta);

  const body = assemblePublishedHtml({
    headers,
    sections,
    recruitingHtml: isRecruitingBattleArticleType(articleType) ? recruitingHtml : null,
  });

  if (hasForbiddenPublishedLabels(body)) {
    throw new Error('Published body still contains internal scaffold labels');
  }

  const words = sanitize.wordCount(body);
  if (words < 700) {
    throw new Error('Draft failed quality gate: <700 words after editorial transform');
  }

  return { body, editorialHeaders: headers, battles, sections, words };
}

module.exports = { transformDraftForPublish };