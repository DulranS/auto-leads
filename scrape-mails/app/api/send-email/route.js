// app/api/send-email/route.js
import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, setDoc, updateDoc, increment, query, where, getDocs } from 'firebase/firestore';
import { google } from 'googleapis';

// ============================================================================
// FIREBASE CONFIGURATION
// ============================================================================
const getFirebaseConfig = () => {
  const requiredEnvVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(`Missing required Firebase environment variables: ${missingVars.join(', ')}`);
  }

  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
  };
};

let app;
let db;

try {
  const firebaseConfig = getFirebaseConfig();
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  db = getFirestore(app);
} catch (configError) {
  console.error('Firebase configuration error:', configError);
}

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
// EXTRACT DOMAIN FROM EMAIL
// ============================================================================
const extractDomainFromEmail = (email) => {
  if (!email || typeof email !== 'string') return null;
  const parts = email.trim().toLowerCase().split('@');
  return parts.length === 2 ? parts[1] : null;
};

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
const createMimeMessage = (to, subject, body, senderEmail, senderName, replyTo = null) => {
  const boundary = 'boundary_' + Math.random().toString(36).substring(7);
  
  let message = `From: ${senderName ? `${senderName} <${senderEmail}>` : senderEmail}\r\n`;
  message += `To: ${to}\r\n`;
  if (replyTo) {
    message += `Reply-To: ${replyTo}\r\n`;
  }
  message += `Subject: ${subject}\r\n`;
  message += `MIME-Version: 1.0\r\n`;
  message += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
  
  // Add text body
  message += `--${boundary}\r\n`;
  message += `Content-Type: text/plain; charset=utf-8\r\n\r\n`;
  message += `${body}\r\n`;
  
  message += `--${boundary}--\r\n`;
  
  return message;
};

