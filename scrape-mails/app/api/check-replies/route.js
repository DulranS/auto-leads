// app/api/check-replies/route.js
import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { google } from 'googleapis';

// ============================================================================
// FIREBASE CONFIGURATION
// ============================================================================
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || ''
};

let app;
let db;

try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  db = getFirestore(app);
} catch (error) {
  console.error('Firebase initialization error:', error);
}

// ============================================================================
// POST HANDLER
// ============================================================================
export async function POST(request) {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  };

  try {
    // Check Firebase initialization
    if (!app || !db) {
      return NextResponse.json(
        {
          error: 'Firebase not properly initialized',
          details: 'Missing or invalid Firebase configuration'
        },
        { status: 500, headers }
      );
    }

    const { userId, accessToken, senderEmail } = await request.json();

    if (!userId || !accessToken || !senderEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400, headers }
      );
    }

    // Get sent emails that haven't been replied to yet
    const q = query(
      collection(db, 'sent_emails'),
      where('userId', '==', userId),
      where('replied', '==', false)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return NextResponse.json({ replyCount: 0 }, { headers });
    }

    // Set up Gmail API
    const oauth2Client = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET,
      process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    let replyCount = 0;

    // Check each sent email for replies
    for (const doc of snapshot.docs) {
      const sentEmail = doc.data();
      const toEmail = sentEmail.to;
      const subject = sentEmail.subject;

      try {
        // Search for replies in Gmail
        const searchQuery = `to:${senderEmail} from:${toEmail} in:inbox "${subject}"`;
        const response = await gmail.users.messages.list({
          userId: 'me',
          q: searchQuery,
          maxResults: 1
        });

        if (response.data.messages && response.data.messages.length > 0) {
          // Found a reply - update Firebase
          await updateDoc(doc.ref, {
            replied: true,
            repliedAt: new Date().toISOString(),
            followUpAt: null // Cancel scheduled follow-ups
          });

          replyCount++;
          console.log(`✅ Reply detected from ${toEmail}`);

          // Track company reply
          try {
            await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/mark-replied`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId,
                email: toEmail
              })
            });
          } catch (trackError) {
            console.warn('Failed to track reply:', trackError);
          }
        }
      } catch (emailError) {
        console.error(`Error checking email ${toEmail}:`, emailError);
        // Continue with next email
      }
    }

    return NextResponse.json({ replyCount }, { headers });

  } catch (error) {
    console.error('Check replies error:', error);
    return NextResponse.json(
      {
        error: 'Failed to check for replies',
        details: error.message,
        replyCount: 0
      },
      { status: 500, headers }
    );
  }
}
