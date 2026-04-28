/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { User, MonitorPlay, Loader2 } from 'lucide-react';
import { db, auth } from './lib/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, onSnapshot, increment } from 'firebase/firestore';

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

  // Initialize Telegram & Data
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      try {
        const tg = (window as any).Telegram?.WebApp;
        if (tg) {
          tg.ready();
          tg.expand();

          // Stub CloudStorage if it doesn't exist (Telegram < 6.1) to prevent SDK errors
          if (!tg.CloudStorage) {
            tg.CloudStorage = {
              setItem: (key: string, value: string, cb?: any) => cb?.(null, true),
              getItem: (key: string, cb?: any) => cb?.(null, null),
              getItems: (keys: string[], cb?: any) => cb?.(null, {}),
              removeItem: (key: string, cb?: any) => cb?.(null, true),
              removeItems: (keys: string[], cb?: any) => cb?.(null, true),
              getKeys: (cb?: any) => cb?.(null, [])
            };
          }
          
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
                      // Loading will be set to false on next pulse
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

        // Initialize Ad SDK with a slight delay to ensure library is fully ready
        setTimeout(() => {
          if (typeof (window as any).show_10937696 === 'function') {
            try {
               (window as any).show_10937696({
                type: 'inApp',
                inAppSettings: {
                  frequency: 2,
                  capping: 0.1,
                  interval: 30,
                  timeout: 10, 
                  everyPage: false
                }
              });
            } catch (adErr) {
              console.warn("Ad SDK init error:", adErr);
            }
          }
        }, 2000);
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
    
    // Attempt to show interstitial ad if available
    if (typeof (window as any).show_10937696 === 'function') {
      try {
        (window as any).show_10937696();
      } catch (err) {
        console.error("Ad SDK error:", err);
      }
    }
    
    // Simulate an ad watching sequence (rewards increment)
    setTimeout(async () => {
      if (!auth.currentUser) return;
      const userDocPath = `users/${auth.currentUser.uid}`;
      try {
        await updateDoc(doc(db, userDocPath), {
          adsWatched: increment(1),
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, userDocPath);
      } finally {
        setIsWatching(false);
        // Haptic feedback
        try {
          (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
        } catch {}
      }
    }, 5000); // 5 second simulation + ad time
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-white/20" />
      </div>
    );
  }

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

