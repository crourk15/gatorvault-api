const fs = require("fs");
const { execSync } = require("child_process");

function read(f) { return fs.readFileSync(f, "utf8"); }
function write(f, s) { fs.writeFileSync(f, s, "utf8"); }
function rep(f, old, neu) {
  let s = read(f);
  if (!s.includes(old)) { console.log("SKIP (missing):", f, old.slice(0,40)); return; }
  write(f, s.replace(old, neu));
  console.log("OK:", f);
}

// llm
rep("server/lib/insider-articles-llm.js",
  "function isLlmEnabled() {\n  return Boolean(process.env.OPENAI_API_KEY || process.env.INSIDER_ARTICLE_LLM_KEY);\n}",
  "const { isLlmAllowed } = require('./insider-articles-config');\n\nfunction isLlmEnabled() {\n  return isLlmAllowed();\n}");
rep("server/lib/insider-articles-llm.js",
  "const { EDITORIAL_SYSTEM_PROMPT, buildUserPrompt } = require('./insider-articles-prompt');\n\nconst { isLlmAllowed }",
  "const { EDITORIAL_SYSTEM_PROMPT, buildUserPrompt } = require('./insider-articles-prompt');\nconst { isLlmAllowed }");

// engine
rep("server/lib/insider-articles-engine.js",
  "const identityValidator = require('./identity-record-validator');",
  "const identityValidator = require('./identity-record-validator');\nconst { calendarBoost, isAutoWeeklyEnabled, calendarForToday } = require('./insider-articles-config');");
rep("server/lib/insider-articles-engine.js",
  `function scoreTopic(topic) {
  const s = topic.scores || {};
  return (
    (s.relevance || 0) * 0.3 +
    (s.timeliness || 0) * 0.25 +
    (s.impact || 0) * 0.25 +
    (s.dataRichness || 0) * 0.12 +
    (s.freshness || 0) * 0.08
  );
}`,
  `function scoreTopic(topic) {
  const sc = topic.scores || {};
  const base =
    (sc.relevance || 0) * 0.3 +
    (sc.timeliness || 0) * 0.25 +
    (sc.impact || 0) * 0.25 +
    (sc.dataRichness || 0) * 0.12 +
    (sc.freshness || 0) * 0.08;
  const cal = calendarForToday();
  const typeBoost = topic.articleType === cal.articleType ? 10 : 0;
  return base + calendarBoost(topic) + typeBoost;
}`);
rep("server/lib/insider-articles-engine.js",
  "async function generateWeeklyDrafts({ force = false, maxDrafts = MAX_WEEKLY } = {}) {\n  const createdThisWeek",
  "async function generateWeeklyDrafts({ force = false, maxDrafts = MAX_WEEKLY } = {}) {\n  if (!force && !isAutoWeeklyEnabled()) {\n    return { ok: true, skipped: true, reason: 'auto_weekly_disabled', phase: 'manual_only' };\n  }\n  const createdThisWeek");
if (!read("server/lib/insider-articles-engine.js").includes("generateDraftForType")) {
  rep("server/lib/insider-articles-engine.js",
    "async function refreshArticleContent(article) {",
    `async function generateDraftForType(articleType) {
  const signals = await collectSignals();
  const synthesis = require('./insider-articles-synthesis');
  const candidates = buildCandidateTopics(signals)
    .filter((t) => synthesis.typeForCategory(t.category) === articleType)
    .sort((a, b) => b.totalScore - a.totalScore);
  const topic = candidates[0] || {
    topicKey: String(articleType).toLowerCase().replace(/\\s+/g, '_') + '_' + Date.now(),
    category: articleType === 'Game Week' ? 'game_week_preview' : 'program_pulse',
    title: articleType + ': Florida insider analysis',
    classYear: cycle.programSeasonYear(),
    scores: { relevance: 85, timeliness: 80, impact: 80, dataRichness: 75, freshness: 80 },
    articleType,
    signals: { roster: signals.roster, portal: signals.portal, type: 'program_pulse' },
    sources: [{ name: 'GatorVault', outlet: 'GatorVault' }],
  };
  const draft = await writeDraftFromTopic(topic, signals);
  if (!draft) throw new Error('Failed to generate draft for ' + articleType);
  return store.addDraft(draft);
}

async function refreshArticleContent(article) {`);
  rep("server/lib/insider-articles-engine.js",
    "  generateWeeklyDrafts,\n  refreshArticleContent,",
    "  generateWeeklyDrafts,\n  generateDraftForType,\n  refreshArticleContent,");
}

