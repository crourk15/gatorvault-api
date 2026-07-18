/** Shared vault hydration guard constants — used by layout + Netlify HTML inject. */

/**
 * Soft blank-main recovery:
 * - If React already hydrated, do nothing (avoid orphaning the tree).
 * - Else one-shot reload (sessionStorage guard) instead of replaceWith SSR HTML.
 */
const VAULT_HYDRATION_BOOT_SCRIPT =
  '(function(){if(window.__gvHydrationBoot)return;window.__gvHydrationBoot=true;' +
  'function mainEl(){var r=document.getElementById("gv-vault-root");return r?r.querySelector(".gv-vault-shell__main"):null}' +
  'function rootBlank(){var r=document.getElementById("gv-vault-root");if(!r)return true;if(r.getAttribute("data-gv-hydrated")==="true")return false;var m=mainEl();if(!m)return true;if(m.querySelector("[data-home-boot-painted],[data-hydrate=hero]:not(.hero-skeleton)"))return false;return m.childElementCount===0}' +
  'function softRecover(){try{if(sessionStorage.getItem("gv_vault_hydration_reload")==="1")return false;sessionStorage.setItem("gv_vault_hydration_reload","1");}catch(e){}' +
  'console.warn("[VaultHydrationGuard] blank main — soft reload");location.reload();return true}' +
  'function clearReloadGuard(){try{sessionStorage.removeItem("gv_vault_hydration_reload")}catch(e){}}' +
  'function guard(){var r=document.getElementById("gv-vault-root");if(r&&r.getAttribute("data-gv-hydrated")==="true"){clearReloadGuard();return}' +
  'if(rootBlank()){softRecover();return}' +
  'if(r&&!r.hasAttribute("data-gv-hydrated")){r.removeAttribute("data-hydrating")}}' +
  'function arm(){if(window.__gvHydrationTimeout){clearTimeout(window.__gvHydrationTimeout)}var ms=window.matchMedia&&window.matchMedia("(max-width:767px)").matches?4500:3000;window.__gvHydrationTimeout=window.setTimeout(guard,ms)}' +
  'function boot(){arm()}' +
  'if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",boot,{once:true})}else{boot()}' +
  'window.addEventListener("error",function(ev){var msg=String(ev.message||"");var file=String(ev.filename||"");' +
  'if(/hydration|Hydration|did not match|Minified React error #(418|423|425|422)/i.test(msg)||/vault-chunks|_next\\/static\\/chunks/i.test(file)){' +
  'setTimeout(guard,0)}});' +
  'window.addEventListener("pageshow",function(ev){if(ev.persisted){arm()}})' +
  'window.addEventListener("load",function(){var r=document.getElementById("gv-vault-root");if(r&&r.getAttribute("data-gv-hydrated")==="true")clearReloadGuard()})' +
  '})();';

const VAULT_HYDRATION_CRITICAL_CSS =
  '[data-hydrating] .gv-vault-shell,[data-hydrating] .gv-vault-shell__main{opacity:1!important;visibility:visible!important}' +
  '[data-hydrating] .gv-vault-shell.is-navigating .gv-vault-shell__main{opacity:1!important;pointer-events:auto!important}' +
  '[data-hydrating] .gv-vault-shell__main>*{visibility:visible!important}';

module.exports = {
  VAULT_HYDRATION_BOOT_SCRIPT,
  VAULT_HYDRATION_CRITICAL_CSS,
};
