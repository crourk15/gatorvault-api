import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'GatorVault Insider — Unlock Full Recruiting Intel',
  description:
    'FutureCast Elite, staff notes, portal intel, and game-week analytics for dedicated Florida Gators recruiting insiders.',
  openGraph: {
    title: 'GatorVault Insider — Unlock Full Recruiting Intel',
    description:
      'Join GatorVault Insider for FutureCast Elite, movement intel, staff notes, and live portal tracking.',
    images: ['/og-image.jpg'],
  },
};

export default function InsiderLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <>{children}</>;
}
