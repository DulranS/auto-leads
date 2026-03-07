'use client';

import { useState, useEffect, useCallback } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
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

// TIGHT ICP DEFINITION
const TIGHT_ICP = {
  industry: 'SaaS companies',
  size: '20-200 employees',
  funding: 'Series A-C ($2M-$50M raised)',
  geo: 'North America & Europe',
  pain: 'Scaling customer acquisition without burning cash',
  trigger: 'Recent funding round, product launch, or hiring growth'
};

// CONTACT STATUSES
const CONTACT_STATUSES = [
  { id: 'new', label: 'New', color: 'gray' },
  { id: 'researching', label: 'Researching', color: 'blue' },
  { id: 'personalized', label: 'Personalized', color: 'indigo' },
  { id: 'email1_sent', label: 'Email 1 Sent', color: 'purple' },
  { id: 'email2_sent', label: 'Email 2 Sent', color: 'orange' },
  { id: 'social_attempted', label: 'Social Attempted', color: 'yellow' },
  { id: 'breakup_sent', label: 'Breakup Sent', color: 'red' },
  { id: 'replied', label: 'Replied', color: 'green' },
  { id: 'booked', label: 'Meeting Booked', color: 'emerald' },
  { id: 'bounced', label: 'Bounced', color: 'rose' },
  { id: 'nurture', label: 'Nurture', color: 'gray' }
];

// CONTROLLED TEMPLATES (<120 words)
const EMAIL1_TEMPLATE = {
  subject: "Quick question about {{company_name}}'s growth",
  body: `Hi {{first_name}},

Noticed {{company_name}}'s recent {{trigger}} and wanted to reach out.

We help SaaS companies like yours scale customer acquisition efficiently without burning through cash.

{{personalization_observation}}
{{personalization_impact}}

Would you be open to a brief 10-minute chat next week?

{{booking_link}}

Best regards,
{{sender_name}}`
};

const EMAIL2_TEMPLATE = {
  subject: "Re: {{company_name}}'s growth",
  body: `Hi {{first_name}},

Following up on my previous note about {{company_name}}'s {{trigger}}.

{{social_proof}}

{{personalization_observation}}
{{personalization_impact}}

Still open to that 10-minute chat? Here's my calendar:

{{booking_link}}

Best regards,
{{sender_name}}`
};

const BREAKUP_TEMPLATE = {
  subject: "Closing the loop",
  body: `Hi {{first_name}},

I've been trying to reach you about {{company_name}}'s {{trigger}}.

Since I haven't heard back, I'll assume the timing isn't right.

If you change your mind about scaling customer acquisition efficiently, feel free to reach out.

{{booking_link}}

Best regards,
{{sender_name}}`
};

const SOCIAL_MESSAGE_TEMPLATE = `Hi {{first_name}}, noticed your work at {{company_name}}. {{personalization_observation}} Would love to connect!`;

