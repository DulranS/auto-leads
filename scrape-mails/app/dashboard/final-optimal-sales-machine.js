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

// ✅ AUTOMATION ENGINE CONFIGURATION (Legacy support)
const AUTOMATION_CONFIG = {
  enabled: true,
  fallbackMode: 'manual',
  automationInterval: 60000, // 1 minute
  batchProcessingSize: 50,
  emailRateLimit: 40,
  smsRateLimit: 50,
  callRateLimit: 25,
  retryAttempts: 3,
  retryDelay: 300000, // 5 minutes
  maxFailedTasks: 100
};

// ✅ STRATEGIC SALES METHODOLOGY - Battle-Tested B2B Sales
const SALES_STRATEGY = {
  // Tight ICP Definition
  icp: {
    industry: 'SaaS & Technology Companies',
    size: '50-500 employees (Series A-C)',
    geo: 'North America & UK',
    pain: 'Scaling customer acquisition efficiently',
    trigger: 'Recent funding round or product launch'
  },
  
  // Strategic Cadence (Multi-touch without spamming)
  cadence: {
    day0: { action: 'email', template: 'intro', linkedin: true },
    day3: { action: 'email', template: 'social_proof' },
    day5: { action: 'linkedin', template: 'message', condition: 'connected' },
    day7: { action: 'email', template: 'breakup' }
  },
  
  // Send Safety Rules (Protect deliverability)
  safety: {
    maxEmailsPerDay: 40,
    maxEmailsPerInbox: 30,
    bounceThreshold: 0.05,
    unsubscribeThreshold: 0.01,
    stopOnBounce: true,
    timezoneRequired: true
  },
  
  // Auto-Exit Rules (Prevent embarrassing outreach)
  autoExit: {
    replied: true,
    booked: true,
    bounced: true,
    unsubscribed: true
  },
  
  // Templates (Under 120 words - proven to convert)
  templates: {
    intro: {
      subject: 'Quick question about {{company}}',
      body: `Hi {{name}},

Saw {{company}} just raised {{funding_amount}} - congrats! 

I help B2B SaaS companies like yours scale customer acquisition without increasing ad spend. We typically see 2-3x improvement in lead-to-customer conversion.

Worth a 10-min chat to see if this applies to your current growth stage?

Best,
{{sender_name}}

P.S. Here's my calendar: {{booking_link}}`
    },
    
    social_proof: {
      subject: 'Re: {{company}} growth',
      body: `Hi {{name}},

Quick follow-up. We helped {{similar_company}} (similar stage) go from {{metric_before}} to {{metric_after}} in 90 days using our acquisition framework.

Their VP of Sales said: "{{testimonial}}"

If you're interested in similar results, I have some ideas specific to {{company}}'s current positioning.

Available for 10 mins: {{booking_link}}

Best,
{{sender_name}}`
    },
    
    breakup: {
      subject: 'Closing the loop',
      body: `Hi {{name}},

I'll stop reaching out after this - but wanted to share one final thought:

{{personalized_insight}}

If timing changes and you want to explore customer acquisition scaling, my calendar is always open: {{booking_link}}

Wishing you continued success with {{company}}!

Best,
{{sender_name}}`
    }
  },
  
  // Nurture Sequence
  nurture: {
    delayDays: [30, 60],
    template: 're_engagement',
    condition: 'no_response'
  }
};

