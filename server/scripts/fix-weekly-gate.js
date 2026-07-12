const fs = require("fs");
let s = fs.readFileSync("server/server.js", "utf8");
if (s.includes("isAutoWeeklyEnabled")) {
  console.log("exists");
  process.exit(0);
}
const old = "const { generateWeeklyDrafts } = require('./lib/insider-articles-engine');";
const neu = old + "\n        const { isAutoWeeklyEnabled } = require('./lib/insider-articles-config');\n        if (!isAutoWeeklyEnabled()) {\n          console.log('[insider-articles] weekly auto-generation disabled (Phase 0/1 — manual only)');\n          return;\n        }";
s = s.replace(old + "\n        opsMonitor", neu + "\n        opsMonitor");
fs.writeFileSync("server/server.js", s, "utf8");
console.log("gate added");