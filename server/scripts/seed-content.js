/**
 * Re-seed published articles/storylines from index.html static arrays.
 * Run on Render/local: node scripts/seed-content.js
 */
const { seedFromIndexHtml, ensurePublishedSeed } = require('../lib/content-store');

seedFromIndexHtml();
ensurePublishedSeed();
console.log('Published content seeded from index.html → data/content/articles.json & storylines.json');
