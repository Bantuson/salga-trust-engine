/**
 * DepartmentDetailModal — Read-only detail view for a department.
 *
 * Opens when a table row is clicked on DepartmentsPage.
 * Glass overlay + card pattern matching existing project modals.
 *
 * Styling: CSS variables only (Phase 27-03 CSS lock — no Tailwind).
 */

import { useEffect } from 'react';

interface DepartmentDetailModalProps {
  department: {
    id: string;
    name: string;
    code: string;
    director_id: string | null;
    director_name?: string | null;
    is_active: boolean;
    has_kpis?: boolean;
    created_at: string;
  };
  onClose: () => void;
  canEdit: boolean;
  onEdit: () => void;
}

export function DepartmentDetailModal({
  department,
  onClose,
  canEdit,
  onEdit,
}: DepartmentDetailModalProps) {
  // Body scroll lock
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const activationStatus = !department.director_id
    ? { label: 'Pending Director', color: 'var(--color-coral)', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)' }
    : !department.has_kpis
      ? { label: 'Pending KPIs', color: 'var(--color-gold)', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)' }
      : { label: 'Active', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.3)' };

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'Code', value: department.code },
    {
      label: 'Director',
      value: department.director_name ?? 'No Director Assigned',
    },
    {
      label: 'Status',
      value: (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 10px',
            borderRadius: '12px',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            background: activationStatus.bg,
            color: activationStatus.color,
            border: `1px solid ${activationStatus.border}`,
          }}
        >
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: activationStatus.color,
              flexShrink: 0,
            }}
          />
          {activationStatus.label}
        </span>
      ),
    },
    {
      label: 'KPIs',
      value: department.has_kpis ? 'Configured' : 'Not configured',
    },
    {
      label: 'Created',
      value: department.created_at
        ? new Date(department.created_at).toLocaleDateString('en-ZA', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
        : '\u2014',
    },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Department Details"
    >
      <div
        data-lenis-prevent
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--radius-lg)',
          maxWidth: '520px',
          width: '90%',
          padding: 'var(--space-xl)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 'var(--space-md)',
            right: 'var(--space-md)',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius-sm)',
          }}
        >
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

        {/* Title */}
        <h2
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0,
            marginBottom: 'var(--space-lg)',
            paddingRight: 'var(--space-xl)',
          }}
        >
          {department.name}
        </h2>

        {/* Detail rows */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-md)',
          }}
        >
          {rows.map((row) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 'var(--space-sm) 0',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {row.label}
              </span>
              <span
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-primary)',
                  textAlign: 'right',
                }}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* Edit button */}
        {canEdit && (
          <button
            onClick={onEdit}
            style={{
              marginTop: 'var(--space-xl)',
              width: '100%',
              padding: 'var(--space-sm) var(--space-lg)',
              background: 'var(--color-teal)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: '#fff',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Edit Department
          </button>
        )}
      </div>
    </div>
  );
}
