/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  MonitorPlay, 
  Loader2, 
  Home, 
  Zap, 
  Users, 
  Wallet, 
  User as UserIcon,
  Play,
  CircleDollarSign,
  ArrowUpRight
} from 'lucide-react';
import { db, auth } from './lib/firebase';
import { doc, setDoc, updateDoc, serverTimestamp, onSnapshot, increment } from 'firebase/firestore';

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface UserData {
  id: number;
  username: string;
}

export default function App() {
  const [adsWatched, setAdsWatched] = useState<number>(0);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');

  // Initialize Telegram & Data
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const init = async () => {
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

            // Wait for Auth
            const checkAuth = async () => {
              if (auth.currentUser) {
                const userDocPath = `users/${auth.currentUser.uid}`;
                unsubscribe = onSnapshot(doc(db, userDocPath), async (snapshot) => {
                  if (snapshot.exists()) {
                    setAdsWatched(snapshot.data().adsWatched || 0);
                    setLoading(false);
                  } else {
                    try {
                      await setDoc(doc(db, userDocPath), {
                        telegramId: user.id,
                        username: identity.username,
                        adsWatched: 0,
                        updatedAt: serverTimestamp()
                      });
                    } catch (e) {
                      handleFirestoreError(e, OperationType.CREATE, userDocPath);
                      setLoading(false);
                    }
                  }
                }, (error) => {
                  handleFirestoreError(error, OperationType.GET, userDocPath);
                  setLoading(false);
                });
              } else {
                setTimeout(checkAuth, 500);
              }
            };
            checkAuth();
          } else {
            setUserData({ id: 0, username: 'Guest' });
            setLoading(false);
          }
        } else {
          setUserData({ id: 0, username: 'Guest' });
          setLoading(false);
        }
      } catch (e) {
        console.error("Initialization error", e);
        setUserData({ id: 0, username: 'Guest' });
        setLoading(false);
      }
    };

    init();
    return () => unsubscribe?.();
  }, []);

  const handleWatchAd = async () => {
    if (isWatching || !auth.currentUser) return;
    
    console.log("Starting ad watch...");
    setIsWatching(true);

    const rewardUser = async () => {
      if (!auth.currentUser) return;
      const userDocPath = `users/${auth.currentUser.uid}`;
      try {
        console.log("Incrementing adsWatched in Firestore...");
        await setDoc(doc(db, userDocPath), {
          telegramId: userData?.id || 0,
          username: userData?.username || 'Guest',
          adsWatched: increment(1),
          updatedAt: serverTimestamp()
        }, { merge: true });
        console.log("Increment successful!");
        
        try {
          (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
        } catch {}
      } catch (error) {
        console.error("Firestore update failed:", error);
        handleFirestoreError(error, OperationType.UPDATE, userDocPath);
      } finally {
        setIsWatching(false);
      }
    };
    
    // Trigger Ad only on user interaction using the rewarded interstitial format
    const adFn = (window as any).show_10937696;
    if (typeof adFn === 'function') {
      try {
        console.log("Calling Ad SDK rewarded interstitial...");
        adFn().then(() => {
          console.log("Ad finished, giving reward...");
          rewardUser();
          alert('You have seen an ad!');
        }).catch((err: any) => {
          console.error("Ad SDK error:", err);
          setIsWatching(false);
        });
      } catch (err) {
        console.error("Ad SDK sync error:", err);
        setIsWatching(false);
      }
    } else {
      console.warn("Ad SDK function not found");
      // Fallback for demo/testing if SDK is blocked
      setTimeout(rewardUser, 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0D121F]">
        <Loader2 className="w-8 h-8 animate-spin text-[#5D5FEF]" />
      </div>
    );
  }

  const balance = (adsWatched * 0.005).toFixed(3);

  return (
    <div className="min-h-screen pb-24 bg-[#0D121F] font-sans selection:bg-[#5D5FEF]/30 overflow-x-hidden">
      {/* Header Section */}
      <header className="px-6 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Hello, {userData?.username || 'User'}!
          </h1>
          <p className="text-sm text-[#A0AEC0] mt-0.5">Let's earn some money today!</p>
        </div>
        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#5D5FEF] to-[#8B5CF6] flex items-center justify-center border-2 border-white/10 shadow-lg shadow-[#5D5FEF]/20 p-0.5">
          <div className="w-full h-full rounded-full bg-[#0D121F] flex items-center justify-center">
             <UserIcon className="w-6 h-6 text-white" />
          </div>
        </div>
      </header>

      <main className="px-6 space-y-6">
        {/* Main Balance Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="gradient-card rounded-[24px] p-6 text-white shadow-xl shadow-[#5D5FEF]/10"
        >
          <div className="relative z-10">
            <p className="text-sm font-medium opacity-80 uppercase tracking-widest">Total Balance</p>
            <h2 className="text-4xl font-extrabold mt-1 tracking-tight">${balance}</h2>
            
            <div className="mt-8 grid grid-cols-3 gap-4 border-t border-white/20 pt-6">
              <div className="text-center">
                <p className="text-[10px] uppercase font-bold opacity-60 tracking-wider">Withdrawn</p>
                <p className="text-sm font-bold mt-1">$0.000</p>
              </div>
              <div className="text-center border-x border-white/10 px-2">
                <p className="text-[10px] uppercase font-bold opacity-60 tracking-wider">Ads Watched</p>
                <p className="text-sm font-bold mt-1">{adsWatched}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase font-bold opacity-60 tracking-wider">Referrals</p>
                <p className="text-sm font-bold mt-1">0</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Action Button */}
        <motion.button 
          whileTap={{ scale: 0.98 }}
          onClick={handleWatchAd}
          disabled={isWatching}
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#5D5FEF] to-[#8B5CF6] flex items-center justify-center gap-3 text-white font-bold shadow-lg shadow-[#5D5FEF]/20 disabled:opacity-70 disabled:cursor-not-allowed group transition-all"
        >
          {isWatching ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Play className="w-5 h-5 fill-current" />
          )}
          <span className="text-lg">{isWatching ? 'Watching...' : 'Watch Video Ad'}</span>
        </motion.button>

        {/* Quick Task Card */}
        <section className="stats-card rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
            <Zap className="w-6 h-6 text-green-400" />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-sm">Daily Bonus</h4>
            <p className="text-xs text-[#A0AEC0]">Check in to get $0.050</p>
          </div>
          <motion.button 
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 rounded-lg bg-green-500/20 text-green-400 text-xs font-bold border border-green-500/20"
          >
            Claim
          </motion.button>
        </section>
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 py-4 pb-8 px-6 nav-blur z-50">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <NavItem icon={<Home />} label="Home" active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
          <NavItem icon={<Zap />} label="Tasks" active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} />
          <NavItem icon={<Users />} label="Refer" active={activeTab === 'refer'} onClick={() => setActiveTab('refer')} />
          <NavItem icon={<Wallet />} label="Wallet" active={activeTab === 'wallet'} onClick={() => setActiveTab('wallet')} />
          <NavItem icon={<UserIcon />} label="Profile" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
        </div>
      </nav>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all group relative ${active ? 'text-[#5D5FEF]' : 'text-[#A0AEC0]'}`}
    >
      <div className={`p-2 rounded-xl transition-all ${active ? 'bg-[#5D5FEF]/10 scale-110 shadow-lg shadow-[#5D5FEF]/10' : 'group-hover:bg-white/5'}`}>
        {React.cloneElement(icon as React.ReactElement, { size: 24, strokeWidth: active ? 2.5 : 2 })}
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-widest ${active ? 'opacity-100' : 'opacity-40'}`}>
        {label}
      </span>
      {active && (
        <motion.div 
          layoutId="nav-pill"
          className="w-1.5 h-1.5 rounded-full bg-[#5D5FEF] absolute -bottom-1"
        />
      )}
    </button>
  );
}
