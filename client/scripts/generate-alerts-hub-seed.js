#!/usr/bin/env node
/**
 * Bake FutureCast alerts seed so /vault/alerts/ never cold-loads into "Loading alerts…".
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const OUT = path.join(__dirname, '../lib/alerts-hub-seed.json');
const API = process.env.ALERTS_SEED_API || 'https://gatorvault-api.onrender.com';

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

function slim(a) {
  if (!a || !(a.id || a.message)) return null;
  return {
    id: a.id,
    playerId: a.playerId || '',
    playerName: a.playerName || 'UF Target',
    playerSlug: a.playerSlug || '',
    type: a.type || 'update',
    message: String(a.message || '').trim(),
    lifecycle: a.lifecycle ?? null,
    createdAt: a.createdAt || new Date().toISOString(),
    seen: Boolean(a.seen),
    category: a.category || undefined,
  };
}

function retainPrevious() {
  try { return JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch { return null; }
}

async function main() {
  let alerts = [];
  let source = 'empty';
  for (let i = 0; i < 3; i += 1) {
    try {
      const data = await fetchJson(API + '/api/futurecast/alerts?limit=30');
      alerts = (data.alerts || []).map(slim).filter(Boolean).slice(0, 24);
      if (alerts.length) { source = 'prod-api'; break; }
    } catch (err) {
      console.warn('[generate-alerts-hub-seed] fetch failed:', err.message);
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  const prev = retainPrevious();
  if (!alerts.length && prev?.alerts?.length) {
    alerts = prev.alerts;
    source = 'retained-previous';
  }
  const seed = { generatedAt: new Date().toISOString(), source, alerts };
  fs.writeFileSync(OUT, JSON.stringify(seed, null, 2) + '\n');
  console.log('[generate-alerts-hub-seed] wrote', OUT, 'source=', source, 'alerts=', alerts.length);
}

main().catch((err) => { console.error('[generate-alerts-hub-seed] FATAL', err); process.exit(1); });
