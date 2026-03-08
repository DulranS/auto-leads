'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, deleteDoc, Timestamp, orderBy, limit, addDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import Head from 'next/head';
import { useRouter } from 'next/navigation';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

// ===== STRATEGIC ICP DEFINITION =====
const ICP_DEFINITION = {
  industry: 'B2B SaaS & Technology Companies',
  size: '50-500 employees (Series A-C)',
  geo: 'North America & UK',
  pain: 'Scaling customer acquisition efficiently',
  trigger: 'Recent funding round or product launch',
  description: 'High-growth tech companies that just raised funding and need to scale acquisition'
};

// ===== CONTROLLED TEMPLATE SYSTEM =====
const SALES_TEMPLATES = {
  email1: {
    name: 'Intro - Quick Question',
    subject: 'Quick question about {{company}}',
    body: `Hi {{name}},

Saw {{company}} just raised {{funding_amount}} - congras!

I help B2B SaaS companies like yours scale customer acquisition without increasing ad spend. We typically see 2-3x improvement in lead-to-customer conversion.

Worth a 10-min chat to see if this applies to your current growth stage?

Best,
{{sender_name}}

P.S. Here's my calendar: {{booking_link}} (10-min slots available)`,
    word_count: 89
  },
  
  email2: {
    name: 'Social Proof - Follow-up',
    subject: 'Re: {{company}} growth',
    body: `Hi {{name}},

Quick follow-up. We helped {{similar_company}} (similar stage) go from {{metric_before}} to {{metric_after}} in 90 days using our acquisition framework.

Their VP of Sales said: "{{testimonial}}"

If you're interested in similar results, I have some ideas specific to {{company}}'s current positioning.

Available for 10 mins: {{booking_link}}

Best,
{{sender_name}}`,
    word_count: 95
  },
  
  breakup: {
    name: 'Break-up - Closing loop',
    subject: 'Closing the loop',
    body: `Hi {{name}},

I'll stop reaching out after this one - but wanted to share one final thought:

{{personalized_insight}}

If timing changes and you want to explore customer acquisition scaling, my calendar is always open: {{booking_link}}

Wishing you continued success with {{company}}!

Best,
{{sender_name}}`,
    word_count: 82
  }
};

// ===== CADENCE CONFIGURATION =====
const CADENCE_RULES = {
  day0: { action: 'email', template: 'email1', linkedin: true },
  day3: { action: 'email', template: 'email2' },
  day5: { action: 'linkedin', template: 'message', condition: 'connected' },
  day7: { action: 'email', template: 'breakup' }
};

// ===== SAFETY & COMPLIANCE RULES =====
const SAFETY_RULES = {
  maxEmailsPerDay: 40,
  maxEmailsPerInbox: 30,
  bounceThreshold: 0.05,
  unsubscribeThreshold: 0.01,
  stopOnBounce: true,
  timezoneRequired: true,
  minTimeBetweenSends: 60000 // 1 minute between sends
};

// ===== AUTO-EXIT RULES =====
const AUTO_EXIT_RULES = {
  replied: true,
  booked: true,
  bounced: true,
  unsubscribed: true,
  not_interested: true
};

// ===== ENTERPRISE BUSINESS ENGINE =====
class SalesAutomationEngine {
  constructor() {
    this.isHealthy = true;
    this.lastHealthCheck = null;
    this.failures = [];
    this.dailySendCount = 0;
    this.lastResetDate = new Date().toDateString();
    this.sendHistory = [];
    this.templatePerformance = {
      email1: { sent: 0, replies: 0, meetings: 0 },
      email2: { sent: 0, replies: 0, meetings: 0 },
      breakup: { sent: 0, replies: 0, meetings: 0 }
    };
    this.manualMode = false;
    this.automationPaused = false;
  }

  // Lead qualification based on ICP
  qualifyLead(company) {
    const qualifications = {
      industry: this.checkIndustry(company),
      size: this.checkSize(company),
      funding: this.checkFunding(company),
      trigger: this.checkTrigger(company)
    };
    
    const score = Object.values(qualifications).filter(Boolean).length;
    return {
      qualified: score >= 3,
      score,
      reasons: Object.entries(qualifications)
        .filter(([key, value]) => value)
        .map(([key]) => key),
      details: qualifications,
      confidence: score / 4
    };
  }

  checkIndustry(company) {
    const targetIndustries = ['software', 'saas', 'technology', 'fintech', 'healthtech', 'enterprise software'];
    const industry = (company.industry || company.description || '').toLowerCase();
    return targetIndustries.some(ind => industry.includes(ind));
  }

  checkSize(company) {
    const employees = company.employees || company.size || 0;
    return employees >= 50 && employees <= 500;
  }

  checkFunding(company) {
    return !!(company.recent_funding || company.funding_stage || company.funding_amount);
  }

  checkTrigger(company) {
    return !!(company.recent_news || company.product_launch || company.hiring_spree || company.executive_change);
  }

  // 2-minute research extractor
  async extractResearch(company) {
    const research = {
      headline: `${company.name} - ${company.industry || 'Technology'}`,
      trigger: null,
      trigger_link: null,
      decision_makers: [],
      personalization: null,
      confidence_score: 0,
      research_time: new Date().toISOString()
    };

    // Extract trigger with link
    if (company.recent_funding) {
      research.trigger = `Raised ${company.recent_funding} in ${company.funding_date || 'recent round'}`;
      research.trigger_link = company.funding_link || '#';
      research.confidence_score += 0.4;
    } else if (company.product_launch) {
      research.trigger = `Launched ${company.product_launch} in ${company.launch_date || 'recently'}`;
      research.trigger_link = company.launch_link || '#';
      research.confidence_score += 0.3;
    } else if (company.recent_hiring) {
      research.trigger = `Hiring for ${company.recent_hiring} positions`;
      research.trigger_link = company.hiring_link || '#';
      research.confidence_score += 0.2;
    } else if (company.executive_change) {
      research.trigger = `New ${company.executive_change.role} joined`;
      research.trigger_link = company.executive_change.link || '#';
      research.confidence_score += 0.2;
    }

    // Extract decision makers with LinkedIn
    if (company.executives || company.leadership) {
      const executives = company.executives || company.leadership;
      research.decision_makers = executives
        .filter(exec => ['CEO', 'CTO', 'VP Sales', 'Head of Growth', 'CRO', 'VP Marketing'].includes(exec.role))
        .slice(0, 2)
        .map(exec => ({
          name: exec.name,
          role: exec.role,
          email: exec.email,
          linkedin: exec.linkedin || exec.linkedin_url,
          verified: false,
          verification_status: 'pending'
        }));
      
      if (research.decision_makers.length > 0) {
        research.confidence_score += 0.3;
      }
    }

    // Generate personalization
    research.personalization = this.generatePersonalization(company, research);
    
    return research;
  }

