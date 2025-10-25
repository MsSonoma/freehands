// Redirect to lessons page (Generated lessons are now shown in Lessons)
"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GeneratedLessonsPage() {
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
