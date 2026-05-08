'use client';
/**
 * useOnboarding – tracks the new-user introductory flow.
 *
 * Steps:
 *   0 = not started (no onboarding ever seen)
 *   1 = create_learner
 *   2 = generate_lesson
 *   3 = activate_lesson  (activate or schedule)
 *   4 = calendar_tour
 *   5 = complete
 *
 * State is persisted to localStorage immediately and synced to
 * profiles.onboarding_step in Supabase when available.
 */
import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient, hasSupabaseEnv } from '@/app/lib/supabaseClient';

const STORAGE_KEY = 'ms_sonoma_onboarding_v1';

export const ONBOARDING_STEPS = {
  NOT_STARTED: 0,
  CREATE_LEARNER: 1,
  GENERATE_LESSON: 2,
  ACTIVATE_LESSON: 3,
  CALENDAR_TOUR: 4,
  COMPLETE: 5,
};

function readLocalStep() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) return parseInt(raw, 10);
  } catch {}
  return null;
}

export function useOnboarding() {
  const [step, setStep] = useState(() => readLocalStep());
  const [loaded, setLoaded] = useState(false);

  // On mount: sync from Supabase if we have no local state
  useEffect(() => {
    const local = readLocalStep();
    if (local !== null) {
      setStep(local);
      setLoaded(true);
    } else if (!hasSupabaseEnv()) {
      setLoaded(true);
    } else {
      (async () => {
        try {
          const sb = getSupabaseClient();
          const { data: auth } = await sb.auth.getUser();
          if (!auth?.user) { setLoaded(true); return; }
          const { data } = await sb.from('profiles')
            .select('onboarding_step')
            .eq('id', auth.user.id)
            .maybeSingle();
          const dbStep = typeof data?.onboarding_step === 'number' ? data.onboarding_step : null;
          if (dbStep !== null) {
            setStep(dbStep);
            try { localStorage.setItem(STORAGE_KEY, String(dbStep)); } catch {}
          }
        } catch {}
        setLoaded(true);
      })();
    }

    // Keep this instance in sync when another instance advances the step
    const onStepEvent = (e) => {
      const s = e?.detail?.step;
      if (typeof s === 'number') setStep(s);
    };
    window.addEventListener('ms:onboarding:step', onStepEvent);
    return () => window.removeEventListener('ms:onboarding:step', onStepEvent);
  }, []);

  const saveStep = useCallback(async (newStep) => {
    setStep(newStep);
    try { localStorage.setItem(STORAGE_KEY, String(newStep)); } catch {}
    // Notify all other useOnboarding instances in the same window (e.g. layout-mounted checklist)
    try { window.dispatchEvent(new CustomEvent('ms:onboarding:step', { detail: { step: newStep } })); } catch {}
    // Async persist to Supabase (best-effort)
    if (hasSupabaseEnv()) {
      try {
        const sb = getSupabaseClient();
        const { data: auth } = await sb.auth.getUser();
        if (auth?.user) {
          await sb.from('profiles')
            .update({ onboarding_step: newStep })
            .eq('id', auth.user.id);
        }
      } catch {}
    }
  }, []);

  /** Call once when a new account is created to begin the flow. */
  const startOnboarding = useCallback(() => saveStep(ONBOARDING_STEPS.CREATE_LEARNER), [saveStep]);

  /** Advance to a specific step number. */
  const advanceStep = useCallback((toStep) => saveStep(toStep), [saveStep]);

  /** Mark the whole flow complete. */
  const completeOnboarding = useCallback(() => saveStep(ONBOARDING_STEPS.COMPLETE), [saveStep]);

  /** Alias for dismiss – same as complete. */
  const dismissOnboarding = useCallback(() => saveStep(ONBOARDING_STEPS.COMPLETE), [saveStep]);

  const isOnboarding = step !== null && step > 0 && step < ONBOARDING_STEPS.COMPLETE;

  return {
    step,
    loaded,
    isOnboarding,
    startOnboarding,
    advanceStep,
    completeOnboarding,
    dismissOnboarding,
    STEPS: ONBOARDING_STEPS,
  };
}
