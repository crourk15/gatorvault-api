/** React handoff for pre-React menu boot (see vault-menu-boot.js). */

declare global {
  interface Window {
    __GV_MENU_BOOT__?: {
      isOpen: () => boolean;
      setOpen: (open: boolean) => void;
      onChange?: ((open: boolean) => void) | null;
    };
    __gvMenuBoot?: boolean;
  }
}

export function syncVaultMenuBootOpen(open: boolean): void {
  window.__GV_MENU_BOOT__?.setOpen(open);
}

export function readVaultMenuBootOpen(): boolean {
  return window.__GV_MENU_BOOT__?.isOpen?.() ?? false;
}
