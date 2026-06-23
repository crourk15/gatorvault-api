import type { Metadata } from 'next';
import React from 'react';
import { LegalDocumentPage } from '@/components/site/LegalDocumentPage';
import { MEMBERSHIP_TERMS } from '@/lib/legal-content';

export const metadata: Metadata = {
  title: 'Membership Terms | GatorVault',
  description: 'Terms governing GatorVault Insider membership and community use.',
};

export default function TermsPage(): React.ReactElement {
  return <LegalDocumentPage doc={MEMBERSHIP_TERMS} />;
}
