import React, { useEffect, useState, useRef } from 'react';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  Clock, 
  BarChart3, 
  Terminal,
  AlertCircle,
  CheckCircle2,
  Search,
  Settings2,
  ChevronRight,
  ShieldCheck,
  Target,
  Timer,
  ExternalLink,
  Minimize2,
  Maximize2,
  X,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  VolumeX
} from 'lucide-react';
import { 
  AreaChart,
  Area,
  ResponsiveContainer,
  YAxis
} from 'recharts';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'motion/react';
import { Signal, ScannerConfig, ScanLog } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const getFlags = (asset: string) => {
  const pair = asset.replace('-OTC', '');
  const base = pair.substring(0, 3);
  const quote = pair.substring(3, 6);
  
  const map: Record<string, string> = {
    'EUR': 'eu',
    'USD': 'us',
    'GBP': 'gb',
    'JPY': 'jp',
    'AUD': 'au',
    'CAD': 'ca',
    'CHF': 'ch',
    'NZD': 'nz',
    'LTC': 'lt',
    'DOG': 'us',
    'DOT': 'us',
    'BTC': 'us',
    'ETH': 'eu',
    'SOL': 'us',
    'XRP': 'us',
    'ADA': 'us'
  };

  return {
    base: `https://flagcdn.com/w40/${map[base] || 'un'}.png`,
    quote: `https://flagcdn.com/w40/${map[quote] || 'un'}.png`
  };
};

