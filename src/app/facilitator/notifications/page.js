"use client";

import { useEffect, useMemo, useState } from 'react';
import { useAccessControl } from '@/app/hooks/useAccessControl';
import GatedOverlay from '@/app/components/GatedOverlay';
import SettingsOverlay from '@/components/SettingsOverlay';
import {
  getCurrentFacilitatorId,
  ensureNotificationPrefs,
  saveNotificationPrefs,
  seedDemoNotificationsIfEmpty,
  listNotifications,
  setNotificationRead
} from '@/app/lib/facilitatorNotificationsClient';

function formatDate(iso) {
  try {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return '';
  }
}

export default function FacilitatorNotificationsPage() {
  const { loading: authLoading, isAuthenticated, gateType } = useAccessControl({ requiredAuth: true });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [prefs, setPrefs] = useState(null);
  const [prefsDraft, setPrefsDraft] = useState(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [busyIds, setBusyIds] = useState(() => new Set());

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read_at).length;
  }, [notifications]);

  const refresh = async () => {
    setError('');
    setLoading(true);
    try {
      const facilitatorId = await getCurrentFacilitatorId();

      const loadedPrefs = await ensureNotificationPrefs(facilitatorId);
      setPrefs(loadedPrefs);

      await seedDemoNotificationsIfEmpty(facilitatorId);

      const rows = await listNotifications(facilitatorId);
      setNotifications(rows);
    } catch (e) {
      setError(e?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated]);

  const openPrefs = () => {
    setPrefsDraft(prefs ? {
      enabled: !!prefs.enabled,
      planned_unscheduled_enabled: !!prefs.planned_unscheduled_enabled,
      expired_lessons_enabled: !!prefs.expired_lessons_enabled,
      subscription_enabled: !!prefs.subscription_enabled
    } : {
      enabled: true,
      planned_unscheduled_enabled: true,
      expired_lessons_enabled: true,
      subscription_enabled: true
    });
    setPrefsOpen(true);
  };

  const toggleRead = async (id, nextRead) => {
    setBusyIds((prev) => {
      const copy = new Set(prev);
      copy.add(id);
      return copy;
    });
    try {
      const updated = await setNotificationRead(id, nextRead);
      setNotifications((prev) => prev.map((n) => (n.id === id ? updated : n)));
    } catch (e) {
      setError(e?.message || 'Failed to update notification');
    } finally {
      setBusyIds((prev) => {
        const copy = new Set(prev);
        copy.delete(id);
        return copy;
      });
    }
  };

  const savePrefs = async () => {
    if (!prefsDraft) return;
    setPrefsSaving(true);
    setError('');
    try {
      const facilitatorId = await getCurrentFacilitatorId();
      const saved = await saveNotificationPrefs(facilitatorId, prefsDraft);
      setPrefs(saved);
      setPrefsOpen(false);
    } catch (e) {
      setError(e?.message || 'Failed to save preferences');
    } finally {
      setPrefsSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <>
        <main style={{ padding: 7 }}><p>Loading…</p></main>
        <GatedOverlay
          show={!isAuthenticated}
          gateType={gateType}
          feature="Notifications"
          emoji="🔔"
          description="Sign in to view and manage facilitator notifications."
          benefits={[
            'See reminders about planning and scheduling',
            'Track lesson expirations',
            'Get subscription and limit alerts'
          ]}
        />
      </>
    );
  }

  return (
    <>
      <main style={{ padding: 7, opacity: !isAuthenticated ? 0.5 : 1, pointerEvents: !isAuthenticated ? 'none' : 'auto' }}>
        <div style={{ width: '100%', maxWidth: 900, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h1 style={{ marginTop: 0, marginBottom: 4, textAlign: 'left', fontSize: 22 }}>Notifications</h1>
              <p style={{ color: '#6b7280', marginTop: 0, marginBottom: 16, textAlign: 'left', fontSize: 14 }}>
                {unreadCount === 0 ? 'All caught up.' : `${unreadCount} unread.`}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={openPrefs}
                title="Notification settings"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  border: '1px solid #e5e7eb',
                  background: '#fff',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18
                }}
              >
                ⚙️
              </button>

              <button
                type="button"
                onClick={refresh}
                style={{
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: '1px solid #e5e7eb',
                  background: '#fff',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 10, padding: 12, marginBottom: 12 }}>
              {error}
            </div>
          )}

          <section style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 14
          }}>
            {(!prefs || prefs.enabled) ? (
              notifications.length === 0 ? (
                <p style={{ color: '#6b7280', margin: 0 }}>No notifications yet.</p>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {notifications.map((n) => {
                    const isRead = !!n.read_at;
                    const busy = busyIds.has(n.id);

                    return (
                      <div
                        key={n.id}
                        style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: 12,
                          padding: 12,
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                          background: isRead ? '#f9fafb' : '#ffffff'
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                            <div style={{ fontWeight: 800, color: '#111827' }}>
                              {n.title}
                            </div>
                            <div style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
                              {formatDate(n.created_at)}
                            </div>
                          </div>

                          {n.body && (
                            <div style={{ marginTop: 6, color: '#374151' }}>
                              {n.body}
                            </div>
                          )}

                          <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
                            {n.category} • {n.type}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleRead(n.id, !isRead)}
                          disabled={busy}
                          title={isRead ? 'Mark unread' : 'Mark read'}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            border: '1px solid #e5e7eb',
                            background: '#fff',
                            cursor: busy ? 'not-allowed' : 'pointer',
                            opacity: busy ? 0.6 : 1,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 18,
                            flexShrink: 0
                          }}
                        >
                          {isRead ? '✓' : '○'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              <p style={{ color: '#6b7280', margin: 0 }}>
                Notifications are turned off.
              </p>
            )}
          </section>
        </div>
      </main>

      <SettingsOverlay
        isOpen={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        title="Notification Settings"
        maxWidth={520}
      >
        {!prefsDraft ? (
          <p>Loading…</p>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            <p style={{ color: '#6b7280', margin: 0 }}>
              These preferences sync across devices.
            </p>

            <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={!!prefsDraft.enabled}
                onChange={(e) => setPrefsDraft((p) => ({ ...p, enabled: e.target.checked }))}
              />
              <span style={{ fontWeight: 700, color: '#111827' }}>Enable notifications</span>
            </label>

            <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, background: '#f9fafb' }}>
              <div style={{ fontWeight: 800, marginBottom: 8, color: '#111827' }}>Types</div>

              <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                <input
                  type="checkbox"
                  disabled={!prefsDraft.enabled}
                  checked={!!prefsDraft.planned_unscheduled_enabled}
                  onChange={(e) => setPrefsDraft((p) => ({ ...p, planned_unscheduled_enabled: e.target.checked }))}
                />
                <span>Planned lessons not scheduled</span>
              </label>

              <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                <input
                  type="checkbox"
                  disabled={!prefsDraft.enabled}
                  checked={!!prefsDraft.expired_lessons_enabled}
                  onChange={(e) => setPrefsDraft((p) => ({ ...p, expired_lessons_enabled: e.target.checked }))}
                />
                <span>Scheduled lessons that expire unfinished</span>
              </label>

              <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  disabled={!prefsDraft.enabled}
                  checked={!!prefsDraft.subscription_enabled}
                  onChange={(e) => setPrefsDraft((p) => ({ ...p, subscription_enabled: e.target.checked }))}
                />
                <span>Subscription and limits</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setPrefsOpen(false)}
                disabled={prefsSaving}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: '1px solid #e5e7eb',
                  background: '#fff',
                  cursor: prefsSaving ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  opacity: prefsSaving ? 0.6 : 1
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={savePrefs}
                disabled={prefsSaving}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: '1px solid #111827',
                  background: '#111827',
                  color: '#fff',
                  cursor: prefsSaving ? 'not-allowed' : 'pointer',
                  fontWeight: 800,
                  opacity: prefsSaving ? 0.7 : 1
                }}
              >
                {prefsSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </SettingsOverlay>

      <GatedOverlay
        show={!isAuthenticated}
        gateType={gateType}
        feature="Notifications"
        emoji="🔔"
        description="Sign in to view and manage facilitator notifications."
        benefits={[
          'See reminders about planning and scheduling',
          'Track lesson expirations',
          'Get subscription and limit alerts'
        ]}
      />
    </>
  );
}
