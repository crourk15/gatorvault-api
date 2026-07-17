'use client';

import React, { useEffect } from 'react';
import { VaultNavLink } from '@/components/vault/VaultNavLink';
import { usePathname } from '@/lib/use-pathname';
import { getAppMenuSections } from '@/lib/app-menu-routes';
import { isVaultPath } from '@/lib/vault-routes';
import { useAppMenu } from '@/components/shell/AppMenuContext';
import { lockBodyScroll } from '@/lib/body-scroll-lock';

export function AppMenuDrawer(): React.ReactElement {
  const pathname = usePathname();
  const { isOpen, closeMenu } = useAppMenu();
  const inVault = isVaultPath(pathname);
  const sections = getAppMenuSections(inVault);

  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  useEffect(() => {
    if (!isOpen) return;
    return lockBodyScroll();
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        className={`gv-app-menu__backdrop${isOpen ? ' is-open' : ''}`}
        aria-label="Close menu"
        aria-hidden={!isOpen}
        tabIndex={isOpen ? 0 : -1}
        data-vault-menu-close
        onClick={closeMenu}
      />
      <aside
        id="gv-app-menu-drawer"
        className={`gv-app-menu${isOpen ? ' is-open' : ''}`}
        aria-label="App menu"
        aria-hidden={!isOpen}
      >
        <div className="gv-app-menu__head">
          <h2 className="gv-app-menu__title">Menu</h2>
          <button type="button" className="gv-app-menu__close" data-vault-menu-close onClick={closeMenu}>
            Close
          </button>
        </div>
        <div className="gv-app-menu__body">
          {sections.map((section) => (
            <section key={section.title} className="gv-app-menu__section">
              <h3 className="gv-app-menu__section-title">{section.title}</h3>
              <ul className="gv-app-menu__list">
                {section.items.map((item) => (
                  <li key={item.id}>
                    <VaultNavLink href={item.href} className="gv-app-menu__link" onClick={closeMenu}>
                      {item.icon ? (
                        <span className="gv-app-menu__link-icon" aria-hidden="true">
                          {item.icon}
                        </span>
                      ) : null}
                      <span>{item.label}</span>
                    </VaultNavLink>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </aside>
    </>
  );
}
