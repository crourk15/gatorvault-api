const fs = require("fs");

function rep(file, old, neu) {
  let s = fs.readFileSync(file, "utf8");
  if (!s.includes(old)) {
    console.log("SKIP", file, old.slice(0, 40));
    return;
  }
  fs.writeFileSync(file, s.replace(old, neu), "utf8");
  console.log("OK", file);
}

rep(
  "server/lib/insider-articles-sanitize.js",
  "module.exports = {",
  `const { hasForbiddenPublishedLabels } = require('./insider-articles-sections');

module.exports = {`
);
rep(
  "server/lib/insider-articles-sanitize.js",
  "  isGenericBoilerplateBody\n};",
  `  isGenericBoilerplateBody,
  hasForbiddenPublishedLabels
};`
);

rep(
  "server/lib/insider-articles-templates.js",
  "function validateDraftQuality(draft) {\n  if (!draft?.body) {",
  `const { hasForbiddenPublishedLabels } = require('./insider-articles-sections');
const { validateWarRoomBattles } = require('./war-room-battles');

function validateDraftQuality(draft) {
  if (!draft?.body) {`
);
rep(
  "server/lib/insider-articles-templates.js",
  "  const body = draft.body;\n  const words = sanitize.wordCount(body);",
  `  const scaffold = draft.scaffoldBody || draft.body;
  const body = draft.body;
  const words = sanitize.wordCount(body);`
);
rep(
  "server/lib/insider-articles-templates.js",
  "  if (!sanitize.hasEliteRequiredSections(body)) reasons.push('missing_elite_sections');",
  `  if (!sanitize.hasEliteRequiredSections(scaffold)) reasons.push('missing_elite_sections');
  if (hasForbiddenPublishedLabels(body)) reasons.push('internal_labels_in_publish');`
);
rep(
  "server/lib/insider-articles-templates.js",
  "  const analysisBlock =\n    body.match(/<h2>Insider Angles<\\/h2>([\\s\\S]*?)(<h2>|$)/i)?.[1] ||",
  `  const analysisBlock =
    scaffold.match(/<h2>Insider Angles<\\/h2>([\\s\\S]*?)(<h2>|$)/i)?.[1] ||
    body.match(/<h2>Insider Angles<\\/h2>([\\s\\S]*?)(<h2>|$)/i)?.[1] ||`
);
rep(
  "server/lib/insider-articles-templates.js",
  "  if (analysisParas < 3) reasons.push('thin_analysis');\n\n  return {",
  `  if (analysisParas < 3) reasons.push('thin_analysis');

  if (draft.articleType === 'War Room') {
    const warReasons = validateWarRoomBattles(draft.battles || [], body);
    for (const r of warReasons) reasons.push(r);
  }

  return {`
);

if (!fs.readFileSync("server/lib/insider-articles-store.js", "utf8").includes("scaffoldBody")) {
  rep(
    "server/lib/insider-articles-store.js",
    "    analyticsTags: Array.isArray(raw.analyticsTags) ? raw.analyticsTags : [],\n  };",
    `    analyticsTags: Array.isArray(raw.analyticsTags) ? raw.analyticsTags : [],
    scaffoldBody: raw.scaffoldBody || null,
    editorialHeaders: raw.editorialHeaders || null,
    battles: Array.isArray(raw.battles) ? raw.battles : [],
  };`
  );
}

if (!fs.readFileSync("server/lib/insider-articles-synthesis.js", "utf8").includes("transformDraftForPublish")) {
  rep(
    "server/lib/insider-articles-synthesis.js",
    "function buildDraftRecord({ payload, topic, context, angleKey, articleType }) {",
    "async function buildDraftRecord({ payload, topic, context, angleKey, articleType, signals }) {"
  );
  rep(
    "server/lib/insider-articles-synthesis.js",
    "  const body = payload.body;\n  const words = sanitize.wordCount(body);",
    `  const scaffoldBody = payload.body;
  const { transformDraftForPublish } = require('./insider-articles-pipeline');
  let transformed;
  try {
    transformed = await transformDraftForPublish({
      scaffoldBody,
      articleType: payload.articleType || articleType,
      context,
      signals,
      season: context?.season,
    });
  } catch (err) {
    console.warn('[insider-generator] editorial transform failed:', err.message);
    return null;
  }
  const body = transformed.body;
  const words = transformed.words || sanitize.wordCount(body);`
  );
  rep(
    "server/lib/insider-articles-synthesis.js",
    "    body,\n    thesis: payload.thesis || '',",
    `    scaffoldBody,
    body,
    editorialHeaders: transformed.editorialHeaders,
    battles: transformed.battles || [],
    thesis: payload.thesis || '',`
  );
  rep(
    "server/lib/insider-articles-synthesis.js",
    "  const draft = buildDraftRecord({\n    payload,\n    topic: topicWithTitle,\n    context,\n    angleKey: angle.key,\n    articleType: angle.articleType,\n  });",
    `  const draft = await buildDraftRecord({
    payload,
    topic: topicWithTitle,
    context,
    angleKey: angle.key,
    articleType: angle.articleType,
    signals,
  });`
  );
}

console.log("integration done");