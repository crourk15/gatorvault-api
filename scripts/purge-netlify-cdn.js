/**
 * Purge Netlify CDN cache (full site or by cache tags).
 *
 * Requires:
 *   NETLIFY_AUTH_TOKEN — personal access token with cache purge scope
 *   NETLIFY_SITE_ID or NETLIFY_SITE_SLUG — target site (default: stupendous-paprenjak-bedb92)
 *
 * Usage:
 *   node scripts/purge-netlify-cdn.js
 *   node scripts/purge-netlify-cdn.js --tags vault,css
 */
const fs = require('fs');
const path = require('path');

function loadEnvFile(relPath) {
  const file = path.join(__dirname, '..', relPath);
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile('server/.env');
loadEnvFile('.env');

const token = process.env.NETLIFY_AUTH_TOKEN;
const siteId = process.env.NETLIFY_SITE_ID;
const siteSlug = process.env.NETLIFY_SITE_SLUG || 'stupendous-paprenjak-bedb92';

const tagArg = process.argv.find((arg) => arg.startsWith('--tags='));
const cacheTags = tagArg
  ? tagArg
      .slice('--tags='.length)
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
  : null;

if (!token) {
  console.error('Missing NETLIFY_AUTH_TOKEN — set in server/.env or environment.');
  process.exit(1);
}

const body = siteId ? { site_id: siteId } : { site_slug: siteSlug };
if (cacheTags && cacheTags.length) body.cache_tags = cacheTags;

async function main() {
  const res = await fetch('https://api.netlify.com/api/v1/purge', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let payload = text;
  try {
    payload = JSON.parse(text);
  } catch {
    /* keep raw text */
  }

  if (!res.ok) {
    console.error(`Netlify CDN purge failed (${res.status})`, payload);
    process.exit(1);
  }

  console.log(`Netlify CDN purge accepted (${res.status})`, payload);
  console.log('Target:', siteId ? `site_id=${siteId}` : `site_slug=${siteSlug}`);
  if (cacheTags?.length) console.log('Cache tags:', cacheTags.join(', '));
  else console.log('Scope: full site CDN purge');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
