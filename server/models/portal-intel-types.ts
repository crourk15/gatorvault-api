/**
 * Portal Intelligence shared types.
 */
import type { SignalType } from '../shared/enums';

export interface PortalSignalDetail {
  signal_type: SignalType;
  created_at: string;
  signal_value: Record<string, unknown>;
}
