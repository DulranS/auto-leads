// app/api/list-sent-leads/route.js
import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, orderBy, deleteDoc, doc } from 'firebase/firestore';

// ============================================================================
// FIREBASE CONFIGURATION WITH ERROR HANDLING
// ============================================================================
// Validate required environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error('Missing Firebase environment variables:', missingEnvVars.join(', '));
}

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
  // We'll handle this in the POST handler
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
    // Check Firebase initialization
    if (!app || !db) {
      return NextResponse.json(
        { 
          error: 'Firebase not properly initialized',
          details: 'Missing or invalid Firebase configuration',
          leads: []
        },
        { status: 500, headers }
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
      collection(db, 'sent_emails'),
      where('userId', '==', userId)
    );
    
    const snapshot = await getDocs(q);
    const leads = [];
    let deletedCount = 0;
    const now = new Date();
    
    snapshot.forEach(docSnapshot => {
      const data = docSnapshot.data();
      try {
        const sentAt = data.sentAt?.toDate ? data.sentAt.toDate() : (data.sentAt ? new Date(data.sentAt) : new Date());
        const daysSinceSent = (now - sentAt) / (1000 * 60 * 60 * 24);
        
        // Check if loop should be closed (30 days or 3 follow-ups)
        const shouldCloseLoop = daysSinceSent > CAMPAIGN_WINDOW_DAYS || 
                               (data.followUpCount || 0) >= MAX_FOLLOW_UPS ||
                               data.replied === true;
        
        leads.push({
          id: docSnapshot.id,
          email: data.to || '',
          businessName: data.businessName || '',
          sentAt: sentAt.toISOString(),
          replied: data.replied || false,
          opened: data.opened || false,
          openedCount: data.openedCount || 0,
          clicked: data.clicked || false,
          clickCount: data.clickCount || 0,
          followUpCount: data.followUpCount || 0,
          followUpAt: data.followUpAt ? 
            (data.followUpAt.toDate ? data.followUpAt.toDate().toISOString() : data.followUpAt) : 
            null,
          lastFollowUpAt: data.lastFollowUpAt ?
            (data.lastFollowUpAt.toDate ? data.lastFollowUpAt.toDate().toISOString() : data.lastFollowUpAt) :
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