// ENTERPRISE MARKETING AUTOMATION SYSTEM
// Business-Oriented Architecture for Maximum ROI
// Built for Syndicate Solutions - White-Label Delivery Partner

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';

// ENTERPRISE CONFIGURATION - Strategic Business Intelligence
const ENTERPRISE_CONFIG = {
  // BUSINESS INTELLIGENCE
  company: {
    name: 'Syndicate Solutions',
    valueProp: 'Reliable white-label delivery partner for agencies',
    website: 'https://syndicatesolutions.vercel.app/',
    calendly: 'https://cal.com/syndicate-solutions/15min',
    contact: { email: 'syndicatesoftwaresolutions@gmail.com', phone: '0741143323' }
  },
  
  // STRATEGIC ICP DEFINITION - Laser-Focused Targeting
  icp: {
    industries: ['Digital Agency', 'SaaS Company', 'E-commerce', 'Tech Startup'],
    size: { min: 5, max: 50, stage: 'Growth Phase' },
    geography: ['USA', 'Canada', 'UK', 'Australia'],
    funding: 'Bootstrapped to Series A',
    painPoints: [
      'Overwhelmed with client delivery',
      'Need to scale without hiring',
      'Missing technical expertise',
      'Slow development cycles'
    ],
    triggers: [
      'Recent hiring posts',
      'Product launches',
      'Funding announcements',
      'Customer growth spikes'
    ]
  },
  
  // CAMPAIGN STRATEGY - Business-Optimized
  campaign: {
    maxTargets: 50, // Focused testing batch
    dailySendLimit: 30, // Conservative for deliverability
    warmupDays: 7, // Gradual ramp-up
    touchpoints: [
      { day: 0, channel: 'email', template: 'introduction' },
      { day: 2, channel: 'linkedin', template: 'connection' },
      { day: 4, channel: 'email', template: 'socialProof' },
      { day: 7, channel: 'email', template: 'breakup' }
    ],
    safety: {
      maxBounceRate: 3, // Conservative threshold
      maxUnsubscribeRate: 0.5, // Strict compliance
      sendDelay: 2000, // 2 seconds between sends
      cooldownHours: 24 // Rest period between campaigns
    }
  }
};

// CONTROLLED TEMPLATES - Business-Optimized for Maximum Conversion
const BUSINESS_TEMPLATES = {
  introduction: {
    name: 'Strategic Introduction',
    subject: 'Quick question about {{company_name}} scaling',
    body: `Hi {{first_name}},

I noticed {{company_name}} is {{recent_activity}} - congratulations on the growth!

I'm Dulran from Syndicate Solutions. We help agencies like yours scale delivery capacity without the overhead of full-time hires.

Our white-label services include:
• Web & mobile development
• AI automation implementation  
• Ongoing technical support
• Fast turnaround times

Most clients start with a small project to test our reliability before scaling.

Could you use extra development capacity right now?

Best regards,
Dulran Samarasinghe
Founder, Syndicate Solutions
📅 15-min call: https://cal.com/syndicate-solutions/15min
💬 WhatsApp: 0741143323`,
    wordCount: 89,
    conversion: 'high',
    personalization: ['recent_activity', 'company_name', 'first_name']
  },
  
  socialProof: {
    name: 'Social Proof & Value',
    subject: 'Re: {{company_name}} scaling success',
    body: `Hi {{first_name}},

Just following up - did my note about scaling your delivery capacity land at a good time?

We recently helped {{similar_company}} increase their project throughput by 40% using our white-label development team.

They started with a $500 test project and now work with us monthly for ongoing development support.

Even a small 10-hour project can show you how we work.

Would you be open to a quick chat about your current development challenges?

Best,
Dulran
📅 https://cal.com/syndicate-solutions/15min`,
    wordCount: 78,
    conversion: 'medium',
    personalization: ['similar_company', 'first_name']
  },
  
  breakup: {
    name: 'Professional Break-up',
    subject: 'Closing the loop - {{company_name}}',
    body: `Hi {{first_name}},

I'll stop emailing after this - promise! 😊

If scaling development capacity becomes a priority, we're here to help.

Many of our best clients started small and grew with us as their needs expanded.

Either way, wishing you continued success with {{company_name}}!

Best regards,
Dulran Samarasinghe
Syndicate Solutions`,
    wordCount: 52,
    conversion: 'low',
    personalization: ['company_name', 'first_name']
  }
};

// LEAD QUALIFICATION ENGINE - Advanced Business Intelligence
class LeadQualificationEngine {
  constructor() {
    this.scoringWeights = {
      industry: 25,      // Industry match is critical
      companySize: 20,  // Right size for our service
      emailQuality: 20, // Deliverability is essential
      website: 15,      // Professional presence
      socialPresence: 10, // Active business
      recentActivity: 10 // Timely opportunity
    };
  }
  
  qualifyLead(lead) {
    let score = 0;
    let factors = {};
    let disqualifiers = [];
    
    // Industry match (25 points)
    if (lead.industry) {
      const industryMatch = ENTERPRISE_CONFIG.icp.industries.some(ind => 
        lead.industry.toLowerCase().includes(ind.toLowerCase())
      );
      factors.industry = industryMatch ? 25 : 0;
      score += factors.industry;
      if (!industryMatch) disqualifiers.push('Industry not in target list');
    } else {
      disqualifiers.push('Industry not specified');
    }
    
    // Company size (20 points)
    const size = parseInt(lead.employees || lead.company_size || 0);
    if (size >= ENTERPRISE_CONFIG.icp.size.min && size <= ENTERPRISE_CONFIG.icp.size.max) {
      factors.companySize = 20;
      score += factors.companySize;
    } else {
      disqualifiers.push(`Company size ${size} not in ${ENTERPRISE_CONFIG.icp.size.min}-${ENTERPRISE_CONFIG.icp.size.max} range`);
    }
    
    // Email quality (20 points)
    if (this.isValidEmail(lead.email)) {
      factors.emailQuality = 20;
      score += factors.emailQuality;
    } else {
      disqualifiers.push('Invalid email format');
    }
    
    // Website presence (15 points)
    if (lead.website && lead.website.startsWith('http')) {
      factors.website = 15;
      score += factors.website;
    }
    
    // Social presence (10 points)
    if (lead.linkedin || lead.twitter) {
      factors.socialPresence = 10;
      score += factors.socialPresence;
    }
    
    // Recent activity (10 points)
    if (lead.recent_activity || lead.trigger_event) {
      factors.recentActivity = 10;
      score += factors.recentActivity;
    }
    
    const qualification = {
      score,
      maxScore: 100,
      qualified: score >= 60,
      tier: this.getTier(score),
      factors,
      disqualifiers,
      priority: this.getPriority(score),
      estimatedValue: this.estimateValue(score)
    };
    
    return qualification;
  }
  
  getTier(score) {
    if (score >= 85) return { name: 'A-Tier', description: 'Priority Target', color: 'green' };
    if (score >= 70) return { name: 'B-Tier', description: 'Qualified Lead', color: 'blue' };
    if (score >= 50) return { name: 'C-Tier', description: 'Nurture Campaign', color: 'yellow' };
    return { name: 'D-Tier', description: 'Disqualify', color: 'red' };
  }
  
  getPriority(score) {
    if (score >= 85) return 'HIGH';
    if (score >= 70) return 'MEDIUM';
    if (score >= 50) return 'LOW';
    return 'REJECT';
  }
  
  estimateValue(score) {
    if (score >= 85) return '$5,000+';
    if (score >= 70) return '$2,000-$5,000';
    if (score >= 50) return '$500-$2,000';
    return '< $500';
  }
  
  isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }
}

// CAMPAIGN AUTOMATION ENGINE - Robust Business Logic with Safety & Duplicate Prevention
class CampaignAutomationEngine {
  constructor() {
    this.state = {
      status: 'idle', // idle, warming, active, paused, completed, failed
      phase: 'setup', // setup, research, outreach, followup, completed
      dailyStats: {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        replied: 0,
        bounced: 0,
        unsubscribed: 0,
        meetings: 0
      },
      totalStats: { ...this.dailyStats },
      safety: {
        lastSendTime: null,
        consecutiveBounces: 0,
        lastBounceTime: null,
        dailyBounceCount: 0
      },
      performance: {
        replyRate: 0,
        meetingRate: 0,
        bounceRate: 0,
        roi: 0
      }
    };
    this.queue = [];
    this.history = [];
    this.rules = ENTERPRISE_CONFIG.campaign.safety;
    
    // 🛡️ DUPLICATE PREVENTION & CONTACT TRACKING
    this.sentEmails = new Set(); // Track email addresses already sent
    this.contactHistory = new Map(); // Track full contact history {email: {sentDate, templates, status, contacted}}
    this.suppressionList = new Set(); // Global suppression list for bounced/unsubscribed
    this.contactedEmails = new Set(); // Track manually contacted emails
  }
  
