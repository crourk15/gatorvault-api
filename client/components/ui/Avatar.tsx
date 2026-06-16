'use client';

import React from 'react';

type Size = 'sm' | 'md' | 'lg';

type Props = {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: Size;
  className?: string;
};

function initials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function Avatar({ src, alt, name, size = 'md', className = '' }: Props): React.ReactElement {
  const label = alt || name || 'Avatar';

  return (
    <span className={`gv-ds-avatar gv-ds-avatar--${size}${className ? ` ${className}` : ''}`} role="img" aria-label={label}>
      {src ? (
        <img src={src} alt={label} className="gv-ds-avatar__img" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
