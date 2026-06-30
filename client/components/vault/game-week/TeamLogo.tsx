'use client';

import React from 'react';

type Props = {
  teamId: string;
  variant?: 'uf' | 'opponent';
  size?: number;
  className?: string;
  label?: string;
};

/** Official-style vector marks — SVG only (no PNG / remote images). */
function logoSvg(teamKey: string): React.ReactElement {
  switch (teamKey) {
    case 'uf':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="30" fill="#0021A5" />
          <path
            fill="#FA4616"
            d="M18 44c6-10 14-16 14-16s8 6 14 16c-4 2-8 3-14 3s-10-1-14-3z"
          />
          <ellipse cx="32" cy="24" rx="14" ry="11" fill="#FA4616" />
          <circle cx="26" cy="22" r="2.5" fill="#0021A5" />
          <circle cx="38" cy="22" r="2.5" fill="#0021A5" />
          <path fill="#0021A5" d="M28 28h8v3c0 3-2 5-4 5s-4-2-4-5v-3z" />
        </svg>
      );
    case 'fau':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="8" fill="#003366" />
          <text x="32" y="40" textAnchor="middle" fill="#CC0000" fontSize="18" fontWeight="800" fontFamily="Arial,sans-serif">
            FAU
          </text>
        </svg>
      );
    case 'charlotte':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="8" fill="#00703C" />
          <text x="32" y="40" textAnchor="middle" fill="#FFFFFF" fontSize="16" fontWeight="800" fontFamily="Arial,sans-serif">
            CLT
          </text>
        </svg>
      );
    case 'auburn':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="8" fill="#0C2340" />
          <text x="32" y="42" textAnchor="middle" fill="#E87722" fontSize="22" fontWeight="800" fontFamily="Arial,sans-serif">
            AU
          </text>
        </svg>
      );
    case 'olemiss':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="8" fill="#CE1126" />
          <text x="32" y="40" textAnchor="middle" fill="#14213D" fontSize="14" fontWeight="800" fontFamily="Arial,sans-serif">
            MISS
          </text>
        </svg>
      );
    case 'missouri':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="8" fill="#F1B82D" />
          <text x="32" y="40" textAnchor="middle" fill="#000000" fontSize="16" fontWeight="800" fontFamily="Arial,sans-serif">
            MIZ
          </text>
        </svg>
      );
    case 'lsu':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="8" fill="#461D7C" />
          <text x="32" y="42" textAnchor="middle" fill="#FDD023" fontSize="22" fontWeight="800" fontFamily="Arial,sans-serif">
            LSU
          </text>
        </svg>
      );
    case 'texas':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="8" fill="#BF5700" />
          <text x="32" y="42" textAnchor="middle" fill="#FFFFFF" fontSize="20" fontWeight="800" fontFamily="Arial,sans-serif">
            UT
          </text>
        </svg>
      );
    case 'uga':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="8" fill="#BA0C2F" />
          <text x="32" y="42" textAnchor="middle" fill="#000000" fontSize="20" fontWeight="800" fontFamily="Arial,sans-serif">
            UGA
          </text>
        </svg>
      );
    case 'oklahoma':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="8" fill="#841617" />
          <text x="32" y="42" textAnchor="middle" fill="#FDF9D8" fontSize="20" fontWeight="800" fontFamily="Arial,sans-serif">
            OU
          </text>
        </svg>
      );
    case 'kentucky':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="8" fill="#0033A0" />
          <text x="32" y="42" textAnchor="middle" fill="#FFFFFF" fontSize="20" fontWeight="800" fontFamily="Arial,sans-serif">
            UK
          </text>
        </svg>
      );
    case 'vandy':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="8" fill="#866D4B" />
          <text x="32" y="40" textAnchor="middle" fill="#000000" fontSize="14" fontWeight="800" fontFamily="Arial,sans-serif">
            VAN
          </text>
        </svg>
      );
    case 'scar':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="8" fill="#73000A" />
          <text x="32" y="40" textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="800" fontFamily="Arial,sans-serif">
            SC
          </text>
        </svg>
      );
    case 'fsu':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="8" fill="#782F40" />
          <text x="32" y="42" textAnchor="middle" fill="#CEB888" fontSize="20" fontWeight="800" fontFamily="Arial,sans-serif">
            FSU
          </text>
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="8" fill="#374151" />
          <text x="32" y="42" textAnchor="middle" fill="#FFFFFF" fontSize="18" fontWeight="800" fontFamily="Arial,sans-serif">
            ?
          </text>
        </svg>
      );
  }
}

export function TeamLogo({ teamId, variant = 'opponent', size = 72, className = '', label }: Props): React.ReactElement {
  const key = variant === 'uf' ? 'uf' : teamId;
  const aria = label ?? (variant === 'uf' ? 'Florida Gators' : teamId);

  return (
    <span
      className={`gv-gw-team-logo${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={aria}
    >
      {logoSvg(key)}
    </span>
  );
}
