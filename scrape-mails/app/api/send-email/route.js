// app/api/send-email/route.js
import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, setDoc, increment } from 'firebase/firestore';
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
  MAX_DAILY_EMAILS: 500,
  RATE_LIMIT_DELAY_MS: 200,
  MAX_IMAGES_PER_EMAIL: 3
};

// ============================================================================
// PARSE CSV
// ============================================================================
const parseCsvRow = (str) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"' && !inQuotes) {
      inQuotes = true;
    } else if (char === '"' && inQuotes) {
      if (i + 1 < str.length && str[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = false;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map(field => field.replace(/[\r\n]/g, '').trim());
};

// ============================================================================
// VALIDATE EMAIL
// ============================================================================
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const cleaned = email.trim().toLowerCase();
  if (cleaned.length < 5) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(cleaned);
};

// ============================================================================
// CREATE MIME MESSAGE
// ============================================================================
const createMimeMessage = async ({
  from,
  to,
  subject,
  body,
  images = []
}) => {
  const boundary = 'boundary_' + Date.now();
  
  let mimeMessage = `From: ${from}\r\n`;
  mimeMessage += `To: ${to}\r\n`;
  mimeMessage += `Subject: ${subject}\r\n`;
  mimeMessage += `MIME-Version: 1.0\r\n`;
  mimeMessage += `Content-Type: multipart/related; boundary="${boundary}"\r\n\r\n`;
  
  // HTML Body
  mimeMessage += `--${boundary}\r\n`;
  mimeMessage += `Content-Type: text/html; charset=UTF-8\r\n`;
  mimeMessage += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
  
  let htmlBody = body.replace(/\n/g, '<br>');
  
  // Add inline images
  images.forEach((img, index) => {
    const cid = `img${index + 1}@massmailer`;
    htmlBody = htmlBody.replace(`{{image${index + 1}}}`, `<img src="cid:${cid}" style="max-width: 100%; height: auto;" />`);
  });
  
  mimeMessage += htmlBody + '\r\n\r\n';
  
  // Add images
  for (const img of images) {
    mimeMessage += `--${boundary}\r\n`;
    mimeMessage += `Content-Type: ${img.mimeType}\r\n`;
    mimeMessage += `Content-Transfer-Encoding: base64\r\n`;
    mimeMessage += `Content-ID: <${img.cid}>\r\n`;
    mimeMessage += `Content-Disposition: inline; filename="image${images.indexOf(img) + 1}"\r\n\r\n`;
    mimeMessage += img.base64 + '\r\n\r\n';
  }
  
  mimeMessage += `--${boundary}--\r\n`;
  
  return Buffer.from(mimeMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// ============================================================================
// POST HANDLER
// ============================================================================
export async function POST(request) {
  try {
    const {
      csvContent,
      senderName,
      senderEmail,
      fieldMappings,
      accessToken,
      abTestMode,
      templateA,
      templateB,
      templateToSend,
      leadQualityFilter,
      emailImages = [],
      userId
    } = await request.json();
    
    if (!userId || !accessToken || !csvContent) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Check daily limit
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const emailQuery = query(
      collection(db, 'sent_emails'),
      where('userId', '==', userId),
      where('sentAt', '>=', startOfDay)
    );
    const emailSnapshot = await getDocs(emailQuery);
    
    if (emailSnapshot.size >= CONFIG.MAX_DAILY_EMAILS) {
      return NextResponse.json(
        {
          error: 'Daily email limit reached',
          dailyCount: emailSnapshot.size,
          limit: CONFIG.MAX_DAILY_EMAILS
        },
        { status: 429 }
      );
    }
    
    // Parse CSV
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'Invalid CSV format' },
        { status: 400 }
      );
    }
    
    const headers = parseCsvRow(lines[0]);
    const emailColumnName = fieldMappings.email || 'email';
    const businessColumnName = fieldMappings.business_name || 'business_name';
    
    // Process recipients
    const recipients = [];
    const invalidEmails = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvRow(lines[i]);
      if (values.length !== headers.length) continue;
      
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      
      const email = row[emailColumnName]?.trim().toLowerCase();
      if (!isValidEmail(email)) {
        invalidEmails.push({ raw: row[emailColumnName], cleaned: email });
        continue;
      }
      
      recipients.push(row);
    }
    
    // Send emails
    const oauth2Client = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET,
      process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    
    for (const recipient of recipients) {
      const email = recipient[emailColumnName].trim().toLowerCase();
      const businessName = recipient[businessColumnName] || 'Contact';
      
      // Check if already sent
      const existingQuery = query(
        collection(db, 'sent_emails'),
        where('userId', '==', userId),
        where('to', '==', email)
      );
      const existingSnapshot = await getDocs(existingQuery);
      
      if (!existingSnapshot.empty) {
        skippedCount++;
        continue;
      }
      
      // Select template
      const template = abTestMode && templateToSend 
        ? (templateToSend === 'A' ? templateA : templateB)
        : templateA;
      
      // Render template
      let subject = template.subject;
      let body = template.body;
      
      Object.entries(fieldMappings).forEach(([varName, col]) => {
        const regex = new RegExp(`{{\\s*${varName}\\s*}}`, 'g');
        if (varName === 'sender_name') {
          subject = subject.replace(regex, senderName || 'Team');
          body = body.replace(regex, senderName || 'Team');
        } else if (recipient[col]) {
          subject = subject.replace(regex, recipient[col]);
          body = body.replace(regex, recipient[col]);
        }
      });
      
      try {
        // Create MIME message
        const rawMessage = await createMimeMessage({
          from: `${senderName} <${senderEmail}>`,
          to: email,
          subject,
          body,
          images: emailImages
        });
        
        // Send via Gmail API
        const response = await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw: rawMessage }
        });
        
        // Save to Firebase
        const emailData = {
          userId,
          to: email,
          businessName,
          subject,
          body,
          template: abTestMode ? templateToSend : 'A',
          sentAt: new Date().toISOString(),
          opened: false,
          openedCount: 0,
          clicked: false,
          clickCount: 0,
          replied: false,
          followUpCount: 0,
          followUpAt: null,
          lastFollowUpAt: null,
          followUpDates: [],
          messageId: response.data.id,
          threadId: response.data.threadId
        };
        
        await addDoc(collection(db, 'sent_emails'), emailData);
        
        sentCount++;
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, CONFIG.RATE_LIMIT_DELAY_MS));
        
      } catch (error) {
        console.error(`Failed to send to ${email}:`, error);
        failedCount++;
      }
    }
    
    return NextResponse.json({
      sent: sentCount,
      failed: failedCount,
      skipped: skippedCount,
      total: recipients.length,
      dailyCount: emailSnapshot.size + sentCount,
      limit: CONFIG.MAX_DAILY_EMAILS,
      invalidDetails: invalidEmails.slice(0, 5)
    });
    
  } catch (error) {
    console.error('Send email error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send emails',
        details: error.message,
        sent: 0,
        failed: 0,
        skipped: 0
      },
      { status: 500 }
    );
  }
}