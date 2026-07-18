'use client';

import React from 'react';
import { RouteErrorFallback } from '@/components/errors/RouteErrorFallback';
import { tryRecoverFromChunkError } from '@/lib/chunk-error-recovery';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class VaultErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[VaultErrorBoundary]', error.message, info.componentStack);
    if (tryRecoverFromChunkError(error)) return;
  }

  private retry = (): void => {
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <RouteErrorFallback
          error={this.state.error}
          title="This Vault page failed to load"
          onRetry={this.retry}
          dashboardHref="/vault/"
          dashboardLabel="Go to Home"
        />
      );
    }
    return this.props.children;
  }
}
