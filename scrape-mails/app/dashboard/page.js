'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// Firebase imports
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

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
  const router = useRouter();
  const pathname = usePathname();
  const mountedRef = useRef(true);

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
        <div>Please sign in to access the dashboard</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        <p>Welcome back, {user.displayName || user.email}!</p>
        
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
