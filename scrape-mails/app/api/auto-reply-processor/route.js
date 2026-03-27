// app/api/auto-reply-processor/route.js
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../lib/supabaseClient';
import { google } from 'googleapis';
import { handleIncomingReply } from '../../lib/ai-responder';

// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
  BATCH_SIZE: 50,
  PROCESSING_INTERVAL_MINUTES: 5,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 2000,
};

// ============================================================================
// GET UNPROCESSED REPLIES
// ============================================================================
const getUnprocessedReplies = async (limit = CONFIG.BATCH_SIZE) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('email_threads')
      .select(`
        *,
        leads!inner(
          id,
          email,
          business_name,
          status,
          auto_reply_enabled,
          user_id
        ),
        user_integrations!inner(
          access_token,
          refresh_token,
          email
        )
      `)
      .eq('direction', 'received')
      .eq('processed', false)
      .eq('leads.auto_reply_enabled', true)
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[Auto Reply Processor] Error fetching unprocessed replies:', error);
    return [];
  }
};

// ============================================================================
// GET GMAIL CLIENT FOR USER
// ============================================================================
const getGmailClient = (credentials) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  
  oauth2Client.setCredentials({
    access_token: credentials.access_token,
    refresh_token: credentials.refresh_token
  });
  
  return google.gmail({ version: 'v1', auth: oauth2Client });
};

// ============================================================================
// PROCESS SINGLE REPLY
// ============================================================================
const processReply = async (thread) => {
  try {
    console.log(`[Auto Reply Processor] Processing reply for lead ${thread.leads.id}`);
    
    // Get Gmail client
    const gmail = getGmailClient(thread.user_integrations);
    
    // Get the full message from Gmail
    const message = await gmail.users.messages.get({
      userId: 'me',
      id: thread.gmail_message_id,
      format: 'full'
    });
    
    // Process with AI
    const result = await handleIncomingReply({
      lead: thread.leads,
      gmail,
      message: message.data,
      threadRow: {
        id: thread.id,
        gmail_thread_id: thread.gmail_thread_id,
        subject: thread.subject
      }
    });
    
    // Mark as processed
    await supabaseAdmin
      .from('email_threads')
      .update({ 
        processed: true,
        processed_at: new Date().toISOString(),
        ai_intent: result?.intent,
        ai_reply_sent: !!result?.aiReplyText
      })
      .eq('id', thread.id);
    
    return {
      success: true,
      threadId: thread.id,
      leadId: thread.leads.id,
      intent: result?.intent,
      aiReplySent: !!result?.aiReplyText
    };
    
  } catch (error) {
    console.error(`[Auto Reply Processor] Error processing reply ${thread.id}:`, error);
    
    // Mark as failed
    await supabaseAdmin
      .from('email_threads')
      .update({ 
        processed: true,
        processed_at: new Date().toISOString(),
        processing_error: error.message
      })
      .eq('id', thread.id);
    
    return {
      success: false,
      threadId: thread.id,
      error: error.message
    };
  }
};

// ============================================================================
// SCHEDULE INTELLIGENT FOLLOWUP
// ============================================================================
const scheduleIntelligentFollowup = async (leadId, intent, replyBody) => {
  try {
    let followupDays = 3;
    let followupType = 'general';
    
    // Determine followup strategy based on intent
    switch (intent) {
      case 'interested':
        followupDays = 1;
        followupType = 'hot_lead';
        break;
      case 'needs_info':
        followupDays = 2;
        followupType = 'information_request';
        break;
      case 'out_of_office':
        followupDays = 7;
        followupType = 'ooo_followup';
        break;
      default:
        followupDays = 3;
        followupType = 'general';
    }
    
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + followupDays);
    
    // Check if followup already exists
    const { data: existing } = await supabaseAdmin
      .from('follow_up_schedule')
      .select('id')
      .eq('lead_id', leadId)
      .eq('status', 'pending')
      .single();
    
    if (existing) {
      console.log(`[Auto Reply Processor] Followup already exists for lead ${leadId}`);
      return { scheduled: false, reason: 'Already exists' };
    }
    
    // Create new followup
    const { data, error } = await supabaseAdmin
      .from('follow_up_schedule')
      .insert({
        lead_id: leadId,
        scheduled_date: scheduledDate.toISOString().slice(0, 10),
        follow_up_number: 1,
        status: 'pending',
        followup_type: followupType,
        intent_context: intent,
        created_by: 'ai_system'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    console.log(`[Auto Reply Processor] Scheduled followup for lead ${leadId} on ${scheduledDate.toISOString().slice(0, 10)}`);
    
    return { 
      scheduled: true, 
      followupId: data.id,
      scheduledDate: scheduledDate.toISOString().slice(0, 10)
    };
    
  } catch (error) {
    console.error('[Auto Reply Processor] Error scheduling followup:', error);
    return { scheduled: false, error: error.message };
  }
};

// ============================================================================
// POST HANDLER - MANUAL TRIGGER
// ============================================================================
export async function POST(request) {
  try {
    console.log('[Auto Reply Processor] Starting manual processing...');
    
    const unprocessedReplies = await getUnprocessedReplies();
    
    if (unprocessedReplies.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unprocessed replies found',
        processed: 0
      });
    }
    
    const results = [];
    
    for (const reply of unprocessedReplies) {
      const result = await processReply(reply);
      results.push(result);
      
      // Schedule intelligent followup if AI reply was sent
      if (result.success && result.aiReplySent) {
        const followupResult = await scheduleIntelligentFollowup(
          result.leadId,
          result.intent,
          reply.body
        );
        result.followupScheduled = followupResult;
      }
      
      // Small delay between processing
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`[Auto Reply Processor] Processing complete: ${successful} success, ${failed} failed`);
    
    return NextResponse.json({
      success: true,
      message: `Processed ${unprocessedReplies.length} replies`,
      processed: unprocessedReplies.length,
      successful,
      failed,
      results
    });
    
  } catch (error) {
    console.error('[Auto Reply Processor] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process replies',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET HANDLER - STATUS CHECK
// ============================================================================
export async function GET(request) {
  try {
    const { data: unprocessedCount } = await supabaseAdmin
      .from('email_threads')
      .select('id', { count: 'exact' })
      .eq('direction', 'received')
      .eq('processed', false)
      .eq('leads.auto_reply_enabled', true);
    
    const { data: todayStats } = await supabaseAdmin
      .from('ai_responses')
      .select('*', { count: 'exact' })
      .gte('sent_at', new Date().toISOString().slice(0, 10));
    
    return NextResponse.json({
      status: 'Auto-reply processor is active',
      unprocessedReplies: unprocessedCount?.length || 0,
      aiRepliesToday: todayStats?.length || 0,
      lastChecked: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Auto Reply Processor] Status check error:', error);
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    );
  }
}
