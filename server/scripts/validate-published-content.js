/**
 * Validate all published articles/storylines against official-names.json.
 * Run: node scripts/validate-published-content.js
 */
const { ensurePublishedSeed, loadPublishedArticles, loadPublishedStorylines } = require('../lib/content-store');
const { validateContentItem, resolveTokens, loadOfficialNames } = require('../lib/content-validator');

ensurePublishedSeed();
const official = loadOfficialNames();
const articles = loadPublishedArticles();
const storylines = loadPublishedStorylines();
let failed = 0;

function checkItem(item, label) {
  const result = validateContentItem(item, official);
  const scToken = resolveTokens('{{ staff.SC }}', official);
  const dbToken = resolveTokens('{{ coach.DB }}', official);
  console.log(`\n[${label}] ${item.title || item.id}`);
  console.log(`  {{ staff.SC }} → ${scToken}`);
  console.log(`  {{ coach.DB }} → ${dbToken}`);
  if (!result.valid) {
    failed++;
    result.errors.forEach((e) => console.log(`  ✗ ${e.message}`));
  } else {
    console.log('  ✓ validation passed');
  }
}

console.log('S&C coach:', official.staff?.SC?.name);
console.log('DBs coach:', official.coaches?.DB?.name);

articles.forEach((a) => checkItem(a, 'article'));
storylines.forEach((s) => checkItem(s, 'storyline'));

if (failed) {
  console.error(`\n${failed} item(s) failed validation.`);
  process.exit(1);
}
console.log('\nAll published content passed validation.');
