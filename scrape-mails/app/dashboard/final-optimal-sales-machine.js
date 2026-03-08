'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, where, updateDoc, doc, getDoc, setDoc, serverTimestamp, deleteDoc, writeBatch } from 'firebase/firestore';
import Papa from 'papaparse';

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
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Status definitions with colors and transitions
const CONTACT_STATUSES = {
  new: { label: 'New', color: 'bg-gray-100 text-gray-800', order: 1 },
  contacted: { label: 'Contacted', color: 'bg-blue-100 text-blue-800', order: 2 },
  replied: { label: 'Replied', color: 'bg-green-100 text-green-800', order: 3 },
  meeting_scheduled: { label: 'Meeting Scheduled', color: 'bg-yellow-100 text-yellow-800', order: 4 },
  meeting_completed: { label: 'Meeting Completed', color: 'bg-purple-100 text-purple-800', order: 5 },
  proposal_sent: { label: 'Proposal Sent', color: 'bg-indigo-100 text-indigo-800', order: 6 },
  negotiation: { label: 'Negotiation', color: 'bg-orange-100 text-orange-800', order: 7 },
  closed_won: { label: 'Closed Won', color: 'bg-green-500 text-white', order: 8 },
  closed_lost: { label: 'Closed Lost', color: 'bg-red-100 text-red-800', order: 9 },
  archived: { label: 'Archived', color: 'bg-gray-200 text-gray-600', order: 10 }
};

// Valid status transitions
const VALID_TRANSITIONS = {
  new: ['contacted', 'archived'],
  contacted: ['replied', 'archived'],
  replied: ['meeting_scheduled', 'archived'],
  meeting_scheduled: ['meeting_completed', 'archived'],
  meeting_completed: ['proposal_sent', 'archived'],
  proposal_sent: ['negotiation', 'closed_won', 'closed_lost', 'archived'],
  negotiation: ['closed_won', 'closed_lost', 'archived'],
  closed_won: ['archived'],
  closed_lost: ['archived'],
  archived: ['new'] // Allow reactivation
};

// Automation engine configuration
const AUTOMATION_CONFIG = {
  enabled: true,
  fallbackMode: 'manual', // 'manual', 'semi-auto', 'full-auto'
  retryAttempts: 3,
  retryDelay: 5000, // 5 seconds
  batchProcessingSize: 50,
  automationInterval: 60000, // 1 minute
  emailRateLimit: 100, // per hour
  smsRateLimit: 50, // per hour
  callRateLimit: 25 // per hour
};

// Email templates with A/B testing variants
const EMAIL_TEMPLATES = {
  initial: {
    subject: 'Introduction from {{your_name}} at {{your_company}}',
    body: `Hi {{contact_name}},

I hope this email finds you well. I came across your profile and was impressed by your work at {{company}}.

At {{your_company}}, we help businesses like yours {{value_proposition}}. I'd love to schedule a brief 15-minute call to explore how we might be able to help you achieve {{specific_goal}}.

You can book a time directly on my calendar: {{calendar_link}}

Looking forward to connecting!

Best regards,
{{your_name}}
{{your_title}}
{{your_company}}
{{your_phone}}
{{portfolio_link}}`
  },
  followup: {
    subject: 'Following up - {{your_company}} + {{company}}',
    body: `Hi {{contact_name}},

Just wanted to follow up on my previous email. I believe there's a great opportunity for us to work together.

{{personalized_insight}}

Would you be available for a quick chat next week?

Best regards,
{{your_name}}
{{your_company}}`
  },
  meeting: {
    subject: 'Meeting Confirmation - {{your_company}} + {{company}}',
    body: `Hi {{contact_name}},

Great speaking with you today! As discussed, I'm confirming our meeting for {{meeting_time}}.

{{meeting_agenda}}

Looking forward to our conversation!

Best regards,
{{your_name}}
{{your_company}}`
  }
};

