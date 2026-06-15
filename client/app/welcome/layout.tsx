import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'GatorVault — Florida Recruiting. Reimagined.',
  description:
    'FutureCast Elite, insider notes, portal intel, film room, and real-time recruiting analytics for Florida Gators fans.',
  openGraph: {
    title: 'GatorVault — Florida Recruiting. Reimagined.',
    description:
      'The most advanced Florida recruiting platform. FutureCast Elite, insider intel, portal movement, and film evaluations.',
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