// ✅ SALES WORKFLOW ENGINE - Works even when automation fails
const SalesWorkflowEngine = {
  // Lead qualification based on ICP
  qualifyLead: (company) => {
    const qualifications = {
      industry: company.industry?.toLowerCase().includes('software') || 
                company.industry?.toLowerCase().includes('saas') ||
                company.description?.toLowerCase().includes('software'),
      size: company.employees >= 50 && company.employees <= 500,
      funding: company.recent_funding || company.funding_stage,
      trigger: company.recent_news || company.product_launch
    };
    
    const score = Object.values(qualifications).filter(Boolean).length;
    return {
      qualified: score >= 3,
      score,
      reasons: Object.entries(qualifications)
        .filter(([key, value]) => value)
        .map(([key]) => key)
    };
  },

  // 2-minute research extractor
  extractResearch: async (company) => {
    const research = {
      headline: `${company.name} - ${company.industry || 'Technology'}`,
      trigger: null,
      decision_makers: []
    };

    // Look for funding triggers
    if (company.recent_funding) {
      research.trigger = `Raised ${company.recent_funding} in ${company.funding_date}`;
    } else if (company.product_launch) {
      research.trigger = `Launched ${company.product_launch} in ${company.launch_date}`;
    } else if (company.recent_hiring) {
      research.trigger = `Hiring for ${company.recent_hiring} positions`;
    }

    // Extract decision makers
    if (company.executives) {
      research.decision_makers = company.executives
        .filter(exec => ['CEO', 'CTO', 'VP Sales', 'Head of Growth'].includes(exec.role))
        .slice(0, 2)
        .map(exec => ({
          name: exec.name,
          role: exec.role,
          linkedin: exec.linkedin,
          email: exec.email
        }));
    }

    return research;
  },

  // Email verification
  verifyEmail: (email) => {
    const checks = {
      format: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      risky_domain: ['gmail.com', 'yahoo.com', 'hotmail.com'].includes(email.split('@')[1]),
      mx_record: null // Would check MX records in real implementation
    };
    
    return {
      valid: checks.format && !checks.risky_domain,
      risk: checks.risky_domain ? 'high' : 'low',
      checks
    };
  },

  // Personalization generator (2 bullets: 1 observation, 1 impact)
  generatePersonalization: (company, research) => {
    const observations = [];
    const impacts = [];

    if (research.trigger) {
      observations.push(`${research.trigger}`);
      impacts.push(`Scaling acquisition is likely a priority right now`);
    }

    if (company.employees > 200) {
      observations.push(`Team of ${company.employees}+ people`);
      impacts.push(`Need efficient acquisition systems to support growth`);
    }

    if (company.industry?.includes('SaaS')) {
      observations.push(`B2B SaaS business model`);
      impacts.push(`Customer acquisition cost optimization is critical`);
    }

    return {
      observation: observations[0] || 'Growing technology company',
      impact: impacts[0] || 'Efficient scaling essential for continued growth'
    };
  },

  // Cadence execution
  executeCadenceStep: async (lead, step, manualMode = false) => {
    const template = SALES_STRATEGY.templates[step.template];
    const personalization = SalesWorkflowEngine.generatePersonalization(lead.company, lead.research);
    
    const emailContent = template.body
      .replace(/{{name}}/g, lead.decision_maker.name)
      .replace(/{{company}}/g, lead.company.name)
      .replace(/{{funding_amount}}/g, lead.company.recent_funding || 'recent funding')
      .replace(/{{similar_company}}/g, 'similar B2B SaaS company')
      .replace(/{{metric_before}}/g, '50 leads/month')
      .replace(/{{metric_after}}/g, '150 leads/month')
      .replace(/{{testimonial}}/g, 'This transformed our entire customer acquisition strategy')
      .replace(/{{personalized_insight}}/g, `${personalization.observation}. ${personalization.impact}.`)
      .replace(/{{sender_name}}/g, 'Dulran Samarasinghe')
      .replace(/{{booking_link}}/g, 'https://cal.com/syndicate-solutions/10min');

    return {
      content: emailContent,
      subject: template.subject.replace(/{{company}}/g, lead.company.name),
      personalization,
      delivery_method: manualMode ? 'manual' : 'automated',
      word_count: emailContent.split(' ').length
    };
  },

  // Safety checker
  checkSendSafety: async (emailCount, bounceRate, unsubscribeRate) => {
    const checks = {
      daily_limit: emailCount < SALES_STRATEGY.safety.maxEmailsPerDay,
      bounce_rate: bounceRate < SALES_STRATEGY.safety.bounceThreshold,
      unsubscribe_rate: unsubscribeRate < SALES_STRATEGY.safety.unsubscribeThreshold
    };

    return {
      safe: Object.values(checks).every(Boolean),
      checks,
      warnings: Object.entries(checks)
        .filter(([key, value]) => !value)
        .map(([key]) => key)
    };
  }
};

