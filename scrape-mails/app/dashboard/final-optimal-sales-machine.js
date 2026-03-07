'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, where, updateDoc, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
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

// Email templates
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
