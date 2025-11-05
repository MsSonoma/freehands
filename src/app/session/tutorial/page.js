/**
 * Learner Tutorial Page
 *
 * Wraps the client-only tutorial component in Suspense so
 * search param hooks hydrate safely at runtime.
 */

import { Suspense } from 'react';
import LearnerTutorial from '@/components/LearnerTutorial';

export const dynamic = 'force-dynamic';

export default function LearnerTutorialPage() {
  return (
    <Suspense fallback={<main style={{ padding: 32 }}><p>Loading tutorial...</p></main>}>
      <LearnerTutorial />
    </Suspense>
  );
}