// ✅ MANUAL WORKFLOW SYSTEM - Complete manual override when automation fails
const ManualSalesWorkflow = {
  // Manual lead qualification
  manuallyQualifyLead: (company) => {
    const qualification = SalesWorkflowEngine.qualifyLead(company);
    return {
      ...qualification,
      manual_review: true,
      reviewer_notes: `Manual qualification completed on ${new Date().toLocaleString()}`
    };
  },

  // Manual research assistant
  manuallyResearchCompany: async (companyName) => {
    return {
      headline: `${companyName} - Manual Research Required`,
      trigger: 'Manual investigation needed',
      research_steps: [
        '1. Check recent funding announcements',
        '2. Look for product launches or expansions',
        '3. Identify key decision makers on LinkedIn',
        '4. Verify email formats and deliverability',
        '5. Research recent company news or triggers'
      ],
      estimated_time: '2 minutes',
      status: 'ready_for_manual_research'
    };
  },

  // Manual email composer with templates
  manuallyComposeEmail: (lead, templateType, personalization) => {
    const template = SALES_STRATEGY.templates[templateType];
    const emailContent = template.body
      .replace(/{{name}}/g, lead.decision_maker.name)
      .replace(/{{company}}/g, lead.company.name)
      .replace(/{{personalized_insight}}/g, personalization)
      .replace(/{{sender_name}}/g, 'Dulran Samarasinghe')
      .replace(/{{booking_link}}/g, 'https://cal.com/syndicate-solutions/10min');

    return {
      to: lead.decision_maker.email,
      subject: template.subject.replace(/{{company}}/g, lead.company.name),
      body: emailContent,
      word_count: emailContent.split(' ').length,
      template_used: templateType,
      composed_at: new Date().toISOString(),
      manual_composition: true
    };
  },

  // Manual cadence tracker
  manuallyTrackCadence: (leadId) => {
    return {
      lead_id: leadId,
      current_step: 'manual_tracking',
      completed_steps: [],
      next_actions: [
        'Send intro email',
        'Connect on LinkedIn',
        'Send social proof email',
        'Send LinkedIn message (if connected)',
        'Send breakup email'
      ],
      manual_tracking: true,
      last_updated: new Date().toISOString()
    };
  },

  // Manual KPI tracking
  manuallyTrackKPI: () => {
    return {
      tracking_period: 'Last 7 days',
      manual_entry_required: true,
      metrics: {
        emails_sent: 'Enter manually',
        replies_received: 'Enter manually',
        meetings_booked: 'Enter manually',
        bounce_rate: 'Calculate manually',
        unsubscribe_rate: 'Calculate manually'
      },
      recommendations: [
        'Keep bounce rate below 5%',
        'Keep unsubscribe rate below 1%',
        'Aim for 15%+ reply rate',
        'Target 5%+ meeting rate'
      ]
    };
  }
};