  canSend() {
    // Comprehensive safety checks
    const checks = [];
    
    // Campaign status check
    if (this.state.status === 'paused') {
      checks.push({ passed: false, reason: 'Campaign manually paused' });
    } else if (this.state.status === 'failed') {
      checks.push({ passed: false, reason: 'Campaign failed - needs reset' });
    } else {
      checks.push({ passed: true, reason: 'Campaign status OK' });
    }
    
    // Daily limit check
    if (this.state.dailyStats.sent >= ENTERPRISE_CONFIG.campaign.dailySendLimit) {
      checks.push({ passed: false, reason: `Daily limit reached (${this.state.dailyStats.sent}/${ENTERPRISE_CONFIG.campaign.dailySendLimit})` });
    } else {
      checks.push({ passed: true, reason: `Daily capacity available (${ENTERPRISE_CONFIG.campaign.dailySendLimit - this.state.dailyStats.sent} remaining)` });
    }
    
    // Bounce rate check
    if (this.state.dailyStats.sent > 5) {
      const bounceRate = (this.state.dailyStats.bounced / this.state.dailyStats.sent) * 100;
      if (bounceRate > this.rules.maxBounceRate) {
        checks.push({ passed: false, reason: `Bounce rate too high (${bounceRate.toFixed(1)}% > ${this.rules.maxBounceRate}%)` });
      } else {
        checks.push({ passed: true, reason: `Bounce rate acceptable (${bounceRate.toFixed(1)}%)` });
      }
    } else {
      checks.push({ passed: true, reason: 'Insufficient data for bounce rate check' });
    }
    
    // Unsubscribe rate check
    if (this.state.dailyStats.sent > 10) {
      const unsubscribeRate = (this.state.dailyStats.unsubscribed / this.state.dailyStats.sent) * 100;
      if (unsubscribeRate > this.rules.maxUnsubscribeRate) {
        checks.push({ passed: false, reason: `Unsubscribe rate too high (${unsubscribeRate.toFixed(1)}% > ${this.rules.maxUnsubscribeRate}%)` });
      } else {
        checks.push({ passed: true, reason: `Unsubscribe rate acceptable (${unsubscribeRate.toFixed(1)}%)` });
      }
    } else {
      checks.push({ passed: true, reason: 'Insufficient data for unsubscribe rate check' });
    }
    
    // Send delay check
    if (this.state.safety.lastSendTime) {
      const timeSinceLastSend = Date.now() - this.state.safety.lastSendTime;
      if (timeSinceLastSend < this.rules.sendDelay) {
        checks.push({ passed: false, reason: `Send delay not met (${timeSinceLastSend}ms < ${this.rules.sendDelay}ms)` });
      } else {
        checks.push({ passed: true, reason: `Send delay satisfied (${timeSinceLastSend}ms)` });
      }
    } else {
      checks.push({ passed: true, reason: 'No previous send - delay not required' });
    }
    
    // Consecutive bounce check
    if (this.state.safety.consecutiveBounces >= 3) {
      checks.push({ passed: false, reason: `Too many consecutive bounces (${this.state.safety.consecutiveBounces})` });
    } else {
      checks.push({ passed: true, reason: `Consecutive bounces acceptable (${this.state.safety.consecutiveBounces})` });
    }
    
    const allPassed = checks.every(check => check.passed);
    const failedChecks = checks.filter(check => !check.passed);
    
    return {
      allowed: allPassed,
      reason: allPassed ? 'All safety checks passed' : failedChecks.map(c => c.reason).join('; '),
      checks
    };
  }
  
  // 🛡️ INTELLIGENT DUPLICATE PREVENTION
  hasEmailBeenSent(email) {
    return this.sentEmails.has(email.toLowerCase());
  }
  
  isEmailSuppressed(email) {
    return this.suppressionList.has(email.toLowerCase());
  }
  
  isContacted(email) {
    return this.contactedEmails.has(email.toLowerCase());
  }
  
  canSendEmail(email, templateKey = null) {
    const normalizedEmail = email.toLowerCase();
    
    // Check if email was already sent
    if (this.hasEmailBeenSent(normalizedEmail)) {
      return { canSend: false, reason: `Email already sent to ${email}`, duplicate: true };
    }
    
    // Check if email is in suppression list
    if (this.isEmailSuppressed(normalizedEmail)) {
      return { canSend: false, reason: `Email ${email} is in suppression list`, suppressed: true };
    }
    
    // Check if this specific template was already sent to this contact
    if (templateKey && this.contactHistory.has(normalizedEmail)) {
      const history = this.contactHistory.get(normalizedEmail);
      if (history.templates && history.templates.includes(templateKey)) {
        return { canSend: false, reason: `Template ${templateKey} already sent to ${email}`, templateDuplicate: true };
      }
    }
    
    // Apply standard safety rules
    const standardCheck = this.canSend();
    return { 
      canSend: standardCheck.allowed, 
      reason: standardCheck.reason,
      duplicate: false,
      suppressed: false,
      templateDuplicate: false
    };
  }
  
  // 📞 CONTACT MANAGEMENT
  markAsContacted(email, contactMethod = 'manual', notes = '') {
    const normalizedEmail = email.toLowerCase();
    this.contactedEmails.add(normalizedEmail);
    
    // Update contact history
    if (!this.contactHistory.has(normalizedEmail)) {
      this.contactHistory.set(normalizedEmail, {
        sentDate: null,
        templates: [],
        status: 'contacted',
        contacted: true,
        contactMethod: contactMethod,
        contactDate: new Date(),
        notes: notes
      });
    } else {
      const history = this.contactHistory.get(normalizedEmail);
      history.contacted = true;
      history.contactMethod = contactMethod;
      history.contactDate = new Date();
      history.notes = notes;
    }
    
    console.log(`📞 Marked ${email} as contacted via ${contactMethod}`);
  }
  
  unmarkAsContacted(email) {
    const normalizedEmail = email.toLowerCase();
    this.contactedEmails.delete(normalizedEmail);
    
    if (this.contactHistory.has(normalizedEmail)) {
      const history = this.contactHistory.get(normalizedEmail);
      history.contacted = false;
      history.contactMethod = null;
      history.contactDate = null;
    }
    
    console.log(`🔄 Unmarked ${email} as contacted`);
  }
  
  getContactStatus(email) {
    const normalizedEmail = email.toLowerCase();
    return {
      sent: this.hasEmailBeenSent(normalizedEmail),
      contacted: this.isContacted(normalizedEmail),
      suppressed: this.isEmailSuppressed(normalizedEmail),
      history: this.contactHistory.get(normalizedEmail) || null
    };
  }
  
  // 🚫 SUPPRESSION LIST MANAGEMENT
  addToSuppressionList(email, reason = 'bounce') {
    const normalizedEmail = email.toLowerCase();
    this.suppressionList.add(normalizedEmail);
    console.log(`🚫 Added ${email} to suppression list: ${reason}`);
  }
  
  removeFromSuppressionList(email) {
    const normalizedEmail = email.toLowerCase();
    this.suppressionList.delete(normalizedEmail);
    console.log(`✅ Removed ${email} from suppression list`);
  }
  
