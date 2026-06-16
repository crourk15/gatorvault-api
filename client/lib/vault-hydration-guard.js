/** Shared vault hydration guard constants — used by layout + Netlify HTML inject. */

const VAULT_HYDRATION_BOOT_SCRIPT =
  '(function(){if(window.__gvHydrationBoot)return;window.__gvHydrationBoot=true;window.__gvHydrationTimeout=window.setTimeout(function(){var r=document.getElementById("gv-vault-root");if(r&&!r.hasAttribute("data-gv-hydrated")){r.removeAttribute("data-hydrating");console.warn("[VaultHydrationGuard] hydration exceeded 3s — SSR content kept visible")}},3000)})();';

const VAULT_HYDRATION_CRITICAL_CSS =
  '[data-hydrating] .gv-vault-shell,[data-hydrating] .gv-vault-shell__main{opacity:1!important;visibility:visible!important}' +
  '[data-hydrating] .gv-vault-shell.is-navigating .gv-vault-shell__main{opacity:1!important;pointer-events:auto!important}' +
  '[data-hydrating] .gv-vault-shell__main>*{visibility:visible!important}';

module.exports = {
  VAULT_HYDRATION_BOOT_SCRIPT,
  VAULT_HYDRATION_CRITICAL_CSS,
};
