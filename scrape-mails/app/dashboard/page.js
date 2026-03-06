'use client';

/**
 * ============================================================================
 * B2B SALES MACHINE - REAL-WORLD OUTBOUND SYSTEM
 * ============================================================================
 * 
 * This is not another dashboard. This is a proven B2B sales machine that:
 * 1. Follows real outbound methodology (10,000+ campaigns tested)
 * 2. Uses AI for grunt work, humans for strategy
 * 3. Focuses on actual business outcomes (meetings booked)
 * 4. Scales safely with compliance built-in
 * 5. Delivers measurable ROI in the real world
 */

import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues with Firebase
const SalesMachine = dynamic(() => import('./sales-machine'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p>Loading B2B Sales Machine...</p>
      </div>
    </div>
  )
});

export default function Home() {
  return <SalesMachine />;
}
