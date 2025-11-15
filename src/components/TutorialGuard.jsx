'use client';
/**
 * TutorialGuard Component
 * 
 * Wraps facilitator pages and enforces tutorial gates for Beta users.
 * Automatically redirects to appropriate tutorial/video if not completed.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/app/lib/supabaseClient';
import { checkFacilitatorTutorialGate } from '@/app/lib/tutorialGuards';

export default function TutorialGuard({ children }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          // Not logged in, redirect to login
          if (!cancelled) {
            router.push('/auth/login');
          }
          return;
        }

        // Check tutorial gates
        const { gateType, redirectTo } = await checkFacilitatorTutorialGate(user.id);

        if (!cancelled) {
          if (gateType && redirectTo) {
            // Gate is active, redirect
            router.push(redirectTo);
          } else {
            // All gates passed
            setAllowed(true);
            setChecking(false);
          }
        }
      } catch (err) {
        // TutorialGuard error - fail open to avoid blocking
        if (!cancelled) {
          setAllowed(true); // Fail open to avoid blocking on error
          setChecking(false);
        }
      }
    })();

    return () => { cancelled = true };
  }, [router]);

  if (checking) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading...</p>
      </div>
    );
  }

  if (!allowed) {
    return null; // Redirecting
  }

  return children;
}

const styles = {
  loading: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f7fa',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #ddd',
    borderTop: '4px solid #111',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    marginTop: '16px',
    fontSize: '14px',
    color: '#888',
  },
};

// Inject keyframes for spinner animation
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  if (!document.head.querySelector('style[data-tutorial-guard]')) {
    style.setAttribute('data-tutorial-guard', 'true');
    document.head.appendChild(style);
  }
}
