#!/usr/bin/env node
const fetch = require('node-fetch');
const url = process.argv[2] || 'https://www.on3.com/college/florida-gators/expert-predictions/football/2027/';
fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  .then((r) => r.text())
  .then((html) => {
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) {
      console.log('no __NEXT_DATA__');
      return;
    }
    const pp = JSON.parse(m[1])?.props?.pageProps || {};
    console.log('keys:', Object.keys(pp));
    for (const k of Object.keys(pp)) {
      const v = pp[k];
      if (Array.isArray(v) && v.length) {
        console.log('array', k, 'len', v.length, JSON.stringify(v[0], null, 2).slice(0, 600));
      } else if (v && typeof v === 'object' && Array.isArray(v.list)) {
        console.log('list', k, 'len', v.list.length, JSON.stringify(v.list[0], null, 2).slice(0, 800));
      }
    }
  })
  .catch((e) => console.error(e.message));
