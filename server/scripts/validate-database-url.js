#!/usr/bin/env node
/**
 * Validate DATABASE_URL structure (local .env or Render) without printing secrets.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

function diagnose(label, url) {
  if (!url || typeof url !== 'string') {
    console.log(`${label}: missing`);
    return false;
  }
  const trimmed = url.trim();
  const issues = [];
  if (trimmed !== url) issues.push('has leading/trailing whitespace');
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) issues.push('wrapped in quotes — remove them');
  if (/\s/.test(trimmed)) issues.push('contains whitespace/newlines');
  if (!/^postgres(ql)?:\/\//i.test(trimmed)) issues.push('must start with postgresql://');
  if (!/@/.test(trimmed)) issues.push('missing @ host separator');
  const host = trimmed.match(/@([^:/]+)/)?.[1] || '';
  if (host && !/pooler\.supabase\.com|supabase\.co|supabase\.com/.test(host)) {
    issues.push(`unexpected host: ${host}`);
  }
  const port = trimmed.match(/:(\d+)\//)?.[1];
  if (port && port !== '6543' && /pooler/.test(host)) {
    issues.push(`pooler host but port is ${port} (expected 6543 for shared pooler)`);
  }
  try {
    // eslint-disable-next-line no-new
    new URL(trimmed.replace(/^postgresql:/, 'http:'));
  } catch {
    issues.push('not parseable as URL — URL-encode special characters in password (@ # % etc.)');
  }
  console.log(`${label}: ${trimmed.length} chars, pooler: ${/pooler|6543/.test(trimmed)}`);
  if (issues.length) {
    console.log('  issues:', issues.join('; '));
    return false;
  }
  console.log('  looks OK');
  return true;
}

async function fetchRenderUrl() {
  const key = process.env.RENDER_API_KEY;
  if (!key) return null;
  const API = 'https://api.render.com/v1';
  const headers = { Authorization: `Bearer ${key}`, Accept: 'application/json' };
  const rows = await fetch(`${API}/services?name=gatorvault-api&limit=20`, { headers }).then((r) => r.json());
  const svc = (rows || []).find((r) => (r.service || r).name === 'gatorvault-api');
  if (!svc) return null;
  const id = (svc.service || svc).id;
  const env = await fetch(`${API}/services/${id}/env-vars?limit=100`, { headers }).then((r) => r.json());
  const ev = (env || []).map((r) => r.envVar || r).find((e) => e.key === 'DATABASE_URL');
  return ev?.value || null;
}

async function main() {
  const local = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  const localOk = diagnose('local .env', local);
  let renderUrl = null;
  try {
    renderUrl = await fetchRenderUrl();
  } catch (e) {
    console.log('Render fetch failed:', e.message);
  }
  const renderOk = diagnose('Render gatorvault-api', renderUrl);
  if (!localOk && !renderOk) {
    process.exit(1);
  }
}

main();
