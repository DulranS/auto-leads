'use client';

import { useState, useEffect, useCallback } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
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

// Contact statuses
const CONTACT_STATUSES = [
  { id: 'new', label: 'New', color: 'gray' },
  { id: 'contacted', label: 'Contacted', color: 'blue' },
  { id: 'replied', label: 'Replied', color: 'green' },
  { id: 'interested', label: 'Interested', color: 'purple' },
  { id: 'demo_scheduled', label: 'Demo Scheduled', color: 'orange' },
  { id: 'closed_won', label: 'Closed Won', color: 'emerald' },
  { id: 'not_interested', label: 'Not Interested', color: 'red' },
  { id: 'do_not_contact', label: 'Do Not Contact', color: 'rose' }
];

// Default templates
const DEFAULT_TEMPLATE_A = {
  subject: "Quick question about {{business_name}}",
  body: `Hi {{first_name}},

Noticed your recent work at {{business_name}} and wanted to reach out.

We help SaaS companies like yours scale customer acquisition efficiently. 

Would you be open to a brief chat next week?

Best regards,
{{sender_name}}`
};

const DEFAULT_WHATSAPP_TEMPLATE = `Hi {{first_name}}, this is {{sender_name}}. I noticed your work at {{business_name}} and wanted to connect. Is this a good time to chat?`;

