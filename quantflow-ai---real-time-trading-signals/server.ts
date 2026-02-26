import express from 'express';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import { Candle, Indicators, Signal, MarketState, ScannerConfig, ScanLog, Feedback } from './src/types';
import { calculateRSI, calculateMACD, calculateSMA, detectFractal, detectTrend } from './src/indicators';
import { format, addMinutes, startOfMinute, setSeconds } from 'date-fns';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = 3000;
app.use(express.json());

const FEEDBACK_FILE = path.join(process.cwd(), 'feedback_db.json');

// Load feedback from "database"
let feedbackHistory: Feedback[] = [];
try {
  if (fs.existsSync(FEEDBACK_FILE)) {
    feedbackHistory = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf-8'));
  }
} catch (e) {
  console.error('Error loading feedback:', e);
}

function saveFeedback() {
  try {
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(feedbackHistory, null, 2));
  } catch (e) {
    console.error('Error saving feedback:', e);
  }
}

// Assets Simulation - Expanded for Quadcode-style brokers
const ASSETS = [
  // REAL Forex
  { name: 'EURUSD', type: 'REAL' },
  { name: 'GBPUSD', type: 'REAL' },
  { name: 'USDJPY', type: 'REAL' },
  { name: 'AUDUSD', type: 'REAL' },
  { name: 'USDCAD', type: 'REAL' },
  { name: 'EURJPY', type: 'REAL' },
  { name: 'EURGBP', type: 'REAL' },
  { name: 'GBPJPY', type: 'REAL' },
  { name: 'AUDJPY', type: 'REAL' },
  { name: 'NZDUSD', type: 'REAL' },
  
  // OTC Forex
  { name: 'EURUSD-OTC', type: 'OTC' },
  { name: 'GBPUSD-OTC', type: 'OTC' },
  { name: 'USDJPY-OTC', type: 'OTC' },
  { name: 'AUDCAD-OTC', type: 'OTC' },
  { name: 'EURGBP-OTC', type: 'OTC' },
  { name: 'USDCHF-OTC', type: 'OTC' },
  { name: 'NZDUSD-OTC', type: 'OTC' },
  { name: 'AUDUSD-OTC', type: 'OTC' },
  { name: 'GBPJPY-OTC', type: 'OTC' },
  { name: 'EURJPY-OTC', type: 'OTC' },
  { name: 'CADJPY-OTC', type: 'OTC' },
  { name: 'CHFJPY-OTC', type: 'OTC' },
  { name: 'AUDNZD-OTC', type: 'OTC' },
  { name: 'EURCAD-OTC', type: 'OTC' },
  { name: 'GBPCAD-OTC', type: 'OTC' },

  // Crypto
  { name: 'BTCUSD', type: 'REAL' },
  { name: 'ETHUSD', type: 'REAL' },
  { name: 'SOLUSD', type: 'REAL' },
  { name: 'XRPUSD', type: 'REAL' },
  { name: 'ADAUSD', type: 'REAL' },
  { name: 'DOGEUSD', type: 'REAL' },
  { name: 'DOTUSD', type: 'REAL' },
  { name: 'BTCUSD-OTC', type: 'OTC' },
  { name: 'ETHUSD-OTC', type: 'OTC' },
  { name: 'LTCUSD-OTC', type: 'OTC' }
] as const;

let marketData: Record<string, { candles: Candle[], marketType: 'REAL' | 'OTC' }> = {};

// Initialize assets
ASSETS.forEach(asset => {
  let candles: Candle[] = [];
  let lastPrice = 1.0 + Math.random();
  for (let i = 0; i < 100; i++) {
    const change = (Math.random() - 0.5) * 0.0005;
    const open = lastPrice;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * 0.0002;
    const low = Math.min(open, close) - Math.random() * 0.0002;
    candles.push({
      time: Date.now() - (100 - i) * 60000,
      open, high, low, close,
      volume: Math.random() * 100
    });
    lastPrice = close;
  }
  marketData[asset.name] = { candles, marketType: asset.type as 'REAL' | 'OTC' };
});

function getIndicators(candles: Candle[]): Indicators {
  const closes = candles.map(c => c.close);
  const rsi = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);
  const sma16 = calculateSMA(closes, 16);
  return {
    rsi,
    macd,
    sma16,
    fractal: detectFractal(candles),
    trend: detectTrend(closes, sma16)
  };
}

