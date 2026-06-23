import type { Metadata } from 'next';
import React from 'react';
import { LegalDocumentPage } from '@/components/site/LegalDocumentPage';
import { PRIVACY_POLICY } from '@/lib/legal-content';

export const metadata: Metadata = {
  title: 'Privacy Policy | GatorVault',
  description: 'How GatorVault collects, uses, and protects your information.',
};

export default function PrivacyPage(): React.ReactElement {
  return <LegalDocumentPage doc={PRIVACY_POLICY} />;
}
