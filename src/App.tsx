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
  ArrowUpRight,
  CheckCircle2,
  Bell,
  Check,
  ExternalLink,
  Share2,
  Gift,
  Copy
} from 'lucide-react';
import { db, auth } from './lib/firebase';
import { doc, setDoc, updateDoc, serverTimestamp, onSnapshot, increment, query, collection, where, getDocs, limit } from 'firebase/firestore';

// --- Types ---
interface UserProfile {
  telegramId: number;
  username: string;
  adsWatched: number;
  balance: number;
  dailyStreak: number;
  lastDailyClaim: any;
  tasksCompleted: string[];
  referralsCount: number;
  total_invites: number;
  referralEarnings: number;
  invitedBy: string | null;
}

const DAILY_REWARDS = [5, 10, 15, 20, 25, 30, 50]; // Points

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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [isClaimingDaily, setIsClaimingDaily] = useState(false);
  const [isVerifyingTask, setIsVerifyingTask] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [error, setError] = useState<string | null>(null);

  // Initialize Telegram & Data
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const extractStartParam = (tg: any) => {
      if (tg.initDataUnsafe?.start_param) return tg.initDataUnsafe.start_param;
      try {
        const urlParams = new URLSearchParams(tg.initData);
        return urlParams.get('start_param');
      } catch (e) {
        return null;
      }
    };

    const setupAuthListener = (tg: any, user: any) => {
      return auth.onAuthStateChanged(async (firebaseUser) => {
        if (!firebaseUser) return;

        const userDocPath = `users/${firebaseUser.uid}`;
        const inviterIdFromParam = extractStartParam(tg);
        
        const identity = {
          id: user.id,
          username: user.username || user.first_name || 'User'
        };
        setUserData(identity);

        unsubscribe = onSnapshot(doc(db, userDocPath), async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setProfile({
              telegramId: data.telegramId || 0,
              username: data.username || 'User',
              adsWatched: data.adsWatched || 0,
              balance: data.balance || 0,
              dailyStreak: data.dailyStreak || 0,
              lastDailyClaim: data.lastDailyClaim,
              tasksCompleted: data.tasksCompleted || [],
              referralsCount: data.referralsCount || 0,
              total_invites: data.total_invites || 0,
              referralEarnings: data.referralEarnings || 0,
              invitedBy: data.invitedBy || null
            });
            setLoading(false);
          } else {
            // NEW USER REGISTRATION
            try {
              let inviterIdStr = null;
              if (inviterIdFromParam && parseInt(inviterIdFromParam) !== user.id) {
                try {
                  const inviterRef = collection(db, "users");
                  const q = query(inviterRef, where("telegramId", "==", parseInt(inviterIdFromParam)), limit(1));
                  const querySnapshot = await getDocs(q);
                  
                  if (!querySnapshot.empty) {
                    const inviterDoc = querySnapshot.docs[0];
                    inviterIdStr = inviterDoc.id;
                    
                    // Reward inviter (50 pts)
                    await updateDoc(doc(db, "users", inviterDoc.id), {
                      balance: increment(50),
                      referralsCount: increment(1),
                      total_invites: increment(1),
                      referralEarnings: increment(50),
                      updatedAt: serverTimestamp()
                    });

                    // Track in sub-collection
                    await setDoc(doc(db, `users/${inviterDoc.id}/referrals/${user.id}`), {
                      telegramId: user.id,
                      username: identity.username,
                      joinedAt: serverTimestamp()
                    });
                    
                    tg.showAlert(`Welcome to @Madbottherbot! You were successfully referred and can now start earning.`);
                    tg.HapticFeedback?.notificationOccurred('success');
                  }
                } catch (refErr) {
                  console.error("Referral Error:", refErr);
                }
              }
              
              const initialProfile = {
                telegramId: user.id,
                username: identity.username,
                adsWatched: 0,
                balance: 0,
                dailyStreak: 0,
                lastDailyClaim: null,
                tasksCompleted: [],
                referralsCount: 0,
                total_invites: 0,
                referralEarnings: 0,
                invitedBy: inviterIdStr,
                updatedAt: serverTimestamp()
              };
              await setDoc(doc(db, userDocPath), initialProfile);
            } catch (e) {
              console.error("Registration Error", e);
              setError("Failed to create profile. Please check if Anonymous Auth is enabled in Firebase.");
              setLoading(false);
            }
          }
        }, (err) => {
          console.error("Firestore Snapshot Error", err);
          setError("Database connection error. Try again later.");
          setLoading(false);
        });
      });
    };

    const init = async () => {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
        if (tg.initDataUnsafe?.user) {
          setupAuthListener(tg, tg.initDataUnsafe.user);
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    init();
    return () => unsubscribe?.();
  }, []);

  const handleWatchAd = async () => {
    if (isWatching || !auth.currentUser) return;
    
    setIsWatching(true);

    const rewardUser = async () => {
      if (!auth.currentUser) return;
      const userDocPath = `users/${auth.currentUser.uid}`;
      try {
        await updateDoc(doc(db, userDocPath), {
          adsWatched: increment(1),
          balance: increment(2), // 2 points per ad
          updatedAt: serverTimestamp()
        });
        
        try {
          (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
        } catch {}
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, userDocPath);
      } finally {
        setIsWatching(false);
      }
    };
    
    const adFn = (window as any).show_10937696;
    if (typeof adFn === 'function') {
      try {
        adFn().then(() => {
          rewardUser();
        }).catch((err: any) => {
          console.error("Ad SDK error:", err);
          setIsWatching(false);
        });
      } catch (err) {
        console.error("Ad SDK sync error:", err);
        setIsWatching(false);
      }
    } else {
      setTimeout(rewardUser, 3000);
    }
  };

  const handleDailyCheckIn = async () => {
    if (isClaimingDaily || !auth.currentUser || !profile) return;
    
    const now = Date.now();
    const lastClaim = profile.lastDailyClaim ? profile.lastDailyClaim.toMillis() : 0;
    const diffHours = (now - lastClaim) / (1000 * 60 * 60);

    // Can only claim once every 24 hours
    if (diffHours < 24 && profile.lastDailyClaim) {
      alert(`Come back in ${Math.ceil(24 - diffHours)} hours!`);
      return;
    }

    setIsClaimingDaily(true);
    const userDocPath = `users/${auth.currentUser.uid}`;

    try {
      let newStreak = profile.dailyStreak;
      
      // If claimed more than 48 hours ago, reset streak (missed a day)
      // Or if it's the very first claim
      if (diffHours > 48 || !profile.lastDailyClaim) {
        newStreak = 1;
      } else {
        newStreak = (newStreak % 7) + 1;
      }

      const reward = DAILY_REWARDS[newStreak - 1];

      await updateDoc(doc(db, userDocPath), {
        balance: increment(reward),
        dailyStreak: newStreak,
        lastDailyClaim: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      try {
        (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
      } catch {}

      alert(`Day ${newStreak} Claimed! Reward: ${reward} points`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, userDocPath);
    } finally {
      setIsClaimingDaily(false);
    }
  };

  const handleJoinTelegram = async () => {
    if (isVerifyingTask || !auth.currentUser || !profile) return;
    if (profile.tasksCompleted.includes('tg_join')) {
      alert("Task already completed!");
      return;
    }

    setIsVerifyingTask(true);
    const userDocPath = `users/${auth.currentUser.uid}`;

    try {
      // Small delay to simulate verification
      await new Promise(resolve => setTimeout(resolve, 2000));

      await updateDoc(doc(db, userDocPath), {
        balance: increment(5), // 5 points for joining channel
        tasksCompleted: [...profile.tasksCompleted, 'tg_join'],
        updatedAt: serverTimestamp()
      });

      try {
        (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      } catch {}
      alert("Successfully verified! 5 points added to your balance.");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, userDocPath);
    } finally {
      setIsVerifyingTask(false);
    }
  };

  const referralLink = profile ? `https://t.me/Madbottherbot?startapp=${profile.telegramId}` : '';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    try {
      (window as any).Telegram?.WebApp?.showAlert('Referral link copied to clipboard!');
      (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    } catch {
      alert('Copied!');
    }
  };

  const handleShare = () => {
    const text = encodeURIComponent("Join this bot and earn rewards! 🚀");
    const url = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${text}`;
    (window as any).Telegram?.WebApp?.openTelegramLink(url);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0D121F] p-10 text-center">
        <Loader2 className="w-12 h-12 animate-spin text-[#EF4444] mb-6" />
        <h2 className="text-xl font-black text-white mb-2">Loading @Madbot...</h2>
        <p className="text-sm text-[#A0AEC0]">Securing connection to rewards gateway</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0D121F] p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
          <Bell className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-2xl font-black text-white mb-4">Connection Failed</h2>
        <p className="text-red-400 text-sm mb-10 leading-relaxed bg-red-500/5 p-4 rounded-xl border border-red-500/10">
          {error}
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="w-full h-16 rounded-2xl bg-white text-black font-black shadow-xl"
        >
          RETRY CONNECTION
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 bg-[#0D121F] font-sans selection:bg-[#EF4444]/30 overflow-x-hidden">
      {/* Header Section */}
      <header className="px-6 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            {activeTab === 'home' ? `Hello, ${userData?.username || 'User'}!` : activeTab === 'tasks' ? 'Tasks' : 'Invite'}
          </h1>
          <p className="text-sm text-[#A0AEC0] mt-0.5">
            {activeTab === 'home' ? "Let's earn some points today!" : activeTab === 'tasks' ? "Complete tasks to earn more" : "Refer friends to get paid"}
          </p>
        </div>
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#EF4444] to-[#B91C1C] flex items-center justify-center border border-white/10 shadow-lg shadow-[#EF4444]/10 p-0.5">
          <div className="w-full h-full rounded-full bg-[#0D121F] flex items-center justify-center">
             <UserIcon className="w-5 h-5 text-white" />
          </div>
        </div>
      </header>

      <main className="px-6 space-y-6">
        {activeTab === 'home' ? (
          <>
            {/* Main Balance Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="gradient-card rounded-[24px] p-6 text-white shadow-xl shadow-[#EF4444]/10"
            >
              <div className="relative z-10">
                <p className="text-sm font-medium opacity-80 uppercase tracking-widest">Current Balance</p>
                <h2 className="text-4xl font-extrabold mt-1 tracking-tight">
                  {Math.floor(profile?.balance || 0)} points
                </h2>
                
                <div className="mt-8 grid grid-cols-3 gap-4 border-t border-white/20 pt-6">
                  <div className="text-center">
                    <p className="text-[10px] uppercase font-bold opacity-60 tracking-wider">Withdrawn</p>
                    <p className="text-sm font-bold mt-1">0 points</p>
                  </div>
                  <div className="text-center border-x border-white/10 px-2">
                    <p className="text-[10px] uppercase font-bold opacity-60 tracking-wider">Ads Watched</p>
                    <p className="text-sm font-bold mt-1">{profile?.adsWatched || 0}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase font-bold opacity-60 tracking-wider">Tasks Done</p>
                    <p className="text-sm font-bold mt-1">{profile?.tasksCompleted.length || 0}</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Action Button */}
            <motion.button 
              whileTap={{ scale: 0.98 }}
              onClick={handleWatchAd}
              disabled={isWatching}
              className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#EF4444] to-[#B91C1C] flex items-center justify-center gap-3 text-white font-bold shadow-lg shadow-[#EF4444]/20 disabled:opacity-70 disabled:cursor-not-allowed group transition-all"
            >
              {isWatching ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Play className="w-5 h-5 fill-current" />
              )}
              <span className="text-lg">{isWatching ? 'Watching...' : 'Watch Video Ad'}</span>
            </motion.button>

            {/* Daily Rewards Sneak Peek */}
            <section className="stats-card rounded-2xl p-4 flex items-center gap-4 cursor-pointer" onClick={() => setActiveTab('tasks')}>
              <div className="w-12 h-12 rounded-xl bg-[#EF4444]/10 flex items-center justify-center">
                <Zap className="w-6 h-6 text-[#EF4444]" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-sm">Daily Reward</h4>
                <p className="text-xs text-[#A0AEC0]">Current Streak: {profile?.dailyStreak || 0} Days</p>
              </div>
              <div className="px-3 py-1 rounded-full bg-[#EF4444]/10 text-[#EF4444] text-[10px] font-bold border border-[#EF4444]/20 uppercase">
                 View Tasks
              </div>
            </section>
          </>
        ) : activeTab === 'tasks' ? (
          <div className="space-y-6">
            {/* Daily Check-in Card */}
            <section className="stats-card rounded-3xl p-6 bg-gradient-to-b from-white/[0.05] to-transparent">
               <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-bold text-base">Daily Check-in</h3>
                    <p className="text-xs text-[#A0AEC0]">Claim your daily reward</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-[#EF4444]">{profile?.dailyStreak}/7 Days</p>
                    <div className="w-20 h-1.5 bg-white/10 rounded-full mt-1 overflow-hidden">
                       <div 
                        className="h-full bg-[#EF4444] transition-all duration-500" 
                        style={{ width: `${((profile?.dailyStreak || 0) / 7) * 100}%` }}
                       />
                    </div>
                  </div>
               </div>

               <div className="grid grid-cols-7 gap-2 mb-6">
                 {Array.from({ length: 7 }).map((_, i) => {
                   const day = i + 1;
                   const isCompleted = day <= (profile?.dailyStreak || 0);
                   const isCurrent = day === ((profile?.dailyStreak || 0) % 7) + 1;
                   
                   return (
                     <div key={day} className="flex flex-col items-center gap-2">
                        <div className={`w-full aspect-square rounded-xl flex items-center justify-center text-[10px] font-bold border transition-all
                          ${isCompleted ? 'bg-[#EF4444] border-[#EF4444] text-white' : 
                            isCurrent ? 'bg-white/5 border-[#EF4444] text-[#EF4444] shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 
                            'bg-white/5 border-white/10 text-[#A0AEC0]'}`}
                        >
                          {isCompleted ? <Check className="w-4 h-4" /> : `Day ${day}`}
                        </div>
                        <span className={`text-[8px] font-bold ${isCurrent ? 'text-[#EF4444]' : 'text-[#A0AEC0]'}`}>
                          {DAILY_REWARDS[i]} pts
                        </span>
                     </div>
                   );
                 })}
               </div>

               <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleDailyCheckIn}
                disabled={isClaimingDaily}
                className="w-full py-3 rounded-xl bg-[#EF4444] text-white text-sm font-bold shadow-lg shadow-[#EF4444]/20 disabled:opacity-50"
               >
                 {isClaimingDaily ? 'Claiming...' : 'Claim Today\'s Reward'}
               </motion.button>
            </section>

            {/* Tasks List */}
            <h4 className="font-bold text-sm px-1">Available Tasks</h4>
            
            <div className="space-y-4">
               {/* Telegram Join Task */}
               <div className="stats-card rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                       <h4 className="font-bold text-sm">Join @ebisa_emoji</h4>
                       {profile?.tasksCompleted.includes('tg_join') && (
                         <CheckCircle2 className="w-3 h-3 text-green-400" />
                       )}
                    </div>
                    <p className="text-xs text-[#A0AEC0]">Reward: 5 points | Single Use</p>
                  </div>
                  
                  {!profile?.tasksCompleted.includes('tg_join') ? (
                    <div className="flex flex-col gap-2">
                      <a 
                        href="https://t.me/ebisa_emoji" 
                        target="_blank" 
                        rel="noreferrer"
                        className="px-4 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-[10px] font-bold border border-red-500/20 text-center flex items-center gap-1"
                      >
                         Join <ExternalLink size={10} />
                      </a>
                      <button 
                        onClick={handleJoinTelegram}
                        disabled={isVerifyingTask}
                        className="px-4 py-1.5 rounded-lg bg-white/10 text-white text-[10px] font-bold border border-white/10 disabled:opacity-50"
                      >
                         {isVerifyingTask ? '...' : 'Verify'}
                      </button>
                    </div>
                  ) : (
                    <div className="px-4 py-2 rounded-lg bg-green-500/10 text-green-400 text-[10px] font-bold border border-green-500/10">
                       Success
                    </div>
                  )}
               </div>
            </div>
          </div>
        ) : activeTab === 'wallet' ? (
          <div className="space-y-6">
            <h2 className="text-2xl font-black text-white px-2">Wallet</h2>
            <div className="stats-card rounded-3xl p-8 text-center border border-white/5">
              <Wallet className="w-16 h-16 text-[#EF4444] mx-auto mb-6 opacity-80" />
              <p className="text-[#A0AEC0] text-sm leading-relaxed mb-8">Withdrawals are currently locked until you reach <span className="text-white font-bold">5,000 points</span>. Keep earning!</p>
              
              <div className="grid grid-cols-1 gap-4">
                <div className="p-6 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center">
                  <p className="text-[10px] uppercase font-black opacity-40 tracking-[0.2em] mb-2">Available Balance</p>
                  <p className="text-4xl font-black text-white">{Math.floor(profile?.balance || 0)} pts</p>
                </div>
                
                <button className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 text-white/40 font-bold cursor-not-allowed">
                  Withdraw Points
                </button>
              </div>
            </div>
            
            <div className="p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 flex gap-3">
              <Bell className="text-[#EF4444] shrink-0" size={18} />
              <p className="text-[11px] text-[#A0AEC0] leading-normal">
                Payments are processed via TON (The Open Network) within 24-48 hours of request verification.
              </p>
            </div>
          </div>
        ) : activeTab === 'profile' ? (
          <div className="space-y-6">
            <h2 className="text-2xl font-black text-white px-2">Profile</h2>
            <div className="bg-white/5 rounded-[32px] p-8 border border-white/10 relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center gap-6 mb-10">
                  <div className="w-20 h-20 rounded-[24px] bg-gradient-to-tr from-[#EF4444] to-[#B91C1C] flex items-center justify-center text-3xl font-black text-white shadow-xl shadow-[#EF4444]/20">
                    {userData?.username?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white">{userData?.username || 'User'}</h3>
                    <p className="text-xs text-[#EF4444] font-bold mt-1 tracking-wider uppercase">Active Member</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-5 bg-black/30 rounded-2xl border border-white/5">
                    <span className="text-xs font-bold opacity-40 uppercase tracking-widest">Telegram ID</span>
                    <span className="text-sm font-mono text-white">{userData?.id}</span>
                  </div>
                  <div className="flex justify-between items-center p-5 bg-black/30 rounded-2xl border border-white/5">
                    <span className="text-xs font-bold opacity-40 uppercase tracking-widest">Reputation</span>
                    <span className="text-sm font-bold text-green-400">Perfect 100%</span>
                  </div>
                  <div className="flex justify-between items-center p-5 bg-black/30 rounded-2xl border border-white/5">
                    <span className="text-xs font-bold opacity-40 uppercase tracking-widest">Status</span>
                    <span className="text-sm font-bold text-[#EF4444]">Verified Earner</span>
                  </div>
                </div>
              </div>
              
              {/* Decorative backgrounds for profile */}
              <div className="absolute -right-20 -top-20 w-48 h-48 bg-[#EF4444]/10 rounded-full blur-3xl" />
            </div>
            
            <button 
              onClick={() => (window as any).Telegram?.WebApp?.close()}
              className="w-full h-16 rounded-2xl bg-white/5 border border-white/10 text-white font-black hover:bg-white/10 transition-colors"
            >
              EXIT MINI APP
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Referral Stats Header */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="gradient-card rounded-[32px] p-8 text-white relative overflow-hidden"
            >
               <div className="relative z-10 flex flex-col items-center text-center">
                  <div className="w-20 h-20 rounded-3xl bg-white/10 flex items-center justify-center mb-6 backdrop-blur-xl border border-white/20 shadow-2xl">
                    <Gift className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-3xl font-black mb-2 tracking-tight">Invite & Earn</h2>
                  <p className="text-sm opacity-80 max-w-[240px] leading-relaxed">
                    Earn <span className="text-[#EF4444] font-bold">50 points</span> for every friend who starts earning with us
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4 w-full mt-10">
                    <div className="bg-black/30 backdrop-blur-md rounded-2xl p-5 border border-white/5 shadow-inner">
                      <p className="text-[10px] uppercase font-black opacity-40 tracking-[0.2em]">Referrals</p>
                      <p className="text-3xl font-black mt-2 leading-none">{profile?.total_invites || 0}</p>
                    </div>
                    <div className="bg-black/30 backdrop-blur-md rounded-2xl p-5 border border-white/5 shadow-inner">
                      <p className="text-[10px] uppercase font-black opacity-40 tracking-[0.2em]">Earnings</p>
                      <p className="text-3xl font-black mt-2 text-[#EF4444] leading-none">{Math.floor(profile?.referralEarnings || 0)} pts</p>
                    </div>
                  </div>
               </div>

               {/* Modern Decorative Blurs */}
               <div className="absolute -right-16 -top-16 w-48 h-48 bg-[#EF4444]/30 rounded-full blur-[60px]" />
               <div className="absolute -left-16 -bottom-16 w-48 h-48 bg-[#DC2626]/30 rounded-full blur-[60px]" />
            </motion.div>

            {/* Invite Actions Section */}
            <div className="space-y-8 pb-10">
              {/* Copy Link Component */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-black text-[#A0AEC0] uppercase tracking-[0.15em]">Your Unique Link</label>
                  <span className="text-[10px] text-[#EF4444] font-bold">Earn 50 points per friend!</span>
                </div>
                <div className="relative group">
                  <input 
                    readOnly 
                    value={referralLink}
                    className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-6 text-xs text-white pr-16 focus:outline-none focus:border-[#EF4444]/50 transition-all font-mono"
                  />
                  <button 
                    onClick={handleCopyLink}
                    className="absolute right-2.5 top-2.5 bottom-2.5 w-11 bg-[#EF4444] rounded-xl flex items-center justify-center text-white active:scale-95 transition-all shadow-lg shadow-[#EF4444]/20 hover:bg-[#DC2626]"
                  >
                    <Copy size={18} />
                  </button>
                </div>
              </div>

              {/* Share Strategy Buttons */}
              <div className="grid grid-cols-1 gap-3">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleShare}
                  className="w-full h-16 rounded-2xl bg-white text-black font-black flex items-center justify-center gap-4 shadow-[0_10px_30px_rgba(255,255,255,0.1)] hover:bg-[#F3F4F6] transition-colors"
                >
                  <Share2 size={24} />
                  <span>SEND TO FRIENDS</span>
                </motion.button>
              </div>

              {/* Trust/Tutorial Cards */}
              <div className="grid grid-cols-1 gap-4">
                <div className="stats-card rounded-[24px] p-6 border border-white/5 flex gap-4 items-start">
                   <div className="w-10 h-10 rounded-full bg-[#EF4444]/10 flex items-center justify-center shrink-0">
                     <CheckCircle2 size={20} className="text-[#EF4444]" />
                   </div>
                   <div>
                     <h5 className="font-bold text-sm mb-1 text-white">Verified Tracking</h5>
                     <p className="text-xs text-[#A0AEC0] leading-relaxed">
                       Our new system verifies every referral instantly using deep-link technology. You get paid 50 points the moment they open the app.
                     </p>
                   </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 py-4 pb-8 px-6 nav-blur z-50">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <NavItem icon={<Home />} label="Home" active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
          <NavItem icon={<Zap />} label="Tasks" active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} />
          <NavItem icon={<Users />} label="Invite" active={activeTab === 'invite'} onClick={() => setActiveTab('invite')} />
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
      className={`flex flex-col items-center gap-1 transition-all group relative ${active ? 'text-[#EF4444]' : 'text-[#A0AEC0]'}`}
    >
      <div className={`p-2 rounded-xl transition-all ${active ? 'bg-[#EF4444]/10 scale-110 shadow-lg shadow-[#EF4444]/10' : 'group-hover:bg-white/5'}`}>
        {React.cloneElement(icon as React.ReactElement, { size: 24, strokeWidth: active ? 2.5 : 2 })}
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-widest ${active ? 'opacity-100' : 'opacity-40'}`}>
        {label}
      </span>
      {active && (
        <motion.div 
          layoutId="nav-pill"
          className="w-1.5 h-1.5 rounded-full bg-[#EF4444] absolute -bottom-1"
        />
      )}
    </button>
  );
}
