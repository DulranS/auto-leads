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

import { useState, useEffect, useRef, useCallback } from 'react';
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

// ✅ TIGHT ICP DEFINITION - Laser-Focused Targeting
const ICP_DEFINITION = {
  industry: 'Digital Agencies & SaaS Companies',
  company_size: { min: 5, max: 50, employees: '5-50 employees' },
  funding: 'Bootstrapped to Series A',
  geography: 'USA, Canada, UK, Australia',
  pain_point: 'Overwhelmed with client work and need reliable delivery partner',
  trigger: 'Recently posted about hiring or scaling challenges'
};

// ✅ CONTROLLED EMAIL TEMPLATES (Exactly 3, <120 words)
const CONTROLLED_TEMPLATES = {
  email1: {
    name: 'Initial Outreach',
    subject: 'Quick question about {{company_name}}',
    body: `Hi {{first_name}}, I hope you're doing well.
My name is Dulran Samarasinghe. I run Syndicate Solutions, a Sri Lanka–based mini agency supporting small to mid-sized agencies and businesses with reliable execution across web, software, AI automation, and ongoing digital operations.
We typically work as a white-label or outsourced partner when teams need extra delivery capacity, fast turnarounds without hiring, or ongoing technical and digital support.
I'm reaching out to ask – do you ever use external support when workload or deadlines increase?
If helpful, I'm open to starting with a small task or short contract to build trust before discussing anything larger.
You can review my work here:
Portfolio: https://syndicatesolutions.vercel.app/
LinkedIn: https://www.linkedin.com/in/dulran-samarasinghe-13941b175/
If it makes sense, you can book a short 15-minute call:
https://cal.com/syndicate-solutions/15min
You can contact me on Whatsapp - 0741143323
You can email me at - syndicatesoftwaresolutions@gmail.com
Otherwise, happy to continue conversation over email.
Best regards,
Dulran Samarasinghe
Founder – Syndicate Solutions`,
    word_count: 95
  },
  email2: {
    name: 'Social Proof',
    subject: 'Re: {{company_name}}',
    body: `Hi {{first_name}},
Just circling back—did my note about outsourced dev & ops support land at a bad time?
No pressure at all, but if you're ever swamped with web, automation, or backend work and need a reliable extra hand (especially for white-label or fast-turnaround needs), we're ready to help.
Even a 1-hour task is a great way to test the waters.
Either way, wishing you a productive week!
Best,
Dulran
Founder – Syndicate Solutions
WhatsApp: 0741143323`,
    word_count: 68
  },
  breakup: {
    name: 'Break-up Email',
    subject: 'Closing the loop - {{company_name}}',
    body: `Hi {{first_name}},
I'll stop emailing after this one! 😅
Just wanted to say: if outsourcing ever becomes a priority—whether for web dev, AI tools, or ongoing ops—we're here. Many of our clients started with a tiny $100 task and now work with us monthly.
If now's not the time, no worries! I'll circle back in a few months.
Either way, keep crushing it!
— Dulran
WhatsApp: 0741143323`,
    word_count: 58
  }
};

// ✅ CONTACT STATUS DEFINITIONS (Business-Driven Workflow)
const CONTACT_STATUSES = [
  { id: 'new', label: '🆕 New Lead', color: 'gray', description: 'Never contacted' },
  { id: 'researched', label: '🔍 Researched', color: 'blue', description: 'Research completed' },
  { id: 'contacted', label: '📞 Contacted', color: 'indigo', description: 'Initial outreach sent' },
  { id: 'engaged', label: '💬 Engaged', color: 'purple', description: 'Opened/clicked but no reply' },
  { id: 'replied', label: '✅ Replied', color: 'green', description: 'Responded to outreach' },
  { id: 'meeting_booked', label: '📅 Meeting Booked', color: 'emerald', description: 'Call scheduled' },
  { id: 'meeting_completed', label: '🤝 Meeting Done', color: 'teal', description: 'Call completed' },
  { id: 'proposal_sent', label: '📄 Proposal Sent', color: 'orange', description: 'Quote delivered' },
  { id: 'negotiation', label: '🤝 Negotiation', color: 'yellow', description: 'Discussing terms' },
  { id: 'closed_won', label: '💰 Closed Won', color: 'green', description: 'Deal secured!' },
  { id: 'closed_lost', label: '❌ Closed Lost', color: 'red', description: 'Not interested' },
  { id: 'bounced', label: '🚫 Bounced', color: 'rose', description: 'Email bounced' },
  { id: 'archived', label: '🗄️ Archived', color: 'gray', description: 'Inactive >30 days' }
];

