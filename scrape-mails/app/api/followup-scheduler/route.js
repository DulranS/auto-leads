// app/api/followup-scheduler/route.js
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../lib/supabaseClient';
import { google } from 'googleapis';
import { generateReplyForIntent } from '../../lib/ai-responder';

// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
  BATCH_SIZE: 50,
  MAX_FOLLOWUPS_PER_LEAD: 3,
  FOLLOWUP_INTERVALS: {
    hot_lead: [1, 3, 7],      // days for hot leads
    warm_lead: [3, 7, 14],     // days for warm leads
    cold_lead: [7, 14, 30],    // days for cold leads
    information_request: [2, 5, 10],
    ooo_followup: [7, 14, 21]
  }
};

// ============================================================================
// GET DUE FOLLOWUPS
// ============================================================================
const getDueFollowups = async (limit = CONFIG.BATCH_SIZE) => {
  const today = new Date().toISOString().slice(0, 10);
  
  try {
    console.log(`[Followup Scheduler] Fetching due followups for ${today}...`);
    
    const { data, error } = await supabaseAdmin
      .from('follow_up_schedule')
      .select(`
        *,
        leads!inner(
          id,
          email,
          business_name,
          status,
          auto_reply_enabled,
          user_id,
          last_contacted_at
        ),
        user_integrations!inner(
          access_token,
          refresh_token,
          email,
          provider,
          service,
          is_active
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_date', today)
      .eq('leads.auto_reply_enabled', true)
      .eq('user_integrations.provider', 'google')
      .eq('user_integrations.service', 'gmail')
      .eq('user_integrations.is_active', true)
      .limit(limit);
    
    if (error) {
      console.error('[Followup Scheduler] Database error fetching followups:', error);
      throw error;
    }
    
    console.log(`[Followup Scheduler] Found ${data?.length || 0} due followups`);
    return data || [];
  } catch (error) {
    console.error('[Followup Scheduler] Error fetching due followups:', error);
    return [];
  }
};

// ============================================================================
// GET GMAIL CLIENT
// ============================================================================
const getGmailClient = async (credentials) => {
  try {
    console.log(`[Followup Scheduler] Setting up Gmail client for ${credentials.email}`);
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    // Check if token needs refresh
    if (credentials.expires_at && new Date(credentials.expires_at) <= new Date()) {
      console.log('[Followup Scheduler] Token expired, refreshing...');
      
      oauth2Client.setCredentials({
        refresh_token: credentials.refresh_token
      });
      
      const { credentials: newCreds } = await oauth2Client.refreshAccessToken();
      
      // Update stored credentials
      await supabaseAdmin
        .from('user_integrations')
        .update({
          access_token: newCreds.access_token,
          expires_at: new Date(newCreds.expiry_date).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('email', credentials.email)
        .eq('provider', 'google')
        .eq('service', 'gmail');
      
      oauth2Client.setCredentials({
        access_token: newCreds.access_token,
        refresh_token: credentials.refresh_token
      });
    } else {
      oauth2Client.setCredentials({
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token
      });
    }
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Test the connection
    await gmail.users.getProfile({ userId: 'me' });
    console.log('[Followup Scheduler] Gmail client authenticated successfully');
    
    return gmail;
  } catch (error) {
    console.error('[Followup Scheduler] Error setting up Gmail client:', error);
    
    // Mark integration as inactive if authentication fails
    await supabaseAdmin
      .from('user_integrations')
      .update({ is_active: false })
      .eq('email', credentials.email)
      .eq('provider', 'google')
      .eq('service', 'gmail');
    
    throw new Error(`Gmail authentication failed: ${error.message}`);
  }
};

// ============================================================================
// GENERATE INTELLIGENT FOLLOWUP CONTENT
// ============================================================================
const generateFollowupContent = async (lead, followupType, followupNumber) => {
  try {
    // Get recent conversation history
    const { data: recentThreads } = await supabaseAdmin
      .from('email_threads')
      .select('subject, body, direction, sent_at')
      .eq('lead_id', lead.id)
      .order('sent_at', { ascending: false })
      .limit(3);
    
    const conversationHistory = recentThreads?.map(thread => 
      `${thread.direction.toUpperCase()}: ${thread.body.substring(0, 200)}...`
    ).join('\n\n') || '';
    
    const businessName = lead.business_name || lead.email.split('@')[0];
    const calendlyLink = process.env.CALENDLY_LINK || '';
    
    let prompt = '';
    
    if (followupType === 'hot_lead') {
      prompt = `
Generate followup email #${followupNumber} for a HOT lead who showed interest.

Business: ${businessName}
Recent conversation:
${conversationHistory}

Create a followup that:
- References previous conversation naturally
- Reinforces value proposition briefly
- Provides clear next step (call, demo, or meeting)
- Includes Calendly link: ${calendlyLink}
- Is warm but professional
- Max 150 words

Followup ${followupNumber} should be ${followupNumber === 1 ? 'gentle reminder' : followupNumber === 2 ? 'more direct' : 'final friendly nudge'}.
`;
    } else if (followupType === 'information_request') {
      prompt = `
Generate followup email #${followupNumber} for a lead who requested information.

Business: ${businessName}
Recent conversation:
${conversationHistory}

Create a followup that:
- Answers any outstanding questions
- Provides additional relevant information
- Suggests next logical step
- Is helpful and informative
- Max 180 words

Followup ${followupNumber} should be ${followupNumber === 1 ? 'helpful check-in' : followupNumber === 2 ? 'more detailed info' : 'final offer to help'}.
`;
    } else if (followupType === 'ooo_followup') {
      prompt = `
Generate followup email after lead was out of office.

Business: ${businessName}
Recent conversation:
${conversationHistory}

Create a followup that:
- Acknowledges they were away
- Briefly recaps previous discussion
- Provides clear next steps
- Is professional and concise
- Max 120 words

This is followup ${followupNumber} after their return.
`;
    } else {
      prompt = `
Generate general followup email #${followupNumber}.

Business: ${businessName}
Lead status: ${lead.status}
Recent conversation:
${conversationHistory}

Create a followup that:
- Is appropriate for ${lead.status} lead status
- Provides value or asks relevant question
- Suggests next step
- Is professional and concise
- Max 150 words

Followup ${followupNumber} should be ${followupNumber === 1 ? 'gentle check-in' : followupNumber === 2 ? 'more engaging' : 'final followup'}.
`;
    }
    
    const result = await generateReplyForIntent('needs_info', prompt, lead, 'Following up');
    return result;
    
  } catch (error) {
    console.error('[Followup Scheduler] Error generating followup content:', error);
    return null;
  }
};

// ============================================================================
// SEND FOLLOWUP EMAIL
// ============================================================================
const sendFollowupEmail = async (followup, gmail, content) => {
  try {
    console.log(`[Followup Scheduler] Preparing to send followup to ${followup.leads.email}`);
    
    // Get most recent thread with proper message ID
    const { data: thread } = await supabaseAdmin
      .from('email_threads')
      .select('gmail_thread_id, gmail_message_id')
      .eq('lead_id', followup.leads.id)
      .not('gmail_thread_id', 'is', null)
      .not('gmail_message_id', 'is', null)
      .order('sent_at', { ascending: false })
      .limit(1)
      .single();
    
    console.log(`[Followup Scheduler] Thread info:`, thread ? { threadId: thread.gmail_thread_id, messageId: thread.gmail_message_id } : 'No thread found');
    
    // Create proper MIME message with all required headers
    const boundary = 'boundary_' + Date.now();
    let mimeMessage = '';
    
    // Headers
    mimeMessage += `To: ${followup.leads.email}\r\n`;
    mimeMessage += `Subject: ${content.subject}\r\n`;
    mimeMessage += `MIME-Version: 1.0\r\n`;
    
    if (thread?.gmail_message_id) {
      mimeMessage += `In-Reply-To: ${thread.gmail_message_id}\r\n`;
      mimeMessage += `References: ${thread.gmail_message_id}\r\n`;
    }
    
    mimeMessage += `Content-Type: text/plain; charset=utf-8\r\n\r\n`;
    mimeMessage += content.body;
    
    const raw = Buffer.from(mimeMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    console.log(`[Followup Scheduler] Sending email with threadId: ${thread?.gmail_thread_id || 'new thread'}`);
    
    const requestBody = { raw };
    if (thread?.gmail_thread_id) {
      requestBody.threadId = thread.gmail_thread_id;
    }
    
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody
    });
    
    console.log(`[Followup Scheduler] Email sent successfully. Message ID: ${response.data.id}, Thread ID: ${response.data.threadId}`);
    
    return {
      id: response.data.id,
      threadId: response.data.threadId,
      labelIds: response.data.labelIds
    };
    
  } catch (error) {
    console.error('[Followup Scheduler] Error sending followup email:', error);
    throw error;
  }
};

// ============================================================================
// PROCESS SINGLE FOLLOWUP
// ============================================================================
const processFollowup = async (followup) => {
  const startTime = Date.now();
  try {
    console.log(`[Followup Scheduler] Processing followup ${followup.id} for lead ${followup.leads.id}`);
    
    // Check if we've exceeded max followups
    const { data: followupCount } = await supabaseAdmin
      .from('follow_up_schedule')
      .select('id', { count: 'exact' })
      .eq('lead_id', followup.leads.id)
      .eq('status', 'completed');
    
    if (followupCount?.length >= CONFIG.MAX_FOLLOWUPS_PER_LEAD) {
      console.log(`[Followup Scheduler] Max followups reached for lead ${followup.leads.id}`);
      await supabaseAdmin
        .from('follow_up_schedule')
        .update({ 
          status: 'cancelled',
          notes: 'Max followups reached'
        })
        .eq('id', followup.id);
      
      return { 
        success: false, 
        followupId: followup.id,
        reason: 'Max followups reached' 
      };
    }
    
    // Get Gmail client
    const gmail = await getGmailClient(followup.user_integrations);
    
    // Generate followup content
    const content = await generateFollowupContent(
      followup.leads,
      followup.followup_type,
      followup.follow_up_number
    );
    
    if (!content) {
      throw new Error('Failed to generate followup content');
    }
    
    // Send email with retry logic
    let emailResponse;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        emailResponse = await sendFollowupEmail(followup, gmail, content);
        break; // Success, exit retry loop
      } catch (sendError) {
        retryCount++;
        console.log(`[Followup Scheduler] Send attempt ${retryCount} failed:`, sendError.message);
        
        if (retryCount >= maxRetries) {
          throw sendError;
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      }
    }
    
    if (!emailResponse) {
      throw new Error('Failed to send email after retries');
    }
    
    // Log the sent email with comprehensive tracking
    const emailThreadData = {
      lead_id: followup.leads.id,
      gmail_thread_id: emailResponse.threadId,
      gmail_message_id: emailResponse.id,
      subject: content.subject,
      direction: 'sent',
      body: content.body,
      sent_at: new Date().toISOString(),
      is_followup: true,
      followup_number: followup.follow_up_number,
      processed: true, // Mark as processed immediately
      ai_reply_sent: true,
      ai_intent: followup.followup_type,
      processing_timestamp: new Date().toISOString()
    };
    
    const { error: threadError } = await supabaseAdmin
      .from('email_threads')
      .insert(emailThreadData);
    
    if (threadError) {
      console.error('[Followup Scheduler] Error logging email thread:', threadError);
      // Don't throw here, email was sent successfully
    } else {
      console.log(`[Followup Scheduler] Email logged successfully in thread ${emailResponse.threadId}`);
    }
    
    // Update followup status with comprehensive tracking
    const followupUpdateData = {
      status: 'completed',
      completed_at: new Date().toISOString(),
      gmail_message_id: emailResponse.id,
      gmail_thread_id: emailResponse.threadId,
      processing_duration_ms: Date.now() - startTime,
      retry_count: retryCount || 0
    };
    
    const { error: followupUpdateError } = await supabaseAdmin
      .from('follow_up_schedule')
      .update(followupUpdateData)
      .eq('id', followup.id);
    
    if (followupUpdateError) {
      console.error('[Followup Scheduler] Error updating followup status:', followupUpdateError);
      throw followupUpdateError;
    }
    
    console.log(`[Followup Scheduler] Followup ${followup.id} marked as completed`);
    
    // Update lead's last contacted date
    await supabaseAdmin
      .from('leads')
      .update({ 
        last_contacted_at: new Date().toISOString(),
        follow_up_count: (followup.leads.follow_up_count || 0) + 1
      })
      .eq('id', followup.leads.id);
    
    // Schedule next followup if applicable
    if (followup.follow_up_number < CONFIG.MAX_FOLLOWUPS_PER_LEAD) {
      const intervals = CONFIG.FOLLOWUP_INTERVALS[followup.followup_type] || CONFIG.FOLLOWUP_INTERVALS.warm_lead;
      const nextInterval = intervals[Math.min(followup.follow_up_number, intervals.length - 1)];
      
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + nextInterval);
      
      await supabaseAdmin.from('follow_up_schedule').insert({
        lead_id: followup.leads.id,
        scheduled_date: nextDate.toISOString().slice(0, 10),
        follow_up_number: followup.follow_up_number + 1,
        status: 'pending',
        followup_type: followup.followup_type,
        intent_context: followup.intent_context,
        created_by: 'ai_system'
      });
    }
    
    return {
      success: true,
      followupId: followup.id,
      leadId: followup.leads.id,
      messageId: emailResponse.id,
      nextFollowupScheduled: followup.follow_up_number < CONFIG.MAX_FOLLOWUPS_PER_LEAD
    };
    
  } catch (error) {
    console.error(`[Followup Scheduler] Error processing followup ${followup.id}:`, error);
    
    // Mark as failed
    await supabaseAdmin
      .from('follow_up_schedule')
      .update({ 
        status: 'failed',
        error_message: error.message,
        attempted_at: new Date().toISOString()
      })
      .eq('id', followup.id);
    
    return {
      success: false,
      followupId: followup.id,
      error: error.message
    };
  }
};

// ============================================================================
// POST HANDLER - MANUAL TRIGGER
// ============================================================================
export async function POST(request) {
  try {
    console.log('[Followup Scheduler] Starting manual processing...');
    
    const dueFollowups = await getDueFollowups();
    
    if (dueFollowups.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No due followups found',
        processed: 0
      });
    }
    
    const results = [];
    
    for (const followup of dueFollowups) {
      const result = await processFollowup(followup);
      results.push(result);
      
      // Small delay between processing
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`[Followup Scheduler] Processing complete: ${successful} success, ${failed} failed`);
    
    return NextResponse.json({
      success: true,
      message: `Processed ${dueFollowups.length} followups`,
      processed: dueFollowups.length,
      successful,
      failed,
      results
    });
    
  } catch (error) {
    console.error('[Followup Scheduler] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process followups',
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
    const today = new Date().toISOString().slice(0, 10);
    
    const { data: dueCount } = await supabaseAdmin
      .from('follow_up_schedule')
      .select('id', { count: 'exact' })
      .eq('status', 'pending')
      .lte('scheduled_date', today)
      .eq('leads.auto_reply_enabled', true);
    
    const { data: todayStats } = await supabaseAdmin
      .from('follow_up_schedule')
      .select('*', { count: 'exact' })
      .eq('status', 'completed')
      .gte('completed_at', new Date().toISOString().slice(0, 10));
    
    return NextResponse.json({
      status: 'Followup scheduler is active',
      dueFollowups: dueCount?.length || 0,
      followupsCompletedToday: todayStats?.length || 0,
      lastChecked: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Followup Scheduler] Status check error:', error);
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    );
  }
}
