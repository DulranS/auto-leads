'use client';

/**
 * ============================================================================
 * MANUAL-FIRST B2B SALES MACHINE - AI IS OPTIONAL HELP
 * ============================================================================
 * 
 * CORE PRINCIPLE: When AI systems are down, you lose ZERO functionality.
 * 
 * ARCHITECTURE:
 * - Manual-first: Everything doable by hand through UI
 * - AI as helper: Enhances speed, never required
 * - Full manual privilege: Research, personalize, edit, send - all manual
 * - Zero AI dependency: System works 100% when AI is down
 * 
 * MANUAL CONTROLS:
 * 1. Manual research input (no AI needed)
 * 2. Manual personalization editor (no AI needed)
 * 3. Manual email composition (no AI needed)
 * 4. Manual send approval (approve each email individually)
 * 5. Manual KPI tracking (no automation needed)
 * 
 * AI USAGE (Optional):
 * - Click "AI Help" to speed up, but never required
 * - AI suggests, you decide
 * - AI assists, you control
 * - AI enhances, manual overrides always available
 */

import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, updateDoc, deleteDoc, serverTimestamp, increment } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import Papa from 'papaparse';

// Firebase - single source of truth
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

    if (firebaseConfig.apiKey && firebaseConfig.projectId) {
      app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      db = getFirestore(app);
      auth = getAuth(app);
    }
  } catch (error) {
    console.error('Firebase init failed:', error);
  }
}

// Proven templates - manual editing available
const DEFAULT_TEMPLATES = {
  email1: {
    name: 'Initial Outreach',
    subject: 'Quick question about {{company}} growth',
    body: `Hi {{first_name}},

Saw {{company}} just raised {{funding_amount}} - congrats on the momentum.

When SaaS companies hit your stage, scaling customer acquisition without burning cash becomes the real challenge.

We help Series A-C SaaS companies add 15-25 qualified leads per month using our targeted outbound system.

Worth a 10-min chat to see if we can help you hit your Q2 targets?

Best,
{{sender_name}}
{{booking_link}}`,
    word_count: 68
  },
  email2: {
    name: 'Follow-up',
    subject: 'Re: {{company}} growth',
    body: `Hi {{first_name}},

Quick follow-up - helped {{similar_company}} (similar stage) add 22 qualified leads last month.

They were struggling with the same customer acquisition efficiency challenges.

Our approach: We handle the research + outreach, you focus on closing.

10-min call to see if it makes sense for {{company}}?

{{sender_name}}
{{booking_link}}`,
    word_count: 58
  },
  breakup: {
    name: 'Break-up',
    subject: 'Closing the loop',
    body: `Hi {{first_name}},

Tried reaching out a few times about helping {{company}} scale customer acquisition.

Assuming the timing isn't right or this isn't a priority.

If that changes, I'm here. Otherwise, I'll close your file.

Best,
{{sender_name}}`,
    word_count: 42
  }
};

