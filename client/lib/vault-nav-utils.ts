/** True when href should use Next client navigation inside the vault shell. */
export function isVaultClientNavHref(href: string | null | undefined): boolean {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return false;
  }
  if (href.startsWith('http://') || href.startsWith('https://')) return false;
  try {
    const path = new URL(href, 'https://gatorvaultinsider.com').pathname.replace(/\/$/, '') || '/';
    return path === '/vault' || path.startsWith('/vault/');
  } catch {
    return false;
  }
}

export function vaultNavPathsEqual(a: string, b: string): boolean {
  try {
    const left = new URL(a, 'https://gatorvaultinsider.com');
    const right = new URL(b, 'https://gatorvaultinsider.com');
    return left.pathname.replace(/\/$/, '') === right.pathname.replace(/\/$/, '') && left.search === right.search;
  } catch {
    return a === b;
  }
}
