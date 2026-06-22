/** Shared vault hydration guard constants — used by layout + Netlify HTML inject. */

const VAULT_HYDRATION_BOOT_SCRIPT =
  '(function(){if(window.__gvHydrationBoot)return;window.__gvHydrationBoot=true;' +
  'var r=document.getElementById("gv-vault-root");if(r){try{window.__GV_SSR_VAULT_HTML__=r.outerHTML}catch(e){}}' +
  'window.__gvHydrationTimeout=window.setTimeout(function(){' +
  'var root=document.getElementById("gv-vault-root");' +
  'if(!root&&window.__GV_SSR_VAULT_HTML__){try{var wrap=document.createElement("div");wrap.innerHTML=window.__GV_SSR_VAULT_HTML__;root=wrap.firstElementChild;if(root)document.body.insertBefore(root,document.body.querySelector("script"))}catch(e){}}' +
  'if(root&&!root.hasAttribute("data-gv-hydrated")){root.removeAttribute("data-hydrating");console.warn("[VaultHydrationGuard] hydration exceeded 3s — SSR content kept visible")}' +
  '},3000)})();';

const VAULT_HYDRATION_CRITICAL_CSS =
  '[data-hydrating] .gv-vault-shell,[data-hydrating] .gv-vault-shell__main{opacity:1!important;visibility:visible!important}' +
  '[data-hydrating] .gv-vault-shell.is-navigating .gv-vault-shell__main{opacity:1!important;pointer-events:auto!important}' +
  '[data-hydrating] .gv-vault-shell__main>*{visibility:visible!important}';

module.exports = {
  VAULT_HYDRATION_BOOT_SCRIPT,
  VAULT_HYDRATION_CRITICAL_CSS,
};
