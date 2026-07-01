/**
 * GatorVault autoposter brand layer - discovery hooks, compact identity budget, quality floor.
 */
const template = require('./x-autoposter-template');
const copy = require('./x-autoposter-copy');

const SITE_HOST = (copy.SITE_URL || 'https://gatorvaultinsider.com').replace(/^https?:\/\//, '');

const MONITORING_FALLBACK_RE =
  /^per multiple reports,.+(?:monitoring|expected to)\.?$/i;

function eliteBrandEnabled() {
  return process.env.X_AUTOPOST_ELITE_MODE !== 'false' && process.env.X_AUTOPOST_ELITE_BRAND_ALL !== 'false';
}

function monitoringFallbackAllowed() {
  return process.env.X_AUTOPOST_ALLOW_MONITORING_FALLBACK === 'true';
}

function isMonitoringFallbackCopy(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  if (/per multiple reports,.+monitoring\.?$/i.test(t)) return true;
  if (/florida program update:.+monitoring staff\/roster impact/i.test(t)) return true;
  if (MONITORING_FALLBACK_RE.test(t)) return true;
  return false;
}

function textHasSiteHook(text) {
  const t = String(text || '').toLowerCase();
  return t.includes(SITE_HOST) || /futurecast\/player\//.test(t);
}

function appendSiteOnce(text, meta = {}) {
  const body = String(text || '').trim();
  if (!body) return '';
  if (textHasSiteHook(body)) return body;
  return copy.appendSite(body, meta) || body;
}

function fitBodyToHookBudget(identity, context, insider, hookBudget) {
  if (!hookBudget || hookBudget <= 0) {
    return { identity, context, insider };
  }
  const bodyLimit = 280 - hookBudget;
  let id = String(identity || '').trim();
  let ctx = String(context || '').trim();
  let ins = String(insider || '').trim();
  for (let i = 0; i < 24; i += 1) {
    const raw = [id, ctx, ins].filter(Boolean).join('\n');
    if (raw.length <= bodyLimit) return { identity: id, context: ctx, insider: ins };
    if (ins.length > 48) {
      ins = template.hardTrimLine(ins, Math.max(48, ins.length - 12));
      continue;
    }
    if (ctx.length > 48) {
      ctx = template.hardTrimLine(ctx, Math.max(48, ctx.length - 12));
      continue;
    }
    if (id.length > 32) {
      id = template.hardTrimLine(id, Math.max(32, id.length - 8));
      continue;
    }
    break;
  }
  return { identity: id, context: ctx, insider: ins };
}

function hookBudgetFor(meta = {}) {
  if (process.env.X_AUTOPOST_GV_CTA_ENABLED !== 'true') return 0;
  if (!eliteBrandEnabled() && process.env.X_AUTOPOST_ELITE_BRAND_BEAT === 'false') return 0;
  return copy.estimateHookBudget(meta);
}

function useCompactRecruitingIdentity(meta = {}) {
  if (process.env.X_AUTOPOST_ELITE_BRAND_BEAT !== 'false' && meta.beatText) return true;
  return eliteBrandEnabled();
}

module.exports = {
  eliteBrandEnabled,
  monitoringFallbackAllowed,
  isMonitoringFallbackCopy,
  textHasSiteHook,
  appendSiteOnce,
  fitBodyToHookBudget,
  hookBudgetFor,
  useCompactRecruitingIdentity
};