'use client';
/**
 * Post-Lesson Survey
 * 
 * Facilitator feedback survey required to unlock golden key (Beta program).
 * Requires password re-authentication for security.
 * Uses calm, professional tone aligned with brand signals.
 */

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseClient } from '@/app/lib/supabaseClient';

export default function PostLessonSurvey() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');

  const [step, setStep] = useState('auth'); // 'auth' | 'survey' | 'complete'
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState(null);
  const [authenticating, setAuthenticating] = useState(false);

  // Survey fields
  const [environment, setEnvironment] = useState({
    location: '',
    distractions: '',
    lighting: '',
  });
  const [learningStyle, setLearningStyle] = useState({
    engagement: '',
    focus_duration: '',
    preferred_pace: '',
  });
  const [fatigueNotes, setFatigueNotes] = useState('');
  const [struggles, setStruggles] = useState('');
  const [notesFreeform, setNotesFreeform] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const handlePasswordAuth = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setAuthError('Please enter your password.');
      return;
    }

    setAuthenticating(true);
    setAuthError(null);

    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user?.email) {
        setAuthError('Could not verify your account. Please try again.');
        setAuthenticating(false);
        return;
      }

      // Re-authenticate with password (server-side validation, discard session)
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password,
      });

      if (authErr) {
        setAuthError('Password is incorrect. Please try again.');
        setAuthenticating(false);
        setPassword('');
        return;
      }

      // Auth successful, move to survey
      setStep('survey');
      setPassword(''); // Clear password from memory
    } catch (err) {
      setAuthError('Something went wrong. Please try again.');
      setAuthenticating(false);
      setPassword('');
    }
  };

  const handleSubmitSurvey = async (e) => {
    e.preventDefault();

    if (!sessionId) {
      setSubmitError('Missing session information. Please try again.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const supabase = getSupabaseClient();

      const { error } = await supabase
        .from('post_lesson_surveys')
        .insert({
          session_id: sessionId,
          environment: environment,
          learning_style: learningStyle,
          fatigue_moments: { notes: fatigueNotes },
          struggles: { notes: struggles },
          notes_freeform: notesFreeform,
          submitted_at: new Date().toISOString(),
        });

      if (error) {
        setSubmitError('Could not save survey. Please try again.');
        setSubmitting(false);
        return;
      }

      // Survey submitted, show completion
      setStep('complete');
    } catch (err) {
      setSubmitError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  const handleContinue = () => {
    // Return to facilitator page with golden key unlocked
    router.push('/facilitator/learners');
  };

  // Step 1: Password re-authentication
  if (step === 'auth') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.heading}>One More Step</h1>
          <p style={styles.intro}>
            Please confirm your password to access the lesson feedback form.
          </p>

          <form onSubmit={handlePasswordAuth} style={styles.form}>
            <label style={styles.label}>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                placeholder="Enter your password"
                disabled={authenticating}
                autoFocus
              />
            </label>

            {authError && (
              <div style={styles.error}>
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authenticating}
              style={styles.button}
            >
              {authenticating ? 'Verifying...' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Step 2: Survey form
  if (step === 'survey') {
    return (
      <div style={styles.container}>
        <div style={styles.cardWide}>
          <h1 style={styles.heading}>Lesson Feedback</h1>
          <p style={styles.intro}>
            Your observations help us improve the learning experience. Take a moment to share what you noticed.
          </p>

          <form onSubmit={handleSubmitSurvey} style={styles.form}>
            {/* Environment */}
            <fieldset style={styles.fieldset}>
              <legend style={styles.legend}>Learning Environment</legend>
              
              <label style={styles.label}>
                Location
                <select
                  value={environment.location}
                  onChange={(e) => setEnvironment({ ...environment, location: e.target.value })}
                  style={styles.select}
                >
                  <option value="">Choose...</option>
                  <option value="home">Home</option>
                  <option value="classroom">Classroom</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label style={styles.label}>
                Distraction Level
                <select
                  value={environment.distractions}
                  onChange={(e) => setEnvironment({ ...environment, distractions: e.target.value })}
                  style={styles.select}
                >
                  <option value="">Choose...</option>
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                </select>
              </label>

              <label style={styles.label}>
                Lighting
                <select
                  value={environment.lighting}
                  onChange={(e) => setEnvironment({ ...environment, lighting: e.target.value })}
                  style={styles.select}
                >
                  <option value="">Choose...</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                </select>
              </label>
            </fieldset>

            {/* Learning Style */}
            <fieldset style={styles.fieldset}>
              <legend style={styles.legend}>Learning Observations</legend>

              <label style={styles.label}>
                Engagement Level
                <select
                  value={learningStyle.engagement}
                  onChange={(e) => setLearningStyle({ ...learningStyle, engagement: e.target.value })}
                  style={styles.select}
                >
                  <option value="">Choose...</option>
                  <option value="high">High</option>
                  <option value="moderate">Moderate</option>
                  <option value="low">Low</option>
                </select>
              </label>

              <label style={styles.label}>
                Preferred Pace
                <select
                  value={learningStyle.preferred_pace}
                  onChange={(e) => setLearningStyle({ ...learningStyle, preferred_pace: e.target.value })}
                  style={styles.select}
                >
                  <option value="">Choose...</option>
                  <option value="faster">Faster</option>
                  <option value="moderate">Moderate</option>
                  <option value="slower">Slower</option>
                </select>
              </label>
            </fieldset>

            {/* Fatigue and Struggles */}
            <label style={styles.label}>
              Fatigue Moments
              <textarea
                value={fatigueNotes}
                onChange={(e) => setFatigueNotes(e.target.value)}
                style={styles.textarea}
                placeholder="Note any points where energy or focus dropped"
                rows={3}
              />
            </label>

            <label style={styles.label}>
              Struggles or Confusion
              <textarea
                value={struggles}
                onChange={(e) => setStruggles(e.target.value)}
                style={styles.textarea}
                placeholder="Topics or concepts that seemed difficult"
                rows={3}
              />
            </label>

            <label style={styles.label}>
              Additional Notes
              <textarea
                value={notesFreeform}
                onChange={(e) => setNotesFreeform(e.target.value)}
                style={styles.textarea}
                placeholder="Any other observations or thoughts"
                rows={4}
              />
            </label>

            {submitError && (
              <div style={styles.error}>
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={styles.button}
            >
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Step 3: Completion
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.successIcon}>✓</div>
        <h1 style={styles.heading}>Thank You</h1>
        <p style={styles.intro}>
          Your feedback has been saved. The golden key is now unlocked.
        </p>
        <button onClick={handleContinue} style={styles.button}>
          Return to Learners
        </button>
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
  card: {
    maxWidth: '500px',
    width: '100%',
    background: '#fff',
    borderRadius: '12px',
    padding: '40px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
  },
  cardWide: {
    maxWidth: '700px',
    width: '100%',
    background: '#fff',
    borderRadius: '12px',
    padding: '40px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  heading: {
    fontSize: '28px',
    fontWeight: '600',
    color: '#111',
    marginBottom: '12px',
    textAlign: 'center',
  },
  intro: {
    fontSize: '16px',
    color: '#555',
    lineHeight: '1.6',
    marginBottom: '32px',
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  fieldset: {
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  legend: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#111',
    padding: '0 8px',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#333',
  },
  input: {
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'inherit',
  },
  select: {
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'inherit',
    background: '#fff',
  },
  textarea: {
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  error: {
    background: '#fee',
    color: '#c33',
    padding: '12px',
    borderRadius: '6px',
    fontSize: '14px',
    textAlign: 'center',
  },
  button: {
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
  successIcon: {
    fontSize: '64px',
    color: '#2a2',
    textAlign: 'center',
    marginBottom: '16px',
  },
};