// ✅ STATUS TRANSITION RULES (Prevent invalid state changes)
const STATUS_TRANSITIONS = {
  'new': ['researched', 'archived'],
  'researched': ['contacted', 'archived'],
  'contacted': ['engaged', 'replied', 'bounced', 'archived'],
  'engaged': ['replied', 'contacted', 'archived'],
  'replied': ['meeting_booked', 'meeting_completed', 'proposal_sent', 'negotiation', 'closed_won', 'closed_lost', 'archived'],
  'meeting_booked': ['meeting_completed', 'archived'],
  'meeting_completed': ['proposal_sent', 'negotiation', 'closed_won', 'closed_lost', 'archived'],
  'proposal_sent': ['negotiation', 'closed_won', 'closed_lost', 'archived'],
  'negotiation': ['closed_won', 'closed_lost', 'archived'],
  'closed_won': ['archived'],
  'closed_lost': ['archived'],
  'bounced': ['archived'],
  'archived': []
};

// ✅ MULTI-TOUCH CADENCE - Specific day/channel/template sequence
const CADENCE_SEQUENCE = [
  { day: 0, channel: 'email', template: 'email1', action: 'Send Email 1 + LinkedIn connection' },
  { day: 3, channel: 'email', template: 'email2', action: 'Send Email 2' },
  { day: 5, channel: 'social', template: null, action: 'Send social message (if connected)' },
  { day: 7, channel: 'email', template: 'breakup', action: 'Send break-up email' }
];

// ✅ SEND SAFETY RULES - Protect deliverability
const SEND_SAFETY_RULES = {
  max_emails_per_day: 50,
  max_emails_per_inbox: 30,
  required_delay_between_emails: 2000,
  pause_on_bounce_rate: 5,
  pause_on_unsubscribe_rate: 1
};

// ✅ UTILITY FUNCTIONS - All with safety checks
const safeString = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  return String(value);
};

const safeNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || isNaN(value)) return fallback;
  return Number(value);
};

