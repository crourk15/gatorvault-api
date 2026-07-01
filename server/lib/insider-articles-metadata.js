/** Extract related-article metadata from insider context + draft. */
function uniq(arr) {
  return [...new Set((arr || []).filter(Boolean))];
}

function extractArticleMetadata(ctx, topic, draft) {
  const rosterUnits = uniq([
    ...(ctx?.roster?.units || []),
    ...(ctx?.depthChart?.units || []),
    ...(ctx?.portal?.units || []),
  ].map((u) => (typeof u === 'string' ? u : u?.name || u?.unit)).filter(Boolean));

  const recruitingTargets = uniq([
    ...(ctx?.recruiting?.targets || []),
    ...(ctx?.recruiting?.board || []),
  ].map((t) => (typeof t === 'string' ? t : t?.name || t?.player)).filter(Boolean).slice(0, 12));

  const schemeTags = uniq([
    ...(ctx?.scheme?.tags || []),
    ...(ctx?.scheme?.notes || []),
    topic?.angleKey,
  ].filter(Boolean));

  const analyticsTags = uniq([
    ...(ctx?.analytics?.tags || []),
    ...(ctx?.analytics?.metrics || []),
    'returning-production',
    'win-probability',
    'portal-impact',
  ].filter(Boolean));

  return {
    articleType: draft?.articleType || topic?.articleType || '',
    angleKey: draft?.angleKey || topic?.angleKey || '',
    topicKey: draft?.topicKey || topic?.topicKey || topic?.category || '',
    rosterUnits,
    recruitingTargets,
    schemeTags,
    analyticsTags,
  };
}

module.exports = { extractArticleMetadata };