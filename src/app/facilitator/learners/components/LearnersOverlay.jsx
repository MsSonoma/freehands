"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import LearnerEditOverlay from './LearnerEditOverlay';
import { deleteLearner, updateLearner } from '../clientApi';
import { updateFollowUpSettings } from '@/app/lib/followUpsClient';
import { broadcastLearnerSettingsPatch } from '@/app/lib/learnerSettingsBus';
import { featuresForTier } from '@/app/lib/entitlements';
import { acquirePageScrollLock } from '@/app/lib/scrollLock.mjs';

const normalizeHumorLevel = (value) => {
  if (typeof value !== 'string') return 'calm';
  const normalized = value.trim().toLowerCase();
  return ['calm', 'funny', 'hilarious'].includes(normalized) ? normalized : 'calm';
};

export default function LearnersOverlay({
  isOpen,
  learners = [],
  activeLearnerId = '',
  planTier = 'free',
  onClose,
  onActivate,
  onLearnersChange,
}) {
  const router = useRouter();
  const [settingsLearnerId, setSettingsLearnerId] = useState('');
  const [error, setError] = useState('');
  const [busyLearnerId, setBusyLearnerId] = useState('');

  const settingsLearner = useMemo(
    () => learners.find((learner) => String(learner.id) === String(settingsLearnerId)) || null,
    [learners, settingsLearnerId]
  );

  const maxLearners = featuresForTier(planTier).learnersMax;
  const atLimit = Number.isFinite(maxLearners) && learners.length >= maxLearners;

  useEffect(() => isOpen ? acquirePageScrollLock() : undefined, [isOpen]);

  useEffect(() => {
    if (isOpen) return;
    setSettingsLearnerId('');
    setError('');
    setBusyLearnerId('');
  }, [isOpen]);

  if (!isOpen) return null;

  const replaceLearner = (learnerId, patch) => {
    const next = learners.map((learner) => (
      String(learner.id) === String(learnerId) ? { ...learner, ...patch } : learner
    ));
    onLearnersChange?.(next);
    return next;
  };

  const handleSave = async (updates) => {
    if (!settingsLearner?.id) return;
    setBusyLearnerId(String(settingsLearner.id));
    setError('');
    try {
      await updateLearner(settingsLearner.id, updates);
      replaceLearner(settingsLearner.id, updates);
      broadcastLearnerSettingsPatch(settingsLearner.id, updates);
      if (String(activeLearnerId) === String(settingsLearner.id) && typeof window !== 'undefined') {
        if (updates.name != null) localStorage.setItem('learner_name', updates.name);
        if (updates.grade != null) localStorage.setItem('learner_grade', String(updates.grade));
        if (updates.humor_level != null) {
          const humor = normalizeHumorLevel(updates.humor_level);
          localStorage.setItem('learner_humor_level', humor);
          localStorage.setItem(`learner_humor_level_${settingsLearner.id}`, humor);
        }
      }
      setSettingsLearnerId('');
    } catch (cause) {
      setError(cause?.message || 'Could not save learner settings');
      throw cause;
    } finally {
      setBusyLearnerId('');
    }
  };

  const handlePatch = async (patch) => {
    if (!settingsLearner?.id || !patch || typeof patch !== 'object') return;
    setError('');
    const followUpKeys = ['daily_followups_enabled', 'weekly_reviews_enabled', 'weekly_review_day'];
    const isFollowUpPatch = Object.keys(patch).some((key) => followUpKeys.includes(key));
    try {
      if (isFollowUpPatch) await updateFollowUpSettings(settingsLearner.id, patch);
      else await updateLearner(settingsLearner.id, patch);
      replaceLearner(settingsLearner.id, patch);
      broadcastLearnerSettingsPatch(settingsLearner.id, patch);
    } catch (cause) {
      setError(cause?.message || 'Could not update learner settings');
      throw cause;
    }
  };

  const handleDelete = async (id, learnerName) => {
    if (!confirm(`Delete ${learnerName || 'this learner'}?`)) return;
    setBusyLearnerId(String(id));
    setError('');
    try {
      await deleteLearner(id);
      const next = learners.filter((learner) => String(learner.id) !== String(id));
      onLearnersChange?.(next);
      setSettingsLearnerId('');
    } catch (cause) {
      setError(cause?.message || 'Could not delete learner');
    } finally {
      setBusyLearnerId('');
    }
  };

  const activateLearner = (learner) => {
    if (!learner?.id) return;
    onActivate?.(learner.id);
    onClose?.();
  };

  return (
    <>
      <div
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose?.();
        }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1100,
          background: 'rgba(31, 27, 23, 0.42)',
          display: 'grid',
          placeItems: 'center',
          padding: 16,
        }}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-label="Learners"
          style={{
            width: 'min(720px, 100%)',
            maxHeight: 'min(82vh, 760px)',
            overflow: 'auto',
            borderRadius: 14,
            background: '#fffdf8',
            border: '1px solid #d8cec1',
            boxShadow: '0 24px 60px rgba(47, 39, 31, 0.24)',
            padding: 18,
          }}
        >
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20 }}>Learners</h2>
              <p style={{ margin: '4px 0 0', color: '#6b645c', fontSize: 13 }}>
                Choose the active learner or open settings.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{ border: '1px solid #d8cec1', borderRadius: 8, background: '#fff', padding: '7px 10px', cursor: 'pointer' }}
            >
              Close
            </button>
          </header>

          {Number.isFinite(maxLearners) && (
            <div style={{ marginBottom: 12, color: '#6b645c', fontSize: 13 }}>
              Plan: {planTier} · {learners.length} / {maxLearners} learners
            </div>
          )}

          {error && (
            <div role="alert" style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: '#fff1f2', color: '#9f1239' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gap: 10 }}>
            {learners.map((learner) => {
              const active = String(activeLearnerId) === String(learner.id);
              const busy = String(busyLearnerId) === String(learner.id);
              return (
                <div
                  key={learner.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    alignItems: 'center',
                    gap: 10,
                    border: `1px solid ${active ? '#b85b45' : '#e2d9cd'}`,
                    borderRadius: 10,
                    background: active ? '#fff4ef' : '#fff',
                    overflow: 'hidden',
                  }}
                >
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => activateLearner(learner)}
                    style={{
                      border: 0,
                      background: 'transparent',
                      textAlign: 'left',
                      padding: '12px 14px',
                      cursor: busy ? 'wait' : 'pointer',
                      minWidth: 0,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span aria-hidden="true" style={{ fontSize: 20 }}>👤</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 750, color: '#2f2a25', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {learner.name || 'Unnamed learner'}
                        </div>
                        <div style={{ marginTop: 2, color: '#756d65', fontSize: 12 }}>
                          Grade {learner.grade || 'K'}{active ? ' · Active' : ' · Activate'}
                        </div>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label={`Settings for ${learner.name || 'learner'}`}
                    title="Learner settings"
                    onClick={() => setSettingsLearnerId(String(learner.id))}
                    style={{
                      marginRight: 10,
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      border: '1px solid #d8cec1',
                      background: '#fffdf8',
                      cursor: 'pointer',
                      fontSize: 18,
                    }}
                  >
                    ⚙️
                  </button>
                </div>
              );
            })}

            {learners.length === 0 && (
              <div style={{ padding: 18, border: '1px dashed #d8cec1', borderRadius: 10, color: '#6b645c', textAlign: 'center' }}>
                No learners yet.
              </div>
            )}
          </div>

          <footer style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            {atLimit ? (
              <button
                type="button"
                onClick={() => router.push('/facilitator/account/plan')}
                style={{ border: '1px solid #b85b45', borderRadius: 8, background: '#fff', color: '#7b392b', padding: '9px 12px', cursor: 'pointer', fontWeight: 700 }}
              >
                Learner limit reached · View plans
              </button>
            ) : (
              <button
                type="button"
                onClick={() => router.push('/facilitator/learners/add')}
                style={{ border: '1px solid #b85b45', borderRadius: 8, background: '#b85b45', color: '#fff', padding: '9px 12px', cursor: 'pointer', fontWeight: 700 }}
              >
                Add learner
              </button>
            )}
          </footer>
        </section>
      </div>

      <LearnerEditOverlay
        isOpen={Boolean(settingsLearner)}
        learner={settingsLearner ? { ...settingsLearner, initialTab: 'basic' } : null}
        onClose={() => setSettingsLearnerId('')}
        onSave={handleSave}
        onPatch={handlePatch}
        onDelete={handleDelete}
        zIndex={1200}
      />
    </>
  );
}
