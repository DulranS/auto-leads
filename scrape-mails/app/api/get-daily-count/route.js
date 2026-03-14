// app/api/get-daily-count/route.js
import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';

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
  MAX_DAILY_CALLS: 30
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
    
    const { startOfDay, endOfDay } = getTodayRange();
    
    // Get email count
    const emailQuery = query(
      collection(db, 'sent_emails'),
      where('userId', '==', userId),
      where('sentAt', '>=', Timestamp.fromDate(startOfDay)),
      where('sentAt', '<=', Timestamp.fromDate(endOfDay))
    );
    const emailSnapshot = await getDocs(emailQuery);
    
    // Get WhatsApp count
    const whatsappQuery = query(
      collection(db, 'whatsapp_sent'),
      where('userId', '==', userId),
      where('sentAt', '>=', Timestamp.fromDate(startOfDay)),
      where('sentAt', '<=', Timestamp.fromDate(endOfDay))
    );
    const whatsappSnapshot = await getDocs(whatsappQuery);
    
    // Get SMS count
    const smsQuery = query(
      collection(db, 'sms_sent'),
      where('userId', '==', userId),
      where('sentAt', '>=', Timestamp.fromDate(startOfDay)),
      where('sentAt', '<=', Timestamp.fromDate(endOfDay))
    );
    const smsSnapshot = await getDocs(smsQuery);
    
    // Get call count
    const callQuery = query(
      collection(db, 'calls'),
      where('userId', '==', userId),
      where('createdAt', '>=', Timestamp.fromDate(startOfDay)),
      where('createdAt', '<=', Timestamp.fromDate(endOfDay))
    );
    const callSnapshot = await getDocs(callQuery);
    
    // Calculate reset time (midnight tomorrow)
    const tomorrow = new Date(startOfDay);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return NextResponse.json({
      count: emailSnapshot.size,
      whatsappCount: whatsappSnapshot.size,
      smsCount: smsSnapshot.size,
      callCount: callSnapshot.size,
      limits: {
        emails: CONFIG.MAX_DAILY_EMAILS,
        whatsapp: CONFIG.MAX_DAILY_WHATSAPP,
        sms: CONFIG.MAX_DAILY_SMS,
        calls: CONFIG.MAX_DAILY_CALLS
      },
      resetTime: tomorrow.toISOString(),
      remaining: {
        emails: Math.max(0, CONFIG.MAX_DAILY_EMAILS - emailSnapshot.size),
        whatsapp: Math.max(0, CONFIG.MAX_DAILY_WHATSAPP - whatsappSnapshot.size),
        sms: Math.max(0, CONFIG.MAX_DAILY_SMS - smsSnapshot.size),
        calls: Math.max(0, CONFIG.MAX_DAILY_CALLS - callSnapshot.size)
      }
    });
    
  } catch (error) {
    console.error('Get daily count error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get daily count',
        details: error.message,
        count: 0,
        whatsappCount: 0,
        smsCount: 0,
        callCount: 0
      },
      { status: 200 }
    );
  }
}