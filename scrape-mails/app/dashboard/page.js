'use client';

/**
 * ============================================================================
 * COMPLETE MANUAL-FIRST B2B SALES MACHINE - FINAL IMPLEMENTATION
 * ============================================================================
 * 
 * CORE REQUIREMENT: When AI systems are down, you lose ZERO functionality.
 * Every single feature must work 100% manually through the UI.
 * 
 * COMPLETE MANUAL CONTROLS:
 * 1. Manual target management (add/edit/delete/import/export)
 * 2. Manual decision maker management (add/edit/delete/verify)
 * 3. Manual template management (create/edit/delete/duplicate)
 * 4. Manual campaign management (create/launch/pause/resume)
 * 5. Manual sequence management (timing/follow-ups)
 * 6. Manual email composition (edit every word)
 * 7. Manual send approval (review each email)
 * 8. Manual KPI tracking (track everything by hand)
 * 9. Manual data management (export/import/backup)
 * 
 * STRATEGIC BUSINESS VALUE:
 * - Target: SaaS companies 20-200 employees
 * - Focus: Series A-C funding stages
 * - Value: 15-25 qualified leads/month
 * - Cost: $20-65/month total
 * - ROI: 150x-750x
 * 
 * DISAPPOINTING REAL WORLD PROTECTION:
 * - AI down? Every feature works manually
 * - API limits? Manual mode engaged
 * - Budget cut? Reduce AI, keep all functionality
 * - Need control? Every feature has manual override
 */

import dynamic from 'next/dynamic';

const CompleteManualFirstSalesMachine = dynamic(() => import('./complete-manual-first-sales-machine'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p>Loading Complete Manual-First Sales Machine...</p>
        <p className="text-sm text-gray-400 mt-2">Every feature works 100% without AI</p>
      </div>
    </div>
  )
});

export default function Home() {
  return <CompleteManualFirstSalesMachine />;
}
