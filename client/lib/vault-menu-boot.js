/** Shared menu boot script — used by layout SSR + Netlify HTML inject. */

/** Boot owns all vault menu clicks; React only mirrors open state via onChange. */
const VAULT_MENU_BOOT_SCRIPT =
  '(function(){' +
  'var open=false;' +
  'function els(){return{' +
  'btn:document.querySelector("[data-vault-menu-toggle]")||document.querySelector(\'button[aria-controls="gv-app-menu-drawer"]\'),' +
  'drawer:document.getElementById("gv-app-menu-drawer"),' +
  'backdrop:document.querySelector(".gv-app-menu__backdrop")};}' +
  'function sync(){' +
  'var e=els();if(!e.btn||!e.drawer)return;' +
  'if(!e.btn.hasAttribute("data-vault-menu-toggle"))e.btn.setAttribute("data-vault-menu-toggle","");' +
  'e.drawer.classList.toggle("is-open",open);' +
  'e.drawer.setAttribute("aria-hidden",open?"false":"true");' +
  'if(e.backdrop){e.backdrop.classList.toggle("is-open",open);e.backdrop.setAttribute("aria-hidden",open?"false":"true");}' +
  'e.btn.classList.toggle("is-menu-open",open);' +
  'e.btn.setAttribute("aria-expanded",open?"true":"false");' +
  'document.body.style.overflow=open?"hidden":"";' +
  '}' +
  'function setOpen(next){open=!!next;sync();if(window.__GV_MENU_BOOT__&&window.__GV_MENU_BOOT__.onChange){window.__GV_MENU_BOOT__.onChange(open);}}' +
  'function bind(){sync();}' +
  'window.__GV_MENU_BOOT__={isOpen:function(){return open;},setOpen:setOpen,onChange:null};' +
  'window.__GV_MENU_BIND__=bind;' +
  'if(!window.__gvMenuClickBound){' +
  'window.__gvMenuClickBound=true;' +
  'document.addEventListener("click",function(ev){' +
  'var close=ev.target.closest("[data-vault-menu-close]");' +
  'if(close){ev.preventDefault();setOpen(false);return;}' +
  'var backdrop=ev.target.closest(".gv-app-menu__backdrop");' +
  'if(backdrop){setOpen(false);return;}' +
  'var toggle=ev.target.closest("[data-vault-menu-toggle],button[aria-controls=\\"gv-app-menu-drawer\\"]");' +
  'if(toggle){ev.preventDefault();setOpen(!open);}' +
  '},true);' +
  'document.addEventListener("keydown",function(ev){if(ev.key==="Escape"&&open)setOpen(false);});' +
  'window.addEventListener("gv-vault-restored",bind);' +
  '}' +
  'if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",bind,{once:true});}else{bind();}' +
  '})();';

module.exports = {
  VAULT_MENU_BOOT_SCRIPT,
};