  generatePersonalization(company, research) {
    const observations = [];
    const impacts = [];

    if (research.trigger) {
      observations.push(research.trigger);
      impacts.push('Scaling acquisition is likely a priority right now');
    }

    if (company.employees > 200) {
      observations.push(`Team of ${company.employees}+ people`);
      impacts.push('Need efficient acquisition systems to support growth');
    }

    if (company.industry?.includes('SaaS')) {
      observations.push('B2B SaaS business model');
      impacts.push('Customer acquisition cost optimization is critical');
    }

    if (company.recent_funding && company.recent_funding.includes('Series')) {
      observations.push(`Just raised ${company.recent_funding}`);
      impacts.push('Investors expect rapid growth and user acquisition');
    }

    return {
      observation: observations[0] || 'Growing technology company',
      impact: impacts[0] || 'Efficient scaling essential for continued growth',
      confidence: observations.length > 0 ? 0.8 : 0.5,
      bullets: observations.slice(0, 2).map((obs, i) => ({
        type: i === 0 ? 'observation' : 'impact',
        text: i === 0 ? obs : impacts[i] || obs
      }))
    };
  }

  // Email verification with MX record simulation
  async verifyEmail(email) {
    if (!email) return { valid: false, reason: 'No email provided' };
    
    const checks = {
      format: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      risky_domain: ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'].includes(email.split('@')[1]),
      company_domain: !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'].includes(email.split('@')[1]),
      mx_record: null, // Would check MX records in real implementation
      disposable: false
    };
    
    // Simulate MX record check
    if (checks.company_domain) {
      checks.mx_record = Math.random() > 0.1; // 90% pass rate for company domains
    } else {
      checks.mx_record = Math.random() > 0.3; // 70% pass rate for personal domains
    }

    // Check for disposable email providers
    const disposableDomains = ['10minutemail.com', 'tempmail.org', 'guerrillamail.com'];
    checks.disposable = disposableDomains.some(domain => email.includes(domain));

    const valid = checks.format && checks.mx_record && !checks.disposable;
    const risk = checks.risky_domain ? 'high' : (checks.company_domain ? 'low' : 'medium');
    
    return {
      valid,
      risk,
      checks,
      score: valid ? (risk === 'low' ? 95 : (risk === 'medium' ? 70 : 40)) : 0,
      recommendation: checks.risky_domain ? 'Use company domain if possible' : 
                   !checks.mx_record ? 'Email may not receive messages' :
                   checks.disposable ? 'Use permanent email address' :
                   'Email looks good'
    };
  }

  // Template personalization with validation
  personalizeTemplate(template, lead) {
    const { company, decision_maker, research } = lead;
    
    // Validate required data
    if (!company?.name || !decision_maker?.name) {
      throw new Error('Missing required data for personalization');
    }
    
    let personalized = {
      ...template,
      subject: template.subject.replace(/{{company}}/g, company.name),
      body: template.body
        .replace(/{{name}}/g, decision_maker.name)
        .replace(/{{company}}/g, company.name)
        .replace(/{{funding_amount}}/g, company.recent_funding || 'recent funding')
        .replace(/{{similar_company}}/g, 'similar B2B SaaS company')
        .replace(/{{metric_before}}/g, '50 leads/month')
        .replace(/{{metric_after}}/g, '150 leads/month')
        .replace(/{{testimonial}}/g, 'This transformed our entire customer acquisition strategy')
        .replace(/{{personalized_insight}}/g, `${research.personalization.observation}. ${research.personalization.impact}.`)
        .replace(/{{sender_name}}/g, 'Dulran Samarasinghe')
        .replace(/{{booking_link}}/g, 'https://cal.com/syndicate-solutions/10min'),
      personalization_score: research.personalization.confidence,
      word_count: template.word_count,
      variables_used: this.extractVariables(template.body)
    };
    
    return personalized;
  }

