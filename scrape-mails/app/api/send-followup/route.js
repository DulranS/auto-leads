// app/api/send-followup/route.js
import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, where, getDocs, updateDoc, doc, increment } from 'firebase/firestore';
import { google } from 'googleapis';

// ============================================================================
// FIREBASE CONFIGURATION
// ============================================================================
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

// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
  MAX_FOLLOW_UPS: 3,
  MIN_DAYS_BETWEEN_FOLLOWUP: 2,
  CAMPAIGN_WINDOW_DAYS: 30
};

// ============================================================================
// FOLLOW-UP TEMPLATES
// ============================================================================
const FOLLOW_UP_TEMPLATES = [
  {
    subject: 'Quick question for {{business_name}}',
    body: `Hi {{business_name}},\n\nJust circling back—did my note about outsourced dev & ops support land at a bad time?\n\nNo pressure at all, but if you're ever swamped with web, automation, or backend work and need a reliable extra hand, we're ready to help.\n\nBest,\n{{sender_name}}`
  },
  {
    subject: '{{business_name}}, a quick offer (no strings)',
    body: `Hi again,\n\nI noticed you haven't had a chance to reply—totally understand!\n\nTo make this zero-risk: I'll audit one of your digital workflows for free and send 2–3 actionable automation ideas you can implement immediately.\n\nInterested? Hit "Yes" or reply with a workflow you'd like optimized.\n\nCheers,\n{{sender_name}}`
  },
  {
    subject: 'Closing the loop',
    body: `Hi {{business_name}},\n\nI'll stop emailing after this one!\n\nJust wanted to say: if outsourcing ever becomes a priority, we're here. Many of our clients started with a tiny task and now work with us monthly.\n\nEither way, keep crushing it!\n\n— {{sender_name}}`
  }
];

// ============================================================================
// CREATE MIME MESSAGE
// ============================================================================
const createMimeMessage = ({ from, to, subject, body }) => {
  let mimeMessage = `From: ${from}\r\n`;
  mimeMessage += `To: ${to}\r\n`;
  mimeMessage += `Subject: ${subject}\r\n`;
  mimeMessage += `Content-Type: text/html; charset=UTF-8\r\n`;
  mimeMessage += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
  
  const htmlBody = body.replace(/\n/g, '<br>');
  mimeMessage += htmlBody + '\r\n';
  
  return Buffer.from(mimeMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// ============================================================================
// POST HANDLER
// ============================================================================
export async function POST(request) {
  try {
    const { email, accessToken, userId, senderName } = await request.json();
    
    if (!email || !accessToken || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields', code: 'MISSING_FIELDS' },
        { status: 400 }
      );
    }
    
    // Get existing email record
    const existingQuery = query(
      collection(db, 'sent_emails'),
      where('userId', '==', userId),
      where('to', '==', email)
    );
    const existingSnapshot = await getDocs(existingQuery);
    
    if (existingSnapshot.empty) {
      return NextResponse.json(
        { error: 'No original email found', code: 'NO_ORIGINAL_EMAIL' },
        { status: 404 }
      );
    }
    
    const existingDoc = existingSnapshot.docs[0];
    const existingData = existingDoc.data();
    
    // Check if already replied
    if (existingData.replied) {
      return NextResponse.json(
        { error: 'Lead has already replied. Loop closed.', code: 'ALREADY_REPLIED' },
        { status: 400 }
      );
    }
    
    // Check follow-up count
    const followUpCount = existingData.followUpCount || 0;
    if (followUpCount >= CONFIG.MAX_FOLLOW_UPS) {
      return NextResponse.json(
        { error: `Maximum follow-ups (${CONFIG.MAX_FOLLOW_UPS}) reached. Loop closed.`, code: 'MAX_FOLLOWUPS_REACHED' },
        { status: 400 }
      );
    }
    
    // Check timing
    const lastFollowUpAt = existingData.lastFollowUpAt ? 
      (existingData.lastFollowUpAt.toDate ? existingData.lastFollowUpAt.toDate() : new Date(existingData.lastFollowUpAt)) :
      (existingData.sentAt.toDate ? existingData.sentAt.toDate() : new Date(existingData.sentAt));
    
    const daysSinceLastContact = (new Date() - lastFollowUpAt) / (1000 * 60 * 60 * 24);
    if (daysSinceLastContact < CONFIG.MIN_DAYS_BETWEEN_FOLLOWUP) {
      return NextResponse.json(
        { error: `Too soon to follow up. Wait ${Math.ceil(CONFIG.MIN_DAYS_BETWEEN_FOLLOWUP - daysSinceLastContact)} more days.`, code: 'TOO_SOON' },
        { status: 400 }
      );
    }
    
    // Select follow-up template
    const followUpIndex = followUpCount;
    const template = FOLLOW_UP_TEMPLATES[followUpIndex] || FOLLOW_UP_TEMPLATES[FOLLOW_UP_TEMPLATES.length - 1];
    
    // Render template
    let subject = template.subject.replace('{{business_name}}', existingData.businessName || 'Contact');
    let body = template.body
      .replace('{{business_name}}', existingData.businessName || 'Contact')
      .replace('{{sender_name}}', senderName || 'Team');
    
    // Send via Gmail API
    const oauth2Client = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const rawMessage = createMimeMessage({
      from: `${senderName} <${process.env.GMAIL_SENDER_EMAIL}>`,
      to: email,
      subject,
      body
    });
    
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: rawMessage }
    });
    
    // Update Firebase record
    const newFollowUpCount = followUpCount + 1;
    const now = new Date().toISOString();
    
    await updateDoc(doc(db, 'sent_emails', existingDoc.id), {
      followUpCount: newFollowUpCount,
      lastFollowUpAt: now,
      followUpDates: [...(existingData.followUpDates || []), now],
      followUpAt: null
    });
    
    const isFinalFollowUp = newFollowUpCount >= CONFIG.MAX_FOLLOW_UPS;
    
    return NextResponse.json({
      success: true,
      followUpCount: newFollowUpCount,
      messageId: response.data.id,
      isFinalFollowUp,
      loopClosed: isFinalFollowUp
    });
    
  } catch (error) {
    console.error('Send follow-up error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send follow-up',
        details: error.message,
        code: 'SEND_ERROR'
      },
      { status: 500 }
    );
  }
}