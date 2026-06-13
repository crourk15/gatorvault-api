'use client';

import React from 'react';

export type VaultStubLink = {
  href: string;
  label: string;
  desc?: string;
};

type VaultSectionStubProps = {
  title: string;
  subtitle: string;
  phase?: number;
  links?: VaultStubLink[];
};

export function VaultSectionStub({
  title,
  subtitle,
  phase = 2,
  links = [],
}: VaultSectionStubProps): React.ReactElement {
  return (
    <div className="gv-vault-stub" data-testid="vault-section-stub">
      <div className="gv-page-hero">
        <h1 className="gv-page-title">{title}</h1>
        <p className="gv-page-subtitle">{subtitle}</p>
      </div>

      <p className="gv-vault-stub__notice">
        Full {title} experience is being migrated to the unified Vault (Phase {phase}). Use the links
        below in the meantime.
      </p>

      {links.length > 0 && (
        <ul className="gv-vault-stub__links">
          {links.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="gv-vault-stub__link">
                <span className="gv-vault-stub__link-label">{link.label}</span>
                {link.desc ? <span className="gv-vault-stub__link-desc">{link.desc}</span> : null}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