  async executeCampaign(targets, templates) {
    console.log('🚀 Starting enterprise campaign execution...');
    
    try {
      this.state.status = 'active';
      this.state.phase = 'outreach';
      
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        const templateKey = i === 0 ? 'introduction' : 'socialProof';
        
        // 🛡️ INTELLIGENT DUPLICATE PREVENTION CHECK
        const emailCheck = this.canSendEmail(target.email, templateKey);
        if (!emailCheck.canSend) {
          console.log(`⚠️ Email not sent to ${target.email}: ${emailCheck.reason}`);
          continue; // Skip this target and continue with others
        }
        
        // Check safety before each send
        const safetyCheck = this.canSend();
        if (!safetyCheck.allowed) {
          console.log('⚠️ Campaign paused for safety:', safetyCheck.reason);
          this.state.status = 'paused';
          break;
        }
        
        try {
          await this.sendEmail(target, templates, templateKey);
          this.state.safety.lastSendTime = Date.now();
          
          // Simulate delivery tracking
          setTimeout(() => this.trackDelivery(target), 1000 + Math.random() * 2000);
          
        } catch (error) {
          console.error('❌ Send failed for', target.email, error);
          this.recordBounce(target);
        }
        
        // Progress logging
        if ((i + 1) % 5 === 0) {
          console.log(`📊 Campaign progress: ${i + 1}/${targets.length} emails sent`);
        }
      }
      
      this.state.status = 'completed';
      this.calculatePerformance();
      console.log('✅ Campaign execution completed');
      
    } catch (error) {
      console.error('💥 Campaign execution failed:', error);
      this.state.status = 'failed';
    }
  }
  
  async sendEmail(target, templates, templateKey) {
    // Simulate email sending with business logic
    const template = templates[templateKey];
    
    console.log(`📧 Sending ${template.name} to: ${target.email}`);
    
    // 🛡️ TRACK EMAIL AS SENT (DUPLICATE PREVENTION)
    const normalizedEmail = target.email.toLowerCase();
    this.sentEmails.add(normalizedEmail);
    
    // Update contact history
    if (!this.contactHistory.has(normalizedEmail)) {
      this.contactHistory.set(normalizedEmail, {
        sentDate: new Date(),
        templates: [templateKey],
        status: 'sent',
        contacted: false,
        contactMethod: null,
        contactDate: null,
        notes: ''
      });
    } else {
      const history = this.contactHistory.get(normalizedEmail);
      history.sentDate = new Date();
      history.templates = [...(history.templates || []), templateKey];
      history.status = 'sent';
    }
    
    // Update stats
    this.state.dailyStats.sent++;
    this.state.totalStats.sent++;
    this.state.safety.lastSendTime = Date.now();
    
    // Simulate personalization
    const personalizedSubject = this.personalizeTemplate(template.subject, target);
    const personalizedBody = this.personalizeTemplate(template.body, target);
    
    // Log for debugging
    console.log(`📝 Subject: ${personalizedSubject}`);
    console.log(`📝 Body preview: ${personalizedBody.substring(0, 100)}...`);
    
    return {
      success: true,
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      template: templateKey,
      personalization: {
        subject: personalizedSubject,
        body: personalizedBody
      },
      duplicatePrevention: {
        emailTracked: true,
        templateTracked: true,
        contactHistoryUpdated: true
      }
    };
  }
  
  personalizeTemplate(template, target) {
    let personalized = template;
    
    // Replace template variables
    personalized = personalized.replace(/\{\{company_name\}\}/g, target.company_name || target.company || 'your company');
    personalized = personalized.replace(/\{\{first_name\}\}/g, target.first_name || (target.name ? target.name.split(' ')[0] : 'there'));
    personalized = personalized.replace(/\{\{recent_activity\}\}/g, target.recent_activity || 'growing rapidly');
    personalized = personalized.replace(/\{\{similar_company\}\}/g, 'a similar agency in your space');
    
    return personalized;
  }
  
  trackDelivery(target) {
    // Simulate delivery tracking
    this.state.dailyStats.delivered++;
    this.state.totalStats.delivered++;
    
    // Simulate open (60% rate)
    if (Math.random() < 0.6) {
      setTimeout(() => this.trackOpen(target), 5000 + Math.random() * 10000);
    }
    
    // Simulate click (20% of opens)
    if (Math.random() < 0.2) {
      setTimeout(() => this.trackClick(target), 8000 + Math.random() * 5000);
    }
  }
  
  trackOpen(target) {
    this.state.dailyStats.opened++;
    this.state.totalStats.opened++;
    console.log(`👁️ Email opened by: ${target.email}`);
    
    // Simulate reply (15% of opens)
    if (Math.random() < 0.15) {
      setTimeout(() => this.trackReply(target), 3000 + Math.random() * 7000);
    }
  }
  
  trackClick(target) {
    this.state.dailyStats.clicked++;
    this.state.totalStats.clicked++;
    console.log(`🖱️ Link clicked by: ${target.email}`);
  }
  
  trackReply(target) {
    this.state.dailyStats.replied++;
    this.state.totalStats.replied++;
    console.log(`💬 Reply received from: ${target.email}`);
    
    // Simulate meeting booking (30% of replies)
    if (Math.random() < 0.3) {
      setTimeout(() => this.trackMeeting(target), 2000 + Math.random() * 3000);
    }
  }
  
  trackMeeting(target) {
    this.state.dailyStats.meetings++;
    this.state.totalStats.meetings++;
    console.log(`📅 Meeting booked with: ${target.email}`);
  }
  
  recordBounce(target) {
    this.state.dailyStats.bounced++;
    this.state.totalStats.bounced++;
    this.state.safety.consecutiveBounces++;
    this.state.safety.dailyBounceCount++;
    this.state.safety.lastBounceTime = Date.now();
    console.log(`🚫 Bounce recorded for: ${target.email}`);
    
    // Auto-pause if too many bounces
    if (this.state.safety.consecutiveBounces >= 3) {
      this.state.status = 'paused';
      console.log('⚠️ Campaign auto-paused due to consecutive bounces');
    }
  }
  
  calculatePerformance() {
    const stats = this.state.totalStats;
    
    this.state.performance.replyRate = stats.delivered > 0 ? 
      (stats.replied / stats.delivered * 100).toFixed(1) : 0;
    this.state.performance.meetingRate = stats.delivered > 0 ? 
      (stats.meetings / stats.delivered * 100).toFixed(1) : 0;
    this.state.performance.bounceRate = stats.sent > 0 ? 
      (stats.bounced / stats.sent * 100).toFixed(1) : 0;
    
    // Calculate ROI
    const costPerEmail = 0.10; // $0.10 per email
    const valuePerReply = 500; // $500 estimated value per reply
    const valuePerMeeting = 2000; // $2000 estimated value per meeting
    
    const totalCost = stats.sent * costPerEmail;
    const totalValue = (stats.replied * valuePerReply) + (stats.meetings * valuePerMeeting);
    
    this.state.performance.roi = totalCost > 0 ? 
      ((totalValue - totalCost) / totalCost * 100).toFixed(1) : 0;
  }
  
  getMetrics() {
    this.calculatePerformance();
    return {
      ...this.state,
      safetyCheck: this.canSend(),
      recommendations: this.generateRecommendations()
    };
  }
  
  generateRecommendations() {
    const recommendations = [];
    const perf = this.state.performance;
    
    if (parseFloat(perf.replyRate) < 10) {
      recommendations.push({
        type: 'optimization',
        title: 'Low Reply Rate',
        message: `Reply rate of ${perf.replyRate}% is below target of 10%`,
        action: 'Consider improving subject lines or personalization'
      });
    }
    
    if (parseFloat(perf.bounceRate) > 5) {
      recommendations.push({
        type: 'critical',
        title: 'High Bounce Rate',
        message: `Bounce rate of ${perf.bounceRate}% exceeds safe threshold`,
        action: 'Clean email list and verify deliverability'
      });
    }
    
    if (parseFloat(perf.roi) > 300) {
      recommendations.push({
        type: 'scaling',
        title: 'Excellent ROI',
        message: `ROI of ${perf.roi}% indicates strong performance`,
        action: 'Consider scaling campaign to more leads'
      });
    }
    
    return recommendations;
  }
  
  resetDailyStats() {
    this.state.dailyStats = {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      replied: 0,
      bounced: 0,
      unsubscribed: 0,
      meetings: 0
    };
    this.state.safety.dailyBounceCount = 0;
  }
}

// BUSINESS INTELLIGENCE ENGINE - Advanced Analytics & Insights
class BusinessIntelligenceEngine {
  constructor() {
    this.metrics = {
      campaign: {},
      leads: {},
      revenue: {},
      performance: {}
    };
    this.insights = [];
    this.trends = [];
    this.predictions = {};
  }
  