// ============================================================================
// POST HANDLER
// ============================================================================
export async function POST(request) {
  try {
    const requestData = await request.json();
    const {
      csvContent,
      fieldMappings,
      accessToken,
      refreshToken,
      abTestMode,
      templateA,
      templateB,
      templateToSend,
      leadQualityFilter,
      emailImages = [],
      emailAttachments = [],
      userId,
      csvSource,
      contact,
      followUpCount
    } = requestData;

    // Handle follow-up requests (single email)
    if (contact && followUpCount !== undefined) {
      return await handleFollowUpSend(contact, followUpCount, userId, accessToken, requestData);
    }

    // Original CSV-based email sending logic
    if (!userId || !accessToken || !csvContent) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const emailQuery = query(
      collection(db, 'sent_emails'),
      where('userId', '==', userId),
      where('sentAt', '>=', startOfDay)
    );
    
    let emailSnapshot;
    try {
      emailSnapshot = await getDocs(emailQuery);
    } catch (firebaseError) {
      console.error('Failed to query sent emails:', firebaseError);
      emailSnapshot = { size: 0 };
    }
    
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
    
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'CSV content must have at least a header row and one data row' },
        { status: 400 }
      );
    }
    
    const headers = parseCsvRow(lines[0]);
    const dataRows = lines.slice(1);
    
    const emailColumn = fieldMappings?.email || fieldMappings?.Email || 'email';
    const emailIndex = headers.findIndex(h => h.toLowerCase() === emailColumn.toLowerCase());
    
    if (emailIndex === -1) {
      return NextResponse.json(
        { error: `Email column '${emailColumn}' not found in CSV headers` },
        { status: 400 }
      );
    }
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );
    
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const senderEmail = process.env.GMAIL_SENDER_EMAIL || oauth2Client.credentials.email;
    const senderName = fieldMappings?.sender_name || fieldMappings?.senderName || '';
    const replyToEmail = fieldMappings?.reply_to || fieldMappings?.replyTo || null;
    
    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;
    const results = [];
    
    for (const row of dataRows) {
      const values = parseCsvRow(row);
      const email = values[emailIndex]?.trim();
      
      if (!isValidEmail(email)) {
        console.warn(`Invalid email format: ${email}`);
        failCount++;
        results.push({ email, status: 'failed', reason: 'Invalid email format' });
        continue;
      }
      
      // Check for duplicates
      const duplicateQuery = query(
        collection(db, 'sent_emails'),
        where('userId', '==', userId),
        where('to', '==', email.toLowerCase())
      );
      
      let isDuplicate = false;
      try {
        const duplicateSnapshot = await getDocs(duplicateQuery);
        isDuplicate = !duplicateSnapshot.empty;
      } catch (error) {
        console.error('Duplicate check error:', error);
      }
      
      if (isDuplicate) {
        console.log(`Skipping duplicate email: ${email}`);
        skipCount++;
        results.push({ email, status: 'skipped', reason: 'Already sent' });
        continue;
      }
      
      const recipient = {};
      headers.forEach((header, index) => {
        recipient[header] = values[index] || '';
      });
      
      const businessName = recipient[fieldMappings?.company || fieldMappings?.business_name || fieldMappings?.businessName || ''];
      const firstName = recipient[fieldMappings?.first_name || fieldMappings?.firstName || ''];
      const lastName = recipient[fieldMappings?.last_name || fieldMappings?.lastName || ''];
      
      let template;
      if (abTestMode && templateA && templateB) {
        template = templateToSend === 'A' ? templateA : templateB;
      } else {
        template = templateA || templateB || '';
      }
      
      let subject = template.subject || '';
      let body = template.body || '';
      
      subject = subject.replace(/\{\{first_name\}\}/gi, firstName)
                      .replace(/\{\{last_name\}\}/gi, lastName)
                      .replace(/\{\{company\}\}/gi, businessName)
                      .replace(/\{\{company_name\}\}/gi, businessName);
      
      body = body.replace(/\{\{first_name\}\}/gi, firstName)
                 .replace(/\{\{last_name\}\}/gi, lastName)
                 .replace(/\{\{company\}\}/gi, businessName)
                 .replace(/\{\{company_name\}\}/gi, businessName);
      
      try {
        const rawMessage = createMimeMessage(email, subject, body, senderEmail, senderName, replyToEmail);
        const encoded = Buffer.from(rawMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        
        const response = await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw: encoded }
        });
        
        const now = new Date().toISOString();
        const emailData = {
          userId,
          to: email.toLowerCase(),
          businessName,
          subject,
          body,
          template: abTestMode ? templateToSend : 'A',
          sentAt: now,
          opened: false,
          openedCount: 0,
          clicked: false,
          clickCount: 0,
          replied: false,
          followUpCount: 0,
          followUpSentCount: 0,
          followUpAt: new Date(new Date().getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          lastFollowUpAt: null,
          lastFollowUpSentAt: null,
          followUpDates: [],
          messageId: response.data.id,
          threadId: response.data.threadId,
          csvSource: csvSource || 'unknown'
        };
        
        await addDoc(collection(db, 'sent_emails'), emailData);
        
        successCount++;
        results.push({ email, status: 'success', messageId: response.data.id });
        
        await new Promise(resolve => setTimeout(resolve, CONFIG.RATE_LIMIT_DELAY_MS));
        
      } catch (sendError) {
        console.error(`Failed to send to ${email}:`, sendError);
        failCount++;
        results.push({ email, status: 'failed', reason: sendError.message });
      }
    }
    
    return NextResponse.json({
      success: true,
      total: dataRows.length,
      successCount,
      failCount,
      skipCount,
      results
    });
    
  } catch (error) {
    console.error('Send email error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// HANDLE FOLLOW-UP SEND
// ============================================================================
async function handleFollowUpSend(contact, followUpCount, userId, accessToken, requestData) {
  if (!userId || !accessToken) {
    return NextResponse.json(
      { error: 'Missing required fields for follow-up' },
      { status: 400 }
    );
  }

  const { senderName, templateToSend } = requestData;
  const email = contact.email || contact.to;
  
  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: 'Invalid email format' },
      { status: 400 }
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );
  
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const senderEmail = process.env.GMAIL_SENDER_EMAIL || oauth2Client.credentials.email;
  
  const businessName = contact.businessName || '';
  const firstName = contact.firstName || '';
  const lastName = contact.lastName || '';
  
  // Simple follow-up template
  let subject = `Following up - ${businessName}`;
  let body = `Hi ${firstName},\n\nI wanted to follow up on my previous email. Are you still interested in discussing how we can help ${businessName}?\n\nBest regards,\n${senderName}`;
  
  try {
    const rawMessage = createMimeMessage(email, subject, body, senderEmail, senderName);
    const encoded = Buffer.from(rawMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encoded }
    });
    
    const now = new Date().toISOString();
    
    // Find and update existing record
    const q = query(
      collection(db, 'sent_emails'),
      where('userId', '==', userId),
      where('to', '==', email.toLowerCase())
    );
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const existingDoc = querySnapshot.docs[0];
      const docRef = doc(db, 'sent_emails', existingDoc.id);
      const existingData = existingDoc.data();
      
      const currentFollowUpCount = Number(existingData.followUpCount ?? existingData.followUpSentCount ?? 0);
      const newFollowUpCount = currentFollowUpCount + 1;
      
      // Calculate next follow-up date
      const daysToAdd = newFollowUpCount === 1 ? 3 : newFollowUpCount === 2 ? 7 : 14;
      const nextFollowUpDate = new Date();
      nextFollowUpDate.setDate(nextFollowUpDate.getDate() + daysToAdd);

      const updateData = {
        ...existingData,
        subject,
        body,
        template: templateToSend || 'followup',
        followUpCount: newFollowUpCount,
        followUpSentCount: newFollowUpCount,
        lastFollowUpAt: now,
        lastFollowUpSentAt: now,
        followUpDates: [...(existingData.followUpDates || []), now],
        followUpAt: newFollowUpCount < 3 ? nextFollowUpDate.toISOString() : null,
        messageId: response.data.id,
        threadId: response.data.threadId
      };

      await updateDoc(docRef, updateData);
      console.log(`✅ Updated follow-up record for ${email}: follow-up #${newFollowUpCount}`);
      
      return NextResponse.json({
        success: true,
        followUpCount: newFollowUpCount,
        email,
        messageId: response.data.id
      });
    } else {
      // Fallback: create new record if existing not found
      console.warn(`⚠️ Existing record not found for ${email}, creating new one`);
      const emailData = {
        userId,
        to: email.toLowerCase(),
        businessName,
        subject,
        body,
        template: templateToSend || 'followup',
        sentAt: now,
        opened: false,
        openedCount: 0,
        clicked: false,
        clickCount: 0,
        replied: false,
        followUpCount: 1,
        followUpSentCount: 1,
        followUpAt: new Date(new Date().getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        lastFollowUpAt: now,
        lastFollowUpSentAt: now,
        followUpDates: [now],
        messageId: response.data.id,
        threadId: response.data.threadId,
        csvSource: 'followup'
      };
      
      await addDoc(collection(db, 'sent_emails'), emailData);
      
      return NextResponse.json({
        success: true,
        followUpCount: 1,
        email,
        messageId: response.data.id
      });
    }
    
  } catch (sendError) {
    console.error(`Failed to send follow-up to ${email}:`, sendError);
    return NextResponse.json(
      { error: sendError.message },
      { status: 500 }
    );
  }
}