export default function FinalOptimalSalesMachine() {
  // Auth state
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  // Application state
  const [csvContent, setCsvContent] = useState('');
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [senderName, setSenderName] = useState('');
  const [templateA, setTemplateA] = useState(DEFAULT_TEMPLATE_A);
  const [whatsappTemplate, setWhatsappTemplate] = useState(DEFAULT_WHATSAPP_TEMPLATE);
  const [fieldMappings, setFieldMappings] = useState({});
  const [validEmails, setValidEmails] = useState(0);
  const [validWhatsApp, setValidWhatsApp] = useState(0);
  const [whatsappLinks, setWhatsappLinks] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState('');
  
  // Contact management state
  const [contactStatuses, setContactStatuses] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');
  
  // KPI state
  const [kpis, setKpis] = useState({ sent: 0, replies: 0, meetings: 0, bounces: 0, opens: 0, clicks: 0 });
  const [activeTab, setActiveTab] = useState('targets');

  // Google sign in
  const signInWithGoogle = async () => {
    if (!auth) return;
    
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      setUser(result.user);
      setSenderName(result.user.displayName || 'Team');
    } catch (error) {
      console.error('Sign in error:', error);
      setStatus('❌ Failed to sign in. Please try again.');
    }
  };

  // Sign out
  const signOutUser = async () => {
    if (!auth) return;
    
    try {
      await signOut(auth);
      setUser(null);
      setWhatsappLinks([]);
      setContactStatuses({});
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Load contacts from Firestore
  const loadContactsFromFirestore = useCallback(async (userId) => {
    if (!userId || !db) return;
    
    try {
      const contactsRef = collection(db, 'users', userId, 'contacts');
      const q = query(contactsRef);
      const snapshot = await getDocs(q);
      
      const contacts = [];
      const statuses = {};
      
      snapshot.forEach(doc => {
        const data = doc.data();
        contacts.push({
          id: doc.id,
          business: data.business || 'Business',
          email: data.email || '',
          phone: data.phone || '',
          address: data.address || '',
          website: data.website || '',
          status: data.status || 'new',
          createdAt: (data.createdAt && data.createdAt.toDate) ? data.createdAt.toDate() : data.createdAt || new Date(),
          lastUpdated: (data.lastUpdated && data.lastUpdated.toDate) ? data.lastUpdated.toDate() : data.lastUpdated || new Date()
        });
        
        statuses[data.email || `phone_${data.phone}`] = data.status || 'new';
      });
      
      setWhatsappLinks(contacts);
      setContactStatuses(statuses);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    }
  }, [db]);

  // Auth effect
  useEffect(() => {
    if (!auth) {
      setLoadingAuth(false);
      return;
    }
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoadingAuth(false);
      if (user) {
        setSenderName(user.displayName || 'Team');
        loadContactsFromFirestore(user.uid);
      }
    });
    
    return unsubscribe;
  }, [loadContactsFromFirestore]);

  // Utility functions
  const isValidEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const formatForDialing = (raw) => {
    if (!raw || raw === 'N/A') return null;
    let cleaned = raw.toString().replace(/\D/g, '');
    if (cleaned.startsWith('0') && cleaned.length >= 9) {
      cleaned = '94' + cleaned.slice(1);
    }
    return /^[1-9]\d{9,14}$/.test(cleaned) ? cleaned : null;
  };

  const parseCsvRow = (text) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result.map(field => {
      let cleaned = field.replace(/[\r\n]/g, '').trim();
      if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
        cleaned = cleaned.slice(1, -1).replace(/""/g, '"');
      }
      return cleaned;
    });
  };

  const renderPreviewText = (text, recipient, mappings, sender) => {
    if (!text) return '';
    let result = text;
    
    Object.entries(mappings).forEach(([varName, col]) => {
      const regex = new RegExp(`{{\\s*${varName}\\s*}}`, 'g');
      if (varName === 'sender_name') {
        result = result.replace(regex, sender || 'Team');
      } else if (recipient && col && recipient[col] !== undefined) {
        result = result.replace(regex, String(recipient[col]));
      } else {
        result = result.replace(regex, `[MISSING: ${varName}]`);
      }
    });
    
    return result;
  };

  // Save contacts to Firestore
  const saveContactsToFirestore = async (contacts, userId) => {
    if (!userId || contacts.length === 0 || !db) return;
    
    try {
      const contactsRef = collection(db, 'users', userId, 'contacts');
      
      for (const contact of contacts) {
        await setDoc(doc(contactsRef, contact.id), {
          ...contact,
          createdAt: serverTimestamp(),
          lastUpdated: serverTimestamp()
        }, { merge: true });
      }
    } catch (error) {
      console.error('Failed to save contacts:', error);
      throw error;
    }
  };

  // Handle CSV upload
  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setStatus('📊 Processing CSV file...');
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          setStatus('❌ CSV file must contain headers and at least one row of data');
          return;
        }
        
        const headers = parseCsvRow(lines[0]);
        setCsvHeaders(headers);
        
        // Process contacts
        const validPhoneContacts = [];
        let firstValid = null;
        
        for (let i = 1; i < lines.length; i++) {
          const values = parseCsvRow(lines[i]);
          if (values.length !== headers.length) continue;
          
          const row = {};
          headers.forEach((header, idx) => {
            row[header] = values[idx] || '';
          });
          
          // Check email validity
          const hasValidEmail = isValidEmail(row.email);
          if (hasValidEmail) {
            const rawPhone = row.whatsapp_number || row.phone_raw || row.phone;
            const formattedPhone = formatForDialing(rawPhone);
            
            if (formattedPhone) {
              const contactId = `${row.email || 'no-email'}-${formattedPhone}-${Date.now()}-${Math.random()}`;
              validPhoneContacts.push({
                id: contactId,
                business: row.business_name || 'Business',
                address: row.address || '',
                phone: formattedPhone,
                email: row.email || null,
                place_id: row.place_id || '',
                website: row.website || '',
                status: 'new',
                lastContacted: null,
                createdAt: new Date(),
                lastUpdated: new Date()
              });
              
              if (!firstValid) firstValid = row;
            }
          }
        }
        
        setValidEmails(validPhoneContacts.length);
        setValidWhatsApp(validPhoneContacts.length);
        
        // Save to Firestore
        if (user?.uid && db) {
          try {
            setStatus('💾 Saving contacts to database...');
            await saveContactsToFirestore(validPhoneContacts, user.uid);
            setStatus(`✅ ${validPhoneContacts.length} contacts saved successfully!`);
            setWhatsappLinks(validPhoneContacts);
          } catch (error) {
            console.error('CSV save error:', error);
            setStatus(`❌ Failed to save contacts: ${error.message}`);
            setWhatsappLinks(validPhoneContacts); // Fallback to local state
          }
        } else {
          setWhatsappLinks(validPhoneContacts);
        }
        
        setCsvContent(text);
      } catch (error) {
        console.error('CSV processing error:', error);
        setStatus(`❌ Failed to process CSV: ${error.message}`);
      }
    };
    
    reader.readAsText(file);
  };

  // Update contact status
  const updateContactStatus = async (contactId, newStatus) => {
    if (!user?.uid || !contactId || !newStatus || !db) return false;
    
    try {
      const contactsRef = collection(db, 'users', user.uid, 'contacts');
      const q = query(contactsRef, where('email', '==', contactId.includes('@') ? contactId : null));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const docRef = snapshot.docs[0].ref;
        await updateDoc(docRef, {
          status: newStatus,
          lastUpdated: serverTimestamp()
        });
        
        // Update local state
        setContactStatuses(prev => ({ ...prev, [contactId]: newStatus }));
        setWhatsappLinks(prev => prev.map(contact => 
          contact.email === contactId || contact.phone === contactId 
            ? { ...contact, status: newStatus, lastUpdated: new Date() }
            : contact
        ));
        
        return true;
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
    
    return false;
  };

  // Status Badge Component
  const StatusBadge = ({ status, small = false }) => {
    const statusInfo = CONTACT_STATUSES.find(s => s.id === status);
    if (!statusInfo) return null;
    
    const colors = {
      gray: 'bg-gray-600',
      blue: 'bg-blue-600',
      green: 'bg-green-600',
      purple: 'bg-purple-600',
      orange: 'bg-orange-600',
      emerald: 'bg-emerald-600',
      red: 'bg-red-600',
      rose: 'bg-rose-600'
    };
    
    return (
      <span className={`${colors[statusInfo.color]} text-white px-2 py-1 rounded-full text-xs font-medium ${small ? 'text-xs' : 'text-sm'}`}>
        {statusInfo.label}
      </span>
    );
  };

  // Loading state
  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading Final Optimal Sales Machine...</p>
          <p className="text-sm text-gray-400 mt-2">Best of Both Worlds: Complete Manual Control + Strategic AI</p>
        </div>
      </div>
    );
  }

  // Not signed in
  if (!user) {
    return (
      <>
        <Head>
          <title>Final Optimal B2B Sales Machine - Sign In</title>
        </Head>
        
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50 shadow-2xl">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-2">Final Optimal B2B Sales Machine</h1>
                <p className="text-gray-300">Complete Manual Control + Strategic AI</p>
              </div>
              
              <div className="space-y-6">
                <div className="text-center">
                  <p className="text-gray-300 mb-4">Sign in to access your sales machine</p>
                  <button
                    onClick={signInWithGoogle}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                </div>
              </div>
              
              <div className="mt-8 text-center">
                <p className="text-sm text-gray-400">
                  Secure authentication powered by Google
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Final Optimal B2B Sales Machine</title>
      </Head>
      
      <div className="min-h-screen bg-gray-900 text-white">
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-bold">Final Optimal B2B Sales Machine</h1>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-300">
                  {user.email}
                </div>
                <button
                  onClick={signOutUser}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* KPI Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Sent</p>
                  <p className="text-2xl font-bold text-blue-400">{kpis.sent}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Replies</p>
                  <p className="text-2xl font-bold text-green-400">{kpis.replies}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Meetings</p>
                  <p className="text-2xl font-bold text-purple-400">{kpis.meetings}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Bounces</p>
                  <p className="text-2xl font-bold text-red-400">{kpis.bounces}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Status Messages */}
          {status && (
            <div className="mb-6 p-4 bg-blue-600/20 border border-blue-600/50 rounded-lg">
              <p>{status}</p>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="border-b border-gray-700 mb-8">
            <nav className="flex space-x-8">
              {['targets', 'templates', 'analytics'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${
                    activeTab === tab
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-300'
                  }`}
                >
                  {tab === 'targets' ? 'Target Companies' : tab === 'templates' ? 'Email Templates' : 'Analytics'}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'targets' && (
            <div className="space-y-6">
              {/* CSV Upload */}
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h2 className="text-xl font-semibold mb-4">Upload Target Companies</h2>
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-gray-400 mb-2">Drop your CSV file here or click to browse</p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvUpload}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label
                    htmlFor="csv-upload"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg cursor-pointer transition-colors"
                  >
                    Choose CSV File
                  </label>
                </div>
                
                {validEmails > 0 && (
                  <div className="mt-4 text-sm text-gray-400">
                    <p>Valid emails: {validEmails}</p>
                    <p>Valid WhatsApp numbers: {validWhatsApp}</p>
                  </div>
                )}
              </div>

              {/* Contacts List */}
              {whatsappLinks.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <h2 className="text-xl font-semibold mb-4">Target Companies ({whatsappLinks.length})</h2>
                  <div className="space-y-4">
                    {whatsappLinks.map((contact) => (
                      <div key={contact.id} className="bg-gray-700 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{contact.business}</h3>
                            <p className="text-gray-400">{contact.email}</p>
                            {contact.phone && (
                              <p className="text-gray-400">{contact.phone}</p>
                            )}
                            {contact.website && (
                              <a href={contact.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm">
                                {contact.website}
                              </a>
                            )}
                          </div>
                          <div className="ml-4">
                            <StatusBadge status={contact.status} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-6">
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h2 className="text-xl font-semibold mb-4">Email Templates</h2>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Template A Subject</label>
                    <input
                      type="text"
                      value={templateA.subject}
                      onChange={(e) => setTemplateA(prev => ({ ...prev, subject: e.target.value }))}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Template A Body</label>
                    <textarea
                      value={templateA.body}
                      onChange={(e) => setTemplateA(prev => ({ ...prev, body: e.target.value }))}
                      rows={10}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:outline-none font-mono text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h2 className="text-xl font-semibold mb-4">Analytics Dashboard</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-lg font-medium mb-2">Campaign Performance</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Total Sent:</span>
                        <span className="font-bold">{kpis.sent}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Open Rate:</span>
                        <span className="font-bold">{kpis.sent > 0 ? Math.round((kpis.opens / kpis.sent) * 100) : 0}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Reply Rate:</span>
                        <span className="font-bold">{kpis.sent > 0 ? Math.round((kpis.replies / kpis.sent) * 100) : 0}%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-lg font-medium mb-2">Conversion Metrics</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Meetings Booked:</span>
                        <span className="font-bold">{kpis.meetings}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Bounce Rate:</span>
                        <span className="font-bold">{kpis.sent > 0 ? Math.round((kpis.bounces / kpis.sent) * 100) : 0}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Click Rate:</span>
                        <span className="font-bold">{kpis.opens > 0 ? Math.round((kpis.clicks / kpis.opens) * 100) : 0}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
