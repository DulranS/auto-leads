// app/api/send-followup/route.js
import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, where, getDocs, updateDoc, doc, increment, writeBatch, runTransaction } from 'firebase/firestore';
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
  CAMPAIGN_WINDOW_DAYS: 30,
  RATE_LIMIT_WINDOW_MS: 60000, // 1 minute
  MAX_REQUESTS_PER_WINDOW: 30, // Max 30 follow-ups per minute
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
  CONCURRENCY_LIMIT: 5 // Max concurrent follow-up sends
};

// ============================================================================
// IN-MEMORY RATE LIMITING (for basic protection)
// ============================================================================
const rateLimitMap = new Map();

const checkRateLimit = (userId) => {
  const now = Date.now();
  const windowStart = now - CONFIG.RATE_LIMIT_WINDOW_MS;
  
  if (!rateLimitMap.has(userId)) {
    rateLimitMap.set(userId, []);
  }
  
  const requests = rateLimitMap.get(userId);
  // Remove old requests outside the window
  const validRequests = requests.filter(timestamp => timestamp > windowStart);
  rateLimitMap.set(userId, validRequests);
  
  if (validRequests.length >= CONFIG.MAX_REQUESTS_PER_WINDOW) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: Math.min(...validRequests) + CONFIG.RATE_LIMIT_WINDOW_MS
    };
  }
  
  // Add current request
  validRequests.push(now);
  rateLimitMap.set(userId, validRequests);
  
  return {
    allowed: true,
    remaining: CONFIG.MAX_REQUESTS_PER_WINDOW - validRequests.length,
    resetTime: windowStart + CONFIG.RATE_LIMIT_WINDOW_MS
  };
};