// store
if (!read("server/lib/insider-articles-store.js").includes("rosterUnits")) {
  rep("server/lib/insider-articles-store.js",
    "    rejectReason: raw.rejectReason || null,\n  };",
    `    rejectReason: raw.rejectReason || null,
    generationSource: raw.generationSource || null,
    rosterUnits: Array.isArray(raw.rosterUnits) ? raw.rosterUnits : [],
    recruitingTargets: Array.isArray(raw.recruitingTargets) ? raw.recruitingTargets : [],
    schemeTags: Array.isArray(raw.schemeTags) ? raw.schemeTags : [],
    analyticsTags: Array.isArray(raw.analyticsTags) ? raw.analyticsTags : [],
  };`);
  rep("server/lib/insider-articles-store.js",
    "    insiderEngine: true\n  };",
    `    insiderEngine: true,
    angleKey: article.angleKey || null,
    rosterUnits: article.rosterUnits || [],
    recruitingTargets: article.recruitingTargets || [],
    schemeTags: article.schemeTags || [],
    analyticsTags: article.analyticsTags || [],
    generationSource: article.generationSource || null,
  };`);
}

// synthesis
if (!read("server/lib/insider-articles-synthesis.js").includes("extractArticleMetadata")) {
  rep("server/lib/insider-articles-synthesis.js",
    "const store = require('./insider-articles-store');",
    "const store = require('./insider-articles-store');\nconst { extractArticleMetadata } = require('./insider-articles-metadata');");
  rep("server/lib/insider-articles-synthesis.js",
    "  'Game Week': [\n    { key: 'opponent_scout', titleTemplate: 'Game Week: Florida vs {focus} - scouting report and keys' },\n    { key: 'camp_battles', titleTemplate: 'Game Week: Summer camp preview - position battles for the opener' },\n  ],",
    "  'Game Week': [\n    { key: 'opponent_scout', titleTemplate: 'Game Week: Florida vs {focus} - scouting report and keys' },\n    { key: 'matchup_analytics', titleTemplate: 'Game Week: Matchup analytics - Florida vs {focus}' },\n    { key: 'scheme_tendencies', titleTemplate: 'Game Week: Scheme tendencies and coverage shells vs {focus}' },\n    { key: 'pressure_points', titleTemplate: 'Game Week: Pressure points and explosive play threats vs {focus}' },\n    { key: 'red_zone', titleTemplate: 'Game Week: Red zone tendencies and keys vs {focus}' },\n    { key: 'personnel', titleTemplate: 'Game Week: Personnel groupings and matchup edges vs {focus}' },\n    { key: 'trench_battle', titleTemplate: 'Game Week: OL/DL trench battle preview vs {focus}' },\n    { key: 'qb_tendencies', titleTemplate: 'Game Week: QB tendencies and coverage shells vs {focus}' },\n    { key: 'keys_to_game', titleTemplate: 'Game Week: Keys to the game vs {focus}' },\n    { key: 'camp_battles', titleTemplate: 'Game Week: Summer camp preview - position battles for the opener' },\n  ],");
  rep("server/lib/insider-articles-synthesis.js",
    "  'Film Room': [\n    { key: 'scheme_breakdown', titleTemplate: 'Film Room: 3-3-5 install - personnel fits and stress points' },\n    { key: 'position_group', titleTemplate: 'Film Room: {focus} group analysis - who wins reps in fall camp' },\n  ],",
    "  'Film Room': [\n    { key: 'scheme_breakdown', titleTemplate: 'Film Room: 3-3-5 install - personnel fits and stress points' },\n    { key: 'position_group', titleTemplate: 'Film Room: {focus} group analysis - who wins reps in fall camp' },\n    { key: 'player_mechanics', titleTemplate: 'Film Room: Player mechanics and rep winners at {focus}' },\n    { key: 'coverage_shells', titleTemplate: 'Film Room: Coverage shells and stress points on film' },\n    { key: 'run_game', titleTemplate: 'Film Room: Run game fits and OL movement' },\n    { key: 'pass_rush', titleTemplate: 'Film Room: Pass rush paths and JACK usage' },\n  ],");
  rep("server/lib/insider-articles-synthesis.js",
    "      if (llmDraft?.body) return llmDraft;",
    "      if (llmDraft?.body) return { ...llmDraft, generationSource: 'llm' };");
  rep("server/lib/insider-articles-synthesis.js",
    "  return synthesizeEliteFromContext({ articleType, title, angleKey, context, topic });",
    "  const synth = synthesizeEliteFromContext({ articleType, title, angleKey, context, topic });\n  return { ...synth, generationSource: 'synthesis' };");
  rep("server/lib/insider-articles-synthesis.js",
    "  const words = sanitize.wordCount(body);\n  return {",
    "  const words = sanitize.wordCount(body);\n  const meta = extractArticleMetadata(context, topic, {\n    articleType: payload.articleType || articleType,\n    angleKey,\n    topicKey: topic.topicKey,\n  });\n  return {");
  rep("server/lib/insider-articles-synthesis.js",
    "    angleKey,\n    classYear: topic.classYear || null,",
    "    angleKey,\n    generationSource: payload.generationSource || 'synthesis',\n    rosterUnits: meta.rosterUnits,\n    recruitingTargets: meta.recruitingTargets,\n    schemeTags: meta.schemeTags,\n    analyticsTags: meta.analyticsTags,\n    classYear: topic.classYear || null,");
}

