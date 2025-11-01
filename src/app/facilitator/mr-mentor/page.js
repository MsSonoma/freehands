// Mr. Mentor - AI Counselor for Facilitators
export const metadata = { title: 'Mr. Mentor | Ms. Sonoma' };

import { Suspense } from 'react';
import CounselorClient from '../generator/counselor/CounselorClient';

export default function MrMentorPage() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}><p>Loading Mr. Mentor...</p></main>}>
      <CounselorClient />
    </Suspense>
  );
}