  generateInsights(campaignData, leadData) {
    this.insights = [];
    
    // Performance insights
    const replyRate = parseFloat(campaignData.performance?.replyRate || 0);
    const meetingRate = parseFloat(campaignData.performance?.meetingRate || 0);
    const bounceRate = parseFloat(campaignData.performance?.bounceRate || 0);
    const roi = parseFloat(campaignData.performance?.roi || 0);
    
    // Reply rate analysis
    if (replyRate >= 15) {
      this.insights.push({
        type: 'success',
        title: 'Exceptional Reply Rate',
        message: `${replyRate}% reply rate exceeds industry average of 8-12%`,
        impact: 'high',
        action: 'Scale campaign to more qualified leads',
        confidence: 95
      });
    } else if (replyRate < 5) {
      this.insights.push({
        type: 'critical',
        title: 'Critical: Low Reply Rate',
        message: `${replyRate}% reply rate is below minimum threshold`,
        impact: 'critical',
        action: 'Pause campaign and review templates/personalization',
        confidence: 90
      });
    }
    
    // Meeting rate analysis
    if (meetingRate >= 5) {
      this.insights.push({
        type: 'success',
        title: 'Strong Meeting Conversion',
        message: `${meetingRate}% meeting rate shows strong interest`,
        impact: 'high',
        action: 'Focus follow-up on high-engagement leads',
        confidence: 85
      });
    }
    
    // Bounce rate analysis
    if (bounceRate > 5) {
      this.insights.push({
        type: 'critical',
        title: 'Deliverability Risk',
        message: `${bounceRate}% bounce rate damages sender reputation`,
        impact: 'critical',
        action: 'Immediately clean email list and verify deliverability',
        confidence: 95
      });
    }
    
    // ROI analysis
    if (roi > 500) {
      this.insights.push({
        type: 'success',
        title: 'Outstanding ROI',
        message: `${roi}% return on investment exceeds targets`,
        impact: 'high',
        action: 'Increase campaign budget and expand targeting',
        confidence: 90
      });
    } else if (roi < 100) {
      this.insights.push({
        type: 'warning',
        title: 'ROI Below Target',
        message: `${roi}% ROI needs optimization`,
        impact: 'medium',
        action: 'Review lead quality and conversion funnel',
        confidence: 80
      });
    }
    
    // Lead quality analysis
    if (leadData && leadData.length > 0) {
      const avgScore = leadData.reduce((sum, lead) => sum + (lead.qualification?.score || 0), 0) / leadData.length;
      
      if (avgScore >= 75) {
        this.insights.push({
          type: 'success',
          title: 'High-Quality Lead List',
          message: `Average lead score of ${avgScore.toFixed(1)} indicates strong targeting`,
          impact: 'medium',
          action: 'Continue with current ICP parameters',
          confidence: 85
        });
      } else if (avgScore < 50) {
        this.insights.push({
          type: 'warning',
          title: 'Lead Quality Concern',
          message: `Average lead score of ${avgScore.toFixed(1)} suggests poor targeting`,
          impact: 'medium',
        action: 'Refine ICP definition and lead sources',
          confidence: 80
        });
      }
    }
    
    return this.insights;
  }
  
  generatePredictions(campaignData) {
    const stats = campaignData.totalStats || {};
    const perf = campaignData.performance || {};
    
    // Predict future performance
    const predictedReplyRate = this.calculatePredictedRate(stats.replied, stats.delivered);
    const predictedMeetingRate = this.calculatePredictedRate(stats.meetings, stats.delivered);
    const predictedROI = parseFloat(perf.roi || 0);
    
    // Predict monthly revenue
    const monthlyEmails = ENTERPRISE_CONFIG.campaign.dailySendLimit * 22; // Business days
    const predictedMonthlyReplies = monthlyEmails * (predictedReplyRate / 100);
    const predictedMonthlyMeetings = predictedMonthlyReplies * 0.3; // 30% of replies become meetings
    const predictedMonthlyRevenue = (predictedMonthlyMeetings * 2000) + (predictedMonthlyReplies * 500);
    
    this.predictions = {
      replyRate: predictedReplyRate,
      meetingRate: predictedMeetingRate,
      monthlyRevenue: predictedMonthlyRevenue,
      monthlyROI: predictedROI,
      confidence: this.calculateConfidence(stats.sent)
    };
    
    return this.predictions;
  }
  
  calculatePredictedRate(successes, total) {
    if (total < 10) return 0; // Insufficient data
    return (successes / total * 100);
  }
  
  calculateConfidence(sampleSize) {
    if (sampleSize < 20) return 50;
    if (sampleSize < 50) return 70;
    if (sampleSize < 100) return 85;
    return 95;
  }
  
  getBusinessValue() {
    return {
      totalLeads: this.metrics.leads.total || 0,
      qualifiedLeads: this.metrics.leads.qualified || 0,
      totalRevenue: this.metrics.revenue.total || 0,
      averageDealSize: this.metrics.revenue.average || 0,
      campaignROI: this.metrics.performance.roi || 0,
      efficiency: this.calculateEfficiency()
    };
  }
  
  calculateEfficiency() {
    const cost = this.metrics.campaign.cost || 0;
    const revenue = this.metrics.revenue.total || 0;
    return cost > 0 ? (revenue / cost * 100).toFixed(1) : 0;
  }
}

