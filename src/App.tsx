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
  referralEarnings: number;
  invitedBy: string | null;
}

const DAILY_REWARDS = [0.05, 0.06, 0.07, 0.08, 0.10, 0.12, 0.20];

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
                      referralEarnings: data.referralEarnings || 0,
                      invitedBy: data.invitedBy || null
                    });
                    setLoading(false);
                  } else {
                    try {
                      const startParam = (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param;
                      let inviterIdStr = null;
                      
                      // Process Referral
                      if (startParam && parseInt(startParam) !== user.id) {
                         try {
                           const q = query(collection(db, "users"), where("telegramId", "==", parseInt(startParam)), limit(1));
                           const querySnapshot = await getDocs(q);
                           if (!querySnapshot.empty) {
                             const inviterDoc = querySnapshot.docs[0];
                             inviterIdStr = inviterDoc.id;
                             
                             // Reward the inviter ($0.25)
                             await updateDoc(doc(db, "users", inviterDoc.id), {
                               balance: increment(0.25),
                               referralsCount: increment(1),
                               referralEarnings: increment(0.25),
                               updatedAt: serverTimestamp()
                             });
                             console.log("Referral rewarded to:", inviterIdStr);
                           }
                         } catch (refErr) {
                            console.error("Referral processing error:", refErr);
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
                        referralEarnings: 0,
                        invitedBy: inviterIdStr,
                        updatedAt: serverTimestamp()
                      };
                      await setDoc(doc(db, userDocPath), initialProfile);
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
    
    setIsWatching(true);

    const rewardUser = async () => {
      if (!auth.currentUser) return;
      const userDocPath = `users/${auth.currentUser.uid}`;
      try {
        await updateDoc(doc(db, userDocPath), {
          adsWatched: increment(1),
          balance: increment(0.005),
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

      alert(`Day ${newStreak} Claimed! Reward: $${reward}`);
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
        balance: increment(0.02),
        tasksCompleted: [...profile.tasksCompleted, 'tg_join'],
        updatedAt: serverTimestamp()
      });

      try {
        (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      } catch {}
      alert("Successfully verified! $0.02 added to your balance.");
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
      <div className="flex items-center justify-center min-h-screen bg-[#0D121F]">
        <Loader2 className="w-8 h-8 animate-spin text-[#5D5FEF]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 bg-[#0D121F] font-sans selection:bg-[#5D5FEF]/30 overflow-x-hidden">
      {/* Header Section */}
      <header className="px-6 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            {activeTab === 'home' ? `Hello, ${userData?.username || 'User'}!` : activeTab === 'tasks' ? 'Tasks' : 'Invite'}
          </h1>
          <p className="text-sm text-[#A0AEC0] mt-0.5">
            {activeTab === 'home' ? "Let's earn some money today!" : activeTab === 'tasks' ? "Complete tasks to earn more" : "Refer friends to get paid"}
          </p>
        </div>
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#5D5FEF] to-[#8B5CF6] flex items-center justify-center border border-white/10 shadow-lg shadow-[#5D5FEF]/10 p-0.5">
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
              className="gradient-card rounded-[24px] p-6 text-white shadow-xl shadow-[#5D5FEF]/10"
            >
              <div className="relative z-10">
                <p className="text-sm font-medium opacity-80 uppercase tracking-widest">Total Balance</p>
                <h2 className="text-4xl font-extrabold mt-1 tracking-tight">
                  ${profile?.balance.toFixed(3) || '0.000'}
                </h2>
                
                <div className="mt-8 grid grid-cols-3 gap-4 border-t border-white/20 pt-6">
                  <div className="text-center">
                    <p className="text-[10px] uppercase font-bold opacity-60 tracking-wider">Withdrawn</p>
                    <p className="text-sm font-bold mt-1">$0.000</p>
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
              className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#5D5FEF] to-[#8B5CF6] flex items-center justify-center gap-3 text-white font-bold shadow-lg shadow-[#5D5FEF]/20 disabled:opacity-70 disabled:cursor-not-allowed group transition-all"
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
              <div className="w-12 h-12 rounded-xl bg-[#5D5FEF]/10 flex items-center justify-center">
                <Zap className="w-6 h-6 text-[#5D5FEF]" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-sm">Daily Reward</h4>
                <p className="text-xs text-[#A0AEC0]">Current Streak: {profile?.dailyStreak || 0} Days</p>
              </div>
              <div className="px-3 py-1 rounded-full bg-[#5D5FEF]/10 text-[#5D5FEF] text-[10px] font-bold border border-[#5D5FEF]/20 uppercase">
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
                    <p className="text-xs font-bold text-[#5D5FEF]">{profile?.dailyStreak}/7 Days</p>
                    <div className="w-20 h-1.5 bg-white/10 rounded-full mt-1 overflow-hidden">
                       <div 
                        className="h-full bg-[#5D5FEF] transition-all duration-500" 
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
                          ${isCompleted ? 'bg-[#5D5FEF] border-[#5D5FEF] text-white' : 
                            isCurrent ? 'bg-white/5 border-[#5D5FEF] text-[#5D5FEF] shadow-[0_0_10px_rgba(93,95,239,0.2)]' : 
                            'bg-white/5 border-white/10 text-[#A0AEC0]'}`}
                        >
                          {isCompleted ? <Check className="w-4 h-4" /> : `Day ${day}`}
                        </div>
                        <span className={`text-[8px] font-bold ${isCurrent ? 'text-[#5D5FEF]' : 'text-[#A0AEC0]'}`}>
                          ${DAILY_REWARDS[i].toFixed(2)}
                        </span>
                     </div>
                   );
                 })}
               </div>

               <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleDailyCheckIn}
                disabled={isClaimingDaily}
                className="w-full py-3 rounded-xl bg-[#5D5FEF] text-white text-sm font-bold shadow-lg shadow-[#5D5FEF]/20 disabled:opacity-50"
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
                    <p className="text-xs text-[#A0AEC0]">Reward: $0.02 | Single Use</p>
                  </div>
                  
                  {!profile?.tasksCompleted.includes('tg_join') ? (
                    <div className="flex flex-col gap-2">
                      <a 
                        href="https://t.me/ebisa_emoji" 
                        target="_blank" 
                        rel="noreferrer"
                        className="px-4 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-[10px] font-bold border border-blue-500/20 text-center flex items-center gap-1"
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
        ) : (
          <div className="space-y-6">
            {/* Referral Stats Card */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="gradient-card rounded-[32px] p-8 text-white relative overflow-hidden"
            >
               <div className="relative z-10 flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-4 backdrop-blur-md">
                    <Gift className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold mb-1">Invite & Earn</h2>
                  <p className="text-sm opacity-80 max-w-[200px]">Get $0.25 for every friend who joins</p>
                  
                  <div className="grid grid-cols-2 gap-4 w-full mt-8">
                    <div className="bg-black/20 rounded-2xl p-4 border border-white/5">
                      <p className="text-[10px] uppercase font-bold opacity-60 tracking-wider">Total Invites</p>
                      <p className="text-2xl font-black mt-1">{profile?.referralsCount || 0}</p>
                    </div>
                    <div className="bg-black/20 rounded-2xl p-4 border border-white/5">
                      <p className="text-[10px] uppercase font-bold opacity-60 tracking-wider">Earnings</p>
                      <p className="text-2xl font-black mt-1 text-green-400">${profile?.referralEarnings.toFixed(2) || '0.00'}</p>
                    </div>
                  </div>
               </div>

               {/* Decorative Circles */}
               <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
               <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-[#8B5CF6]/20 rounded-full blur-3xl" />
            </motion.div>

            {/* Link Box */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-[#A0AEC0] ml-1 uppercase tracking-widest">Your Referral Link</label>
              <div className="relative">
                <input 
                  readOnly 
                  value={referralLink}
                  className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-5 text-sm text-white pr-14 focus:outline-none focus:border-[#5D5FEF]/50 transition-all font-mono"
                />
                <button 
                  onClick={handleCopyLink}
                  className="absolute right-2 top-2 bottom-2 w-10 bg-[#5D5FEF] rounded-xl flex items-center justify-center text-white active:scale-95 transition-transform"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>

            {/* Share Menu */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleShare}
              className="w-full h-14 rounded-2xl bg-white text-black font-bold flex items-center justify-center gap-3 shadow-lg"
            >
              <Share2 size={20} />
              <span>Share Link</span>
            </motion.button>

            <div className="stats-card rounded-2xl p-5 border border-white/5">
               <h5 className="text-sm font-bold flex items-center gap-2 mb-2">
                 <Bell size={14} className="text-[#5D5FEF]" />
                 How it works
               </h5>
               <p className="text-xs text-[#A0AEC0] leading-relaxed">
                 Send your referral link to your friends. Once they open the app, we'll verify them and credit your account automatically. No limits on invitations!
               </p>
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
