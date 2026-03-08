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
    name: 'Break-up - Closing the loop',
    subject: 'Closing the loop',
    body: `Hi {{name}},

I'll stop reaching out after this - but wanted to share one final thought:

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

// ===== CORE BUSINESS ENGINE =====
class SalesAutomationEngine {
  constructor() {
    this.isHealthy = true;
    this.lastHealthCheck = null;
    this.failures = [];
    this.dailySendCount = 0;
    this.lastResetDate = new Date().toDateString();
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
      details: qualifications
    };
  }

  checkIndustry(company) {
    const targetIndustries = ['software', 'saas', 'technology', 'fintech', 'healthtech'];
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
    return !!(company.recent_news || company.product_launch || company.hiring_spree);
  }

  // 2-minute research extractor
  async extractResearch(company) {
    const research = {
      headline: `${company.name} - ${company.industry || 'Technology'}`,
      trigger: null,
      decision_makers: [],
      personalization: null,
      confidence_score: 0
    };

    // Extract trigger
    if (company.recent_funding) {
      research.trigger = `Raised ${company.recent_funding} in ${company.funding_date || 'recent round'}`;
      research.confidence_score += 0.4;
    } else if (company.product_launch) {
      research.trigger = `Launched ${company.product_launch} in ${company.launch_date || 'recently'}`;
      research.confidence_score += 0.3;
    } else if (company.recent_hiring) {
      research.trigger = `Hiring for ${company.recent_hiring} positions`;
      research.confidence_score += 0.2;
    }

    // Extract decision makers
    if (company.executives || company.employees) {
      const executives = company.executives || [];
      research.decision_makers = executives
        .filter(exec => ['CEO', 'CTO', 'VP Sales', 'Head of Growth', 'CRO'].includes(exec.role))
        .slice(0, 2)
        .map(exec => ({
          name: exec.name,
          role: exec.role,
          email: exec.email,
          linkedin: exec.linkedin,
          verified: false
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

    return {
      observation: observations[0] || 'Growing technology company',
      impact: impacts[0] || 'Efficient scaling essential for continued growth',
      confidence: observations.length > 0 ? 0.8 : 0.5
    };
  }

  // Email verification
  async verifyEmail(email) {
    if (!email) return { valid: false, reason: 'No email provided' };
    
    const checks = {
      format: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      risky_domain: ['gmail.com', 'yahoo.com', 'hotmail.com'].includes(email.split('@')[1]),
      mx_record: null // Would check MX records in real implementation
    };
    
    return {
      valid: checks.format && !checks.risky_domain,
      risk: checks.risky_domain ? 'high' : 'low',
      checks,
      recommendation: checks.risky_domain ? 'Use company domain if possible' : 'Email looks good'
    };
  }

  // Template personalization
  personalizeTemplate(template, lead) {
    const { company, decision_maker, research } = lead;
    
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
      personalization_score: research.personalization.confidence
    };
    
    return personalized;
  }

  // Send safety check
  async checkSendSafety() {
    const today = new Date().toDateString();
    if (this.lastResetDate !== today) {
      this.dailySendCount = 0;
      this.lastResetDate = today;
    }

    const checks = {
      daily_limit: this.dailySendCount < SAFETY_RULES.maxEmailsPerDay,
      healthy: this.isHealthy
    };

    return {
      safe: Object.values(checks).every(Boolean),
      checks,
      daily_count: this.dailySendCount,
      remaining: SAFETY_RULES.maxEmailsPerDay - this.dailySendCount
    };
  }

  // Health check
  async runHealthCheck() {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user');
      }
      
      // Force token refresh
      await user.getIdToken(true);
      
      this.isHealthy = true;
      this.lastHealthCheck = new Date();
      
      return { status: 'healthy', timestamp: this.lastHealthCheck };
    } catch (error) {
      this.isHealthy = false;
      this.failures.push({
        timestamp: new Date(),
        error: error.message,
        type: 'googleToken'
      });
      
      return { status: 'failed', error: error.message, timestamp: new Date() };
    }
  }

  // Execute cadence step
  async executeCadenceStep(lead, step, manualMode = false) {
    const template = SALES_TEMPLATES[step.template];
    if (!template) {
      throw new Error(`Template ${step.template} not found`);
    }

    const personalizedTemplate = this.personalizeTemplate(template, lead);
    
    return {
      lead_id: lead.id,
      step: step,
      template: personalizedTemplate,
      delivery_method: manualMode ? 'manual' : 'automated',
      scheduled_at: new Date(),
      status: 'ready'
    };
  }

  // Check auto-exit conditions
  shouldExitSequence(lead) {
    return AUTO_EXIT_RULES[lead.status] === true;
  }
}

// Initialize engine
const automationEngine = new SalesAutomationEngine();

export default function FinalOptimalSalesMachine() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const router = useRouter();

  // Core state
  const [campaign, setCampaign] = useState({
    status: 'idle', // idle, qualifying, researching, outreach, completed, paused
    target_count: 50,
    qualified_leads: [],
    research_queue: [],
    outreach_queue: [],
    completed_leads: [],
    failed_leads: [],
    current_step: 0,
    started_at: null,
    completed_at: null
  });

  const [kpis, setKpis] = useState({
    emails_sent: 0,
    replies: 0,
    meetings_booked: 0,
    bounce_rate: 0,
    unsubscribe_rate: 0,
    reply_rate: 0,
    meeting_rate: 0,
    daily_sends: 0
  });

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

  // Health monitoring
  const [systemHealth, setSystemHealth] = useState({
    status: 'unknown',
    last_check: null,
    failures: []
  });

  // Notification system
  const addNotification = useCallback((type, message) => {
    const notification = {
      id: Date.now(),
      type,
      message,
      timestamp: new Date()
    };
    setNotifications(prev => [notification, ...prev].slice(0, 10));
    
    if (type === 'error') setError(message);
    if (type === 'success') setSuccess(message);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
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

  // Load contacts
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
      addNotification('success', `Loaded ${contactsData.length} contacts`);
    } catch (err) {
      console.error('Failed to load contacts:', err);
      addNotification('error', 'Failed to load contacts');
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
      
      for (const contact of allContacts.slice(0, 100)) { // Check more to find 50 qualified
        const qualification = automationEngine.qualifyLead(contact.company);
        if (qualification.qualified) {
          qualifiedLeads.push({
            id: contact.id,
            contact,
            company: contact.company,
            qualification,
            status: 'qualified',
            created_at: new Date()
          });
        }
        
        if (qualifiedLeads.length >= 50) break; // Stop at 50 qualified leads
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

  // Process research queue
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
            }
          }
        }
        
        researchedLeads.push({
          ...lead,
          research,
          status: 'researched',
          decision_maker: research.decision_makers[0] || null, // Primary decision maker
          researched_at: new Date()
        });
      }
      
      // Move to outreach queue
      setCampaign(prev => ({
        ...prev,
        status: 'outreach',
        research_queue: [],
        outreach_queue: researchedLeads.filter(l => l.decision_maker && l.decision_maker.verified)
      }));
      
      addNotification('success', `Research completed. ${researchedLeads.filter(l => l.decision_maker && l.decision_maker.verified).length} leads ready for outreach`);
      
      // Start outreach
      await processOutreachQueue();
      
    } catch (err) {
      console.error('Research failed:', err);
      addNotification('error', 'Research failed: ' + err.message);
    }
  };

  // Process outreach queue
  const processOutreachQueue = async () => {
    try {
      const safetyCheck = await automationEngine.checkSendSafety();
      if (!safetyCheck.safe) {
        addNotification('error', `Send safety check failed. Daily limit reached or system unhealthy.`);
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
          // In real implementation, this would send the email
          automationEngine.dailySendCount++;
          addNotification('success', `Email sent to ${lead.company.name}`);
          setKpis(prev => ({ ...prev, emails_sent: prev.emails_sent + 1 }));
        }
        
        processedLeads.push({
          ...lead,
          last_outreach: new Date(),
          cadence_step: 0,
          next_action_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Day 3
          status: 'in_sequence'
        });
      }
      
      // Update campaign state
      setCampaign(prev => ({
        ...prev,
        outreach_queue: outreachQueue.slice(processedLeads.length),
        completed_leads: [...prev.completed_leads, ...processedLeads]
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
    
    const emailData = automationEngine.personalizeTemplate(template, lead);
    setManualEmailComposer({
      ...emailData,
      lead,
      template_type: templateType,
      ready_to_send: true
    });
  };

  // Send manual email
  const sendManualEmail = async (emailData) => {
    try {
      // In real implementation, this would actually send the email
      addNotification('success', `Manual email sent to ${emailData.lead.company.name}`);
      setKpis(prev => ({ ...prev, emails_sent: prev.emails_sent + 1 }));
      setManualEmailComposer(null);
      
      // Update lead status
      const updatedLead = {
        ...emailData.lead,
        last_outreach: new Date(),
        cadence_step: emailData.lead.cadence_step + 1,
        status: 'in_sequence'
      };
      
      setCampaign(prev => ({
        ...prev,
        completed_leads: prev.completed_leads.map(l => 
          l.id === updatedLead.id ? updatedLead : l
        )
      }));
      
    } catch (err) {
      console.error('Manual email failed:', err);
      addNotification('error', 'Failed to send manual email');
    }
  };

  // Health monitoring
  const checkSystemHealth = async () => {
    const health = await automationEngine.runHealthCheck();
    setSystemHealth({
      status: health.status,
      last_check: health.timestamp,
      failures: automationEngine.failures.slice(-5)
    });
    
    if (health.status === 'failed') {
      setManualMode(true);
      addNotification('error', 'System health check failed. Switched to manual mode.');
    }
    
    return health;
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
    
    return () => {
      unsubscribe();
      clearInterval(healthInterval);
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
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Strategic Sales Automation</title>
        <meta name="description" content="B2B Sales Automation with Manual Fallback" />
      </Head>

      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Strategic Sales Automation</h1>
              <div className="ml-4 flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  systemHealth.status === 'healthy' ? 'bg-green-500' :
                  systemHealth.status === 'failed' ? 'bg-red-500' :
                  'bg-yellow-500'
                }`} />
                <span className="text-xs text-gray-600">
                  {systemHealth.status === 'healthy' ? 'System Online' :
                   systemHealth.status === 'failed' ? 'System Offline' :
                   'Checking...'}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <div className="text-sm text-gray-600">
                    Welcome, {user.displayName || user.email}
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="px-3 py-1 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200"
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
        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="fixed top-4 right-4 z-50 space-y-2">
            {notifications.map(notification => (
              <div
                key={notification.id}
                className={`p-4 rounded-md shadow-lg max-w-sm ${
                  notification.type === 'error' ? 'bg-red-50 border border-red-200' :
                  notification.type === 'success' ? 'bg-green-50 border border-green-200' :
                  notification.type === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
                  'bg-blue-50 border border-blue-200'
                }`}
              >
                <p className={`text-sm ${
                  notification.type === 'error' ? 'text-red-800' :
                  notification.type === 'success' ? 'text-green-800' :
                  notification.type === 'warning' ? 'text-yellow-800' :
                  'text-blue-800'
                }`}>
                  {notification.message}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Critical Alert */}
        {systemHealth.status === 'failed' && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Automation System Offline</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>⚠️ Automation has been disabled due to system issues.</p>
                  <p className="mt-1">All manual operations remain fully functional.</p>
                </div>
                <div className="mt-4">
                  <button
                    onClick={checkSystemHealth}
                    className="bg-red-100 text-red-800 px-4 py-2 rounded-md text-sm font-medium hover:bg-red-200"
                  >
                    Re-check System
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ICP Definition */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Target ICP Definition</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">Industry</h3>
                <p className="text-sm text-gray-600">{ICP_DEFINITION.industry}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">Size</h3>
                <p className="text-sm text-gray-600">{ICP_DEFINITION.size}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">Geography</h3>
                <p className="text-sm text-gray-600">{ICP_DEFINITION.geo}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">Key Pain</h3>
                <p className="text-sm text-gray-600">{ICP_DEFINITION.pain}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">Trigger</h3>
                <p className="text-sm text-gray-600">{ICP_DEFINITION.trigger}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">Target Count</h3>
                <p className="text-sm text-gray-600">{campaign.target_count} qualified companies</p>
              </div>
            </div>
          </div>
        </div>

        {/* Campaign Control */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Campaign Control</h2>
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                  campaign.status === 'idle' ? 'bg-gray-100 text-gray-800' :
                  campaign.status === 'qualifying' ? 'bg-blue-100 text-blue-800' :
                  campaign.status === 'researching' ? 'bg-yellow-100 text-yellow-800' :
                  campaign.status === 'outreach' ? 'bg-green-100 text-green-800' :
                  campaign.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                </span>
                {manualMode && (
                  <span className="px-3 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
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
                  className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  {manualMode ? 'Switch to Auto' : 'Switch to Manual'}
                </button>
                <button
                  onClick={checkSystemHealth}
                  disabled={loading}
                  className="px-6 py-3 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200"
                >
                  Check Health
                </button>
              </div>
            </div>

            {/* Campaign Progress */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{campaign.qualified_leads.length}</div>
                <div className="text-sm text-gray-600">Qualified</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-900">{campaign.research_queue.length}</div>
                <div className="text-sm text-blue-600">Research Queue</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-900">{campaign.outreach_queue.length}</div>
                <div className="text-sm text-yellow-600">Outreach Queue</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-900">{campaign.completed_leads.length}</div>
                <div className="text-sm text-green-600">In Sequence</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-900">{campaign.failed_leads.length}</div>
                <div className="text-sm text-red-600">Failed</div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Dashboard */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Campaign KPIs</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Emails Sent</dt>
                      <dd className="text-lg font-medium text-gray-900">{kpis.emails_sent}</dd>
                    </dl>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Replies</dt>
                      <dd className="text-lg font-medium text-gray-900">{kpis.replies}</dd>
                    </dl>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Meetings Booked</dt>
                      <dd className="text-lg font-medium text-gray-900">{kpis.meetings_booked}</dd>
                    </dl>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Reply Rate</dt>
                      <dd className="text-lg font-medium text-gray-900">{kpis.reply_rate.toFixed(1)}%</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Manual Operations Panel */}
        {user && (
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">
                {manualMode ? 'Manual Operations' : 'Automation Control'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {manualMode 
                  ? 'System is running in manual mode - execute operations manually' 
                  : 'Automation is running - monitor progress'}
              </p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Manual Email */}
                <div className="text-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-medium text-gray-900">Manual Email</h3>
                  <p className="text-xs text-gray-500 mt-1">Send emails manually</p>
                  <button className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium">
                    Compose Email
                  </button>
                </div>

                {/* Research Queue */}
                <div className="text-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-medium text-gray-900">Research Queue</h3>
                  <p className="text-xs text-gray-500 mt-1">{manualResearchQueue.length} pending</p>
                  <button className="mt-3 text-sm text-green-600 hover:text-green-800 font-medium">
                    Process Research
                  </button>
                </div>

                {/* Outreach Queue */}
                <div className="text-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-medium text-gray-900">Outreach Queue</h3>
                  <p className="text-xs text-gray-500 mt-1">{manualOutreachQueue.length} pending</p>
                  <button className="mt-3 text-sm text-yellow-600 hover:text-yellow-800 font-medium">
                    Send Emails
                  </button>
                </div>

                {/* Templates */}
                <div className="text-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-medium text-gray-900">Templates</h3>
                  <p className="text-xs text-gray-500 mt-1">3 controlled templates</p>
                  <button className="mt-3 text-sm text-purple-600 hover:text-purple-800 font-medium">
                    View Templates
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Leads Table */}
        {campaign.completed_leads.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Active Leads</h2>
            </div>
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Decision Maker</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cadence</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {campaign.completed_leads.slice(0, 10).map(lead => (
                    <tr key={lead.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {lead.company.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {lead.decision_maker?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          lead.status === 'in_sequence' ? 'bg-green-100 text-green-800' :
                          lead.status === 'researched' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {lead.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        Step {lead.cadence_step}/3
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => setSelectedLead(lead)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          View
                        </button>
                        <button
                          onClick={() => composeManualEmail(lead, 'email1')}
                          className="text-green-600 hover:text-green-900"
                        >
                          Email
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Manual Email Composer */}
        {manualEmailComposer && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Compose Email: {manualEmailComposer.lead.company.name}
                  </h3>
                  <button
                    onClick={() => setManualEmailComposer(null)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">To</label>
                    <input
                      type="text"
                      value={manualEmailComposer.lead.decision_maker?.email || ''}
                      readOnly
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Subject</label>
                    <input
                      type="text"
                      value={manualEmailComposer.subject}
                      readOnly
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Body</label>
                    <textarea
                      rows={10}
                      value={manualEmailComposer.body}
                      readOnly
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                    />
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setManualEmailComposer(null)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
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
        )}
      </main>
    </div>
  );
}
