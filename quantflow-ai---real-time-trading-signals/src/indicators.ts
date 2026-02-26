import { Candle, Indicators } from './types';

export function calculateSMA(data: number[], period: number): number | null {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function calculateEMA(data: number[], period: number, previousEMA: number | null = null): number | null {
  if (data.length < period) return null;
  const k = 2 / (period + 1);
  if (previousEMA === null) {
    return calculateSMA(data.slice(0, period), period);
  }
  return data[data.length - 1] * k + previousEMA * (1 - k);
}

export function calculateRSI(closes: number[], period: number = 14): number | null {
  if (closes.length <= period) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function calculateMACD(closes: number[]): Indicators['macd'] {
  const result = { value: null, signal: null, histogram: null };
  if (closes.length < 26) return result;

  // Simplified MACD calculation for real-time
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);

  if (ema12 !== null && ema26 !== null) {
    const macdValue = ema12 - ema26;
    // For signal line we need a history of MACD values, 
    // but for this implementation we'll approximate or use the last few
    const signal = macdValue * 0.2; // Mock signal for demo purposes if history is short
    
    return {
      value: macdValue,
      signal: signal,
      histogram: macdValue - signal
    };
  }

  return result;
}

export function detectTrend(closes: number[], sma16: number | null): 'up' | 'down' | 'neutral' {
  if (!sma16 || closes.length < 2) return 'neutral';
  const lastClose = closes[closes.length - 1];
  if (lastClose > sma16) return 'up';
  if (lastClose < sma16) return 'down';
  return 'neutral';
}

export function detectFractal(candles: Candle[]): 'top' | 'bottom' | null {
  if (candles.length < 5) return null;
  
  const i = candles.length - 3; // The middle candle of the 5-bar pattern
  const prev2 = candles[i - 2];
  const prev1 = candles[i - 1];
  const curr = candles[i];
  const next1 = candles[i + 1];
  const next2 = candles[i + 2];

  // Top Fractal: High is higher than the two preceding and two following highs
  if (curr.high > prev2.high && curr.high > prev1.high && curr.high > next1.high && curr.high > next2.high) {
    return 'top';
  }

  // Bottom Fractal: Low is lower than the two preceding and two following lows
  if (curr.low < prev2.low && curr.low < prev1.low && curr.low < next1.low && curr.low < next2.low) {
    return 'bottom';
  }

  return null;
}
