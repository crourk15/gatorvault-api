import React from 'react';
import {
  insiderBadgeName,
  insiderBadgeSrc,
  type InsiderBadgeLevel,
} from '@/lib/gatorvault-brand-assets';

export function InsiderBadge({
  level,
  className = 'gv-brand-badge',
  size = 48,
}: {
  level: InsiderBadgeLevel;
  className?: string;
  size?: number;
}): React.ReactElement {
  const label = insiderBadgeName(level);
  return (
    <img
      src={insiderBadgeSrc(level)}
      alt={label}
      title={label}
      className={className}
      width={size}
      height={size}
      loading="lazy"
    />
  );
}
