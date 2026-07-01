/** Related Articles scoring for Insider Hub. */
function overlap(arr1, arr2) {
  const a = Array.isArray(arr1) ? arr1 : [];
  const b = Array.isArray(arr2) ? arr2 : [];
  return a.filter((x) => b.includes(x)).length;
}

function scoreRelated(article, candidate) {
  return (
    (candidate.articleType === article.articleType ? 3 : 0) +
    (candidate.angleKey === article.angleKey ? 2 : 0) +
    (candidate.topicKey === article.topicKey ? 2 : 0) +
    overlap(candidate.rosterUnits, article.rosterUnits) * 1.5 +
    overlap(candidate.recruitingTargets, article.recruitingTargets) * 1.5 +
    overlap(candidate.schemeTags, article.schemeTags) * 1.5 +
    overlap(candidate.analyticsTags, article.analyticsTags) * 1.5
  );
}

function getRelatedArticles(article, allArticles, limit = 4) {
  if (!article || !Array.isArray(allArticles)) return [];
  return allArticles
    .filter((a) => a && a.id !== article.id)
    .map((a) => ({ article: a, score: scoreRelated(article, a) }))
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map((x) => x.article);
}

module.exports = { overlap, scoreRelated, getRelatedArticles };