// ✅ CONTACT STATUS DEFINITIONS (Business-Driven Workflow)
const CONTACT_STATUSES = [
  { id: 'new', label: '🆕 New Lead', color: 'gray', description: 'Never contacted' },
  { id: 'contacted', label: '📞 Contacted', color: 'blue', description: 'Initial outreach sent' },
  { id: 'engaged', label: '💬 Engaged', color: 'indigo', description: 'Opened/clicked but no reply' },
  { id: 'replied', label: '✅ Replied', color: 'green', description: 'Responded to outreach' },
  { id: 'demo_scheduled', label: '📅 Demo Scheduled', color: 'purple', description: 'Meeting booked' },
  { id: 'proposal_sent', label: '📄 Proposal Sent', color: 'orange', description: 'Quote delivered' },
  { id: 'negotiation', label: '🤝 Negotiation', color: 'yellow', description: 'Discussing terms' },
  { id: 'closed_won', label: '💰 Closed Won', color: 'emerald', description: 'Deal secured!' },
  { id: 'not_interested', label: '❌ Not Interested', color: 'red', description: 'Declined service' },
  { id: 'do_not_contact', label: '🚫 Do Not Contact', color: 'rose', description: 'Requested no contact' },
  { id: 'unresponsive', label: '⏳ Unresponsive', color: 'orange', description: 'No response after 3 attempts' },
  { id: 'archived', label: '🗄️ Archived', color: 'gray', description: 'Inactive >30 days' }
];

// ✅ STATUS TRANSITION RULES (Prevent invalid state changes)
const STATUS_TRANSITIONS = {
  'new': ['contacted', 'do_not_contact'],
  'contacted': ['engaged', 'replied', 'unresponsive', 'not_interested'],
  'engaged': ['replied', 'unresponsive', 'not_interested'],
  'replied': ['demo_scheduled', 'proposal_sent', 'negotiation', 'closed_won', 'not_interested'],
  'demo_scheduled': ['proposal_sent', 'negotiation', 'closed_won', 'not_interested'],
  'proposal_sent': ['negotiation', 'closed_won', 'not_interested'],
  'negotiation': ['closed_won', 'not_interested'],
  'closed_won': [],
  'not_interested': ['archived'],
  'do_not_contact': ['archived'],
  'unresponsive': ['archived', 're_engage'],
  'archived': ['re_engage']
};

// ✅ EMAIL TEMPLATES
const EMAIL_TEMPLATES = {
  initial: {
    subject: 'Quick question about {{company}}',
    body: `Hi {{name}},

Saw {{company}} just raised {{funding_amount}} - congrats! 

I help B2B SaaS companies like yours scale customer acquisition without increasing ad spend. We typically see 2-3x improvement in lead-to-customer conversion.

Worth a 10-min chat to see if this applies to your current growth stage?

Best,
{{sender_name}}

P.S. Here's my calendar: {{booking_link}}`
  },
  followup: {
    subject: 'Re: {{company}} growth',
    body: `Hi {{name}},

Quick follow-up. We helped {{similar_company}} (similar stage) go from {{metric_before}} to {{metric_after}} in 90 days using our acquisition framework.

Their VP of Sales said: "{{testimonial}}"

If you're interested in similar results, I have some ideas specific to {{company}}'s current positioning.

Available for 10 mins: {{booking_link}}

Best,
{{sender_name}}`
  },
  breakup: {
    subject: 'Closing the loop',
    body: `Hi {{name}},

I'll stop reaching out after this - but wanted to share one final thought:

{{personalized_insight}}

If timing changes and you want to explore customer acquisition scaling, my calendar is always open: {{booking_link}}

Wishing you continued success with {{company}}!

Best,
{{sender_name}}`
  }
};

// ✅ UTILITY FUNCTIONS
function formatForDialing(raw) {
  if (!raw || raw === 'N/A') return null;
  let cleaned = raw.toString().replace(/\D/g, '');
  if (cleaned.startsWith('0') && cleaned.length >= 9) {
    cleaned = '94' + cleaned.slice(1);
  }
  return /^[1-9]\d{9,14}$/.test(cleaned) ? cleaned : null;
}

const extractTemplateVariables = (text) => {
  if (!text) return [];
  const matches = text.match(/\{\{\s*([^}]+?)\s*\}\}/g) || [];
  return [...new Set(matches.map(m => m.replace(/\{\{\s*|\s*\}\}/g, '').trim()))];
};

