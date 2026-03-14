// app/api/list-sent-leads/route.js
import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, orderBy, limit, startAfter, deleteDoc, doc, Timestamp } from 'firebase/firestore';

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
  CAMPAIGN_WINDOW_DAYS: 30,
  MAX_FOLLOW_UPS: 3,
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 200,
  CLEANUP_BATCH_SIZE: 100
};

// ============================================================================
// GET TODAY'S DATE RANGE
// ============================================================================
const getTodayRange = () => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { startOfDay, endOfDay };
};

// ============================================================================
// CLEANUP OLD RECORDS (BATCH PROCESS)
// ============================================================================
const cleanupOldRecords = async (userId) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CONFIG.CAMPAIGN_WINDOW_DAYS - 7); // 7 days extra buffer
    
    const oldRecordsQuery = query(
      collection(db, 'sent_emails'),
      where('userId', '==', userId),
      where('sentAt', '<', Timestamp.fromDate(cutoffDate)),
      limit(CONFIG.CLEANUP_BATCH_SIZE)
    );
    
    const oldSnapshot = await getDocs(oldRecordsQuery);
    const deletePromises = oldSnapshot.docs.map(doc => deleteDoc(doc.ref));
    
    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
      console.log(`Cleaned up ${deletePromises.length} old records for user ${userId}`);
    }
    
    return deletePromises.length;
  } catch (error) {
    console.error('Cleanup error:', error);
    return 0;
  }
};

// ============================================================================
// CALCULATE INTEREST SCORE
// ============================================================================
const calculateInterestScore = (data) => {
  let score = 0;
  
  if (data.opened) score += 20;
  score += Math.min(30, (data.openedCount || 0) * 5);
  
  if (data.clicked) score += 30;
  score += Math.min(50, (data.clickCount || 0) * 10);
  
  if (data.replied) score += 100;
  
  return Math.min(100, score);
};

// ============================================================================
// POST HANDLER
// ============================================================================
export async function POST(request) {
  const startTime = Date.now();
  let logData = {
    timestamp: new Date().toISOString(),
    userId: null,
    success: false,
    error: null,
    duration: 0,
    leadCount: 0,
    deletedCount: 0
  };
  
  try {
    const { userId, pageSize = CONFIG.DEFAULT_PAGE_SIZE, lastVisible = null, includeStats = true } = await request.json();
    logData.userId = userId;
    
    if (!userId) {
      logData.error = 'userId is required';
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }
    
    // Validate page size
    const validatedPageSize = Math.min(Math.max(1, parseInt(pageSize)), CONFIG.MAX_PAGE_SIZE);
    
    // Build query with pagination
    let q = query(
      collection(db, 'sent_emails'),
      where('userId', '==', userId),
      orderBy('sentAt', 'desc'),
      limit(validatedPageSize)
    );
    
    if (lastVisible) {
      try {
        const lastDoc = doc(db, 'sent_emails', lastVisible);
        q = query(
          collection(db, 'sent_emails'),
          where('userId', '==', userId),
          orderBy('sentAt', 'desc'),
          startAfter(lastDoc),
          limit(validatedPageSize)
        );
      } catch (error) {
        console.warn('Invalid lastVisible document, starting from beginning:', error);
        // Continue with query without pagination
      }
    }
    
    // Execute query
    const snapshot = await getDocs(q);
    const leads = [];
    let deletedCount = 0;
    const now = new Date();
    
    // Process documents
    for (const docSnapshot of snapshot.docs) {
      try {
        const data = docSnapshot.data();
        const sentAt = data.sentAt?.toDate ? data.sentAt.toDate() : new Date(data.sentAt);
        const daysSinceSent = (now - sentAt) / (1000 * 60 * 60 * 24);
        
        // Check if loop should be closed (30 days or 3 follow-ups)
        const shouldCloseLoop = daysSinceSent > CONFIG.CAMPAIGN_WINDOW_DAYS || 
                               (data.followUpCount || 0) >= CONFIG.MAX_FOLLOW_UPS ||
                               data.replied === true;
        
        // Calculate follow-up readiness
        const lastFollowUpAt = data.lastFollowUpAt ? 
          (data.lastFollowUpAt.toDate ? data.lastFollowUpAt.toDate() : new Date(data.lastFollowUpAt)) :
          sentAt;
        const daysSinceLastContact = (now - lastFollowUpAt) / (1000 * 60 * 60 * 24);
        const readyForFollowUp = !data.replied && 
                                daysSinceLastContact >= 2 && 
                                (data.followUpCount || 0) < CONFIG.MAX_FOLLOW_UPS &&
                                daysSinceSent <= CONFIG.CAMPAIGN_WINDOW_DAYS;
        
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
          readyForFollowUp,
          daysSinceSent: Math.round(daysSinceSent),
          daysSinceLastContact: Math.round(daysSinceLastContact),
          template: data.template || 'A',
          subject: data.subject,
          stage: data.stage || 'new'
        });
      } catch (error) {
        console.error(`Error processing document ${docSnapshot.id}:`, error);
        // Skip problematic document but continue processing others
        continue;
      }
    }
    
    logData.leadCount = leads.length;
    
    // Get pagination info
    const hasMore = snapshot.size === validatedPageSize;
    const lastVisibleDoc = hasMore ? snapshot.docs[snapshot.docs.length - 1].id : null;
    
    // Calculate statistics if requested
    let stats = null;
    if (includeStats && leads.length > 0) {
      const totalSent = leads.length;
      const totalReplied = leads.filter(l => l.replied).length;
      const totalOpened = leads.filter(l => l.opened).length;
      const totalClicked = leads.filter(l => l.clicked).length;
      const readyForFollowUp = leads.filter(l => l.readyForFollowUp).length;
      const loopClosed = leads.filter(l => l.loopClosed).length;
      
      stats = {
        totalSent,
        totalReplied,
        totalOpened,
        totalClicked,
        readyForFollowUp,
        loopClosed,
        replyRate: totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0,
        openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0,
        clickRate: totalOpened > 0 ? Math.round((totalClicked / totalOpened) * 100) : 0,
        avgInterestScore: Math.round(leads.reduce((sum, l) => sum + l.interestScore, 0) / leads.length)
      };
    }
    
    // Cleanup old records in background (don't wait for completion)
    if (Math.random() < 0.1) { // 10% chance to run cleanup
      cleanupOldRecords(userId).then(count => {
        deletedCount = count;
      }).catch(error => {
        console.error('Background cleanup failed:', error);
      });
    }
    
    logData.success = true;
    logData.duration = Date.now() - startTime;
    logData.deletedCount = deletedCount;
    
    return NextResponse.json({
      leads,
      total: leads.length,
      hasMore,
      lastVisible: lastVisibleDoc,
      pageSize: validatedPageSize,
      stats,
      deletedCount
    });
    
  } catch (error) {
    logData.error = error.message;
    logData.duration = Date.now() - startTime;
    
    console.error('List sent leads error:', {
      message: error.message,
      userId,
      duration: logData.duration,
      stack: error.stack
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to list sent leads',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        leads: [],
        total: 0
      },
      { status: 200 } // Return 200 even on error to prevent frontend breaking
    );
  } finally {
    // Log the operation
    console.log('List sent leads operation completed:', JSON.stringify(logData, null, 2));
  }
}