export default function FinalOptimalSalesMachine() {
  // Auth state
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  // Core application state
  const [targets, setTargets] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [currentCampaign, setCurrentCampaign] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState('');
  
  // Campaign management
  const [sendSafety, setSendSafety] = useState({
    maxPerDay: 50,
    currentDaySent: 0,
    paused: false,
    lastSendDate: null
  });
  
  // KPI tracking
  const [kpis, setKpis] = useState({
    sent: 0,
    replies: 0,
    meetings: 0,
    bounces: 0,
    opens: 0,
    clicks: 0,
    replyRate: 0,
    meetingRate: 0,
    bounceRate: 0
  });
  
  // UI state
  const [activeTab, setActiveTab] = useState('icp');
  const [selectedTarget, setSelectedTarget] = useState(null);

  // Google sign in
  const signInWithGoogle = async () => {
    if (!auth) return;
    
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      setUser(result.user);
      
      // Initialize user data
      await initializeUserData(result.user.uid);
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
      setTargets([]);
      setCampaigns([]);
      setCurrentCampaign(null);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Initialize user data
  const initializeUserData = async (userId) => {
    if (!db || !userId) return;
    
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (!userDoc.exists()) {
        // Create new user document
        await setDoc(doc(db, 'users', userId), {
          uid: userId,
          email: auth.currentUser.email,
          displayName: auth.currentUser.displayName,
          createdAt: serverTimestamp(),
          settings: {
            maxEmailsPerDay: 50,
            bookingLink: '',
            timezone: 'UTC',
            senderName: auth.currentUser.displayName || 'Team'
          },
          icp: TIGHT_ICP
        });
      }
      
      // Load user's campaigns and targets
      await loadCampaigns(userId);
      await loadTargets(userId);
    } catch (error) {
      console.error('Failed to initialize user data:', error);
    }
  };

  // Load campaigns
  const loadCampaigns = async (userId) => {
    if (!db || !userId) return;
    
    try {
      const campaignsRef = collection(db, 'users', userId, 'campaigns');
      const snapshot = await getDocs(campaignsRef);
      
      const campaignsData = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        campaignsData.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || data.createdAt,
          lastActivity: data.lastActivity?.toDate?.() || data.lastActivity
        });
      });
      
      setCampaigns(campaignsData);
      
      // Set current campaign if exists
      if (campaignsData.length > 0) {
        setCurrentCampaign(campaignsData[0]);
      }
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    }
  };

  // Load targets
  const loadTargets = async (userId) => {
    if (!db || !userId) return;
    
    try {
      const targetsRef = collection(db, 'users', userId, 'targets');
      const snapshot = await getDocs(targetsRef);
      
      const targetsData = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        targetsData.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || data.createdAt,
          lastContacted: data.lastContacted?.toDate?.() || data.lastContacted
        });
      });
      
      setTargets(targetsData);
    } catch (error) {
      console.error('Failed to load targets:', error);
    }
  };

  // Create new campaign
  const createCampaign = async () => {
    if (!user?.uid || !db) return;
    
    try {
      const campaignData = {
        name: `Campaign ${campaigns.length + 1}`,
        status: 'active',
        icp: TIGHT_ICP,
        targets: [],
        templates: {
          email1: EMAIL1_TEMPLATE,
          email2: EMAIL2_TEMPLATE,
          breakup: BREAKUP_TEMPLATE,
          social: SOCIAL_MESSAGE_TEMPLATE
        },
        cadence: {
          day0: ['email1', 'social'],
          day3: ['email2'],
          day5: ['social'],
          day7: ['breakup']
        },
        createdAt: serverTimestamp(),
        lastActivity: serverTimestamp(),
        stats: {
          sent: 0,
          replies: 0,
          meetings: 0,
          bounces: 0
        }
      };
      
      const campaignRef = doc(collection(db, 'users', user.uid, 'campaigns'));
      await setDoc(campaignRef, campaignData);
      
      const newCampaign = { id: campaignRef.id, ...campaignData };
      setCampaigns(prev => [...prev, newCampaign]);
      setCurrentCampaign(newCampaign);
      
      setStatus('✅ New campaign created successfully!');
    } catch (error) {
      console.error('Failed to create campaign:', error);
      setStatus('❌ Failed to create campaign');
    }
  };

  // Handle CSV upload with real functionality
  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!currentCampaign) {
      setStatus('❌ Please create a campaign first');
      return;
    }
    
    setIsUploading(true);
    setStatus('📊 Processing target companies...');
    
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          setStatus('❌ CSV must contain headers and data');
          setIsUploading(false);
          return;
        }
        
        const headers = parseCsvRow(lines[0]);
        
        // Validate required columns
        const requiredColumns = ['company_name', 'email', 'website', 'industry', 'size', 'funding'];
        const missingColumns = requiredColumns.filter(col => !headers.includes(col));
        
        if (missingColumns.length > 0) {
          setStatus(`❌ Missing required columns: ${missingColumns.join(', ')}`);
          setIsUploading(false);
          return;
        }
        
        const processedTargets = [];
        const validationErrors = [];
        
        // Process each row
        for (let i = 1; i < lines.length && processedTargets.length < 50; i++) {
          const values = parseCsvRow(lines[i]);
          if (values.length !== headers.length) {
            validationErrors.push(`Row ${i + 1}: Column count mismatch`);
            continue;
          }
          
          const row = {};
          headers.forEach((header, idx) => {
            row[header] = values[idx] || '';
          });
          
          // Validate and process target
          const validationResult = await validateAndProcessTarget(row, headers);
          if (validationResult.valid) {
            processedTargets.push(validationResult.target);
          } else {
            validationErrors.push(`Row ${i + 1}: ${validationResult.error}`);
          }
        }
        
        // Show validation summary
        if (validationErrors.length > 0) {
          setStatus(`⚠️ Processed ${processedTargets.length} targets with ${validationErrors.length} errors. First few: ${validationErrors.slice(0, 3).join(', ')}`);
        }
        
        // Save targets to Firestore
        if (processedTargets.length > 0) {
          await saveTargets(processedTargets);
          setStatus(`✅ ${processedTargets.length} target companies loaded successfully! ${validationErrors.length > 0 ? `(${validationErrors.length} rows skipped)` : ''}`);
        } else {
          setStatus('❌ No valid targets found in CSV');
        }
      } catch (error) {
        console.error('CSV processing error:', error);
        setStatus(`❌ Failed to process CSV: ${error.message}`);
      } finally {
        setIsUploading(false);
      }
    };
    
    reader.readAsText(file);
  };

  // Validate and process individual target row
  const validateAndProcessTarget = async (row, headers) => {
    // Extract required fields
    const companyName = row.company_name || row.business_name || row.name;
    const email = row.email || '';
    const website = row.website || '';
    const industry = row.industry || '';
    const size = row.size || row.employees || '';
    const funding = row.funding || '';
    
    // Business validations
    if (!companyName || companyName.length < 2) {
      return { valid: false, error: 'Invalid company name' };
    }
    
    if (!industry) {
      return { valid: false, error: 'Industry required' };
    }
    
    if (!size) {
      return { valid: false, error: 'Company size required' };
    }
    
    // ICP validation
    if (!industry.toLowerCase().includes('saas') && !industry.toLowerCase().includes('software')) {
      return { valid: false, error: 'Not a SaaS company' };
    }
    
    // Size validation (20-200 employees)
    const sizeNum = parseInt(size.replace(/\D/g, ''));
    if (sizeNum < 20 || sizeNum > 200) {
      return { valid: false, error: 'Company size not in 20-200 range' };
    }
    
    // Email validation
    if (email && !isValidEmail(email)) {
      return { valid: false, error: 'Invalid email format' };
    }
    
    // Website validation
    if (website && !website.startsWith('http')) {
      return { valid: false, error: 'Invalid website URL' };
    }
    
    // Create target object
    const target = {
      companyName: companyName.trim(),
      email: email && isValidEmail(email) ? email.trim() : null,
      website: website ? website.trim() : '',
      industry: industry.trim(),
      size: size.trim(),
      funding: funding.trim(),
      description: row.description || '',
      
      // Decision makers
      decisionMakers: [],
      
      // Research data
      research: {
        headline: '',
        trigger: '',
        triggerLink: '',
        observation: '',
        impact: ''
      },
      
      // Personalization
      personalization: {
        observation: '',
        impact: ''
      },
      
      // Status and tracking
      status: 'new',
      campaignId: currentCampaign.id,
      sequenceDay: 0,
      lastContacted: null,
      nextContactDate: null,
      
      // Email verification with business rules
      emailVerification: email ? {
        format: isValidEmail(email),
        mx: true, // Would check MX records in real implementation
        risky: false,
        score: 0.8,
        domain: email.split('@')[1],
        verifiedAt: new Date()
      } : null,
      
      // ICP fit score
      icpFitScore: calculateICPFitScore(industry, size, funding),
      
      // Metadata
      source: 'csv_upload',
      uploadedAt: new Date(),
      createdAt: new Date(),
      lastUpdated: new Date()
    };
    
    return { valid: true, target };
  };

  // Calculate ICP fit score
  const calculateICPFitScore = (industry, size, funding) => {
    let score = 50; // Base score
    
    // Industry fit
    if (industry.toLowerCase().includes('saas') || industry.toLowerCase().includes('software')) {
      score += 30;
    }
    
    // Size fit (20-200 employees)
    const sizeNum = parseInt(size.replace(/\D/g, ''));
    if (sizeNum >= 20 && sizeNum <= 50) {
      score += 20; // Sweet spot
    } else if (sizeNum > 50 && sizeNum <= 200) {
      score += 10; // Good fit
    }
    
    // Funding fit
    if (funding.toLowerCase().includes('series a') || funding.toLowerCase().includes('seed')) {
      score += 10;
    } else if (funding.toLowerCase().includes('series b') || funding.toLowerCase().includes('series c')) {
      score += 15;
    }
    
    return Math.min(100, Math.max(0, score));
  };

  // Save targets to Firestore
  const saveTargets = async (targets) => {
    if (!user?.uid || !db || targets.length === 0) return;
    
    try {
      const targetsRef = collection(db, 'users', user.uid, 'targets');
      
      for (const target of targets) {
        const targetRef = doc(targetsRef);
        await setDoc(targetRef, {
          ...target,
          createdAt: serverTimestamp(),
          lastUpdated: serverTimestamp()
        });
      }
      
      // Update campaign with new targets
      if (currentCampaign) {
        await updateDoc(doc(db, 'users', user.uid, 'campaigns', currentCampaign.id), {
          targets: [...(currentCampaign.targets || []), ...targets.map(t => t.id)],
          lastActivity: serverTimestamp()
        });
      }
      
      // Reload targets
      await loadTargets(user.uid);
    } catch (error) {
      console.error('Failed to save targets:', error);
      throw error;
    }
  };

  // Start research for a target
  const startResearch = async (targetId) => {
    const target = targets.find(t => t.id === targetId);
    if (!target) return;
    
    setSelectedTarget(target);
    
    // Simulate 2-minute research
    setStatus(`🔍 Researching ${target.companyName}...`);
    
    // Simulate API calls to LinkedIn, Apollo.io, etc.
    setTimeout(() => {
      const updatedTarget = {
        ...target,
        research: {
          headline: `${target.companyName} raises ${target.funding || 'Series A'} funding`,
          trigger: target.funding ? 'Recent funding round' : 'Product launch',
          triggerLink: `https://example.com/${target.companyName.toLowerCase()}-news`,
          observation: `Noticed ${target.companyName} is growing rapidly with ${target.size} employees`,
          impact: 'Likely facing scaling challenges in customer acquisition'
        },
        decisionMakers: [
          {
            name: 'John Doe',
            role: 'CEO',
            linkedin: `https://linkedin.com/in/johndoe-${target.companyName.toLowerCase()}`,
            email: 'john@' + (target.website ? target.website.replace('https://', '').replace('http://', '') : 'example.com'),
            verified: true
          },
          {
            name: 'Jane Smith',
            role: 'CTO',
            linkedin: `https://linkedin.com/in/janesmith-${target.companyName.toLowerCase()}`,
            email: 'jane@' + (target.website ? target.website.replace('https://', '').replace('http://', '') : 'example.com'),
            verified: true
          }
        ],
        status: 'researching',
        lastUpdated: new Date()
      };
      
      updateTarget(updatedTarget);
      setStatus(`✅ Research completed for ${target.companyName}`);
    }, 2000);
  };

  // Update target
  const updateTarget = async (target) => {
    if (!user?.uid || !db) return;
    
    try {
      await updateDoc(doc(db, 'users', user.uid, 'targets', target.id), {
        ...target,
        lastUpdated: serverTimestamp()
      });
      
      setTargets(prev => prev.map(t => t.id === target.id ? target : t));
      setSelectedTarget(target);
    } catch (error) {
      console.error('Failed to update target:', error);
    }
  };

  // Create personalization
  const createPersonalization = async (targetId) => {
    const target = targets.find(t => t.id === targetId);
    if (!target || !target.research.trigger) return;
    
    const personalization = {
      observation: target.research.observation,
      impact: target.research.impact
    };
    
    const updatedTarget = {
      ...target,
      personalization,
      status: 'personalized',
      lastUpdated: new Date()
    };
    
    await updateTarget(updatedTarget);
    setStatus(`✅ Personalization created for ${target.companyName}`);
  };

  // Send email with safety rules
  const sendEmail = async (targetId, templateType) => {
    if (!user?.uid || !db) return;
    
    // Check send safety
    const today = new Date().toDateString();
    const todaySent = targets.filter(t => 
      t.lastContacted && 
      new Date(t.lastContacted).toDateString() === today &&
      t.status.includes('sent')
    ).length;
    
    if (todaySent >= sendSafety.maxPerDay) {
      setStatus('⚠️ Daily send limit reached. Emails will resume tomorrow.');
      return;
    }
    
    if (kpis.bounceRate > 0.05) {
      setStatus('⚠️ High bounce rate detected. Sending paused.');
      return;
    }
    
    const target = targets.find(t => t.id === targetId);
    if (!target || !target.email) {
      setStatus('❌ Target email not found or invalid');
      return;
    }
    
    // Verify email is not risky
    if (target.emailVerification?.risky) {
      setStatus('⚠️ Email flagged as risky. Skipping send.');
      return;
    }
    
    try {
      // Get template
      const template = currentCampaign?.templates[templateType];
      if (!template) {
        setStatus('❌ Template not found');
        return;
      }
      
      // Render email
      const renderedEmail = renderEmailTemplate(template, target);
      
      // Simulate sending email
      setStatus(`📧 Sending ${templateType} to ${target.companyName}...`);
      
      // Simulate email send delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update target status
      const newStatus = templateType === 'email1' ? 'email1_sent' : 
                       templateType === 'email2' ? 'email2_sent' : 'breakup_sent';
      
      const updatedTarget = {
        ...target,
        status: newStatus,
        lastContacted: new Date(),
        sequenceDay: target.sequenceDay + 1,
        lastUpdated: new Date(),
        emailHistory: [
          ...(target.emailHistory || []),
          {
            type: templateType,
            sentAt: new Date(),
            subject: renderedEmail.subject,
            body: renderedEmail.body,
            status: 'sent'
          }
        ]
      };
      
      await updateTarget(updatedTarget);
      
      // Update KPIs
      setKpis(prev => ({
        ...prev,
        sent: prev.sent + 1,
        replyRate: prev.sent > 0 ? ((prev.replies / (prev.sent + 1)) * 100) : 0,
        bounceRate: prev.sent > 0 ? ((prev.bounces / (prev.sent + 1)) * 100) : 0
      }));
      
      // Update send safety
      setSendSafety(prev => ({
        ...prev,
        currentDaySent: todaySent + 1,
        lastSendDate: new Date()
      }));
      
      setStatus(`✅ ${templateType} sent to ${target.companyName}`);
      
      // Schedule next contact
      scheduleNextContact(updatedTarget);
      
      // Auto-exit check
      if (newStatus === 'breakup_sent') {
        setTimeout(() => {
          moveToNurture(targetId);
        }, 7 * 24 * 60 * 60 * 1000); // 7 days after breakup
      }
      
    } catch (error) {
      console.error('Failed to send email:', error);
      setStatus(`❌ Failed to send email: ${error.message}`);
    }
  };

  // Render email template
  const renderEmailTemplate = (template, target) => {
    const senderName = user?.displayName || 'Team';
    const bookingLink = 'https://calendly.com/your-team/10min'; // Would get from user settings
    
    let rendered = template.body;
    
    // Replace variables
    rendered = rendered.replace(/\{\{company_name\}\}/g, target.companyName);
    rendered = rendered.replace(/\{\{first_name\}\}/g, target.decisionMakers[0]?.name || 'there');
    rendered = rendered.replace(/\{\{trigger\}\}/g, target.research.trigger || 'recent developments');
    rendered = rendered.replace(/\{\{personalization_observation\}\}/g, target.personalization.observation || '');
    rendered = rendered.replace(/\{\{personalization_impact\}\}/g, target.personalization.impact || '');
    rendered = rendered.replace(/\{\{social_proof\}\}/g, 'We\'ve helped 50+ SaaS companies scale their customer acquisition');
    rendered = rendered.replace(/\{\{booking_link\}\}/g, bookingLink);
    rendered = rendered.replace(/\{\{sender_name\}\}/g, senderName);
    
    return {
      subject: template.subject.replace(/\{\{company_name\}\}/g, target.companyName),
      body: rendered
    };
  };

  // Schedule next contact
  const scheduleNextContact = (target) => {
    const cadence = currentCampaign?.cadence;
    if (!cadence) return;
    
    const dayKey = `day${target.sequenceDay}`;
    const nextActions = cadence[dayKey];
    
    if (nextActions && nextActions.length > 0) {
      const nextDate = new Date();
      const daysToAdd = target.sequenceDay === 0 ? 0 : 
                       target.sequenceDay === 1 ? 3 : 
                       target.sequenceDay === 2 ? 5 : 7;
      
      nextDate.setDate(nextDate.getDate() + daysToAdd);
      
      updateTarget({
        ...target,
        nextContactDate: nextDate
      });
    }
  };

  // Send social media message
  const sendSocialMessage = async (targetId) => {
    const target = targets.find(t => t.id === targetId);
    if (!target) return;
    
    try {
      // Get social template
      const template = currentCampaign?.templates.social;
      if (!template) return;
      
      // Render social message
      const renderedMessage = renderSocialTemplate(template, target);
      
      setStatus(`📱 Sending social message to ${target.companyName}...`);
      
      // Simulate social media send
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update target status
      const updatedTarget = {
        ...target,
        status: 'social_attempted',
        lastContacted: new Date(),
        lastUpdated: new Date(),
        socialHistory: [
          ...(target.socialHistory || []),
          {
            type: 'social',
            sentAt: new Date(),
            message: renderedMessage,
            platform: 'LinkedIn',
            status: 'sent'
          }
        ]
      };
      
      await updateTarget(updatedTarget);
      setStatus(`✅ Social message sent to ${target.companyName}`);
      
    } catch (error) {
      console.error('Failed to send social message:', error);
      setStatus(`❌ Failed to send social message: ${error.message}`);
    }
  };

  // Render social media template
  const renderSocialTemplate = (template, target) => {
    let rendered = template;
    
    // Replace variables
    rendered = rendered.replace(/\{\{first_name\}\}/g, target.decisionMakers[0]?.name || 'there');
    rendered = rendered.replace(/\{\{company_name\}\}/g, target.companyName);
    rendered = rendered.replace(/\{\{personalization_observation\}\}/g, target.personalization.observation || '');
    
    return rendered;
  };

  // Handle reply
  const handleReply = async (targetId) => {
    const target = targets.find(t => t.id === targetId);
    if (!target) return;
    
    const updatedTarget = {
      ...target,
      status: 'replied',
      lastUpdated: new Date()
    };
    
    await updateTarget(updatedTarget);
    
    setKpis(prev => ({
      ...prev,
      replies: prev.replies + 1,
      replyRate: prev.sent > 0 ? ((prev.replies + 1) / prev.sent) * 100 : 0
    }));
    
    setStatus(`✅ Reply recorded for ${target.companyName}`);
  };

  // Handle meeting booked
  const handleMeetingBooked = async (targetId) => {
    const target = targets.find(t => t.id === targetId);
    if (!target) return;
    
    const updatedTarget = {
      ...target,
      status: 'booked',
      lastUpdated: new Date()
    };
    
    await updateTarget(updatedTarget);
    
    setKpis(prev => ({
      ...prev,
      meetings: prev.meetings + 1,
      meetingRate: prev.sent > 0 ? ((prev.meetings + 1) / prev.sent) * 100 : 0
    }));
    
    setStatus(`🎉 Meeting booked with ${target.companyName}!`);
  };

  // Handle bounce
  const handleBounce = async (targetId) => {
    const target = targets.find(t => t.id === targetId);
    if (!target) return;
    
    const updatedTarget = {
      ...target,
      status: 'bounced',
      lastUpdated: new Date()
    };
    
    await updateTarget(updatedTarget);
    
    setKpis(prev => ({
      ...prev,
      bounces: prev.bounces + 1,
      bounceRate: prev.sent > 0 ? ((prev.bounces + 1) / prev.sent) * 100 : 0
    }));
    
    // Pause sending if bounce rate > 5%
    if ((kpis.bounces + 1) / kpis.sent > 0.05) {
      setSendSafety(prev => ({ ...prev, paused: true }));
      setStatus('⚠️ High bounce rate detected. Sending paused.');
    }
    
    setStatus(`📧 Bounce recorded for ${target.companyName}`);
  };

  // Move to nurture
  const moveToNurture = async (targetId) => {
    const target = targets.find(t => t.id === targetId);
    if (!target) return;
    
    const updatedTarget = {
      ...target,
      status: 'nurture',
      nurtureDate: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)), // 30 days from now
      lastUpdated: new Date()
    };
    
    await updateTarget(updatedTarget);
    setStatus(`📅 ${target.companyName} moved to nurture sequence`);
  };

  // Utility functions
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

  const isValidEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

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
        initializeUserData(user.uid);
      }
    });
    
    return unsubscribe;
  }, []);

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
                {currentCampaign && (
                  <span className="ml-4 text-sm text-gray-400">
                    Campaign: {currentCampaign.name}
                  </span>
                )}
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
          {/* Status Messages */}
          {status && (
            <div className="mb-6 p-4 bg-blue-600/20 border border-blue-600/50 rounded-lg">
              <p>{status}</p>
            </div>
          )}

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
                  <p className="text-xs text-gray-500">Daily: {sendSafety.currentDaySent}/{sendSafety.maxPerDay}</p>
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
                  <p className="text-xs text-gray-500">Rate: {kpis.replyRate.toFixed(1)}%</p>
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
                  <p className="text-xs text-gray-500">Rate: {kpis.meetingRate.toFixed(1)}%</p>
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
                  <p className="text-xs text-gray-500">Rate: {kpis.bounceRate.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-700 mb-8">
            <nav className="flex space-x-8">
              {['icp', 'targets', 'campaign', 'analytics'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${
                    activeTab === tab
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-300'
                  }`}
                >
                  {tab === 'icp' ? 'ICP & Setup' : tab === 'targets' ? 'Target Companies' : tab === 'campaign' ? 'Campaign' : 'Analytics'}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'icp' && (
            <div className="space-y-6">
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h2 className="text-xl font-semibold mb-4">Tight ICP Definition</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-medium mb-3">Target Profile</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Industry:</span>
                        <span className="font-medium">{TIGHT_ICP.industry}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Size:</span>
                        <span className="font-medium">{TIGHT_ICP.size}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Funding:</span>
                        <span className="font-medium">{TIGHT_ICP.funding}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Geography:</span>
                        <span className="font-medium">{TIGHT_ICP.geo}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-3">Triggers & Pain Points</h3>
                    <div className="space-y-2">
                      <div>
                        <span className="text-gray-400">Primary Pain:</span>
                        <p className="font-medium mt-1">{TIGHT_ICP.pain}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Key Trigger:</span>
                        <p className="font-medium mt-1">{TIGHT_ICP.trigger}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h2 className="text-xl font-semibold mb-4">Campaign Setup</h2>
                {!currentCampaign ? (
                  <div className="text-center">
                    <button
                      onClick={createCampaign}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                      Create New Campaign
                    </button>
                    <p className="text-gray-400 mt-2">Start by creating your first campaign</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">{currentCampaign.name}</h3>
                      <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                        Active
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2">Templates</h4>
                        <div className="space-y-1">
                          <div className="text-sm">Email 1: Intro (&lt;120 words)</div>
                          <div className="text-sm">Email 2: Social Proof (&lt;120 words)</div>
                          <div className="text-sm">Breakup: Closing (&lt;120 words)</div>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2">Cadence</h4>
                        <div className="space-y-1">
                          <div className="text-sm">Day 0: Email 1 + Social</div>
                          <div className="text-sm">Day 3: Email 2</div>
                          <div className="text-sm">Day 5: Social (if connected)</div>
                          <div className="text-sm">Day 7: Breakup</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'targets' && (
            <div className="space-y-6">
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h2 className="text-xl font-semibold mb-4">Upload Target Companies (Max 50)</h2>
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-gray-400 mb-2">Drop your CSV file here or click to browse</p>
                  <p className="text-sm text-gray-500 mb-4">Required columns: company_name, email, website, industry, size, funding</p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvUpload}
                    disabled={isUploading || !currentCampaign}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label
                    htmlFor="csv-upload"
                    className={`px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                      isUploading || !currentCampaign
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {isUploading ? 'Processing...' : 'Choose CSV File'}
                  </label>
                </div>
                
                {targets.length > 0 && (
                  <div className="mt-4 text-sm text-gray-400">
                    <p>Loaded: {targets.length}/50 target companies</p>
                  </div>
                )}
              </div>

              {targets.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <h2 className="text-xl font-semibold mb-4">Target Companies ({targets.length})</h2>
                  <div className="space-y-4">
                    {targets.map((target) => (
                      <div key={target.id} className="bg-gray-700 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{target.companyName}</h3>
                            <p className="text-gray-400">{target.email}</p>
                            {target.website && (
                              <a href={target.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm">
                                {target.website}
                              </a>
                            )}
                            <div className="mt-2 flex items-center space-x-4 text-sm text-gray-400">
                              <span>{target.industry}</span>
                              <span>{target.size}</span>
                              <span>{target.funding}</span>
                            </div>
                            
                            {/* Research and Personalization */}
                            {target.research.trigger && (
                              <div className="mt-3 p-3 bg-gray-600/50 rounded">
                                <p className="text-sm text-gray-300">
                                  <strong>Research:</strong> {target.research.headline}
                                </p>
                                <p className="text-sm text-gray-400 mt-1">
                                  <strong>Trigger:</strong> {target.research.trigger}
                                </p>
                              </div>
                            )}
                            
                            {target.personalization.observation && (
                              <div className="mt-3 p-3 bg-blue-600/20 rounded">
                                <p className="text-sm text-gray-300">
                                  <strong>Observation:</strong> {target.personalization.observation}
                                </p>
                                <p className="text-sm text-gray-400 mt-1">
                                  <strong>Impact:</strong> {target.personalization.impact}
                                </p>
                              </div>
                            )}
                          </div>
                          
                          <div className="ml-4 space-y-2">
                            <StatusBadge status={target.status} />
                            
                            {/* Action Buttons */}
                            <div className="flex flex-col space-y-2">
                              {target.status === 'new' && (
                                <button
                                  onClick={() => startResearch(target.id)}
                                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                                >
                                  Research
                                </button>
                              )}
                              
                              {target.status === 'researching' && (
                                <button
                                  onClick={() => createPersonalization(target.id)}
                                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded transition-colors"
                                >
                                  Personalize
                                </button>
                              )}
                              
                              {target.status === 'personalized' && (
                                <button
                                  onClick={() => sendEmail(target.id, 'email1')}
                                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded transition-colors"
                                >
                                  Send Email 1
                                </button>
                              )}
                              
                              {target.status === 'email1_sent' && (
                                <button
                                  onClick={() => sendSocialMessage(target.id)}
                                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                                >
                                  Send Social
                                </button>
                              )}
                              
                              {target.status === 'social_attempted' && (
                                <button
                                  onClick={() => sendEmail(target.id, 'email2')}
                                  className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded transition-colors"
                                >
                                  Send Email 2
                                </button>
                              )}
                              
                              {target.status === 'email2_sent' && (
                                <button
                                  onClick={() => sendSocialMessage(target.id)}
                                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                                >
                                  Send Social
                                </button>
                              )}
                              
                              {target.status === 'social_attempted' && (
                                <button
                                  onClick={() => sendEmail(target.id, 'breakup')}
                                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                                >
                                  Send Breakup
                                </button>
                              )}
                              
                              {(target.status === 'replied' || target.status === 'email2_sent') && (
                                <button
                                  onClick={() => handleMeetingBooked(target.id)}
                                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
                                >
                                  Book Meeting
                                </button>
                              )}
                              
                              {target.status === 'bounced' && (
                                <button
                                  onClick={() => moveToNurture(target.id)}
                                  className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded transition-colors"
                                >
                                  Move to Nurture
                                </button>
                              )}
                              
                              <button
                                onClick={() => handleReply(target.id)}
                                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
                              >
                                Reply
                              </button>
                              
                              <button
                                onClick={() => handleBounce(target.id)}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                              >
                                Bounce
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'campaign' && (
            <div className="space-y-6">
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h2 className="text-xl font-semibold mb-4">Campaign Management</h2>
                
                {currentCampaign ? (
                  <div className="space-y-6">
                    {/* Send Safety Rules */}
                    <div>
                      <h3 className="text-lg font-medium mb-3">Send Safety Rules</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-700 p-4 rounded">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300">Daily Limit</span>
                            <span className="font-medium">{sendSafety.currentDaySent}/{sendSafety.maxPerDay}</span>
                          </div>
                          <div className="mt-2 w-full bg-gray-600 rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full" 
                              style={{ width: `${(sendSafety.currentDaySent / sendSafety.maxPerDay) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                        
                        <div className="bg-gray-700 p-4 rounded">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300">Bounce Rate</span>
                            <span className={`font-medium ${kpis.bounceRate > 5 ? 'text-red-400' : 'text-green-400'}`}>
                              {kpis.bounceRate.toFixed(1)}%
                            </span>
                          </div>
                          {kpis.bounceRate > 5 && (
                            <p className="text-red-400 text-sm mt-1">⚠️ Sending paused</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Auto-Exit Rules */}
                    <div>
                      <h3 className="text-lg font-medium mb-3">Auto-Exit Rules</h3>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <span className="text-sm">If replied → remove from sequence</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <span className="text-sm">If meeting booked → remove from sequence</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          <span className="text-sm">If bounced → pause lead</span>
                        </div>
                      </div>
                    </div>

                    {/* Weekly KPI Check */}
                    <div>
                      <h3 className="text-lg font-medium mb-3">Weekly KPI Check</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gray-700 p-4 rounded">
                          <div className="flex justify-between">
                            <span className="text-gray-300">Reply Rate</span>
                            <span className={`font-medium ${kpis.replyRate > 10 ? 'text-green-400' : 'text-yellow-400'}`}>
                              {kpis.replyRate.toFixed(1)}%
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">Target: &gt;10%</p>
                        </div>
                        
                        <div className="bg-gray-700 p-4 rounded">
                          <div className="flex justify-between">
                            <span className="text-gray-300">Meeting Rate</span>
                            <span className={`font-medium ${kpis.meetingRate > 5 ? 'text-green-400' : 'text-yellow-400'}`}>
                              {kpis.meetingRate.toFixed(1)}%
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">Target: &gt;5%</p>
                        </div>
                        
                        <div className="bg-gray-700 p-4 rounded">
                          <div className="flex justify-between">
                            <span className="text-gray-300">Bounce Rate</span>
                            <span className={`font-medium ${kpis.bounceRate < 5 ? 'text-green-400' : 'text-red-400'}`}>
                              {kpis.bounceRate.toFixed(1)}%
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">Target: &lt;5%</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-gray-400">No active campaign</p>
                    <button
                      onClick={createCampaign}
                      className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                      Create Campaign
                    </button>
                  </div>
                )}
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
                        <span>Reply Rate:</span>
                        <span className={`font-bold ${kpis.replyRate > 10 ? 'text-green-400' : 'text-yellow-400'}`}>
                          {kpis.replyRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Meeting Rate:</span>
                        <span className={`font-bold ${kpis.meetingRate > 5 ? 'text-green-400' : 'text-yellow-400'}`}>
                          {kpis.meetingRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-lg font-medium mb-2">Health Metrics</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Bounce Rate:</span>
                        <span className={`font-bold ${kpis.bounceRate < 5 ? 'text-green-400' : 'text-red-400'}`}>
                          {kpis.bounceRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Targets in Sequence:</span>
                        <span className="font-bold">{targets.filter(t => !['replied', 'booked', 'bounced', 'nurture'].includes(t.status)).length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Nurture Queue:</span>
                        <span className="font-bold">{targets.filter(t => t.status === 'nurture').length}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Target Status Breakdown */}
                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-3">Target Status Breakdown</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {CONTACT_STATUSES.map(status => {
                      const count = targets.filter(t => t.status === status.id).length;
                      if (count === 0) return null;
                      
                      return (
                        <div key={status.id} className="bg-gray-700 p-3 rounded text-center">
                          <div className="text-2xl font-bold">{count}</div>
                          <div className="text-sm text-gray-400">{status.label}</div>
                        </div>
                      );
                    })}
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

// Status Badge Component
function StatusBadge({ status }) {
  const statusInfo = CONTACT_STATUSES.find(s => s.id === status);
  if (!statusInfo) return null;
  
  const colors = {
    gray: 'bg-gray-600',
    blue: 'bg-blue-600',
    indigo: 'bg-indigo-600',
    purple: 'bg-purple-600',
    orange: 'bg-orange-600',
    yellow: 'bg-yellow-600',
    red: 'bg-red-600',
    green: 'bg-green-600',
    emerald: 'bg-emerald-600',
    rose: 'bg-rose-600'
  };
  
  return (
    <span className={`${colors[statusInfo.color]} text-white px-2 py-1 rounded-full text-xs font-medium`}>
      {statusInfo.label}
    </span>
  );
}
