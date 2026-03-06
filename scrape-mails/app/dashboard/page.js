'use client';

/**
 * ============================================================================
 * MANUAL-FIRST B2B SALES MACHINE - THE DEFINITIVE IMPLEMENTATION
 * ============================================================================
 * 
 * ARCHITECTURE PHILOSOPHY:
 * - Manual control is absolute, AI is optional assistance
 * - When AI systems fail, you lose ZERO functionality
 * - Every feature works 100% without AI intervention
 * - AI enhances speed, manual control ensures reliability
 * 
 * STRATEGIC BUSINESS VALUE:
 * - Tight ICP targeting (SaaS 20-200 employees)
 * - Manual research input (no AI dependency)
 * - Manual personalization (full creative control)
 * - Manual email composition (edit every word)
 * - Individual send approval (review each email)
 * - Manual KPI tracking (no automation needed)
 * 
 * COST EFFECTIVENESS:
 * - Firebase: $20-40/month (data + auth)
 * - Resend Email: Free tier (3,000 emails/month)
 * - Claude AI: $0-25/month (optional enhancement)
 * - Total: $20-65/month (scales with AI usage)
 * - ROI: 150x-750x (depending on AI usage)
 * 
 * DISAPPOINTING REAL WORLD PROTECTION:
 * - AI down? System works 100%
 * - API rate limits? Manual mode engaged
 * - Budget cut? Reduce AI, keep functionality
 * - Need control? Every feature has manual override
 */

import dynamic from 'next/dynamic';

const ManualFirstSalesMachine = dynamic(() => import('./manual-first-sales-machine'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p>Loading Manual-First Sales Machine...</p>
        <p className="text-sm text-gray-400 mt-2">AI is optional, you control everything</p>
      </div>
    </div>
  )
});

export default function Home() {
  return <ManualFirstSalesMachine />;
}
