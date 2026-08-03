/**
 * Boot-time guardian — refuse to start if platform wiring is broken.
 */
const manifest = require('./platform-manifest');
const { verifyPlatformWiring } = require('./platform-wiring');
const systemHealth = require('./system-health');
const { alertGuardian } = require('./guardian-alerts');

function logMount(id) {
  console.log(`[guardian] mounted ${id}`);
}

function yieldEventLoop() {
  return new Promise((resolve) => setImmediate(resolve));
}

function verifyBoot({ alert = false } = {}) {
  // Sync path kept for tests; production boot uses verifyBootAsync so /health can answer.
  const wiring = verifyPlatformWiring({ simulate: true });
  if (!wiring.ok) {
    const message = wiring.errors.join('; ');
    if (alert) {
      alertGuardian({
        type: 'boot_wiring_failed',
        severity: 'critical',
        title: 'Boot blocked — platform wiring broken',
        message,
        meta: { errors: wiring.errors }
      }).catch(() => {});
    }
    throw new Error(`[guardian] Boot blocked: ${message}`);
  }

  for (const route of manifest.ROUTE_WIRING) {
    const mod = require('../' + route.file.replace(/^lib\//, ''));
    if (typeof mod[route.export] !== 'function') {
      throw new Error(`[guardian] Boot blocked: ${route.export} missing from ${route.file}`);
    }
    logMount(route.id);
  }

  const fs = require('fs');
  const path = require('path');
  for (const id of manifest.SIDE_EFFECT_ROUTERS) {
    const rel = id.replace(/^lib\//, '');
    const full = path.join(__dirname, '..', rel);
    if (!fs.existsSync(full)) {
      throw new Error(`[guardian] Boot blocked: side-effect router missing ${id}`);
    }
    logMount(rel.replace(/\.js$/, ''));
  }

  const health = systemHealth.checkAllSystems();
  const criticalErrors = ['db', 'insiderArticles', 'gm2'].filter(
    (k) => health.systems[k] === 'error'
  );
  if (criticalErrors.length) {
    const message = `Critical subsystems failed at boot: ${criticalErrors.join(', ')}`;
    if (alert) {
      alertGuardian({
        type: 'boot_health_failed',
        severity: 'critical',
        title: 'Boot blocked — subsystem health failed',
        message,
        notifySms: true,
        meta: { systems: health.systems, details: health.details }
      }).catch(() => {});
    }
    throw new Error(`[guardian] ${message}`);
  }

  let blueprints = null;
  try {
    const { verifyBlueprints } = require('./blueprint-validator');
    blueprints = verifyBlueprints({ criticalOnly: true });
    if (!blueprints.ok) {
      const message = blueprints.errors.join('; ');
      if (alert) {
        alertGuardian({
          type: 'boot_blueprint_failed',
          severity: 'critical',
          title: 'Boot blocked — blueprint validation failed',
          message,
          notifySms: true,
          meta: { errors: blueprints.errors }
        }).catch(() => {});
      }
      throw new Error(`[guardian] Boot blocked: ${message}`);
    }
  } catch (err) {
    if (String(err.message).startsWith('[guardian] Boot blocked')) throw err;
    console.warn('[guardian] blueprint boot check skipped:', err.message);
  }

  console.log('[guardian] boot verification passed');
  return { wiring, health, blueprints };
}

/**
 * Same checks as verifyBoot, but yields between steps so Render /health (~5s)
 * can still be served while boot verification runs on Starter.
 */
async function verifyBootAsync({ alert = false } = {}) {
  // Yield BEFORE the sync wiring scan so an in-flight /health can finish.
  await yieldEventLoop();
  if (process.env.GUARDIAN_BOOT_SKIP === 'true') {
    console.warn('[guardian] GUARDIAN_BOOT_SKIP=true — skipping boot verification');
    return { skipped: true, wiring: { ok: true, errors: [] }, health: null, blueprints: null };
  }
  const wiring = verifyPlatformWiring({ simulate: true });
  if (!wiring.ok) {
    const message = wiring.errors.join('; ');
    if (alert) {
      alertGuardian({
        type: 'boot_wiring_failed',
        severity: 'critical',
        title: 'Boot blocked — platform wiring broken',
        message,
        meta: { errors: wiring.errors }
      }).catch(() => {});
    }
    throw new Error(`[guardian] Boot blocked: ${message}`);
  }
  await yieldEventLoop();

  for (const route of manifest.ROUTE_WIRING) {
    const mod = require('../' + route.file.replace(/^lib\//, ''));
    if (typeof mod[route.export] !== 'function') {
      throw new Error(`[guardian] Boot blocked: ${route.export} missing from ${route.file}`);
    }
    logMount(route.id);
    await yieldEventLoop();
  }

  const fs = require('fs');
  const path = require('path');
  for (const id of manifest.SIDE_EFFECT_ROUTERS) {
    const rel = id.replace(/^lib\//, '');
    const full = path.join(__dirname, '..', rel);
    if (!fs.existsSync(full)) {
      throw new Error(`[guardian] Boot blocked: side-effect router missing ${id}`);
    }
    logMount(rel.replace(/\.js$/, ''));
    await yieldEventLoop();
  }

  const health = systemHealth.checkAllSystems();
  await yieldEventLoop();
  const criticalErrors = ['db', 'insiderArticles', 'gm2'].filter(
    (k) => health.systems[k] === 'error'
  );
  if (criticalErrors.length) {
    const message = `Critical subsystems failed at boot: ${criticalErrors.join(', ')}`;
    if (alert) {
      alertGuardian({
        type: 'boot_health_failed',
        severity: 'critical',
        title: 'Boot blocked — subsystem health failed',
        message,
        notifySms: true,
        meta: { systems: health.systems, details: health.details }
      }).catch(() => {});
    }
    throw new Error(`[guardian] ${message}`);
  }

  let blueprints = null;
  try {
    const { verifyBlueprints } = require('./blueprint-validator');
    blueprints = verifyBlueprints({ criticalOnly: true });
    if (!blueprints.ok) {
      const message = blueprints.errors.join('; ');
      if (alert) {
        alertGuardian({
          type: 'boot_blueprint_failed',
          severity: 'critical',
          title: 'Boot blocked — blueprint validation failed',
          message,
          notifySms: true,
          meta: { errors: blueprints.errors }
        }).catch(() => {});
      }
      throw new Error(`[guardian] Boot blocked: ${message}`);
    }
  } catch (err) {
    if (String(err.message).startsWith('[guardian] Boot blocked')) throw err;
    console.warn('[guardian] blueprint boot check skipped:', err.message);
  }

  console.log('[guardian] boot verification passed');
  return { wiring, health, blueprints };
}

module.exports = { verifyBoot, verifyBootAsync, logMount };
