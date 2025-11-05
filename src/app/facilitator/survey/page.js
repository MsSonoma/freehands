/**
 * Post-Lesson Survey Page
 *
 * Renders the client-side survey inside a Suspense boundary so
 * useSearchParams() can safely hydrate after navigation.
 */

import { Suspense } from 'react';
import PostLessonSurvey from '@/components/PostLessonSurvey';

export const dynamic = 'force-dynamic';

export default function PostLessonSurveyPage() {
  return (
    <Suspense fallback={<main style={{ padding: 32 }}><p>Loading survey...</p></main>}>
      <PostLessonSurvey />
    </Suspense>
  );
}
