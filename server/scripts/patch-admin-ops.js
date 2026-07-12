const fs = require("fs");
function rep(f, old, neu) {
  let s = fs.readFileSync(f, "utf8");
  if (!s.includes(old)) { console.log("SKIP", f); return; }
  fs.writeFileSync(f, s.replace(old, neu), "utf8");
  console.log("OK", f);
}
rep("server/admin-ops.html",
  '<button id="insider-reload" class="secondary sm">Reload</button>\n        </div>',
  '<button id="insider-reload" class="secondary sm">Reload</button>\n        </div>\n        <div id="insider-engine-status" class="meta" style="margin-bottom:.75rem;font-size:.75rem">Engine: loading…</div>');
rep("server/admin-ops.html",
  "if(!drafts||!drafts.length){tbody.innerHTML='<tr><td colspan=\"6\" class=\"meta\">No drafts pending approval.</td></tr>';return;}",
  "if(!drafts||!drafts.length){tbody.innerHTML='<tr><td colspan=\"8\" class=\"meta\">No drafts pending approval.</td></tr>';return;}");
rep("server/admin-ops.html",
  "'<td>'+esc(insiderCategoryLabel(d.category))+'</td>'+\n          '<td>'+fmtTime(d.createdAt)+'</td>'+",
  "'<td>'+esc(insiderCategoryLabel(d.category))+'</td>'+\n          '<td class=\"meta\">'+esc(d.articleType||'—')+'</td>'+\n          '<td class=\"meta\">'+esc(d.angleKey||'—')+'</td>'+\n          '<td>'+fmtTime(d.createdAt)+'</td>'+");
rep("server/admin-ops.html",
  "'<td class=\"meta\">'+esc(insiderSourcesLabel(d.sources))+'</td>'+",
  "'<td class=\"meta\">'+esc(d.generationSource||'synthesis')+'</td>'+");
rep("server/admin-ops.html",
  "'<td>'+esc(insiderCategoryLabel(a.category))+'</td>'+\n          '<td>'+fmtTime(a.publishedAt)+'</td>'+",
  "'<td>'+esc(insiderCategoryLabel(a.category))+'</td>'+\n          '<td class=\"meta\">'+esc(a.articleType||a.badge||'—')+'</td>'+\n          '<td>'+fmtTime(a.publishedAt)+'</td>'+");
rep("server/admin-ops.html",
  "'<td class=\"meta\">'+esc(insiderSourcesLabel(a.sources))+'</td>'+\n          '<td><button class=\"sm\" data-refresh=\"'+esc(a.id)+'\">Refresh</button> '",
  "'<td class=\"meta\">'+esc(a.generationSource||'synthesis')+'</td>'+\n          '<td><button class=\"sm\" data-refresh=\"'+esc(a.id)+'\">Refresh</button> '");
rep("server/admin-ops.html",
  "function loadInsiderArticles(){\n      var p=pin();",
  "function loadInsiderEngineStatus(){\n      fetch(API+'/api/articles/engine/status').then(function(r){return r.json();}).then(function(st){\n        var el=document.getElementById('insider-engine-status');\n        if(!el||!st.ok)return;\n        el.textContent='Phase '+st.phase+' · LLM '+(st.llmAllowed?'on':'off')+' · Auto-weekly '+(st.autoWeekly?'on':'off')+' · Game Week auto-publish '+(st.gameWeekAutoPublish?'on':'off')+' · Pending drafts '+st.pendingDrafts;\n      }).catch(function(){});\n    }\n    function loadInsiderArticles(){\n      loadInsiderEngineStatus();\n      var p=pin();");