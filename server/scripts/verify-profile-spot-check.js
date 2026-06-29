#!/usr/bin/env node
/**
 * Production smoke: profile notes dedupe + related-player position buckets.
 * Usage: node server/scripts/verify-profile-spot-check.js
 */
const API = process.env.GV_API_BASE || 'https://gatorvault-api.onrender.com';
const SITE = process.env.GV_SITE || 'https://gatorvaultinsider.com';

const SPOT_CHECKS = [
  { slug: 'jalen-brewster', expectPositions: ['DL', 'EDGE'] },
  { slug: 'kamauri-whitfield', expectPositions: ['WR', 'CB', 'RB'] },
  { slug: 'maxwell-hiller', expectPositions: ['OL'] },
];

const results = [];
const pass = (name, message) => results.push({ name, status: 'PASS', message });
const fail = (name, message) => results.push({ name, status: 'FAIL', message });

function normalizeNote(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

async function fetchManifest() {
  const res = await fetch(`${SITE}/build-manifest.json`);
  if (!res.ok) throw new Error(`manifest ${res.status}`);
  return res.json();
}

async function fetchProfile(slug) {
  const res = await fetch(`${API}/api/player/full-profile/${encodeURIComponent(slug)}`);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function main() {
  try {
    const manifest = await fetchManifest();
    pass('build-manifest', `commit ${String(manifest.commit || '').slice(0, 7)}`);
  } catch (err) {
    fail('build-manifest', err instanceof Error ? err.message : String(err));
  }

  for (const check of SPOT_CHECKS) {
    const label = `profile-${check.slug}`;
    try {
      const { status, body } = await fetchProfile(check.slug);
      if (status !== 200) {
        fail(label, `HTTP ${status}`);
        continue;
      }

      const uf = body.ufSpecificProfile || {};
      const hs = normalizeNote(uf.hsNotes);
      const evalNote = normalizeNote(uf.evaluationNotes);
      if (hs && evalNote && hs === evalNote) {
        fail(label, 'duplicate HS/evaluation notes');
      } else {
        pass(label, 'notes deduped');
      }

      const related = Array.isArray(body.related) ? body.related : [];
      const positions = [...new Set(related.map((row) => String(row.position || '').toUpperCase()).filter(Boolean))];
      if (related.length < 1) {
        fail(`${label}-related`, 'no related players');
      } else {
        const overlap = check.expectPositions.filter((pos) => positions.includes(pos));
        if (!overlap.length) {
          fail(`${label}-related`, `positions ${positions.join(',')} missing ${check.expectPositions.join('/')}`);
        } else {
          pass(`${label}-related`, `${related.length} peers (${positions.slice(0, 4).join(', ')})`);
        }
      }
    } catch (err) {
      fail(label, err instanceof Error ? err.message : String(err));
    }
  }

  const summary = {
    site: SITE,
    api: API,
    pass: results.filter((r) => r.status === 'PASS').length,
    fail: results.filter((r) => r.status === 'FAIL').length,
    results,
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
