export type AnalystSignal = {
  id: string;
  analyst: string;
  outlet: string;
  confidencePct: number;
  rpmPct: number;
  timestamp: string;
};

export type HighPriorityIntelType = 'BATTLE' | 'VISIT' | 'RPM' | 'NIL' | 'HEAT';

export type HighPriorityIntelItem = {
  id: string;
  slug: string;
  name: string;
  position: string;
  school?: string;
  classYear: number;
  ufProb: number;
  delta7d: number;
  intelType: HighPriorityIntelType;
  intelLabel: string;
  intelSummary: string;
  analystSignals: AnalystSignal[];
  lastUpdated: string;
};
