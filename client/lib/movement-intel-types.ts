/** Elite Movement Intel — shared client/server contract. */

export type MovementIntelItem = {
  id: string;
  slug?: string;
  name: string;
  position: string;
  school: string;
  ufProb: number;
  delta: number;
  movementType: 'RISE' | 'FALL' | 'VOLATILE';
  lastUpdate: string;
  tags: string[];
};

export type MovementIntelAlert = {
  id: string;
  type: 'VISIT' | 'OFFER' | 'STAFF_NOTE' | 'PREDICTION_SHIFT';
  player: string;
  detail: string;
  timestamp: string;
};

export type MovementIntelResponse = {
  ok?: boolean;
  updatedAt?: string;
  risers: MovementIntelItem[];
  fallers: MovementIntelItem[];
  volatile: MovementIntelItem[];
  alerts: MovementIntelAlert[];
};
