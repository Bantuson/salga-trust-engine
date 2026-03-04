/**
 * OrganogramModal — Full-screen modal rendering the OrganogramTree.
 *
 * Glass overlay pattern matching existing project modals, but wider
 * for the organogram visualization.
 *
 * Styling: CSS variables only (Phase 27-03 CSS lock — no Tailwind).
 */

import { useEffect } from 'react';
import { OrganogramTree, TierLegend } from '../organogram/OrganogramTree';

interface OrganogramModalProps {
  onClose: () => void;
}

export function OrganogramModal({ onClose }: OrganogramModalProps) {
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
      aria-label="Municipal Organogram"
    >
      <div
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--radius-lg)',
          maxWidth: '95vw',
          width: '95vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 'var(--space-md) var(--space-lg)',
            borderBottom: '1px solid var(--glass-border)',
            flexShrink: 0,
          }}
        >
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Municipal Organogram
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-sm)',
              flexShrink: 0,
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
        </div>

        {/* Tier Legend */}
        <div style={{ flexShrink: 0, borderBottom: '1px solid var(--glass-border)' }}>
          <TierLegend />
        </div>

        {/* Organogram Tree */}
        <div data-lenis-prevent style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <OrganogramTree />
        </div>
      </div>
    </div>
  );
}