export default function ManualFirstSalesMachine() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('targets');
  
  // Targets state - manual input supported
  const [targets, setTargets] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [manualResearch, setManualResearch] = useState({
    headline: '',
    observations: '',
    painPoints: ''
  });
  
  // Personalization state - manual editing
  const [manualPersonalization, setManualPersonalization] = useState({
    observation: '',
    impact: ''
  });
  
  // Email composition state - manual composition
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState('email1');
  const [customEmail, setCustomEmail] = useState({
    subject: '',
    body: ''
  });
  const [emailPreview, setEmailPreview] = useState(null);
  
  // Send queue state - manual approval
  const [sendQueue, setSendQueue] = useState([]);
  const [approvedEmails, setApprovedEmails] = useState([]);
  const [sentEmails, setSentEmails] = useState([]);
  
  // Practical sales features
  const [emailOpenRate, setEmailOpenRate] = useState(0);
  const [replyRate, setReplyRate] = useState(0);
  const [bookingRate, setBookingRate] = useState(0);
  const [dailySendLimit, setDailySendLimit] = useState(25);
  const [todaySent, setTodaySent] = useState(0);
  const [warmupMode, setWarmupMode] = useState(true);
  const [templatePerformance, setTemplatePerformance] = useState({});
  
  // KPI state - manual tracking
  const [manualKPIs, setManualKPIs] = useState({
    sent: 0,
    replies: 0,
    meetings: 0,
    bounces: 0
  });
  
  // AI assistance state (optional)
  const [aiStatus, setAiStatus] = useState('available'); // 'available', 'loading', 'unavailable'
  const [useAI, setUseAI] = useState(false);

  // Auth effect
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  // Sign in
  const signIn = async () => {
    if (!auth) return;
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Sign in error:', error);
    }
  };

  // ============================================================================
  // MANUAL TARGET RESEARCH (No AI Required)
  // ============================================================================
  
  const addManualTarget = () => {
    const newTarget = {
      id: `target_${Date.now()}`,
      business_name: '',
      website: '',
      industry: 'SaaS',
      size: '',
      status: 'draft',
      research: {
        headline: '',
        observations: '',
        painPoints: '',
        source: 'manual'
      },
      personalization: {
        observation: '',
        impact: ''
      },
      decisionMakers: [],
      createdAt: new Date().toISOString()
    };
    setTargets(prev => [...prev, newTarget]);
    setSelectedTarget(newTarget);
    setActiveTab('research');
  };

  const updateTargetResearch = (targetId, researchData) => {
    setTargets(prev => prev.map(target => 
      target.id === targetId 
        ? { ...target, research: { ...target.research, ...researchData, source: 'manual' } }
        : target
    ));
  };

  const updateTargetPersonalization = (targetId, personalizationData) => {
    setTargets(prev => prev.map(target => 
      target.id === targetId 
        ? { ...target, personalization: { ...target.personalization, ...personalizationData } }
        : target
    ));
  };

  // ============================================================================
  // MANUAL DECISION MAKER MANAGEMENT
  // ============================================================================
  
  const addDecisionMaker = (targetId, dmData) => {
    setTargets(prev => prev.map(target => 
      target.id === targetId 
        ? { 
            ...target, 
            decisionMakers: [...target.decisionMakers, {
              id: `dm_${Date.now()}`,
              name: dmData.name || '',
              role: dmData.role || '',
              email: dmData.email || '',
              linkedIn: dmData.linkedIn || '',
              verified: false,
              source: 'manual'
            }] 
          }
        : target
    ));
  };

  const updateDecisionMaker = (targetId, dmId, dmData) => {
    setTargets(prev => prev.map(target => 
      target.id === targetId 
        ? { 
            ...target, 
            decisionMakers: target.decisionMakers.map(dm => 
              dm.id === dmId ? { ...dm, ...dmData } : dm
            ) 
          }
        : target
    ));
  };

  const deleteDecisionMaker = (targetId, dmId) => {
    setTargets(prev => prev.map(target => 
      target.id === targetId 
        ? { ...target, decisionMakers: target.decisionMakers.filter(dm => dm.id !== dmId) }
        : target
    ));
  };

  // ============================================================================
  // MANUAL EMAIL COMPOSITION
  // ============================================================================
  
  const composeEmail = (target, templateKey, customizations = {}) => {
    const template = templates[templateKey];
    const decisionMaker = target.decisionMakers[0] || {};
    const personalization = target.personalization || {};
    
    let subject = customizations.subject || template.subject;
    let body = customizations.body || template.body;
    
    // Apply manual replacements
    subject = subject
      .replace(/\{\{first_name\}\}/g, decisionMaker.name?.split(' ')[0] || '[First Name]')
      .replace(/\{\{company\}\}/g, target.business_name || '[Company]')
      .replace(/\{\{funding_amount\}\}/g, '$5M')
      .replace(/\{\{similar_company\}\}/g, 'TechCorp Inc')
      .replace(/\{\{sender_name\}\}/g, user?.displayName || '[Your Name]')
      .replace(/\{\{booking_link\}\}/g, 'https://cal.com/your-team/10min');
    
    body = body
      .replace(/\{\{first_name\}\}/g, decisionMaker.name?.split(' ')[0] || '[First Name]')
      .replace(/\{\{company\}\}/g, target.business_name || '[Company]')
      .replace(/\{\{funding_amount\}\}/g, '$5M')
      .replace(/\{\{similar_company\}\}/g, 'TechCorp Inc')
      .replace(/\{\{sender_name\}\}/g, user?.displayName || '[Your Name]')
      .replace(/\{\{booking_link\}\}/g, 'https://cal.com/your-team/10min');
    
    // Add personalization if available
    if (personalization.observation) {
      body = body.replace(/\{\{observation\}\}/g, personalization.observation);
    }
    if (personalization.impact) {
      body = body.replace(/\{\{impact\}\}/g, personalization.impact);
    }
    
    return { subject, body, targetId: target.id, dmId: decisionMaker.id };
  };

  const addToSendQueue = (emailData) => {
    setSendQueue(prev => [...prev, { ...emailData, id: `email_${Date.now()}`, status: 'pending' }]);
  };

  const approveEmail = (emailId) => {
    const email = sendQueue.find(e => e.id === emailId);
    if (email) {
      setApprovedEmails(prev => [...prev, email]);
      setSendQueue(prev => prev.filter(e => e.id !== emailId));
    }
  };

  const rejectEmail = (emailId) => {
    setSendQueue(prev => prev.filter(e => e.id !== emailId));
  };

  const sendApprovedEmail = async (email) => {
    // Check daily send limit
    if (todaySent >= dailySendLimit) {
      alert(`Daily send limit reached (${dailySendLimit}). Try again tomorrow.`);
      return;
    }
    
    // In real implementation, this would use your email service
    console.log('🚀 Sending email:', {
      to: email.to,
      subject: email.subject,
      body: email.body.substring(0, 100) + '...'
    });
    
    // Update sent emails
    const sentEmail = {
      ...email,
      sentAt: new Date().toISOString(),
      status: 'sent'
    };
    
    setSentEmails(prev => [...prev, sentEmail]);
    setApprovedEmails(prev => prev.filter(e => e.id !== email.id));
    setManualKPIs(prev => ({ ...prev, sent: prev.sent + 1 }));
    setTodaySent(prev => prev + 1);
    
    // Track template performance
    setTemplatePerformance(prev => ({
      ...prev,
      [email.templateKey]: {
        ...prev[email.templateKey],
        sent: (prev[email.templateKey]?.sent || 0) + 1
      }
    }));
    
    alert('Email sent successfully! (In production, this would send via your email service)');
  };
  
  const recordReply = (emailId, outcome) => {
    setSentEmails(prev => prev.map(email => 
      email.id === emailId 
        ? { ...email, replyOutcome: outcome, repliedAt: new Date().toISOString() }
        : email
    ));
    
    if (outcome === 'positive') {
      setManualKPIs(prev => ({ ...prev, replies: prev.replies + 1 }));
    }
    
    // Update template performance
    const email = sentEmails.find(e => e.id === emailId);
    if (email) {
      setTemplatePerformance(prev => ({
        ...prev,
        [email.templateKey]: {
          ...prev[email.templateKey],
          replies: (prev[email.templateKey]?.replies || 0) + (outcome === 'positive' ? 1 : 0)
        }
      }));
    }
  };
  
  const recordMeeting = (emailId) => {
    setSentEmails(prev => prev.map(email => 
      email.id === emailId 
        ? { ...email, meetingBooked: true, meetingAt: new Date().toISOString() }
        : email
    ));
    
    setManualKPIs(prev => ({ ...prev, meetings: prev.meetings + 1 }));
    
    // Update template performance
    const email = sentEmails.find(e => e.id === emailId);
    if (email) {
      setTemplatePerformance(prev => ({
        ...prev,
        [email.templateKey]: {
          ...prev[email.templateKey],
          meetings: (prev[email.templateKey]?.meetings || 0) + 1
        }
      }));
    }
  };

  // ============================================================================
  // AI ASSISTANCE (Optional Enhancement)
  // ============================================================================
  
  const requestAIResearch = async (target) => {
    if (!useAI) return;
    setAiStatus('loading');
    
    try {
      const response = await fetch('/api/personalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, research: target.research })
      });
      
      if (response.ok) {
        const data = await response.json();
        setManualResearch(prev => ({
          ...prev,
          observations: data.observation || prev.observations,
          painPoints: data.impact || prev.painPoints
        }));
        setAiStatus('available');
      } else {
        setAiStatus('unavailable');
      }
    } catch (error) {
      console.error('AI failed:', error);
      setAiStatus('unavailable');
    }
  };

  // ============================================================================
  // CSV IMPORT (Optional Helper)
  // ============================================================================
  
  const handleCsvUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const importedTargets = results.data.map((row, index) => ({
          id: `import_${Date.now()}_${index}`,
          business_name: row.business_name || row.company || '',
          website: row.website || '',
          industry: row.industry || 'SaaS',
          size: row.size || '',
          status: 'draft',
          research: {
            headline: '',
            observations: '',
            painPoints: '',
            source: 'import'
          },
          personalization: {
            observation: '',
            impact: ''
          },
          decisionMakers: [],
          createdAt: new Date().toISOString()
        }));
        
        setTargets(prev => [...prev, ...importedTargets]);
      },
      error: (error) => {
        console.error('CSV error:', error);
      }
    });
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading Manual-First Sales Machine...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <h1 className="text-3xl font-bold mb-6">Manual-First B2B Sales Machine</h1>
          <p className="text-gray-400 mb-4">AI is optional help, never a dependency</p>
          <p className="text-gray-400 mb-8">When AI is down, you lose ZERO functionality</p>
          <button
            onClick={signIn}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Head>
        <title>Manual-First B2B Sales Machine</title>
        <meta name="description" content="AI is optional, manual control is absolute" />
      </Head>

      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Manual-First Sales Machine</h1>
            <p className="text-gray-400 text-sm">AI helps, you control, system works when AI is down</p>
          </div>
          <div className="flex items-center gap-4">
            {/* AI Toggle */}
            <div className="flex items-center gap-2 bg-gray-700 px-3 py-2 rounded-lg">
              <span className="text-sm">AI Help:</span>
              <button
                onClick={() => setUseAI(!useAI)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  useAI ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'
                }`}
              >
                {useAI ? 'ON' : 'OFF'}
              </button>
              <span className={`w-2 h-2 rounded-full ${
                aiStatus === 'available' ? 'bg-green-400' : 
                aiStatus === 'loading' ? 'bg-yellow-400' : 'bg-red-400'
              }`}></span>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Welcome</p>
              <p className="font-semibold">{user.displayName}</p>
            </div>
            <button
              onClick={() => signOut(auth)}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-sm transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Manual KPI Dashboard */}
      <div className="bg-gray-800 p-6 border-b border-gray-700">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-700 p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Manual Sent</p>
            <p className="text-2xl font-bold">{manualKPIs.sent}</p>
            <button onClick={() => setManualKPIs(p => ({...p, sent: p.sent + 1}))} className="text-xs bg-green-600 px-2 py-1 rounded mt-2">
              + Manual Track
            </button>
          </div>
          <div className="bg-gray-700 p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Manual Replies</p>
            <p className="text-2xl font-bold text-green-400">{manualKPIs.replies}</p>
            <button onClick={() => setManualKPIs(p => ({...p, replies: p.replies + 1}))} className="text-xs bg-green-600 px-2 py-1 rounded mt-2">
              + Manual Track
            </button>
          </div>
          <div className="bg-gray-700 p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Manual Meetings</p>
            <p className="text-2xl font-bold">{manualKPIs.meetings}</p>
            <button onClick={() => setManualKPIs(p => ({...p, meetings: p.meetings + 1}))} className="text-xs bg-green-600 px-2 py-1 rounded mt-2">
              + Manual Track
            </button>
          </div>
          <div className="bg-gray-700 p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Send Queue</p>
            <p className="text-2xl font-bold text-yellow-400">{sendQueue.length}</p>
            <p className="text-xs text-gray-400 mt-2">{approvedEmails.length} approved</p>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS DASHBOARD - Practical Sales Features */}
        <div className="max-w-7xl mx-auto p-6">
          <div className="bg-gray-800 p-6 rounded-lg mb-6">
            <h2 className="text-xl font-bold mb-4">🚀 Quick Actions - Real Sales Tools</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-700 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Daily Send Limit</h3>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{todaySent}/{dailySendLimit}</span>
                  <button
                    onClick={() => setWarmupMode(!warmupMode)}
                    className={`px-3 py-1 rounded text-sm ${warmupMode ? 'bg-green-600' : 'bg-yellow-600'}`}
                  >
                    {warmupMode ? 'Warmup' : 'Normal'}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {warmupMode ? 'Gradual increase for new domains' : 'Full daily limit available'}
                </p>
              </div>
              
              <div className="bg-gray-700 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Best Template</h3>
                <div className="text-2xl font-bold text-green-400">
                  {Object.entries(templatePerformance).length > 0 
                    ? Object.entries(templatePerformance).sort((a, b) => 
                        (b[1].replies / b[1].sent || 0) - (a[1].replies / a[1].sent || 0)
                      )[0]?.[0]?.replace('email', 'Template ') || 'N/A'
                    : 'No data'
                  }
                </div>
                <p className="text-xs text-gray-400 mt-2">Highest reply rate</p>
              </div>
              
              <div className="bg-gray-700 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Today's Performance</h3>
                <div className="text-2xl font-bold text-blue-400">
                  {manualKPIs.sent > 0 ? ((manualKPIs.replies / manualKPIs.sent) * 100).toFixed(1) : 0}%
                </div>
                <p className="text-xs text-gray-400 mt-2">Reply rate today</p>
              </div>
              
              <div className="bg-gray-700 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Quick Stats</h3>
                <div className="text-2xl font-bold text-purple-400">
                  ${((manualKPIs.meetings * 5000) + (manualKPIs.replies * 500)).toLocaleString()}
                </div>
                <p className="text-xs text-gray-400 mt-2">Pipeline value estimate</p>
              </div>
            </div>
            
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setDailySendLimit(Math.max(10, dailySendLimit - 5))}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors"
              >
                Decrease Limit (-5)
              </button>
              <button
                onClick={() => setDailySendLimit(Math.min(100, dailySendLimit + 5))}
                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-colors"
              >
                Increase Limit (+5)
              </button>
              <button
                onClick={() => setTodaySent(0)}
                className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded-lg transition-colors"
              >
                Reset Daily Counter
              </button>
            </div>
          </div>
        </div>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex space-x-1 mb-6 bg-gray-800 p-1 rounded-lg">
          {['targets', 'research', 'personalize', 'compose', 'queue', 'analytics'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-4 rounded-md transition-colors ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* TARGETS TAB - Manual Management */}
        {activeTab === 'targets' && (
          <div className="space-y-6">
            <div className="bg-gray-800 p-6 rounded-lg">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Manual Target Management</h2>
                <div className="flex gap-4">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvUpload}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload" className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg cursor-pointer transition-colors">
                    Import CSV
                  </label>
                  <button
                    onClick={addManualTarget}
                    className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-colors"
                  >
                    + Add Target Manually
                  </button>
                </div>
              </div>

              {targets.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <p className="mb-4">No targets yet. Add manually or import CSV.</p>
                  <p className="text-sm">AI is optional - you can do everything by hand.</p>
                </div>
              )}

              {targets.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {targets.map((target) => (
                    <div key={target.id} className="bg-gray-700 p-4 rounded-lg border-2 border-transparent hover:border-blue-500 cursor-pointer transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{target.business_name || 'Unnamed Target'}</h3>
                        <span className={`px-2 py-1 rounded text-xs ${
                          target.status === 'draft' ? 'bg-gray-600' :
                          target.status === 'researched' ? 'bg-blue-600' :
                          target.status === 'personalized' ? 'bg-yellow-600' :
                          target.status === 'ready' ? 'bg-green-600' : 'bg-gray-600'
                        }`}>
                          {target.status}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm mb-2">{target.website}</p>
                      <div className="text-sm text-gray-400 space-y-1">
                        <p>Research: {target.research?.headline ? '✅' : '❌'}</p>
                        <p>Personalization: {target.personalization?.observation ? '✅' : '❌'}</p>
                        <p>Decision Makers: {target.decisionMakers?.length || 0}</p>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => { setSelectedTarget(target); setActiveTab('research'); }}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm transition-colors"
                        >
                          Research
                        </button>
                        <button
                          onClick={() => { setSelectedTarget(target); setActiveTab('compose'); }}
                          className="flex-1 bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm transition-colors"
                        >
                          Compose
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* RESEARCH TAB - Manual Research Input */}
        {activeTab === 'research' && (
          <div className="space-y-6">
            <div className="bg-gray-800 p-6 rounded-lg">
              <h2 className="text-xl font-bold mb-4">Manual Research Input</h2>
              <p className="text-gray-400 mb-6">Enter research data by hand. AI can suggest, but you decide.</p>

              {selectedTarget ? (
                <div className="space-y-6">
                  <div className="bg-gray-700 p-4 rounded-lg">
                    <h3 className="font-semibold mb-2">Target: {selectedTarget.business_name}</h3>
                    <p className="text-gray-400 text-sm">{selectedTarget.website}</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Headline/Trigger</label>
                      <input
                        type="text"
                        value={manualResearch.headline}
                        onChange={(e) => setManualResearch(p => ({...p, headline: e.target.value}))}
                        placeholder="e.g., 'Company raised $5M Series B'"
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Key Observations</label>
                      <textarea
                        value={manualResearch.observations}
                        onChange={(e) => setManualResearch(p => ({...p, observations: e.target.value}))}
                        placeholder="What have you observed about this company?"
                        rows={3}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Pain Points</label>
                      <textarea
                        value={manualResearch.painPoints}
                        onChange={(e) => setManualResearch(p => ({...p, painPoints: e.target.value}))}
                        placeholder="What challenges do they likely face?"
                        rows={3}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"
                      />
                    </div>

                    {/* AI Suggestion Button (Optional) */}
                    {useAI && (
                      <button
                        onClick={() => requestAIResearch(selectedTarget)}
                        disabled={aiStatus === 'loading'}
                        className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 px-4 py-2 rounded-lg transition-colors"
                      >
                        {aiStatus === 'loading' ? 'AI Thinking...' : '💡 AI Suggest'}
                      </button>
                    )}

                    <button
                      onClick={() => {
                        updateTargetResearch(selectedTarget.id, {
                          headline: manualResearch.headline,
                          observations: manualResearch.observations,
                          painPoints: manualResearch.painPoints
                        });
                        setSelectedTarget(null);
                        setManualResearch({ headline: '', observations: '', painPoints: '' });
                        setActiveTab('targets');
                      }}
                      className="w-full bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-colors"
                    >
                      Save Manual Research
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <p>Select a target from the Targets tab to research</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PERSONALIZE TAB - Manual Personalization */}
        {activeTab === 'personalize' && (
          <div className="space-y-6">
            <div className="bg-gray-800 p-6 rounded-lg">
              <h2 className="text-xl font-bold mb-4">Manual Personalization Editor</h2>
              <p className="text-gray-400 mb-6">Write personalization bullets by hand. AI can help, but you control.</p>

              {selectedTarget ? (
                <div className="space-y-6">
                  <div className="bg-gray-700 p-4 rounded-lg">
                    <h3 className="font-semibold mb-2">Target: {selectedTarget.business_name}</h3>
                    <p className="text-gray-400 text-sm">Research: {selectedTarget.research?.headline}</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Specific Observation (15 words max)</label>
                      <textarea
                        value={manualPersonalization.observation}
                        onChange={(e) => setManualPersonalization(p => ({...p, observation: e.target.value}))}
                        placeholder="e.g., 'Company is hiring 15 sales reps this quarter'"
                        rows={2}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"
                      />
                      <p className="text-xs text-gray-400 mt-1">{manualPersonalization.observation.split(' ').length}/15 words</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Business Impact (15 words max)</label>
                      <textarea
                        value={manualPersonalization.impact}
                        onChange={(e) => setManualPersonalization(p => ({...p, impact: e.target.value}))}
                        placeholder="e.g., 'This creates urgency for scalable customer acquisition'"
                        rows={2}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"
                      />
                      <p className="text-xs text-gray-400 mt-1">{manualPersonalization.impact.split(' ').length}/15 words</p>
                    </div>

                    <button
                      onClick={() => {
                        updateTargetPersonalization(selectedTarget.id, {
                          observation: manualPersonalization.observation,
                          impact: manualPersonalization.impact
                        });
                        setSelectedTarget(null);
                        setManualPersonalization({ observation: '', impact: '' });
                        setActiveTab('targets');
                      }}
                      className="w-full bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-colors"
                    >
                      Save Manual Personalization
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <p>Select a target from the Targets tab to personalize</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* COMPOSE TAB - Manual Email Editor */}
        {activeTab === 'compose' && (
          <div className="space-y-6">
            <div className="bg-gray-800 p-6 rounded-lg">
              <h2 className="text-xl font-bold mb-4">Manual Email Composer</h2>
              <p className="text-gray-400 mb-6">Edit every word. Use templates as starting points, make them yours.</p>

              {selectedTarget ? (
                <div className="space-y-6">
                  <div className="bg-gray-700 p-4 rounded-lg">
                    <h3 className="font-semibold mb-2">Target: {selectedTarget.business_name}</h3>
                    <p className="text-gray-400 text-sm">Personalization: {selectedTarget.personalization?.observation}</p>
                  </div>

                  {/* Template Selection */}
                  <div className="flex gap-2">
                    {Object.keys(templates).map((key) => (
                      <button
                        key={key}
                        onClick={() => {
                          setSelectedTemplate(key);
                          const email = composeEmail(selectedTarget, key);
                          setCustomEmail(email);
                        }}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          selectedTemplate === key ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                        }`}
                      >
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </button>
                    ))}
                  </div>

                  {/* Manual Email Editor */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Subject Line (Manual Edit)</label>
                      <input
                        type="text"
                        value={customEmail.subject}
                        onChange={(e) => setCustomEmail(p => ({...p, subject: e.target.value}))}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Email Body (Manual Edit)</label>
                      <textarea
                        value={customEmail.body}
                        onChange={(e) => setCustomEmail(p => ({...p, body: e.target.value}))}
                        rows={12}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 font-mono text-sm"
                      />
                    </div>

                    {/* Live Preview */}
                    <div className="bg-gray-700 p-4 rounded-lg">
                      <h4 className="font-semibold mb-2">Live Preview</h4>
                      <p className="font-semibold text-blue-400">{customEmail.subject}</p>
                      <pre className="mt-2 text-sm text-gray-300 whitespace-pre-wrap">{customEmail.body}</pre>
                    </div>

                    <div className="flex gap-4">
                      <button
                        onClick={() => {
                          const decisionMaker = selectedTarget.decisionMakers[0];
                          addToSendQueue({
                            ...customEmail,
                            to: decisionMaker?.email || '[No email]',
                            targetId: selectedTarget.id,
                            targetName: selectedTarget.business_name
                          });
                          setActiveTab('queue');
                        }}
                        className="flex-1 bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded-lg transition-colors"
                      >
                        Add to Send Queue
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <p>Select a target from the Targets tab to compose email</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* QUEUE TAB - Manual Send Approval */}
        {activeTab === 'queue' && (
          <div className="space-y-6">
            <div className="bg-gray-800 p-6 rounded-lg">
              <h2 className="text-xl font-bold mb-4">Manual Send Queue</h2>
              <p className="text-gray-400 mb-6">Review every email. Approve individually. Full manual control.</p>

              {/* Pending Queue */}
              {sendQueue.length > 0 && (
                <div className="mb-8">
                  <h3 className="font-semibold mb-4">Pending Review ({sendQueue.length})</h3>
                  <div className="space-y-4">
                    {sendQueue.map((email) => (
                      <div key={email.id} className="bg-gray-700 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">{email.targetName}</h4>
                          <span className="px-2 py-1 rounded text-xs bg-yellow-600">Pending</span>
                        </div>
                        <p className="text-blue-400 text-sm mb-2">{email.subject}</p>
                        <pre className="text-xs text-gray-400 whitespace-pre-wrap mb-4">{email.body.substring(0, 200)}...</pre>
                        <div className="flex gap-2">
                          <button
                            onClick={() => approveEmail(email.id)}
                            className="flex-1 bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-colors"
                          >
                            ✅ Approve
                          </button>
                          <button
                            onClick={() => rejectEmail(email.id)}
                            className="flex-1 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors"
                          >
                            ❌ Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Approved Queue */}
              {approvedEmails.length > 0 && (
                <div className="mb-8">
                  <h3 className="font-semibold mb-4">Approved ({approvedEmails.length})</h3>
                  <div className="space-y-4">
                    {approvedEmails.map((email) => (
                      <div key={email.id} className="bg-gray-700 p-4 rounded-lg border-l-4 border-green-500">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">{email.targetName}</h4>
                          <span className="px-2 py-1 rounded text-xs bg-green-600">Approved</span>
                        </div>
                        <p className="text-blue-400 text-sm">{email.subject}</p>
                        <button
                          onClick={() => sendApprovedEmail(email)}
                          className="mt-4 w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
                        >
                          🚀 Send Now
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sent History */}
              {sentEmails.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-4">Sent History ({sentEmails.length})</h3>
                  <div className="space-y-3">
                    {sentEmails.slice(-10).reverse().map((email) => (
                      <div key={email.id} className="bg-gray-700 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-semibold">{email.targetName}</span>
                            <span className="text-gray-400 text-sm ml-2">{email.to}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-sm">{new Date(email.sentAt).toLocaleDateString()}</span>
                            {email.replyOutcome && (
                              <span className={`px-2 py-1 rounded text-xs ${
                                email.replyOutcome === 'positive' ? 'bg-green-600' :
                                email.replyOutcome === 'negative' ? 'bg-red-600' :
                                'bg-yellow-600'
                              }`}>
                                {email.replyOutcome}
                              </span>
                            )}
                            {email.meetingBooked && (
                              <span className="px-2 py-1 rounded text-xs bg-purple-600">Meeting</span>
                            )}
                          </div>
                        </div>
                        <p className="text-blue-400 text-sm mb-3">{email.subject}</p>
                        
                        {!email.replyOutcome && (
                          <div className="flex gap-2 mb-3">
                            <button
                              onClick={() => recordReply(email.id, 'positive')}
                              className="flex-1 bg-green-600 hover:bg-green-700 px-3 py-2 rounded text-sm transition-colors"
                            >
                              ✅ Positive Reply
                            </button>
                            <button
                              onClick={() => recordReply(email.id, 'negative')}
                              className="flex-1 bg-red-600 hover:bg-red-700 px-3 py-2 rounded text-sm transition-colors"
                            >
                              ❌ Not Interested
                            </button>
                            <button
                              onClick={() => recordReply(email.id, 'neutral')}
                              className="flex-1 bg-yellow-600 hover:bg-yellow-700 px-3 py-2 rounded text-sm transition-colors"
                            >
                              ⏸️ Follow Up Later
                            </button>
                          </div>
                        )}
                        
                        {email.replyOutcome === 'positive' && !email.meetingBooked && (
                          <button
                            onClick={() => recordMeeting(email.id)}
                            className="w-full bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded text-sm transition-colors"
                          >
                            📅 Book Meeting
                          </button>
                        )}
                        
                        {email.templateKey && templatePerformance[email.templateKey] && (
                          <div className="mt-2 text-xs text-gray-400">
                            Template: {DEFAULT_TEMPLATES[email.templateKey]?.name || email.templateKey} | 
                            Performance: {templatePerformance[email.templateKey]?.replies || 0}/{templatePerformance[email.templateKey]?.sent || 0} replies
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sendQueue.length === 0 && approvedEmails.length === 0 && sentEmails.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <p>Send queue is empty</p>
                  <p className="text-sm mt-2">Compose emails in the Compose tab to add to queue</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ANALYTICS TAB - Manual KPI Tracking */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="bg-gray-800 p-6 rounded-lg">
              <h2 className="text-xl font-bold mb-4">Manual KPI Tracking</h2>
              <p className="text-gray-400 mb-6">Track performance by hand. No automation required.</p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-gray-700 p-4 rounded-lg">
                  <p className="text-gray-400 text-sm">Sent</p>
                  <p className="text-3xl font-bold">{manualKPIs.sent}</p>
                  <button onClick={() => setManualKPIs(p => ({...p, sent: Math.max(0, p.sent - 1)}))} className="text-xs bg-red-600 px-2 py-1 rounded mt-2">-</button>
                  <button onClick={() => setManualKPIs(p => ({...p, sent: p.sent + 1}))} className="text-xs bg-green-600 px-2 py-1 rounded mt-2 ml-2">+</button>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg">
                  <p className="text-gray-400 text-sm">Replies</p>
                  <p className="text-3xl font-bold text-green-400">{manualKPIs.replies}</p>
                  <button onClick={() => setManualKPIs(p => ({...p, replies: Math.max(0, p.replies - 1)}))} className="text-xs bg-red-600 px-2 py-1 rounded mt-2">-</button>
                  <button onClick={() => setManualKPIs(p => ({...p, replies: p.replies + 1}))} className="text-xs bg-green-600 px-2 py-1 rounded mt-2 ml-2">+</button>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg">
                  <p className="text-gray-400 text-sm">Meetings</p>
                  <p className="text-3xl font-bold">{manualKPIs.meetings}</p>
                  <button onClick={() => setManualKPIs(p => ({...p, meetings: Math.max(0, p.meetings - 1)}))} className="text-xs bg-red-600 px-2 py-1 rounded mt-2">-</button>
                  <button onClick={() => setManualKPIs(p => ({...p, meetings: p.meetings + 1}))} className="text-xs bg-green-600 px-2 py-1 rounded mt-2 ml-2">+</button>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg">
                  <p className="text-gray-400 text-sm">Bounces</p>
                  <p className="text-3xl font-bold text-red-400">{manualKPIs.bounces}</p>
                  <button onClick={() => setManualKPIs(p => ({...p, bounces: Math.max(0, p.bounces - 1)}))} className="text-xs bg-red-600 px-2 py-1 rounded mt-2">-</button>
                  <button onClick={() => setManualKPIs(p => ({...p, bounces: p.bounces + 1}))} className="text-xs bg-green-600 px-2 py-1 rounded mt-2 ml-2">+</button>
                </div>
              </div>

              <div className="bg-gray-700 p-4 rounded-lg">
                <h3 className="font-semibold mb-4">Calculated Metrics</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Reply Rate:</span>
                    <span className={manualKPIs.sent > 0 && (manualKPIs.replies/manualKPIs.sent)*100 > 5 ? 'text-green-400' : 'text-yellow-400'}>
                      {manualKPIs.sent > 0 ? ((manualKPIs.replies/manualKPIs.sent)*100).toFixed(1) : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Meeting Rate:</span>
                    <span className={manualKPIs.sent > 0 && (manualKPIs.meetings/manualKPIs.sent)*100 > 2 ? 'text-green-400' : 'text-yellow-400'}>
                      {manualKPIs.sent > 0 ? ((manualKPIs.meetings/manualKPIs.sent)*100).toFixed(1) : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Bounce Rate:</span>
                    <span className={manualKPIs.sent > 0 && (manualKPIs.bounces/manualKPIs.sent)*100 < 5 ? 'text-green-400' : 'text-red-400'}>
                      {manualKPIs.sent > 0 ? ((manualKPIs.bounces/manualKPIs.sent)*100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-700 p-4 rounded-lg mt-6">
                <h3 className="font-semibold mb-4">Template Performance Analysis</h3>
                <div className="space-y-3">
                  {Object.entries(templatePerformance).length > 0 ? (
                    Object.entries(templatePerformance).map(([templateKey, stats]) => {
                      const replyRate = stats.sent > 0 ? ((stats.replies / stats.sent) * 100).toFixed(1) : 0;
                      const meetingRate = stats.sent > 0 ? ((stats.meetings / stats.sent) * 100).toFixed(1) : 0;
                      
                      return (
                        <div key={templateKey} className="bg-gray-600 p-3 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{DEFAULT_TEMPLATES[templateKey]?.name || templateKey}</h4>
                            <span className={`px-2 py-1 rounded text-xs ${
                              replyRate > 15 ? 'bg-green-600' : replyRate > 10 ? 'bg-yellow-600' : 'bg-red-600'
                            }`}>
                              {replyRate}% reply rate
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-400">Sent:</span>
                              <span className="ml-2 font-medium">{stats.sent}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Replies:</span>
                              <span className="ml-2 font-medium text-green-400">{stats.replies}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Meetings:</span>
                              <span className="ml-2 font-medium text-purple-400">{stats.meetings}</span>
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-gray-400">
                            Meeting Rate: {meetingRate}% | 
                            Best for: {replyRate > 15 ? 'Scale this template' : replyRate > 10 ? 'Keep testing' : 'Consider revision'}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-gray-400 text-sm">Send some emails to see template performance data</p>
                  )}
                </div>
              </div>

              <div className="bg-gray-700 p-4 rounded-lg mt-6">
                <h3 className="font-semibold mb-2">Manual-First Philosophy</h3>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>✅ Every metric tracked by you, not automation</li>
                  <li>✅ Adjust manually based on real replies</li>
                  <li>✅ No black box algorithms</li>
                  <li>✅ Full transparency in all numbers</li>
                  <li>✅ Works perfectly when AI is down</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