// MAIN ENTERPRISE MARKETING AUTOMATION COMPONENT
export default function EnterpriseMarketingAutomation() {
  const [user, setUser] = useState(null);
  const [targets, setTargets] = useState([]);
  const [campaign, setCampaign] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState([]);
  const [predictions, setPredictions] = useState({});
  
  // 📞 CONTACT MANAGEMENT STATE
  const [contactedEmails, setContactedEmails] = useState(new Set());
  const [contactNotes, setContactNotes] = useState({});
  
  // Initialize engines with proper business logic
  const qualificationEngine = useRef(new LeadQualificationEngine()).current;
  const campaignEngine = useRef(new CampaignAutomationEngine()).current;
  const biEngine = useRef(new BusinessIntelligenceEngine()).current;
  
  // CSV Import with Advanced Business Intelligence
  const handleCsvImport = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setLoading(true);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const csv = e.target.result;
        const lines = csv.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
        
        const qualifiedLeads = [];
        let disqualifiedCount = 0;
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          const lead = {};
          
          headers.forEach((header, index) => {
            lead[header] = values[index] || '';
          });
          
          // Advanced lead qualification
          const qualification = qualificationEngine.qualifyLead(lead);
          
          if (qualification.qualified) {
            qualifiedLeads.push({
              ...lead,
              qualification,
              status: 'new',
              addedAt: new Date(),
              campaignHistory: [],
              personalization: {
                observation: '',
                impact: ''
              }
            });
          } else {
            disqualifiedCount++;
          }
        }
        
        // Apply strategic batch size limit
        const batchLeads = qualifiedLeads.slice(0, ENTERPRISE_CONFIG.campaign.maxTargets);
        setTargets(batchLeads);
        
        // Generate initial insights
        const initialInsights = biEngine.generateInsights(
          campaignEngine.getMetrics(), 
          batchLeads
        );
        setInsights(initialInsights);
        
        // Generate predictions
        const predictions = biEngine.generatePredictions(campaignEngine.getMetrics());
        setPredictions(predictions);
        
        setLoading(false);
        
        alert(`✅ Import Complete:\n${batchLeads.length} qualified leads (ICP match ≥60%)\n${disqualifiedCount} disqualified leads\n\nStrategic batch size: ${ENTERPRISE_CONFIG.campaign.maxTargets} targets`);
        
      } catch (error) {
        console.error('Import error:', error);
        setLoading(false);
        alert('❌ Import failed: ' + error.message);
      }
    };
    
    reader.readAsText(file);
  }, [qualificationEngine, campaignEngine, biEngine]);
  
  // 📞 CONTACT MANAGEMENT FUNCTIONS
  const markAsContacted = useCallback((email, method = 'manual', notes = '') => {
    const normalizedEmail = email.toLowerCase();
    
    // Update local state
    setContactedEmails(prev => new Set([...prev, normalizedEmail]));
    setContactNotes(prev => ({
      ...prev,
      [normalizedEmail]: { method, notes, date: new Date().toISOString() }
    }));
    
    // Update campaign engine
    campaignEngine.markAsContacted(normalizedEmail, method, notes);
    
    console.log(`📞 Marked ${email} as contacted via ${method}`);
  }, [campaignEngine]);
  
  const unmarkAsContacted = useCallback((email) => {
    const normalizedEmail = email.toLowerCase();
    
    // Update local state
    setContactedEmails(prev => {
      const newSet = new Set(prev);
      newSet.delete(normalizedEmail);
      return newSet;
    });
    setContactNotes(prev => {
      const newNotes = { ...prev };
      delete newNotes[normalizedEmail];
      return newNotes;
    });
    
    // Update campaign engine
    campaignEngine.unmarkAsContacted(normalizedEmail);
    
    console.log(`🔄 Unmarked ${email} as contacted`);
  }, [campaignEngine]);
  
  const getContactStatus = useCallback((email) => {
    const normalizedEmail = email.toLowerCase();
    return {
      contacted: contactedEmails.has(normalizedEmail),
      notes: contactNotes[normalizedEmail] || null,
      campaignStatus: campaignEngine.getContactStatus(normalizedEmail)
    };
  }, [contactedEmails, contactNotes, campaignEngine]);
  
  // 📋 SMART TARGET SORTING - Contacted at bottom
  const getSortedTargets = useCallback(() => {
    if (!targets.length) return [];
    
    return [...targets].sort((a, b) => {
      const aContacted = getContactStatus(a.email).contacted;
      const bContacted = getContactStatus(b.email).contacted;
      
      // Non-contacted contacts first
      if (aContacted && !bContacted) return 1;
      if (!aContacted && bContacted) return -1;
      
      // Then by qualification score (highest first)
      const aScore = a.qualification?.score || 0;
      const bScore = b.qualification?.score || 0;
      return bScore - aScore;
    });
  }, [targets, getContactStatus]);
  
  // Manual Campaign Execution with Business Intelligence
  const executeManualCampaign = useCallback(async () => {
    if (targets.length === 0) {
      alert('⚠️ No qualified targets available. Please import leads first.');
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('🚀 Starting enterprise campaign execution...');
      
      await campaignEngine.executeCampaign(targets, BUSINESS_TEMPLATES);
      
      const metrics = campaignEngine.getMetrics();
      setCampaign(metrics);
      
      // Generate comprehensive business insights
      const campaignInsights = biEngine.generateInsights(metrics, targets);
      setInsights(campaignInsights);
      
      // Generate business predictions
      const businessPredictions = biEngine.generatePredictions(metrics);
      setPredictions(businessPredictions);
      
      setLoading(false);
      
      // Show comprehensive results
      alert(`🎯 Campaign Execution Complete!\n\n📊 Results:\n• Sent: ${metrics.totalStats.sent}\n• Replies: ${metrics.totalStats.replied}\n• Meetings: ${metrics.totalStats.meetings}\n• Reply Rate: ${metrics.performance.replyRate}%\n• ROI: ${metrics.performance.roi}%\n\n💡 ${campaignInsights.length} insights generated`);
      
    } catch (error) {
      console.error('Campaign execution error:', error);
      setLoading(false);
      alert('❌ Campaign execution failed: ' + error.message);
    }
  }, [targets, campaignEngine, biEngine]);
  
  // Real-time metrics update
  useEffect(() => {
    const interval = setInterval(() => {
      if (campaign) {
        const updatedMetrics = campaignEngine.getMetrics();
        setCampaign(updatedMetrics);
        
        // Update insights if campaign is active
        if (updatedMetrics.state.status === 'active') {
          const updatedInsights = biEngine.generateInsights(updatedMetrics, targets);
          setInsights(updatedInsights);
        }
      }
    }, 5000); // Update every 5 seconds for real-time feedback
    
    return () => clearInterval(interval);
  }, [campaign, campaignEngine, biEngine, targets]);
  
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Head>
        <title>Enterprise Marketing Automation | Syndicate Solutions</title>
        <meta name="description" content="Strategic B2B lead generation and nurturing automation system" />
      </Head>
      
      {/* Professional Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                🚀 Enterprise Marketing Automation
              </h1>
              <p className="text-gray-400 text-sm">Strategic B2B Lead Generation & Nurturing System</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-gray-400">System Status</p>
                <p className={`text-sm font-bold ${
                  campaign?.state?.status === 'active' ? 'text-green-400' :
                  campaign?.state?.status === 'paused' ? 'text-yellow-400' :
                  campaign?.state?.status === 'failed' ? 'text-red-400' :
                  'text-gray-400'
                }`}>
                  {campaign?.state?.status ? campaign.state.status.toUpperCase() : 'IDLE'}
                </p>
              </div>
              <button
                onClick={executeManualCampaign}
                disabled={loading || targets.length === 0}
                className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-600 disabled:to-gray-700 px-6 py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50"
              >
                {loading ? '⏳ Executing...' : '▶️ Execute Campaign'}
              </button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Strategic Navigation */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-6 overflow-x-auto">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: '📊' },
              { id: 'leads', label: 'Lead Intelligence', icon: '🎯' },
              { id: 'campaign', label: 'Campaign Control', icon: '⚙️' },
              { id: 'analytics', label: 'Business Analytics', icon: '📈' },
              { id: 'insights', label: 'AI Insights', icon: '🤖' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 px-4 border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-400 bg-blue-900/20'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Business Intelligence Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Lead Pipeline */}
              <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border border-blue-700/50 p-6 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">🎯 Lead Pipeline</h3>
                  <span className="text-blue-400 text-2xl font-bold">{targets.length}</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Qualified</span>
                    <span className="text-green-400 font-medium">
                      {targets.filter(t => t.qualification?.qualified).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Avg Score</span>
                    <span className="text-blue-400 font-medium">
                      {targets.length > 0 ? 
                        Math.round(targets.reduce((sum, t) => sum + (t.qualification?.score || 0), 0) / targets.length) : 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">A-Tier</span>
                    <span className="text-purple-400 font-medium">
                      {targets.filter(t => t.qualification?.tier?.name?.includes('A')).length}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Campaign Performance */}
              <div className="bg-gradient-to-br from-green-900/50 to-green-800/30 border border-green-700/50 p-6 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">📈 Performance</h3>
                  <span className={`text-2xl font-bold ${
                    campaign?.state?.status === 'active' ? 'text-green-400' :
                    campaign?.state?.status === 'completed' ? 'text-blue-400' :
                    'text-gray-400'
                  }`}>
                    {campaign?.performance?.replyRate || 0}%
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Reply Rate</span>
                    <span className="text-green-400 font-medium">{campaign?.performance?.replyRate || 0}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Meetings</span>
                    <span className="text-blue-400 font-medium">{campaign?.totalStats?.meetings || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">ROI</span>
                    <span className="text-purple-400 font-medium">{campaign?.performance?.roi || 0}%</span>
                  </div>
                </div>
              </div>
              
              {/* Business Value */}
              <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border border-purple-700/50 p-6 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">💰 Business Value</h3>
                  <span className="text-purple-400 text-2xl font-bold">
                    ${((campaign?.totalStats?.meetings || 0) * 2000 + (campaign?.totalStats?.replied || 0) * 500).toLocaleString()}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Revenue</span>
                    <span className="text-green-400 font-medium">
                      ${((campaign?.totalStats?.meetings || 0) * 2000).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Pipeline</span>
                    <span className="text-blue-400 font-medium">
                      ${((campaign?.totalStats?.replied || 0) * 500).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Cost</span>
                    <span className="text-gray-400 font-medium">
                      ${((campaign?.totalStats?.sent || 0) * 0.10).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* System Health */}
              <div className="bg-gradient-to-br from-yellow-900/50 to-yellow-800/30 border border-yellow-700/50 p-6 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">🛡️ System Health</h3>
                  <span className={`text-2xl font-bold ${
                    campaign?.safetyCheck?.allowed ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {campaign?.safetyCheck?.allowed ? '✅' : '⚠️'}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Bounce Rate</span>
                    <span className={`font-medium ${
                      parseFloat(campaign?.performance?.bounceRate || 0) > 3 ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {campaign?.performance?.bounceRate || 0}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Daily Sent</span>
                    <span className="text-blue-400 font-medium">
                      {campaign?.dailyStats?.sent || 0}/{ENTERPRISE_CONFIG.campaign.dailySendLimit}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Status</span>
                    <span className={`font-medium capitalize ${
                      campaign?.state?.status === 'active' ? 'text-green-400' :
                      campaign?.state?.status === 'paused' ? 'text-yellow-400' :
                      campaign?.state?.status === 'failed' ? 'text-red-400' :
                      'text-gray-400'
                    }`}>
                      {campaign?.state?.status || 'idle'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <h2 className="text-xl font-semibold mb-6">⚡ Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="block">
                  <span className="text-gray-300 text-sm font-medium block mb-2">📥 Import Lead CSV</span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvImport}
                    disabled={loading}
                    className="block w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 disabled:opacity-50"
                  />
                  <p className="text-gray-500 text-xs mt-1">Format: company_name, first_name, email, industry, employees, website</p>
                </label>
                
                <div className="flex flex-col justify-center">
                  <button
                    onClick={executeManualCampaign}
                    disabled={loading || targets.length === 0}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 px-6 py-3 rounded-lg font-medium transition-all duration-200 disabled:opacity-50"
                  >
                    {loading ? '⏳ Executing Campaign...' : '🚀 Execute Campaign'}
                  </button>
                  <p className="text-gray-500 text-xs mt-2 text-center">
                    {targets.length} qualified leads ready
                  </p>
                </div>
                
                <div className="flex flex-col justify-center space-y-2">
                  <button className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg font-medium transition-colors">
                    📊 Export Report
                  </button>
                  <button className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg font-medium transition-colors">
                    ⚙️ System Settings
                  </button>
                </div>
              </div>
            </div>
            
            {/* AI Insights Preview */}
            {insights.length > 0 && (
              <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                <h2 className="text-xl font-semibold mb-6">🤖 AI Business Insights</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {insights.slice(0, 4).map((insight, index) => (
                    <div key={index} className={`p-4 rounded-lg border-l-4 ${
                      insight.type === 'success' ? 'bg-green-900/20 border-green-600' :
                      insight.type === 'critical' ? 'bg-red-900/20 border-red-600' :
                      insight.type === 'warning' ? 'bg-yellow-900/20 border-yellow-600' :
                      'bg-blue-900/20 border-blue-600'
                    }`}>
                      <div className="flex items-start justify-between mb-2">
                        <h4 className={`font-semibold ${
                          insight.type === 'success' ? 'text-green-300' :
                          insight.type === 'critical' ? 'text-red-300' :
                          insight.type === 'warning' ? 'text-yellow-300' :
                          'text-blue-300'
                        }`}>
                          {insight.title}
                        </h4>
                        <span className="text-xs text-gray-400">{insight.confidence}% confidence</span>
                      </div>
                      <p className="text-gray-300 text-sm mb-2">{insight.message}</p>
                      <p className="text-gray-400 text-xs">💡 {insight.action}</p>
                    </div>
                  ))}
                </div>
                {insights.length > 4 && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => setActiveTab('insights')}
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      View all {insights.length} insights →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'leads' && (
          <div className="space-y-6">
            {/* Lead Intelligence Header */}
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">🎯 Lead Intelligence Hub</h2>
                <div className="flex gap-4 text-sm">
                  <div className="text-center">
                    <p className="text-gray-400">Total Leads</p>
                    <p className="text-2xl font-bold text-blue-400">{targets.length}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400">Qualified</p>
                    <p className="text-2xl font-bold text-green-400">
                      {targets.filter(t => t.qualification?.qualified).length}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400">Avg Score</p>
                    <p className="text-2xl font-bold text-purple-400">
                      {targets.length > 0 ? 
                        Math.round(targets.reduce((sum, t) => sum + (t.qualification?.score || 0), 0) / targets.length) : 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Lead Table */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-900/50">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">Company</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">Contact</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">Industry</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">Score</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">Tier</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">Value</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">Status</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {getSortedTargets().map((lead, index) => {
                      const contactStatus = getContactStatus(lead.email);
                      const alreadySent = campaignEngine.hasEmailBeenSent(lead.email);
                      const isSuppressed = campaignEngine.isEmailSuppressed(lead.email);
                      
                      return (
                        <tr key={index} className={`hover:bg-gray-700/50 transition-colors ${
                          contactStatus.contacted ? 'opacity-75' : ''
                        }`}>
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-white">{lead.company_name || lead.company || 'Unknown'}</p>
                              <p className="text-xs text-gray-400">{lead.employees || lead.company_size || 'Unknown'} employees</p>
                              
                              {/* 🛡️ DUPLICATE PREVENTION INDICATORS */}
                              <div className="flex flex-wrap gap-1 mt-1">
                                {alreadySent && (
                                  <span className="px-2 py-1 bg-purple-900/50 text-purple-300 rounded text-xs">
                                    📧 Sent
                                  </span>
                                )}
                                {isSuppressed && (
                                  <span className="px-2 py-1 bg-red-900/50 text-red-300 rounded text-xs">
                                    🚫 Blocked
                                  </span>
                                )}
                                {contactStatus.contacted && (
                                  <span className="px-2 py-1 bg-orange-900/50 text-orange-300 rounded text-xs">
                                    📞 Contacted
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div>
                              <p className="text-white">{lead.first_name} {lead.last_name || ''}</p>
                              <p className="text-xs text-blue-400">{lead.email}</p>
                              {lead.website && (
                                <p className="text-xs text-gray-400 truncate max-w-[150px]">{lead.website}</p>
                              )}
                              
                              {/* 📞 CONTACT NOTES DISPLAY */}
                              {contactStatus.notes && (
                                <div className="mt-1 p-1 bg-gray-800 rounded text-xs">
                                  <p className="text-blue-300">📞 {contactStatus.notes.method}</p>
                                  <p className="text-gray-400 truncate">{contactStatus.notes.notes}</p>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-gray-300">{lead.industry || 'Unknown'}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">{lead.qualification?.score || 0}</span>
                              <div className="w-16 bg-gray-700 rounded-full h-2">
                                <div 
                                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                                  style={{ width: `${lead.qualification?.score || 0}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              lead.qualification?.tier?.name?.includes('A') ? 'bg-green-900/50 text-green-300 border border-green-700' :
                              lead.qualification?.tier?.name?.includes('B') ? 'bg-blue-900/50 text-blue-300 border border-blue-700' :
                              lead.qualification?.tier?.name?.includes('C') ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-700' :
                              'bg-red-900/50 text-red-300 border border-red-700'
                            }`}>
                              {lead.qualification?.tier?.name || 'Unknown'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm font-medium text-green-400">
                              {lead.qualification?.estimatedValue || '< $500'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded text-xs ${
                              lead.status === 'new' ? 'bg-gray-700 text-gray-300' :
                              lead.status === 'contacted' ? 'bg-blue-700 text-blue-300' :
                              lead.status === 'replied' ? 'bg-green-700 text-green-300' :
                              'bg-gray-700 text-gray-300'
                            }`}>
                              {lead.status || 'new'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-2">
                              {/* 📞 CONTACT MANAGEMENT CONTROLS */}
                              <div className="flex gap-1">
                                {!contactStatus.contacted ? (
                                  <button
                                    onClick={() => markAsContacted(lead.email, 'manual', 'Manually marked as contacted from leads table')}
                                    className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs transition-colors"
                                    title="Mark as contacted"
                                  >
                                    📞 Contact
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => unmarkAsContacted(lead.email)}
                                    className="bg-gray-600 hover:bg-gray-700 px-2 py-1 rounded text-xs transition-colors"
                                    title="Unmark as contacted"
                                  >
                                    ↩️ Undo
                                  </button>
                                )}
                                
                                <button className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-xs transition-colors">
                                  Details
                                </button>
                              </div>
                              
                              {/* 📧 EMAIL STATUS */}
                              {alreadySent && (
                                <p className="text-xs text-purple-400">Email already sent</p>
                              )}
                              {isSuppressed && (
                                <p className="text-xs text-red-400">Email suppressed</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {targets.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">📥</div>
                  <h3 className="text-lg font-medium text-gray-300 mb-2">No Leads Imported Yet</h3>
                  <p className="text-gray-500 text-sm mb-4">Import a CSV file to get started with lead qualification</p>
                  <button
                    onClick={() => document.querySelector('input[type="file"]').click()}
                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    Import CSV File
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        
        {activeTab === 'campaign' && (
          <div className="space-y-6">
            {/* Campaign Control Center */}
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <h2 className="text-xl font-semibold mb-6">⚙️ Campaign Control Center</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Target Configuration */}
                <div className="bg-gray-900/50 p-4 rounded-lg">
                  <h3 className="font-medium mb-4 text-blue-400">🎯 Target Configuration</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Max Targets</span>
                      <span className="text-white font-medium">{ENTERPRISE_CONFIG.campaign.maxTargets}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Daily Send Limit</span>
                      <span className="text-white font-medium">{ENTERPRISE_CONFIG.campaign.dailySendLimit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Warmup Period</span>
                      <span className="text-white font-medium">{ENTERPRISE_CONFIG.campaign.warmupDays} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Current Batch</span>
                      <span className="text-green-400 font-medium">{targets.length} leads</span>
                    </div>
                  </div>
                </div>
                
                {/* Safety Rules */}
                <div className="bg-gray-900/50 p-4 rounded-lg">
                  <h3 className="font-medium mb-4 text-green-400">🛡️ Safety Rules</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Max Bounce Rate</span>
                      <span className="text-white font-medium">{ENTERPRISE_CONFIG.campaign.safety.maxBounceRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Max Unsubscribe Rate</span>
                      <span className="text-white font-medium">{ENTERPRISE_CONFIG.campaign.safety.maxUnsubscribeRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Send Delay</span>
                      <span className="text-white font-medium">{ENTERPRISE_CONFIG.campaign.safety.sendDelay}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Cooldown Period</span>
                      <span className="text-white font-medium">{ENTERPRISE_CONFIG.campaign.safety.cooldownHours}h</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Campaign Status */}
              {campaign && (
                <div className="mt-6 bg-gray-900/50 p-4 rounded-lg">
                  <h3 className="font-medium mb-4 text-purple-400">📊 Campaign Status</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400 block">Status</span>
                      <span className={`font-medium capitalize ${
                        campaign.state.status === 'active' ? 'text-green-400' :
                        campaign.state.status === 'paused' ? 'text-yellow-400' :
                        campaign.state.status === 'completed' ? 'text-blue-400' :
                        campaign.state.status === 'failed' ? 'text-red-400' :
                        'text-gray-400'
                      }`}>
                        {campaign.state.status}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Phase</span>
                      <span className="text-white font-medium capitalize">{campaign.state.phase}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Progress</span>
                      <span className="text-white font-medium">
                        {campaign.dailyStats.sent}/{targets.length} sent
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Safety</span>
                      <span className={`font-medium ${
                        campaign.safetyCheck.allowed ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {campaign.safetyCheck.allowed ? '✅ OK' : '⚠️ Risk'}
                      </span>
                    </div>
                  </div>
                  
                  {!campaign.safetyCheck.allowed && (
                    <div className="mt-4 p-3 bg-red-900/20 border border-red-700 rounded-lg">
                      <p className="text-red-300 text-sm font-medium">⚠️ Safety Check Failed</p>
                      <p className="text-red-400 text-xs mt-1">{campaign.safetyCheck.reason}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Email Templates */}
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <h2 className="text-xl font-semibold mb-6">📧 Business-Optimized Templates</h2>
              <div className="space-y-4">
                {Object.entries(BUSINESS_TEMPLATES).map(([key, template]) => (
                  <div key={key} className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-medium text-white">{template.name}</h3>
                        <p className="text-sm text-gray-400">{template.subject}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-gray-400">{template.wordCount} words</span>
                        <span className={`ml-2 px-2 py-1 rounded text-xs ${
                          template.conversion === 'high' ? 'bg-green-900/50 text-green-300' :
                          template.conversion === 'medium' ? 'bg-blue-900/50 text-blue-300' :
                          'bg-gray-700 text-gray-300'
                        }`}>
                          {template.conversion} conversion
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-300 text-sm mb-3">{template.body.substring(0, 200)}...</p>
                    <div className="flex gap-2">
                      <span className="text-xs bg-gray-700 px-2 py-1 rounded">Personalization: {template.personalization?.join(', ')}</span>
                      <span className="text-xs bg-gray-700 px-2 py-1 rounded">Booking link included</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* 📱 MOBILE-RESPONSIVE MULTI-CHANNEL OUTREACH */}
            <div className="bg-gray-800 p-4 md:p-6 rounded-xl border border-gray-700">
              <h2 className="text-xl font-semibold mb-4 md:mb-6">📤 Multi-Channel Outreach</h2>
              
              {/* Cadence Display - Mobile Responsive */}
              <div className="mb-6 md:mb-8">
                <h3 className="text-white font-medium mb-3 md:mb-4 text-base md:text-lg">📋 Multi-Touch Cadence</h3>
                <div className="space-y-2 md:space-y-3">
                  {ENTERPRISE_CONFIG.campaign.touchpoints.map((step, index) => (
                    <div key={index} className="bg-gray-900 rounded-lg p-3 md:p-4 border border-gray-700">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white font-bold text-sm md:text-base">Day {step.day}</span>
                            <span className="px-2 py-1 bg-blue-900/50 text-blue-300 rounded text-xs md:text-sm">
                              {step.channel}
                            </span>
                          </div>
                          <p className="text-gray-400 text-xs md:text-sm">{step.template} template</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Safety Rules - Mobile Responsive Grid */}
              <div className="mb-6 md:mb-8">
                <h3 className="text-white font-medium mb-3 md:mb-4 text-base md:text-lg">🛡️ Safety Rules</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                  <div className="bg-gray-700 p-3 md:p-4 rounded-lg border border-gray-600">
                    <p className="text-gray-400 text-xs md:text-sm mb-1">Max emails/day:</p>
                    <p className="text-white font-bold text-lg md:text-xl">{ENTERPRISE_CONFIG.campaign.dailySendLimit}</p>
                  </div>
                  <div className="bg-gray-700 p-3 md:p-4 rounded-lg border border-gray-600">
                    <p className="text-gray-400 text-xs md:text-sm mb-1">Pause on bounce rate:</p>
                    <p className="text-white font-bold text-lg md:text-xl">{ENTERPRISE_CONFIG.campaign.safety.maxBounceRate}%</p>
                  </div>
                  <div className="bg-gray-700 p-3 md:p-4 rounded-lg border border-gray-600">
                    <p className="text-gray-400 text-xs md:text-sm mb-1">Pause on unsubscribe:</p>
                    <p className="text-white font-bold text-lg md:text-xl">{ENTERPRISE_CONFIG.campaign.safety.maxUnsubscribeRate}%</p>
                  </div>
                  <div className="bg-gray-700 p-3 md:p-4 rounded-lg border border-gray-600">
                    <p className="text-gray-400 text-xs md:text-sm mb-1">Send delay:</p>
                    <p className="text-white font-bold text-lg md:text-xl">{ENTERPRISE_CONFIG.campaign.safety.sendDelay}ms</p>
                  </div>
                </div>
              </div>
              
              {/* Queue Management - Mobile Responsive */}
              <div>
                <h3 className="text-white font-medium mb-3 md:mb-4 text-base md:text-lg">📤 Email Queue</h3>
                <div className="space-y-3 md:space-y-4">
                  {getSortedTargets().slice(0, 10).map(target => {
                    const contactStatus = getContactStatus(target.email);
                    const alreadySent = campaignEngine.hasEmailBeenSent(target.email);
                    const isSuppressed = campaignEngine.isEmailSuppressed(target.email);
                    
                    return (
                      <div key={target.email} className="bg-gray-900 rounded-lg p-4 md:p-5 border border-gray-700">
                        {/* Contact Info - Mobile Responsive */}
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-white font-medium text-sm md:text-base mb-1 truncate">
                              {target.company_name || target.company || 'Unknown'}
                            </h4>
                            <p className="text-gray-400 text-xs md:text-sm truncate">{target.email}</p>
                            
                            {/* Status Indicators */}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {alreadySent && (
                                <span className="px-2 py-1 bg-purple-900/50 text-purple-300 rounded text-xs">
                                  📧 Sent
                                </span>
                              )}
                              {isSuppressed && (
                                <span className="px-2 py-1 bg-red-900/50 text-red-300 rounded text-xs">
                                  🚫 Blocked
                                </span>
                              )}
                              {contactStatus.contacted && (
                                <span className="px-2 py-1 bg-orange-900/50 text-orange-300 rounded text-xs">
                                  📞 Contacted
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              Score: {target.qualification?.score || 0}
                            </span>
                          </div>
                        </div>
                        
                        {/* Email Send Buttons - Mobile Responsive */}
                        <div className="space-y-2">
                          {/* Primary Email */}
                          <button
                            onClick={() => {
                              const emailCheck = campaignEngine.canSendEmail(target.email, 'introduction');
                              if (!emailCheck.canSend) {
                                alert(`⚠️ Cannot send: ${emailCheck.reason}`);
                                return;
                              }
                              // Send email logic would go here
                              console.log('📧 Sending introduction email to:', target.email);
                            }}
                            disabled={alreadySent || isSuppressed}
                            className={`w-full sm:w-auto px-4 py-2 md:px-5 md:py-2.5 rounded-lg text-sm font-medium transition-all ${
                              alreadySent || isSuppressed
                                ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95'
                            }`}
                          >
                            {alreadySent ? '📧 Already Sent' :
                             isSuppressed ? '🚫 Blocked' :
                             '📧 Send Introduction'}
                          </button>
                          
                          {/* Secondary Actions - Horizontal on Desktop, Vertical on Mobile */}
                          <div className="flex flex-col sm:flex-row gap-2">
                            <button
                              onClick={() => {
                                const emailCheck = campaignEngine.canSendEmail(target.email, 'socialProof');
                                if (!emailCheck.canSend) {
                                  alert(`⚠️ Cannot send: ${emailCheck.reason}`);
                                  return;
                                }
                                console.log('📧 Sending social proof email to:', target.email);
                              }}
                              disabled={alreadySent || isSuppressed}
                              className={`w-full sm:w-auto px-4 py-2 md:px-4 md:py-2 rounded-lg text-sm font-medium transition-all ${
                                alreadySent || isSuppressed
                                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                                  : 'bg-purple-600 hover:bg-purple-700 text-white active:scale-95'
                              }`}
                            >
                              {alreadySent ? '📧 Already Sent' :
                               isSuppressed ? '🚫 Blocked' :
                               '📧 Social Proof'}
                            </button>
                            
                            <button
                              onClick={() => {
                                const emailCheck = campaignEngine.canSendEmail(target.email, 'breakup');
                                if (!emailCheck.canSend) {
                                  alert(`⚠️ Cannot send: ${emailCheck.reason}`);
                                  return;
                                }
                                console.log('🚪 Sending breakup email to:', target.email);
                              }}
                              disabled={alreadySent || isSuppressed}
                              className={`w-full sm:w-auto px-4 py-2 md:px-4 md:py-2 rounded-lg text-sm font-medium transition-all ${
                                alreadySent || isSuppressed
                                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                                  : 'bg-red-600 hover:bg-red-700 text-white active:scale-95'
                              }`}
                            >
                              {alreadySent ? '📧 Already Sent' :
                               isSuppressed ? '🚫 Blocked' :
                               '🚪 Breakup Email'}
                            </button>
                          </div>
                        </div>
                        
                        {/* Contact Management - Mobile Responsive */}
                        <div className="mt-4 pt-4 border-t border-gray-700">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-2">
                              {!contactStatus.contacted ? (
                                <button
                                  onClick={() => markAsContacted(target.email, 'manual', 'Manually marked as contacted from outreach queue')}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-all active:scale-95"
                                >
                                  📞 Mark Contacted
                                </button>
                              ) : (
                                <button
                                  onClick={() => unmarkAsContacted(target.email)}
                                  className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-xs font-medium transition-all active:scale-95"
                                >
                                  ↩️ Undo Contact
                                </button>
                              )}
                            </div>
                            
                            <div className="text-xs text-gray-500">
                              {alreadySent ? 'Email already sent' : 'Ready to send'}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Empty State */}
                {targets.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-4xl md:text-5xl mb-4">📥</div>
                    <h3 className="text-lg font-medium text-gray-300 mb-2">No Targets in Queue</h3>
                    <p className="text-gray-500 text-sm">Import CSV files to add targets to the send queue</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Business Analytics Dashboard */}
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <h2 className="text-xl font-semibold mb-6">📈 Business Analytics Dashboard</h2>
              
              {campaign ? (
                <div className="space-y-6">
                  {/* Performance Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-900/50 p-4 rounded-lg">
                      <p className="text-gray-400 text-sm mb-1">Total Sent</p>
                      <p className="text-2xl font-bold text-white">{campaign.totalStats.sent}</p>
                      <p className="text-xs text-gray-500 mt-1">Emails delivered</p>
                    </div>
                    <div className="bg-gray-900/50 p-4 rounded-lg">
                      <p className="text-gray-400 text-sm mb-1">Replies</p>
                      <p className="text-2xl font-bold text-green-400">{campaign.totalStats.replied}</p>
                      <p className="text-xs text-gray-500 mt-1">{campaign.performance.replyRate}% reply rate</p>
                    </div>
                    <div className="bg-gray-900/50 p-4 rounded-lg">
                      <p className="text-gray-400 text-sm mb-1">Meetings</p>
                      <p className="text-2xl font-bold text-blue-400">{campaign.totalStats.meetings}</p>
                      <p className="text-xs text-gray-500 mt-1">{campaign.performance.meetingRate}% meeting rate</p>
                    </div>
                    <div className="bg-gray-900/50 p-4 rounded-lg">
                      <p className="text-gray-400 text-sm mb-1">ROI</p>
                      <p className="text-2xl font-bold text-purple-400">{campaign.performance.roi}%</p>
                      <p className="text-xs text-gray-500 mt-1">Return on investment</p>
                    </div>
                  </div>
                  
                  {/* Revenue Analysis */}
                  <div className="bg-gray-900/50 p-4 rounded-lg">
                    <h3 className="font-medium mb-4 text-green-400">💰 Revenue Analysis</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-gray-400 text-sm">Direct Revenue</p>
                        <p className="text-xl font-bold text-green-400">
                          ${(campaign.totalStats.meetings * 2000).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">From meetings booked</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm">Pipeline Value</p>
                        <p className="text-xl font-bold text-blue-400">
                          ${(campaign.totalStats.replied * 500).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">From replies received</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm">Total Cost</p>
                        <p className="text-xl font-bold text-gray-400">
                          ${(campaign.totalStats.sent * 0.10).toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">Email delivery cost</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Predictions */}
                  {predictions && Object.keys(predictions).length > 0 && (
                    <div className="bg-gray-900/50 p-4 rounded-lg">
                      <h3 className="font-medium mb-4 text-purple-400">🔮 Business Predictions</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-gray-400 text-sm">Predicted Monthly Revenue</p>
                          <p className="text-xl font-bold text-purple-400">
                            ${predictions.monthlyRevenue?.toLocaleString() || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500">Based on current performance</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-sm">Prediction Confidence</p>
                          <p className="text-xl font-bold text-blue-400">
                            {predictions.confidence || 0}%
                          </p>
                          <p className="text-xs text-gray-500">Based on sample size</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">📊</div>
                  <h3 className="text-lg font-medium text-gray-300 mb-2">No Campaign Data Available</h3>
                  <p className="text-gray-500 text-sm">Execute a campaign to see analytics</p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {activeTab === 'insights' && (
          <div className="space-y-6">
            {/* AI Business Insights */}
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <h2 className="text-xl font-semibold mb-6">🤖 AI Business Intelligence</h2>
              
              {insights.length > 0 ? (
                <div className="space-y-4">
                  {insights.map((insight, index) => (
                    <div key={index} className={`p-4 rounded-lg border-l-4 ${
                      insight.type === 'success' ? 'bg-green-900/20 border-green-600' :
                      insight.type === 'critical' ? 'bg-red-900/20 border-red-600' :
                      insight.type === 'warning' ? 'bg-yellow-900/20 border-yellow-600' :
                      'bg-blue-900/20 border-blue-600'
                    }`}>
                      <div className="flex items-start justify-between mb-2">
                        <h4 className={`font-semibold text-lg ${
                          insight.type === 'success' ? 'text-green-300' :
                          insight.type === 'critical' ? 'text-red-300' :
                          insight.type === 'warning' ? 'text-yellow-300' :
                          'text-blue-300'
                        }`}>
                          {insight.title}
                        </h4>
                        <div className="text-right">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            insight.impact === 'critical' ? 'bg-red-900/50 text-red-300' :
                            insight.impact === 'high' ? 'bg-orange-900/50 text-orange-300' :
                            insight.impact === 'medium' ? 'bg-yellow-900/50 text-yellow-300' :
                            'bg-gray-700 text-gray-300'
                          }`}>
                            {insight.impact?.toUpperCase() || 'MEDIUM'} IMPACT
                          </span>
                          <p className="text-xs text-gray-400 mt-1">{insight.confidence}% confidence</p>
                        </div>
                      </div>
                      <p className="text-gray-300 mb-3">{insight.message}</p>
                      <div className="bg-gray-900/50 p-3 rounded-lg">
                        <p className="text-sm font-medium text-blue-300 mb-1">🎯 Recommended Action:</p>
                        <p className="text-gray-400 text-sm">{insight.action}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">🤖</div>
                  <h3 className="text-lg font-medium text-gray-300 mb-2">No Insights Available</h3>
                  <p className="text-gray-500 text-sm">Execute a campaign to generate AI insights</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