export default function App() {
  const [config, setConfig] = useState<ScannerConfig>({ timeframe: 'M1', marketType: 'GERAL' });
  const [isScanning, setIsScanning] = useState(false);
  const [bestSignal, setBestSignal] = useState<Signal | null>(null);
  const [connected, setConnected] = useState(false);
  const [isBrokerMode, setIsBrokerMode] = useState(false);
  const [brokerUrl, setBrokerUrl] = useState('https://km.iqoption.com/traderoom');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isSignalMinimized, setIsSignalMinimized] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<string | null>(null); // Stores signal timestamp to avoid duplicate feedback
  const [mutedAssets, setMutedAssets] = useState<Record<string, number>>({}); // asset name -> expiry timestamp
  const wsRef = useRef<WebSocket | null>(null);
  const brokerContainerRef = useRef<HTMLDivElement>(null);

  const sendFeedback = async (result: 'win' | 'loss') => {
    if (!bestSignal || feedbackSent === bestSignal.timestamp.toString()) return;

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: bestSignal.asset,
          direction: bestSignal.direction,
          result,
          context: bestSignal.context
        })
      });

      if (response.ok) {
        setFeedbackSent(bestSignal.timestamp.toString());
      }
    } catch (e) {
      console.error('Error sending feedback:', e);
    }
  };

  const muteAsset = (assetName: string) => {
    const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes
    setMutedAssets(prev => ({ ...prev, [assetName]: expiry }));
    // If the muted asset is the current best signal, clear it
    if (bestSignal?.asset === assetName) {
      setBestSignal(null);
    }
  };

  useEffect(() => {
    const handleOrientation = async () => {
      if (isBrokerMode && /Mobi|Android/i.test(navigator.userAgent)) {
        try {
          // Attempt to lock orientation to landscape if supported
          if (screen.orientation && (screen.orientation as any).lock) {
            await (screen.orientation as any).lock('landscape');
          }
        } catch (e) {
          console.log('Orientation lock not supported or requires fullscreen');
        }
      } else {
        try {
          if (screen.orientation && (screen.orientation as any).unlock) {
            screen.orientation.unlock();
          }
        } catch (e) {}
      }
    };

    handleOrientation();
  }, [isBrokerMode]);

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      const { type, data } = JSON.parse(event.data);
      if (type === 'SCAN_RESULT') {
        setBestSignal(data.bestSignal);
        setIsScanning(false);
        setFeedbackSent(null); // Reset feedback for new signal
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Attempt to reconnect after 3 seconds
      setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  };

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, []);

  const openIQOption = () => {
    setBrokerUrl('https://km.iqoption.com/traderoom');
    setIsBrokerMode(true);
  };

  const handleScan = () => {
    if (!connected || isScanning) return;
    setIsScanning(true);
    
    // Clean up expired mutes
    const now = Date.now();
    const activeMutes = Object.fromEntries(
      Object.entries(mutedAssets).filter(([_, expiry]) => (expiry as number) > now)
    );
    if (Object.keys(mutedAssets).length !== Object.keys(activeMutes).length) {
      setMutedAssets(activeMutes);
    }

    // Don't clear bestSignal here so the floating card stays in place
    wsRef.current?.send(JSON.stringify({ 
      type: 'SCAN_MARKET', 
      config,
      mutedAssets: Object.keys(activeMutes)
    }));
  };

  return (
    <div className="h-screen bg-[#0A0A0B] text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/30 overflow-hidden">
      {/* Background Decor (Only in Dashboard Mode) */}
      {!isBrokerMode && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/20 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
        </div>
      )}

      {/* Header / Top Bar */}
      <header className={cn(
        "h-16 border-b border-white/5 flex items-center justify-between px-4 md:px-8 bg-[#141417]/80 backdrop-blur-md sticky top-0 z-50 transition-all",
        isBrokerMode && "h-auto py-2 md:h-16 md:py-0 flex-wrap md:flex-nowrap gap-2 md:gap-3 landscape:h-12 md:landscape:h-16"
      )}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-emerald-500 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Zap className="w-5 h-5 md:w-6 md:h-6 text-black fill-current" />
          </div>
          <div className={cn(isBrokerMode ? "hidden xl:block" : "block")}>
            <h1 className="text-sm md:text-xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">QuantFlow Scanner</h1>
            <p className="text-[8px] md:text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-mono font-semibold">AI Market Intelligence</p>
          </div>
        </div>

        {/* Controls in Header for Broker Mode */}
        {isBrokerMode && (
          <div className="flex items-center gap-2 md:gap-4 bg-black/40 p-1.5 md:p-2 rounded-xl md:rounded-2xl border border-white/5 order-3 w-full md:w-auto md:order-none justify-center">
            <div className="flex items-center gap-2 px-2 hidden lg:flex">
              <Settings2 className="w-3 h-3 text-emerald-500" />
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Ajustes Rápidos</span>
            </div>
            <div className="flex gap-1">
              {['M1', 'M5'].map(tf => (
                <button
                  key={tf}
                  onClick={() => setConfig(prev => ({ ...prev, timeframe: tf as any }))}
                  className={cn(
                    "px-2 md:px-4 py-1 md:py-1.5 rounded-lg text-[9px] md:text-[10px] font-bold transition-all",
                    config.timeframe === tf ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                  )}
                >
                  {tf}
                </button>
              ))}
            </div>
            <div className="w-px h-4 md:h-6 bg-white/10" />
            <select 
              value={config.marketType}
              onChange={(e) => setConfig(prev => ({ ...prev, marketType: e.target.value as any }))}
              className="bg-transparent text-[9px] md:text-[10px] font-bold text-zinc-400 outline-none cursor-pointer hover:text-white transition-colors"
            >
              <option value="REAL">MERCADO REAL</option>
              <option value="OTC">MERCADO OTC</option>
              <option value="GERAL">MODO GERAL</option>
            </select>
            <button
              onClick={handleScan}
              disabled={isScanning || !connected}
              className={cn(
                "px-4 md:px-8 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-[0.15em] transition-all flex items-center gap-2",
                isScanning ? "bg-zinc-800 text-zinc-500" : "bg-emerald-500 text-black hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-emerald-500/20"
              )}
            >
              {isScanning ? <Activity className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
              {isScanning ? 'Scanner...' : 'Analisar'}
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 md:gap-6">
          {!isBrokerMode && (
            <button
              onClick={openIQOption}
              className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all bg-[#141417] border border-white/5 text-zinc-400 hover:text-white hover:border-white/20 group"
            >
              <img 
                src="https://www.google.com/s2/favicons?domain=iqoption.com&sz=32" 
                alt="IQ" 
                className="w-4 h-4 grayscale group-hover:grayscale-0 transition-all" 
              />
              <span>IQ Option</span>
            </button>
          )}

          <button
            onClick={() => isBrokerMode ? setIsBrokerMode(false) : setShowUrlInput(true)}
            className={cn(
              "flex items-center gap-2 px-3 md:px-5 py-1.5 md:py-2.5 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-bold uppercase tracking-widest transition-all border group",
              isBrokerMode 
                ? "bg-red-500/10 border-red-500/50 text-red-500 hover:bg-red-500/20" 
                : "bg-emerald-500/10 border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/20"
            )}
          >
            {isBrokerMode ? <X className="w-3 h-3" /> : <ExternalLink className="w-3 h-3 group-hover:rotate-12 transition-transform" />}
            <span className="hidden sm:inline">{isBrokerMode ? 'Sair Corretora' : 'Abrir Corretora'}</span>
          </button>
          
          <div className="flex items-center gap-2 md:gap-3 bg-black/20 px-3 py-1.5 rounded-full border border-white/5">
            <div className={cn(
              "w-2 h-2 rounded-full animate-pulse",
              connected ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]" : "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]"
            )} />
            <span className="text-[9px] md:text-[10px] font-mono text-zinc-400 uppercase tracking-widest hidden sm:block">
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 relative flex flex-col">
        {isBrokerMode && (
          <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0A0A0B] text-center p-8 md:hidden portrait:flex landscape:hidden">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 animate-bounce">
              <RotateCcw className="w-10 h-10 text-emerald-500" />
            </div>
            <h3 className="text-xl font-black mb-2">Gire seu celular</h3>
            <p className="text-zinc-500 text-sm">Para uma melhor experiência na corretora, utilize o modo paisagem (horizontal).</p>
          </div>
        )}

        {isBrokerMode ? (
          <div ref={brokerContainerRef} className="flex-1 w-full h-full bg-black relative overflow-hidden">
            <iframe 
              src={brokerUrl} 
              className="w-full h-full border-none"
              title="Broker"
            />
            
            {/* Floating Signal Card */}
            {bestSignal && (
              <motion.div 
                drag
                dragConstraints={brokerContainerRef}
                dragMomentum={false}
                dragElastic={0.1}
                className={cn(
                  "fixed bottom-4 right-4 left-4 md:left-auto md:bottom-8 md:right-8 md:w-[420px] bg-[#141417] border border-white/10 rounded-2xl md:rounded-3xl shadow-2xl z-[60] cursor-move transition-opacity",
                  isSignalMinimized ? "h-14 md:h-16 overflow-hidden" : "h-auto",
                  isScanning && "opacity-70 pointer-events-none"
                )}
              >
                <div className={cn(
                  "p-3 md:p-4 flex items-center justify-between cursor-pointer border-b border-white/5",
                  bestSignal.direction === 'CALL' ? "bg-emerald-500/10" : "bg-red-500/10"
                )} onClick={() => setIsSignalMinimized(!isSignalMinimized)}>
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="relative flex items-center">
                      <img src={getFlags(bestSignal.asset).base} alt="B" className="w-5 h-5 md:w-6 md:h-6 rounded-full border border-black z-10" />
                      <img src={getFlags(bestSignal.asset).quote} alt="Q" className="w-5 h-5 md:w-6 md:h-6 rounded-full border border-black -ml-2" />
                    </div>
                    <span className="text-[10px] md:text-xs font-black">{bestSignal.asset}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[9px] md:text-[10px] font-bold uppercase",
                      bestSignal.direction === 'CALL' ? "text-emerald-500" : "text-red-500"
                    )}>{bestSignal.direction}</span>
                    {isSignalMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
                  </div>
                </div>

                {!isSignalMinimized && (
                  <div className="p-4 space-y-4">
                    <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-4">
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={(e) => { e.stopPropagation(); sendFeedback('win'); }}
                          disabled={feedbackSent === bestSignal.timestamp.toString()}
                          className={cn(
                            "flex flex-col items-center gap-1 transition-all",
                            feedbackSent === bestSignal.timestamp.toString() ? "opacity-50" : "hover:text-emerald-500 text-zinc-500"
                          )}
                        >
                          <ThumbsUp className="w-4 h-4" />
                          <span className="text-[7px] font-bold uppercase">Win</span>
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); sendFeedback('loss'); }}
                          disabled={feedbackSent === bestSignal.timestamp.toString()}
                          className={cn(
                            "flex flex-col items-center gap-1 transition-all",
                            feedbackSent === bestSignal.timestamp.toString() ? "opacity-50" : "hover:text-red-500 text-zinc-500"
                          )}
                        >
                          <ThumbsDown className="w-4 h-4" />
                          <span className="text-[7px] font-bold uppercase">Loss</span>
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); muteAsset(bestSignal.asset); }}
                          className="flex flex-col items-center gap-1 transition-all hover:text-amber-500 text-zinc-500"
                          title="Silenciar por 5 min"
                        >
                          <VolumeX className="w-4 h-4" />
                          <span className="text-[7px] font-bold uppercase">Mute</span>
                        </button>
                      </div>
                      <div className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Feedback</div>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="text-center">
                        <p className="text-[8px] text-zinc-500 uppercase font-bold">Entrada</p>
                        <p className="text-xs font-black">{format(new Date(bestSignal.entryTimestamp), 'HH:mm:ss')}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[8px] text-zinc-500 uppercase font-bold">Winrate</p>
                        <p className="text-xs font-black text-emerald-500">{bestSignal.winrate.toFixed(1)}%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[8px] text-zinc-500 uppercase font-bold">Exp</p>
                        <p className="text-xs font-black">{bestSignal.expiration}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {bestSignal.confluences.slice(0, 3).map(c => (
                        <span key={c} className="text-[8px] bg-white/5 px-1.5 py-0.5 rounded text-zinc-400 border border-white/5">{c}</span>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        ) : (
          <main className="flex-1 overflow-y-auto p-4 md:p-8 md:px-12 lg:px-16 w-full grid grid-cols-12 gap-4 md:gap-8 relative z-10">
            {/* Left: Configuration Panel */}
            <div className="col-span-12 lg:col-span-4 space-y-6">
              <div className="bg-[#141417] border border-white/5 rounded-2xl p-6 shadow-xl hover:border-emerald-500/20 transition-colors group">
                <div className="flex items-center gap-2 mb-6">
                  <Settings2 className="w-4 h-4 text-emerald-500 group-hover:rotate-90 transition-transform duration-500" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Configurações de Análise</h2>
                </div>

                <div className="space-y-6">
                  {/* Timeframe */}
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Timeframe</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['M1', 'M5'].map(tf => (
                        <button
                          key={tf}
                          onClick={() => setConfig(prev => ({ ...prev, timeframe: tf as any }))}
                          className={cn(
                            "py-3 rounded-xl text-xs font-bold transition-all border",
                            config.timeframe === tf 
                              ? "bg-emerald-500 text-black border-emerald-500 shadow-lg shadow-emerald-500/20" 
                              : "bg-[#0A0A0B] text-zinc-400 border-white/5 hover:border-white/10"
                          )}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Market Type */}
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Tipo de Mercado</label>
                    <div className="flex flex-col gap-2">
                      {[
                        { id: 'REAL', label: 'Apenas Mercado Real' },
                        { id: 'OTC', label: 'Apenas OTC' },
                        { id: 'GERAL', label: 'Geral (Real + OTC)' }
                      ].map(m => (
                        <button
                          key={m.id}
                          onClick={() => setConfig(prev => ({ ...prev, marketType: m.id as any }))}
                          className={cn(
                            "px-4 py-3 rounded-xl text-xs font-bold transition-all border text-left flex items-center justify-between",
                            config.marketType === m.id 
                              ? "bg-white/5 text-emerald-500 border-emerald-500/50" 
                              : "bg-[#0A0A0B] text-zinc-400 border-white/5 hover:border-white/10"
                          )}
                        >
                          {m.label}
                          {config.marketType === m.id && <CheckCircle2 className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleScan}
                    disabled={isScanning || !connected}
                    className={cn(
                      "w-full py-4 rounded-2xl text-sm font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3",
                      isScanning 
                        ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" 
                        : "bg-emerald-500 text-black hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-emerald-500/20"
                    )}
                  >
                    {isScanning ? (
                      <>
                        <Activity className="w-5 h-5 animate-spin" />
                        Escaneando...
                      </>
                    ) : (
                      <>
                        <Search className="w-5 h-5" />
                        Analisar Mercado
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Quick Access */}
              <div className="bg-[#141417] border border-white/5 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-2 mb-6">
                  <Zap className="w-4 h-4 text-emerald-500" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Acesso Rápido</h2>
                </div>
                <button
                  onClick={openIQOption}
                  className="w-full py-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/20 transition-all flex items-center justify-center gap-3 group"
                >
                  <img 
                    src="https://www.google.com/s2/favicons?domain=iqoption.com&sz=32" 
                    alt="IQ" 
                    className="w-5 h-5 grayscale group-hover:grayscale-0 transition-all" 
                  />
                  <span className="text-xs font-bold text-zinc-400 group-hover:text-white">Abrir IQ Option</span>
                </button>
              </div>
            </div>

            {/* Right: Signal Display */}
            <div className="col-span-12 lg:col-span-8">
              {bestSignal ? (
                <div className="bg-[#141417] border border-white/5 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500 hover:border-emerald-500/20 transition-colors">
                  {/* Signal Header */}
                  <div className={cn(
                    "p-6 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-0",
                    bestSignal.direction === 'CALL' ? "bg-emerald-500/10" : "bg-red-500/10"
                  )}>
                    <div className="flex items-center gap-4 md:gap-6">
                      <div className="relative flex items-center">
                        <img 
                          src={getFlags(bestSignal.asset).base} 
                          alt="Base" 
                          className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-[#141417] z-10 shadow-lg"
                          referrerPolicy="no-referrer"
                        />
                        <img 
                          src={getFlags(bestSignal.asset).quote} 
                          alt="Quote" 
                          className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-[#141417] -ml-4 shadow-lg"
                          referrerPolicy="no-referrer"
                        />
                        <div className={cn(
                          "absolute -bottom-1 -right-1 w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center shadow-lg z-20",
                          bestSignal.direction === 'CALL' ? "bg-emerald-500 text-black" : "bg-red-500 text-white"
                        )}>
                          {bestSignal.direction === 'CALL' ? <TrendingUp className="w-3 h-3 md:w-4 md:h-4" /> : <TrendingDown className="w-3 h-3 md:w-4 md:h-4" />}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 md:gap-3 mb-1">
                          <h3 className="text-xl md:text-3xl font-black tracking-tighter">{bestSignal.asset}</h3>
                          <span className="px-1.5 py-0.5 bg-white/10 rounded text-[8px] md:text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                            {bestSignal.marketType}
                          </span>
                        </div>
                        <p className={cn(
                          "text-[10px] md:text-sm font-bold uppercase tracking-widest",
                          bestSignal.direction === 'CALL' ? "text-emerald-500" : "text-red-500"
                        )}>
                          {bestSignal.direction === 'CALL' ? 'Compra' : 'Venda'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-6">
                      <div className="flex items-center gap-4 bg-black/20 px-4 py-2 rounded-2xl border border-white/5">
                        <button 
                          onClick={() => sendFeedback('win')}
                          disabled={feedbackSent === bestSignal.timestamp.toString()}
                          className={cn(
                            "flex flex-col items-center gap-1 transition-all",
                            feedbackSent === bestSignal.timestamp.toString() ? "opacity-50 cursor-not-allowed" : "hover:scale-110 text-zinc-500 hover:text-emerald-500"
                          )}
                        >
                          <ThumbsUp className="w-5 h-5" />
                          <span className="text-[9px] font-bold uppercase">Win</span>
                        </button>
                        <div className="w-px h-6 bg-white/10" />
                        <button 
                          onClick={() => sendFeedback('loss')}
                          disabled={feedbackSent === bestSignal.timestamp.toString()}
                          className={cn(
                            "flex flex-col items-center gap-1 transition-all",
                            feedbackSent === bestSignal.timestamp.toString() ? "opacity-50 cursor-not-allowed" : "hover:scale-110 text-zinc-500 hover:text-red-500"
                          )}
                        >
                          <ThumbsDown className="w-5 h-5" />
                          <span className="text-[9px] font-bold uppercase">Loss</span>
                        </button>
                        <div className="w-px h-6 bg-white/10" />
                        <button 
                          onClick={() => muteAsset(bestSignal.asset)}
                          className="flex flex-col items-center gap-1 transition-all hover:scale-110 text-zinc-500 hover:text-amber-500"
                          title="Silenciar este ativo por 5 min"
                        >
                          <VolumeX className="w-5 h-5" />
                          <span className="text-[9px] font-bold uppercase">Mute</span>
                        </button>
                      </div>

                      <div className="text-center md:text-right">
                      <div className="text-3xl md:text-4xl font-black tracking-tighter text-white mb-1">{bestSignal.winrate.toFixed(1)}%</div>
                      <p className="text-[8px] md:text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Winrate Estimado</p>
                    </div>
                  </div>
                </div>

                {/* Signal Details Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 border-y border-white/5">
                    {[
                      { icon: Clock, label: 'Horário Entrada', value: format(new Date(bestSignal.entryTimestamp), 'HH:mm:ss'), color: 'text-white' },
                      { icon: Timer, label: 'Expiração', value: bestSignal.expiration, color: 'text-white' },
                      { icon: ShieldCheck, label: 'Confiança', value: bestSignal.confidence, color: 'text-emerald-500' },
                      { icon: Target, label: 'Preço Atual', value: bestSignal.price.toFixed(5), color: 'text-zinc-400' },
                    ].map((item, i) => (
                      <div key={i} className="bg-[#141417] p-6 md:p-10 flex flex-col items-center text-center gap-3 hover:bg-white/[0.02] transition-colors group">
                        <item.icon className="w-4 h-4 md:w-5 md:h-5 text-zinc-600 group-hover:text-emerald-500 transition-colors" />
                        <p className="text-[9px] md:text-[10px] text-zinc-500 uppercase tracking-widest font-bold">{item.label}</p>
                        <p className={cn("text-sm md:text-lg font-black font-mono", item.color)}>{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Confluences */}
                  <div className="p-8 space-y-4">
                    <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Análise de Confluências</h4>
                    <div className="flex flex-wrap gap-2">
                      {bestSignal.confluences.map(c => (
                        <div key={c} className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl border border-white/5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span className="text-[11px] font-bold text-zinc-300">{c}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer Action */}
                  <div className="p-8 bg-white/[0.02] border-t border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-zinc-500">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-[10px] uppercase tracking-widest font-bold">Aguarde o horário exato para entrar</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] text-emerald-500 font-mono uppercase font-bold">Sinal Válido</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full min-h-[500px] border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center text-center p-12">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                    <Search className="w-10 h-10 text-zinc-700" />
                  </div>
                  <h3 className="text-xl font-bold text-zinc-400 mb-2">Nenhum sinal ativo</h3>
                  <p className="text-sm text-zinc-600 max-w-xs">
                    Clique em <span className="text-emerald-500 font-bold">Analisar Mercado</span> para que a IA escaneie as melhores oportunidades no momento.
                  </p>
                </div>
              )}
            </div>
          </main>
        )}
      </div>

      {/* URL Input Modal */}
      {showUrlInput && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#141417] border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-black mb-6">Configurar Corretora</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-zinc-500">Link da Corretora</label>
                <input 
                  type="text" 
                  value={brokerUrl}
                  onChange={(e) => setBrokerUrl(e.target.value)}
                  placeholder="https://corretora.com"
                  className="w-full bg-black border border-white/5 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setShowUrlInput(false)}
                  className="flex-1 py-3 rounded-xl text-xs font-bold text-zinc-500 hover:bg-white/5 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    setIsBrokerMode(true);
                    setShowUrlInput(false);
                  }}
                  className="flex-1 py-3 rounded-xl text-xs font-bold bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                >
                  Abrir Agora
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer (Only in Dashboard Mode) */}
      {!isBrokerMode && (
        <footer className="h-12 border-t border-white/5 flex items-center justify-between px-8 bg-[#0A0A0B] text-[9px] text-zinc-600 uppercase tracking-[0.2em] font-bold">
          <div className="flex items-center gap-6">
            <span>QuantFlow Engine v3.0</span>
            <span>No Martingale Mode</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-emerald-500" />
            <span>Market Scanner Active</span>
          </div>
        </footer>
      )}
    </div>
  );
}
