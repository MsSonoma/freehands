// Redirect to lessons page (Generator is now integrated into Lessons)
"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FacilitatorGeneratorPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/facilitator/lessons');
  }, [router]);
  
  return (
    <main style={{ padding: 24 }}>
      <p>Redirecting to Lessons...</p>
    </main>
  );
}
