#!/usr/bin/env node
const fetch = require('node-fetch');
const fs = require('fs');

async function main() {
  const slug = process.argv[2] || 'maxwell-hiller-180637';
  const url = `https://www.on3.com/rivals/${slug}/`;
  const html = await (await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
  const start = html.indexOf('__NEXT_DATA__');
  const jsonStart = html.indexOf('>', start) + 1;
  const jsonEnd = html.indexOf('</script>', jsonStart);
  const data = JSON.parse(html.slice(jsonStart, jsonEnd));
  const flat = JSON.stringify(data);
  const keys = ['scouting', 'Scouting', 'evaluation', 'report', 'summary', 'strength', 'weakness'];
  for (const k of keys) {
    if (flat.toLowerCase().includes(k.toLowerCase())) console.log('has', k);
  }
  // walk for scoutingSummary
  function walk(o, path = '') {
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      const p = path + '.' + k;
      if (/scout|evaluation|report|strength|weakness|comparison/i.test(k) && typeof v === 'string' && v.length > 40) {
        console.log('\n---', p, '---\n', v.slice(0, 500));
      }
      if (typeof v === 'object') walk(v, p);
    }
  }
  walk(data);
}

main().catch(console.error);
