// app/api/list-sent-leads/route.js
import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, orderBy, deleteDoc, doc } from 'firebase/firestore';

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
const CAMPAIGN_WINDOW_DAYS = 30;
const MAX_FOLLOW_UPS = 3;

// ============================================================================
// POST HANDLER
// ============================================================================
export async function POST(request) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
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
      const sentAt = data.sentAt?.toDate ? data.sentAt.toDate() : new Date(data.sentAt);
      const daysSinceSent = (now - sentAt) / (1000 * 60 * 60 * 24);
      
      // Check if loop should be closed (30 days or 3 follow-ups)
      const shouldCloseLoop = daysSinceSent > CAMPAIGN_WINDOW_DAYS || 
                             (data.followUpCount || 0) >= MAX_FOLLOW_UPS ||
                             data.replied === true;
      
      leads.push({
        id: docSnapshot.id,
        email: data.to,
        businessName: data.businessName,
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
        subject: data.subject,
        stage: data.stage || 'new'
      });
    });
    
    // Sort by sentAt (newest first)
    leads.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
    
    return NextResponse.json({
      leads,
      total: leads.length,
      deletedCount
    });
    
  } catch (error) {
    console.error('List sent leads error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to list sent leads',
        details: error.message,
        leads: []
      },
      { status: 200 }
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