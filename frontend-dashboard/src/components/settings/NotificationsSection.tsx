/**
 * NotificationsSection — Email notification preference toggles.
 *
 * Currently saves to localStorage (no backend notification preferences table).
 * TODO: Wire to backend notification preferences endpoint when available.
 */

import React, { useState, useEffect } from 'react';
import { SettingsSection } from './SettingsSection';

interface NotificationPrefs {
  email_new_assignment: boolean;
  email_sla_breach_warning: boolean;
  email_ticket_resolution: boolean;
  email_invitation_accepted: boolean;
}

const STORAGE_KEY = 'salga_notification_prefs';

const DEFAULTS: NotificationPrefs = {
  email_new_assignment: true,
  email_sla_breach_warning: true,
  email_ticket_resolution: false,
  email_invitation_accepted: true,
};

const NOTIFICATION_ITEMS: Array<{
  key: keyof NotificationPrefs;
  label: string;
  description: string;
}> = [
  {
    key: 'email_new_assignment',
    label: 'New ticket assignment',
    description: 'Receive an email when a ticket is assigned to you or your team.',
  },
  {
    key: 'email_sla_breach_warning',
    label: 'SLA breach warning',
    description: 'Receive an email when a ticket is approaching its SLA deadline.',
  },
  {
    key: 'email_ticket_resolution',
    label: 'Ticket resolved',
    description: 'Receive an email when a ticket assigned to you is marked as resolved.',
  },
  {
    key: 'email_invitation_accepted',
    label: 'Team invitation accepted',
    description: 'Receive an email when someone accepts your team invitation.',
  },
];

function loadPrefs(): NotificationPrefs {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULTS, ...JSON.parse(stored) };
    }
  } catch {
    // ignore parse errors
  }
  return { ...DEFAULTS };
}

export function NotificationsSection() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(loadPrefs);
  const [savedPrefs, setSavedPrefs] = useState<NotificationPrefs>(loadPrefs);
  const [isSaving, setIsSaving] = useState(false);

  // Check dirty by comparing to last saved state
  const isDirty = JSON.stringify(prefs) !== JSON.stringify(savedPrefs);

  const handleToggle = (key: keyof NotificationPrefs) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // TODO: Wire to backend notification preferences endpoint when available
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      setSavedPrefs({ ...prefs });
      // Simulate async save delay
      await new Promise((resolve) => setTimeout(resolve, 300));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SettingsSection
      id="notifications"
      title="Notification Preferences"
      description="Control which email notifications you receive."
      onSave={handleSave}
      isDirty={isDirty}
      isSaving={isSaving}
    >
      <div style={styles.list}>
        {NOTIFICATION_ITEMS.map(({ key, label, description }) => (
          <div key={key} style={styles.item}>
            <div style={styles.itemText}>
              <span style={styles.itemLabel}>{label}</span>
              <span style={styles.itemDescription}>{description}</span>
            </div>
            <button
              role="switch"
              aria-checked={prefs[key]}
              onClick={() => handleToggle(key)}
              style={{
                ...styles.toggle,
                ...(prefs[key] ? styles.toggleOn : styles.toggleOff),
              }}
            >
              <span
                style={{
                  ...styles.toggleKnob,
                  transform: prefs[key] ? 'translateX(22px)' : 'translateX(2px)',
                }}
              />
            </button>
          </div>
        ))}
      </div>

      <p style={styles.hint}>
        Preferences saved locally. Backend notification endpoint coming soon.
      </p>
    </SettingsSection>
  );
}

const styles: Record<string, React.CSSProperties> = {
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--space-md)',
    padding: '1rem 0',
    borderBottom: '1px solid var(--border-subtle)',
  },
  itemText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    flex: 1,
  },
  itemLabel: {
    fontSize: '0.9375rem',
    fontWeight: 500,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-body)',
  },
  itemDescription: {
    fontSize: '0.8125rem',
    color: 'var(--text-muted)',
    lineHeight: 1.4,
  },
  toggle: {
    flexShrink: 0,
    position: 'relative',
    width: '46px',
    height: '26px',
    borderRadius: '999px',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color var(--transition-base)',
    padding: 0,
  },
  toggleOn: {
    backgroundColor: 'var(--color-teal)',
  },
  toggleOff: {
    backgroundColor: 'var(--surface-higher)',
  },
  toggleKnob: {
    position: 'absolute',
    top: '3px',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: 'white',
    transition: 'transform var(--transition-base)',
    display: 'block',
  },
  hint: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: 'var(--space-md)',
    fontStyle: 'italic',
  },
};
