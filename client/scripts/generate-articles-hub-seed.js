#!/usr/bin/env node
/**
 * Bake Insider articles seed so /vault/articles/ never sticks on "Loading Insider articles…".
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(__dirname, '../lib/articles-hub-seed.json');
const API = process.env.ARTICLES_SEED_API || 'https://gatorvault-api.onrender.com';

function fetchJson(url, timeoutMs = 35000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error('HTTP ' + res.statusCode));
          return;
        }
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function retainPrevious() {
  try { return JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch { return null; }
}

function mapLocal(a) {
  return {
    id: a.id,
    category: a.badge || a.category || 'Insider',
    title: a.title || 'Insider',
    preview: a.excerpt || a.preview || '',
    author: a.author || 'GatorVault Staff',
    date: a.date || '',
    readTime: a.readMin != null ? a.readMin : (a.readTime != null ? a.readTime : 5),
    trending: Boolean(a.trending),
  };
}

function localArticles() {
  try {
    const rows = JSON.parse(fs.readFileSync(path.join(ROOT, 'server/data/content/articles.json'), 'utf8'));
    return (Array.isArray(rows) ? rows : []).map(mapLocal).filter((a) => a.id && a.title);
  } catch { return []; }
}

async function main() {
  let articles = [];
  let source = 'local-articles';
  for (let i = 0; i < 3; i += 1) {
    try {
      const data = await fetchJson(API + '/api/articles/published?limit=24');
      articles = (data.articles || []).map((a) => ({
        id: a.id,
        category: a.badge || a.category || 'Insider',
        title: a.title,
        preview: a.excerpt || '',
        author: a.author || 'GatorVault Staff',
        date: a.date || '',
        readTime: a.readMin != null ? a.readMin : 5,
        trending: Boolean(a.trending),
      })).filter((a) => a.id && a.title);
      if (articles.length) { source = 'prod-api'; break; }
    } catch (err) {
      console.warn('[generate-articles-hub-seed] fetch failed:', err.message);
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  if (!articles.length) articles = localArticles();
  const prev = retainPrevious();
  if (!articles.length && prev && prev.articles && prev.articles.length) {
    articles = prev.articles;
    source = 'retained-previous';
  }
  const seed = {
    generatedAt: new Date().toISOString(),
    source,
    articles: articles.slice(0, 24),
    featured: articles[0] || null,
    storylines: [],
    authors: [],
    heatIndex: [],
    tags: [],
  };
  fs.writeFileSync(OUT, JSON.stringify(seed, null, 2) + '\n');
  console.log('[generate-articles-hub-seed] wrote', OUT, 'source=', source, 'articles=', seed.articles.length);
}

main().catch((err) => { console.error('[generate-articles-hub-seed] FATAL', err); process.exit(1); });
