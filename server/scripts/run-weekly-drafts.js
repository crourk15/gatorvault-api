/**
 * One-off: run weekly insider article draft generation.
 */
const engine = require('../lib/insider-articles-engine');

engine
  .generateWeeklyDrafts({ force: true })
  .then((result) => {
    console.log(JSON.stringify({
      ok: result.ok,
      error: result.error,
      candidates: result.candidates,
      selected: result.selected,
      aborted: result.aborted,
      draftTitles: (result.drafts || []).map((d) => d.title)
    }, null, 2));
    process.exit(result.ok ? 0 : 1);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
