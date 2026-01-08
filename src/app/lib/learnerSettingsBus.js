"use client";

const CHANNEL_NAME = 'ms-learner-settings';
const EVENT_NAME = 'ms:learner-settings-patch';

export function broadcastLearnerSettingsPatch(learnerId, patch) {
  if (typeof window === 'undefined') return;
  const message = {
    type: 'learner-settings-patch',
    learnerId: String(learnerId ?? ''),
    patch: patch && typeof patch === 'object' ? patch : {}
  };

  try {
    const bc = new BroadcastChannel(CHANNEL_NAME);
    bc.postMessage(message);
    bc.close();
  } catch {}

  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: message }));
  } catch {}
}

export function subscribeLearnerSettingsPatches(handler) {
  if (typeof window === 'undefined') return () => {};
  if (typeof handler !== 'function') return () => {};

  const onMessage = (evt) => {
    const data = evt?.data;
    if (!data || data.type !== 'learner-settings-patch') return;
    handler(data);
  };

  const onEvent = (evt) => {
    const data = evt?.detail;
    if (!data || data.type !== 'learner-settings-patch') return;
    handler(data);
  };

  let bc = null;
  try {
    bc = new BroadcastChannel(CHANNEL_NAME);
    bc.addEventListener('message', onMessage);
  } catch {
    bc = null;
  }

  try {
    window.addEventListener(EVENT_NAME, onEvent);
  } catch {}

  return () => {
    try {
      if (bc) {
        bc.removeEventListener('message', onMessage);
        bc.close();
      }
    } catch {}
    try {
      window.removeEventListener(EVENT_NAME, onEvent);
    } catch {}
  };
}
