#!/usr/bin/env node
/**
 * Activate UF Premium profiles + print autoposter deployment steps.
 *
 * Usage:
 *   node server/scripts/activate-uf-premium-system.js
 *   node server/scripts/activate-uf-premium-system.js --dry-run
 *   node server/scripts/activate-uf-premium-system.js --deploy-autoposter
 *   node server/scripts/activate-uf-premium-system.js --full
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { enrichAll } = require('../lib/profile-enrichment/uf-premium-enrich');
const { PIPELINE_ACTIVATION_ENV } = require('../lib/pipeline-activation-env');

const ENV_PATH = path.join(__dirname, '..', '.env');
const dryRun = process.argv.includes('--dry-run');
const deployAutoposter = process.argv.includes('--deploy-autoposter');
const fullActivation = process.argv.includes('--full') || deployAutoposter;

function upsertLocalEnv(keys) {
  let text = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  for (const [k, v] of Object.entries(keys)) {
    const re = new RegExp(`^${k}=.*$`, 'm');
    const line = `${k}=${v}`;
    text = re.test(text) ? text.replace(re, line) : `${text.trimEnd()}\n${line}\n`;
  }
  fs.writeFileSync(ENV_PATH, text.endsWith('\n') ? text : `${text}\n`);
}

async function main() {
  if (fullActivation) {
    console.log('[activation] Seeding 2028–2030 recruits from target boards…');
    require('./seed-underclassmen-recruits.js');
  }

  console.log('[uf-premium] Enriching roster + recruiting profiles…');
  const summary = enrichAll({ dryRun });
  console.log(JSON.stringify(summary, null, 2));

  if (!dryRun) {
    upsertLocalEnv(PIPELINE_ACTIVATION_ENV);
    console.log('[activation] Updated server/.env with pipeline + UF Premium flags.');
  }

  if (deployAutoposter) {
    if (!process.env.RENDER_API_KEY) {
      console.error('Missing RENDER_API_KEY — add to server/.env then re-run with --deploy-autoposter');
      process.exit(1);
    }
    require('./render-autoposter-deploy.js');
    return;
  }

  console.log('\nNext steps:');
  console.log('  node server/scripts/activate-uf-premium-system.js --deploy-autoposter');
  console.log('  node server/scripts/sync-render-env.js --deploy');
  console.log('  npm run test:autoposter --prefix server');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
