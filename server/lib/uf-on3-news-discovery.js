/**
 * UF On3 team news discovery — proactive prospect surfacing from public article feed.
 * Reads florida-gators/news list (slug + excerpt) without On3+ login.
 */
const fs = require('fs');
const path = require('path');
const on3Recruit = require('./on3-recruit-client');
const { parseOn3NewsArticleSlug } = require('./on3-recruit-discovery');
const store = require('./recruiting-store');
const intelStore = require('./recruiting-intel-store');
const { getAllowlistSet } = require('./recruiting-target-allowlist');
const { enterPlayerIntel } = require('./player-intel-entry');

const NEWS_URL = `${on3Recruit.SITE}/teams/florida-gators/news/`;
const SNAPSHOT_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'uf-on3-news-discovery-snapshot.json');
const RECRUITING_CATEGORY_RE = /recruiting|football-recruiting/i;

function readSnapshot() {
  try {
    return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  } catch {
    return { version: 1, fingerprints: {}, lastRun: null };
  }
}

function writeSnapshot(doc) {
  doc.lastRun = new Date().toISOString();
  fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
  fs.writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(doc, null, 2)}\n`);
}

function articleFullUrl(article) {
  const raw = article?.fullUrl || article?.slug || '';
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/$/, '') + '/';
  const pathPart = raw.startsWith('/') ? raw : `/${raw}`;
  return `${on3Recruit.SITE}${pathPart}`.replace(/\/$/, '') + '/';
}

function parseClassYearFromText(text) {
  const m = String(text || '').match(/\b(202[7-9]|203[0-2])\b/);
  return m ? parseInt(m[1], 10) : null;
}

function parseNameFromArticleBody(article) {
  const text = `${article?.title || ''} ${article?.excerpt || ''} ${article?.body || ''}`;
  const patterns = [
    /\b(?:[A-Z][a-z'.-]+(?:\s+[A-Z][a-z'.-]+){0,2})\s+is\s+still\b/,
    /\b(?:\d+-star\s+)?(?:wide receiver|running back|quarterback|tight end|linebacker|defensive end|cornerback|safety|athlete|edge)\s+([A-Z][a-z'.-]+(?:\s+[A-Z][a-z'.-]+){0,2})\b/i,
    /\b(?:WR|QB|RB|TE|EDGE|LB|CB|S|ATH|DL|OL)\s+([A-Z][a-z'.-]+(?:\s+[A-Z][a-z'.-]+){0,2})\b/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    const name = (m?.[1] || m?.[0] || '').trim();
    if (name && name.split(/\s+/).length >= 2) return name;
  }
  return null;
}

function parseArticleIdentity(article) {
  const slugPath = String(article?.slug || '').trim();
  const fromSlug = slugPath ? parseOn3NewsArticleSlug(slugPath) : null;
  const url = articleFullUrl(article);
  const textBlob = `${article?.title || ''} ${article?.excerpt || ''} ${article?.body || ''}`;
  const classYear = fromSlug?.classYear || parseClassYearFromText(textBlob) || null;

  if (fromSlug) {
    return {
      ...fromSlug,
      classYear: classYear || fromSlug.classYear,
      on3ArticleUrl: url,
      articleKey: article?.key || slugPath,
      source: 'on3_team_news_slug',
    };
  }

  return null;
}

function isRecruitingArticle(article, identity) {
  if (identity?.playerSlug) return true;
  const cat = article?.primaryCategory?.slug || article?.primaryCategory?.name || '';
  if (RECRUITING_CATEGORY_RE.test(cat)) return Boolean(identity);
  return false;
}

function needsProspectProvision(existing, classYear) {
  const year = parseInt(classYear, 10);
  if (!Number.isFinite(year) || year < 2027 || year > 2030) return false;
  if (!existing) return true;
  const slug = String(existing.slug || '').toLowerCase();
  if (!existing.on3Id && !existing.on3Slug) return true;
  if (!existing.stars && !existing.natlRank) return true;
  if (year === 2028 && slug && !getAllowlistSet(2028).has(slug)) return true;
  return false;
}

async function fetchFloridaTeamNewsArticles() {
  const pageProps = await on3Recruit.fetchNextPageProps(NEWS_URL, 2028);
  const raw = pageProps?.articles?.list || pageProps?.articles || [];
  return Array.isArray(raw) ? raw : [];
}

async function runUfOn3NewsDiscovery({ classYear = 2028, force = false, dryRun = false, maxArticles = 30 } = {}) {
  const snapshot = readSnapshot();
  const results = { scanned: 0, provisioned: [], intel: [], skipped: [], errors: [] };

  let articles = [];
  try {
    articles = await fetchFloridaTeamNewsArticles();
  } catch (err) {
    return { ok: false, error: err.message, ...results };
  }

  const sorted = [...articles]
    .sort((a, b) => new Date(b.postDateGMT || b.postDate || 0) - new Date(a.postDateGMT || a.postDate || 0))
    .slice(0, Math.max(1, maxArticles));

  for (const article of sorted) {
    results.scanned += 1;
    const identity = parseArticleIdentity(article);
    if (!identity?.playerSlug || !isRecruitingArticle(article, identity)) {
      results.skipped.push({ reason: 'no_recruiting_identity', title: article?.title });
      continue;
    }

    const fp = String(identity.articleKey || identity.playerSlug);
    if (!force && snapshot.fingerprints[fp]) {
      results.skipped.push({ reason: 'snapshot', slug: identity.playerSlug });
      continue;
    }

    const year = identity.classYear || classYear;
    const existing = await store.getPlayerBySlug(identity.playerSlug);
    const author = article?.author?.name || 'On3 / Gators Online';
    const detail =
      String(article?.excerpt || article?.title || '').trim() ||
      `${identity.playerName} — Florida recruiting intel via On3 team news.`;

    try {
      if (needsProspectProvision(existing, year)) {
        if (dryRun) {
          results.provisioned.push({ slug: identity.playerSlug, dryRun: true });
        } else {
          const provision = await enterPlayerIntel({
            name: identity.playerName,
            classYear: year,
            offer: false,
            rebuildSnapshots: false,
          });
          results.provisioned.push({ slug: provision.slug, ok: provision.ok !== false });
        }
      }

      const intelFp = `on3_news_${fp}_${identity.playerSlug}`;
      if (!dryRun && !intelStore.hasIntelFingerprint(intelFp)) {
        await intelStore.initIntelStore();
        const player = (await store.getPlayerBySlug(identity.playerSlug)) || existing || {};
        const intel = await intelStore.addIntel({
          playerId: player.on3Id || identity.playerSlug,
          playerSlug: identity.playerSlug,
          playerName: identity.playerName,
          classYear: year,
          pos: identity.pos || player.pos,
          school: player.school,
          eventType: 'target_update',
          status: 'Trending · Florida',
          detail,
          text: detail.slice(0, 280),
          timestamp: article.postDateGMT || article.postDate || new Date().toISOString(),
          reportedAt: article.postDateGMT || article.postDate || new Date().toISOString(),
          source: 'auto:on3-team-news',
          sourceHandle: article?.author?.niceName || null,
          analystName: author,
          sourceType: 'beat',
          ufRelevant: true,
          identityConfirmed: true,
          articleUrl: identity.on3ArticleUrl,
          fingerprint: intelFp,
        });
        results.intel.push({
          slug: identity.playerSlug,
          created: intel.created,
          skipped: intel.skipped,
        });
      }

      if (!dryRun) snapshot.fingerprints[fp] = new Date().toISOString();
    } catch (err) {
      results.errors.push({ slug: identity.playerSlug, error: err.message });
    }
  }

  if (!dryRun) writeSnapshot(snapshot);

  return {
    ok: true,
    articleCount: articles.length,
    ...results,
    provisionedCount: results.provisioned.length,
    intelCount: results.intel.filter((i) => i.created).length,
    lastRun: snapshot.lastRun,
  };
}

module.exports = {
  NEWS_URL,
  SNAPSHOT_PATH,
  parseArticleIdentity,
  fetchFloridaTeamNewsArticles,
  runUfOn3NewsDiscovery,
};