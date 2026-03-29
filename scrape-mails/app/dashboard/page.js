// app/dashboard/page.js
'use client';
import { useState, useEffect, useCallback } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import Head from 'next/head';
import { useRouter } from 'next/navigation';

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
If yes, I'd be happy to share a quick idea – no pressure at all.`;
const DEFAULT_SMS_TEMPLATE = `Hi {{business_name}} 👋
This is {{sender_name}} from Syndicate Solutions.
Quick question – are you currently working on any digital work that's delayed or not giving results?
Reply YES or NO.`;

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
export { FOLLOW_UP_1, FOLLOW_UP_2, FOLLOW_UP_3 };

export default function Dashboard() {
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
  const [instagramTemplate, setInstagramTemplate] = useState(`Hi {{business_name}} 👋
I run Syndicate Solutions – we help businesses like yours with web, AI, and digital ops.
Would you be open to a quick chat about how we can help?
No pressure at all.`);
  const [twitterTemplate, setTwitterTemplate] = useState(`Hi {{business_name}} 👋
I run Syndicate Solutions – we help businesses like yours with web, AI, and digital ops.
Would you be open to a quick chat?`);
  const [followUpTemplates, setFollowUpTemplates] = useState([
    {
      id: 'followup_1',
      name: 'Follow-Up 1 (Day 2)',
      channel: 'email',
      enabled: true,
      delayDays: 2,
      subject: 'Quick question for {{business_name}}',
      body: FOLLOW_UP_1.body
    },
    {
      id: 'followup_2',
      name: 'Follow-Up 2 (Day 5)',
      channel: 'email',
      enabled: true,
      delayDays: 5,
      subject: '{{business_name}}, a quick offer (no strings)',
      body: FOLLOW_UP_2.body
    },
    {
      id: 'followup_3',
      name: 'Breakup Email (Day 7)',
      channel: 'email',
      enabled: true,
      delayDays: 7,
      subject: 'Closing the loop',
      body: FOLLOW_UP_3.body
    }
  ]);

  // ✅ TEMPLATE VARIABLES COLLECTION
  const uiVars = [...new Set([
    ...extractTemplateVariables(templateA.subject),
    ...extractTemplateVariables(templateA.body),
    ...extractTemplateVariables(templateB.subject),
    ...extractTemplateVariables(templateB.body),
    ...extractTemplateVariables(whatsappTemplate),
    ...extractTemplateVariables(smsTemplate),
    ...extractTemplateVariables(instagramTemplate),
    ...extractTemplateVariables(twitterTemplate),
    ...followUpTemplates.flatMap(t => [t.subject, t.body])
  ])];

  useEffect(() => {
    if (window.google?.accounts?.oauth2?.initTokenClient) {
      setIsGoogleLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => setIsGoogleLoaded(true);
    document.head.appendChild(script);
    return () => document.head.removeChild(script);
  }, []);

  // ============================================================================
  // AUTHENTICATION HANDLERS
  // ============================================================================
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoadingAuth(false);
      if (user) {
        loadSettings(user.uid);
        loadSentLeads(user.uid);
      }
    });
    return unsubscribe;
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      setUser(result.user);
      await loadSettings(result.user.uid);
    } catch (error) {
      console.error('Google sign-in error:', error);
      alert('Failed to sign in with Google');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
      router.push('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // ============================================================================
  // SETTINGS MANAGEMENT
  // ============================================================================
  const loadSettings = async (userId) => {
    try {
      const docRef = doc(db, 'users', userId, 'settings', 'templates');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        setSenderName(data.senderName || 'Team');
        setTemplateA(data.templateA || DEFAULT_TEMPLATE_A);
        setTemplateB(data.templateB || DEFAULT_TEMPLATE_B);
        setWhatsappTemplate(data.whatsappTemplate || DEFAULT_WHATSAPP_TEMPLATE);
        setSmsTemplate(data.smsTemplate || DEFAULT_SMS_TEMPLATE);
        setInstagramTemplate(data.instagramTemplate || instagramTemplate);
        setTwitterTemplate(data.twitterTemplate || twitterTemplate);
        setFollowUpTemplates(data.followUpTemplates || followUpTemplates);
        setFieldMappings(data.fieldMappings || {});
        setAbTestMode(data.abTestMode || false);
        setSmsConsent(data.smsConsent || false);
      }
    } catch (error) {
      console.warn('Failed to load settings:', error);
    }
  };

  const saveSettings = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const docRef = doc(db, 'users', user.uid, 'settings', 'templates');
      await setDoc(docRef, {
        senderName,
        templateA,
        templateB,
        whatsappTemplate,
        smsTemplate,
        instagramTemplate,
        twitterTemplate,
        followUpTemplates,
        fieldMappings,
        abTestMode,
        smsConsent
      }, { merge: true });
    } catch (error) {
      console.warn('Failed to save settings:', error);
    }
  }, [user?.uid, senderName, templateA, templateB, whatsappTemplate, smsTemplate, instagramTemplate, twitterTemplate, followUpTemplates, fieldMappings, abTestMode, smsConsent]);

  useEffect(() => {
    if (!user?.uid) return;
    const handler = setTimeout(() => saveSettings(), 1500);
    return () => clearTimeout(handler);
  }, [saveSettings, user?.uid]);

  const loadSentLeads = async (userId) => {
    setLoadingSentLeads(true);
    try {
      const q = query(collection(db, 'sentLeads'), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      const leads = [];
      snapshot.forEach(doc => {
        leads.push({ id: doc.id, ...doc.data() });
      });
      setSentLeads(leads);
    } catch (error) {
      console.error('Failed to load sent leads:', error);
    } finally {
      setLoadingSentLeads(false);
    }
  };

  // ============================================================================
  // CSV UPLOAD AND PROCESSING
  // ============================================================================
  const handleCsvUpload = (e) => {
    setValidEmails(0);
    setValidWhatsApp(0);
    setWhatsappLinks([]);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
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
        smsTemplate,
        instagramTemplate,
        twitterTemplate,
        ...followUpTemplates.flatMap(t => [t.subject, t.body])
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
      initialMappings.lead_quality = 'lead_quality';
      setFieldMappings(initialMappings);
      
      // ✅ Lead processing with lead_quality column presence check
      let hotEmails = 0, warmEmails = 0;
      const validPhoneContacts = [];
      const newLeadScores = {};
      const newLastSent = {};
      let firstValid = null;
      
      // ✅ CRITICAL: Only filter by leadQuality if the column exists
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
          if (dealStage[row.email] === 'contacted') score += 10;
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
            url: `https://wa.me/${formattedPhone}?text=${encodeURIComponent(
              renderPreviewText(whatsappTemplate, row, fieldMappings, senderName)
            )}`
          });
          if (!firstValid) firstValid = row;
        }
      }
      
      setPreviewRecipient(firstValid);
      if (leadQualityFilter === 'HOT') setValidEmails(hotEmails);
      else if (leadQualityFilter === 'WARM') setValidEmails(warmEmails);
      else setValidEmails(hotEmails + warmEmails);
      setValidWhatsApp(validPhoneContacts.length);
      setWhatsappLinks(validPhoneContacts);
      setLeadScores(newLeadScores);
      setLastSent(newLastSent);
      setCsvContent(normalizedContent);
    };
    reader.readAsText(file);
  };

  // ============================================================================
  // EMAIL SENDING FUNCTIONALITY
  // ============================================================================
  const requestGmailToken = () => {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') return reject('Browser only');
      if (!isGoogleLoaded) {
        reject('Google API not loaded');
        return;
      }
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId) {
        reject('Google Client ID missing');
        return;
      }
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/gmail.send',
        callback: (response) => {
          if (response.access_token) {
            resolve(response.access_token);
          } else {
            reject(new Error('Failed to get access token'));
          }
        },
        error_callback: (error) => {
          reject(error);
        }
      });
      tokenClient.requestAccessToken();
    });
  };

  const handleSendEmails = async (template = null) => {
    if (!user?.uid) {
      alert('Please sign in to send emails');
      return;
    }
    
    if (!senderName.trim() || validEmails === 0) {
      alert('Check sender name and valid emails');
      return;
    }
    
    setIsSending(true);
    setStatus('🔄 Preparing emails...');
    
    try {
      const token = await requestGmailToken();
      const selectedTemplate = template === 'A' ? templateA : template === 'B' ? templateB : templateA;
      
      setStatus('📧 Sending emails...');
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          template: selectedTemplate,
          senderName,
          fieldMappings,
          csvContent,
          abTestMode,
          template,
          userId: user.uid
        })
      });
      
      const data = await response.json();
      if (response.ok) {
        setStatus(`✅ ${data.sent} emails sent successfully!`);
        await loadSentLeads(user.uid);
      } else {
        setStatus(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Send error:', error);
      setStatus(`❌ Failed: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  // ============================================================================
  // MAIN DASHBOARD COMPONENT
  // ============================================================================
  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-8">Auto Leads Dashboard</h1>
          <button
            onClick={handleGoogleSignIn}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
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
        <title>Auto Leads Dashboard</title>
      </Head>
      
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Auto Leads Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-300">{user.email}</span>
            <button
              onClick={handleSignOut}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-white"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Valid Emails</h3>
            <p className="text-3xl font-bold text-blue-400">{validEmails}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">WhatsApp Links</h3>
            <p className="text-3xl font-bold text-green-400">{validWhatsApp}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Sent Emails</h3>
            <p className="text-3xl font-bold text-purple-400">{sentLeads.length}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Replied</h3>
            <p className="text-3xl font-bold text-yellow-400">
              {Object.values(repliedLeads).filter(Boolean).length}
            </p>
          </div>
        </div>

        {/* CSV Upload */}
        <div className="bg-gray-800 p-6 rounded-lg mb-8">
          <h2 className="text-xl font-semibold mb-4">Upload CSV</h2>
          <input
            type="file"
            accept=".csv"
            onChange={handleCsvUpload}
            className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
          />
          {csvContent && (
            <div className="mt-4 text-green-400">
              ✅ CSV loaded with {validEmails} valid emails and {validWhatsApp} phone numbers
            </div>
          )}
        </div>

        {/* Email Templates */}
        <div className="bg-gray-800 p-6 rounded-lg mb-8">
          <h2 className="text-xl font-semibold mb-4">Email Templates</h2>
          
          {/* Sender Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Sender Name</label>
            <input
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
              placeholder="Your name"
            />
          </div>

          {/* Template A */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">Template A</h3>
            <div className="space-y-2">
              <input
                type="text"
                value={templateA.subject}
                onChange={(e) => setTemplateA(prev => ({ ...prev, subject: e.target.value }))}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                placeholder="Subject"
              />
              <textarea
                value={templateA.body}
                onChange={(e) => setTemplateA(prev => ({ ...prev, body: e.target.value }))}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white h-32"
                placeholder="Email body"
              />
            </div>
          </div>

          {/* AB Test Mode */}
          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={abTestMode}
                onChange={(e) => setAbTestMode(e.target.checked)}
                className="mr-2"
              />
              Enable A/B Testing
            </label>
          </div>

          {/* Send Button */}
          <button
            onClick={() => handleSendEmails()}
            disabled={isSending || !csvContent || !senderName.trim() || validEmails === 0}
            className={`w-full py-3 rounded-lg font-bold transition ${
              isSending || !csvContent || !senderName.trim() || validEmails === 0
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-green-700 hover:bg-green-600 text-white'
            }`}
          >
            {isSending ? 'Sending...' : `Send Emails (${validEmails})`}
          </button>
          
          {status && (
            <div className="mt-4 p-3 bg-gray-700 rounded text-white">
              {status}
            </div>
          )}
        </div>

        {/* WhatsApp Links */}
        {whatsappLinks.length > 0 && (
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">WhatsApp Links ({whatsappLinks.length})</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {whatsappLinks.map((link) => (
                <div key={link.id} className="flex justify-between items-center p-3 bg-gray-700 rounded">
                  <div>
                    <div className="font-medium">{link.business}</div>
                    <div className="text-sm text-gray-400">{link.phone}</div>
                    {link.email && (
                      <div className="text-sm text-blue-400">{link.email}</div>
                    )}
                  </div>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white"
                  >
                    Open WhatsApp
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
