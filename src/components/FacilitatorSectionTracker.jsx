'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { setInFacilitatorSection } from '@/app/lib/pinGate';

/**
 * Tracks when user leaves the facilitator section to clear the session flag.
 * This ensures PIN is required again when re-entering from outside.
 */
export default function FacilitatorSectionTracker() {
  const pathname = usePathname();
  const prevPathnameRef = useRef(pathname);

  useEffect(() => {
    const prevPathname = prevPathnameRef.current;
    const isInFacilitator = pathname && pathname.startsWith('/facilitator');
    const wasInFacilitator = prevPathname && prevPathname.startsWith('/facilitator');
    
    // Only clear the flag when leaving the facilitator section entirely
    // (from /facilitator/* to non-facilitator path)
    if (wasInFacilitator && !isInFacilitator) {
      setInFacilitatorSection(false);
    }
    
    // Update ref for next comparison
    prevPathnameRef.current = pathname;
  }, [pathname]);

  return null;
}
