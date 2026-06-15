'use client';

import React from 'react';
import { ABWelcomePage } from '@/components/welcome/ABWelcomePage';

/** @deprecated Use WelcomeA — kept for direct imports. */
export function WelcomePage(): React.ReactElement {
  return <ABWelcomePage />;
}

export { WelcomeA } from './WelcomeA';
export { WelcomeB } from './WelcomeB';
export { ABWelcomePage } from './ABWelcomePage';
