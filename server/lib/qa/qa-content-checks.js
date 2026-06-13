/**
 * Spell / grammar heuristics for published content.
 */
const fs = require('fs');
const path = require('path');
const config = require('./qa-config');
const { check, fetchJson, moduleResult } = require('./qa-utils');

const COMMON_MISSPELLINGS = [
  [/\\brecieve\\b/gi, 'receive'],
  [/\\boccured\\b/gi, 'occurred'],
  [/\\bseperate\\b/gi, 'separate'],
  [/\\bdefinately\\b/gi, 'definitely'],
  [/\\btransfered\\b/gi, 'transferred'],
  [/\\bcommitment\\s+to\\s+to\\b/gi, 'commitment to'],
  [/\\bthe\\s+the\\b/gi, 'the'],
  [/\\band\\s+and\\b/gi, 'and'],
  [/\\b  +/g, ' ']
];

const REPEATED_WORD = /\\b(\\w+)\\s+\\1\\b/gi;

function scanText(text, context) {
  const issues = [];
  const src = String(text || '');
  if (!src.trim()) return issues;

  COMMON_MISSPELLINGS.forEach(([re, fix]) => {
    if (re.test(src)) issues.push({ type: 'spelling', context, message: `Possible typo (expected "${fix}")`, sample: src.match(re)?.[0] });
    re.lastIndex = 0;
  });

  let m;
  while ((m = REPEATED_WORD.exec(src))) {
    issues.push({ type: 'grammar', context, message: `Repeated word "${m[1]}"` });
  }

  if (/\\.{4,}/.test(src)) issues.push({ type: 'grammar', context, message: 'Excessive ellipsis' });
  if (/[a-z][.!?]\\s+[a-z]/.test(src)) {
    issues.push({ type: 'grammar', context, message: 'Sentence may not start with capital letter' });
  }

  return issues;
}

function loadTeamModuleText() {
  const paths = [
    path.join(__dirname, '..', '..', 'vault', 'team', 'index.html'),
    path.join(__dirname, '..', '..', '..', 'client', 'components', 'vault', 'VaultTeamPage.tsx')
  ];
  for (const p of paths) {
    try {
      return fs.readFileSync(p, 'utf8');
    } catch {
      /* try next */
    }
  }
  return '';
}

async function runContentChecks() {
  const checks = [];

  // Articles
  checks.push(
    await check('content:articles-spell', 'content', 'Articles spell/grammar', async () => {
      const { body } = await fetchJson(`${config.API_URL}/api/articles/published`);
      const articles = body.articles || body.items || [];
      const issues = [];
      articles.slice(0, 40).forEach((a) => {
        const fields = [a.title, a.excerpt, a.dek, a.body, a.summary].filter(Boolean).join(' ');
        scanText(fields, `article:${a.id || a.title}`).forEach((i) => issues.push(i));
      });
      if (issues.length) {
        const err = new Error(`${issues.length} article text issue(s)`);
        err.details = issues.slice(0, 10);
        err.repro = 'Review articles in admin; fix spelling/grammar flagged in QA dashboard';
        throw err;
      }
      return { scanned: Math.min(articles.length, 40) };
    })
  );

  // Content accuracy articles
  checks.push(
    await check('content:content-accuracy-spell', 'content', 'Content accuracy spell/grammar', async () => {
      const { body } = await fetchJson(`${config.API_URL}/api/content/published`);
      const articles = body.articles || body.items || [];
      const issues = [];
      articles.slice(0, 30).forEach((a) => {
        const fields = [a.title, a.excerpt, a.body].filter(Boolean).join(' ');
        scanText(fields, `content:${a.id || a.title}`).forEach((i) => issues.push(i));
      });
      if (issues.length) {
        const err = new Error(`${issues.length} content accuracy text issue(s)`);
        err.details = issues.slice(0, 10);
        throw err;
      }
      return { scanned: Math.min(articles.length, 30) };
    })
  );

  // Film Room lessons
  checks.push(
    await check('content:film-room-spell', 'content', 'Film Room lesson text', async () => {
      const { body } = await fetchJson(`${config.API_URL}/api/film-room/catalog`);
      const lessons = (body.items || []).filter((i) => i.knowledgeEngine || i.noVideo);
      const issues = [];
      for (const lesson of lessons.slice(0, 15)) {
        const slug = lesson.slug || lesson.id;
        let text = [lesson.title, lesson.dek, lesson.summary, lesson.body].filter(Boolean).join(' ');
        try {
          const detail = await fetchJson(`${config.API_URL}/api/film-room/lesson/${encodeURIComponent(slug)}`);
          text += ' ' + (detail.body?.body || '');
        } catch {
          /* catalog-only fallback */
        }
        scanText(text, `film:${slug}`).forEach((i) => issues.push(i));
      }
      if (issues.length) {
        const err = new Error(`${issues.length} Film Room text issue(s)`);
        err.details = issues.slice(0, 10);
        throw err;
      }
      return { scanned: Math.min(lessons.length, 15) };
    })
  );

  // React Team page copy
  checks.push(
    await check('content:team-module', 'content', 'Team page text markers', async () => {
      const src = loadTeamModuleText();
      if (!src) throw new Error('React Team page export not readable');
      const required = ['vault-team', 'Full Roster', 'Depth Chart', 'Team'];
      const missing = required.filter((k) => !src.includes(k));
      if (missing.length) throw new Error(`Team page missing: ${missing.join(', ')}`);
      const issues = scanText(src.slice(0, 50000), 'team-page');
      if (issues.length > 8) {
        const err = new Error(`${issues.length} team page text issues`);
        err.details = issues.slice(0, 8);
        throw err;
      }
      return { ok: true };
    })
  );

  return moduleResult('content', checks);
}

module.exports = { runContentChecks, scanText };
