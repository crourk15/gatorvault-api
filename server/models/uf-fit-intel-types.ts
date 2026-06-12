/**
 * UF Fit signal detail (shared with engine history builder).
 */
import type { SignalType } from '../shared/enums';

export interface UfFitSignalDetail {
  signal_type: SignalType;
  created_at: string;
  signal_value: Record<string, unknown>;
}
