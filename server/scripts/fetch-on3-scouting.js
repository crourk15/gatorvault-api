#!/usr/bin/env node
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractScoutingSummary(html) {
  const idx = html.indexOf('Scouting Summary');
  if (idx === -1) return null;
  const chunk = html.slice(idx, idx + 4000);
  const text = stripHtml(chunk).replace(/^Scouting Summary\s*/i, '').trim();
  const stop = text.search(/\b(Recent Articles|Latest News|Timeline|Videos)\b/i);
  return (stop > 80 ? text.slice(0, stop) : text).trim();
}

async function fetchSummary(slug, on3Id) {
  const url = `https://www.on3.com/rivals/${slug}-${on3Id}/`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GatorVaultSeed/1.0)' }
  });
  if (!res.ok) return { url, error: `HTTP ${res.status}` };
  const html = await res.text();
  const summary = extractScoutingSummary(html);
  const nameMatch = html.match(/<h1[^>]*>([^<]+)</i) || html.match(/"name":"([^"]+)"/);
  return {
    url,
    name: nameMatch ? stripHtml(nameMatch[1]) : slug,
    summary: summary || null
  };
}

async function main() {
  const playersPath = path.join(__dirname, '..', 'data', 'recruiting', 'players.json');
  const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
  const targets = players.filter(
    (p) => p.committedTo === 'Florida' && p.on3Id && (p.category === 'recruit' || p.category === 'portal' || !p.category)
  );

  const out = [];
  for (const p of targets.slice(0, 25)) {
    process.stderr.write(`fetch ${p.slug}...\n`);
    try {
      const result = await fetchSummary(p.slug, p.on3Id);
      out.push({ ...p, ...result });
      await new Promise((r) => setTimeout(r, 400));
    } catch (e) {
      out.push({ slug: p.slug, error: e.message });
    }
  }
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
