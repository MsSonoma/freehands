'use client';
/**
 * Facilitator Signup Video Gate
 * 
 * Blocks Beta-tier facilitators on first sign-in until they watch the signup video.
 * Uses calm, on-brand copy following signal anchors.
 */

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/app/lib/supabaseClient';
import { markSignupVideoCompleted } from '@/app/lib/tutorialGuards';

export default function SignupVideoGate() {
  const router = useRouter();
  const videoRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [videoWatched, setVideoWatched] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Track video progress to ensure it's actually watched
  const watchedDurationRef = useRef(0);
  const requiredWatchPercentage = 0.9; // Must watch 90% of video

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      watchedDurationRef.current = Math.max(watchedDurationRef.current, video.currentTime);
      
      // Check if user has watched enough of the video
      if (video.duration > 0) {
        const watchPercentage = watchedDurationRef.current / video.duration;
        if (watchPercentage >= requiredWatchPercentage && !videoWatched) {
          setVideoWatched(true);
        }
      }
    };

    const handleEnded = () => {
      setVideoWatched(true);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
  }, [videoWatched]);

  const handleContinue = async () => {
    if (!videoWatched) {
      setError('Please finish the video before continuing.');
      return;
    }

    setCompleting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError('Not signed in. Please refresh and try again.');
        setCompleting(false);
        return;
      }

      const success = await markSignupVideoCompleted(user.id);

      if (success) {
        // Redirect to facilitator tutorial
        router.push('/facilitator/onboarding/tutorial');
      } else {
        setError('Could not save progress. Please try again.');
        setCompleting(false);
      }
    } catch (err) {
      // SignupVideoGate error
      setError('Something went wrong. Please try again.');
      setCompleting(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        {/* Heading */}
        <h1 style={styles.heading}>Welcome to Ms. Sonoma</h1>
        <p style={styles.intro}>
          Let's get you started. Watch this short video to learn how Ms. Sonoma works.
        </p>

        {/* Video Player */}
        <div style={styles.videoWrapper}>
          <video
            ref={videoRef}
            controls
            style={styles.video}
            playsInline
          >
            <source src="/videos/facilitator-signup.mp4" type="video/mp4" />
            Your browser does not support the video player.
          </video>
        </div>

        {/* Progress indicator */}
        {!videoWatched && (
          <p style={styles.hint}>
            Watch the full video to continue.
          </p>
        )}

        {/* Error message */}
        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}

        {/* Continue button */}
        <button
          onClick={handleContinue}
          disabled={!videoWatched || completing}
          style={{
            ...styles.button,
            ...((!videoWatched || completing) && styles.buttonDisabled),
          }}
        >
          {completing ? 'Setting up...' : 'Continue'}
        </button>

        {/* Progress note */}
        <p style={styles.footer}>
          After this, you'll complete a quick walkthrough of the facilitator tools.
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
    padding: '20px',
  },
  content: {
    maxWidth: '800px',
    width: '100%',
    background: '#fff',
    borderRadius: '12px',
    padding: '40px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
  },
  heading: {
    fontSize: '32px',
    fontWeight: '600',
    color: '#111',
    marginBottom: '16px',
    textAlign: 'center',
  },
  intro: {
    fontSize: '18px',
    color: '#555',
    lineHeight: '1.6',
    marginBottom: '32px',
    textAlign: 'center',
  },
  videoWrapper: {
    position: 'relative',
    width: '100%',
    paddingBottom: '56.25%', // 16:9 aspect ratio
    marginBottom: '24px',
    background: '#000',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  hint: {
    fontSize: '14px',
    color: '#666',
    textAlign: 'center',
    marginBottom: '16px',
  },
  error: {
    background: '#fee',
    color: '#c33',
    padding: '12px',
    borderRadius: '6px',
    marginBottom: '16px',
    fontSize: '14px',
    textAlign: 'center',
  },
  button: {
    width: '100%',
    padding: '16px',
    background: '#111',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  buttonDisabled: {
    background: '#ccc',
    cursor: 'not-allowed',
    opacity: 0.6,
  },
  footer: {
    fontSize: '14px',
    color: '#888',
    textAlign: 'center',
    marginTop: '24px',
  },
};