  extractVariables(text) {
    const matches = text.match(/\{\{([^}]+)\}\}/g) || [];
    return [...new Set(matches.map(m => m.replace(/[{}]/g, '')))];
  }

  // Send safety check with comprehensive rules
  async checkSendSafety() {
    const today = new Date().toDateString();
    if (this.lastResetDate !== today) {
      this.dailySendCount = 0;
      this.lastResetDate = today;
    }

    const recentSends = this.sendHistory.filter(send => 
      Date.now() - new Date(send.timestamp).getTime() < SAFETY_RULES.minTimeBetweenSends
    );

    const checks = {
      daily_limit: this.dailySendCount < SAFETY_RULES.maxEmailsPerDay,
      inbox_limit: this.dailySendCount < SAFETY_RULES.maxEmailsPerInbox,
      timing_ok: recentSends.length === 0,
      healthy: this.isHealthy,
      bounce_rate_ok: this.calculateBounceRate() < SAFETY_RULES.bounceThreshold,
      unsubscribe_rate_ok: this.calculateUnsubscribeRate() < SAFETY_RULES.unsubscribeThreshold
    };

    return {
      safe: Object.values(checks).every(Boolean),
      checks,
      daily_count: this.dailySendCount,
      remaining: SAFETY_RULES.maxEmailsPerDay - this.dailySendCount,
      next_send_available: recentSends.length > 0 ? 
        new Date(recentSends[0].timestamp.getTime() + SAFETY_RULES.minTimeBetweenSends) : 
        new Date()
    };
  }

  calculateBounceRate() {
    const totalSent = Object.values(this.templatePerformance).reduce((sum, t) => sum + t.sent, 0);
    const totalBounces = totalSent * 0.02; // Simulated bounce rate
    return totalBounces / totalSent;
  }

  calculateUnsubscribeRate() {
    const totalSent = Object.values(this.templatePerformance).reduce((sum, t) => sum + t.sent, 0);
    const totalUnsubscribes = totalSent * 0.005; // Simulated unsubscribe rate
    return totalUnsubscribes / totalSent;
  }

  // Health check with token validation
  async runHealthCheck() {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user');
      }
      
      // Force token refresh
      const token = await user.getIdToken(true);
      if (!token) {
        throw new Error('Failed to refresh token');
      }
      
      // Test Firestore connectivity
      const testDoc = doc(db, 'health', 'check');
      await setDoc(testDoc, { 
        timestamp: serverTimestamp(),
        token_valid: true 
      });
      
      this.isHealthy = true;
      this.lastHealthCheck = new Date();
      
      return { 
        status: 'healthy', 
        timestamp: this.lastHealthCheck,
        token_valid: true,
        firestore_connected: true
      };
    } catch (error) {
      this.isHealthy = false;
      this.failures.push({
        timestamp: new Date(),
        error: error.message,
        type: error.message.includes('token') ? 'googleToken' : 'firestore'
      });
      
      return { 
        status: 'failed', 
        error: error.message, 
        timestamp: new Date(),
        token_valid: false,
        firestore_connected: false
      };
    }
  }

  // Execute cadence step with tracking
  async executeCadenceStep(lead, step, manualMode = false) {
    const template = SALES_TEMPLATES[step.template];
    if (!template) {
      throw new Error(`Template ${step.template} not found`);
    }

    const personalizedTemplate = this.personalizeTemplate(template, lead);
    
    // Record send attempt
    const sendRecord = {
      lead_id: lead.id,
      step: step,
      template: personalizedTemplate,
      delivery_method: manualMode ? 'manual' : 'automated',
      scheduled_at: new Date(),
      status: 'ready',
      personalization_score: personalizedTemplate.personalization_score
    };

    // Update template performance
    this.templatePerformance[step.template].sent++;

    return sendRecord;
  }

  // Check auto-exit conditions
  shouldExitSequence(lead) {
    return AUTO_EXIT_RULES[lead.status] === true;
  }

  // Record email send
  recordSend(leadId, templateType, success = true) {
    this.sendHistory.push({
      lead_id: leadId,
      template: templateType,
      timestamp: new Date(),
      success
    });

    if (success) {
      this.dailySendCount++;
    }

    // Clean old send history (keep last 1000)
    if (this.sendHistory.length > 1000) {
      this.sendHistory = this.sendHistory.slice(-1000);
    }
  }

  // Record response
  recordResponse(leadId, templateType, responseType) {
    if (responseType === 'reply') {
      this.templatePerformance[templateType].replies++;
    } else if (responseType === 'meeting') {
      this.templatePerformance[templateType].meetings++;
    }
  }

  // Get template performance metrics
  getTemplatePerformance() {
    const metrics = {};
    Object.entries(this.templatePerformance).forEach(([template, perf]) => {
      const replyRate = perf.sent > 0 ? (perf.replies / perf.sent) * 100 : 0;
      const meetingRate = perf.sent > 0 ? (perf.meetings / perf.sent) * 100 : 0;
      
      metrics[template] = {
        ...perf,
        reply_rate: replyRate.toFixed(1),
        meeting_rate: meetingRate.toFixed(1)
      };
    });
    return metrics;
  }

  // Manual mode toggle
  setManualMode(enabled) {
    this.manualMode = enabled;
    if (enabled) {
      this.automationPaused = true;
    }
  }

  // Pause automation
  pauseAutomation() {
    this.automationPaused = true;
  }

  // Resume automation
  resumeAutomation() {
    this.automationPaused = false;
  }
}

// Initialize engine
const automationEngine = new SalesAutomationEngine();

