'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { setInFacilitatorSection } from '@/app/lib/pinGate';

/**
 * Tracks when user leaves the facilitator section to clear the session flag.
 * This ensures PIN is required again when re-entering from outside.
 */
export default function FacilitatorSectionTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // If current path is not under /facilitator, clear the flag
    if (pathname && !pathname.startsWith('/facilitator')) {
      setInFacilitatorSection(false);
    }
  }, [pathname]);

  return null;
}
