/**
 * PmsDetailModal — Reusable read-only detail modal for any PMS entity.
 *
 * Accepts a title and an array of label/value rows.
 * Handles overlay click-to-close, Escape key, and body scroll lock.
 *
 * Styling: CSS variables only (Phase 27-03 CSS lock — no Tailwind).
 */

import { useEffect } from 'react';

export interface PmsDetailModalProps {
  title: string;
  rows: { label: string; value: React.ReactNode }[];
  onClose: () => void;
}

export function PmsDetailModal({ title, rows, onClose }: PmsDetailModalProps) {
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
      aria-label={title}
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
          {title}
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

        {/* Close button at bottom */}
        <button
          onClick={onClose}
          style={{
            marginTop: 'var(--space-xl)',
            width: '100%',
            padding: 'var(--space-sm) var(--space-lg)',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-secondary)',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