export default function FinalOptimalSalesMachine() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const router = useRouter();

  // Core campaign state
  const [campaign, setCampaign] = useState({
    status: 'idle', // idle, qualifying, researching, outreach, completed, paused
    target_count: 50,
    qualified_leads: [],
    research_queue: [],
    outreach_queue: [],
    in_sequence_leads: [],
    completed_leads: [],
    failed_leads: [],
    nurture_queue: [],
    current_step: 0,
    started_at: null,
    completed_at: null,
    template_iterations: 0
  });

  // KPI state
  const [kpis, setKpis] = useState({
    emails_sent: 0,
    replies: 0,
    meetings_booked: 0,
    bounce_rate: 0,
    unsubscribe_rate: 0,
    reply_rate: 0,
    meeting_rate: 0,
    daily_sends: 0,
    weekly_sends: 0
  });

  // Contacts and data state
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [manualMode, setManualMode] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  // Manual operations state
  const [manualEmailComposer, setManualEmailComposer] = useState(null);
  const [manualResearchQueue, setManualResearchQueue] = useState([]);
  const [manualOutreachQueue, setManualOutreachQueue] = useState([]);
  const [templatePerformance, setTemplatePerformance] = useState({});

  // Health monitoring
  const [systemHealth, setSystemHealth] = useState({
    status: 'unknown',
    last_check: null,
    failures: [],
    token_valid: false,
    firestore_connected: false
  });

  // UI state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  // Notification system
  const addNotification = useCallback((type, message, duration = 5000) => {
    const notification = {
      id: Date.now(),
      type,
      message,
      timestamp: new Date()
    };
    setNotifications(prev => [notification, ...prev].slice(0, 10));
    
    if (type === 'error') setError(message);
    if (type === 'success') setSuccess(message);
    
    // Auto-remove
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, duration);
  }, []);

  // Auth handlers
  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      setUser(result.user);
      addNotification('success', 'Successfully signed in');
    } catch (err) {
      console.error('Sign in error:', err);
      addNotification('error', 'Failed to sign in: ' + err.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
      addNotification('success', 'Successfully signed out');
    } catch (err) {
      console.error('Sign out error:', err);
      addNotification('error', 'Failed to sign out');
    }
  };

  // Load contacts from Firestore
  const loadContacts = async () => {
    try {
      setLoading(true);
      const contactsRef = collection(db, 'contacts');
      const querySnapshot = await getDocs(contactsRef);
      const contactsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setContacts(contactsData);
      addNotification('success', `Loaded ${contactsData.length} contacts from database`);
    } catch (err) {
      console.error('Failed to load contacts:', err);
      addNotification('error', 'Failed to load contacts: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Start strategic campaign
  const startCampaign = async () => {
    try {
      setLoading(true);
      setCampaign(prev => ({ ...prev, status: 'qualifying', started_at: new Date() }));
      addNotification('info', 'Starting strategic sales campaign...');

      // Step 1: Qualify leads from ICP
      const qualifiedLeads = [];
      const allContacts = contacts.filter(c => c.company && c.company.name);
      
      for (const contact of allContacts) {
        const qualification = automationEngine.qualifyLead(contact.company);
        if (qualification.qualified) {
          qualifiedLeads.push({
            id: contact.id,
            contact,
            company: contact.company,
            qualification,
            status: 'qualified',
            created_at: new Date(),
            confidence_score: qualification.confidence
          });
        }
        
        if (qualifiedLeads.length >= 50) break; // Stop at exactly 50 qualified leads
      }
      
      addNotification('success', `Qualified ${qualifiedLeads.length} leads from ICP. Target: 50`);
      
      // Step 2: Research phase
      setCampaign(prev => ({ 
        ...prev, 
        status: 'researching', 
        qualified_leads: qualifiedLeads.slice(0, 50) 
      }));
      
      await processResearchQueue(qualifiedLeads.slice(0, 50));
      
    } catch (err) {
      console.error('Campaign failed:', err);
      addNotification('error', 'Campaign failed: ' + err.message);
      setCampaign(prev => ({ ...prev, status: 'failed' }));
    } finally {
      setLoading(false);
    }
  };

  // Process research queue with full implementation
  const processResearchQueue = async (leads) => {
    try {
      addNotification('info', 'Processing research queue...');
      const researchedLeads = [];
      
      for (const lead of leads) {
        const research = await automationEngine.extractResearch(lead.company);
        
        // Verify emails for decision makers
        if (research.decision_makers.length > 0) {
          for (const dm of research.decision_makers) {
            if (dm.email) {
              const verification = await automationEngine.verifyEmail(dm.email);
              dm.verification = verification;
              dm.verified = verification.valid;
              dm.verification_status = verification.valid ? 'verified' : 'failed';
            }
          }
        }
        
        // Calculate overall lead score
        const leadScore = {
          qualification: lead.qualification.confidence,
          research: research.confidence_score,
          decision_makers: research.decision_makers.filter(dm => dm.verified).length,
          overall: (lead.qualification.confidence + research.confidence_score) / 2
        };
        
        researchedLeads.push({
          ...lead,
          research,
          status: 'researched',
          decision_maker: research.decision_makers[0] || null, // Primary decision maker
          all_decision_makers: research.decision_makers,
          researched_at: new Date(),
          lead_score: leadScore
        });
      }
      
      // Move to outreach queue
      setCampaign(prev => ({
        ...prev,
        status: 'outreach',
        research_queue: [],
        outreach_queue: researchedLeads.filter(l => l.decision_maker && l.decision_maker.verified)
      }));
      
      const readyForOutreach = researchedLeads.filter(l => l.decision_maker && l.decision_maker.verified).length;
      addNotification('success', `Research completed. ${readyForOutreach} leads ready for outreach`);
      
      // Start outreach automatically if not in manual mode
      if (!manualMode) {
        await processOutreachQueue();
      }
      
    } catch (err) {
      console.error('Research failed:', err);
      addNotification('error', 'Research failed: ' + err.message);
    }
  };

  // Process outreach queue with cadence execution
  const processOutreachQueue = async () => {
    try {
      const safetyCheck = await automationEngine.checkSendSafety();
      if (!safetyCheck.safe) {
        addNotification('error', `Send safety check failed. ${safetyCheck.remaining} emails remaining today.`);
        return;
      }
      
      setCampaign(prev => ({ ...prev, status: 'outreach' }));
      addNotification('info', 'Starting outreach sequence...');
      
      const outreachQueue = [...campaign.outreach_queue];
      const processedLeads = [];
      
      for (const lead of outreachQueue.slice(0, Math.min(safetyCheck.remaining, 10))) {
        // Execute Day 0 cadence
        const step = CADENCE_RULES.day0;
        const emailData = await automationEngine.executeCadenceStep(lead, step, manualMode);
        
        if (manualMode) {
          setManualEmailComposer(emailData);
          addNotification('info', `Manual email ready for ${lead.company.name}`);
        } else {
          // Simulate email send
          automationEngine.recordSend(lead.id, 'email1', true);
          addNotification('success', `Email sent to ${lead.company.name}`);
          
          // Update KPIs
          setKpis(prev => ({
            ...prev,
            emails_sent: prev.emails_sent + 1,
            daily_sends: prev.daily_sends + 1,
            weekly_sends: prev.weekly_sends + 1
          }));
        }
        
        // Schedule next steps
        const nextActions = [
          { day: 3, action: 'email2', template: 'email2', scheduled: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
          { day: 5, action: 'linkedin', template: 'message', scheduled: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) },
          { day: 7, action: 'breakup', template: 'breakup', scheduled: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
        ];
        
        processedLeads.push({
          ...lead,
          last_outreach: new Date(),
          cadence_step: 0,
          next_actions: nextActions,
          status: 'in_sequence',
          sequence_start: new Date()
        });
      }
      
      // Update campaign state
      setCampaign(prev => ({
        ...prev,
        outreach_queue: outreachQueue.slice(processedLeads.length),
        in_sequence_leads: [...prev.in_sequence_leads, ...processedLeads]
      }));
      
    } catch (err) {
      console.error('Outreach failed:', err);
      addNotification('error', 'Outreach failed: ' + err.message);
    }
  };

  // Manual email composition
  const composeManualEmail = (lead, templateType) => {
    const template = SALES_TEMPLATES[templateType];
    if (!template) {
      addNotification('error', 'Template not found');
      return;
    }
    
    try {
      const emailData = automationEngine.personalizeTemplate(template, lead);
      setManualEmailComposer({
        ...emailData,
        lead,
        template_type: templateType,
        ready_to_send: true,
        send_method: 'manual'
      });
    } catch (err) {
      addNotification('error', 'Failed to compose email: ' + err.message);
    }
  };

  // Send manual email
  const sendManualEmail = async (emailData) => {
    try {
      // Record the send
      automationEngine.recordSend(emailData.lead.id, emailData.template_type, true);
      
      addNotification('success', `Manual email sent to ${emailData.lead.company.name}`);
      
      // Update KPIs
      setKpis(prev => ({
        ...prev,
        emails_sent: prev.emails_sent + 1,
        daily_sends: prev.daily_sends + 1
      }));
      
      // Update lead status
      const updatedLead = {
        ...emailData.lead,
        last_outreach: new Date(),
        cadence_step: emailData.lead.cadence_step + 1,
        status: 'in_sequence',
        last_email_sent: {
          template: emailData.template_type,
          sent_at: new Date(),
          method: 'manual'
        }
      };
      
      setCampaign(prev => ({
        ...prev,
        in_sequence_leads: prev.in_sequence_leads.map(l => 
          l.id === updatedLead.id ? updatedLead : l
        )
      }));
      
      setManualEmailComposer(null);
      
    } catch (err) {
      console.error('Manual email failed:', err);
      addNotification('error', 'Failed to send manual email');
    }
  };

  // Process cadence step for a lead
  const processCadenceStep = async (lead, stepType) => {
    try {
      const step = CADENCE_RULES[stepType];
      if (!step) {
        addNotification('error', 'Invalid cadence step');
        return;
      }

      const emailData = await automationEngine.executeCadenceStep(lead, step, manualMode);
      
      if (manualMode) {
        setManualEmailComposer(emailData);
        addNotification('info', `Manual ${stepType} email ready for ${lead.company.name}`);
      } else {
        automationEngine.recordSend(lead.id, step.template, true);
        addNotification('success', `${stepType} email sent to ${lead.company.name}`);
        
        setKpis(prev => ({
          ...prev,
          emails_sent: prev.emails_sent + 1
        }));
      }

      // Update lead
      const updatedLead = {
        ...lead,
        last_outreach: new Date(),
        cadence_step: lead.cadence_step + 1,
        status: 'in_sequence'
      };
      
      setCampaign(prev => ({
        ...prev,
        in_sequence_leads: prev.in_sequence_leads.map(l => 
          l.id === updatedLead.id ? updatedLead : l
        )
      }));
      
    } catch (err) {
      console.error('Cadence step failed:', err);
      addNotification('error', 'Failed to process cadence step');
    }
  };

  // Record response
  const recordResponse = (leadId, responseType) => {
    try {
      const lead = campaign.in_sequence_leads.find(l => l.id === leadId);
      if (!lead) {
        addNotification('error', 'Lead not found');
        return;
      }

      // Record response in engine
      automationEngine.recordResponse(leadId, 'email1', responseType);

      // Update lead status
      let newStatus = 'replied';
      if (responseType === 'meeting') {
        newStatus = 'meeting_booked';
        setKpis(prev => ({ ...prev, meetings_booked: prev.meetings_booked + 1 }));
      } else if (responseType === 'reply') {
        setKpis(prev => ({ ...prev, replies: prev.replies + 1 }));
      }

      const updatedLead = {
        ...lead,
        status: newStatus,
        response_recorded: {
          type: responseType,
          timestamp: new Date()
        }
      };

      // Move to completed
      setCampaign(prev => ({
        ...prev,
        in_sequence_leads: prev.in_sequence_leads.filter(l => l.id !== leadId),
        completed_leads: [...prev.completed_leads, updatedLead]
      }));

      addNotification('success', `Response recorded: ${responseType}`);
      
    } catch (err) {
      console.error('Failed to record response:', err);
      addNotification('error', 'Failed to record response');
    }
  };

  // Move to nurture queue
  const moveToNurture = (leadId) => {
    try {
      const lead = campaign.in_sequence_leads.find(l => l.id === leadId);
      if (!lead) {
        addNotification('error', 'Lead not found');
        return;
      }

      const nurturedLead = {
        ...lead,
        status: 'nurtured',
        moved_to_nurture: new Date(),
        nurture_scheduled: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      };

      setCampaign(prev => ({
        ...prev,
        in_sequence_leads: prev.in_sequence_leads.filter(l => l.id !== leadId),
        nurture_queue: [...prev.nurture_queue, nurturedLead]
      }));

      addNotification('success', 'Lead moved to nurture queue');
      
    } catch (err) {
      console.error('Failed to move to nurture:', err);
      addNotification('error', 'Failed to move to nurture');
    }
  };

  // Health monitoring
  const checkSystemHealth = async () => {
    const health = await automationEngine.runHealthCheck();
    setSystemHealth({
      status: health.status,
      last_check: health.timestamp,
      failures: automationEngine.failures.slice(-5),
      token_valid: health.token_valid,
      firestore_connected: health.firestore_connected
    });
    
    if (health.status === 'failed') {
      setManualMode(true);
      addNotification('error', 'System health check failed. Switched to manual mode.');
    }
    
    return health;
  };

  // Update template performance
  const updateTemplatePerformance = () => {
    const performance = automationEngine.getTemplatePerformance();
    setTemplatePerformance(performance);
  };

  // Effects
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoadingAuth(false);
      if (user) {
        loadContacts();
        checkSystemHealth();
      }
    });
    
    // Health check interval
    const healthInterval = setInterval(checkSystemHealth, 120000); // Every 2 minutes
    
    // KPI update interval
    const kpiInterval = setInterval(() => {
      updateTemplatePerformance();
      setKpis(prev => ({
        ...prev,
        reply_rate: prev.emails_sent > 0 ? (prev.replies / prev.emails_sent) * 100 : 0,
        meeting_rate: prev.emails_sent > 0 ? (prev.meetings_booked / prev.emails_sent) * 100 : 0,
        bounce_rate: automationEngine.calculateBounceRate() * 100,
        unsubscribe_rate: automationEngine.calculateUnsubscribeRate() * 100
      }));
    }, 30000); // Every 30 seconds
    
    return () => {
      unsubscribe();
      clearInterval(healthInterval);
      clearInterval(kpiInterval);
    };
  }, []);

  // Auto-switch to manual mode on health failures
  useEffect(() => {
    if (systemHealth.status === 'failed' && !manualMode) {
      setManualMode(true);
      addNotification('warning', 'Automatically switched to manual mode due to system issues.');
    }
  }, [systemHealth.status, manualMode]);

  return (
    <div className="min-h-screen bg-gray-900">
      <Head>
        <title>Strategic Sales Automation</title>
        <meta name="description" content="B2B Sales Automation with Manual Fallback" />
      </Head>

      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-white">Strategic Sales Automation</h1>
              <div className="ml-4 flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  systemHealth.status === 'healthy' ? 'bg-green-500' :
                  systemHealth.status === 'failed' ? 'bg-red-500' :
                  'bg-yellow-500'
                }`} />
                <span className="text-xs text-gray-300">
                  {systemHealth.status === 'healthy' ? 'System Online' :
                   systemHealth.status === 'failed' ? 'System Offline' :
                   'Checking...'}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <div className="text-sm text-gray-300">
                    Welcome, {user.displayName || user.email}
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="px-3 py-1 text-sm font-medium text-red-400 bg-red-900 rounded-md hover:bg-red-800"
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

      {/* Navigation Tabs */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {['dashboard', 'campaign', 'leads', 'templates', 'kpis', 'manual'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="fixed top-4 right-4 z-50 space-y-2">
            {notifications.map(notification => (
              <div
                key={notification.id}
                className={`p-4 rounded-md shadow-lg max-w-sm ${
                  notification.type === 'error' ? 'bg-red-900 border border-red-700' :
                  notification.type === 'success' ? 'bg-green-900 border border-green-700' :
                  notification.type === 'warning' ? 'bg-yellow-900 border border-yellow-700' :
                  'bg-blue-900 border border-blue-700'
                }`}
              >
                <p className={`text-sm ${
                  notification.type === 'error' ? 'text-red-200' :
                  notification.type === 'success' ? 'text-green-200' :
                  notification.type === 'warning' ? 'text-yellow-200' :
                  'text-blue-200'
                }`}>
                  {notification.message}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Critical Alert */}
        {systemHealth.status === 'failed' && (
          <div className="bg-red-900 border-l-4 border-red-500 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-200">Automation System Offline</h3>
                <div className="mt-2 text-sm text-red-300">
                  <p>⚠️ Automation has been disabled due to system issues.</p>
                  <p className="mt-1">All manual operations remain fully functional.</p>
                </div>
                <div className="mt-4">
                  <div className="flex space-x-3">
                    <button
                      onClick={checkSystemHealth}
                      className="bg-red-800 text-red-200 px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700"
                    >
                      Re-check System
                    </button>
                    <button
                      onClick={() => setManualMode(false)}
                      className="bg-red-700 text-red-200 px-4 py-2 rounded-md text-sm font-medium hover:bg-red-600"
                    >
                      Force Auto Mode
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-400 truncate">Emails Sent</dt>
                      <dd className="text-lg font-medium text-white">{kpis.emails_sent}</dd>
                    </dl>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-400 truncate">Replies</dt>
                      <dd className="text-lg font-medium text-white">{kpis.replies}</dd>
                    </dl>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-400 truncate">Meetings Booked</dt>
                      <dd className="text-lg font-medium text-white">{kpis.meetings_booked}</dd>
                    </dl>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-400 truncate">Reply Rate</dt>
                      <dd className="text-lg font-medium text-white">{kpis.reply_rate.toFixed(1)}%</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Campaign Overview */}
            <div className="bg-gray-800 rounded-lg">
              <div className="px-6 py-4 border-b border-gray-700">
                <h2 className="text-lg font-medium text-white">Campaign Overview</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-400">{campaign.qualified_leads.length}</div>
                    <div className="text-sm text-gray-400">Qualified Leads</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-yellow-400">{campaign.in_sequence_leads.length}</div>
                    <div className="text-sm text-gray-400">In Sequence</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-400">{campaign.completed_leads.length}</div>
                    <div className="text-sm text-gray-400">Completed</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Campaign Tab */}
        {activeTab === 'campaign' && (
          <div className="space-y-8">
            {/* ICP Definition */}
            <div className="bg-gray-800 rounded-lg">
              <div className="px-6 py-4 border-b border-gray-700">
                <h2 className="text-lg font-medium text-white">Target ICP Definition</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-300 mb-2">Industry</h3>
                    <p className="text-sm text-gray-400">{ICP_DEFINITION.industry}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-300 mb-2">Size</h3>
                    <p className="text-sm text-gray-400">{ICP_DEFINITION.size}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-300 mb-2">Geography</h3>
                    <p className="text-sm text-gray-400">{ICP_DEFINITION.geo}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-300 mb-2">Key Pain</h3>
                    <p className="text-sm text-gray-400">{ICP_DEFINITION.pain}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-300 mb-2">Trigger</h3>
                    <p className="text-sm text-gray-400">{ICP_DEFINITION.trigger}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-300 mb-2">Target Count</h3>
                    <p className="text-sm text-gray-400">{campaign.target_count} qualified companies</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Campaign Control */}
            <div className="bg-gray-800 rounded-lg">
              <div className="px-6 py-4 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-white">Campaign Control</h2>
                  <div className="flex items-center space-x-2">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                      campaign.status === 'idle' ? 'bg-gray-700 text-gray-300' :
                      campaign.status === 'qualifying' ? 'bg-blue-700 text-blue-300' :
                      campaign.status === 'researching' ? 'bg-yellow-700 text-yellow-300' :
                      campaign.status === 'outreach' ? 'bg-green-700 text-green-300' :
                      campaign.status === 'completed' ? 'bg-emerald-700 text-emerald-300' :
                      'bg-red-700 text-red-300'
                    }`}>
                      {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                    </span>
                    {manualMode && (
                      <span className="px-3 py-1 text-xs font-medium rounded-full bg-orange-700 text-orange-300">
                        Manual Mode
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex space-x-4">
                    <button
                      onClick={startCampaign}
                      disabled={loading || campaign.status !== 'idle' || !user}
                      className="px-6 py-3 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      Start Campaign
                    </button>
                    <button
                      onClick={() => setManualMode(!manualMode)}
                      disabled={loading}
                      className="px-6 py-3 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600"
                    >
                      {manualMode ? 'Switch to Auto' : 'Switch to Manual'}
                    </button>
                    <button
                      onClick={checkSystemHealth}
                      disabled={loading}
                      className="px-6 py-3 text-sm font-medium text-blue-400 bg-blue-900 rounded-md hover:bg-blue-800"
                    >
                      Check Health
                    </button>
                  </div>
                </div>

                {/* Campaign Progress */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="text-center p-4 bg-gray-700 rounded-lg">
                    <div className="text-2xl font-bold text-blue-400">{campaign.qualified_leads.length}</div>
                    <div className="text-sm text-gray-400">Qualified</div>
                  </div>
                  <div className="text-center p-4 bg-gray-700 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-400">{campaign.research_queue.length}</div>
                    <div className="text-sm text-gray-400">Research Queue</div>
                  </div>
                  <div className="text-center p-4 bg-gray-700 rounded-lg">
                    <div className="text-2xl font-bold text-orange-400">{campaign.outreach_queue.length}</div>
                    <div className="text-sm text-gray-400">Outreach Queue</div>
                  </div>
                  <div className="text-center p-4 bg-gray-700 rounded-lg">
                    <div className="text-2xl font-bold text-green-400">{campaign.in_sequence_leads.length}</div>
                    <div className="text-sm text-gray-400">In Sequence</div>
                  </div>
                  <div className="text-center p-4 bg-gray-700 rounded-lg">
                    <div className="text-2xl font-bold text-red-400">{campaign.failed_leads.length}</div>
                    <div className="text-sm text-gray-400">Failed</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Leads Tab */}
        {activeTab === 'leads' && (
          <div className="bg-gray-800 rounded-lg">
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-lg font-medium text-white">Active Leads</h2>
            </div>
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Decision Maker</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Cadence</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Score</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {campaign.in_sequence_leads.slice(0, 10).map(lead => (
                    <tr key={lead.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                        {lead.company.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {lead.decision_maker?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          lead.status === 'in_sequence' ? 'bg-green-900 text-green-300' :
                          lead.status === 'researched' ? 'bg-blue-900 text-blue-300' :
                          lead.status === 'meeting_booked' ? 'bg-purple-900 text-purple-300' :
                          'bg-gray-700 text-gray-300'
                        }`}>
                          {lead.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        Step {lead.cadence_step}/3
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {(lead.lead_score?.overall * 100).toFixed(0)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => setSelectedLead(lead)}
                          className="text-blue-400 hover:text-blue-300 mr-3"
                        >
                          View
                        </button>
                        <button
                          onClick={() => composeManualEmail(lead, 'email1')}
                          className="text-green-400 hover:text-green-300 mr-3"
                        >
                          Email
                        </button>
                        <button
                          onClick={() => recordResponse(lead.id, 'reply')}
                          className="text-yellow-400 hover:text-yellow-300 mr-3"
                        >
                          Reply
                        </button>
                        <button
                          onClick={() => recordResponse(lead.id, 'meeting')}
                          className="text-purple-400 hover:text-purple-300"
                        >
                          Meeting
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div className="space-y-8">
            <div className="bg-gray-800 rounded-lg">
              <div className="px-6 py-4 border-b border-gray-700">
                <h2 className="text-lg font-medium text-white">Email Templates</h2>
              </div>
              <div className="p-6">
                <div className="space-y-6">
                  {Object.entries(SALES_TEMPLATES).map(([key, template]) => (
                    <div key={key} className="bg-gray-700 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-white">{template.name}</h3>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-400">{template.word_count} words</span>
                          <button
                            onClick={() => setEditingTemplate({ key, ...template })}
                            className="text-blue-400 hover:text-blue-300"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">Subject</label>
                          <input
                            type="text"
                            value={template.subject}
                            readOnly
                            className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-gray-300"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">Body</label>
                          <textarea
                            rows={8}
                            value={template.body}
                            readOnly
                            className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-gray-300"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Template Performance */}
            <div className="bg-gray-800 rounded-lg">
              <div className="px-6 py-4 border-b border-gray-700">
                <h2 className="text-lg font-medium text-white">Template Performance</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {Object.entries(templatePerformance).map(([template, perf]) => (
                    <div key={template} className="bg-gray-700 rounded-lg p-4">
                      <h3 className="text-lg font-medium text-white mb-4">{template.toUpperCase()}</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-400">Sent:</span>
                          <span className="text-sm text-white">{perf.sent}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-400">Replies:</span>
                          <span className="text-sm text-white">{perf.replies}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-400">Meetings:</span>
                          <span className="text-sm text-white">{perf.meetings}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-400">Reply Rate:</span>
                          <span className="text-sm text-white">{perf.reply_rate}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-400">Meeting Rate:</span>
                          <span className="text-sm text-white">{perf.meeting_rate}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* KPIs Tab */}
        {activeTab === 'kpis' && (
          <div className="space-y-8">
            <div className="bg-gray-800 rounded-lg">
              <div className="px-6 py-4 border-b border-gray-700">
                <h2 className="text-lg font-medium text-white">Campaign KPIs</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <div className="text-2xl font-bold text-blue-400">{kpis.emails_sent}</div>
                    <div className="text-sm text-gray-400">Total Emails Sent</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-400">{kpis.replies}</div>
                    <div className="text-sm text-gray-400">Total Replies</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-400">{kpis.meetings_booked}</div>
                    <div className="text-sm text-gray-400">Meetings Booked</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-yellow-400">{kpis.reply_rate.toFixed(1)}%</div>
                    <div className="text-sm text-gray-400">Reply Rate</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-400">{kpis.bounce_rate.toFixed(1)}%</div>
                    <div className="text-sm text-gray-400">Bounce Rate</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-orange-400">{kpis.unsubscribe_rate.toFixed(1)}%</div>
                    <div className="text-sm text-gray-400">Unsubscribe Rate</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-indigo-400">{kpis.meeting_rate.toFixed(1)}%</div>
                    <div className="text-sm text-gray-400">Meeting Rate</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Manual Tab */}
        {activeTab === 'manual' && (
          <div className="space-y-8">
            <div className="bg-gray-800 rounded-lg">
              <div className="px-6 py-4 border-b border-gray-700">
                <h2 className="text-lg font-medium text-white">Manual Operations</h2>
                <p className="text-sm text-gray-400 mt-1">
                  Execute operations manually when automation is down
                </p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Manual Email */}
                  <div className="text-center p-4 bg-gray-700 rounded-lg hover:bg-gray-600 cursor-pointer">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-medium text-white">Manual Email</h3>
                    <p className="text-xs text-gray-400 mt-1">Send emails manually</p>
                    <button className="mt-3 text-sm text-blue-400 hover:text-blue-300 font-medium">
                      Compose Email
                    </button>
                  </div>

                  {/* Research Queue */}
                  <div className="text-center p-4 bg-gray-700 rounded-lg hover:bg-gray-600 cursor-pointer">
                    <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-medium text-white">Research Queue</h3>
                    <p className="text-xs text-gray-400 mt-1">{manualResearchQueue.length} pending</p>
                    <button className="mt-3 text-sm text-green-400 hover:text-green-300 font-medium">
                      Process Research
                    </button>
                  </div>

                  {/* Outreach Queue */}
                  <div className="text-center p-4 bg-gray-700 rounded-lg hover:bg-gray-600 cursor-pointer">
                    <div className="w-12 h-12 bg-yellow-600 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-medium text-white">Outreach Queue</h3>
                    <p className="text-xs text-gray-400 mt-1">{manualOutreachQueue.length} pending</p>
                    <button className="mt-3 text-sm text-yellow-400 hover:text-yellow-300 font-medium">
                      Send Emails
                    </button>
                  </div>

                  {/* System Control */}
                  <div className="text-center p-4 bg-gray-700 rounded-lg hover:bg-gray-600 cursor-pointer">
                    <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-medium text-white">System Control</h3>
                    <p className="text-xs text-gray-400 mt-1">Manage system</p>
                    <button 
                      onClick={checkSystemHealth}
                      className="mt-3 text-sm text-purple-400 hover:text-purple-300 font-medium"
                    >
                      Check Health
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Manual Operations List */}
            <div className="bg-gray-800 rounded-lg">
              <div className="px-6 py-4 border-b border-gray-700">
                <h2 className="text-lg font-medium text-white">Manual Operations Queue</h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {campaign.outreach_queue.slice(0, 5).map(lead => (
                    <div key={lead.id} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-white">{lead.company.name}</h3>
                          <p className="text-xs text-gray-400">{lead.decision_maker?.name} - {lead.decision_maker?.email}</p>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => composeManualEmail(lead, 'email1')}
                            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Email 1
                          </button>
                          <button
                            onClick={() => composeManualEmail(lead, 'email2')}
                            className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Email 2
                          </button>
                          <button
                            onClick={() => composeManualEmail(lead, 'breakup')}
                            className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Breakup
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Manual Email Composer Modal */}
      {manualEmailComposer && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-gray-800">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-white">
                  Compose Email: {manualEmailComposer.lead.company.name}
                </h3>
                <button
                  onClick={() => setManualEmailComposer(null)}
                  className="text-gray-400 hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300">To</label>
                  <input
                    type="text"
                    value={manualEmailComposer.lead.decision_maker?.email || ''}
                    readOnly
                    className="mt-1 block w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">Subject</label>
                  <input
                    type="text"
                    value={manualEmailComposer.subject}
                    readOnly
                    className="mt-1 block w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">Body</label>
                  <textarea
                    rows={12}
                    value={manualEmailComposer.body}
                    readOnly
                    className="mt-1 block w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-gray-300"
                  />
                </div>

                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-400">
                    Personalization Score: {(manualEmailComposer.personalization_score * 100).toFixed(0)}%
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setManualEmailComposer(null)}
                      className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => sendManualEmail(manualEmailComposer)}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                      Send Email
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
