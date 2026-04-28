/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, MonitorPlay, Loader2 } from 'lucide-react';

interface UserData {
  id: number;
  username: string;
}

export default function App() {
  const [adsWatched, setAdsWatched] = useState<number>(0);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isWatching, setIsWatching] = useState(false);

  useEffect(() => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
        
        if (tg.initDataUnsafe?.user) {
          const user = tg.initDataUnsafe.user;
          const identity = {
            id: user.id,
            username: user.username || user.first_name || 'User'
          };
          setUserData(identity);
          
          const saved = localStorage.getItem(`ads_watched_${user.id}`);
          if (saved) setAdsWatched(parseInt(saved));
        } else {
          setUserData({ id: 0, username: 'Guest' });
        }
      } else {
        setUserData({ id: 0, username: 'Guest' });
      }
    } catch (e) {
      console.error("Telegram error", e);
      setUserData({ id: 0, username: 'Guest' });
    }
  }, []);

  const handleWatchAd = () => {
    if (isWatching) return;
    
    setIsWatching(true);
    
    // Simulate an ad watching sequence
    setTimeout(() => {
      setAdsWatched(prev => {
        const next = prev + 1;
        if (userData) {
          localStorage.setItem(`ads_watched_${userData.id}`, next.toString());
        }
        return next;
      });
      setIsWatching(false);
      
      // Haptic feedback
      try {
        (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      } catch {}
    }, 3000); // 3 second "ad"
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-black">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bot-card"
      >
        <div className="space-y-2 font-mono">
          <div className="flex items-center gap-2">
            <span className="text-xl">👤</span>
            <span className="font-bold text-white/90">User:</span>
            <span className="text-white">{userData?.username || '...'}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xl">📺</span>
            <span className="font-bold text-white/90">Total Ads Watched:</span>
            <span className="text-white">{adsWatched}</span>
          </div>
        </div>

        <button 
          onClick={handleWatchAd}
          disabled={isWatching}
          className="action-btn flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isWatching ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <MonitorPlay className="w-5 h-5" />
          )}
          <span>{isWatching ? 'Watching...' : 'Watch Ads to Earn'}</span>
        </button>
      </motion.div>
    </div>
  );
}

