'use client';

/**
 * ============================================================================
 * FINAL OPTIMAL B2B SALES MACHINE - BEST OF BOTH WORLDS
 * ============================================================================
 * 
 * COMBINES:
 * ✅ Complete Manual-First Controls (from complete-manual-first-sales-machine.js)
 * ✅ Strategic AI Enhancement (from ai-enhanced-sales-machine.js)
 * ✅ Your Actual Business Pitch & Templates (from your file)
 * ✅ Advanced Contact Management & Status Tracking
 * ✅ Multi-Channel Outreach (Email, WhatsApp, SMS, Calls)
 * ✅ AI-Powered Research & Personalization
 * ✅ Follow-Up Automation with Smart Logic
 * ✅ Real-Time Analytics & Business Intelligence
 * 
 * TIGHT ICP DEFINITION:
 * - Industry: SaaS companies 20-200 employees
 * - Size: Series A-C funding stages ($2M-$50M raised)
 * - Geo: North America & Europe primarily
 * - Pain: Scaling customer acquisition without burning cash
 * - Trigger: Recent funding round, product launch, or hiring growth
 * 
 * STRATEGIC WORKFLOW:
 * 1. Pick 50 qualified target companies (small batch = manageable testing)
 * 2. 2-minute research per company (headline + one recent trigger link)
 * 3. Find 1-2 decision makers per account (name, role, LinkedIn URL)
 * 4. Verify each email (format + MX/basic deliverability)
 * 5. Create 2 personalization bullets (1 observation, 1 impact)
 * 6. Use 3 controlled templates only (<120 words each)
 * 7. Launch with controlled cadence (Day0, Day3, Day5, Day7)
 * 8. Auto-exit rules (replied/booked → remove; bounced → pause)
 * 9. Weekly KPI monitoring with auto-pause triggers
 * 10. Move non-responders to nurture sequence (30-60 days)
 * 
 * AI USAGE: Optional enhancement for speed and scale, never required
 * MANUAL OVERRIDE: Every feature works 100% without AI
 * 
 * MINIMAL TECH STACK:
 * - LinkedIn: Target research and decision maker finding
 * - Apollo.io: Contact enrichment and verification
 * - Calendly: Meeting scheduling
 * - HubSpot: CRM and sequence management
 * - WhatsApp: Multi-channel follow-up
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, deleteDoc, Timestamp, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import Head from 'next/head';
import { useRouter } from 'next/navigation';

// Firebase setup - with safety check
let app, db, auth;

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

// ✅ YOUR ACTUAL INITIAL PITCH
const DEFAULT_TEMPLATE_A = {
  subject: 'Quick question for {{business_name}}',
  body: `Hi {{business_name}}, 😊👋🏻
I hope you're doing well.
My name is Dulran Samarasinghe. I run Syndicate Solutions, a Sri Lanka–based mini agency supporting
small to mid-sized agencies and businesses with reliable execution across web, software,
AI automation, and ongoing digital operations.
We typically work as a white-label or outsourced partner when teams need:
• extra delivery capacity
• fast turnarounds without hiring
• ongoing technical and digital support
I'm reaching out to ask – do you ever use external support when workload or deadlines increase?
If helpful, I'm open to starting with a small task or short contract to build trust before
discussing anything larger.
You can review my work here:
Portfolio: https://syndicatesolutions.vercel.app/
LinkedIn: https://www.linkedin.com/in/dulran-samarasinghe-13941b175/
If it makes sense, you can book a short 15-minute call:
https://cal.com/syndicate-solutions/15min
You can contact me on Whatsapp - 0741143323
You can email me at - syndicatesoftwaresolutions@gmail.com
Otherwise, happy to continue the conversation over email.
Best regards,
Dulran Samarasinghe
Founder – Syndicate Solutions`
};

// ✅ FOLLOW-UP TEMPLATES
const FOLLOW_UP_1 = {
  subject: 'Quick question for {{business_name}}',
  body: `Hi {{business_name}},
Just circling back—did my note about outsourced dev & ops support land at a bad time?
No pressure at all, but if you're ever swamped with web, automation, or backend work and need a reliable extra hand (especially for white-label or fast-turnaround needs), we're ready to help.
Even a 1-hour task is a great way to test the waters.
Either way, wishing you a productive week!
Best,
Dulran
Founder – Syndicate Solutions
WhatsApp: 0741143323`
};

const FOLLOW_UP_2 = {
  subject: '{{business_name}}, a quick offer (no strings)',
  body: `Hi again,
I noticed you haven't had a chance to reply—totally understand!
To make this zero-risk: **I'll audit one of your digital workflows (e.g., lead capture, client onboarding, internal tooling) for free** and send 2–3 actionable automation ideas you can implement immediately—even if you never work with us.
Zero sales pitch. Just value.
Interested? Hit "Yes" or reply with a workflow you'd like optimized.
Cheers,
Dulran
Portfolio: https://syndicatesolutions.vercel.app/
Book a call: https://cal.com/syndicate-solutions/15min`
};

const FOLLOW_UP_3 = {
  subject: 'Closing the loop',
  body: `Hi {{business_name}},
I'll stop emailing after this one! 😅
Just wanted to say: if outsourcing ever becomes a priority—whether for web dev, AI tools, or ongoing ops—we're here. Many of our clients started with a tiny $100 task and now work with us monthly.
If now's not the time, no worries! I'll circle back in a few months.
Either way, keep crushing it!
— Dulran
WhatsApp: 0741143323`
};

// Keep B as fallback (or repurpose)
const DEFAULT_TEMPLATE_B = FOLLOW_UP_1;
const DEFAULT_WHATSAPP_TEMPLATE = `Hi {{business_name}} 👋😊
Hope you're doing well.
I'm {{sender_name}} from Sri Lanka – I run a small digital mini-agency supporting businesses with websites, content, and AI automation.
Quick question:
Are you currently working on anything digital that's taking too much time or not delivering the results you want?
Reply YES or NO.`;

const DEFAULT_SMS_TEMPLATE = `Hi {{business_name}} 👋
This is {{sender_name}} from Syndicate Solutions.
Quick question – are you currently working on any digital work that's delayed or not giving results?
Reply YES or NO.`;

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

// Tight ICP Definition
const TIGHT_ICP = {
  industry: 'SaaS',
  size: '20-200 employees',
  funding: 'Series A-C ($2M-$50M raised)',
  geo: 'North America & Europe',
  pain: 'Scaling customer acquisition without burning cash',
  triggers: [
    'Recent funding round',
    'Product launch',
    'Hiring growth',
    'Executive change',
    'Market expansion'
  ]
};

// 3 Controlled Templates Only
const CONTROLLED_TEMPLATES = {
  email1: {
    name: 'Intro',
    subject: 'Quick question about {{company}} growth',
    body: `Hi {{first_name}},

Saw {{company}} just raised {{funding_amount}} - congrats on the momentum.

When SaaS companies hit your stage, scaling customer acquisition without burning cash becomes a real challenge.

We help Series A-C SaaS companies add 15-25 qualified leads per month using our AI-powered outbound system.

Worth a 10-min chat to see if we can help you hit your Q2 targets?

Best,
{{sender_name}}
{{booking_link}}`,
    wordCount: 89
  },
  email2: {
    name: 'Social Proof',
    subject: 'Re: {{company}} growth',
    body: `Hi {{first_name}},

Quick follow-up - helped {{similar_company}} (similar stage) add 22 qualified leads last month.

They were struggling with the same customer acquisition efficiency challenges.

Our approach: AI handles research + personalization, you focus on calls.

10-min call to see if it makes sense for {{company}}?

{{sender_name}}
{{booking_link}}`,
    wordCount: 78
  },
  breakup: {
    name: 'Break-up',
    subject: 'Closing the loop',
    body: `Hi {{first_name}},

Tried reaching out a few times about helping {{company}} scale customer acquisition.

Assuming timing isn't right or this isn't a priority.

If that changes, I'm here. Otherwise, I'll close your file.

Best,
{{sender_name}}`,
    wordCount: 45
  }
};

// --- UTILITY FUNCTIONS ---
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

// ✅ SYNC WITH API: Use EXACT same validation rules
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
export { FOLLOW_UP_1, FOLLOW_UP_2, FOLLOW_UP_3 };

export default function FinalOptimalSalesMachine() {
  // STATE INITIALIZATION
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const router = useRouter();
  const [csvContent, setCsvContent] = useState('');
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [senderName, setSenderName] = useState('');
  const [abTestMode, setAbTestMode] = useState(false);
  const [templateA, setTemplateA] = useState(DEFAULT_TEMPLATE_A);
  const [templateB, setTemplateB] = useState(DEFAULT_TEMPLATE_B);
  const [whatsappTemplate, setWhatsappTemplate] = useState(DEFAULT_WHATSAPP_TEMPLATE);
  const [smsTemplate, setSmsTemplate] = useState(DEFAULT_SMS_TEMPLATE);
  const [fieldMappings, setFieldMappings] = useState({});
  const [previewRecipient, setPreviewRecipient] = useState(null);
  const [validEmails, setValidEmails] = useState(0);
  const [validWhatsApp, setValidWhatsApp] = useState(0);
  const [leadQualityFilter, setLeadQualityFilter] = useState('HOT');
  const [whatsappLinks, setWhatsappLinks] = useState([]);
  const [leadScores, setLeadScores] = useState({});
  const [lastSent, setLastSent] = useState({});
  const [clickStats, setClickStats] = useState({});
  const [emailImages, setEmailImages] = useState([]);
  const [dealStage, setDealStage] = useState({});
  const [pipelineValue, setPipelineValue] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState('');
  const [smsConsent, setSmsConsent] = useState(true);
  const [abResults, setAbResults] = useState({ a: { opens: 0, clicks: 0, sent: 0 }, b: { opens: 0, clicks: 0, sent: 0 } });
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  const [repliedLeads, setRepliedLeads] = useState({});
  const [followUpLeads, setFollowUpLeads] = useState({});
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [sentLeads, setSentLeads] = useState([]);
  const [sentEmails, setSentEmails] = useState([]);
  const [loadingSentLeads, setLoadingSentLeads] = useState(false);
  const [followUpHistory, setFollowUpHistory] = useState({});
  const [followUpFilter, setFollowUpFilter] = useState('all');
  const [followUpStats, setFollowUpStats] = useState({
    totalSent: 0,
    totalReplied: 0,
    readyForFollowUp: 0,
    alreadyFollowedUp: 0,
    awaitingReply: 0,
    interestedLeads: 0
  });
  
  // ✅ NEW: CONTACT STATUS MANAGEMENT STATE
  const [contactStatuses, setContactStatuses] = useState({}); // { contactId: status }
  const [statusHistory, setStatusHistory] = useState({}); // { contactId: [{status, timestamp, note}] }
  const [statusFilter, setStatusFilter] = useState('all');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedContactForStatus, setSelectedContactForStatus] = useState(null);
  const [statusNote, setStatusNote] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [archivedContactsCount, setArchivedContactsCount] = useState(0);
  
  // ✅ AI Research State
  const [researchingCompany, setResearchingCompany] = useState(null);
  const [researchResults, setResearchResults] = useState({});
  const [showResearchModal, setShowResearchModal] = useState(false);
  const [interestedLeadsList, setInterestedLeadsList] = useState([]);
  
  // ✅ AI/Manual Toggle State
  const [useAI, setUseAI] = useState(true);
  const [aiStatus, setAiStatus] = useState('available');
  const [sendSafety, setSendSafety] = useState({ maxPerDay: 50, currentDaySent: 0, paused: false });
  
  // ✅ KPI State
  const [kpis, setKpis] = useState({ sent: 0, replies: 0, meetings: 0, bounces: 0, opens: 0, clicks: 0 });
  const [activeTab, setActiveTab] = useState('targets');

  // ✅ CRITICAL: LOAD CONTACTS FROM FIRESTORE ON AUTH - FIXED DEPENDENCIES
  const loadContactsFromFirestore = useCallback(async (userId) => {
    if (!userId || !db) return;
    setLoadingContacts(true);
    try {
      // Query contacts collection with ordering
      const contactsRef = collection(db, 'users', userId, 'contacts');
      const q = query(contactsRef, orderBy('lastUpdated', 'desc'));
      const snapshot = await getDocs(q);
      
      const contacts = [];
      const statuses = {};
      const history = {};
      
      snapshot.forEach(doc => {
        const data = doc.data();
        // Generate unique contact ID (prioritize email, then phone)
        const contactId = data.email?.toLowerCase().trim() || `phone_${data.phone}`;
        
        contacts.push({
          id: doc.id,
          contactId,
          business: data.business || 'Business',
          address: data.address || '',
          phone: data.phone || '',
          email: data.email || null,
          place_id: data.place_id || '',
          website: data.website || '',
          instagram: data.instagram || '',
          twitter: data.twitter || '',
          facebook: data.facebook || '',
          youtube: data.youtube || '',
          tiktok: data.tiktok || '',
          linkedin_company: data.linkedin_company || '',
          linkedin_ceo: data.linkedin_ceo || '',
          linkedin_founder: data.linkedin_founder || '',
          contact_page_found: data.contact_page_found || 'No',
          social_media_score: data.social_media_score || '0',
          email_primary: data.email_primary || data.email || '',
          phone_primary: data.phone_primary || data.phone || '',
          lead_quality_score: data.lead_quality_score || '0',
          contact_confidence: data.contact_confidence || 'Low',
          best_contact_method: data.best_contact_method || 'Email',
          decision_maker_found: data.decision_maker_found || 'No',
          tech_stack_detected: data.tech_stack_detected || '',
          company_size_indicator: data.company_size_indicator || 'unknown',
          status: data.status || 'new',
          lastContacted: (data.lastContacted && data.lastContacted.toDate) ? data.lastContacted.toDate() : data.lastContacted || null,
          createdAt: (data.createdAt && data.createdAt.toDate) ? data.createdAt.toDate() : data.createdAt || new Date(),
          lastUpdated: (data.lastUpdated && data.lastUpdated.toDate) ? data.lastUpdated.toDate() : data.lastUpdated || new Date(),
          statusHistory: data.statusHistory || [],
          notes: data.notes || [],
          url: data.phone ? `https://wa.me/${data.phone}?text=${encodeURIComponent(
            renderPreviewText(whatsappTemplate, { business_name: data.business, address: data.address || '' }, fieldMappings, senderName)
          )}` : null
        });
        
        statuses[contactId] = data.status || 'new';
        history[contactId] = data.statusHistory || [];
      });
      
      // ✅ AUTO-CLEANUP: Archive irrelevant contacts >30 days old
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const contactsToArchive = contacts.filter(contact => 
        ['not_interested', 'do_not_contact', 'unresponsive'].includes(contact.status) &&
        new Date(contact.lastUpdated) < thirtyDaysAgo &&
        contact.status !== 'archived'
      );
      
      let archivedCount = 0;
      if (contactsToArchive.length > 0) {
        console.log(`🗄️ Auto-archiving ${contactsToArchive.length} irrelevant contacts (>30 days)`);
        // Mark contacts as archived in local state first
        const updatedContacts = contacts.map(contact => {
          if (contactsToArchive.includes(contact)) {
            return { ...contact, status: 'archived', lastUpdated: new Date() };
          }
          return contact;
        });
        
        // Update local state immediately
        setWhatsappLinks(updatedContacts);
        
        // Update statuses
        const updatedStatuses = { ...statuses };
        const updatedHistory = { ...history };
        contactsToArchive.forEach(contact => {
          updatedStatuses[contact.contactId] = 'archived';
          updatedHistory[contact.contactId] = [
            ...(updatedHistory[contact.contactId] || []),
            {
              status: 'archived',
              timestamp: new Date(),
              note: 'Auto-archived: >30 days inactive'
            }
          ];
        });
        setContactStatuses(updatedStatuses);
        setStatusHistory(updatedHistory);
        
        // Then update in Firestore (async, non-blocking)
        contactsToArchive.forEach(async (contact) => {
          try {
            if (db && userId) {
              const contactsRef = collection(db, 'users', userId, 'contacts');
              const q = query(contactsRef, where('email', '==', contact.email || null));
              const snapshot = await getDocs(q);
              if (!snapshot.empty) {
                await updateDoc(doc(db, 'users', userId, 'contacts', snapshot.docs[0].id), {
                  status: 'archived',
                  lastUpdated: serverTimestamp(),
                  statusHistory: [
                    ...(contact.statusHistory || []),
                    {
                      status: 'archived',
                      timestamp: new Date(),
                      note: 'Auto-archived: >30 days inactive'
                    }
                  ]
                });
              }
            }
          } catch (err) {
            console.error(`Failed to archive contact ${contact.contactId}:`, err);
          }
        });
        
        setArchivedContactsCount(contactsToArchive.length);
      } else {
        setWhatsappLinks(contacts);
        setContactStatuses(statuses);
        setStatusHistory(history);
      }
      
    } catch (error) {
      console.error('Failed to load contacts from Firestore:', error);
      alert('Failed to load contact database. Check console for details.');
    } finally {
      setLoadingContacts(false);
    }
  }, [db]); // ✅ FIXED: Only depend on db, not on state variables that cause re-renders

  // ✅ UPDATE CONTACT STATUS (with history tracking) - FIXED DEPENDENCIES
  const updateContactStatus = useCallback(async (contactId, newStatus, note = '') => {
    if (!user?.uid || !contactId || !newStatus || !db) {
      console.warn('Missing required data for status update');
      return false;
    }
    
    // Validate status transition
    const currentStatus = contactStatuses[contactId] || 'new';
    if (currentStatus !== newStatus && 
        !STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) &&
        currentStatus !== 'archived') {
      const validTransitions = STATUS_TRANSITIONS[currentStatus] || [];
      console.warn(`Invalid status transition: ${currentStatus} -> ${newStatus}. Valid:`, validTransitions);
      alert(`Cannot change status from "${currentStatus}" to "${newStatus}".\nValid next statuses: ${validTransitions.join(', ') || 'none'}`);
      return false;
    }
    
    try {
      // Find contact document
      const contactsRef = collection(db, 'users', user.uid, 'contacts');
      const q = query(contactsRef, 
        where('email', '==', contactId.includes('@') ? contactId : null)
      );
      
      let contactDocRef = null;
      let contactData = null;
      
      if (contactId.includes('@')) {
        // Email-based contact
        const emailQuery = query(contactsRef, where('email', '==', contactId));
        const emailSnapshot = await getDocs(emailQuery);
        if (!emailSnapshot.empty) {
          contactDocRef = doc(db, 'users', user.uid, 'contacts', emailSnapshot.docs[0].id);
          contactData = emailSnapshot.docs[0].data();
        }
      } else if (contactId.startsWith('phone_')) {
        // Phone-based contact
        const phone = contactId.replace('phone_', '');
        const phoneQuery = query(contactsRef, where('phone', '==', phone));
        const phoneSnapshot = await getDocs(phoneQuery);
        if (!phoneSnapshot.empty) {
          contactDocRef = doc(db, 'users', user.uid, 'contacts', phoneSnapshot.docs[0].id);
          contactData = phoneSnapshot.docs[0].data();
        }
      }
      
      if (!contactDocRef) {
        console.error('Contact not found in Firestore:', contactId);
        alert('Contact not found in database. Please refresh and try again.');
        return false;
      }
      
      // Prepare status history entry
      const now = new Date();
      const historyEntry = {
        status: newStatus,
        timestamp: now,
        note: note || `Status changed from ${currentStatus} to ${newStatus}`,
        userId: user.uid,
        userName: user.displayName || user.email
      };
      
      // Update contact document
      const updateData = {
        status: newStatus,
        lastUpdated: serverTimestamp(),
        statusHistory: [...(contactData?.statusHistory || []), historyEntry]
      };
      
      // Set lastContacted if moving to contacted status
      if (newStatus === 'contacted' && !contactData?.lastContacted) {
        updateData.lastContacted = serverTimestamp();
      }
      
      // Special handling for closed_won
      if (newStatus === 'closed_won') {
        updateData.closedDate = serverTimestamp();
        updateData.dealValue = 5000; // Default value - could be customized
      }
      
      await updateDoc(contactDocRef, updateData);
      
      // Update local state
      setContactStatuses(prev => ({ ...prev, [contactId]: newStatus }));
      setStatusHistory(prev => ({
        ...prev,
        [contactId]: [...(prev[contactId] || []), historyEntry]
      }));
      
      // Update whatsappLinks state
      setWhatsappLinks(prev => 
        prev.map(contact => 
          contact.contactId === contactId 
            ? { ...contact, status: newStatus, lastUpdated: now }
            : contact
        )
      );
      
      console.log(`✅ Status updated for ${contactId}: ${currentStatus} → ${newStatus}`);
      return true;
      
    } catch (error) {
      console.error('Failed to update contact status:', error);
      alert(`Failed to update status: ${error.message}`);
      return false;
    }
  }, [user, db]); // ✅ FIXED: Removed state dependencies that cause re-renders

  // ✅ SAVE CONTACTS TO FIRESTORE ON CSV UPLOAD - FIXED DEPENDENCIES
  const saveContactsToFirestore = useCallback(async (contacts, userId) => {
    if (!userId || contacts.length === 0 || !db) return;
    
    try {
      // Get existing contacts mapping by email/phone
      const existingContacts = {};
      const contactsRef = collection(db, 'users', userId, 'contacts');
      const snapshot = await getDocs(contactsRef);
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const key = data.email?.toLowerCase().trim() || `phone_${data.phone}`;
        existingContacts[key] = { id: doc.id, ...data };
      });
      
      // Process each contact from CSV
      for (const contact of contacts) {
        const contactKey = contact.email?.toLowerCase().trim() || `phone_${contact.phone}`;
        const now = new Date();
        
        // Prepare contact data for Firestore
        const contactData = {
          business: contact.business || '',
          address: contact.address || '',
          phone: contact.phone || '',
          email: contact.email || null,
          place_id: contact.place_id || '',
          website: contact.website || '',
          instagram: contact.instagram || '',
          twitter: contact.twitter || '',
          facebook: contact.facebook || '',
          youtube: contact.youtube || '',
          tiktok: contact.tiktok || '',
          linkedin_company: contact.linkedin_company || '',
          linkedin_ceo: contact.linkedin_ceo || '',
          linkedin_founder: contact.linkedin_founder || '',
          contact_page_found: contact.contact_page_found || 'No',
          social_media_score: contact.social_media_score || '0',
          email_primary: contact.email_primary || contact.email || '',
          phone_primary: contact.phone_primary || contact.phone || '',
          lead_quality_score: contact.lead_quality_score || '0',
          contact_confidence: contact.contact_confidence || 'Low',
          best_contact_method: contact.best_contact_method || 'Email',
          decision_maker_found: contact.decision_maker_found || 'No',
          tech_stack_detected: contact.tech_stack_detected || '',
          company_size_indicator: contact.company_size_indicator || 'unknown',
          lastUpdated: serverTimestamp(),
          source: 'csv_upload'
        };
        
        // Determine status logic
        if (existingContacts[contactKey]) {
          // Existing contact - preserve status unless it's archived
          const existing = existingContacts[contactKey];
          if (existing.status !== 'archived') {
            contactData.status = existing.status;
            contactData.statusHistory = existing.statusHistory || [];
            contactData.notes = existing.notes || [];
            contactData.lastContacted = existing.lastContacted || null;
          } else {
            // Reactivate archived contact
            contactData.status = 'new';
            contactData.statusHistory = [
              ...(existing.statusHistory || []),
              { status: 'archived', timestamp: existing.lastUpdated || now, note: 'Previously archived' },
              { status: 'new', timestamp: now, note: 'Reactivated via new CSV upload' }
            ];
          }
          contactData.createdAt = existing.createdAt || now;
          
          // Update existing document
          await updateDoc(doc(db, 'users', userId, 'contacts', existing.id), contactData);
        } else {
          // New contact - set initial status
          contactData.status = 'new';
          contactData.statusHistory = [{
            status: 'new',
            timestamp: now,
            note: 'Imported via CSV upload'
          }];
          contactData.notes = [];
          contactData.createdAt = serverTimestamp();
          contactData.lastContacted = null;
          
          // Create new document
          await addDoc(contactsRef, contactData);
        }
      }
      
      // Reload contacts after save - but avoid circular dependency
      // Instead of calling loadContactsFromFirestore, just update the local state
      const updatedContacts = contacts.map(contact => ({
        ...contact,
        status: 'new', // Default status for new uploads
        lastUpdated: new Date()
      }));
      
      setWhatsappLinks(updatedContacts);
      
      const updatedStatuses = {};
      const updatedHistory = {};
      updatedContacts.forEach(contact => {
        updatedStatuses[contact.contactId] = contact.status;
        updatedHistory[contact.contactId] = contact.statusHistory || [];
      });
      
      setContactStatuses(updatedStatuses);
      setStatusHistory(updatedHistory);
      
    } catch (error) {
      console.error('Failed to save contacts to Firestore:', error);
      throw error;
    }
  }, [db]); // ✅ FIXED: Only depend on db, not on state variables

  // ✅ HANDLE CSV UPLOAD WITH FIRESTORE INTEGRATION - FIXED DEPENDENCIES
  const handleCsvUpload = useCallback(async (e) => {
    setValidEmails(0);
    setValidWhatsApp(0);
    setWhatsappLinks([]);
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const rawContent = e.target.result;
      const normalizedContent = rawContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const lines = normalizedContent.split('\n').filter(line => line.trim() !== '');
      if (lines.length < 2) {
        alert('CSV must have headers and data rows.');
        return;
      }
      
      const headers = parseCsvRow(lines[0]).map(h => h.trim());
      setCsvHeaders(headers);
      setPreviewRecipient(null);
      
      // ✅ Expose all possible variables + CSV headers for mapping
      const allTemplateTexts = [
        templateA.subject, templateA.body,
        templateB.subject, templateB.body,
        whatsappTemplate,
        smsTemplate
      ];
      const allVars = [...new Set([
        ...allTemplateTexts.flatMap(text => extractTemplateVariables(text)),
        'sender_name',
        ...emailImages.map(img => img.placeholder.replace(/{{|}}/g, '')),
        ...headers
      ])];
      const initialMappings = {};
      allVars.forEach(varName => {
        if (headers.includes(varName)) {
          initialMappings[varName] = varName;
        }
      });
      if (headers.includes('email')) initialMappings.email = 'email';
      initialMappings.sender_name = 'sender_name';
      setFieldMappings(initialMappings);
      
      // ✅ Lead processing with lead_quality column presence check
      let hotEmails = 0, warmEmails = 0;
      const validPhoneContacts = [];
      const newLeadScores = {};
      const newLastSent = {};
      let firstValid = null;
      
      // ✅ CRITICAL: Only filter by leadQuality if column exists
      const hasLeadQualityCol = headers.includes('lead_quality');
      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvRow(lines[i]);
        if (values.length !== headers.length) continue;
        const row = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });
        
        // ✅ Include email only if valid AND passes quality filter (if applicable)
        let includeEmail = true;
        if (hasLeadQualityCol) {
          const quality = (row.lead_quality || '').trim() || 'HOT';
          if (leadQualityFilter !== 'all' && quality !== leadQualityFilter) {
            includeEmail = false;
          }
        }
        const hasValidEmail = isValidEmail(row.email);
        if (hasValidEmail && includeEmail) {
          let score = 50;
          const quality = (row.lead_quality || '').trim() || 'HOT';
          if (quality === 'HOT') score += 30;
          if (parseFloat(row.rating) >= 4.8) score += 20;
          if (parseInt(row.review_count) > 100) score += 10;
          if (clickStats[row.email]?.count > 0) score += 20;
          score = Math.min(100, Math.max(0, score));
          newLeadScores[row.email] = score;
          if (!hasLeadQualityCol || quality === 'HOT') {
            hotEmails++;
          } else if (quality === 'WARM') {
            warmEmails++;
          }
          if (!firstValid) firstValid = row;
        }
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
            // ✅ ALL SOCIAL MEDIA & OUTREACH FIELDS
            instagram: row.instagram || '',
            twitter: row.twitter || '',
            facebook: row.facebook || '',
            youtube: row.youtube || '',
            tiktok: row.tiktok || '',
            linkedin_company: row.linkedin_company || '',
            linkedin_ceo: row.linkedin_ceo || '',
            linkedin_founder: row.linkedin_founder || '',
            contact_page_found: row.contact_page_found || 'No',
            social_media_score: row.social_media_score || '0',
            email_primary: row.email_primary || row.email || '',
            phone_primary: row.phone_primary || formattedPhone || '',
            lead_quality_score: row.lead_quality_score || '0',
            contact_confidence: row.contact_confidence || 'Low',
            best_contact_method: row.best_contact_method || 'Email',
            decision_maker_found: row.decision_maker_found || 'No',
            tech_stack_detected: row.tech_stack_detected || '',
            company_size_indicator: row.company_size_indicator || 'unknown',
            status: 'new', // Initial status
            lastContacted: null,
            createdAt: new Date(),
            lastUpdated: new Date(),
            statusHistory: [{
              status: 'new',
              timestamp: new Date(),
              note: 'Imported via CSV upload'
            }]
          });
          if (!firstValid) firstValid = row;
        }
      }
      
      setPreviewRecipient(firstValid);
      if (leadQualityFilter === 'HOT') setValidEmails(hotEmails);
      else if (leadQualityFilter === 'WARM') setValidEmails(warmEmails);
      else setValidEmails(hotEmails + warmEmails);
      setValidWhatsApp(validPhoneContacts.length);
      
      // ✅ SAVE TO FIRESTORE INSTEAD OF JUST SETTING STATE
      if (user?.uid && db) {
        try {
          setStatus('💾 Saving contacts to database...');
          await saveContactsToFirestore(validPhoneContacts, user.uid);
          setStatus(`✅ ${validPhoneContacts.length} contacts saved to database!`);
        } catch (error) {
          console.error('CSV save error:', error);
          setStatus(`❌ Failed to save contacts: ${error.message}`);
          alert(`Failed to save contacts to database: ${error.message}`);
          // Fallback: set local state only
          setWhatsappLinks(validPhoneContacts);
        }
      } else {
        // Fallback if not authenticated (shouldn't happen)
        setWhatsappLinks(validPhoneContacts);
      }
      
      setLeadScores(newLeadScores);
      setLastSent(newLastSent);
      setCsvContent(normalizedContent);
    };
    reader.readAsText(file);
  }, [user, db, leadQualityFilter, templateA, templateB, whatsappTemplate, smsTemplate, emailImages, clickStats, saveContactsToFirestore]); // ✅ FIXED: Added all required dependencies

  // ✅ SEND SAFETY RULES - FIXED DEPENDENCIES
  const checkSendSafety = useCallback(() => {
    const today = new Date().toDateString();
    const todaySent = sentEmails?.filter(e => e.sentAt && (new Date(e.sentAt).toDateString() === today)).length || 0;
    
    if (todaySent >= sendSafety.maxPerDay) {
      setSendSafety(prev => ({ ...prev, paused: true, currentDaySent: todaySent }));
      return false;
    }
    
    if (kpis.bounces > 0 && (kpis.bounces / kpis.sent) > 0.05) {
      setSendSafety(prev => ({ ...prev, paused: true, currentDaySent: todaySent }));
      return false;
    }
    
    setSendSafety(prev => ({ ...prev, currentDaySent: todaySent }));
    return true;
  }, [sentEmails, kpis, sendSafety]); // ✅ FIXED: Correct dependencies

  // ✅ AI-ENHANCED RESEARCH - FIXED DEPENDENCIES
  const performAIResearch = useCallback(async (contactId) => {
    if (!useAI) return;
    
    setResearchingCompany(contactId);
    setAiStatus('loading');
    
    try {
      const contact = whatsappLinks.find(c => c.contactId === contactId);
      if (!contact) return;
      
      // Simulate AI research (replace with actual API call)
      const response = await fetch('/api/research-target', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: contact.business,
          website: contact.website,
          icp: TIGHT_ICP
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setResearchResults(prev => ({
          ...prev,
          [contactId]: {
            strategy: result.data.strategy || 'Focus on their recent funding round and scaling challenges',
            insights: result.data.insights || [
              'Recently raised Series A funding',
              'Hiring for engineering roles',
              'Expanding to European markets'
            ],
            approach: result.data.approach || 'Lead with value proposition around scaling customer acquisition efficiently',
            emailTemplate: result.data.emailTemplate || `Hi ${contact.business},

Noticed your recent growth and wanted to reach out about helping you scale customer acquisition without burning through cash.

We specialize in helping Series A-C SaaS companies add 15-25 qualified leads per month.

Worth a quick chat?

Best,
${senderName}`
          }
        }));
      }
    } catch (error) {
      console.error('AI Research failed:', error);
    } finally {
      setResearchingCompany(null);
      setAiStatus('available');
    }
  }, [useAI, whatsappLinks, senderName]); // ✅ FIXED: Correct dependencies

  // ✅ STATUS BADGE COMPONENT - MEMOIZED TO PREVENT RE-RENDERS
  const StatusBadge = useMemo(() => ({ status, small = false }) => {
    const statusInfo = CONTACT_STATUSES.find(s => s.id === status);
    if (!statusInfo) return null;
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
        small ? 'text-xs' : 'text-sm'
      } ${statusInfo.color === 'gray' ? 'bg-gray-600 text-gray-300' :
        statusInfo.color === 'blue' ? 'bg-blue-600 text-blue-100' :
        statusInfo.color === 'indigo' ? 'bg-indigo-600 text-indigo-100' :
        statusInfo.color === 'green' ? 'bg-green-600 text-green-100' :
        statusInfo.color === 'purple' ? 'bg-purple-600 text-purple-100' :
        statusInfo.color === 'orange' ? 'bg-orange-600 text-orange-100' :
        statusInfo.color === 'emerald' ? 'bg-emerald-600 text-emerald-100' :
        statusInfo.color === 'red' ? 'bg-red-600 text-red-100' :
        statusInfo.color === 'rose' ? 'bg-rose-600 text-rose-100' : 'bg-gray-600 text-gray-300'
      }`}>
        {statusInfo.label}
      </span>
    );
  }, []);

  // ✅ STATUS DROPDOWN COMPONENT - MEMOIZED TO PREVENT RE-RENDERS
  const StatusDropdown = useMemo(() => ({ contact, compact = false }) => {
    const currentStatus = contact.status || 'new';
    const statusInfo = CONTACT_STATUSES.find(s => s.id === currentStatus);
    
    return (
      <div className="relative">
        <button
          onClick={() => {
            setSelectedContactForStatus(contact);
            setShowStatusModal(true);
            setStatusNote('');
          }}
          className={`inline-flex items-center justify-between w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            compact ? 'text-xs' : 'text-sm'
          } ${statusInfo.color === 'gray' ? 'bg-gray-600 text-gray-300' :
            statusInfo.color === 'blue' ? 'bg-blue-600 text-blue-100' :
            statusInfo.color === 'indigo' ? 'bg-indigo-600 text-indigo-100' :
            statusInfo.color === 'green' ? 'bg-green-600 text-green-100' :
            statusInfo.color === 'purple' ? 'bg-purple-600 text-purple-100' :
            statusInfo.color === 'orange' ? 'bg-orange-600 text-orange-100' :
            statusInfo.color === 'emerald' ? 'bg-emerald-600 text-emerald-100' :
            statusInfo.color === 'red' ? 'bg-red-600 text-red-100' :
            statusInfo.color === 'rose' ? 'bg-rose-600 text-rose-100' : 'bg-gray-600 text-gray-300'
          }`}
        >
          <span>{statusInfo.label}</span>
          <svg className="w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 12.586l-4.293 4.293a1 1 0 111.414 0L10 14.586l4.293 4.293a1 1 0 011.414 0L5.293 7.293z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    );
  }, []);

  // ✅ GET FILTERED CONTACTS - MEMOIZED TO PREVENT RE-RENDERS
  const getFilteredContacts = useMemo(() => {
    let filtered = [...whatsappLinks];
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }
    
    return filtered;
  }, [whatsappLinks, statusFilter]); // ✅ FIXED: Memoized to prevent re-renders

  // ✅ HANDLE STATUS CHANGE FROM UI - FIXED DEPENDENCIES
  const handleStatusChange = useCallback(async (contact, newStatus) => {
    if (!contact?.contactId) {
      console.error('Invalid contact for status change:', contact);
      return;
    }
    
    // Special handling for "not_interested" and "do_not_contact"
    if (['not_interested', 'do_not_contact'].includes(newStatus)) {
      const confirmed = confirm(
        `⚠️ Marking "${contact.business}" as "${newStatus}"\n\n` +
        `This will:\n` +
        `• Stop all automated follow-ups\n` +
        `• Archive contact after 30 days of inactivity\n` +
        `• Require manual reactivation to contact again\n\n` +
        `Are you sure?` 
      );
      if (!confirmed) return;
    }
    
    // Show note modal for important status changes
    if (['not_interested', 'do_not_contact', 'closed_won', 'demo_scheduled'].includes(newStatus)) {
      setSelectedContactForStatus(contact);
      setStatusNote('');
      setShowStatusModal(true);
      return;
    }
    
    // Direct update for simple status changes
    await updateContactStatus(contact.contactId, newStatus);
  }, [updateContactStatus]); // ✅ FIXED: Correct dependencies

  // ✅ HANDLE STATUS MODAL SUBMIT - FIXED DEPENDENCIES
  const handleStatusModalSubmit = useCallback(async () => {
    if (!selectedContactForStatus?.contactId || !statusNote.trim()) {
      alert('Please add a note explaining this status change.');
      return;
    }
    
    const success = await updateContactStatus(
      selectedContactForStatus.contactId, 
      selectedContactForStatus.status || 'new',
      statusNote.trim()
    );
    
    if (success) {
      setShowStatusModal(false);
      setSelectedContactForStatus(null);
      setStatusNote('');
    }
  }, [selectedContactForStatus, statusNote, updateContactStatus]); // ✅ FIXED: Correct dependencies

  // ✅ HANDLE WHATSAPP CLICK - FIXED DEPENDENCIES
  const handleWhatsAppClick = useCallback((contact) => {
    setKpis(prev => ({ ...prev, clicks: prev.clicks + 1 }));
    setClickStats(prev => ({
      ...prev,
      [contact.email]: { count: (prev[contact.email]?.count || 0) + 1, lastClicked: new Date() }
    }));
  }, []); // ✅ FIXED: No dependencies needed

  // ✅ HANDLE CALL - FIXED DEPENDENCIES
  const handleCall = useCallback((phone) => {
    if (!phone || typeof window === 'undefined') return;
    window.open(`tel:${phone}`, '_blank');
  }, []); // ✅ FIXED: No dependencies needed

  // ✅ HANDLE SEND EMAILS WITH STATUS UPDATE - FIXED DEPENDENCIES
  const handleSendEmails = useCallback(async (templateToSend = templateA) => {
    if (!checkSendSafety()) {
      alert('⚠️ Send safety limit reached. Please try again tomorrow.');
      return;
    }
    
    setIsSending(true);
    setStatus('📤 Sending emails...');
    
    try {
      const validContacts = whatsappLinks.filter(contact => 
        contact.email && isValidEmail(contact.email)
      );
      
      if (validContacts.length === 0) {
        alert('No valid email addresses found.');
        return;
      }
      
      // Process emails in batches
      const batchSize = 10;
      for (let i = 0; i < validContacts.length; i += batchSize) {
        const batch = validContacts.slice(i, i + batchSize);
        
        const emailPromises = batch.map(async (contact) => {
          const subject = renderPreviewText(templateToSend.subject, contact, fieldMappings, senderName);
          const body = renderPreviewText(templateToSend.body, contact, fieldMappings, senderName);
          
          const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: contact.email,
              subject,
              body,
              contactId: contact.contactId
            })
          });
          
          if (response.ok) {
            await updateContactStatus(contact.contactId, 'contacted', 'Email sent via bulk send');
            setKpis(prev => ({ ...prev, sent: prev.sent + 1 }));
            setLastSent(prev => ({ ...prev, [contact.email]: new Date().toISOString() }));
            setSentEmails(prev => [...prev, {
              id: `email_${Date.now()}_${Math.random()}`,
              to: contact.email,
              subject,
              body,
              sentAt: new Date().toISOString(),
              contactId: contact.contactId
            }]);
          }
          
          return response.ok;
        });
        
        await Promise.all(emailPromises);
        
        // Small delay between batches to respect rate limits
        if (i + batchSize < validContacts.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      setStatus(`✅ Emails sent successfully!`);
      setAbResults(prev => ({
        ...prev,
        a: { ...prev.a, sent: prev.a.sent + Math.floor(validContacts.length / 2) }
      }));
      
    } catch (error) {
      console.error('Email sending error:', error);
      setStatus(`❌ Failed to send emails: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  }, [whatsappLinks, fieldMappings, senderName, templateA, checkSendSafety, updateContactStatus, setKpis, setLastSent, setSentEmails]); // ✅ FIXED: Correct dependencies

  // Auth effect - MOVED AFTER ALL CALLBACK DECLARATIONS - FIXED DEPENDENCIES
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
  }, [auth, loadContactsFromFirestore]); // ✅ FIXED: Correct dependencies

  if (loadingAuth) {
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
        <div className="text-center max-w-md mx-auto p-6">
          <h1 className="text-3xl font-bold mb-6">Final Optimal B2B Sales Machine</h1>
          <p className="text-gray-400 mb-4">Best of Both Worlds: Complete Manual Control + Strategic AI Enhancement</p>
          <p className="text-gray-400 mb-8">Your Business • Your Templates • Advanced Analytics</p>
          <button
            onClick={() => {
              if (auth) {
                const provider = new GoogleAuthProvider();
                signInWithPopup(auth, provider);
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <Head>
        <title>Final Optimal B2B Sales Machine</title>
        <meta name="description" content="Best of both worlds: Complete manual control + Strategic AI enhancement" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      {/* Animated Background Pattern */}
      <div className="fixed inset-0 opacity-5 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-600/10 animate-pulse"></div>
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-2v-4h-2v4h-2v-4h-2v4h-2v-4h-2v4h-2v-4h-2v4h-2v-4h-2v4h-2v-4h-2v4z'/%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
      </div>

      {/* Header */}
      <div className="bg-gray-800/90 backdrop-blur-md border-b border-gray-700/50 p-4 sticky top-0 z-50 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-y-2 lg:space-y-0">
            <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Final Optimal Sales Machine
            </h1>
            <p className="text-gray-400 text-sm lg:text-base">Complete Manual Control + Strategic AI Enhancement</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 justify-center lg:justify-end">
            {/* AI Toggle */}
            <div className="flex items-center gap-2 bg-gray-700/80 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-gray-600/50 shadow-lg">
              <span className="text-sm font-medium">AI:</span>
              <button
                onClick={() => setUseAI(!useAI)}
                className={`relative px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-300 transform hover:scale-105 ${
                  useAI 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-green-500/25' 
                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
              >
                {useAI ? 'ON' : 'OFF'}
                <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${
                  aiStatus === 'available' ? 'bg-green-400' : 
                  aiStatus === 'loading' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'
                }`}></span>
              </button>
            </div>
            
            {/* Send Safety Status */}
            <div className="flex items-center gap-2 bg-gray-700/80 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-gray-600/50 shadow-lg">
              <span className="text-sm font-medium">Safety:</span>
              <span className={`px-3 py-1 rounded-lg text-xs font-bold transition-all duration-300 ${
                sendSafety.paused 
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-500/25' 
                  : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-green-500/25'
              }`}>
                {sendSafety.paused ? 'PAUSED' : 'ACTIVE'}
              </span>
              <span className="text-xs text-gray-400 font-medium">
                {sendSafety.currentDaySent}/{sendSafety.maxPerDay}
              </span>
            </div>
            
            {/* User Info & Sign Out */}
            <div className="flex items-center gap-4">
              <div className="text-right hidden lg:block">
                <p className="text-sm text-gray-400">Welcome</p>
                <p className="font-semibold text-white">{user.displayName}</p>
              </div>
              <button
                onClick={() => {
                  if (auth) {
                    signOut(auth);
                  }
                }}
                className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-red-500/25"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Dashboard */}
      <div className="bg-gray-800/90 backdrop-blur-md border-b border-gray-700/50 p-4 lg:p-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
          <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/20 backdrop-blur-sm p-4 lg:p-6 rounded-2xl border border-blue-500/20 shadow-2xl shadow-blue-500/10">
            <div className="flex items-center justify-between mb-2">
              <p className="text-blue-300 text-sm font-medium">Sent</p>
              <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a12 12 0 0118.68 5.68L12 22l2.32-9.68A12 12 0 0021.32 2.32L3 8z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl lg:text-4xl font-bold text-white mb-1">{kpis.sent}</p>
            <p className="text-xs text-blue-300 font-medium">Today: {sendSafety.currentDaySent}</p>
            <div className="mt-2 h-1 bg-gradient-to-r from-blue-500/50 to-transparent rounded-full"></div>
          </div>
          
          <div className="bg-gradient-to-br from-green-600/20 to-emerald-700/20 backdrop-blur-sm p-4 lg:p-6 rounded-2xl border border-green-500/20 shadow-2xl shadow-green-500/10">
            <div className="flex items-center justify-between mb-2">
              <p className="text-green-300 text-sm font-medium">Replies</p>
              <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 1.664-1.344 3-3 3s-3-1.336-3-3 1.344-3 3-3 3 1.336 3 3z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl lg:text-4xl font-bold text-white mb-1 text-green-400">{kpis.replies}</p>
            <p className="text-xs text-green-300 font-medium">
              {kpis.sent > 0 ? ((kpis.replies/kpis.sent)*100).toFixed(1) : 0}%
            </p>
            <div className="mt-2 h-1 bg-gradient-to-r from-green-500/50 to-transparent rounded-full"></div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-600/20 to-purple-700/20 backdrop-blur-sm p-4 lg:p-6 rounded-2xl border border-purple-500/20 shadow-2xl shadow-purple-500/10">
            <div className="flex items-center justify-between mb-2">
              <p className="text-purple-300 text-sm font-medium">Meetings</p>
              <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-4z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl lg:text-4xl font-bold text-white mb-1 text-purple-400">{kpis.meetings}</p>
            <p className="text-xs text-purple-300 font-medium">
              {kpis.sent > 0 ? ((kpis.meetings/kpis.sent)*100).toFixed(1) : 0}%
            </p>
            <div className="mt-2 h-1 bg-gradient-to-r from-purple-500/50 to-transparent rounded-full"></div>
          </div>
          
          <div className="bg-gradient-to-br from-red-600/20 to-red-700/20 backdrop-blur-sm p-4 lg:p-6 rounded-2xl border border-red-500/20 shadow-2xl shadow-red-500/10">
            <div className="flex items-center justify-between mb-2">
              <p className="text-red-300 text-sm font-medium">Bounces</p>
              <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl lg:text-4xl font-bold text-white mb-1 text-red-400">{kpis.bounces}</p>
            <p className="text-xs text-red-300 font-medium">
              {kpis.sent > 0 ? ((kpis.bounces/kpis.sent)*100).toFixed(1) : 0}%
            </p>
            <div className="mt-2 h-1 bg-gradient-to-r from-red-500/50 to-transparent rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto p-4 lg:p-6">
        <div className="flex space-x-1 lg:space-x-2 mb-6 lg:mb-8 bg-gray-800/80 backdrop-blur-md p-1.5 lg:p-2 rounded-2xl shadow-2xl">
          {['targets', 'templates', 'send', 'analytics'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 lg:py-4 px-3 lg:px-6 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <span className="flex items-center justify-center space-x-2">
                {tab === 'targets' && (
                  <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-3-3H5a3 3 0 00-3 3v14m11-9l-4-4m0 0L5 16m4-4l0 0" />
                  </svg>
                )}
                {tab === 'templates' && (
                  <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2v-4a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2z" />
                  </svg>
                )}
                {tab === 'send' && (
                  <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a12 12 0 0118.68 5.68L12 22l2.32-9.68A12 12 0 0021.32 2.32L3 8z" />
                  </svg>
                )}
                {tab === 'analytics' && (
                  <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 00-2 2H8a2 2 0 00-2 2v4a2 2 0 002 2h2a2 2 0 002-2V9z" />
                  </svg>
                )}
                <span className="hidden sm:inline lg:inline font-medium">
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </span>
              </span>
            </button>
          ))}
        </div>

        {/* TARGETS TAB */}
        {activeTab === 'targets' && (
          <div className="space-y-6 lg:space-y-8">
            <div className="bg-gray-800/90 backdrop-blur-md p-6 lg:p-8 rounded-2xl shadow-2xl border border-gray-700/50">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-6 lg:mb-8 gap-4">
                <div className="flex items-center space-y-2 lg:space-y-0">
                  <h2 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    Contact Management
                  </h2>
                  <p className="text-gray-400 text-sm lg:text-base">Manage your leads with advanced status tracking</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvUpload}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload" className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-xl cursor-pointer transition-all duration-300 transform hover:scale-105 shadow-lg shadow-blue-500/25 font-semibold flex items-center justify-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 11a4 4 0 01-4 4v0M14 2a2 2 0 012-2v-4a2 2 0 00-2-2H8a2 2 0 00-2 2v4a2 2 0 002 2h6a2 2 0 002-2v4a2 2 0 002 2z" />
                    </svg>
                    <span>Upload CSV</span>
                  </label>
                </div>
              </div>

              {whatsappLinks.length === 0 && (
                <div className="text-center py-12 lg:py-16 text-gray-400">
                  <div className="text-6xl lg:text-8xl mb-6 animate-bounce">📥</div>
                  <h2 className="text-2xl lg:text-3xl font-bold mb-4">Upload Your First Lead List</h2>
                  <p className="text-gray-400 text-base lg:text-lg mb-6 max-w-md mx-auto">
                    Start by uploading a CSV file with your leads. We'll automatically save contacts to your database with full status tracking and advanced analytics.
                  </p>
                  <div className="flex justify-center">
                    <label htmlFor="csv-upload" className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-8 py-4 rounded-xl cursor-pointer transition-all duration-300 transform hover:scale-105 shadow-lg shadow-green-500/25 font-semibold text-lg flex items-center space-x-3">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 11a4 4 0 01-4 4v0M14 2a2 2 0 012-2v-4a2 2 0 00-2-2H8a2 2 0 00-2 2v4A2 2 0 002 2h6a2 2 0 002 2v4a2 2 0 002 2z" />
                      </svg>
                      <span>Get Started</span>
                    </label>
                  </div>
                </div>
              )}

              {whatsappLinks.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
                  {getFilteredContacts().map((contact, index) => {
                    const contactKey = contact.email || contact.phone;
                    const last = contact.lastContacted;
                    const score = leadScores[contact.email] || 0;
                    
                    return (
                      <div 
                        key={contact.id} 
                        className="bg-gradient-to-br from-gray-700/80 to-gray-800/80 backdrop-blur-sm p-5 lg:p-6 rounded-2xl border border-gray-600/50 hover:border-blue-500/50 transition-all duration-300 transform hover:scale-102 hover:shadow-2xl hover:shadow-blue-500/10"
                        style={{
                          animationDelay: `${index * 100}ms`
                        }}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-white text-base lg:text-lg mb-2 truncate">{contact.business}</h3>
                            <div className="flex items-center text-sm text-gray-400 mb-2">
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2v3a2 2 0 012 2h6a2 2 0 012-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2zm0 2a1 1 0 011 1h6a1 1 0 011 1v1a1 1 0 011-1h6a1 1 0 011-1v-1z" />
                              </svg>
                              <span className="truncate">+{contact.phone}</span>
                            </div>
                            {contact.email && (
                              <div className="flex items-center text-xs text-blue-400 mb-2">
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a12 12 0 0118.68 5.68L12 22l2.32-9.68A12 12 0 0021.32 2.32L3 8z" />
                                </svg>
                                <span className="truncate">{contact.email}</span>
                              </div>
                            )}
                          </div>
                          <div className="ml-3 flex-shrink-0">
                            <StatusDropdown contact={contact} />
                          </div>
                        </div>
                        
                        <div className="space-y-3 mb-4">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-300 font-medium">Lead Score</span>
                            <div className="flex items-center space-x-2">
                              <div className="w-16 bg-gray-600 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full transition-all duration-500 ${
                                    score >= 70 ? 'bg-gradient-to-r from-green-400 to-green-500 w-full' : 
                                    score >= 50 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' : 
                                    'bg-gradient-to-r from-orange-400 to-orange-500'
                                  }`}
                                  style={{ width: `${score}%` }}
                                ></div>
                              </div>
                              <span className={`font-bold text-xs ${
                                score >= 70 ? 'text-green-400' : 
                                score >= 50 ? 'text-yellow-400' : 'text-orange-400'
                              }`}>
                                {score}/100
                              </span>
                            </div>
                          </div>
                          
                          {last && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-300 font-medium">Last Contacted</span>
                              <span className="text-green-400 font-medium bg-green-500/20 px-2 py-1 rounded-lg">
                                {new Date(last).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-300 font-medium">Status</span>
                            <StatusBadge status={contact.status} />
                          </div>
                        </div>
                        
                        <div className="pt-4 border-t border-gray-700/50">
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              onClick={() => handleCall(contact.phone)}
                              className="p-2 lg:p-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl text-xs font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center justify-center space-x-1"
                              title="Direct call"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2v3a2 2 0 012 2h6a2 2 0 012-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2zm0 2a1 1 0 011 1h6a1 1 0 011 1v1a1 1 0 011-1h6a1 1 0 011-1v-1z" />
                              </svg>
                              <span className="hidden sm:inline lg:inline">Call</span>
                            </button>
                            <a
                              href={contact.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => handleWhatsAppClick(contact)}
                              className="p-2 lg:p-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl text-xs font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center justify-center space-x-1 block text-center"
                              title="WhatsApp"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-.461-.296-.597-.296-.653 0-1.208.021-1.877.053l-2.694.518c-.355-.07-.576-.206-.785-.206-.631 0-1.159.021-1.838.053l-2.694.518c-.355-.07-.576-.206-.785-.206-.631 0-1.159.021-1.838.053l-2.694.518c-.355-.07-.576-.206-.785-.206-.631 0-1.159.021-1.838.053l-2.694.518c-.355-.07-.576-.206-.785-.206-.631 0-1.159.021-1.838.053l-2.694.518c-.355-.07-.576-.206-.785-.206-.631 0-1.159.021-1.838.053l-2.694.518c-.355-.07-.576-.206-.785-.206-.631 0-1.159.021-1.838.053l-2.694.518c-.355-.07-.576-.206-.785-.206-.631 0-1.159.021-1.838.053l-2.694.518c-.355-.07-.576-.206-.785-.206-.631 0-1.159.021-1.838.053l-2.694.518c-.355-.07-.576-.206-.785-.206-.631 0-1.159.021-1.838.053l-2.694.518c-.355-.07-.576-.206-.785-.206-.631 0-1.159.021-1.838.053l-2.694.518c-.355-.07-.576-.206-.785-.206-.631 0-1.159.021-1.838.053l-2.694.518c-.355-.07-.576-.206-.785-.206-.631 0-1.159.021-1.838.053l-2.694.518c-.355-.07-.576-.206-.785-.206-.631 0-1.159.021-1.838.053z" />
                              </svg>
                              <span className="hidden sm:inline lg:inline">WhatsApp</span>
                            </a>
                            {contact.email && (
                              <button
                                onClick={() => performAIResearch(contact.contactId)}
                                disabled={!useAI || researchingCompany === contact.contactId}
                                className="p-2 lg:p-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl text-xs font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center justify-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="AI Research"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l.536.536m0 0l-.536.536" />
                                </svg>
                                <span className="hidden sm:inline lg:inline">
                                  {researchingCompany === contact.contactId ? '⏳' : '🧠'} AI Research
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TEMPLATES TAB */}
        {activeTab === 'templates' && (
          <div className="space-y-6 lg:space-y-8">
            <div className="bg-gray-800/90 backdrop-blur-md p-6 lg:p-8 rounded-2xl shadow-2xl border border-gray-700/50">
              <h2 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-6 lg:mb-8">
                Email Templates
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                <div className="space-y-4 lg:space-y-6">
                  <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/20 backdrop-blur-sm p-6 lg:p-8 rounded-2xl border border-blue-500/20 shadow-2xl">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg lg:text-xl font-semibold text-blue-300">Your Initial Pitch</h3>
                      <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2z" />
                        </svg>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-blue-300 mb-2">Subject</label>
                        <input
                          type="text"
                          value={templateA.subject}
                          onChange={(e) => setTemplateA(prev => ({ ...prev, subject: e.target.value }))}
                          className="w-full bg-gray-700/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-blue-500/50 focus:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-300"
                          placeholder="Enter email subject..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-300 mb-2">Body</label>
                        <textarea
                          value={templateA.body}
                          onChange={(e) => setTemplateA(prev => ({ ...prev, body: e.target.value }))}
                          rows={12}
                          className="w-full bg-gray-700/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-blue-500/50 focus:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 font-mono text-sm"
                          placeholder="Write your email content..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4 lg:space-y-6">
                  <div className="bg-gradient-to-br from-purple-600/20 to-purple-700/20 backdrop-blur-sm p-6 lg:p-8 rounded-2xl border border-purple-500/20 shadow-2xl">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg lg:text-xl font-semibold text-purple-300">AI-Enhanced Templates</h3>
                      <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 3h4.674M12 3h4.674M12 3v4.674M16 3h4.674M12 3v4.674M16 3v4.674M12 8v4.674M16 8v4.674M12 8v4.674M16 8v4.674M12 13v4.674M16 13v4.674M12 13v4.674M16 13v4.674" />
                        </svg>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {Object.entries(CONTROLLED_TEMPLATES).map(([key, template]) => (
                        <div key={key} className="bg-gray-700/50 backdrop-blur-sm p-4 lg:p-6 rounded-xl border border-gray-600/50 hover:border-purple-500/50 transition-all duration-300">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-white text-base lg:text-lg">{template.name}</h4>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-400">Word count:</span>
                              <span className="text-xs font-bold text-purple-400 bg-purple-500/20 px-2 py-1 rounded-lg">{template.wordCount}</span>
                            </div>
                          </div>
                          <p className="text-purple-300 text-sm font-medium mb-2">{template.subject}</p>
                          <pre className="text-xs text-gray-400 whitespace-pre-wrap bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">{template.body.substring(0, 200)}...</pre>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SEND TAB */}
        {activeTab === 'send' && (
          <div className="space-y-6 lg:space-y-8">
            <div className="bg-gray-800/90 backdrop-blur-md p-6 lg:p-8 rounded-2xl shadow-2xl border border-gray-700/50">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-6 lg:mb-8 gap-4">
                <div className="space-y-2">
                  <h2 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                    Send Emails
                  </h2>
                  <p className="text-gray-400 text-sm lg:text-base">Send personalized emails to your qualified leads</p>
                </div>
                <button
                  onClick={() => handleSendEmails()}
                  disabled={isSending || !checkSendSafety()}
                  className={`px-6 lg:px-8 py-3 lg:py-4 rounded-2xl text-base lg:text-lg font-bold transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center justify-center space-x-3 ${
                    isSending || !checkSendSafety()
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-green-500/25'
                  }`}
                >
                  {isSending ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-transparent rounded-full animate-spin"></div>
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a12 12 0 0118.68 5.68L12 22l2.32-9.68A12 12 0 0021.32 2.32L3 8z" />
                      </svg>
                      <span>Send to All Valid Emails</span>
                    </>
                  )}
                </button>
              </div>
              
              {previewRecipient && (
                <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/20 backdrop-blur-sm p-6 lg:p-8 rounded-2xl border border-blue-500/20 shadow-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg lg:text-xl font-semibold text-blue-300">Preview: {previewRecipient.business}</h3>
                    <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm-2 0a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1v-4a1 1 0 00-1-1z" />
                      </svg>
                    </div>
                  </div>
                  <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl border border-gray-700/50">
                    <div className="mb-3">
                      <p className="text-sm font-medium text-blue-300 mb-2">Subject Preview</p>
                      <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-600/50">
                        <p className="text-blue-400 font-semibold text-base lg:text-lg">{renderPreviewText(templateA.subject, previewRecipient, fieldMappings, senderName)}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-300 mb-2">Body Preview</p>
                      <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-600/50">
                        <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">{renderPreviewText(templateA.body, previewRecipient, fieldMappings, senderName)}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-green-600/20 to-emerald-700/20 backdrop-blur-sm p-4 lg:p-6 rounded-2xl border border-green-500/20 shadow-2xl">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a12 12 0 0118.68 5.68L12 22l2.32-9.68A12 12 0 0021.32 2.32L3 8z" />
                      </svg>
                    </div>
                    <p className="text-2xl lg:text-3xl font-bold text-white mb-1">{validEmails}</p>
                    <p className="text-sm text-green-300 font-medium">Valid Emails</p>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/20 backdrop-blur-sm p-4 lg:p-6 rounded-2xl border border-blue-500/20 shadow-2xl">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382s-.497.801-.497-1.99c0-1.188.4-1.99 1.188-1.99h2.99c1.188 0 1.99.4 1.99.4v.01z" />
                      </svg>
                    </div>
                    <p className="text-2xl lg:text-3xl font-bold text-white mb-1">{validWhatsApp}</p>
                    <p className="text-sm text-blue-300 font-medium">Valid WhatsApp</p>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-purple-600/20 to-purple-700/20 backdrop-blur-sm p-4 lg:p-6 rounded-2xl border border-purple-500/20 shadow-2xl">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-3-3H5a3 3 0 00-3-3v14m11-9l-4-4m0 0L5 16m4-4l0 0" />
                      </svg>
                    </div>
                    <p className="text-2xl lg:text-3xl font-bold text-white mb-1">{whatsappLinks.length}</p>
                    <p className="text-sm text-purple-300 font-medium">Total Contacts</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <div className="space-y-6 lg:space-y-8">
            <div className="bg-gray-800/90 backdrop-blur-md p-6 lg:p-8 rounded-2xl shadow-2xl border border-gray-700/50">
              <h2 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-6 lg:mb-8">
                Analytics & Business Intelligence
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/20 backdrop-blur-sm p-6 lg:p-8 rounded-2xl border border-blue-500/20 shadow-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg lg:text-xl font-semibold text-blue-300">System Status</h3>
                    <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2v-4a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 012 2h2a2 2 0 012 2v4a2 2 0 012 2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 lg:p-4 bg-gray-700/50 backdrop-blur-sm rounded-xl border border-gray-600/50">
                      <span className="text-blue-300 font-medium">AI Status</span>
                      <div className="flex items-center space-x-2">
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold transition-all duration-300 ${
                          aiStatus === 'available' 
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-green-500/25' 
                            : 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-yellow-500/25 animate-pulse'
                        }`}>
                          {aiStatus === 'available' ? 'READY' : 'PROCESSING'}
                        </span>
                        <div className={`w-3 h-3 rounded-full ${
                          aiStatus === 'available' ? 'bg-green-400' : 
                          aiStatus === 'loading' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'
                        }`}></div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 lg:p-4 bg-gray-700/50 backdrop-blur-sm rounded-xl border border-gray-600/50">
                      <span className="text-blue-300 font-medium">Send Safety</span>
                      <div className="flex items-center space-x-2">
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold transition-all duration-300 ${
                          sendSafety.paused 
                            ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-500/25' 
                            : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-green-500/25'
                        }`}>
                          {sendSafety.paused ? 'PAUSED' : 'ACTIVE'}
                        </span>
                        <div className={`w-3 h-3 rounded-full ${
                          sendSafety.paused ? 'bg-red-400' : 'bg-green-400'
                        }`}></div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 lg:p-4 bg-gray-700/50 backdrop-blur-sm rounded-xl border border-gray-600/50">
                      <span className="text-blue-300 font-medium">Daily Limit</span>
                      <div className="flex items-center space-x-2">
                        <div className="text-white">
                          <span className="text-lg font-bold">{sendSafety.currentDaySent}</span>
                          <span className="text-sm text-blue-300">/</span>
                          <span className="text-lg font-bold">{sendSafety.maxPerDay}</span>
                        </div>
                        <div className="w-16 bg-gray-600 rounded-full h-2">
                          <div 
                            className="h-2 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${(sendSafety.currentDaySent / sendSafety.maxPerDay) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-600/20 to-purple-700/20 backdrop-blur-sm p-6 lg:p-8 rounded-2xl border border-purple-500/20 shadow-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg lg:text-xl font-semibold text-purple-300">Strategic Overview</h3>
                    <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H3a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002 2v4a2 2 0 002 2h2a2 2 0 012 2v4a2 2 0 012 2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 lg:p-4 bg-gray-700/50 backdrop-blur-sm rounded-xl border border-gray-600/50">
                      <span className="text-purple-300 font-medium">Tight ICP</span>
                      <span className="text-white font-bold bg-purple-500/20 px-3 py-1 rounded-lg">{TIGHT_ICP.industry} • {TIGHT_ICP.size}</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 lg:p-4 bg-gray-700/50 backdrop-blur-sm rounded-xl border border-gray-600/50">
                      <span className="text-purple-300 font-medium">Target Pain</span>
                      <span className="text-white font-bold bg-purple-500/20 px-3 py-1 rounded-lg">{TIGHT_ICP.pain}</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 lg:p-4 bg-gray-700/50 backdrop-blur-sm rounded-xl border border-gray-600/50">
                      <span className="text-purple-300 font-medium">Total Contacts</span>
                      <span className="text-white font-bold bg-purple-500/20 px-3 py-1 rounded-lg">{whatsappLinks.length}</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 lg:p-4 bg-gray-700/50 backdrop-blur-sm rounded-xl border border-gray-600/50">
                      <span className="text-purple-300 font-medium">Templates</span>
                      <span className="text-white font-bold bg-purple-500/20 px-3 py-1 rounded-lg">3 controlled (&lt;120 words)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-700/20 backdrop-blur-sm p-6 lg:p-8 rounded-2xl border border-emerald-500/20 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg lg:text-xl font-semibold text-emerald-300">Final Optimal Philosophy</h3>
                  <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.252v.001A2.25 2.25 0 012.25 2.25H6.75a2.25 2.25 0 00-2.25 2.25v9.496c0 .414.336.75-.75.75-.75.75v-9.496a.75.75 0 001.5.5h7.5a.75.75 0 001.5.5v9.496a.75.75 0 001.5.5v-9.496a.75.75 0 001.5.5v-9.496z" />
                    </svg>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { icon: '🎯', title: 'Complete manual control when AI is down', desc: 'Every feature works 100% without AI' },
                    { icon: '🚀', title: 'Strategic AI enhancement for speed and scale', desc: 'Optional AI for faster operations' },
                    { icon: '📋', title: 'Your actual business pitch and templates', desc: 'Personalized messaging that converts' },
                    { icon: '📊', title: 'Advanced contact management with status tracking', desc: 'Full lifecycle management' },
                    { icon: '📱', title: 'Multi-channel outreach (Email, WhatsApp, SMS, Calls)', desc: 'Reach prospects everywhere' },
                    { icon: '🛡️', title: 'Send safety rules protect deliverability', desc: 'Maintain sender reputation' },
                    { icon: '📈', title: 'Real-time analytics and business intelligence', desc: 'Data-driven decisions' },
                    { icon: '🎯', title: 'Tight ICP targeting for better conversion', desc: 'Focus on high-value prospects' },
                    { icon: '⚡', title: '2-minute AI research for fast personalization', desc: 'Quick insights for every lead' },
                    { icon: '📝', title: '3 controlled templates prevent errors', desc: 'Consistent, compliant messaging' }
                  ].map((feature, index) => (
                    <div 
                      key={index}
                      className="flex items-start space-x-3 p-3 lg:p-4 bg-gray-700/50 backdrop-blur-sm rounded-xl border border-gray-600/50 hover:border-emerald-500/50 transition-all duration-300"
                      style={{
                        animationDelay: `${index * 100}ms`
                      }}
                    >
                      <div className="text-2xl lg:text-3xl">{feature.icon}</div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-white text-base lg:text-lg mb-1">{feature.title}</h4>
                        <p className="text-emerald-300 text-sm">{feature.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* STATUS MODAL */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800/95 backdrop-blur-md rounded-3xl shadow-2xl w-full max-w-2xl lg:max-w-md max-h-[90vh] overflow-hidden border border-gray-700/50 transform transition-all duration-300 scale-100">
            <div className="relative p-6 lg:p-8 border-b border-gray-700/50">
              <h2 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
                Update Contact Status
              </h2>
              <button
                onClick={() => setShowStatusModal(false)}
                className="absolute top-6 right-6 text-gray-400 hover:text-white text-2xl lg:text-3xl transition-colors duration-300 transform hover:scale-110"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 lg:p-8 space-y-6">
              <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/20 backdrop-blur-sm p-6 rounded-2xl border border-blue-500/20">
                <label className="block text-sm font-medium text-blue-300 mb-2">Contact Information</label>
                <div className="bg-gray-700/50 backdrop-blur-sm p-4 rounded-xl border border-gray-600/50">
                  <div className="flex items-start space-x-3 mb-3">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 011.784 1.216 1.216 0 011.784 1.216 0 01-2.828 0-4 4 0 012.828 0-4-4z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-bold text-lg">{selectedContactForStatus?.business}</p>
                      <p className="text-blue-300 text-sm truncate">{selectedContactForStatus?.email}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-purple-600/20 to-purple-700/20 backdrop-blur-sm p-6 rounded-2xl border border-purple-500/20">
                <label className="block text-sm font-medium text-purple-300 mb-2">New Status</label>
                <select
                  value={selectedContactForStatus?.status || 'new'}
                  onChange={(e) => setSelectedContactForStatus(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full bg-gray-700/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white focus:border-purple-500/50 focus:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all duration-300 text-base lg:text-lg"
                >
                  {CONTACT_STATUSES.map(status => (
                    <option key={status.id} value={status.id} className="text-white">
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-700/20 backdrop-blur-sm p-6 rounded-2xl border border-emerald-500/20">
                <label className="block text-sm font-medium text-emerald-300 mb-2">Status Change Note</label>
                <textarea
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  rows={4}
                  placeholder="Add a note explaining this status change..."
                  className="w-full bg-gray-700/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-emerald-500/50 focus:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all duration-300 text-sm"
                />
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleStatusModalSubmit}
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-6 py-3 lg:py-4 rounded-2xl text-base lg:text-lg font-bold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-green-500/25 flex items-center justify-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L7 5v8l-4 4H5z" />
                  </svg>
                  <span>Update Status</span>
                </button>
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="flex-1 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white px-6 py-3 lg:py-4 rounded-2xl text-base lg:text-lg font-bold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-gray-500/25 flex items-center justify-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