export default function FinalOptimalSalesMachine() {
  const [user, setUser] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedContact, setSelectedContact] = useState(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState('initial');
  const [customEmail, setCustomEmail] = useState({ subject: '', body: '' });
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [callNotes, setCallNotes] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [analytics, setAnalytics] = useState({});
  const [googleToken, setGoogleToken] = useState(null);
  const [callStatus, setCallStatus] = useState({});
  const [aiResearch, setAiResearch] = useState({});
  const [followUpSuggestions, setFollowUpSuggestions] = useState({});
  
  // Automation state
  const [automationEnabled, setAutomationEnabled] = useState(AUTOMATION_CONFIG.enabled);
  const [automationMode, setAutomationMode] = useState(AUTOMATION_CONFIG.fallbackMode);
  const [automationRules, setAutomationRules] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [automationLogs, setAutomationLogs] = useState([]);
  const [automationStats, setAutomationStats] = useState({});
  const [emailSequences, setEmailSequences] = useState([]);
  const [abTestResults, setAbTestResults] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [rateLimits, setRateLimits] = useState({ email: 0, sms: 0, calls: 0 });
  
  // Refs for automation engine
  const automationIntervalRef = useRef(null);
  const processingQueueRef = useRef([]);
  const failedTasksRef = useRef([]);

  // Check authentication state
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      if (user) {
        loadContacts();
        loadAnalytics();
      }
    });
    return () => unsubscribe();
  }, []);

  // Load contacts from Firestore
  const loadContacts = async () => {
    setLoading(true);
    try {
      const contactsRef = collection(db, 'contacts');
      const q = query(contactsRef, orderBy('created_at', 'desc'));
      const querySnapshot = await getDocs(q);
      const contactsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setContacts(contactsData);
      setFilteredContacts(contactsData);
    } catch (err) {
      setError('Failed to load contacts');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Load analytics
  const loadAnalytics = async () => {
    try {
      const contactsRef = collection(db, 'contacts');
      const querySnapshot = await getDocs(contactsRef);
      const contactsData = querySnapshot.docs.map(doc => doc.data());
      
      const statusCounts = {};
      Object.keys(CONTACT_STATUSES).forEach(status => {
        statusCounts[status] = contactsData.filter(c => c.status === status).length;
      });

      const totalContacts = contactsData.length;
      const activeContacts = contactsData.filter(c => !['archived', 'closed_lost', 'closed_won'].includes(c.status)).length;
      const conversionRate = totalContacts > 0 ? (statusCounts.closed_won / totalContacts * 100).toFixed(1) : 0;

      setAnalytics({
        totalContacts,
        activeContacts,
        statusCounts,
        conversionRate,
        avgResponseTime: '2.3 days', // Placeholder - would calculate from actual data
        topSource: 'LinkedIn' // Placeholder - would analyze from actual data
      });
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  };

  // Initialize automation engine
  useEffect(() => {
    if (user && automationEnabled) {
      initializeAutomation();
      loadAutomationRules();
      loadCampaigns();
      loadEmailSequences();
      startAutomationEngine();
    }
    
    return () => {
      if (automationIntervalRef.current) {
        clearInterval(automationIntervalRef.current);
      }
    };
  }, [user, automationEnabled]);

  // Automation Engine Core Functions
  const initializeAutomation = async () => {
    try {
      // Initialize default automation rules if none exist
      const rulesRef = collection(db, 'automation_rules');
      const rulesSnapshot = await getDocs(rulesRef);
      
      if (rulesSnapshot.empty) {
        const defaultRules = [
          {
            name: 'New Contact Welcome',
            trigger: 'status_change',
            condition: { status: 'new' },
            action: 'send_email',
            template: 'initial',
            delay: 0,
            enabled: true,
            priority: 1
          },
          {
            name: 'Follow-up After 3 Days',
            trigger: 'time_based',
            condition: { status: 'contacted', days_since_contact: 3 },
            action: 'send_email',
            template: 'followup',
            delay: 3,
            enabled: true,
            priority: 2
          },
          {
            name: 'Lead Score Update',
            trigger: 'data_change',
            condition: { field: 'lead_score' },
            action: 'update_score',
            delay: 0,
            enabled: true,
            priority: 3
          }
        ];

        for (const rule of defaultRules) {
          await addDoc(rulesRef, {
            ...rule,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp()
          });
        }
      }
    } catch (err) {
      console.error('Failed to initialize automation:', err);
      addNotification('error', 'Failed to initialize automation engine');
    }
  };

  // Enhanced Error Recovery System
  const handleCriticalFailure = async (error) => {
    // Log critical error
    console.error('Critical automation failure:', error);
    
    // Switch to manual mode automatically
    setAutomationEnabled(false);
    setAutomationMode('manual');
    
    // Create emergency notification
    addNotification('error', `Critical failure detected: ${error.message}. System switched to manual mode for safety.`);
    
    // Log to emergency backup
    try {
      const emergencyLog = {
        timestamp: serverTimestamp(),
        error: error.message,
        stack: error.stack,
        systemState: {
          automationEnabled: false,
          automationMode: 'manual',
          failedTasks: failedTasksRef.current.length,
          rateLimits
        }
      };
      
      await addDoc(collection(db, 'emergency_logs'), emergencyLog);
    } catch (logErr) {
      console.error('Failed to log emergency:', logErr);
    }
  };

  const validateSystemHealth = async () => {
    const healthChecks = [
      {
        name: 'firebase',
        check: async () => {
          try {
            await getDocs(query(collection(db, 'contacts'), limit(1)));
            return true;
          } catch {
            return false;
          }
        }
      },
      {
        name: 'googleToken',
        check: () => !!googleToken
      },
      {
        name: 'rateLimits',
        check: () => rateLimits.email < AUTOMATION_CONFIG.emailRateLimit * 0.9
      },
      {
        name: 'failedTasks',
        check: () => failedTasksRef.current.length < 100
      }
    ];

    const results = await Promise.all(
      healthChecks.map(async hc => ({
        name: hc.name,
        status: await hc.check()
      }))
    );

    // Update system health state
    const healthState = {};
    results.forEach(result => {
      healthState[result.name] = result.status;
    });
    healthState.lastCheck = new Date();
    
    setSystemHealth(healthState);

    const failedChecks = results.filter(r => !r.status);
    
    if (failedChecks.length > 0) {
      await handleCriticalFailure(new Error(`Health checks failed: ${failedChecks.map(c => c.name).join(', ')}`));
    }

    return results;
  };

  // Enhanced Automation Engine with Health Monitoring
  const startAutomationEngine = () => {
    if (automationIntervalRef.current) {
      clearInterval(automationIntervalRef.current);
    }

    automationIntervalRef.current = setInterval(async () => {
      if (automationEnabled && automationMode !== 'manual') {
        try {
          // Pre-execution health check
          const health = await validateSystemHealth();
          const criticalFailures = health.filter(h => !h.status);
          
          if (criticalFailures.length === 0) {
            await processAutomationQueue();
            await processEmailSequences();
            await retryFailedTasks();
            await updateRateLimits();
            await loadAnalytics();
          }
        } catch (err) {
          await handleCriticalFailure(err);
        }
      }
    }, AUTOMATION_CONFIG.automationInterval);

    // Additional health monitoring every 5 minutes
    setInterval(async () => {
      if (automationEnabled) {
        await validateSystemHealth();
      }
    }, 5 * 60 * 1000);
  };

  const processAutomationQueue = async () => {
    try {
      const contactsRef = collection(db, 'contacts');
      const q = query(
        contactsRef,
        where('status', 'in', ['new', 'contacted', 'replied']),
        limit(AUTOMATION_CONFIG.batchProcessingSize)
      );
      const querySnapshot = await getDocs(q);
      
      for (const contactDoc of querySnapshot.docs) {
        const contact = { id: contactDoc.id, ...contactDoc.data() };
        await evaluateAutomationRules(contact);
      }
    } catch (err) {
      console.error('Error processing automation queue:', err);
      addNotification('error', 'Automation queue processing failed');
    }
  };

  const evaluateAutomationRules = async (contact) => {
    const applicableRules = automationRules.filter(rule => 
      rule.enabled && shouldTriggerRule(rule, contact)
    ).sort((a, b) => a.priority - b.priority);

    for (const rule of applicableRules) {
      try {
        await executeAutomationAction(rule, contact);
        logAutomationActivity(rule, contact, 'success');
      } catch (err) {
        console.error(`Failed to execute rule ${rule.name}:`, err);
        logAutomationActivity(rule, contact, 'failed', err.message);
        
        if (automationMode === 'semi-auto') {
          addToFailedTasks(rule, contact, err);
        }
      }
    }
  };

  const shouldTriggerRule = (rule, contact) => {
    switch (rule.trigger) {
      case 'status_change':
        return contact.status === rule.condition.status;
      case 'time_based':
        const daysSince = getDaysSinceContact(contact);
        return contact.status === rule.condition.status && 
               daysSince >= rule.condition.days_since_contact;
      case 'data_change':
        return contact[rule.condition.field] !== undefined;
      case 'lead_score_threshold':
        return contact.leadScore >= rule.condition.min_score;
      default:
        return false;
    }
  };

  const executeAutomationAction = async (rule, contact) => {
    // Update execution counters
    const ruleRef = doc(db, 'automation_rules', rule.id);
    await updateDoc(ruleRef, {
      executionCount: (rule.executionCount || 0) + 1,
      lastExecuted: serverTimestamp()
    });

    switch (rule.action) {
      case 'send_email':
        if (rateLimits.email >= AUTOMATION_CONFIG.emailRateLimit) {
          throw new Error('Email rate limit exceeded');
        }
        await sendAutomatedEmail(contact, rule.template);
        await updateDoc(ruleRef, {
          successCount: (rule.successCount || 0) + 1
        });
        break;
      case 'send_sms':
        if (rateLimits.sms >= AUTOMATION_CONFIG.smsRateLimit) {
          throw new Error('SMS rate limit exceeded');
        }
        await sendAutomatedSMS(contact, rule.message);
        await updateDoc(ruleRef, {
          successCount: (rule.successCount || 0) + 1
        });
        break;
      case 'update_score':
        await updateContactScore(contact.id);
        await updateDoc(ruleRef, {
          successCount: (rule.successCount || 0) + 1
        });
        break;
      case 'assign_campaign':
        await assignToCampaign(contact.id, rule.campaignId);
        await updateDoc(ruleRef, {
          successCount: (rule.successCount || 0) + 1
        });
        break;
      case 'update_status':
        await updateContactStatus(contact.id, rule.newStatus, rule.note);
        await updateDoc(ruleRef, {
          successCount: (rule.successCount || 0) + 1
        });
        break;
      default:
        throw new Error(`Unknown action: ${rule.action}`);
    }
  };

  const sendAutomatedEmail = async (contact, templateName) => {
    const template = EMAIL_TEMPLATES[templateName];
    if (!template) {
      throw new Error(`Email template ${templateName} not found`);
    }

    const personalizedBody = personalizeEmail(template.body, contact);
    const personalizedSubject = personalizeEmail(template.subject, contact);

    // Check if we should use A/B testing
    const abTestVariant = getABTestVariant(templateName, contact.id);
    
    try {
      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          raw: btoa(
            `To: ${contact.email}\n` +
            `Subject: ${personalizedSubject}\n\n` +
            personalizedBody
          ).replace(/\+/g, '-')
        })
      });

      if (response.ok) {
        setRateLimits(prev => ({ ...prev, email: prev.email + 1 }));
        await trackABTestResult(templateName, abTestVariant, 'sent', contact.id);
        await updateContactStatus(contact.id, 'contacted', `Automated email sent using ${templateName} template`);
      } else {
        throw new Error('Failed to send automated email');
      }
    } catch (err) {
      await trackABTestResult(templateName, abTestVariant, 'failed', contact.id);
      throw err;
    }
  };

  const sendAutomatedSMS = async (contact, message) => {
    const personalizedMessage = personalizeEmail(message || 
      `Hi ${contact.name}, following up on our previous conversation.`, contact);

    const response = await fetch('/api/twilio/sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: contact.phone,
        message: personalizedMessage,
        contactId: contact.id,
        automated: true
      })
    });

    if (response.ok) {
      setRateLimits(prev => ({ ...prev, sms: prev.sms + 1 }));
      await updateContactStatus(contact.id, 'contacted', 'Automated SMS sent');
    } else {
      throw new Error('Failed to send automated SMS');
    }
  };

  const updateContactScore = async (contactId) => {
    const contactRef = doc(db, 'contacts', contactId);
    const contactDoc = await getDoc(contactRef);
    const contact = contactDoc.data();
    
    const newScore = calculateDynamicLeadScore(contact);
    
    if (newScore !== contact.leadScore) {
      await updateDoc(contactRef, {
        leadScore: newScore,
        score_updated_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
      
      addNotification('info', `Lead score updated for ${contact.name}: ${newScore}`);
    }
  };

  const calculateDynamicLeadScore = (contact) => {
    let score = 0;
    
    // Base scoring
    if (contact.email) {
      const domain = contact.email.split('@')[1];
      if (domain && !domain.includes('gmail') && !domain.includes('yahoo')) {
        score += 25;
      }
    }
    
    if (contact.phone) score += 20;
    if (contact.linkedin) score += 20;
    if (contact.company) score += 25;
    if (contact.position) score += 15;
    
    // Engagement scoring
    if (contact.status === 'replied') score += 30;
    if (contact.status === 'meeting_scheduled') score += 40;
    if (contact.status === 'meeting_completed') score += 50;
    
    // Recent activity bonus
    const daysSinceLastActivity = getDaysSinceContact(contact);
    if (daysSinceLastActivity < 7) score += 15;
    
    // Industry and role scoring
    if (contact.position) {
      const seniorKeywords = ['manager', 'director', 'vp', 'vice president', 'ceo', 'cto', 'founder', 'owner'];
      if (seniorKeywords.some(keyword => contact.position.toLowerCase().includes(keyword))) {
        score += 25;
      }
    }
    
    return Math.min(score, 100);
  };

  const getDaysSinceContact = (contact) => {
    const lastContact = contact.updated_at?.toDate() || contact.created_at?.toDate() || new Date();
    const now = new Date();
    const diffTime = Math.abs(now - lastContact);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Fallback Mechanisms
  const retryFailedTasks = async () => {
    if (failedTasksRef.current.length === 0) return;
    
    const tasksToRetry = failedTasksRef.current.splice(0, 10); // Process in batches
    const stillFailed = [];
    
    for (const task of tasksToRetry) {
      try {
        await executeAutomationAction(task.rule, task.contact);
        logAutomationActivity(task.rule, task.contact, 'retry_success');
      } catch (err) {
        task.retryCount = (task.retryCount || 0) + 1;
        if (task.retryCount < AUTOMATION_CONFIG.retryAttempts) {
          stillFailed.push(task);
        } else {
          logAutomationActivity(task.rule, task.contact, 'retry_failed', err.message);
          addNotification('error', `Task failed permanently: ${task.rule.name}`);
        }
      }
    }
    
    failedTasksRef.current = [...stillFailed, ...failedTasksRef.current];
  };

  const addToFailedTasks = (rule, contact, error) => {
    failedTasksRef.current.push({
      rule,
      contact,
      error: error.message,
      retryCount: 0,
      timestamp: new Date()
    });
  };

  const handleAutomationFailure = (rule, contact, error) => {
    switch (automationMode) {
      case 'manual':
        addNotification('warning', `Manual intervention required: ${rule.name} failed for ${contact.name}`);
        break;
      case 'semi-auto':
        addToFailedTasks(rule, contact, error);
        addNotification('warning', `Task queued for retry: ${rule.name}`);
        break;
      case 'full-auto':
        // Continue with next task, log for review
        logAutomationActivity(rule, contact, 'failed', error.message);
        break;
    }
  };

  // A/B Testing System
  const getABTestVariant = (templateName, contactId) => {
    const hash = contactId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    return Math.abs(hash) % 2 === 0 ? 'A' : 'B';
  };

  const trackABTestResult = async (templateName, variant, result, contactId) => {
    try {
      const testResult = {
        templateName,
        variant,
        result,
        contactId,
        timestamp: serverTimestamp()
      };
      
      await addDoc(collection(db, 'ab_test_results'), testResult);
      
      setAbTestResults(prev => ({
        ...prev,
        [templateName]: {
          ...prev[templateName],
          [variant]: {
            sent: (prev[templateName]?.[variant]?.sent || 0) + (result === 'sent' ? 1 : 0),
            failed: (prev[templateName]?.[variant]?.failed || 0) + (result === 'failed' ? 1 : 0)
          }
        }
      }));
    } catch (err) {
      console.error('Failed to track A/B test result:', err);
    }
  };

  // Campaign Management
  const assignToCampaign = async (contactId, campaignId) => {
    try {
      const campaignRef = doc(db, 'campaigns', campaignId);
      const campaignDoc = await getDoc(campaignRef);
      
      if (!campaignDoc.exists()) {
        throw new Error('Campaign not found');
      }
      
      const contactRef = doc(db, 'contacts', contactId);
      await updateDoc(contactRef, {
        campaignId,
        campaign_assigned_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
      
      addNotification('success', `Contact assigned to campaign: ${campaignDoc.data().name}`);
    } catch (err) {
      console.error('Failed to assign to campaign:', err);
      throw err;
    }
  };

  // Email Sequences
  const processEmailSequences = async () => {
    const contactsInSequences = contacts.filter(c => c.sequenceId && c.sequenceStep !== undefined);
    
    for (const contact of contactsInSequences) {
      const sequence = emailSequences.find(s => s.id === contact.sequenceId);
      if (!sequence) continue;
      
      const currentStep = sequence.steps[contact.sequenceStep];
      if (!currentStep) continue;
      
      const shouldSend = checkSequenceTiming(contact, currentStep);
      if (shouldSend) {
        try {
          await sendAutomatedEmail(contact, currentStep.template);
          await updateDoc(doc(db, 'contacts', contact.id), {
            sequenceStep: contact.sequenceStep + 1,
            last_sequence_sent: serverTimestamp(),
            updated_at: serverTimestamp()
          });
        } catch (err) {
          console.error('Failed to send sequence email:', err);
        }
      }
    }
  };

  const checkSequenceTiming = (contact, step) => {
    if (!contact.last_sequence_sent) return true;
    
    const lastSent = contact.last_sequence_sent.toDate();
    const now = new Date();
    const hoursSince = (now - lastSent) / (1000 * 60 * 60);
    
    return hoursSince >= step.delayHours;
  };

  // Utility Functions
  const calculateSuccessRate = (results) => {
    const totalSent = (results.A?.sent || 0) + (results.B?.sent || 0);
    const totalFailed = (results.A?.failed || 0) + (results.B?.failed || 0);
    const total = totalSent + totalFailed;
    return total > 0 ? Math.round((totalSent / total) * 100) : 0;
  };

  const addNotification = (type, message) => {
    const notification = {
      id: Date.now(),
      type,
      message,
      timestamp: new Date()
    };
    
    setNotifications(prev => [notification, ...prev].slice(0, 50)); // Keep last 50
  };

  const logAutomationActivity = async (rule, contact, status, error = null) => {
    const logEntry = {
      ruleName: rule.name,
      contactId: contact.id,
      contactName: contact.name,
      status,
      error,
      timestamp: serverTimestamp()
    };
    
    setAutomationLogs(prev => [logEntry, ...prev].slice(0, 100)); // Keep last 100
    
    try {
      await addDoc(collection(db, 'automation_logs'), logEntry);
    } catch (err) {
      console.error('Failed to log automation activity:', err);
    }
  };

  const updateRateLimits = async () => {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    // Reset counters if it's been more than an hour
    setRateLimits(prev => {
      const shouldReset = prev.lastReset && (now - prev.lastReset) > 60 * 60 * 1000;
      return shouldReset ? { email: 0, sms: 0, calls: 0, lastReset: now } : prev;
    });
  };

  // Load automation data from Firestore
  const loadAutomationRules = async () => {
    try {
      const rulesRef = collection(db, 'automation_rules');
      const querySnapshot = await getDocs(rulesRef);
      const rules = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAutomationRules(rules);
    } catch (err) {
      console.error('Failed to load automation rules:', err);
    }
  };

  const loadCampaigns = async () => {
    try {
      const campaignsRef = collection(db, 'campaigns');
      const querySnapshot = await getDocs(campaignsRef);
      const campaigns = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCampaigns(campaigns);
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    }
  };

  const loadEmailSequences = async () => {
    try {
      const sequencesRef = collection(db, 'email_sequences');
      const querySnapshot = await getDocs(sequencesRef);
      const sequences = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEmailSequences(sequences);
    } catch (err) {
      console.error('Failed to load email sequences:', err);
    }
  };

  // Filter and sort contacts
  useEffect(() => {
    let filtered = contacts;

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(contact => contact.status === filterStatus);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(contact =>
        contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.company?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort contacts
    filtered.sort((a, b) => {
      let aValue = a[sortBy] || '';
      let bValue = b[sortBy] || '';
      
      if (sortBy === 'created_at') {
        aValue = aValue?.toDate?.() || aValue;
        bValue = bValue?.toDate?.() || bValue;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredContacts(filtered);
  }, [contacts, filterStatus, searchTerm, sortBy, sortOrder]);

  // Handle CSV file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'text/csv') {
      setCsvFile(file);
      setError('');
    } else {
      setError('Please upload a valid CSV file');
    }
  };

  // Process CSV and save to Firestore
  const processCSV = () => {
    if (!csvFile) return;

    setLoading(true);
    setUploadProgress(0);

    Papa.parse(csvFile, {
      header: true,
      complete: async (results) => {
        try {
          const validContacts = [];
          const invalidContacts = [];

          for (let i = 0; i < results.data.length; i++) {
            const row = results.data[i];
            setUploadProgress(Math.round((i / results.data.length) * 100));

            // Validate required fields
            if (!row.email || !row.name) {
              invalidContacts.push({ row: i + 2, data: row, reason: 'Missing email or name' });
              continue;
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(row.email)) {
              invalidContacts.push({ row: i + 2, data: row, reason: 'Invalid email format' });
              continue;
            }

            // Validate phone if provided
            if (row.phone && !/^[\d\s\-\+\(\)]+$/.test(row.phone)) {
              invalidContacts.push({ row: i + 2, data: row, reason: 'Invalid phone format' });
              continue;
            }

            // Score lead quality
            const leadScore = calculateLeadScore(row);
            
            validContacts.push({
              name: row.name.trim(),
              email: row.email.trim().toLowerCase(),
              phone: row.phone?.trim() || '',
              company: row.company?.trim() || '',
              position: row.position?.trim() || '',
              linkedin: row.linkedin?.trim() || '',
              source: row.source?.trim() || 'CSV Upload',
              status: 'new',
              leadScore,
              created_at: serverTimestamp(),
              updated_at: serverTimestamp(),
              statusHistory: [{
                status: 'new',
                timestamp: serverTimestamp(),
                note: 'Contact imported from CSV'
              }]
            });
          }

          // Save valid contacts to Firestore
          for (const contact of validContacts) {
            await addDoc(collection(db, 'contacts'), contact);
          }

          await loadContacts();
          await loadAnalytics();
          
          setSuccess(`Successfully imported ${validContacts.length} contacts. ${invalidContacts.length} invalid entries were skipped.`);
          setCsvFile(null);
          setUploadProgress(0);
        } catch (err) {
          setError('Failed to process CSV: ' + err.message);
        } finally {
          setLoading(false);
        }
      },
      error: (err) => {
        setError('Failed to parse CSV: ' + err.message);
        setLoading(false);
      }
    });
  };

  // Calculate lead quality score
  const calculateLeadScore = (contact) => {
    let score = 0;
    
    // Email domain quality
    if (contact.email) {
      const domain = contact.email.split('@')[1];
      if (domain && !domain.includes('gmail') && !domain.includes('yahoo') && !domain.includes('hotmail')) {
        score += 20;
      }
    }
    
    // Has phone number
    if (contact.phone) score += 15;
    
    // Has LinkedIn
    if (contact.linkedin) score += 15;
    
    // Has company and position
    if (contact.company) score += 20;
    if (contact.position) score += 15;
    
    // Position keywords
    if (contact.position) {
      const seniorKeywords = ['manager', 'director', 'vp', 'vice president', 'ceo', 'cto', 'founder', 'owner'];
      if (seniorKeywords.some(keyword => contact.position.toLowerCase().includes(keyword))) {
        score += 15;
      }
    }
    
    return Math.min(score, 100);
  };

  // Handle Google Sign In
  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential.accessToken;
      setGoogleToken(token);
      setSuccess('Successfully signed in with Google');
    } catch (err) {
      setError('Failed to sign in with Google: ' + err.message);
    }
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setGoogleToken(null);
      setSuccess('Successfully signed out');
    } catch (err) {
      setError('Failed to sign out: ' + err.message);
    }
  };

  // Update contact status
  const updateContactStatus = async (contactId, newStatus, note = '') => {
    try {
      const contactRef = doc(db, 'contacts', contactId);
      const contactDoc = await getDoc(contactRef);
      const contactData = contactDoc.data();
      
      // Validate transition
      if (!VALID_TRANSITIONS[contactData.status].includes(newStatus)) {
        setError(`Invalid status transition from ${contactData.status} to ${newStatus}`);
        return;
      }

      const statusHistory = [...(contactData.statusHistory || [])];
      statusHistory.push({
        status: newStatus,
        timestamp: serverTimestamp(),
        note: note || `Status changed from ${contactData.status} to ${newStatus}`
      });

      await updateDoc(contactRef, {
        status: newStatus,
        updated_at: serverTimestamp(),
        statusHistory
      });

      await loadContacts();
      await loadAnalytics();
      setSuccess(`Status updated to ${CONTACT_STATUSES[newStatus].label}`);
      setStatusModalOpen(false);
      setNewStatus('');
      setStatusNote('');
    } catch (err) {
      setError('Failed to update status: ' + err.message);
    }
  };

  // Send email
  const sendEmail = async (contact, template, customEmail = null) => {
    try {
      if (!googleToken) {
        setError('Please sign in with Google to send emails');
        return;
      }

      const emailData = customEmail || EMAIL_TEMPLATES[template];
      const personalizedBody = personalizeEmail(emailData.body, contact);
      const personalizedSubject = personalizeEmail(emailData.subject, contact);

      // Send via Gmail API
      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          raw: btoa(
            `To: ${contact.email}\n` +
            `Subject: ${personalizedSubject}\n\n` +
            personalizedBody
          ).replace(/\+/g, '-')
        })
      });

      if (response.ok) {
        // Update contact status
        await updateContactStatus(contact.id, 'contacted', `Email sent using ${template} template`);
        setSuccess('Email sent successfully');
        setEmailModalOpen(false);
      } else {
        throw new Error('Failed to send email');
      }
    } catch (err) {
      setError('Failed to send email: ' + err.message);
    }
  };

  // Personalize email template
  const personalizeEmail = (template, contact) => {
    return template
      .replace(/\{\{contact_name\}\}/g, contact.name || 'there')
      .replace(/\{\{company\}\}/g, contact.company || 'your company')
      .replace(/\{\{your_name\}\}/g, user?.displayName || 'Your Name')
      .replace(/\{\{your_company\}\}/g, 'Your Company')
      .replace(/\{\{your_title\}\}/g, 'Your Title')
      .replace(/\{\{your_phone\}\}/g, 'Your Phone')
      .replace(/\{\{portfolio_link\}\}/g, 'https://yourportfolio.com')
      .replace(/\{\{calendar_link\}\}/g, 'https://calendly.com/yourname')
      .replace(/\{\{linkedin_link\}\}/g, 'https://linkedin.com/in/yourprofile')
      .replace(/\{\{value_proposition\}\}/g, 'achieve your business goals')
      .replace(/\{\{specific_goal\}\}/g, 'growth and success')
      .replace(/\{\{meeting_time\}\}/g, 'our scheduled meeting')
      .replace(/\{\{meeting_agenda\}\}/g, 'We will discuss your needs and how we can help')
      .replace(/\{\{personalized_insight\}\}/g, 'Based on my research, I think we can help you with your current challenges');
  };

  // Make phone call
  const makePhoneCall = async (contact) => {
    try {
      if (!contact.phone) {
        setError('Contact does not have a phone number');
        return;
      }

      // Initiate call via Twilio
      const response = await fetch('/api/twilio/call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: contact.phone,
          contactId: contact.id
        })
      });

      if (response.ok) {
        const data = await response.json();
        setCallStatus(prev => ({
          ...prev,
          [contact.id]: {
            callSid: data.callSid,
            status: 'initiated',
            timestamp: new Date()
          }
        }));
        
        // Start polling for call status
        pollCallStatus(contact.id, data.callSid);
        
        setSuccess('Call initiated successfully');
        setCallModalOpen(false);
        setCallNotes('');
      } else {
        throw new Error('Failed to initiate call');
      }
    } catch (err) {
      setError('Failed to make call: ' + err.message);
    }
  };

  // Poll call status
  const pollCallStatus = async (contactId, callSid) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/twilio/call-status/${callSid}`);
        if (response.ok) {
          const data = await response.json();
          setCallStatus(prev => ({
            ...prev,
            [contactId]: {
              ...prev[contactId],
              status: data.status,
              duration: data.duration
            }
          }));

          if (data.status === 'completed') {
            // Update contact status based on call outcome
            await updateContactStatus(contactId, 'contacted', `Call completed - ${callNotes || 'No notes'}`);
          } else if (['failed', 'busy', 'no-answer'].includes(data.status)) {
            // Keep current status but add note
            const contactRef = doc(db, 'contacts', contactId);
            const contactDoc = await getDoc(contactRef);
            const statusHistory = [...(contactDoc.data().statusHistory || [])];
            statusHistory.push({
              status: contactDoc.data().status,
              timestamp: serverTimestamp(),
              note: `Call ${data.status} - ${callNotes || 'No notes'}`
            });
            await updateDoc(contactRef, { statusHistory });
          } else {
            // Continue polling
            setTimeout(poll, 5000);
          }
        }
      } catch (err) {
        console.error('Error polling call status:', err);
      }
    };

    setTimeout(poll, 5000); // Start polling after 5 seconds
  };

  // Send SMS
  const sendSMS = async (contact) => {
    try {
      if (!contact.phone) {
        setError('Contact does not have a phone number');
        return;
      }

      const response = await fetch('/api/twilio/sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: contact.phone,
          message: smsMessage || `Hi ${contact.name}, this is ${user?.displayName || 'Your Name'} from Your Company. I'd love to connect and discuss how we can help you.`,
          contactId: contact.id
        })
      });

      if (response.ok) {
        await updateContactStatus(contact.id, 'contacted', 'SMS sent');
        setSuccess('SMS sent successfully');
        setSmsModalOpen(false);
        setSmsMessage('');
      } else {
        throw new Error('Failed to send SMS');
      }
    } catch (err) {
      setError('Failed to send SMS: ' + err.message);
    }
  };

  // Send WhatsApp message
  const sendWhatsApp = async (contact) => {
    try {
      if (!contact.phone) {
        setError('Contact does not have a phone number');
        return;
      }

      const response = await fetch('/api/twilio/whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: contact.phone,
          message: whatsappMessage || `Hi ${contact.name}, this is ${user?.displayName || 'Your Name'} from Your Company. I'd love to connect and discuss how we can help you.`,
          contactId: contact.id
        })
      });

      if (response.ok) {
        await updateContactStatus(contact.id, 'contacted', 'WhatsApp message sent');
        setSuccess('WhatsApp message sent successfully');
        setWhatsappModalOpen(false);
        setWhatsappMessage('');
      } else {
        throw new Error('Failed to send WhatsApp message');
      }
    } catch (err) {
      setError('Failed to send WhatsApp message: ' + err.message);
    }
  };

  // Perform AI research on contact
  const performAIResearch = async (contact) => {
    try {
      setLoading(true);
      
      // Simulate AI research - in production, this would call actual AI APIs
      const researchData = {
        companyInfo: {
          size: '50-200 employees',
          industry: 'Technology',
          revenue: '$10M-$50M',
          founded: '2015'
        },
        contactInsights: {
          role: 'Key decision maker',
          interests: ['AI', 'Cloud Computing', 'Digital Transformation'],
          recentActivity: 'Active on LinkedIn, recently posted about industry trends'
        },
        opportunities: [
          'Looking to expand operations',
          'Recently raised funding',
          'Hiring in relevant departments'
        ],
        challenges: [
          'Scaling customer support',
          'Data management issues',
          'Need for automation'
        ]
      };

      setAiResearch(prev => ({
        ...prev,
        [contact.id]: researchData
      }));

      // Generate follow-up suggestions
      const suggestions = [
        {
          type: 'email',
          template: 'followup',
          timing: '2-3 days',
          reason: 'Follow up on initial introduction'
        },
        {
          type: 'call',
          timing: '1 week',
          reason: 'Schedule discovery call to discuss specific needs'
        },
        {
          type: 'content',
          timing: '1 week',
          reason: 'Share case study relevant to their industry'
        }
      ];

      setFollowUpSuggestions(prev => ({
        ...prev,
        [contact.id]: suggestions
      }));

      setSuccess('AI research completed');
    } catch (err) {
      setError('Failed to perform AI research: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Archive old contacts
  const archiveOldContacts = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const contactsRef = collection(db, 'contacts');
      const q = query(
        contactsRef,
        where('status', 'in', ['contacted', 'replied']),
        where('updated_at', '<', thirtyDaysAgo)
      );
      const querySnapshot = await getDocs(q);

      for (const doc of querySnapshot.docs) {
        await updateDoc(doc.ref, {
          status: 'archived',
          updated_at: serverTimestamp(),
          statusHistory: [
            ...doc.data().statusHistory,
            {
              status: 'archived',
              timestamp: serverTimestamp(),
              note: 'Auto-archived after 30 days of inactivity'
            }
          ]
        });
      }

      await loadContacts();
      await loadAnalytics();
      setSuccess(`${querySnapshot.docs.length} contacts archived`);
    } catch (err) {
      setError('Failed to archive contacts: ' + err.message);
    }
  };

  // System Health State
  const [systemHealth, setSystemHealth] = useState({
    firebase: true,
    googleToken: false,
    rateLimits: true,
    failedTasks: true,
    lastCheck: new Date()
  });

  // State for modals
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    description: '',
    active: true,
    targetAudience: '',
    budget: '',
    startDate: '',
    endDate: ''
  });
  const [newRule, setNewRule] = useState({
    name: '',
    trigger: 'status_change',
    condition: { status: 'new' },
    action: 'send_email',
    template: 'initial',
    delay: 0,
    enabled: true,
    priority: 1
  });

  // Campaign Management Functions
  const createCampaign = async () => {
    try {
      const campaignData = {
        ...newCampaign,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        contactsCount: 0,
        sentEmails: 0,
        replies: 0,
        conversionRate: 0
      };

      await addDoc(collection(db, 'campaigns'), campaignData);
      await loadCampaigns();
      setCampaignModalOpen(false);
      setNewCampaign({
        name: '',
        description: '',
        active: true,
        targetAudience: '',
        budget: '',
        startDate: '',
        endDate: ''
      });
      addNotification('success', 'Campaign created successfully');
    } catch (err) {
      addNotification('error', 'Failed to create campaign');
    }
  };

  const updateCampaign = async (campaignId, updates) => {
    try {
      const campaignRef = doc(db, 'campaigns', campaignId);
      await updateDoc(campaignRef, {
        ...updates,
        updated_at: serverTimestamp()
      });
      await loadCampaigns();
      addNotification('success', 'Campaign updated successfully');
    } catch (err) {
      addNotification('error', 'Failed to update campaign');
    }
  };

  const deleteCampaign = async (campaignId) => {
    try {
      await deleteDoc(doc(db, 'campaigns', campaignId));
      await loadCampaigns();
      addNotification('success', 'Campaign deleted successfully');
    } catch (err) {
      addNotification('error', 'Failed to delete campaign');
    }
  };

  // Rule Management Functions
  const createRule = async () => {
    try {
      const ruleData = {
        ...newRule,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        executionCount: 0,
        successCount: 0,
        failureCount: 0
      };

      await addDoc(collection(db, 'automation_rules'), ruleData);
      await loadAutomationRules();
      setRuleModalOpen(false);
      setNewRule({
        name: '',
        trigger: 'status_change',
        condition: { status: 'new' },
        action: 'send_email',
        template: 'initial',
        delay: 0,
        enabled: true,
        priority: 1
      });
      addNotification('success', 'Automation rule created successfully');
    } catch (err) {
      addNotification('error', 'Failed to create automation rule');
    }
  };

  const updateRule = async (ruleId, updates) => {
    try {
      const ruleRef = doc(db, 'automation_rules', ruleId);
      await updateDoc(ruleRef, {
        ...updates,
        updated_at: serverTimestamp()
      });
      await loadAutomationRules();
      addNotification('success', 'Rule updated successfully');
    } catch (err) {
      addNotification('error', 'Failed to update rule');
    }
  };

  const deleteRule = async (ruleId) => {
    try {
      await deleteDoc(doc(db, 'automation_rules', ruleId));
      await loadAutomationRules();
      addNotification('success', 'Rule deleted successfully');
    } catch (err) {
      addNotification('error', 'Failed to delete rule');
    }
  };

  // Email Sequence Management
  const createEmailSequence = async (sequenceData) => {
    try {
      const sequence = {
        ...sequenceData,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        activeContacts: 0,
        completedContacts: 0
      };

      await addDoc(collection(db, 'email_sequences'), sequence);
      await loadEmailSequences();
      addNotification('success', 'Email sequence created successfully');
    } catch (err) {
      addNotification('error', 'Failed to create email sequence');
    }
  };

  // Advanced Analytics Functions
  const getDetailedAnalytics = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const logsRef = collection(db, 'automation_logs');
      const q = query(logsRef, where('timestamp', '>=', thirtyDaysAgo));
      const querySnapshot = await getDocs(q);
      const logs = querySnapshot.docs.map(doc => doc.data());

      const analytics = {
        totalExecutions: logs.length,
        successRate: (logs.filter(l => l.status === 'success').length / logs.length * 100).toFixed(1),
        errorRate: (logs.filter(l => l.status === 'failed').length / logs.length * 100).toFixed(1),
        topRules: Object.entries(
          logs.reduce((acc, log) => {
            acc[log.ruleName] = (acc[log.ruleName] || 0) + 1;
            return acc;
          }, {})
        ).sort(([,a], [,b]) => b - a).slice(0, 5),
        commonErrors: Object.entries(
          logs.filter(l => l.error).reduce((acc, log) => {
            acc[log.error] = (acc[log.error] || 0) + 1;
            return acc;
          }, {})
        ).sort(([,a], [,b]) => b - a).slice(0, 5),
        hourlyDistribution: logs.reduce((acc, log) => {
          const hour = new Date(log.timestamp.toDate()).getHours();
          acc[hour] = (acc[hour] || 0) + 1;
          return acc;
        }, {})
      };

      return analytics;
    } catch (err) {
      console.error('Failed to get detailed analytics:', err);
      return null;
    }
  };

  // Manual Override System
  const manualOverrideRule = async (ruleId, contactId, action) => {
    try {
      const rule = automationRules.find(r => r.id === ruleId);
      const contact = contacts.find(c => c.id === contactId);
      
      if (!rule || !contact) {
        throw new Error('Rule or contact not found');
      }

      switch (action) {
        case 'execute':
          await executeAutomationAction(rule, contact);
          addNotification('success', `Manually executed rule: ${rule.name}`);
          break;
        case 'skip':
          addNotification('info', `Skipped rule: ${rule.name} for ${contact.name}`);
          break;
        case 'disable':
          await updateDoc(doc(db, 'automation_rules', ruleId), {
            enabled: false,
            updated_at: serverTimestamp()
          });
          await loadAutomationRules();
          addNotification('warning', `Disabled rule: ${rule.name}`);
          break;
        default:
          throw new Error('Unknown override action');
      }
      
      logAutomationActivity(rule, contact, 'manual_override', `Action: ${action}`);
    } catch (err) {
      addNotification('error', `Manual override failed: ${err.message}`);
    }
  };

  const pauseAllAutomation = async () => {
    setAutomationEnabled(false);
    addNotification('warning', 'All automation paused');
  };

  const resumeAllAutomation = async () => {
    setAutomationEnabled(true);
    addNotification('success', 'All automation resumed');
  };

  // Data Export and Backup
  const exportContactsData = async () => {
    try {
      const dataStr = JSON.stringify(contacts, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `contacts_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      addNotification('success', 'Contacts data exported successfully');
    } catch (err) {
      addNotification('error', 'Failed to export contacts data');
    }
  };

  const exportAutomationLogs = async () => {
    try {
      const logsRef = collection(db, 'automation_logs');
      const querySnapshot = await getDocs(logsRef);
      const logs = querySnapshot.docs.map(doc => doc.data());
      
      const dataStr = JSON.stringify(logs, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `automation_logs_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      addNotification('success', 'Automation logs exported successfully');
    } catch (err) {
      addNotification('error', 'Failed to export automation logs');
    }
  };

  const createBackup = async () => {
    try {
      const backupData = {
        contacts,
        automationRules,
        campaigns,
        emailSequences,
        automationLogs: automationLogs.slice(0, 100), // Last 100 logs
        timestamp: new Date().toISOString(),
        version: '1.0'
      };
      
      const dataStr = JSON.stringify(backupData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `full_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      addNotification('success', 'Full backup created successfully');
    } catch (err) {
      addNotification('error', 'Failed to create backup');
    }
  };

  const restoreBackup = async (backupFile) => {
    try {
      const text = await backupFile.text();
      const backupData = JSON.parse(text);
      
      // Validate backup structure
      if (!backupData.contacts || !backupData.automationRules) {
        throw new Error('Invalid backup file structure');
      }
      
      // Restore contacts (this would need proper batch processing in production)
      for (const contact of backupData.contacts) {
        await addDoc(collection(db, 'contacts'), {
          ...contact,
          restored_at: serverTimestamp()
        });
      }
      
      // Restore automation rules
      for (const rule of backupData.automationRules) {
        await addDoc(collection(db, 'automation_rules'), {
          ...rule,
          restored_at: serverTimestamp()
        });
      }
      
      await loadContacts();
      await loadAutomationRules();
      
      addNotification('success', 'Backup restored successfully');
    } catch (err) {
      addNotification('error', `Failed to restore backup: ${err.message}`);
    }
  };

  // Advanced Analytics
  const generateAutomationReport = async () => {
    try {
      const report = {
        period: 'Last 30 days',
        totalAutomations: automationLogs.length,
        successRate: Math.round((automationLogs.filter(l => l.status === 'success').length / automationLogs.length) * 100),
        mostUsedRules: automationLogs.reduce((acc, log) => {
          acc[log.ruleName] = (acc[log.ruleName] || 0) + 1;
          return acc;
        }, {}),
        errorPatterns: automationLogs.filter(l => l.status === 'failed').reduce((acc, log) => {
          const error = log.error || 'Unknown error';
          acc[error] = (acc[error] || 0) + 1;
          return acc;
        }, {}),
        performanceMetrics: {
          avgExecutionTime: '2.3s', // Would calculate from actual data
          peakHours: '9-11 AM',
          bestDay: 'Tuesday'
        }
      };
      
      const dataStr = JSON.stringify(report, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `automation_report_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      addNotification('success', 'Automation report generated');
    } catch (err) {
      addNotification('error', 'Failed to generate report');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Sales Machine</h1>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={pauseAllAutomation}
                      className="px-3 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 rounded-md hover:bg-yellow-200"
                    >
                      Pause All
                    </button>
                    <button
                      onClick={resumeAllAutomation}
                      className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-md hover:bg-green-200"
                    >
                      Resume All
                    </button>
                    <div className="relative group">
                      <button className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
                        Export ▼
                      </button>
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                        <button
                          onClick={exportContactsData}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          Export Contacts
                        </button>
                        <button
                          onClick={exportAutomationLogs}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          Export Logs
                        </button>
                        <button
                          onClick={createBackup}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          Create Backup
                        </button>
                        <button
                          onClick={generateAutomationReport}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          Generate Report
                        </button>
                        <label className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">
                          Restore Backup
                          <input
                            type="file"
                            accept=".json"
                            onChange={(e) => e.target.files[0] && restoreBackup(e.target.files[0])}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                  <span className="text-sm text-gray-600">Welcome, {user.displayName}</span>
                  <button
                    onClick={handleSignOut}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <button
                  onClick={handleGoogleSignIn}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Sign In with Google
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* System Health Dashboard */}
        {user && (
          <div className="mb-8 bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-medium text-gray-900">System Health</h2>
              <button
                onClick={validateSystemHealth}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
              >
                Run Health Check
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className={`p-4 rounded-lg border ${
                systemHealth.firebase ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-3 ${
                    systemHealth.firebase ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <h4 className="text-sm font-medium text-gray-900">Database</h4>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  {systemHealth.firebase ? 'Connected' : 'Disconnected'}
                </p>
              </div>
              
              <div className={`p-4 rounded-lg border ${
                systemHealth.googleToken ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-3 ${
                    systemHealth.googleToken ? 'bg-green-500' : 'bg-yellow-500'
                  }`} />
                  <h4 className="text-sm font-medium text-gray-900">Google API</h4>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  {systemHealth.googleToken ? 'Authenticated' : 'Not Authenticated'}
                </p>
              </div>
              
              <div className={`p-4 rounded-lg border ${
                systemHealth.rateLimits ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'
              }`}>
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-3 ${
                    systemHealth.rateLimits ? 'bg-green-500' : 'bg-orange-500'
                  }`} />
                  <h4 className="text-sm font-medium text-gray-900">Rate Limits</h4>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  {systemHealth.rateLimits ? 'Normal' : 'Near Limit'}
                </p>
              </div>
              
              <div className={`p-4 rounded-lg border ${
                systemHealth.failedTasks ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-3 ${
                    systemHealth.failedTasks ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <h4 className="text-sm font-medium text-gray-900">Failed Tasks</h4>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  {systemHealth.failedTasks ? 'Low' : 'High'}
                </p>
              </div>
            </div>

            <div className="mt-4 text-xs text-gray-500">
              Last check: {systemHealth.lastCheck.toLocaleString()}
            </div>
          </div>
        )}

        {/* Automation Dashboard */}
        {user && (
          <div className="mb-8 bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-medium text-gray-900">Automation Control Center</h2>
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <label className="text-sm font-medium text-gray-700 mr-2">Automation:</label>
                  <button
                    onClick={() => setAutomationEnabled(!automationEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      automationEnabled ? 'bg-green-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        automationEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <select
                  value={automationMode}
                  onChange={(e) => setAutomationMode(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="manual">Manual</option>
                  <option value="semi-auto">Semi-Auto</option>
                  <option value="full-auto">Full Auto</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700">Rate Limits</h4>
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-gray-600">Email: {rateLimits.email}/{AUTOMATION_CONFIG.emailRateLimit}</p>
                  <p className="text-xs text-gray-600">SMS: {rateLimits.sms}/{AUTOMATION_CONFIG.smsRateLimit}</p>
                  <p className="text-xs text-gray-600">Calls: {rateLimits.calls}/{AUTOMATION_CONFIG.callRateLimit}</p>
                </div>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-blue-700">Active Rules</h4>
                <p className="mt-2 text-2xl font-bold text-blue-600">
                  {automationRules.filter(r => r.enabled).length}
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-green-700">Success Rate</h4>
                <p className="mt-2 text-2xl font-bold text-green-600">
                  {automationLogs.length > 0 ? 
                    Math.round((automationLogs.filter(l => l.status === 'success').length / automationLogs.length) * 100) : 0}%
                </p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-orange-700">Failed Tasks</h4>
                <p className="mt-2 text-2xl font-bold text-orange-600">
                  {failedTasksRef.current.length}
                </p>
              </div>
            </div>

            {/* Campaign Management */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-md font-medium text-gray-900">Campaigns</h3>
                <button
                  onClick={() => setCampaignModalOpen(true)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                >
                  Create Campaign
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {campaigns.map(campaign => (
                  <div key={campaign.id} className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900">{campaign.name}</h4>
                    <p className="text-sm text-gray-600 mt-1">{campaign.description}</p>
                    <div className="mt-3 flex justify-between items-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        campaign.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {campaign.active ? 'Active' : 'Inactive'}
                      </span>
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => updateCampaign(campaign.id, { active: !campaign.active })}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          {campaign.active ? 'Pause' : 'Activate'}
                        </button>
                        <button 
                          onClick={() => deleteCampaign(campaign.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Automation Rules */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-md font-medium text-gray-900">Automation Rules</h3>
                <button
                  onClick={() => setRuleModalOpen(true)}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                >
                  Add Rule
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rule</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Trigger</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {automationRules.map(rule => (
                      <tr key={rule.id}>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">{rule.name}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{rule.trigger}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{rule.action}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            rule.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {rule.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">{rule.priority}</td>
                        <td className="px-4 py-2 text-sm">
                          <button 
                            onClick={() => manualOverrideRule(rule.id, selectedContact?.id || '', 'execute')}
                            className="text-green-600 hover:text-green-800 mr-1"
                            title="Execute Now"
                          >
                            ▶
                          </button>
                          <button 
                            onClick={() => manualOverrideRule(rule.id, selectedContact?.id || '', 'skip')}
                            className="text-yellow-600 hover:text-yellow-800 mr-1"
                            title="Skip"
                          >
                            ⏭
                          </button>
                          <button 
                            onClick={() => manualOverrideRule(rule.id, '', 'disable')}
                            className="text-red-600 hover:text-red-800 mr-2"
                            title="Disable"
                          >
                            ⏸
                          </button>
                          <button 
                            onClick={() => updateRule(rule.id, { enabled: !rule.enabled })}
                            className="text-blue-600 hover:text-blue-800 mr-2"
                          >
                            {rule.enabled ? 'Disable' : 'Enable'}
                          </button>
                          <button 
                            onClick={() => deleteRule(rule.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* A/B Testing Results */}
            {Object.keys(abTestResults).length > 0 && (
              <div className="mb-6">
                <h3 className="text-md font-medium text-gray-900 mb-4">A/B Test Results</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(abTestResults).map(([template, results]) => (
                    <div key={template} className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3">{template}</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Variant A:</span>
                          <span className="text-sm font-medium">
                            {results.A?.sent || 0} sent, {results.A?.failed || 0} failed
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Variant B:</span>
                          <span className="text-sm font-medium">
                            {results.B?.sent || 0} sent, {results.B?.failed || 0} failed
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Success Rate:</span>
                          <span className="text-sm font-medium text-green-600">
                            {calculateSuccessRate(results)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Emergency Recovery Section */}
        {user && !automationEnabled && (
          <div className="mb-8 bg-red-50 border border-red-200 p-6 rounded-lg">
            <div className="flex items-center mb-4">
              <div className="w-4 h-4 bg-red-500 rounded-full mr-3 animate-pulse"></div>
              <h2 className="text-lg font-medium text-red-900">Automation System Offline</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg border">
                <h4 className="font-medium text-gray-900 mb-2">Manual Email</h4>
                <p className="text-sm text-gray-600 mb-3">Send emails manually when automation is down</p>
                <button
                  onClick={() => {
                    if (selectedContact) {
                      setEmailModalOpen(true);
                      addNotification('info', 'Opening manual email composer');
                    } else {
                      addNotification('warning', 'Please select a contact first');
                    }
                  }}
                  className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                >
                  Compose Email
                </button>
              </div>
              
              <div className="bg-white p-4 rounded-lg border">
                <h4 className="font-medium text-gray-900 mb-2">Manual SMS</h4>
                <p className="text-sm text-gray-600 mb-3">Send SMS messages manually</p>
                <button
                  onClick={() => {
                    if (selectedContact) {
                      setSmsModalOpen(true);
                      addNotification('info', 'Opening manual SMS composer');
                    } else {
                      addNotification('warning', 'Please select a contact first');
                    }
                  }}
                  className="w-full px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                >
                  Send SMS
                </button>
              </div>
              
              <div className="bg-white p-4 rounded-lg border">
                <h4 className="font-medium text-gray-900 mb-2">Status Update</h4>
                <p className="text-sm text-gray-600 mb-3">Manually update contact status</p>
                <button
                  onClick={() => {
                    if (selectedContact) {
                      setStatusModalOpen(true);
                      addNotification('info', 'Opening status update');
                    } else {
                      addNotification('warning', 'Please select a contact first');
                    }
                  }}
                  className="w-full px-3 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700"
                >
                  Update Status
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <div className="text-sm text-red-800">
                <p>⚠️ Automation has been disabled due to system issues</p>
                <p>All manual operations remain fully functional</p>
              </div>
              <button
                onClick={() => {
                  setAutomationEnabled(true);
                  setAutomationMode('manual');
                  addNotification('success', 'Automation re-enabled in manual mode');
                }}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
              >
                Re-enable Automation
              </button>
            </div>
          </div>
        )}

        {/* Notifications Panel */}
        {notifications.length > 0 && (
          <div className="mb-8 bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
              <button
                onClick={() => setNotifications([])}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear All
              </button>
            </div>
            <div className="space-y-2">
              {notifications.slice(0, 5).map(notification => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-md ${
                    notification.type === 'error' ? 'bg-red-50 border border-red-200' :
                    notification.type === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
                    notification.type === 'success' ? 'bg-green-50 border border-green-200' :
                    'bg-blue-50 border border-blue-200'
                  }`}
                >
                  <p className={`text-sm ${
                    notification.type === 'error' ? 'text-red-800' :
                    notification.type === 'warning' ? 'text-yellow-800' :
                    notification.type === 'success' ? 'text-green-800' :
                    'text-blue-800'
                  }`}>
                    {notification.message}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(notification.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analytics Dashboard */}
        {user && (
          <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">Total Contacts</h3>
              <p className="mt-2 text-3xl font-bold text-gray-900">{analytics.totalContacts || 0}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">Active Contacts</h3>
              <p className="mt-2 text-3xl font-bold text-blue-600">{analytics.activeContacts || 0}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">Conversion Rate</h3>
              <p className="mt-2 text-3xl font-bold text-green-600">{analytics.conversionRate || 0}%</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">Closed Won</h3>
              <p className="mt-2 text-3xl font-bold text-green-500">{analytics.statusCounts?.closed_won || 0}</p>
            </div>
          </div>
        )}

        {/* Status Breakdown */}
        {user && analytics.statusCounts && (
          <div className="mb-8 bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Status Breakdown</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(CONTACT_STATUSES).map(([status, info]) => (
                <div key={status} className="text-center">
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${info.color}`}>
                    {info.label}
                  </div>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {analytics.statusCounts[status] || 0}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Section */}
        {user && (
          <div className="mb-8 bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Import Contacts</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload CSV File
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              {csvFile && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">Selected: {csvFile.name}</p>
                  {uploadProgress > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                  <button
                    onClick={processCSV}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : 'Import Contacts'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Filters and Controls */}
        {user && (
          <div className="mb-6 bg-white p-4 rounded-lg shadow">
            <div className="flex flex-wrap gap-4 items-center">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="all">All Statuses</option>
                  {Object.entries(CONTACT_STATUSES).map(([status, info]) => (
                    <option key={status} value={status}>
                      {info.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-64">
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, email, or company..."
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="block px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="created_at">Created Date</option>
                  <option value="name">Name</option>
                  <option value="company">Company</option>
                  <option value="leadScore">Lead Score</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="block px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="desc">Newest First</option>
                  <option value="asc">Oldest First</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={archiveOldContacts}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
                >
                  Archive Old Contacts
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Contacts Table */}
        {user && (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lead Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredContacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {contact.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {contact.email}
                          </div>
                          {contact.phone && (
                            <div className="text-sm text-gray-500">
                              {contact.phone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {contact.company || '-'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {contact.position || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CONTACT_STATUSES[contact.status]?.color || 'bg-gray-100 text-gray-800'}`}>
                          {CONTACT_STATUSES[contact.status]?.label || contact.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="text-sm text-gray-900">
                            {contact.leadScore || 0}
                          </div>
                          <div className="ml-2 w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${contact.leadScore || 0}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              setSelectedContact(contact);
                              setStatusModalOpen(true);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Status
                          </button>
                          <button
                            onClick={() => {
                              setSelectedContact(contact);
                              setEmailModalOpen(true);
                            }}
                            className="text-green-600 hover:text-green-900"
                          >
                            Email
                          </button>
                          <button
                            onClick={() => {
                              setSelectedContact(contact);
                              setCallModalOpen(true);
                            }}
                            className="text-purple-600 hover:text-purple-900"
                          >
                            Call
                          </button>
                          <button
                            onClick={() => {
                              setSelectedContact(contact);
                              setSmsModalOpen(true);
                            }}
                            className="text-orange-600 hover:text-orange-900"
                          >
                            SMS
                          </button>
                          <button
                            onClick={() => {
                              setSelectedContact(contact);
                              performAIResearch(contact);
                            }}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            Research
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredContacts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No contacts found</p>
              </div>
            )}
          </div>
        )}

        {/* Status Modal */}
        {statusModalOpen && selectedContact && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Update Status - {selectedContact.name}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Select a status</option>
                    {VALID_TRANSITIONS[selectedContact.status]?.map(status => (
                      <option key={status} value={status}>
                        {CONTACT_STATUSES[status].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note (optional)
                  </label>
                  <textarea
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    rows={3}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Add a note about this status change..."
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setStatusModalOpen(false);
                      setNewStatus('');
                      setStatusNote('');
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => updateContactStatus(selectedContact.id, newStatus, statusNote)}
                    disabled={!newStatus}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    Update Status
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Email Modal */}
        {emailModalOpen && selectedContact && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Send Email - {selectedContact.name}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template
                  </label>
                  <select
                    value={emailTemplate}
                    onChange={(e) => setEmailTemplate(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="initial">Initial Introduction</option>
                    <option value="followup">Follow Up</option>
                    <option value="meeting">Meeting Confirmation</option>
                    <option value="custom">Custom Email</option>
                  </select>
                </div>
                {emailTemplate === 'custom' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Subject
                      </label>
                      <input
                        type="text"
                        value={customEmail.subject}
                        onChange={(e) => setCustomEmail(prev => ({ ...prev, subject: e.target.value }))}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Email subject..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Message
                      </label>
                      <textarea
                        value={customEmail.body}
                        onChange={(e) => setCustomEmail(prev => ({ ...prev, body: e.target.value }))}
                        rows={10}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Email message..."
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Preview
                    </label>
                    <div className="border border-gray-300 rounded-md p-4 bg-gray-50">
                      <p className="font-medium text-sm text-gray-700 mb-2">
                        Subject: {personalizeEmail(EMAIL_TEMPLATES[emailTemplate].subject, selectedContact)}
                      </p>
                      <div className="text-sm text-gray-600 whitespace-pre-wrap">
                        {personalizeEmail(EMAIL_TEMPLATES[emailTemplate].body, selectedContact)}
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setEmailModalOpen(false);
                      setEmailTemplate('initial');
                      setCustomEmail({ subject: '', body: '' });
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (emailTemplate === 'custom') {
                        sendEmail(selectedContact, null, customEmail);
                      } else {
                        sendEmail(selectedContact, emailTemplate);
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                  >
                    Send Email
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Call Modal */}
        {callModalOpen && selectedContact && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Make Call - {selectedContact.name}
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">
                    Phone: {selectedContact.phone}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Call Notes
                  </label>
                  <textarea
                    value={callNotes}
                    onChange={(e) => setCallNotes(e.target.value)}
                    rows={3}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Add notes about this call..."
                  />
                </div>
                {callStatus[selectedContact.id] && (
                  <div className="bg-blue-50 p-3 rounded-md">
                    <p className="text-sm text-blue-800">
                      Call Status: {callStatus[selectedContact.id].status}
                    </p>
                  </div>
                )}
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setCallModalOpen(false);
                      setCallNotes('');
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => makePhoneCall(selectedContact)}
                    className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700"
                  >
                    Make Call
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SMS Modal */}
        {smsModalOpen && selectedContact && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Send SMS - {selectedContact.name}
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">
                    Phone: {selectedContact.phone}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message
                  </label>
                  <textarea
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value)}
                    rows={4}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Type your SMS message..."
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setSmsModalOpen(false);
                      setSmsMessage('');
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => sendSMS(selectedContact)}
                    className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700"
                  >
                    Send SMS
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Research Results */}
        {selectedContact && aiResearch[selectedContact.id] && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                AI Research - {selectedContact.name}
              </h3>
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Company Information</h4>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="text-sm text-gray-600">
                      Size: {aiResearch[selectedContact.id].companyInfo.size}
                    </p>
                    <p className="text-sm text-gray-600">
                      Industry: {aiResearch[selectedContact.id].companyInfo.industry}
                    </p>
                    <p className="text-sm text-gray-600">
                      Revenue: {aiResearch[selectedContact.id].companyInfo.revenue}
                    </p>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Contact Insights</h4>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="text-sm text-gray-600">
                      Role: {aiResearch[selectedContact.id].contactInsights.role}
                    </p>
                    <p className="text-sm text-gray-600">
                      Interests: {aiResearch[selectedContact.id].contactInsights.interests.join(', ')}
                    </p>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Opportunities</h4>
                  <ul className="list-disc list-inside text-sm text-gray-600">
                    {aiResearch[selectedContact.id].opportunities.map((opp, index) => (
                      <li key={index}>{opp}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Follow-up Suggestions</h4>
                  <ul className="space-y-2">
                    {followUpSuggestions[selectedContact.id]?.map((suggestion, index) => (
                      <li key={index} className="bg-blue-50 p-3 rounded-md">
                        <p className="text-sm font-medium text-blue-900">
                          {suggestion.type.toUpperCase()} - {suggestion.timing}
                        </p>
                        <p className="text-sm text-blue-700">{suggestion.reason}</p>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setSelectedContact(null);
                      setAiResearch(prev => {
                        const newState = { ...prev };
                        delete newState[selectedContact.id];
                        return newState;
                      });
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Campaign Creation Modal */}
        {campaignModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Campaign</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
                  <input
                    type="text"
                    value={newCampaign.name}
                    onChange={(e) => setNewCampaign(prev => ({ ...prev, name: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Enter campaign name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={newCampaign.description}
                    onChange={(e) => setNewCampaign(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Describe your campaign"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
                  <input
                    type="text"
                    value={newCampaign.targetAudience}
                    onChange={(e) => setNewCampaign(prev => ({ ...prev, targetAudience: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., Tech companies, 50-200 employees"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Budget</label>
                    <input
                      type="text"
                      value={newCampaign.budget}
                      onChange={(e) => setNewCampaign(prev => ({ ...prev, budget: e.target.value }))}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="e.g., $5000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={newCampaign.startDate}
                      onChange={(e) => setNewCampaign(prev => ({ ...prev, startDate: e.target.value }))}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setCampaignModalOpen(false);
                      setNewCampaign({
                        name: '',
                        description: '',
                        active: true,
                        targetAudience: '',
                        budget: '',
                        startDate: '',
                        endDate: ''
                      });
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createCampaign}
                    disabled={!newCampaign.name}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    Create Campaign
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rule Creation Modal */}
        {ruleModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create Automation Rule</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
                  <input
                    type="text"
                    value={newRule.name}
                    onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Enter rule name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trigger</label>
                  <select
                    value={newRule.trigger}
                    onChange={(e) => setNewRule(prev => ({ ...prev, trigger: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="status_change">Status Change</option>
                    <option value="time_based">Time Based</option>
                    <option value="data_change">Data Change</option>
                    <option value="lead_score_threshold">Lead Score Threshold</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                  <select
                    value={newRule.action}
                    onChange={(e) => setNewRule(prev => ({ ...prev, action: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="send_email">Send Email</option>
                    <option value="send_sms">Send SMS</option>
                    <option value="update_score">Update Score</option>
                    <option value="assign_campaign">Assign Campaign</option>
                    <option value="update_status">Update Status</option>
                  </select>
                </div>
                {newRule.action === 'send_email' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Template</label>
                    <select
                      value={newRule.template}
                      onChange={(e) => setNewRule(prev => ({ ...prev, template: e.target.value }))}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="initial">Initial Introduction</option>
                      <option value="followup">Follow Up</option>
                      <option value="meeting">Meeting Confirmation</option>
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Delay (hours)</label>
                    <input
                      type="number"
                      value={newRule.delay}
                      onChange={(e) => setNewRule(prev => ({ ...prev, delay: parseInt(e.target.value) || 0 }))}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <input
                      type="number"
                      value={newRule.priority}
                      onChange={(e) => setNewRule(prev => ({ ...prev, priority: parseInt(e.target.value) || 1 }))}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                      min="1"
                      max="10"
                    />
                  </div>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newRule.enabled}
                    onChange={(e) => setNewRule(prev => ({ ...prev, enabled: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-900">Enable this rule</label>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setRuleModalOpen(false);
                      setNewRule({
                        name: '',
                        trigger: 'status_change',
                        condition: { status: 'new' },
                        action: 'send_email',
                        template: 'initial',
                        delay: 0,
                        enabled: true,
                        priority: 1
                      });
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createRule}
                    disabled={!newRule.name}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    Create Rule
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error and Success Messages */}
        {error && (
          <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 rounded-md p-4 max-w-sm">
            <p className="text-sm text-red-800">{error}</p>
            <button
              onClick={() => setError('')}
              className="mt-2 text-sm text-red-600 hover:text-red-800"
            >
              Dismiss
            </button>
          </div>
        )}

        {success && (
          <div className="fixed bottom-4 right-4 bg-green-50 border border-green-200 rounded-md p-4 max-w-sm">
            <p className="text-sm text-green-800">{success}</p>
            <button
              onClick={() => setSuccess('')}
              className="mt-2 text-sm text-green-600 hover:text-green-800"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Loading Overlay */}
        {loading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-sm text-gray-600">Loading...</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
