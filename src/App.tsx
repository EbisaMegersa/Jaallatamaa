import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PlayCircle, Wallet, User, CheckCircle2, AlertCircle, Info, ChevronRight, Share2 } from 'lucide-react';

declare global {
  interface Window {
    Telegram?: any;
  }
}

export default function App() {
  const [balance, setBalance] = useState(0);
  const [adsWatched, setAdsWatched] = useState(0);
  const [username, setUsername] = useState('Explorer');
  const [userId, setUserId] = useState<number | null>(null);
  const [isAdLoading, setIsAdLoading] = useState(false);
  const [popup, setPopup] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Constants
  const REWARD_AMOUNT = 20;
  const MONETAG_DIRECT_LINK = "https://omg10.com/4/10937706"; 

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      
      const user = tg.initDataUnsafe?.user;
      if (user) {
        const name = user.username ? `@${user.username}` : user.first_name;
        setUsername(name);
        setUserId(user.id);
        fetchServerBalance(user.id);
      }
    }
  }, []);

  const fetchServerBalance = async (uid: number) => {
    try {
      const response = await fetch(`/api/user-data/${uid}`);
      const data = await response.json();
      setBalance(data.balance);
    } catch (error) {
      console.error("Balance fetch failed:", error);
    }
  };

  const showPopup = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setPopup({ message, type });
    setTimeout(() => setPopup(null), 4000);
  };

  const watchAd = () => {
    if (isAdLoading) return;

    if (!userId) {
      showPopup("Notice: Running outside of Telegram. Rewards won't be tracked correctly.", 'info');
      // We proceed for testing, but warn the user
    }

    setIsAdLoading(true);
    showPopup("Opening Monetag Ad... Please wait for return.", 'info');

    // Prepare the URL with the user ID for tracking
    const separator = MONETAG_DIRECT_LINK.includes('?') ? '&' : '?';
    const trackingId = userId || 'demo_user';
    const rewardedUrl = `${MONETAG_DIRECT_LINK}${separator}var=${trackingId}`;

    console.log("Opening Ad URL:", rewardedUrl);

    // Open link logic
    try {
      if (window.Telegram?.WebApp && window.Telegram.WebApp.platform !== 'unknown') {
        window.Telegram.WebApp.openLink(rewardedUrl);
      } else {
        // Fallback for browser testing
        const newWindow = window.open(rewardedUrl, '_blank');
        if (!newWindow) {
          showPopup("Popup blocked! Please allow popups for this site.", "error");
          setIsAdLoading(false);
          return;
        }
      }
    } catch (e) {
      console.error("Link capture error", e);
      setIsAdLoading(false);
    }

    // Polling logic to see if server got the reward
    const pollInterval = setInterval(async () => {
      try {
        const idToPoll = userId || 'demo_user';
        // Use a relative path but handle errors gracefully
        const response = await fetch(`/api/user-data/${idToPoll}`);
        
        if (!response.ok) throw new Error("Server response not OK");
        
        const data = await response.json();
        
        // Use functional comparison to ensure we have the absolute latest state
        setBalance(prevBalance => {
          if (data.balance > prevBalance) {
            handleRewardSuccess(data.balance);
            clearInterval(pollInterval);
            setIsAdLoading(false);
            return data.balance;
          }
          return prevBalance;
        });
      } catch (err) {
        // Log locally but don't crash or alert the user, just try again next interval
        console.warn("Retrying balance check...", err);
      }
    }, 4000); // 4 seconds is safer than 3

    // Stop polling after 3 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      if (isAdLoading) {
        setIsAdLoading(false);
        showPopup("Ad verification timed out. Check your internet.", "info");
      }
    }, 180000);
  };

  const handleRewardSuccess = (newBalance: number) => {
    setBalance(newBalance);
    setAdsWatched(prev => prev + 1);
    showPopup(`Success! ${REWARD_AMOUNT} points added via Monetag verification.`, 'success');
  };

  return (
    <div className="flex flex-col h-screen w-full relative px-6 py-8 select-none overflow-hidden font-sans">
      {/* Mesh Background */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(34,197,94,0.3),transparent_70%)]" />
      </div>

      {/* Header */}
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass-card rounded-[24px] p-4 flex items-center justify-between mb-8 z-50"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
            <User className="w-5 h-5 text-white/60" />
          </div>
          <div>
            <p className="text-[9px] text-white/30 font-mono font-bold tracking-widest uppercase">ID: {userId || '---'}</p>
            <p className="text-sm font-bold text-white tracking-tight">{username}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-2xl border border-white/10">
          <div className="text-right">
            <p className="text-[9px] text-yellow-500 font-mono font-bold uppercase">Balance</p>
            <p className="text-lg font-bold text-white leading-none tracking-tight">
              {balance} <span className="text-[10px] text-white/30">PTS</span>
            </p>
          </div>
          <Wallet className="w-5 h-5 text-yellow-500" />
        </div>
      </motion.header>

      {/* Main Action Area */}
      <main className="flex-1 flex flex-col items-center justify-center gap-10">
        <div className="relative group">
          {/* Animated Glow */}
          <div className="absolute inset-0 bg-green-600/10 blur-[80px] rounded-full scale-150 animate-pulse" />
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            onClick={watchAd}
            disabled={isAdLoading}
            className={`w-64 h-64 md:w-72 md:h-72 glass-card rounded-[48px] flex flex-col items-center justify-center p-8 transition-all relative overflow-hidden group border-white/15 outline-none  ${isAdLoading ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {/* Top Shine */}
            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
            
            <motion.div 
              animate={isAdLoading ? { rotate: 360 } : {}}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className={`w-24 h-24 rounded-[32px] bg-gradient-to-br from-green-400 to-green-700 flex items-center justify-center shadow-[0_20px_40px_rgba(22,163,74,0.4)] mb-6 group-hover:shadow-[0_20px_50px_rgba(22,163,74,0.6)] transition-all`}
            >
              {isAdLoading ? (
                <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <PlayCircle className="w-12 h-12 text-white" />
              )}
            </motion.div>
            
            <h2 className="text-3xl font-display font-bold text-white tracking-tight mb-2">Watch Ads</h2>
            <div className="flex items-center gap-2 px-4 py-1.5 bg-green-500/10 rounded-full border border-green-500/20">
              <span className="text-green-400 font-mono text-xs font-bold tracking-widest">+{REWARD_AMOUNT} POINTS</span>
              <ChevronRight className="w-4 h-4 text-green-400" />
            </div>

            {/* Scanning Line overlay when loading */}
            {isAdLoading && (
              <motion.div 
                initial={{ top: "-100%" }}
                animate={{ top: "100%" }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                className="absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-green-500/10 to-transparent pointer-events-none"
              />
            )}
          </motion.button>
        </div>

        {/* Counter Stats */}
        <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
          <div className="glass-card rounded-3xl p-5 text-center">
            <p className="text-[10px] text-white/30 font-bold mb-1 uppercase tracking-widest leading-none">Watched</p>
            <p className="text-2xl font-bold font-mono text-white leading-none">{adsWatched}</p>
          </div>
          <div className="glass-card rounded-3xl p-5 text-center">
            <p className="text-[10px] text-white/30 font-bold mb-1 uppercase tracking-widest leading-none">Status</p>
            <p className="text-2xl font-bold font-mono text-green-500 leading-none">LIVE</p>
          </div>
        </div>
      </main>

      {/* Verification Footer */}
      <footer className="mt-8 pt-8 flex items-center justify-between border-t border-white/5 z-10">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-white/30" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">Verified</span>
          </div>
          <div className="flex items-center gap-2">
            <Share2 className="w-3.5 h-3.5 text-white/30" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">Referral</span>
          </div>
        </div>
        <button className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10 hover:bg-white/10 transition-colors">
          <Info className="w-4 h-4 text-white/40" />
        </button>
      </footer>

      {/* Popup Notifications */}
      <AnimatePresence>
        {popup && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0, scale: 0.95 }}
            className={`fixed bottom-10 left-6 right-6 p-4 rounded-2xl border flex items-center gap-4 shadow-2xl z-[100] backdrop-blur-3xl animate-slide-up ${
              popup.type === 'success' ? 'bg-green-500/10 border-green-500/30 shadow-green-500/10' : 
              popup.type === 'error' ? 'bg-red-500/10 border-red-500/30 shadow-red-500/10' : 
              'bg-green-500/10 border-green-500/30 shadow-green-500/10'
            }`}
          >
            <div className={`rounded-xl p-2 flex-shrink-0 ${
              popup.type === 'success' ? 'bg-green-500/20' : 
              popup.type === 'error' ? 'bg-red-500/20' : 
              'bg-green-500/20'
            }`}>
              {popup.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : 
               popup.type === 'error' ? <AlertCircle className="w-5 h-5 text-red-500" /> : 
               <Info className="w-5 h-5 text-green-500" />}
            </div>
            
            <div className="flex-1">
              <p className={`font-bold text-xs uppercase tracking-widest ${
                popup.type === 'success' ? 'text-green-500' : 
                popup.type === 'error' ? 'text-red-500' : 
                'text-green-500'
              }`}>
                {popup.type === 'success' ? 'Reward Claimed' : 
                 popup.type === 'error' ? 'Error' : 
                 'Status'}
              </p>
              <p className="text-white font-medium text-xs mt-0.5">
                {popup.message}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
