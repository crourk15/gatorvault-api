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

function verifyBoot({ alert = false } = {}) {
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

  for (const id of manifest.SIDE_EFFECT_ROUTERS) {
    require('../' + id.replace(/^lib\//, '').replace(/\.js$/, ''));
    logMount(id.replace(/^lib\//, '').replace(/\.js$/, ''));
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

async function verifyBootAsync(options = {}) {
  return verifyBoot(options);
}

module.exports = { verifyBoot, verifyBootAsync, logMount };