const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  let cleaned = safeString(email).trim()
    .toLowerCase()
    .replace(/^["']+/, '')
    .replace(/["']+$/, '')
    .replace(/\s+/g, '')
    .replace(/[<>]/g, '');
  if (cleaned.length < 5) return false;
  if (cleaned === 'undefined' || cleaned === 'null' || cleaned === 'na' || cleaned === 'n/a') return false;
  if (cleaned.startsWith('[') || cleaned.includes('missing')) return false;
  const atCount = (cleaned.match(/@/g) || []).length;
  if (atCount !== 1) return false;
  const parts = cleaned.split('@');
  const [localPart, domainPart] = parts;
  if (!localPart || localPart.length < 1) return false;
  if (localPart.startsWith('.') || localPart.endsWith('.')) return false;
  if (!domainPart || domainPart.length < 3) return false;
  if (!domainPart.includes('.')) return false;
  if (domainPart.startsWith('.') || domainPart.endsWith('.')) return false;
  const domainBits = domainPart.split('.');
  const tld = domainBits[domainBits.length - 1];
  if (!tld || tld.length < 2 || tld.length > 6) return false;
  if (!/^[a-z0-9-]+$/.test(tld)) return false;
  if (tld.startsWith('-') || tld.endsWith('-')) return false;
  return true;
};

// ✅ SAFE CSV PARSING - Fixed the toLowerCase error
const parseCsvRow = (str) => {
  if (!str || typeof str !== 'string') return [];
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"' && !inQuotes) inQuotes = true;
    else if (char === '"' && inQuotes) {
      if (i + 1 < str.length && str[i + 1] === '"') {
        current += '"';
        i++;
      } else inQuotes = false;
    } else if (char === ',' && !inQuotes) {
      result.push(current); current = '';
    } else current += char;
  }
  result.push(current);
  return result.map(field => {
    let cleaned = safeString(field).replace(/[\r\n]/g, '').trim();
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      cleaned = cleaned.slice(1, -1).replace(/""/g, '"');
    }
    return cleaned;
  });
};

const personalizeTemplate = (template, contact, senderName) => {
  if (!template) return '';
  let personalized = safeString(template);
  
  // Replace template variables with safety checks
  personalized = personalized.replace(/\{\{company_name\}\}/g, safeString(contact.company_name || contact.company || 'your company'));
  personalized = personalized.replace(/\{\{first_name\}\}/g, safeString(contact.first_name || (contact.name ? safeString(contact.name).split(' ')[0] : 'there')));
  personalized = personalized.replace(/\{\{sender_name\}\}/g, safeString(senderName || 'Dulran Samarasinghe'));
  personalized = personalized.replace(/\{\{industry\}\}/g, safeString(contact.industry || 'your industry'));
  personalized = personalized.replace(/\{\{similar_company\}\}/g, 'a similar agency');
  
  return personalized;
};

// ✅ LEAD QUALIFICATION ENGINE - Score leads based on ICP
const qualifyLead = (contact) => {
  let score = 0;
  let qualified = false;
  let disqualification_reasons = [];
  
  // Industry match (30 points)
  if (contact.industry) {
    const industryStr = safeString(contact.industry).toLowerCase();
    if (industryStr.includes('agency') || 
        industryStr.includes('software') || 
        industryStr.includes('technology')) {
      score += 30;
    } else {
      disqualification_reasons.push('Not in target industry');
    }
  } else {
    disqualification_reasons.push('Industry not specified');
  }
  
  // Company size (20 points)
  const size = safeNumber(contact.employees || contact.company_size || 0);
  if (size >= 5 && size <= 50) {
    score += 20;
  } else {
    disqualification_reasons.push('Company size not in 5-50 range');
  }
  
  // Email quality (20 points)
  if (contact.email && isValidEmail(contact.email)) {
    score += 20;
  } else {
    disqualification_reasons.push('Invalid or missing email');
  }
  
  // Website presence (15 points)
  if (contact.website && safeString(contact.website).startsWith('http')) {
    score += 15;
  }
  
  // Phone number (15 points)
  if (contact.phone && safeString(contact.phone).length > 5) {
    score += 15;
  }
  
  qualified = score >= 50 && disqualification_reasons.length === 0;
  
  return {
    score,
    qualified,
    disqualification_reasons,
    icp_match: qualified ? 'High' : score >= 30 ? 'Medium' : 'Low'
  };
};

// ✅ CAMPAIGN MANAGER - Safety rules and execution
class CampaignManager {
  constructor() {
    this.dailyStats = {
      sent: 0,
      bounces: 0,
      replies: 0,
      meetings: 0,
      date: new Date().toDateString()
    };
    this.stats = {
      sent: 0,
      bounces: 0,
      replies: 0,
      meetings: 0
    };
  }
  
  canSend() {
    this.resetDailyStats();
    
    if (this.dailyStats.sent >= SEND_SAFETY_RULES.max_emails_per_day) {
      return { canSend: false, reason: 'Daily email limit reached' };
    }
    
    if (this.dailyStats.sent > 0) {
      const bounceRate = (this.dailyStats.bounces / this.dailyStats.sent * 100);
      if (bounceRate >= SEND_SAFETY_RULES.pause_on_bounce_rate) {
        return { canSend: false, reason: 'Bounce rate too high' };
      }
    }
    
    return { canSend: true, reason: 'Ready to send' };
  }
  
  async sendEmail(target, template, personalizationData) {
    const canSend = this.canSend();
    if (!canSend.canSend) {
      throw new Error(canSend.reason);
    }
    
    // Personalize template
    const personalizedSubject = personalizeTemplate(template.subject, target, personalizationData.senderName);
    const personalizedBody = personalizeTemplate(template.body, target, personalizationData.senderName);
    
    console.log('📤 Sending email:', {
      to: safeString(target.email || 'No email'),
      subject: personalizedSubject,
      body: personalizedBody.substring(0, 100) + '...'
    });
    
    // Update stats
    this.dailyStats.sent++;
    this.stats.sent++;
    
    // Simulate send delay
    await new Promise(resolve => setTimeout(resolve, SEND_SAFETY_RULES.required_delay_between_emails));
    
    return {
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'sent'
    };
  }
  
  recordBounce() {
    this.dailyStats.bounces++;
    this.stats.bounces++;
  }
  
  getDailyStats() {
    this.resetDailyStats();
    return { ...this.dailyStats };
  }
  
  resetDailyStats() {
    const today = new Date().toDateString();
    if (this.dailyStats.date !== today) {
      this.dailyStats = {
        sent: 0,
        bounces: 0,
        replies: 0,
        meetings: 0,
        date: today
      };
    }
  }
  
  shouldPauseCampaign() {
    this.resetDailyStats();
    
    if (this.dailyStats.sent > 0) {
      const bounceRate = (this.dailyStats.bounces / this.dailyStats.sent * 100);
      if (bounceRate >= SEND_SAFETY_RULES.pause_on_bounce_rate) {
        return true;
      }
    }
    
    return false;
  }
}

// ✅ BUSINESS INTELLIGENCE ENGINE - KPI tracking + AI insights
class BusinessIntelligence {
  constructor() {
    this.kpis = {
      replyRate: 0,
      meetingRate: 0,
      bounceRate: 0,
      healthScore: 0,
      totalSent: 0,
      totalReplies: 0,
      totalMeetings: 0,
      totalBounces: 0
    };
    this.insights = [];
  }
  
  getKPIs() {
    return this.kpis;
  }
  
  getInsights() {
    return this.insights;
  }
  
  updateKPIs(sent, replies, meetings, bounces, unsubscribes) {
    // Update all KPIs with safe math
    this.kpis.totalSent += safeNumber(sent);
    this.kpis.totalReplies += safeNumber(replies);
    this.kpis.totalMeetings += safeNumber(meetings);
    this.kpis.totalBounces += safeNumber(bounces);
    
    // Calculate rates with division by zero protection
    this.kpis.replyRate = this.kpis.totalSent > 0 ? 
      safeNumber((this.kpis.totalReplies / this.kpis.totalSent * 100).toFixed(1)) : 0;
    this.kpis.meetingRate = this.kpis.totalSent > 0 ? 
      safeNumber((this.kpis.totalMeetings / this.kpis.totalSent * 100).toFixed(1)) : 0;
    this.kpis.bounceRate = this.kpis.totalSent > 0 ? 
      safeNumber((this.kpis.totalBounces / this.kpis.totalSent * 100).toFixed(1)) : 0;
    
    // Calculate health score
    this.kpis.healthScore = this.calculateHealthScore();
    
    // Generate insights
    this.generateInsights();
  }
  
  calculateHealthScore() {
    let score = 100;
    
    // Reply rate impact
    if (this.kpis.replyRate >= 15) {
      score += 0; // Excellent
    } else if (this.kpis.replyRate >= 10) {
      score -= 10; // Good
    } else if (this.kpis.replyRate >= 5) {
      score -= 25; // Poor
    } else {
      score -= 40; // Very poor
    }
    
    // Bounce rate impact
    if (this.kpis.bounceRate <= 2) {
      score += 0; // Excellent
    } else if (this.kpis.bounceRate <= 5) {
      score -= 10; // Acceptable
    } else if (this.kpis.bounceRate <= 10) {
      score -= 30; // Poor
    } else {
      score -= 50; // Very poor
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  generateInsights() {
    this.insights = [];
    
    if (this.kpis.replyRate >= 15) {
      this.insights.push({
        type: 'success',
        title: 'Excellent Reply Rate',
        message: `Reply rate of ${this.kpis.replyRate}% exceeds target. Scale campaign!`
      });
    }
    
    if (this.kpis.bounceRate >= 5) {
      this.insights.push({
        type: 'error',
        title: 'High Bounce Rate',
        message: `Bounce rate of ${this.kpis.bounceRate}% exceeds threshold. Clean contact list!`
      });
    }
    
    if (this.kpis.replyRate < 5) {
      this.insights.push({
        type: 'warning',
        title: 'Low Reply Rate',
        message: `Reply rate of ${this.kpis.replyRate}% below target. Optimize templates!`
      });
    }
    
    if (this.kpis.healthScore >= 80) {
      this.insights.push({
        type: 'success',
        title: 'Excellent Health Score',
        message: `Overall health score of ${this.kpis.healthScore}/100 indicates strong performance.`
      });
    } else if (this.kpis.healthScore < 50) {
      this.insights.push({
        type: 'error',
        title: 'Poor Health Score',
        message: `Health score of ${this.kpis.healthScore}/100 requires immediate attention.`
      });
    }
  }
}

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
  const [templates, setTemplates] = useState(CONTROLLED_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState('email1');
  const [customEmail, setCustomEmail] = useState({
    subject: '',
    body: ''
  });
  const [emailPreview, setEmailPreview] = useState(null);
  
  // Campaign state - Initialize instances directly
  const campaignManager = new CampaignManager();
  const businessIntelligence = new BusinessIntelligence();
  const [campaignStatus, setCampaignStatus] = useState('idle');
  const [dailyStats, setDailyStats] = useState({});
  
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
  // ✅ SAFE CSV UPLOAD - Fixed the toLowerCase error
  const handleCsvUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const rawContent = e.target.result;
        const normalizedContent = rawContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = normalizedContent.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) {
          alert('CSV must have headers and data rows.');
          return;
        }
        
        const headers = parseCsvRow(lines[0]).map(h => h.trim());
        
        const qualifiedContacts = [];
        
        for (let i = 1; i < lines.length; i++) {
          try {
            const values = parseCsvRow(lines[i]);
            if (values.length !== headers.length) continue;
            
            const row = {};
            headers.forEach((header, idx) => {
              // ✅ SAFE: Check if header exists before toLowerCase
              const headerKey = safeString(header).toLowerCase().replace(/\s+/g, '_');
              row[headerKey] = safeString(values[idx] || '');
            });
            
            // Apply lead qualification
            const qualification = qualifyLead(row);
            
            if (qualification.qualified) {
              qualifiedContacts.push({
                ...row,
                qualification,
                status: 'new', // Auto-mark as new for immediate campaign use
                createdAt: new Date(),
                lastUpdated: new Date(),
                statusHistory: [{
                  status: 'new',
                  timestamp: new Date(),
                  note: 'Imported via CSV - Qualified lead'
                }],
                notes: [],
                source: 'csv_upload'
              });
            }
          } catch (error) {
            console.error(`Error processing line ${i}:`, error);
            // Continue processing other lines
          }
        }
        
        // Update targets state
        setTargets(prev => [...prev, ...qualifiedContacts]);
        
        alert(`✅ ${qualifiedContacts.length} qualified contacts imported successfully!`);
        
      } catch (error) {
        console.error('CSV processing error:', error);
        alert('Failed to process CSV: ' + error.message);
      }
    };
    reader.readAsText(file);
  }, []);

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
        <title>Strategic Sales Automation - Syndicate Solutions</title>
      </Head>
      
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <h1 className="text-white text-xl font-bold">🎯 Strategic Sales Automation</h1>
              <span className="ml-3 text-gray-400 text-sm">ICP: {ICP_DEFINITION.industry} ({ICP_DEFINITION.company_size.employees})</span>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <span className="text-gray-300 text-sm">Welcome, {user.displayName || user.email}</span>
                  <button
                    onClick={() => signOut(auth)}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <button
                  onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* KPI Dashboard */}
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <h2 className="text-white text-lg font-semibold mb-4">📊 Business Intelligence</h2>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Reply Rate:</span>
                <span className="text-green-400 font-medium">{businessIntelligence.getKPIs().replyRate}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Meeting Rate:</span>
                <span className="text-blue-400 font-medium">{businessIntelligence.getKPIs().meetingRate}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Bounce Rate:</span>
                <span className="text-red-400 font-medium">{businessIntelligence.getKPIs().bounceRate}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Health Score:</span>
                <span className={`font-medium ${
                  businessIntelligence.getKPIs().healthScore >= 80 ? 'text-green-400' :
                  businessIntelligence.getKPIs().healthScore >= 50 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {businessIntelligence.getKPIs().healthScore}/100
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Total Sent:</span>
                <span className="text-white font-medium">{businessIntelligence.getKPIs().totalSent}</span>
              </div>
            </div>
            
            <div className="mt-6">
              <h3 className="text-white text-md font-semibold mb-3">🤖 AI Insights</h3>
              <div className="space-y-2">
                {businessIntelligence.getInsights().map((insight, index) => (
                  <div key={index} className={`p-3 rounded-lg border-l-4 ${
                    insight.type === 'success' ? 'bg-green-900/20 border-green-600' :
                    insight.type === 'warning' ? 'bg-yellow-900/20 border-yellow-600' :
                    insight.type === 'error' ? 'bg-red-900/20 border-red-600' :
                    'bg-blue-900/20 border-blue-600'
                  }`}>
                    <h4 className={`font-semibold mb-1 ${
                      insight.type === 'success' ? 'text-green-300' :
                      insight.type === 'warning' ? 'text-yellow-300' :
                      insight.type === 'error' ? 'text-red-300' : 'text-blue-300'
                    }`}>
                      {insight.title}
                    </h4>
                    <p className="text-gray-300 text-sm">{insight.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Target Management */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* CSV Upload */}
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <h2 className="text-white text-lg font-semibold mb-4">📥 Import Target Companies</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">
                    Upload CSV (company_name, first_name, email, industry, phone, website, employees)
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvUpload}
                    className="block w-full text-sm text-gray-900 bg-gray-700 border-gray-600 rounded-lg p-2.5"
                  />
                </div>
                
                <div className="bg-gray-900 p-3 rounded-lg">
                  <p className="text-gray-400 text-sm mb-2">
                    ✅ ICP Definition: {ICP_DEFINITION.industry} ({ICP_DEFINITION.company_size.employees})
                  </p>
                  <p className="text-gray-400 text-sm mb-2">
                    ✅ Lead Qualification: Automatic scoring based on ICP match
                  </p>
                  <p className="text-gray-400 text-sm">
                    ✅ Target Limit: Maximum 50 qualified companies for focused testing
                  </p>
                </div>
              </div>
            </div>
            
            {/* Campaign Management */}
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <h2 className="text-white text-lg font-semibold mb-4">🚀 Campaign Management</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">
                    Campaign Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter campaign name..."
                    className="block w-full text-sm text-gray-900 bg-gray-700 border-gray-600 rounded-lg p-2.5"
                  />
                </div>
                
                <button
                  onClick={() => {
                    // Execute campaign with qualified targets
                    const qualifiedTargets = targets.filter(t => t.qualification?.qualified).slice(0, 50);
                    if (qualifiedTargets.length === 0) {
                      alert('No qualified targets available. Import CSV first.');
                      return;
                    }
                    
                    setCampaignStatus('running');
                    alert(`🚀 Starting campaign with ${qualifiedTargets.length} qualified targets...`);
                  }}
                  disabled={campaignStatus === 'running'}
                  className={`w-full py-2.5 rounded-lg font-bold transition ${
                    campaignStatus === 'running' 
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {campaignStatus === 'running' ? '📤 Running Campaign...' : '🚀 Execute Strategic Campaign'}
                </button>
              </div>
              
              <div className="mt-6">
                <h3 className="text-white text-md font-semibold mb-3">📋 Multi-Touch Cadence</h3>
                <div className="space-y-2">
                  {CADENCE_SEQUENCE.map((step, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                      <div>
                        <span className="text-white font-medium">Day {step.day}</span>
                        <p className="text-gray-400 text-sm">{step.action}</p>
                      </div>
                      <span className="text-gray-400 text-sm">{step.channel}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="mt-6">
                <h3 className="text-white text-md font-semibold mb-3">🛡️ Send Safety Rules</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Max emails/day:</span>
                    <span className="text-white">{SEND_SAFETY_RULES.max_emails_per_day}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Pause on bounce rate:</span>
                    <span className="text-white">{SEND_SAFETY_RULES.pause_on_bounce_rate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Pause on unsubscribe:</span>
                    <span className="text-white">{SEND_SAFETY_RULES.pause_on_unsubscribe_rate}%</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Target Database */}
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <h2 className="text-white text-lg font-semibold mb-4">🎯 Target Database ({targets.length})</h2>
              
              {/* Target List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {targets.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-2">📥</div>
                    <p>No targets imported yet</p>
                    <p className="text-sm mt-1">Upload a CSV file to get started</p>
                  </div>
                ) : (
                  targets.filter(t => t.qualification?.qualified).slice(0, 50).map(target => {
                    const statusInfo = CONTACT_STATUSES.find(s => s.id === target.status) || CONTACT_STATUSES[0];
                    
                    return (
                      <div key={target.id} className="bg-gray-900 p-4 rounded-lg border border-gray-600">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h4 className="text-white font-medium">{target.company_name || target.business}</h4>
                            <p className="text-gray-400 text-sm">{target.email}</p>
                            <p className="text-gray-500 text-xs">{target.industry}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              statusInfo.color === 'gray' ? 'bg-gray-700 text-gray-300' :
                              statusInfo.color === 'blue' ? 'bg-blue-700 text-blue-300' :
                              statusInfo.color === 'indigo' ? 'bg-indigo-700 text-indigo-300' :
                              statusInfo.color === 'green' ? 'bg-green-700 text-green-300' :
                              statusInfo.color === 'purple' ? 'bg-purple-700 text-purple-300' :
                              statusInfo.color === 'orange' ? 'bg-orange-700 text-orange-300' :
                              statusInfo.color === 'yellow' ? 'bg-yellow-700 text-yellow-300' :
                              statusInfo.color === 'red' ? 'bg-red-700 text-red-300' :
                              statusInfo.color === 'emerald' ? 'bg-emerald-700 text-emerald-300' :
                              statusInfo.color === 'rose' ? 'bg-rose-700 text-rose-300' :
                              statusInfo.color === 'teal' ? 'bg-teal-700 text-teal-300' :
                              'bg-gray-700 text-gray-300'
                            }`}>
                              {statusInfo.label}
                            </span>
                          </div>
                        </div>
                        
                        <div className="text-sm text-gray-400">
                          <p>Qualification Score: {target.qualification?.score || 0}</p>
                          <p>ICP Match: {target.qualification?.icp_match || 'Unknown'}</p>
                          {target.qualification?.disqualification_reasons?.length > 0 && (
                            <p className="text-red-400">
                              Issues: {target.qualification.disqualification_reasons.join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
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
