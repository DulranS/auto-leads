// app/api/list-sent-leads/route.js
import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getFirestore, collection, query, where, getDocs, orderBy, deleteDoc, doc } from 'firebase-admin/firestore';

// ============================================================================
// FIREBASE ADMIN CONFIGURATION
// ============================================================================
const getFirebaseAdminConfig = () => {
  const requiredEnvVars = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.warn('Missing Firebase Admin environment variables:', missingVars.join(', '));
    return null;
  }

  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  };
};

let adminApp;
let adminDb;

try {
  const adminConfig = getFirebaseAdminConfig();
  if (adminConfig) {
    adminApp = !getApps().length ? initializeApp({
      credential: cert(adminConfig)
    }) : getApp();
    adminDb = getFirestore(adminApp);
    console.log('✅ Firebase Admin initialized successfully');
  } else {
    console.warn('⚠️ Firebase Admin not configured');
  }
} catch (configError) {
  console.error('Firebase Admin configuration error:', configError);
}

// ============================================================================
// CONFIGURATION
// ============================================================================
const CAMPAIGN_WINDOW_DAYS = 30;
const MAX_FOLLOW_UPS = 3;

// ============================================================================
// POST HANDLER
// ============================================================================
export async function POST(request) {
  // Set response headers to ensure JSON response
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  };

  try {
    // Check Firebase Admin configuration
    if (!adminDb) {
      console.warn('Firebase Admin not configured, returning empty leads list');
      return NextResponse.json(
        {
          success: false,
          message: 'Lead listing skipped - database not configured',
          code: 'FIREBASE_NOT_CONFIGURED',
          leads: []
        },
        { status: 200, headers }
      );
    }

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required', leads: [] },
        { status: 400, headers }
      );
    }

    // Get all sent emails for user
    const q = query(
      collection(adminDb, 'sent_emails'),
      where('userId', '==', userId)
    );

    const snapshot = await getDocs(q);
    const leads = [];
    let deletedCount = 0;

    // Helper function to safely convert timestamp to Date
    const safeToDate = (timestamp) => {
      if (!timestamp) return new Date();
      if (typeof timestamp?.toDate === 'function') {
        return timestamp.toDate();
      } else if (timestamp instanceof Date) {
        return timestamp;
      } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
        return new Date(timestamp);
      } else {
        return new Date();
      }
    };

    const getFollowUpCount = (data) => {
      return data.followUpCount ?? data.followUpSentCount ?? 0;
    };

    const getEmailAddress = (data) => {
      const rawEmail =
        data.to ||
        data.email ||
        data.contactEmail ||
        data.recipientEmail ||
        data.recipient?.email ||
        data.toEmail ||
        '';
      return String(rawEmail).trim().toLowerCase();
    };

    const getLastFollowUpAt = (data) => {
      return data.lastFollowUpAt ?? data.lastFollowUpSentAt ?? null;
    };

    const now = new Date();

    snapshot.forEach(docSnapshot => {
      const data = docSnapshot.data();
      try {
        const email = getEmailAddress(data);
        if (!email) {
          console.warn(`Skipping sent email record ${docSnapshot.id} because recipient email is missing`);
          return;
        }

        const sentAt = safeToDate(data.sentAt);
        const daysSinceSent = (now - sentAt) / (1000 * 60 * 60 * 24);

        // Check if loop should be closed (30 days or 3 follow-ups)
        const shouldCloseLoop = daysSinceSent > CAMPAIGN_WINDOW_DAYS ||
          (data.followUpCount || 0) >= MAX_FOLLOW_UPS ||
          data.replied === true;

        leads.push({
          id: docSnapshot.id,
          email,
          businessName: data.businessName || '',
          sentAt: sentAt.toISOString(),
          replied: data.replied || false,
          opened: data.opened || false,
          openedCount: data.openedCount || 0,
          clicked: data.clicked || false,
          clickCount: data.clickCount || 0,
          followUpCount: getFollowUpCount(data),
          followUpAt: data.followUpAt ?
            safeToDate(data.followUpAt).toISOString() :
            null,
          lastFollowUpAt: getLastFollowUpAt(data) ?
            safeToDate(getLastFollowUpAt(data)).toISOString() :
            null,
          followUpDates: data.followUpDates || [],
          seemsInterested: (data.openedCount || 0) > 0 || (data.clickCount || 0) > 0,
          interestScore: calculateInterestScore(data),
          loopClosed: shouldCloseLoop,
          template: data.template || 'A',
          subject: data.subject || '',
          stage: data.stage || 'new'
        });
      } catch (docError) {
        console.error('Error processing document:', docSnapshot.id, docError);
        // Skip problematic documents but continue processing others
        return;
      }
    });

    // Sort by sentAt (newest first)
    leads.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));

    console.log(`✅ Successfully loaded ${leads.length} sent leads for user ${userId}`);

    return NextResponse.json({
      leads,
      total: leads.length,
      deletedCount
    }, { headers });

  } catch (error) {
    console.error('List sent leads error:', error);
    return NextResponse.json(
      {
        error: 'Failed to list sent leads',
        details: error.message,
        leads: []
      },
      { status: 200, headers }
    );
  }
}

// ============================================================================
// HELPER: CALCULATE INTEREST SCORE
// ============================================================================
function calculateInterestScore(data) {
  let score = 0;

  if (data.opened) score += 20;
  score += Math.min(30, (data.openedCount || 0) * 5);

  if (data.clicked) score += 30;
  score += Math.min(50, (data.clickCount || 0) * 10);

  if (data.replied) score += 100;

  return Math.min(100, score);
}
