'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// Firebase imports
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

// Initialize Firebase with error handling (client-side only)
let app;
let db;
let auth;

if (typeof window !== 'undefined') {
  try {
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      measurementId: process.env.FIREBASE_MEASUREMENT_ID
    };

    // Only initialize if we have valid config
    if (firebaseConfig.apiKey && firebaseConfig.projectId) {
      app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      db = getFirestore(app);
      auth = getAuth(app);
    } else {
      console.warn('Firebase configuration incomplete - using mock services');
      db = null;
      auth = null;
    }
  } catch (error) {
    console.error('Firebase initialization error:', error);
    db = null;
    auth = null;
  }
}

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const router = useRouter();
  const pathname = usePathname();
  const mountedRef = useRef(true);

  // Sign in with Google
  const signInWithGoogle = async () => {
    if (!auth) {
      setAuthError('Firebase Auth not available');
      return;
    }

    try {
      setAuthError(null);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      console.log('User signed in:', result.user);
    } catch (error) {
      console.error('Sign-in error:', error);
      setAuthError(error.message);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    if (!auth) return;

    try {
      await signOut(auth);
      setUser(null);
      setAuthError(null);
    } catch (error) {
      console.error('Sign-out error:', error);
      setAuthError(error.message);
    }
  };

  // Load settings from Firestore
  const loadSettings = async (userId) => {
    if (!mountedRef.current || !db) return;

    try {
      const docRef = doc(db, 'users', userId, 'settings', 'templates');
      const snap = await getDoc(docRef);

      if (snap.exists() && mountedRef.current) {
        const data = snap.data();
        console.log('Settings loaded:', data);
      }
    } catch (error) {
      console.warn('Failed to load settings:', error);
    }
  };

  // Auth state monitoring
  useEffect(() => {
    if (!auth) {
      console.warn('Auth not available - skipping auth state monitoring');
      setLoadingAuth(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!mountedRef.current) return;

      if (user) {
        setUser(user);
        loadSettings(user.uid);
      } else {
        setUser(null);
      }
      setLoadingAuth(false);
    });

    return () => {
      unsubscribe();
      mountedRef.current = false;
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="max-w-md w-full mx-auto p-6 bg-gray-800 rounded-lg shadow-lg">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Welcome to Auto-Leads</h1>
            <p className="text-gray-400 mb-6">Please sign in to access your dashboard</p>
            
            {authError && (
              <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-200 text-sm">
                {authError}
              </div>
            )}

            <button
              onClick={signInWithGoogle}
              disabled={!auth}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </button>

            {!auth && (
              <div className="mt-4 text-sm text-gray-400">
                Firebase is not properly configured. Please check your environment variables.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-gray-400">Welcome back, {user.displayName || user.email}!</p>
          </div>
          <button
            onClick={handleSignOut}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition duration-200"
          >
            Sign Out
          </button>
        </div>
        
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="font-medium mb-2">Upload CSV</h3>
              <p className="text-gray-400 text-sm">Import new leads from CSV file</p>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="font-medium mb-2">Send Emails</h3>
              <p className="text-gray-400 text-sm">Launch email campaigns</p>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="font-medium mb-2">View Analytics</h3>
              <p className="text-gray-400 text-sm">Track campaign performance</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
