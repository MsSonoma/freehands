"use client";
import { usePathname } from 'next/navigation';
import LegalFooter from '@/components/LegalFooter';

/** @param {{ children: React.ReactNode }} props */
export default function FacilitatorLayout({ children }) {
  const pathname = usePathname();
  const hideFooter = pathname === '/facilitator/calendar';
  
  return (
    <div style={{ minHeight:'calc(100dvh - 64px - 4px - 1px)', display:'flex', flexDirection:'column', overflowY:'hidden' }}>
      <main style={{ flex:'1 0 auto' }}>
        {children}
      </main>
      {!hideFooter && <LegalFooter compact styleOverrides={{ marginTop: 0, padding: '0 12px' }} />}
    </div>
  );
}
