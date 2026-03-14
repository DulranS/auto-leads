// app/api/get-daily-count/route.js
import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, Timestamp, orderBy, limit } from 'firebase/firestore';

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
  MAX_DAILY_WHATSAPP: 100,
  MAX_DAILY_SMS: 50,
  MAX_DAILY_CALLS: 30,
  CACHE_TTL_MS: 30000, // 30 seconds cache
  MAX_BATCH_SIZE: 1000
};

// ============================================================================
// IN-MEMORY CACHE (for basic performance)
// ============================================================================
const cache = new Map();

const getCachedData = (userId) => {
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.timestamp < CONFIG.CACHE_TTL_MS) {
    return cached.data;
  }
  return null;
};

const setCachedData = (userId, data) => {
  cache.set(userId, {
    data,
    timestamp: Date.now()
  });
  
  // Clean up old cache entries periodically
  if (cache.size > 100) {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
      if (now - value.timestamp > CONFIG.CACHE_TTL_MS * 2) {
        cache.delete(key);
      }
    }
  }
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
// OPTIMIZED COUNT QUERY WITH PAGINATION
// ============================================================================
const getCountWithPagination = async (collectionName, userId, startOfDay, endOfDay) => {
  try {
    let totalCount = 0;
    let lastVisible = null;
    let hasMore = true;
    
    while (hasMore) {
      let q = query(
        collection(db, collectionName),
        where('userId', '==', userId),
        where('sentAt', '>=', Timestamp.fromDate(startOfDay)),
        where('sentAt', '<=', Timestamp.fromDate(endOfDay)),
        limit(CONFIG.MAX_BATCH_SIZE)
      );
      
      if (lastVisible) {
        q = query(
          collection(db, collectionName),
          where('userId', '==', userId),
          where('sentAt', '>=', Timestamp.fromDate(startOfDay)),
          where('sentAt', '<=', Timestamp.fromDate(endOfDay)),
          orderBy('sentAt'),
          startAfter(lastVisible),
          limit(CONFIG.MAX_BATCH_SIZE)
        );
      }
      
      const snapshot = await getDocs(q);
      totalCount += snapshot.size;
      
      if (snapshot.size < CONFIG.MAX_BATCH_SIZE) {
        hasMore = false;
      } else {
        lastVisible = snapshot.docs[snapshot.docs.length - 1];
      }
      
      // Safety check to prevent infinite loops
      if (totalCount > CONFIG.MAX_DAILY_EMAILS * 2) {
        console.warn(`Unusually high count detected for ${collectionName}, stopping count`);
        break;
      }
    }
    
    return totalCount;
  } catch (error) {
    console.error(`Error counting ${collectionName}:`, error);
    return 0;
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
    success: false,
    error: null,
    duration: 0,
    cacheHit: false
  };
  
  try {
    const { userId, forceRefresh = false } = await request.json();
    logData.userId = userId;
    
    if (!userId) {
      logData.error = 'userId is required';
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }
    
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedData = getCachedData(userId);
      if (cachedData) {
        logData.success = true;
        logData.cacheHit = true;
        logData.duration = Date.now() - startTime;
        
        return NextResponse.json({
          ...cachedData,
          cached: true
        });
      }
    }
    
    const { startOfDay, endOfDay } = getTodayRange();
    
    // Execute queries in parallel for better performance
    const [emailCount, whatsappCount, smsCount, callCount] = await Promise.all([
      getCountWithPagination('sent_emails', userId, startOfDay, endOfDay),
      getCountWithPagination('whatsapp_sent', userId, startOfDay, endOfDay),
      getCountWithPagination('sms_sent', userId, startOfDay, endOfDay),
      getCountWithPagination('calls', userId, startOfDay, endOfDay)
    ]);
    
    // Calculate reset time (midnight tomorrow)
    const tomorrow = new Date(startOfDay);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const result = {
      count: emailCount,
      whatsappCount,
      smsCount,
      callCount,
      limits: {
        emails: CONFIG.MAX_DAILY_EMAILS,
        whatsapp: CONFIG.MAX_DAILY_WHATSAPP,
        sms: CONFIG.MAX_DAILY_SMS,
        calls: CONFIG.MAX_DAILY_CALLS
      },
      resetTime: tomorrow.toISOString(),
      remaining: {
        emails: Math.max(0, CONFIG.MAX_DAILY_EMAILS - emailCount),
        whatsapp: Math.max(0, CONFIG.MAX_DAILY_WHATSAPP - whatsappCount),
        sms: Math.max(0, CONFIG.MAX_DAILY_SMS - smsCount),
        calls: Math.max(0, CONFIG.MAX_DAILY_CALLS - callCount)
      },
      usage: {
        emails: Math.round((emailCount / CONFIG.MAX_DAILY_EMAILS) * 100),
        whatsapp: Math.round((whatsappCount / CONFIG.MAX_DAILY_WHATSAPP) * 100),
        sms: Math.round((smsCount / CONFIG.MAX_DAILY_SMS) * 100),
        calls: Math.round((callCount / CONFIG.MAX_DAILY_CALLS) * 100)
      },
      warnings: {
        emails: emailCount >= CONFIG.MAX_DAILY_EMAILS * 0.8,
        whatsapp: whatsappCount >= CONFIG.MAX_DAILY_WHATSAPP * 0.8,
        sms: smsCount >= CONFIG.MAX_DAILY_SMS * 0.8,
        calls: callCount >= CONFIG.MAX_DAILY_CALLS * 0.8
      },
      critical: {
        emails: emailCount >= CONFIG.MAX_DAILY_EMAILS * 0.95,
        whatsapp: whatsappCount >= CONFIG.MAX_DAILY_WHATSAPP * 0.95,
        sms: smsCount >= CONFIG.MAX_DAILY_SMS * 0.95,
        calls: callCount >= CONFIG.MAX_DAILY_CALLS * 0.95
      }
    };
    
    // Cache the result
    setCachedData(userId, result);
    
    logData.success = true;
    logData.duration = Date.now() - startTime;
    
    return NextResponse.json({
      ...result,
      cached: false
    });
    
  } catch (error) {
    logData.error = error.message;
    logData.duration = Date.now() - startTime;
    
    console.error('Get daily count error:', {
      message: error.message,
      userId,
      duration: logData.duration,
      stack: error.stack
    });
    
    // Return fallback data on error
    const fallbackData = {
      count: 0,
      whatsappCount: 0,
      smsCount: 0,
      callCount: 0,
      limits: {
        emails: CONFIG.MAX_DAILY_EMAILS,
        whatsapp: CONFIG.MAX_DAILY_WHATSAPP,
        sms: CONFIG.MAX_DAILY_SMS,
        calls: CONFIG.MAX_DAILY_CALLS
      },
      resetTime: new Date(Date.now() + 86400000).toISOString(), // 24 hours from now
      remaining: {
        emails: CONFIG.MAX_DAILY_EMAILS,
        whatsapp: CONFIG.MAX_DAILY_WHATSAPP,
        sms: CONFIG.MAX_DAILY_SMS,
        calls: CONFIG.MAX_DAILY_CALLS
      },
      usage: {
        emails: 0,
        whatsapp: 0,
        sms: 0,
        calls: 0
      },
      warnings: {
        emails: false,
        whatsapp: false,
        sms: false,
        calls: false
      },
      critical: {
        emails: false,
        whatsapp: false,
        sms: false,
        calls: false
      },
      error: 'Failed to get accurate counts, using fallback data'
    };
    
    return NextResponse.json(fallbackData, { status: 200 });
    
  } finally {
    // Log the operation
    console.log('Get daily count operation completed:', JSON.stringify(logData, null, 2));
  }
}