const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const store = require(path.join(__dirname, "..", "lib", "recruiting-store"));
const snapshot = require(path.join(__dirname, "..", "data", "recruiting", "on3-snapshot.json"));
function buildSkinny(p) {
  return [p.pos, p.stars ? String(p.stars) + " star" : null, p.school].filter(Boolean).join(" · ");
}
(async () => {
  const commits = Object.values(snapshot.years["2027"].commits || {});
  for (const p of commits) {
    const slug = store.slugify(p.name);
    const existing = await store.getPlayerBySlug(slug);
    await store.upsertPlayer({
      ...(existing || {}),
      slug,
      name: p.name,
      pos: p.pos,
      classYear: 2027,
      school: p.school,
      htWt: p.htWt,
      stars: p.stars,
      rating: p.rating,
      natlRank: p.natlRank,
      posRank: p.posRank,
      stateRank: p.stateRank,
      inState: p.inState,
      category: "recruit",
      status: "committed",
      committedTo: "Florida",
      protected: true,
      commitDate: p.commitDate || existing?.commitDate || null,
      on3Id: p.on3Id,
      on3ProfileUrl: p.on3Id ? "https://www.on3.com/rivals/" + slug + "-" + p.on3Id + "/" : existing?.on3ProfileUrl,
      on3Source: "on3-board-sync",
      skinny: buildSkinny(p),
      updatedAt: new Date().toISOString(),
    });
  }
  const hub = await store.getHubCommits(2027);
  console.log("hub commits:", hub.length);
})();
