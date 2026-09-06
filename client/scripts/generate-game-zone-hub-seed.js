#!/usr/bin/env node
/**
 * Bake Game Zone next-game seed so /vault/game-zone/ never sticks on "Loading Swamp Eve…".
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(__dirname, '../lib/game-zone-hub-seed.json');
const API = process.env.GAME_ZONE_SEED_API || 'https://gatorvault-api.onrender.com';
const { pickNextGame, getBettingLines } = require(path.join(ROOT, 'server/lib/betting-lines'));

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

function localLines() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'server/data/betting/lines.json'), 'utf8'));
  } catch { return null; }
}

async function main() {
  let nextGame = null;
  let source = 'empty';
  for (let i = 0; i < 3; i += 1) {
    try {
      const data = await fetchJson(API + '/api/betting/lines');
      nextGame = pickNextGame(data.schedule || [], new Date()) || data.nextGame || null;
      const kick = nextGame ? Date.parse(nextGame.date || nextGame.kickoff || '') : NaN;
      if (Number.isFinite(kick) && kick + 5 * 3600 * 1000 < Date.now()) nextGame = null;
      if (nextGame) { source = 'prod-api'; break; }
    } catch (err) {
      console.warn('[generate-game-zone-hub-seed] fetch failed:', err.message);
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  if (!nextGame) {
    try {
      const localLive = await getBettingLines(new Date());
      nextGame = localLive.nextGame || null;
      if (nextGame) source = 'local-picker';
    } catch {
      /* keep looking */
    }
  }
  if (!nextGame) {
    const local = localLines();
    nextGame = pickNextGame((local && local.schedule) || [], new Date()) || (local && local.nextGame) || null;
    if (nextGame) source = 'local-lines';
  }
  const prev = retainPrevious();
  if (!nextGame && prev && prev.nextGame) {
    nextGame = prev.nextGame;
    source = 'retained-previous';
  }
  const seed = { generatedAt: new Date().toISOString(), source, nextGame };
  fs.writeFileSync(OUT, JSON.stringify(seed, null, 2) + '\n');
  console.log('[generate-game-zone-hub-seed] wrote', OUT, 'source=', source, 'nextGame=', Boolean(nextGame));
}

main().catch((err) => { console.error('[generate-game-zone-hub-seed] FATAL', err); process.exit(1); });
