#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const key = process.env.RENDER_API_KEY;
if (!key) {
  console.error('Missing RENDER_API_KEY');
  process.exit(1);
}
const SERVICE_ID = 'srv-d8i0t4btqb8s73akkbj0';
const headers = { Authorization: `Bearer ${key}`, Accept: 'application/json' };

async function main() {
  const deployId = process.argv[2];
  if (deployId) {
    const res = await fetch(`https://api.render.com/v1/deploys/${deployId}`, { headers });
    const body = await res.json();
    console.log(JSON.stringify(body.deploy || body, null, 2));
    return;
  }
  const res = await fetch(`https://api.render.com/v1/services/${SERVICE_ID}/deploys?limit=5`, { headers });
  const rows = await res.json();
  for (const row of rows || []) {
    const d = row.deploy || row;
    console.log([d.id, d.status, d.commit?.id?.slice(0, 7), d.createdAt, d.finishedAt || ''].join(' | '));
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
