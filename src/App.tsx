/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Wallet, 
  Trophy, 
  Zap, 
  Coins, 
  ArrowUpRight, 
  ChevronRight,
  LayoutGrid,
  Info
} from 'lucide-react';

// --- Types ---
interface FloatingText {
  id: number;
  x: number;
  y: number;
  value: string;
}

interface UserData {
  id: number;
  username: string;
  avatar?: string;
}

export default function App() {
  const [balance, setBalance] = useState<number>(0);
  const [energy, setEnergy] = useState<number>(1000);
  const [maxEnergy] = useState<number>(1000);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [tapScale, setTapScale] = useState(1);
  const rechargeRate = 1; // Energy per second

  // Initial load
  useEffect(() => {
    // Try to get Telegram data
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
        // Enable closing confirmation to prevent accidental closing
        if (tg.enableClosingConfirmation) tg.enableClosingConfirmation();
        
        if (tg.initDataUnsafe?.user) {
          const user = tg.initDataUnsafe.user;
          setUserData({
            id: user.id,
            username: user.username || user.first_name || 'Player',
            avatar: user.photo_url
          });
          
          const saved = localStorage.getItem(`etb_balance_${user.id}`);
          if (saved) setBalance(parseFloat(saved));
        } else {
          // Fallback for browser testing
          setUserData({ id: 0, username: 'Guest Player' });
        }
      } else {
        // Fallback for browser testing
        setUserData({ id: 0, username: 'Guest Player' });
      }
    } catch (e) {
      console.error("Telegram WebApp initialization error", e);
      setUserData({ id: 0, username: 'Guest Player' });
    }
  }, []);

  // Energy Recharge Logic
  useEffect(() => {
    const interval = setInterval(() => {
      setEnergy(prev => Math.min(prev + rechargeRate, maxEnergy));
    }, 1000);
    return () => clearInterval(interval);
  }, [maxEnergy]);

  // Save balance
  useEffect(() => {
    if (userData && balance > 0) {
      localStorage.setItem(`etb_balance_${userData.id}`, balance.toString());
    }
  }, [balance, userData]);

  const handleTap = (e: React.TouchEvent | React.MouseEvent) => {
    if (energy <= 0) return;

    // Support multi-touch
    const touches = 'touches' in e ? Array.from(e.touches) : [e];
    
    touches.forEach(touch => {
      const x = 'clientX' in touch ? touch.clientX : (touch as any).clientX;
      const y = 'clientY' in touch ? touch.clientY : (touch as any).clientY;
      
      const tapValue = 1;
      setBalance(prev => prev + tapValue);
      setEnergy(prev => Math.max(prev - 2, 0));
      
      // Add floating text
      const newText: FloatingText = {
        id: Date.now() + Math.random(),
        x,
        y,
        value: `+${tapValue}`
      };
      setFloatingTexts(prev => [...prev, newText]);
      
      // Trigger Haptic feedback if available
      try {
        (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
      } catch {}
    });

    // Tap Animation
    setTapScale(0.95);
    setTimeout(() => setTapScale(1), 100);
  };

  const removeFloatingText = (id: number) => {
    setFloatingTexts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white font-sans overflow-hidden select-none">
      {/* --- Top Header --- */}
      <header className="p-4 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-md z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-600 flex items-center justify-center border border-white/10 overflow-hidden shadow-lg shadow-orange-500/10">
            {userData?.avatar ? (
              <img src={userData.avatar} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="w-6 h-6 text-white" />
            )}
          </div>
          <div>
            <h2 className="text-sm font-medium leading-none mb-1 text-white/90">
              {userData?.username || 'Loading...'}
            </h2>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Active Now</span>
            </div>
          </div>
        </div>
        
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium hover:bg-white/10 transition-colors">
          <Wallet className="w-3.5 h-3.5 text-yellow-500" />
          <span>Connect</span>
        </button>
      </header>

      {/* --- Main Game Area --- */}
      <main className="flex-1 relative flex flex-col items-center justify-center overflow-hidden px-6 pt-4 pb-20">
        
        {/* Background Glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] aspect-square bg-[radial-gradient(circle,rgba(251,191,36,0.08)_0%,transparent_70%)] pointer-events-none" />
        
        {/* Balance Display */}
        <div className="text-center mb-12 z-10">
          <div className="flex items-center justify-center gap-3 mb-2">
            <motion.div
              key={`icon-${balance}`}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center shadow-[0_0_20px_rgba(251,191,36,0.3)]"
            >
              <Coins className="text-black w-6 h-6" />
            </motion.div>
            <motion.h1 
              key={`text-${balance}`}
              initial={{ y: 5, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-5xl font-bold tracking-tighter flex items-baseline gap-1"
            >
              {balance.toLocaleString()}
              <span className="text-sm font-medium text-white/40 tracking-normal ml-1">ETB</span>
            </motion.h1>
          </div>
          <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/5 inline-flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-xs text-white/60 font-medium">Rank: Bronze I</span>
            <ChevronRight className="w-3.5 h-3.5 text-white/20" />
          </div>
        </div>

        {/* Tap Target */}
        <div className="relative group perspective-1000">
          <motion.div
            animate={{ scale: tapScale }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            onPointerDown={handleTap}
            className="w-64 h-64 md:w-80 md:h-80 rounded-full cursor-pointer relative z-10"
          >
            {/* Outer Rings */}
            <div className="absolute -inset-4 rounded-full border border-white/[0.03] animate-[spin_20s_linear_infinite]" />
            <div className="absolute -inset-8 rounded-full border border-white/[0.01] animate-[spin_30s_linear_infinite_reverse]" />
            
            {/* The Coin/Image */}
            <div className="w-full h-full rounded-full bg-gradient-to-br from-zinc-800 to-zinc-950 p-2 shadow-[0_0_80px_rgba(251,191,36,0.15)] group-active:shadow-[0_0_100px_rgba(251,191,36,0.25)] transition-shadow overflow-hidden border border-white/10">
              <div className="w-full h-full rounded-full bg-yellow-500/10 flex items-center justify-center relative overflow-hidden backdrop-blur-sm">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.15),transparent)] pointer-events-none" />
                
                {/* Center Graphic */}
                <div className="flex flex-col items-center">
                  <Coins className="w-24 h-24 md:w-32 md:h-32 text-yellow-500 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]" />
                  <span className="mt-2 text-xs font-bold text-yellow-500/60 uppercase tracking-widest">Tap to Earn</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Floating Points */}
          <AnimatePresence>
            {floatingTexts.map(text => (
              <motion.div
                key={text.id}
                initial={{ opacity: 1, y: -20, scale: 1.2 }}
                animate={{ opacity: 0, y: -120, scale: 0.8 }}
                exit={{ opacity: 0 }}
                onAnimationComplete={() => removeFloatingText(text.id)}
                style={{ left: text.x - 20, top: text.y - 40 }}
                className="absolute text-2xl font-bold text-yellow-400 pointer-events-none z-50 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
              >
                {text.value}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Energy Bar */}
        <div className="w-full max-w-sm mt-12 px-2 z-10">
          <div className="flex justify-between items-end mb-2">
            <div className="flex items-center gap-1.5">
              <Zap className={`w-4 h-4 ${energy > 100 ? 'text-yellow-400' : 'text-red-500 animate-pulse'}`} />
              <span className="text-xs font-bold uppercase tracking-wider text-white/80">Energy</span>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold font-mono tracking-tighter">{energy}</span>
              <span className="text-xs text-white/30 font-medium ml-1">/ {maxEnergy}</span>
            </div>
          </div>
          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
            <motion.div 
              initial={false}
              animate={{ width: `${(energy / maxEnergy) * 100}%` }}
              className={`h-full rounded-full shadow-[0_0_8px_rgba(251,191,36,0.4)] ${
                energy > 100 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 'bg-red-500'
              }`}
            />
          </div>
        </div>
      </main>

      {/* --- Footer Nav --- */}
      <nav className="fixed bottom-0 left-0 right-0 p-4 pb-8 bg-gradient-to-t from-black via-black/90 to-transparent border-t border-white/5 z-30">
        <div className="max-w-md mx-auto flex items-center justify-around">
          <NavButton icon={<LayoutGrid />} label="Home" active />
          <NavButton icon={<ArrowUpRight />} label="Boost" />
          <NavButton icon={<Trophy />} label="Leader" />
          <NavButton icon={<Info />} label="About" />
        </div>
      </nav>
    </div>
  );
}

function NavButton({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <button className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-yellow-500 scale-110' : 'text-white/40 hover:text-white/60'}`}>
      <div className={`p-2 rounded-2xl ${active ? 'bg-yellow-500/10' : ''}`}>
        {React.cloneElement(icon as React.ReactElement, { size: 20 })}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      {active && <motion.div layoutId="nav-dot" className="w-1 h-1 rounded-full bg-yellow-500 mt-0.5" />}
    </button>
  );
}