// hub routes
if (!read("server/lib/insider-hub-routes.js").includes("getRelatedArticles")) {
  rep("server/lib/insider-hub-routes.js",
    "const contentStore = require('./content-store');",
    "const contentStore = require('./content-store');\nconst { getRelatedArticles } = require('./insider-articles-related');");
  rep("server/lib/insider-hub-routes.js",
    "function mapArticle(a, trending = false) {\n  return {\n    id: a.id,\n    category: categoryFromBadge(a.badge),\n    title: a.title,\n    preview: a.excerpt || '',\n    author: a.author || 'GatorVault Staff',\n    date: a.date || '',\n    readTime: a.readMin ?? 5,\n    trending,\n  };\n}",
    "function articleMeta(a) {\n  return {\n    id: a.id,\n    articleType: a.articleType || a.badge || '',\n    angleKey: a.angleKey || '',\n    topicKey: a.topicKey || '',\n    rosterUnits: a.rosterUnits || [],\n    recruitingTargets: a.recruitingTargets || [],\n    schemeTags: a.schemeTags || [],\n    analyticsTags: a.analyticsTags || [],\n  };\n}\n\nfunction mapArticle(a, trending = false) {\n  return {\n    id: a.id,\n    category: categoryFromBadge(a.badge),\n    title: a.title,\n    preview: a.excerpt || '',\n    author: a.author || 'GatorVault Staff',\n    date: a.date || '',\n    readTime: a.readMin ?? 5,\n    trending,\n    articleType: a.articleType || a.badge || '',\n  };\n}");
  rep("server/lib/insider-hub-routes.js",
    "  app.get('/api/insider/tags', (req, res) => {",
    "  app.get('/api/insider/articles/:id/related', (req, res) => {\n    try {\n      const feed = contentStore.getPublishedFeed();\n      const articles = feed.articles || [];\n      const current = articles.find((a) => a.id === req.params.id);\n      if (!current) return res.status(404).json({ ok: false, error: 'Article not found' });\n      const metas = articles.map(articleMeta);\n      const related = getRelatedArticles(articleMeta(current), metas, 4)\n        .map((m) => { const full = articles.find((a) => a.id === m.id); return full ? mapArticle(full) : null; })\n        .filter(Boolean);\n      return res.json({ ok: true, related, count: related.length });\n    } catch (err) {\n      return res.status(500).json({ ok: false, error: err.message });\n    }\n  });\n\n  app.get('/api/insider/tags', (req, res) => {");
}

