/** Shared vault hydration guard constants — used by layout + Netlify HTML inject. */

const VAULT_HYDRATION_BOOT_SCRIPT =
  '(function(){if(window.__gvHydrationBoot)return;window.__gvHydrationBoot=true;' +
  'function mainEl(){var r=document.getElementById("gv-vault-root");return r?r.querySelector(".gv-vault-shell__main"):null}' +
  'function capture(){var r=document.getElementById("gv-vault-root");if(!r||!r.innerHTML||r.innerHTML.length<80)return;' +
  'try{window.__GV_SSR_VAULT_HTML__=r.outerHTML}catch(e){}}' +
  'function restore(){if(!window.__GV_SSR_VAULT_HTML__)return false;' +
  'try{var wrap=document.createElement("div");wrap.innerHTML=window.__GV_SSR_VAULT_HTML__;var fresh=wrap.firstElementChild;if(!fresh)return false;' +
  'var cur=document.getElementById("gv-vault-root");if(cur){cur.replaceWith(fresh)}else{var anchor=document.querySelector("script[src*=\\"vault-chunks\\"],script[src*=\\"_next/static/chunks\\"]");document.body.insertBefore(fresh,anchor||null)}' +
  'fresh.removeAttribute("data-hydrating");return true}catch(e){return false}}' +
  'function rootBlank(){var r=document.getElementById("gv-vault-root");if(!r)return true;var m=mainEl();if(!m)return true;return m.childElementCount===0}' +
  'function guard(){if(rootBlank()){if(restore()){console.warn("[VaultHydrationGuard] restored SSR snapshot")}return}' +
  'var r=document.getElementById("gv-vault-root");if(r&&!r.hasAttribute("data-gv-hydrated")){r.removeAttribute("data-hydrating")}}' +
  'function arm(){if(window.__gvHydrationTimeout){clearTimeout(window.__gvHydrationTimeout)}window.__gvHydrationTimeout=window.setTimeout(guard,3000)}' +
  'function boot(){capture();arm();setTimeout(capture,3500);setTimeout(capture,5500)}' +
  'if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",boot,{once:true})}else{boot()}' +
  'window.addEventListener("error",function(ev){var msg=String(ev.message||"");var file=String(ev.filename||"");' +
  'if(/hydration|Hydration|did not match|Minified React error #(418|423|425|422)/i.test(msg)||/vault-chunks|_next\\/static\\/chunks/i.test(file)){' +
  'setTimeout(guard,0)}});' +
  'window.addEventListener("pageshow",function(ev){if(ev.persisted){capture();arm()}})' +
  '})();';

const VAULT_HYDRATION_CRITICAL_CSS =
  '[data-hydrating] .gv-vault-shell,[data-hydrating] .gv-vault-shell__main{opacity:1!important;visibility:visible!important}' +
  '[data-hydrating] .gv-vault-shell.is-navigating .gv-vault-shell__main{opacity:1!important;pointer-events:auto!important}' +
  '[data-hydrating] .gv-vault-shell__main>*{visibility:visible!important}';

module.exports = {
  VAULT_HYDRATION_BOOT_SCRIPT,
  VAULT_HYDRATION_CRITICAL_CSS,
};