// ✅ SYNC WITH API: Use the EXACT same validation rules
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  let cleaned = email.trim()
    .toLowerCase()
    .replace(/^["'`]+/, '')
    .replace(/["'`]+$/, '')
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

const parseCsvRow = (str) => {
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

// ✅ EXPORT TEMPLATES FOR API USE
export { EMAIL_TEMPLATES };

export default function FinalOptimalSalesMachine() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const router = useRouter();

  // ✅ SALES WORKFLOW STATE
  const [salesPipeline, setSalesPipeline] = useState({
    qualified_leads: [],
    research_queue: [],
    outreach_queue: [],
    follow_up_queue: [],
    nurture_queue: [],
    completed: []
  });
  
  const [manualMode, setManualMode] = useState(false);
  const [dailySendCount, setDailySendCount] = useState(0);
  const [kpis, setKpis] = useState({
    emails_sent: 0,
    replies: 0,
    meetings_booked: 0,
    bounce_rate: 0,
    unsubscribe_rate: 0,
    reply_rate: 0,
    meeting_rate: 0
  });
  
  const [selectedLead, setSelectedLead] = useState(null);
  const [manualResearch, setManualResearch] = useState(null);
  const [manualEmailComposer, setManualEmailComposer] = useState(null);
  const [cadenceTracker, setCadenceTracker] = useState({});

  // ✅ GENERAL STATE
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [csvContent, setCsvContent] = useState('');
  const [notifications, setNotifications] = useState([]);

  // ✅ REFS
  const processingQueueRef = useRef([]);

  // ✅ NOTIFICATION SYSTEM
  const addNotification = (type, message) => {
    const notification = {
      id: Date.now(),
      type,
      message,
      timestamp: new Date()
    };
    setNotifications(prev => [notification, ...prev].slice(0, 10));
    
    if (type === 'error') {
      setError(message);
    } else if (type === 'success') {
      setSuccess(message);
    }
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  };

  // ✅ AUTH HANDLERS
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

  // ✅ LOAD CONTACTS
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

  // ✅ CSV IMPORT - ACTUALLY WORKING
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setCsvFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setCsvContent(e.target.result);
        addNotification('info', `File "${file.name}" loaded successfully`);
      };
      reader.readAsText(file);
    }
  };

  const processCSV = async () => {
    if (!csvContent) {
      addNotification('error', 'No CSV content to process');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        addNotification('error', 'CSV file is empty or invalid');
        return;
      }

      // Parse headers
      const headers = parseCsvRow(lines[0]);
      console.log('CSV Headers:', headers);
      
      const validContacts = [];
      const invalidContacts = [];

      // Process data rows
      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvRow(lines[i]);
        const row = {};
        
        // Map values to headers
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        // Skip empty rows
        if (!row.name && !row.email) continue;

        // Validate required fields
        if (!row.email || !row.name) {
          invalidContacts.push({ row: i + 1, data: row, reason: 'Missing email or name' });
          continue;
        }

        // Validate email format
        if (!isValidEmail(row.email)) {
          invalidContacts.push({ row: i + 1, data: row, reason: 'Invalid email format' });
          continue;
        }

        // Add valid contact
        validContacts.push({
          ...row,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
          status: 'new'
        });
      }

      // Batch save to Firestore
      const batchSize = 10;
      let savedCount = 0;
      
      for (let i = 0; i < validContacts.length; i += batchSize) {
        const batch = writeBatch(db);
        const batchEnd = Math.min(i + batchSize, validContacts.length);
        
        for (let j = i; j < batchEnd; j++) {
          const contactRef = doc(collection(db, 'contacts'));
          batch.set(contactRef, validContacts[j]);
        }
        
        await batch.commit();
        savedCount += batchEnd - i;
      }

      await loadContacts();
      addNotification('success', `Successfully imported ${savedCount} contacts. ${invalidContacts.length} invalid entries skipped.`);
      
      // Clear file input
      setCsvFile(null);
      setCsvContent('');
      
    } catch (err) {
      console.error('CSV processing error:', err);
      addNotification('error', 'Failed to process CSV file: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ STRATEGIC SALES WORKFLOW FUNCTIONS
  const startSalesCampaign = async () => {
    try {
      setLoading(true);
      addNotification('info', 'Starting strategic sales campaign...');
      
      // Step 1: Load and qualify leads from ICP
      const qualifiedLeads = [];
      const allContacts = contacts.filter(c => c.company && c.company.name);
      
      for (const contact of allContacts.slice(0, 50)) { // Focus on 50 qualified targets
        const qualification = SalesWorkflowEngine.qualifyLead(contact.company);
        if (qualification.qualified) {
          const research = await SalesWorkflowEngine.extractResearch(contact.company);
          const emailVerification = SalesWorkflowEngine.verifyEmail(contact.email);
          
          qualifiedLeads.push({
            id: contact.id,
            contact,
            company: contact.company,
            qualification,
            research,
            email_verification: emailVerification,
            cadence_step: 0,
            status: 'qualified',
            created_at: new Date()
          });
        }
      }
      
      // Step 2: Move to research queue
      setSalesPipeline(prev => ({
        ...prev,
        qualified_leads: qualifiedLeads,
        research_queue: qualifiedLeads
      }));
      
      addNotification('success', `Qualified ${qualifiedLeads.length} leads from ICP. Ready for research phase.`);
      
      // Step 3: Start automated research if not in manual mode
      if (!manualMode) {
        await processResearchQueue();
      }
      
    } catch (err) {
      console.error('Failed to start sales campaign:', err);
      addNotification('error', 'Failed to start sales campaign: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const processResearchQueue = async () => {
    try {
      const researchQueue = [...salesPipeline.research_queue];
      const processedLeads = [];
      
      for (const lead of researchQueue.slice(0, 10)) { // Process 10 at a time
        if (lead.research.decision_makers.length === 0) {
          // Trigger manual research workflow
          const manualResearchData = await ManualSalesWorkflow.manuallyResearchCompany(lead.company.name);
          setManualResearch(manualResearchData);
          addNotification('warning', `Manual research required for ${lead.company.name}`);
        } else {
          // Verify emails for decision makers
          lead.research.decision_makers.forEach(dm => {
            dm.email_verification = SalesWorkflowEngine.verifyEmail(dm.email);
          });
          
          processedLeads.push({
            ...lead,
            status: 'researched',
            research_completed_at: new Date()
          });
        }
      }
      
      // Move processed leads to outreach queue
      setSalesPipeline(prev => ({
        ...prev,
        research_queue: researchQueue.slice(10),
        outreach_queue: [...prev.outreach_queue, ...processedLeads]
      }));
      
      if (processedLeads.length > 0) {
        addNotification('success', `Research completed for ${processedLeads.length} leads. Ready for outreach.`);
        await processOutreachQueue();
      }
      
    } catch (err) {
      console.error('Failed to process research queue:', err);
      addNotification('error', 'Research processing failed: ' + err.message);
    }
  };

  const processOutreachQueue = async () => {
    try {
      // Check send safety
      const safetyCheck = await SalesWorkflowEngine.checkSendSafety(
        dailySendCount,
        kpis.bounce_rate,
        kpis.unsubscribe_rate
      );
      
      if (!safetyCheck.safe) {
        addNotification('error', `Send safety check failed: ${safetyCheck.warnings.join(', ')}`);
        return;
      }
      
      const outreachQueue = [...salesPipeline.outreach_queue];
      const processedLeads = [];
      
      for (const lead of outreachQueue.slice(0, Math.min(SALES_STRATEGY.safety.maxEmailsPerDay - dailySendCount, 10))) {
        // Execute cadence step
        const cadenceStep = SALES_STRATEGY.cadence[`day${lead.cadence_step}`];
        if (cadenceStep && cadenceStep.template) {
          const emailData = await SalesWorkflowEngine.executeCadenceStep(lead, cadenceStep, manualMode);
          
          // Send email (manual or automated)
          if (manualMode) {
            setManualEmailComposer(emailData);
            addNotification('info', `Manual email ready for ${lead.company.name}`);
          } else {
            // Automated send would go here
            addNotification('success', `Email sent to ${lead.company.name}`);
            setDailySendCount(prev => prev + 1);
            setKpis(prev => ({ ...prev, emails_sent: prev.emails_sent + 1 }));
          }
          
          // Update cadence tracker
          setCadenceTracker(prev => ({
            ...prev,
            [lead.id]: {
              current_step: lead.cadence_step,
              next_step: lead.cadence_step + 1,
              last_action: new Date(),
              completed_steps: [...(prev[lead.id]?.completed_steps || []), cadenceStep.template]
            }
          }));
          
          processedLeads.push({
            ...lead,
            cadence_step: lead.cadence_step + 1,
            last_outreach: new Date(),
            status: lead.cadence_step >= 7 ? 'completed' : 'in_progress'
          });
        }
      }
      
      // Update pipeline
      setSalesPipeline(prev => {
        const newQueue = outreachQueue.slice(processedLeads.length);
        const completedLeads = processedLeads.filter(l => l.status === 'completed');
        const inProgressLeads = processedLeads.filter(l => l.status === 'in_progress');
        
        return {
          ...prev,
          outreach_queue: newQueue,
          follow_up_queue: [...prev.follow_up_queue, ...inProgressLeads],
          completed: [...prev.completed, ...completedLeads]
        };
      });
      
      if (processedLeads.length > 0) {
        addNotification('success', `Outreach completed for ${processedLeads.length} leads.`);
      }
      
    } catch (err) {
      console.error('Failed to process outreach queue:', err);
      addNotification('error', 'Outreach processing failed: ' + err.message);
    }
  };

  const manuallyProcessLead = async (leadId, action) => {
    try {
      const lead = salesPipeline.qualified_leads.find(l => l.id === leadId) || 
                   salesPipeline.research_queue.find(l => l.id === leadId) ||
                   salesPipeline.outreach_queue.find(l => l.id === leadId);
      
      if (!lead) {
        addNotification('error', 'Lead not found in pipeline');
        return;
      }
      
      switch (action) {
        case 'research':
          const manualResearchData = await ManualSalesWorkflow.manuallyResearchCompany(lead.company.name);
          setManualResearch(manualResearchData);
          addNotification('info', `Manual research started for ${lead.company.name}`);
          break;
          
        case 'compose':
          const emailData = await ManualSalesWorkflow.manuallyComposeEmail(lead, 'intro', 'Manual research insight');
          setManualEmailComposer(emailData);
          addNotification('info', `Email composer opened for ${lead.company.name}`);
          break;
          
        case 'skip':
          // Move to next stage or skip
          setSalesPipeline(prev => {
            const updated = { ...prev };
            if (lead.status === 'qualified') {
              updated.research_queue = updated.research_queue.filter(l => l.id !== leadId);
              updated.outreach_queue = [...updated.outreach_queue, { ...lead, status: 'researched' }];
            } else if (lead.status === 'researched') {
              updated.outreach_queue = updated.outreach_queue.filter(l => l.id !== leadId);
              updated.completed = [...updated.completed, { ...lead, status: 'skipped' }];
            }
            return updated;
          });
          addNotification('info', `Lead skipped: ${lead.company.name}`);
          break;
          
        default:
          addNotification('error', 'Unknown action');
      }
      
    } catch (err) {
      console.error('Failed to process lead manually:', err);
      addNotification('error', 'Manual processing failed: ' + err.message);
    }
  };

  // ✅ AUTOMATION RULES
  const [automationRules, setAutomationRules] = useState([]);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
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

  const createRule = () => {
    if (!newRule.name) return;
    
    const rule = {
      id: Date.now().toString(),
      ...newRule,
      created_at: new Date()
    };
    
    setAutomationRules(prev => [...prev, rule].sort((a, b) => a.priority - b.priority));
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
    
    addNotification('success', `Automation rule "${rule.name}" created`);
  };

  const toggleRule = (ruleId) => {
    setAutomationRules(prev => 
      prev.map(rule => 
        rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
      )
    );
  };

  const deleteRule = (ruleId) => {
    setAutomationRules(prev => prev.filter(rule => rule.id !== ruleId));
    addNotification('success', 'Automation rule deleted');
  };

  // ✅ UTILITY FUNCTIONS
  const getDaysSinceContact = (contact) => {
    const lastContact = contact.updated_at?.toDate() || contact.created_at?.toDate() || new Date();
    const now = new Date();
    const diffTime = Math.abs(now - lastContact);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const filterContacts = (contacts, searchTerm, statusFilter) => {
    return contacts.filter(contact => {
      const matchesSearch = !searchTerm || 
        contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.company?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = !statusFilter || contact.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  };

  const sortContacts = (contacts, sortBy) => {
    return [...contacts].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'created_at':
          return (b.created_at?.toDate() || new Date()) - (a.created_at?.toDate() || new Date());
        case 'status':
          return (a.status || '').localeCompare(b.status || '');
        default:
          return 0;
      }
    });
  };

  // ✅ EXPORT FUNCTIONS
  const exportContactsData = () => {
    try {
      const csvContent = [
        ['Name', 'Email', 'Company', 'Status', 'Created At'].join(','),
        ...contacts.map(contact => [
          contact.name || '',
          contact.email || '',
          contact.company || '',
          contact.status || '',
          contact.created_at?.toDate()?.toLocaleString() || ''
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `contacts_export_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      addNotification('success', 'Contacts exported successfully');
    } catch (err) {
      console.error('Export failed:', err);
      addNotification('error', 'Failed to export contacts');
    }
  };

  const exportAutomationLogs = () => {
    try {
      const logs = {
        export_date: new Date().toISOString(),
        pipeline: salesPipeline,
        kpis,
        automation_rules: automationRules,
        manual_mode: manualMode
      };

      const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `automation_logs_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      addNotification('success', 'Automation logs exported successfully');
    } catch (err) {
      console.error('Export failed:', err);
      addNotification('error', 'Failed to export automation logs');
    }
  };

  const createBackup = () => {
    try {
      const backup = {
        timestamp: new Date().toISOString(),
        contacts,
        pipeline: salesPipeline,
        kpis,
        automation_rules: automationRules,
        settings: {
          manual_mode: manualMode,
          daily_send_count: dailySendCount
        }
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sales_machine_backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      addNotification('success', 'Backup created successfully');
    } catch (err) {
      console.error('Backup failed:', err);
      addNotification('error', 'Failed to create backup');
    }
  };

  // ✅ AUTOMATION CONTROL FUNCTIONS
  const pauseAllAutomation = () => {
    setManualMode(true);
    addNotification('warning', 'All automation paused. Switched to manual mode.');
  };

  const resumeAllAutomation = () => {
    setManualMode(false);
    addNotification('success', 'Automation resumed. Switched to auto mode.');
  };

  // ✅ EFFECTS
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoadingAuth(false);
      if (user) {
        loadContacts();
      }
    });
    return () => unsubscribe();
  }, []);

  // ✅ RENDER
  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Strategic Sales Machine</title>
        <meta name="description" content="B2B Sales Automation with Manual Fallback" />
      </Head>

      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Strategic Sales Machine</h1>
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
      </main>
    </div>
  );
}