function analyzeAsset(assetName: string, config: ScannerConfig): Signal | null {
  const data = marketData[assetName];
  if (!data) return null;
  
  const { candles, marketType } = data;
  const indicators = getIndicators(candles);
  const lastCandle = candles[candles.length - 1];
  const closes = candles.map(c => c.close);

  let direction: Signal['direction'] = 'NEUTRAL';
  let confluences: string[] = [];

  // BUY Rules
  const buyFractal = indicators.fractal === 'bottom';
  const buyRSI = indicators.rsi !== null && indicators.rsi > 50;
  const buyMACD = indicators.macd.histogram !== null && indicators.macd.histogram > 0;
  const buySMA = indicators.sma16 !== null && lastCandle.close > indicators.sma16;
  const buyTrend = indicators.trend === 'up';

  if (buyFractal || buyRSI || buyMACD || buySMA || buyTrend) {
    if (buyFractal) confluences.push('Fractal Fundo');
    if (buyRSI) confluences.push('RSI > 50');
    if (buyMACD) confluences.push('MACD Positivo');
    if (buySMA) confluences.push('Preço > SMA16');
    if (buyTrend) confluences.push('Tendência Alta');
    if (confluences.length >= 2) direction = 'CALL';
  }

  // SELL Rules
  if (direction === 'NEUTRAL') {
    const sellFractal = indicators.fractal === 'top';
    const sellRSI = indicators.rsi !== null && indicators.rsi < 50;
    const sellMACD = indicators.macd.histogram !== null && indicators.macd.histogram < 0;
    const sellSMA = indicators.sma16 !== null && lastCandle.close < indicators.sma16;
    const sellTrend = indicators.trend === 'down';

    if (sellFractal || sellRSI || sellMACD || sellSMA || sellTrend) {
      if (sellFractal) confluences.push('Fractal Topo');
      if (sellRSI) confluences.push('RSI < 50');
      if (sellMACD) confluences.push('MACD Negativo');
      if (sellSMA) confluences.push('Preço < SMA16');
      if (sellTrend) confluences.push('Tendência Baixa');
      if (confluences.length >= 2) direction = 'PUT';
    }
  }

  if (direction === 'NEUTRAL') return null;

  // AI Learning: Check for similar patterns that resulted in losses
  const similarLosses = feedbackHistory.filter(f => 
    f.asset === assetName && 
    f.result === 'loss' &&
    f.direction === direction &&
    f.context &&
    // Check if confluences are similar (at least 70% match)
    f.context.confluences.filter(c => confluences.includes(c)).length / Math.max(f.context.confluences.length, confluences.length) >= 0.7
  );

  let lossPenalty = 0;
  if (similarLosses.length > 0) {
    // If we have similar losses, penalize heavily to avoid repeating the mistake
    lossPenalty = -similarLosses.length * 5;
  }

  // AI Improvement: Adjust winrate based on general feedback history
  const recentFeedback = feedbackHistory.filter(f => f.asset === assetName).slice(-20);
  const losses = recentFeedback.filter(f => f.result === 'loss').length;
  const wins = recentFeedback.filter(f => f.result === 'win').length;
  
  let winrateAdjustment = 0;
  if (losses > wins) {
    winrateAdjustment = -(losses - wins) * 2; // Penalize if losing
  } else if (wins > losses) {
    winrateAdjustment = (wins - losses) * 1; // Reward if winning
  }

  // Calculate Entry Time
  let entryDate = new Date();
  let expiration = '';
  if (config.timeframe === 'M1') {
    // M1 -> Next candle with 2 min prep
    entryDate = addMinutes(startOfMinute(entryDate), 2);
    expiration = '1 min';
  } else {
    // M5 -> Round times (05, 10, 15...)
    const mins = entryDate.getMinutes();
    const nextRound = Math.ceil((mins + 1) / 5) * 5;
    entryDate = setSeconds(startOfMinute(addMinutes(entryDate, nextRound - mins)), 0);
    expiration = '5 min';
  }

  const winrate = 75 + (confluences.length * 5) + (Math.random() * 5) + winrateAdjustment + lossPenalty;
  let confidence: Signal['confidence'] = 'Baixa';
  if (confluences.length === 3) confidence = 'Média';
  if (confluences.length === 4) confidence = 'Alta';
  if (confluences.length >= 5) confidence = 'Muito Alta';

  return {
    timestamp: Date.now(),
    asset: assetName,
    marketType,
    direction,
    confluences,
    strength: confluences.length >= 4 ? 'Strong' : confluences.length >= 3 ? 'Medium' : 'Weak',
    confidence,
    winrate: Math.max(0, Math.min(winrate, 100)),
    price: lastCandle.close,
    entryTimestamp: entryDate.getTime(),
    entryTime: format(entryDate, 'HH:mm:ss'),
    expiration,
    context: {
      rsi: indicators.rsi,
      macdHist: indicators.macd.histogram,
      trend: indicators.trend,
      confluences
    }
  };
}

