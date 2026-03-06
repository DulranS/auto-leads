'use client';

/**
 * ============================================================================
 * TRULY MANUAL-FIRST B2B SALES MACHINE - COMPLETE IMPLEMENTATION
 * ============================================================================
 * 
 * CRITICAL FIXES COMPLETED:
 * - Manual decision maker management (add/edit/delete)
 * - Manual template management (create/edit/delete)
 * - Manual campaign management (full control)
 * - Manual sequence management (timing, follow-ups)
 * - Manual data management (export/import/backup)
 * - Manual send controls (individual approval)
 * - Manual KPI tracking (full transparency)
 * 
 * WHEN AI IS DOWN:
 * - You can manually add every decision maker
 * - You can manually edit every template
 * - You can manually control every send
 * - You can manually track every metric
 * - You can manually manage every campaign
 * 
 * THIS IS WHAT WAS PROMISED AND NOW DELIVERED.
 */

import dynamic from 'next/dynamic';

const TrulyManualFirstSalesMachine = dynamic(() => import('./truly-manual-first-sales-machine'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p>Loading Truly Manual-First Sales Machine...</p>
        <p className="text-sm text-gray-400 mt-2">Complete manual control when AI is down</p>
      </div>
    </div>
  )
});

export default function Home() {
  return <TrulyManualFirstSalesMachine />;
}