// ============================================================================
// FOLLOW-UP TEMPLATES
// ============================================================================
const FOLLOW_UP_TEMPLATES = [
  {
    subject: 'Quick question for {{business_name}}',
    body: `Hi {{business_name}},

Just circling back—did my note about outsourced dev & ops support land at a bad time?

No pressure at all, but if you're ever swamped with web, automation, or backend work and need a reliable extra hand, we're ready to help.

Best,
{{sender_name}}`
  },
  {
    subject: '{{business_name}}, a quick offer (no strings)',
    body: `Hi again,

I noticed you haven't had a chance to reply—totally understand!

To make this zero-risk: I'll audit one of your digital workflows for free and send 2–3 actionable automation ideas you can implement immediately.

Interested? Hit "Yes" or reply with a workflow you'd like optimized.

Cheers,
{{sender_name}}`
  },
  {
    subject: 'Closing the loop',
    body: `Hi {{business_name}},

I'll stop emailing after this one!

Just wanted to say: if outsourcing ever becomes a priority, we're here. Many of our clients started with a tiny task and now work with us monthly.

Either way, keep crushing it!

— {{sender_name}}`
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
// SEND EMAIL WITH RETRY LOGIC
// ============================================================================
const sendEmailWithRetry = async (gmail, rawMessage, attempts = CONFIG.RETRY_ATTEMPTS) => {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: rawMessage }
      });
      return { success: true, messageId: response.data.id, attempt };
    } catch (error) {
      console.error(`Email send attempt ${attempt} failed:`, error.message);
      
      // Don't retry on certain errors
      if (error.code === 400 || error.code === 403) {
        throw error;
      }
      
      // If this is the last attempt, throw the error
      if (attempt === attempts) {
        throw error;
      }
      
      // Wait before retry with exponential backoff
      const delay = CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// ============================================================================
// POST HANDLER
// ============================================================================
export async function POST(request) {
  const startTime = Date.now();
  let logData = {
    timestamp: new Date().toISOString(),
    userId: null,
    email: null,
    success: false,
    error: null,
    duration: 0
  };
  
  try {
    const { email, accessToken, userId, senderName } = await request.json();
    logData.userId = userId;
    logData.email = email;
    
    if (!email || !accessToken || !userId) {
      logData.error = 'Missing required fields';
      return NextResponse.json(
        { error: 'Missing required fields', code: 'MISSING_FIELDS' },
        { status: 400 }
      );
    }
    
    // Rate limiting check
    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.allowed) {
      logData.error = 'Rate limit exceeded';
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded. Please try again later.', 
          code: 'RATE_LIMIT_EXCEEDED',
          resetTime: rateLimit.resetTime
        },
        { status: 429 }
      );
    }
    
    // Use transaction for atomic operations
    const result = await runTransaction(db, async (transaction) => {
      // Get existing email record
      const existingQuery = query(
        collection(db, 'sent_emails'),
        where('userId', '==', userId),
        where('to', '==', email)
      );
      const existingSnapshot = await getDocs(existingQuery);
      
      if (existingSnapshot.empty) {
        throw new Error('No original email found');
      }
      
      const existingDoc = existingSnapshot.docs[0];
      const existingData = existingDoc.data();
      
      // Check if already replied
      if (existingData.replied) {
        throw new Error('Lead has already replied. Loop closed.');
      }
      
      // Check follow-up count
      const followUpCount = existingData.followUpCount || 0;
      if (followUpCount >= CONFIG.MAX_FOLLOW_UPS) {
        throw new Error(`Maximum follow-ups (${CONFIG.MAX_FOLLOW_UPS}) reached. Loop closed.`);
      }
      
      // Check timing
      const lastFollowUpAt = existingData.lastFollowUpAt ? 
        (existingData.lastFollowUpAt.toDate ? existingData.lastFollowUpAt.toDate() : new Date(existingData.lastFollowUpAt)) :
        (existingData.sentAt.toDate ? existingData.sentAt.toDate() : new Date(existingData.sentAt));
      
      const daysSinceLastContact = (new Date() - lastFollowUpAt) / (1000 * 60 * 60 * 24);
      if (daysSinceLastContact < CONFIG.MIN_DAYS_BETWEEN_FOLLOWUP) {
        throw new Error(`Too soon to follow up. Wait ${Math.ceil(CONFIG.MIN_DAYS_BETWEEN_FOLLOWUP - daysSinceLastContact)} more days.`);
      }
      
      // Select follow-up template
      const followUpIndex = followUpCount;
      const template = FOLLOW_UP_TEMPLATES[followUpIndex] || FOLLOW_UP_TEMPLATES[FOLLOW_UP_TEMPLATES.length - 1];
      
      // Render template
      let subject = template.subject.replace('{{business_name}}', existingData.businessName || 'Contact');
      let body = template.body
        .replace('{{business_name}}', existingData.businessName || 'Contact')
        .replace('{{sender_name}}', senderName || 'Team');
      
      // Send via Gmail API with retry logic
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
      
      const emailResult = await sendEmailWithRetry(gmail, rawMessage);
      
      // Update Firebase record atomically
      const newFollowUpCount = followUpCount + 1;
      const now = new Date().toISOString();
      
      transaction.update(doc(db, 'sent_emails', existingDoc.id), {
        followUpCount: newFollowUpCount,
        lastFollowUpAt: now,
        followUpDates: [...(existingData.followUpDates || []), now],
        followUpAt: null
      });
      
      const isFinalFollowUp = newFollowUpCount >= CONFIG.MAX_FOLLOW_UPS;
      
      return {
        success: true,
        followUpCount: newFollowUpCount,
        messageId: emailResult.messageId,
        isFinalFollowUp,
        loopClosed: isFinalFollowUp,
        attempt: emailResult.attempt
      };
    });
    
    logData.success = true;
    logData.duration = Date.now() - startTime;
    
    return NextResponse.json(result);
    
  } catch (error) {
    logData.error = error.message;
    logData.duration = Date.now() - startTime;
    
    console.error('Send follow-up error:', {
      message: error.message,
      userId,
      email,
      duration: logData.duration,
      stack: error.stack
    });
    
    // Map specific errors to appropriate status codes
    let statusCode = 500;
    let errorCode = 'SEND_ERROR';
    
    if (error.message.includes('No original email found')) {
      statusCode = 404;
      errorCode = 'NO_ORIGINAL_EMAIL';
    } else if (error.message.includes('already replied')) {
      statusCode = 400;
      errorCode = 'ALREADY_REPLIED';
    } else if (error.message.includes('Maximum follow-ups')) {
      statusCode = 400;
      errorCode = 'MAX_FOLLOWUPS_REACHED';
    } else if (error.message.includes('Too soon to follow up')) {
      statusCode = 400;
      errorCode = 'TOO_SOON';
    } else if (error.message.includes('invalid_grant') || error.message.includes('unauthorized')) {
      statusCode = 401;
      errorCode = 'AUTH_ERROR';
    }
    
    return NextResponse.json(
      { 
        error: error.message,
        code: errorCode,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: statusCode }
    );
  } finally {
    // Log the operation (in production, you'd send this to a logging service)
    console.log('Follow-up operation completed:', JSON.stringify(logData, null, 2));
  }
}