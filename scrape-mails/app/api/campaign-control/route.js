import { NextResponse } from 'next/server';
import { getFirestore, doc, updateDoc, serverTimestamp, arrayUnion, increment } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';

// Firebase initialization
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

// Send safety rules
const SEND_SAFETY_RULES = {
  maxEmailsPerDay: 50,
  maxEmailsPerHour: 10,
  bounceThreshold: 0.05,
  unsubscribeThreshold: 0.01,
  requiredDelayMinutes: 2
};

export async function POST(req) {
  try {
    const { campaignId, targetId, template, manualSend = false } = await req.json();
    
    // Check send safety rules
    const safetyCheck = await checkSendSafety(campaignId);
    if (!manualSend && !safetyCheck.safe) {
      return NextResponse.json({ 
        error: 'Send safety rules violated', 
        reason: safetyCheck.reason 
      }, { status: 429 });
    }
    
    // Get campaign and target
    const campaignRef = doc(db, 'campaigns', campaignId);
    const campaignDoc = await getDoc(campaignRef);
    
    if (!campaignDoc.exists()) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    
    const campaign = campaignDoc.data();
    const target = campaign.targets.find(t => t.id === targetId);
    
    if (!target) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }
    
    // Send email
    const sendResult = await sendEmail(target, template, campaign);
    
    // Update campaign KPIs
    await updateDoc(campaignRef, {
      'kpis.sent': increment(1),
      'kpis.lastSentAt': serverTimestamp(),
      'sendSafety.emailsSentToday': increment(1),
      'sendSafety.emailsSentThisHour': increment(1),
      'sendSafety.lastSendTime': serverTimestamp(),
      [`targets.${target.id}.status`]: 'contacted',
      [`targets.${target.id}.lastContacted`]: serverTimestamp(),
      [`targets.${target.id}.sequenceStep`]: (target.sequenceStep || 0) + 1,
      [`targets.${target.id}.emailsSent`]: arrayUnion({
        template: template.name,
        sentAt: serverTimestamp(),
        messageId: sendResult.messageId
      })
    });
    
    return NextResponse.json({
      success: true,
      messageId: sendResult.messageId,
      targetId,
      template: template.name
    });
    
  } catch (error) {
    console.error('Send email error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}

async function checkSendSafety(campaignId) {
  try {
    const campaignRef = doc(db, 'campaigns', campaignId);
    const campaignDoc = await getDoc(campaignRef);
    
    if (!campaignDoc.exists()) {
      return { safe: false, reason: 'Campaign not found' };
    }
    
    const campaign = campaignDoc.data();
    const sendSafety = campaign.sendSafety || {};
    const kpis = campaign.kpis || {};
    
    // Check bounce rate
    const bounceRate = kpis.sent > 0 ? kpis.bounced / kpis.sent : 0;
    if (bounceRate > SEND_SAFETY_RULES.bounceThreshold) {
      return { safe: false, reason: `Bounce rate ${(bounceRate * 100).toFixed(1)}% exceeds threshold` };
    }
    
    // Check unsubscribe rate
    const unsubscribeRate = kpis.sent > 0 ? kpis.unsubscribed / kpis.sent : 0;
    if (unsubscribeRate > SEND_SAFETY_RULES.unsubscribeThreshold) {
      return { safe: false, reason: `Unsubscribe rate ${(unsubscribeRate * 100).toFixed(1)}% exceeds threshold` };
    }
    
    // Check daily limit
    if (sendSafety.emailsSentToday >= SEND_SAFETY_RULES.maxEmailsPerDay) {
      return { safe: false, reason: `Daily limit reached` };
    }
    
    return { safe: true };
    
  } catch (error) {
    console.error('Safety check error:', error);
    return { safe: false, reason: 'Safety check failed' };
  }
}

async function sendEmail(target, template, campaign) {
  // In production, use SendGrid, Postmark, or similar
  const personalizedSubject = personalizeTemplate(template.subject, target, campaign);
  const personalizedBody = personalizeTemplate(template.body, target, campaign);
  
  console.log(`Sending email to ${target.decisionMakers[0]?.email || target.email}`);
  console.log(`Subject: ${personalizedSubject}`);
  
  return {
    messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    status: 'sent',
    provider: 'SendGrid',
    sentAt: new Date().toISOString()
  };
}

function personalizeTemplate(template, target, campaign) {
  const decisionMaker = target.decisionMakers?.[0] || {};
  
  return template
    .replace(/\{\{first_name\}\}/g, decisionMaker.firstName || 'there')
    .replace(/\{\{company\}\}/g, target.company || 'your company')
    .replace(/\{\{funding_amount\}\}/g, '$5M')
    .replace(/\{\{sender_name\}\}/g, campaign.senderName || 'Sales Team')
    .replace(/\{\{booking_link\}\}/g, 'https://cal.com/your-team/10min');
}
