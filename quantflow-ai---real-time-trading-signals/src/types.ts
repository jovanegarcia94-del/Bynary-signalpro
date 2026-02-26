export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Indicators {
  rsi: number | null;
  macd: {
    value: number | null;
    signal: number | null;
    histogram: number | null;
  };
  sma16: number | null;
  fractal: 'top' | 'bottom' | null;
  trend: 'up' | 'down' | 'neutral';
}

export interface Signal {
  timestamp: number;
  asset: string;
  marketType: 'REAL' | 'OTC';
  direction: 'CALL' | 'PUT' | 'NEUTRAL';
  confluences: string[];
  strength: 'Weak' | 'Medium' | 'Strong' | 'None';
  confidence: 'Baixa' | 'Média' | 'Alta' | 'Muito Alta';
  winrate: number;
  price: number;
  entryTimestamp: number;
  entryTime: string;
  expiration: string;
  context?: {
    rsi: number | null;
    macdHist: number | null;
    trend: string;
    confluences: string[];
  };
}

export interface ScannerConfig {
  timeframe: 'M1' | 'M5';
  marketType: 'REAL' | 'OTC' | 'GERAL';
}

export interface MarketState {
  assets: Record<string, {
    candles: Candle[];
    indicators: Indicators;
    marketType: 'REAL' | 'OTC';
  }>;
  lastBestSignal: Signal | null;
}

export interface ScanLog {
  time: string;
  asset: string;
  status: 'analyzed' | 'discarded' | 'selected';
  reason?: string;
}

export interface Feedback {
  asset: string;
  direction: 'CALL' | 'PUT';
  result: 'win' | 'loss';
  timestamp: number;
  context?: {
    rsi: number | null;
    macdHist: number | null;
    trend: string;
    confluences: string[];
  };
}
