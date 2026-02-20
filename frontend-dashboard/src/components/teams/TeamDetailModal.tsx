/**
 * TeamDetailModal — Full team detail modal with tabbed layout.
 *
 * Tabs: Members | Pending Invitations | Activity
 *
 * Features:
 * - Glassmorphic overlay (glass-pink-frost, blur medium)
 * - Body scroll lock while open
 * - Click overlay to close
 * - Tab bar with teal bottom border for active tab
 * - z-index 1000 (BulkInviteDialog uses 1100, ConfirmDialogs use 1200)
 */

import { useEffect, useState } from 'react';
import { getCategoryConfig } from '../../constants/categories';
import { MembersTab } from './MembersTab';
import { InvitationsTab } from './InvitationsTab';
import { ActivityTab } from './ActivityTab';
import type { Team } from '../../types/teams';

type Tab = 'members' | 'invitations' | 'activity';

interface TeamDetailModalProps {
  team: Team;
  onClose: () => void;
  /** Current user's role — forwarded to MembersTab for admin-gated actions */
  currentUserRole?: string;
}

export function TeamDetailModal({ team, onClose, currentUserRole = 'manager' }: TeamDetailModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('members');
  // membersRefreshKey forces MembersTab remount when incremented
  // (e.g. after invitation actions that change team membership)
  const [membersRefreshKey] = useState(0);
  const categoryConfig = getCategoryConfig(team.category);

  // Body scroll lock while modal is open (per Pitfall 2)
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // Keyboard close support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'members', label: 'Members' },
    { key: 'invitations', label: 'Pending Invitations' },
    { key: 'activity', label: 'Activity' },
  ];

  return (
    <div
      style={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${team.name} details`}
    >
      {/* Modal content — stop propagation so clicks inside don't close */}
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <h2 style={styles.teamName}>{team.name}</h2>
            <span
              style={{
                ...styles.categoryBadge,
                backgroundColor: categoryConfig.bgColor,
                color: categoryConfig.color,
              }}
            >
              {categoryConfig.label}
            </span>
          </div>

          {/* Close button */}
          <button style={styles.closeButton} onClick={onClose} aria-label="Close">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Metadata row */}
        <div style={styles.metadataRow}>
          <span style={styles.metaItem}>
            <span style={styles.metaLabel}>Manager:</span>
            <span style={styles.metaValue}>{team.manager_name || 'Unassigned'}</span>
          </span>
          <span style={styles.metaDivider} />
          <span style={styles.metaItem}>
            <span style={styles.metaLabel}>Members:</span>
            <span style={styles.metaValue}>{team.member_count}</span>
          </span>
          <span style={styles.metaDivider} />
          <span style={styles.metaItem}>
            <span style={styles.metaLabel}>Active Tickets:</span>
            <span style={styles.metaValue}>{team.active_ticket_count}</span>
          </span>
        </div>

        {/* Tab bar */}
        <div style={styles.tabBar}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              style={{
                ...styles.tabButton,
                ...(activeTab === tab.key ? styles.tabButtonActive : styles.tabButtonInactive),
              }}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={styles.tabContent}>
          {activeTab === 'members' && (
            <MembersTab
              key={membersRefreshKey}
              teamId={team.id}
              currentUserRole={currentUserRole}
            />
          )}
          {activeTab === 'invitations' && (
            <InvitationsTab teamId={team.id} />
          )}
          {activeTab === 'activity' && <ActivityTab teamId={team.id} team={team} />}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    // z-index 1000: BulkInviteDialog (1100) and ConfirmDialogs (1200) layer above
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  } as React.CSSProperties,
  modal: {
    // Glassmorphic — glass-pink-frost with medium blur (per Pattern 5)
    background: 'var(--glass-pink-frost)',
    backdropFilter: 'blur(var(--glass-blur-medium))',
    WebkitBackdropFilter: 'blur(var(--glass-blur-medium))',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-xl)',
    maxWidth: '720px',
    width: '100%',
    maxHeight: '85vh',
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
  } as React.CSSProperties,
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 'var(--glass-card-padding)',
    paddingBottom: 'var(--space-md)',
    borderBottom: '1px solid var(--glass-border)',
    position: 'sticky' as const,
    top: 0,
    background: 'var(--glass-pink-frost)',
    backdropFilter: 'blur(var(--glass-blur-medium))',
    WebkitBackdropFilter: 'blur(var(--glass-blur-medium))',
    zIndex: 1,
  } as React.CSSProperties,
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
    flexWrap: 'wrap' as const,
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,
  teamName: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
    lineHeight: 1.3,
  } as React.CSSProperties,
  categoryBadge: {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.72rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    flexShrink: 0,
  } as React.CSSProperties,
  closeButton: {
    flexShrink: 0,
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-sm)',
    transition: 'color 0.15s ease',
  } as React.CSSProperties,
  metadataRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
    padding: 'var(--space-md) var(--glass-card-padding)',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.8rem',
  } as React.CSSProperties,
  metaLabel: {
    color: 'var(--text-muted)',
    fontWeight: 500,
  } as React.CSSProperties,
  metaValue: {
    color: 'var(--text-primary)',
    fontWeight: 600,
  } as React.CSSProperties,
  metaDivider: {
    width: '1px',
    height: '16px',
    background: 'var(--glass-border)',
  } as React.CSSProperties,
  tabBar: {
    display: 'flex',
    gap: 0,
    padding: '0 var(--glass-card-padding)',
    borderBottom: '1px solid var(--glass-border)',
    position: 'sticky' as const,
    top: 0,
  } as React.CSSProperties,
  tabButton: {
    background: 'transparent',
    border: 'none',
    padding: '12px 16px',
    fontSize: '0.875rem',
    fontFamily: 'var(--font-body)',
    cursor: 'pointer',
    transition: 'color 0.15s ease, border-bottom 0.15s ease',
    position: 'relative' as const,
    borderBottom: '2px solid transparent',
    marginBottom: '-1px',
  } as React.CSSProperties,
  tabButtonActive: {
    color: 'var(--text-primary)',
    fontWeight: 600,
    borderBottom: '2px solid var(--color-teal)',
  } as React.CSSProperties,
  tabButtonInactive: {
    color: 'var(--text-muted)',
    fontWeight: 400,
  } as React.CSSProperties,
  tabContent: {
    padding: 'var(--glass-card-padding)',
    flex: 1,
  } as React.CSSProperties,
};
