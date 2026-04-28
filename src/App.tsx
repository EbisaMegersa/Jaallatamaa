/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useAnimationControls } from 'motion/react';
import { User, Wallet, Play, LogOut, ExternalLink, Zap, TrendingUp, Info } from 'lucide-react';

interface FloatingText {
  id: number;
  x: number;
  y: number;
  value: string;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initDataUnsafe: {
          user?: {
            id: number;
            username?: string;
            first_name: string;
          };
        };
      };
    };
  }
}

export default function App() {
  const [balance, setBalance] = useState(0);
  const [username, setUsername] = useState('Explorer');
  const [userId, setUserId] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [energy, setEnergy] = useState(100);
  
  const tapControls = useAnimationControls();
  const incrementValue = 0.05; 
  const maxEnergy = 100;
  const nextItemId = useRef(0);

  // Load user data
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 10;

    const initTelegram = () => {
      const tg = window.Telegram?.WebApp;
      if (tg && tg.initDataUnsafe?.user) {
        tg.ready();
        tg.expand();
        
        const tgUser = tg.initDataUnsafe.user;
        setIsConnected(true);
        const name = tgUser.username || tgUser.first_name || 'User';
        setUsername(name);
        setUserId(tgUser.id);

        const storedBalance = localStorage.getItem(`balance_${tgUser.id}`);
        if (storedBalance) setBalance(parseFloat(storedBalance));
        return true;
      }
      return false;
    };

    if (!initTelegram()) {
      const interval = setInterval(() => {
        retryCount++;
        if (initTelegram() || retryCount >= maxRetries) {
          clearInterval(interval);
        }
      }, 500);
      return () => clearInterval(interval);
    }

    // Energy recovery
    const energyTimer = setInterval(() => {
      setEnergy((prev) => Math.min(prev + 1, maxEnergy));
    }, 3000);

    return () => clearInterval(energyTimer);
  }, []);

  const handleTap = (e: React.TouchEvent | React.MouseEvent) => {
    if (energy <= 0) {
      setPopupMessage("Out of energy! Wait for recharge.");
      setShowPopup(true);
      setTimeout(() => setShowPopup(false), 2000);
      return;
    }

    e.preventDefault();
    tapControls.start({
      scale: [1, 0.95, 1.05, 1],
      transition: { duration: 0.1 }
    });

    const points = 'touches' in e ? Array.from(e.touches) : [{ clientX: e.clientX, clientY: e.clientY }];
    
    points.forEach((point) => {
      const newItem: FloatingText = {
        id: nextItemId.current++,
        x: point.clientX,
        y: point.clientY,
        value: `+${incrementValue}`
      };
      
      setFloatingTexts((prev) => [...prev, newItem]);
      setTimeout(() => {
        setFloatingTexts((prev) => prev.filter((item) => item.id !== newItem.id));
      }, 800);
    });

    const tapCount = points.length;
    const newBalance = balance + (incrementValue * tapCount);
    setBalance(newBalance);
    setEnergy((prev) => Math.max(0, prev - tapCount));
    
    if (userId) {
      localStorage.setItem(`balance_${userId}`, newBalance.toFixed(4));
    }
  };

  const handleWithdraw = () => {
    setPopupMessage("Withdrawal System is a few days left! Join our Telegram for updates.");
    setShowPopup(true);
  };

  const handleInfo = () => {
    setPopupMessage("ETB Tap is a decentralized ecosystem rewarding active participants. Mine, hold, and earn.");
    setShowPopup(true);
  };

  return (
    <div className="flex flex-col items-center h-screen w-full relative bg-[#0a0808] overflow-hidden select-none font-sans">
      {/* Mesh Background Accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-red-900/30 blur-[120px] rounded-full" />
        <div className="absolute top-[20%] -right-[10%] w-[40%] h-[40%] bg-yellow-900/20 blur-[100px] rounded-full" />
        <div className="absolute -bottom-[10%] left-[20%] w-[60%] h-[40%] bg-red-600/10 blur-[120px] rounded-full" />
      </div>

      {/* Header Bar */}
      <header className="w-full px-6 py-4 flex items-center justify-between z-50 bg-black/40 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-800 p-[1px] shadow-lg">
            <div className="w-full h-full rounded-[11px] bg-[#0a0808] flex items-center justify-center">
              <User className="w-5 h-5 text-red-500" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] text-white/40 font-mono font-bold tracking-widest leading-none">AGENT</p>
              {isConnected ? (
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]" />
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
              )}
            </div>
            <p className="text-sm font-display font-bold text-white leading-tight">{username}</p>
            {userId && <p className="text-[8px] font-mono text-white/30 tracking-tight">ID: {userId}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-2xl border border-white/10">
          <TrendingUp className="w-4 h-4 text-green-400" />
          <div className="text-right">
            <p className="text-[9px] text-white/40 font-mono font-bold leading-none">PROFITS</p>
            <p className="text-xs font-mono font-bold text-white">x1.2</p>
          </div>
        </div>
      </header>

      {/* Balance Section */}
      <section className="mt-8 flex flex-col items-center z-20">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
          <p className="text-[10px] font-mono font-bold text-yellow-500 tracking-[0.2em]">ETB ECOSYSTEM</p>
        </div>
        <h1 className="text-5xl md:text-6xl font-display font-bold flex items-baseline gap-2">
          {balance.toFixed(2)} 
          <span className="text-xl text-white/30">ETB</span>
        </h1>
      </section>

      {/* Main Interaction Area */}
      <main className="flex-1 w-full flex flex-col items-center justify-center relative px-6 py-4">
        <div className="relative group">
          {/* Outer Ring */}
          <div className="absolute inset-0 bg-red-600/20 blur-[60px] rounded-full scale-125 animate-pulse-soft" />
          
          <motion.div
            animate={tapControls}
            className="relative w-64 h-64 md:w-80 md:h-80 cursor-pointer touch-none"
            onPointerDown={handleTap}
          >
            {/* Highly Stylised Coin/Gem */}
            <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#1a1111] to-[#3a1a1a] border-8 border-white/5 shadow-2xl flex items-center justify-center relative overflow-hidden backdrop-blur-md">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.1),transparent)]" />
              <div className="z-10 flex flex-col items-center">
                <span className="text-7xl font-display font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-red-500 to-red-900 drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
                  ETB
                </span>
                <div className="mt-2 text-[10px] bg-red-600/20 text-red-500 px-3 py-1 rounded-full font-mono font-bold tracking-widest border border-red-500/20">
                  TAP TO EARN
                </div>
              </div>
              
              {/* Inner Glow Lines */}
              <div className="absolute top-0 left-0 w-full h-full opacity-20">
                <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white rotate-45" />
                <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white -rotate-45" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Community Link */}
        <motion.a
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          href="https://t.me/etb_tap_community"
          target="_blank"
          className="mt-12 flex items-center gap-3 bg-red-600/10 hover:bg-red-600/20 border border-red-600/30 px-6 py-3 rounded-2xl transition-all duration-300"
        >
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white">
            <ExternalLink className="w-4 h-4" />
          </div>
          <span className="font-display font-bold text-sm text-red-100">Official Community</span>
        </motion.a>
      </main>

      {/* Stats and Floating Elements */}
      <AnimatePresence>
        {floatingTexts.map((text) => (
          <motion.div
            key={text.id}
            initial={{ opacity: 1, y: text.y - 20, x: text.x }}
            animate={{ opacity: 0, y: text.y - 120, scale: 1.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="fixed pointer-events-none z-[100] text-red-400 font-display font-bold text-2xl drop-shadow-[0_2px_10px_rgba(255,0,0,0.5)]"
            style={{ left: text.x - 20, top: text.y - 20 }}
          >
            {text.value}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Bottom Interface */}
      <div className="w-full max-w-md px-6 pb-24 z-30">
        <div className="flex justify-between items-end mb-2">
          <div className="flex items-center gap-2">
            <Zap className={`w-4 h-4 ${energy < 20 ? "text-red-500 animate-pulse" : "text-yellow-400"}`} />
            <span className="text-[11px] font-mono font-bold tracking-widest text-white/60">ENERGY</span>
          </div>
          <span className="text-xs font-mono font-bold">{energy}/{maxEnergy}</span>
        </div>
        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
          <motion.div
            className={`h-full bg-gradient-to-r ${energy < 20 ? "from-red-600 to-red-400" : "from-yellow-600 to-yellow-400"} shadow-[0_0_10px_rgba(234,179,8,0.3)]`}
            animate={{ width: `${(energy / maxEnergy) * 100}%` }}
            transition={{ type: "spring", bounce: 0, duration: 0.5 }}
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-24 bg-black/60 backdrop-blur-xl border-t border-white/5 flex items-center justify-around px-8 pb-4 z-50">
        <button className="flex flex-col items-center gap-1.5 transition-all text-red-500">
          <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20 shadow-lg">
            <Play className="w-5 h-5 fill-current" />
          </div>
          <span className="text-[9px] font-mono font-black tracking-widest">MINING</span>
        </button>

        <button 
          onClick={handleWithdraw}
          className="flex flex-col items-center gap-1.5 transition-all text-white/40 hover:text-white"
        >
          <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
            <Wallet className="w-5 h-5" />
          </div>
          <span className="text-[9px] font-mono font-black tracking-widest">WALLETS</span>
        </button>

        <button 
          onClick={handleInfo}
          className="flex flex-col items-center gap-1.5 transition-all text-white/40 hover:text-white"
        >
          <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
            <Info className="w-5 h-5" />
          </div>
          <span className="text-[9px] font-mono font-black tracking-widest">ABOUT</span>
        </button>
      </nav>

      {/* Popup Message */}
      <AnimatePresence>
        {showPopup && (
          <motion.div
            initial={{ y: 200, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 200, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 bg-[#1a1111] text-white p-8 pb-12 text-center shadow-[0_-20px_50px_rgba(0,0,0,0.8)] z-[100] rounded-t-[40px] border-t border-red-500/20 glass-card"
          >
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30 mb-2">
                <LogOut className="w-8 h-8 text-red-500 rotate-180" />
              </div>
              <h2 className="text-xl font-display font-bold">Withdrawal Access</h2>
              <p className="text-white/60 text-sm max-w-xs">{popupMessage}</p>
              <button 
                onClick={() => setShowPopup(false)}
                className="mt-4 w-full py-4 bg-red-600 rounded-2xl font-display font-bold text-sm shadow-xl"
              >
                PROCEED
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
