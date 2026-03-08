'use client';

/**
 * ============================================================================
 * FINAL OPTIMAL B2B SALES MACHINE - BEST OF BOTH WORLDS
 * ============================================================================
 * 
 * COMBINES:
 * Complete Manual-First Controls (from complete-manual-first-sales-machine.js)
 * Strategic AI Enhancement (from ai-enhanced-sales-machine.js)
 * Your Actual Business Pitch & Templates (from your file)
 * Advanced Contact Management & Status Tracking
 * Multi-Channel Outreach (Email, WhatsApp, SMS, Calls)
 * AI-Powered Research & Personalization
 * Follow-Up Automation with Smart Logic
 * Real-Time Analytics & Business Intelligence
 * 
 * TIGHT ICP DEFINITION:
 * - Industry: SaaS companies 20-200 employees
 * - Size: Series A-C funding stages ($2M-$50M raised)
 * - Geo: North America & Europe primarily
 * - Pain: Scaling customer acquisition without burning cash
 * - Trigger: Recent funding round, product launch, or hiring growth
 * 
 * STRATEGIC WORKFLOW:
 * 1. Pick 50 qualified target companies (small batch = manageable testing)
 * 2. 2-minute research per company (headline + one recent trigger link)
 * 3. Find 1-2 decision makers per account (name, role, LinkedIn URL)
 * 4. Verify each email (format + MX/basic deliverability)
 * 5. Create 2 personalization bullets (1 observation, 1 impact)
 * 6. Use 3 controlled templates only (<120 words each)
 * 7. Launch with controlled cadence (Day0, Day3, Day5, Day7)
 * 8. Auto-exit rules (replied/booked → remove; bounced → pause)
 * 9. Weekly KPI monitoring with auto-pause triggers
 * 10. Move non-responders to nurture sequence (30-60 days)
 * 
 * AI USAGE: Optional enhancement for speed and scale, never required
 * MANUAL OVERRIDE: Every feature works 100% without AI
 * 
 * MINIMAL TECH STACK:
 * - LinkedIn: Target research and decision maker finding
 * - Apollo.io: Contact enrichment and verification
 * - Calendly: Meeting scheduling
 * - HubSpot: CRM and sequence management
 * - WhatsApp: Multi-channel follow-up
 */

import dynamic from 'next/dynamic';

const StrategicSalesAutomation = dynamic(() => import('./strategic-sales-automation'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <h1 className="text-white text-3xl font-bold mb-2">Syndicate Solutions</h1>
        <p className="text-gray-300 text-lg">Strategic Sales Automation Platform</p>
        <p className="text-gray-500 text-sm mt-2">Loading production algorithms...</p>
      </div>
    </div>
  )
});

export default function Home() {
  return <StrategicSalesAutomation />;
}