async function startServer() {
  // Endpoint for feedback
  app.post('/api/feedback', (req, res) => {
    const feedback: Feedback = req.body;
    if (!feedback.asset || !feedback.result) {
      return res.status(400).json({ error: 'Invalid feedback' });
    }
    feedback.timestamp = Date.now();
    feedbackHistory.push(feedback);
    saveFeedback();
    console.log(`Feedback received for ${feedback.asset}: ${feedback.result}`);
    res.json({ status: 'ok', historySize: feedbackHistory.length });
  });

  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });

  const wss = new WebSocketServer({ server });

  // Update market data periodically
  setInterval(() => {
    ASSETS.forEach(asset => {
      const data = marketData[asset.name];
      const lastCandle = data.candles[data.candles.length - 1];
      const change = (Math.random() - 0.5) * 0.0004;
      lastCandle.close += change;
      lastCandle.high = Math.max(lastCandle.high, lastCandle.close);
      lastCandle.low = Math.min(lastCandle.low, lastCandle.close);
      lastCandle.time = Date.now();
    });
  }, 2000);

  wss.on('connection', (ws) => {
    let lastSignalInfo: { asset: string, entryTimestamp: number } | null = null;

    ws.on('message', (message) => {
      const { type, config, mutedAssets } = JSON.parse(message.toString());
      
      if (type === 'SCAN_MARKET') {
        const scannerConfig = config as ScannerConfig;
        const mutedList = (mutedAssets as string[]) || [];
        const logs: ScanLog[] = [];
        let bestSignal: Signal | null = null;

        ASSETS.forEach(asset => {
          // Filter by muted assets
          if (mutedList.includes(asset.name)) {
            logs.push({ 
              time: format(new Date(), 'HH:mm:ss'), 
              asset: asset.name, 
              status: 'discarded', 
              reason: 'Ativo silenciado pelo usuário' 
            });
            return;
          }

          // Filter by market type
          if (scannerConfig.marketType !== 'GERAL' && asset.type !== scannerConfig.marketType) {
            logs.push({ time: format(new Date(), 'HH:mm:ss'), asset: asset.name, status: 'discarded', reason: 'Tipo de mercado filtrado' });
            return;
          }

          const signal = analyzeAsset(asset.name, scannerConfig);
          if (signal) {
            // Filter by winrate (90% to 100%)
            if (signal.winrate < 90) {
              logs.push({ 
                time: format(new Date(), 'HH:mm:ss'), 
                asset: asset.name, 
                status: 'discarded', 
                reason: `Winrate insuficiente (${signal.winrate.toFixed(1)}%)` 
              });
              return;
            }

            // Prevent repeating the same asset within the same entry cycle
            if (lastSignalInfo && signal.asset === lastSignalInfo.asset && signal.entryTimestamp === lastSignalInfo.entryTimestamp) {
              logs.push({ 
                time: format(new Date(), 'HH:mm:ss'), 
                asset: asset.name, 
                status: 'discarded', 
                reason: 'Sinal já enviado para este horário' 
              });
              return;
            }

            logs.push({ time: format(new Date(), 'HH:mm:ss'), asset: asset.name, status: 'analyzed' });
            if (!bestSignal || signal.winrate > bestSignal.winrate) {
              bestSignal = signal;
            }
          } else {
            logs.push({ time: format(new Date(), 'HH:mm:ss'), asset: asset.name, status: 'discarded', reason: 'Sem confluência mínima' });
          }
        });

        if (bestSignal) {
          lastSignalInfo = { 
            asset: (bestSignal as Signal).asset, 
            entryTimestamp: (bestSignal as Signal).entryTimestamp 
          };
          logs.push({ time: format(new Date(), 'HH:mm:ss'), asset: (bestSignal as Signal).asset, status: 'selected' });
        }

        ws.send(JSON.stringify({ type: 'SCAN_RESULT', data: { bestSignal, logs } }));
      }
    });
  });
}

startServer();
