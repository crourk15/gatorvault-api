'use client';

import React from 'react';
import { AlertsFeed } from '@/components/futurecast/AlertsFeed';

/** Legacy /alerts — redirects to canonical FutureCast alerts in nav. */
export default function AlertsPage(): React.ReactElement {
  return <AlertsFeed />;
}
