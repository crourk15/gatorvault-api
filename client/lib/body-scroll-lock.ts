/** Ref-counted body scroll lock for modals, drawers, and overlays. */
let lockCount = 0;

const BODY_CLASS = 'gv-scroll-locked';

export function lockBodyScroll(): () => void {
  if (typeof document === 'undefined') return () => {};

  lockCount += 1;
  if (lockCount === 1) {
    document.body.classList.add(BODY_CLASS);
  }

  return () => {
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      document.body.classList.remove(BODY_CLASS);
    }
  };
}

/**
 * Drop orphaned menu/modal locks so document scroll works again.
 * No-op while the vault menu boot reports open (real lock still needed).
 */
export function ensureDocumentScrollUnlocked(): void {
  if (typeof document === 'undefined') return;
  try {
    if (window.__GV_MENU_BOOT__?.isOpen?.() === true) return;
  } catch {
    /* ignore */
  }
  lockCount = 0;
  document.body.classList.remove(BODY_CLASS);
  try {
    document.body.style.overflow = '';
  } catch {
    /* ignore */
  }
}