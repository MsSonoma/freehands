"use client";
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import LegalFooter from '@/components/LegalFooter';
import { ensurePinAllowed } from '@/app/lib/pinGate';

/** @param {{ children: React.ReactNode }} props */
export default function FacilitatorLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sectionAuthorized, setSectionAuthorized] = useState(false);
  const hideFooter = pathname === '/facilitator/calendar';

  useEffect(() => {
    let cancelled = false;
    ;(async () => {
      const allowed = await ensurePinAllowed('facilitator-page');
      if (cancelled) return;
      if (!allowed) {
        router.push('/');
        return;
      }
      setSectionAuthorized(true);
    })().catch(() => {
      if (!cancelled) setSectionAuthorized(true);
    });
    return () => { cancelled = true; };
  }, [router]);

  if (!sectionAuthorized) return null;
  
  return (
    <div style={{ minHeight:'calc(100dvh - 64px - 4px - 1px)', display:'flex', flexDirection:'column', overflowY:'hidden' }}>
      <main style={{ flex:'1 0 auto' }}>
        {children}
      </main>
      {!hideFooter && <LegalFooter compact styleOverrides={{ marginTop: 0, padding: '0 12px' }} />}
    </div>
  );
}