// routes
if (!read("server/lib/insider-articles-routes.js").includes("/api/articles/engine/status")) {
  rep("server/lib/insider-articles-routes.js",
    "const engine = require('./insider-articles-engine');",
    "const engine = require('./insider-articles-engine');\nconst { engineStatus } = require('./insider-articles-config');\nconst sanitize = require('./insider-articles-sanitize');");
  rep("server/lib/insider-articles-routes.js",
    "function mountInsiderArticlesRoutes(app) {\n  app.get('/api/articles/published',",
    "function mountInsiderArticlesRoutes(app) {\n  app.get('/api/articles/engine/status', (req, res) => {\n    try {\n      return res.json({ ok: true, ...engineStatus(), pendingDrafts: store.countDraftsPending() });\n    } catch (err) {\n      return res.status(500).json({ ok: false, error: err.message });\n    }\n  });\n\n  app.get('/api/articles/published',");
  rep("server/lib/insider-articles-routes.js",
    "          body: draft.body || '',\n          createdAt: draft.createdAt,\n          byline: draft.byline || meta.byline",
    "          body: draft.body || '',\n          thesis: draft.thesis || '',\n          insiderAngles: draft.insiderAngles || [],\n          angleKey: draft.angleKey || null,\n          articleType: draft.articleType || null,\n          generationSource: draft.generationSource || null,\n          wordCount: sanitize.wordCount(draft.body || ''),\n          qualityReasons: draft.qualityReasons || [],\n          createdAt: draft.createdAt,\n          byline: draft.byline || meta.byline");
}

// server.js
if (!read("server/server.js").includes("game-week-auto")) {
  rep("server/server.js",
    "        const { generateWeeklyDrafts } = require('./lib/insider-articles-engine');\n        opsMonitor",
    "        const { generateWeeklyDrafts } = require('./lib/insider-articles-engine');\n        const { isAutoWeeklyEnabled } = require('./lib/insider-articles-config');\n        if (!isAutoWeeklyEnabled()) {\n          console.log('[insider-articles] weekly auto-generation disabled (Phase 0/1 — manual only)');\n          return;\n        }\n        opsMonitor");
  rep("server/server.js",
    "      console.log('[insider-articles] weekly scheduler enabled (every', Math.round(articleInterval / 3600000), 'h)');",
    "      console.log('[insider-articles] weekly scheduler enabled (every', Math.round(articleInterval / 3600000), 'h)');\n      try {\n        const { runGameWeekAutoPublish } = require('./lib/insider-articles-auto-publish');\n        const articleStore = require('./lib/insider-articles-store');\n        const { generateDraftForType } = require('./lib/insider-articles-engine');\n        setInterval(() => runGameWeekAutoPublish({\n          listDrafts: () => articleStore.listDrafts({ status: null }),\n          generateDraftForType,\n          approveDraft: (id) => articleStore.approveDraft(id),\n          publishToContentFeed: (d) => articleStore.publishToContentFeed(d),\n        }).then((r) => { if (r?.published) console.log('[game-week-auto] published:', r.id); }).catch((e) => console.warn('[game-week-auto]', e.message)), 3600000);\n        console.log('[game-week-auto] Monday 8 AM ET scheduler enabled');\n      } catch (e) { console.warn('[game-week-auto] failed', e.message); }");
}

console.log("done");