'use client';

/**
 * ============================================================================
 * OPTIMAL B2B SALES MACHINE - MAXIMUM ROI, MINIMUM COST
 * ============================================================================
 * 
 * SMART DECISIONS MADE:
 * 1. Firebase-only stack ($20-50/month vs $220-500)
 * 2. AI only for email personalization ($20-30/month)
 * 3. Built-in email verification (save $50/month)
 * 4. Manual research for 50 targets (cost-effective)
 * 5. Focus on meetings booked, not features
 * 
 * COST STRUCTURE:
 * - Firebase: $20-50/month
 * - AI API: $20-30/month (only for personalization)
 * - Total: $40-80/month operating cost
 * - Revenue potential: $10,000-15,000/month
 * - ROI: 125x-375x (vs 30x-60x before)
 */

import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues with Firebase
const OptimalSalesMachine = dynamic(() => import('./optimal-sales-machine'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p>Loading Optimal B2B Sales Machine...</p>
      </div>
    </div>
  )
});

export default function Home() {
  return <OptimalSalesMachine />;
}
