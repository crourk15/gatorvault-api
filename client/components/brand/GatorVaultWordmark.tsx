import React from 'react';

type BrandImageProps = {
  className?: string;
  height?: number;
  width?: number;
};

export function GatorVaultWordmark({
  className = 'gv-brand-wordmark',
  height = 32,
  width,
}: BrandImageProps): React.ReactElement {
  return (
    <svg
      className={className}
      width={width ?? height * 5}
      height={height}
      viewBox="0 0 320 64"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="GatorVault"
    >
      <text x="0" y="42" fontFamily="Inter, sans-serif" fontWeight="800" fontSize="42" fill="#0021A5">
        GATOR
      </text>
      <text x="150" y="42" fontFamily="Inter, sans-serif" fontWeight="800" fontSize="42" fill="#0021A5">
        VAULT
      </text>
      <rect x="150" y="48" width="150" height="6" fill="#FA4616" rx="3" />
    </svg>
  );
}

export function GatorVaultMonogram({
  className = 'gv-brand-monogram',
  height = 32,
  width,
}: BrandImageProps): React.ReactElement {
  const size = width ?? height;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="GV"
    >
      <rect width="96" height="96" rx="16" fill="#0021A5" />
      <path d="M24 24h48v12H36v12h24v12H36v12h36v12H24V24z" fill="#FA4616" />
    </svg>
  );
}
