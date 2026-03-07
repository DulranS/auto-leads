'use client';

import { useState, useEffect } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import Head from 'next/head';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
let app, db, auth;
if (typeof window !== 'undefined' && !getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
  } catch (error) {
    console.error('Firebase init failed:', error);
  }
}

export default function FinalOptimalSalesMachine() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState([]);
  const [status, setStatus] = useState('');

  // Auth effect
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      if (user) {
        loadContacts(user.uid);
      }
    });
    
    return unsubscribe;
  }, []);

  // Load contacts
  const loadContacts = async (userId) => {
    try {
      const contactsRef = collection(db, 'users', userId, 'contacts');
      const q = query(contactsRef);
      const snapshot = await getDocs(q);
      
      const contactsData = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        contactsData.push({
          id: doc.id,
          business: data.business || 'Business',
          email: data.email || '',
          phone: data.phone || '',
          status: data.status || 'new'
        });
      });
      
      setContacts(contactsData);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading Final Optimal Sales Machine...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Final Optimal B2B Sales Machine</h1>
          <p>Please sign in to continue.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Final Optimal B2B Sales Machine</title>
      </Head>
      
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-8">Final Optimal B2B Sales Machine</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Total Contacts</h3>
              <p className="text-2xl font-bold text-blue-400">{contacts.length}</p>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">New Leads</h3>
              <p className="text-2xl font-bold text-green-400">
                {contacts.filter(c => c.status === 'new').length}
              </p>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Contacted</h3>
              <p className="text-2xl font-bold text-purple-400">
                {contacts.filter(c => c.status === 'contacted').length}
              </p>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Contacts</h2>
            {contacts.length === 0 ? (
              <p className="text-gray-400">No contacts found. Upload a CSV file to get started.</p>
            ) : (
              <div className="space-y-4">
                {contacts.map((contact) => (
                  <div key={contact.id} className="bg-gray-700 p-4 rounded-lg">
                    <h3 className="font-semibold">{contact.business}</h3>
                    <p className="text-gray-400">{contact.email}</p>
                    <p className="text-gray-400">{contact.phone}</p>
                    <span className="inline-block mt-2 px-2 py-1 bg-blue-600 text-white text-xs rounded">
                      {contact.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
