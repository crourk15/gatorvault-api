import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'GatorVault — Every Florida recruiting storyline. One place.',
  description:
    'The 2028 board, campus visits, Game Week, and film for Florida fans. 30-day free trial — no card required.',
  openGraph: {
    title: 'GatorVault — Every Florida recruiting storyline. One place.',
    description:
      'The board, the visits, Game Week, and the film — built by Florida fans who follow the class as closely as you do.',
    images: ['/og-image.jpg'],
  },
};

export default function WelcomeLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <>{children}</>;
}
