const fs = require("fs");
const { execSync } = require("child_process");
function rep(f, old, neu) {
  let s = fs.readFileSync(f, "utf8");
  if (!s.includes(old)) { console.log("skip", f); return; }
  fs.writeFileSync(f, s.replace(old, neu), "utf8");
  console.log("ok", f);
}
rep("server/server.js",
  "        const { generateWeeklyDrafts } = require('./lib/insider-articles-engine');\n        opsMonitor",
  "        const { generateWeeklyDrafts } = require('./lib/insider-articles-engine');\n        const { isAutoWeeklyEnabled } = require('./lib/insider-articles-config');\n        if (!isAutoWeeklyEnabled()) {\n          console.log('[insider-articles] weekly auto-generation disabled (Phase 0/1 — manual only)');\n          return;\n        }\n        opsMonitor");
let api = execSync("git show HEAD:client/lib/insider-api.ts", { encoding: "utf8" });
if (!api.includes("fetchInsiderRelated")) {
  api = api.replace(
    "export async function fetchInsiderHubBundle(): Promise<{",
    "export async function fetchInsiderRelated(articleId: string): Promise<InsiderArticle[]> {\n  const remote = await tryInsiderFetch<{ related?: InsiderArticle[] }>(`/api/insider/articles/${articleId}/related`);\n  if (remote?.related?.length) return remote.related;\n  const articles = await fetchInsiderArticles();\n  const current = articles.find((a) => a.id === articleId);\n  if (!current) return [];\n  return articles.filter((a) => a.id !== articleId && a.category === current.category).slice(0, 4);\n}\n\nexport async function fetchInsiderHubBundle(): Promise<{"
  );
  fs.writeFileSync("client/lib/insider-api.ts", api, "utf8");
  console.log("api patched");
}
let s = fs.readFileSync("server/server.js", "utf8");
if (!s.includes("mountAnalyticsRoutes")) {
  s = s.replace(
    "require('./lib/insider-hub-routes').mountInsiderHubRoutes(app);",
    "require('./lib/insider-hub-routes').mountInsiderHubRoutes(app);\nrequire('./lib/insider-analytics-engine').mountAnalyticsRoutes(app);"
  );
  fs.writeFileSync("server/server.js", s, "utf8");
  console.log("analytics mounted");
}