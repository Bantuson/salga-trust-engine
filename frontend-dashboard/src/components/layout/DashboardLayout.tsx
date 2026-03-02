/**
 * Dashboard Layout Component
 *
 * Wraps authenticated pages with:
 * - Icon sidebar navigation (fixed position)
 * - Top header bar with notification bell
 * - Main content area (with margin for sidebar)
 * - Responsive mobile support
 * - RoleSwitcher for multi-role users (switches view context)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Sidebar } from './Sidebar';
import { useAuth } from '../../hooks/useAuth';
import { useViewRole } from '../../contexts/ViewRoleContext';
import './DashboardLayout.css';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

// Bell SVG icon
function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, session, signOut, getAllRoles } = useAuth();
  const token = session?.access_token ?? null;

  const allRoles = getAllRoles();
  // viewRole state is now managed by ViewRoleContext (lifted to fix ReactNode disconnect)
  const { viewRole, setViewRole } = useViewRole();

  // Notification state
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const bellRef = useRef<HTMLDivElement>(null);

  // Fetch unread notification count
  const fetchUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/notifications/unread-count', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count ?? 0);
      }
    } catch {
      // Non-critical — silently ignore
    }
  }, [token]);

  // Fetch notification list
  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/notifications/?limit=10', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setNotifications(await res.json());
      }
    } catch {
      // Non-critical — silently ignore
    }
  }, [token]);

  // Initial fetch + polling every 60 seconds
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Fetch notifications when panel opens
  useEffect(() => {
    if (showNotifications) {
      fetchNotifications();
    }
  }, [showNotifications, fetchNotifications]);

  // Close panel on click-away
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  // Mark all notifications as read
  const markAllRead = async () => {
    if (!token) return;
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    try {
      await fetch('/api/v1/notifications/mark-read', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notification_ids: unreadIds }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // Non-critical — silently ignore
    }
  };

  // Navigate on notification click
  const handleNotificationClick = (notification: Notification) => {
    if (notification.link) {
      window.location.href = notification.link;
    }
    setShowNotifications(false);
  };

  return (
    <div className="dashboard-layout">
      <Sidebar
        userEmail={user?.email}
        userPhone={user?.phone}
        userRole={viewRole}
        allRoles={allRoles}
        onRoleSwitch={setViewRole}
        onSignOut={signOut}
      />

      {/* Top header bar with notification bell */}
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: '64px',
          right: 0,
          height: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 var(--space-xl, 24px)',
          background: 'transparent',
          zIndex: 100,
        }}
      >
        {/* Notification Bell */}
        <div ref={bellRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNotifications((prev) => !prev)}
            aria-label="Notifications"
            aria-expanded={showNotifications}
            style={{
              position: 'relative',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              color: 'var(--color-coral, #f97316)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = '0.8';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = '1';
            }}
          >
            <BellIcon />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  background: 'var(--color-error, #ef4444)',
                  color: 'white',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  lineHeight: 1,
                  pointerEvents: 'none',
                }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification dropdown panel */}
          {showNotifications && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '360px',
                maxHeight: '400px',
                overflowY: 'auto',
                background: 'var(--color-surface, #1a1a2e)',
                border: '1px solid var(--color-border, rgba(255,255,255,0.1))',
                borderRadius: '8px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                zIndex: 1000,
              }}
            >
              {/* Panel header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  position: 'sticky',
                  top: 0,
                  background: 'var(--color-surface, #1a1a2e)',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  Notifications
                  {unreadCount > 0 && (
                    <span
                      style={{
                        marginLeft: '8px',
                        background: 'var(--color-error, #ef4444)',
                        color: 'white',
                        borderRadius: '10px',
                        padding: '1px 7px',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      {unreadCount}
                    </span>
                  )}
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-teal, #14b8a6)',
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-xs)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Notification list */}
              {notifications.length === 0 ? (
                <div
                  style={{
                    padding: '24px 16px',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  No notifications
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '12px 16px',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      cursor: notification.link ? 'pointer' : 'default',
                      background: notification.is_read ? 'transparent' : 'rgba(59,130,246,0.05)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = notification.is_read
                        ? 'transparent'
                        : 'rgba(59,130,246,0.05)';
                    }}
                  >
                    {/* Unread dot */}
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: notification.is_read ? 'transparent' : '#3b82f6',
                        flexShrink: 0,
                        marginTop: '6px',
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-sm)',
                          fontWeight: notification.is_read ? 400 : 600,
                          color: 'var(--text-primary)',
                          marginBottom: '2px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap' as const,
                        }}
                      >
                        {notification.title}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--text-secondary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical' as const,
                          marginBottom: '4px',
                        }}
                      >
                        {notification.message.length > 80
                          ? notification.message.slice(0, 80) + '...'
                          : notification.message}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {timeAgo(notification.created_at)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </header>

      <main className="dashboard-main" style={{ paddingTop: 'calc(48px + var(--space-2xl, 32px))' }}>
        {children}
      </main>
    </div>
  );
}
