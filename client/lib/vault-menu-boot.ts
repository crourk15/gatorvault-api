/** Pre-React menu toggle — bottom nav links work without JS; menu button must not depend on hydration. */
export function vaultMenuBootScript(): string {
  return `(function(){
  function init() {
    var btn = document.querySelector('[data-vault-menu-toggle]');
    var drawer = document.getElementById('gv-app-menu-drawer');
    var backdrop = document.querySelector('.gv-app-menu__backdrop');
    if (!btn || !drawer) return;
    var open = false;
    function sync() {
      drawer.classList.toggle('is-open', open);
      drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
      if (backdrop) {
        backdrop.classList.toggle('is-open', open);
        backdrop.setAttribute('aria-hidden', open ? 'false' : 'true');
      }
      btn.classList.toggle('is-menu-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
    }
    function setOpen(next) {
      open = !!next;
      sync();
      if (window.__GV_MENU_BOOT__ && window.__GV_MENU_BOOT__.onChange) {
        window.__GV_MENU_BOOT__.onChange(open);
      }
    }
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      setOpen(!open);
    });
    if (backdrop) {
      backdrop.addEventListener('click', function() { setOpen(false); });
    }
    document.querySelectorAll('[data-vault-menu-close]').forEach(function(el) {
      el.addEventListener('click', function() { setOpen(false); });
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && open) setOpen(false);
    });
    window.__GV_MENU_BOOT__ = {
      isOpen: function() { return open; },
      setOpen: setOpen,
      onChange: null
    };
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();`;
}

declare global {
  interface Window {
    __GV_MENU_BOOT__?: {
      isOpen: () => boolean;
      setOpen: (open: boolean) => void;
      onChange?: ((open: boolean) => void) | null;
    };
  }
}

export function syncVaultMenuBootOpen(open: boolean): void {
  window.__GV_MENU_BOOT__?.setOpen(open);
}

export function readVaultMenuBootOpen(): boolean {
  return window.__GV_MENU_BOOT__?.isOpen?.() ?? false;
}
