/**
 * ReviewDetailModal — Performance review detail with historical ratings.
 *
 * Shows full review + all reviews for the same member (sparkline-style list).
 * Glassmorphic overlay, Escape/overlay close, max-width 520px.
 */

import { useEffect } from 'react';
import type { TeamReview } from '../../types/teams';

interface ReviewDetailModalProps {
  review: TeamReview;
  /** All reviews — filtered internally to show history for the same member */
  allReviews: TeamReview[];
  onClose: () => void;
}

export function ReviewDetailModal({ review, allReviews, onClose }: ReviewDetailModalProps) {
  // Body scroll lock
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, []);

  // Keyboard close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const reviewDate = new Date(review.review_date).toLocaleDateString('en-ZA', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  // Historical reviews for this member, sorted newest first
  const memberHistory = allReviews
    .filter((r) => r.member_id === review.member_id)
    .sort((a, b) => new Date(b.review_date).getTime() - new Date(a.review_date).getTime());

  return (
    <div style={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label={`Review for ${review.member_name}`}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button style={styles.closeButton} onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Header */}
        <div style={styles.headerSection}>
          <h2 style={styles.memberName}>{review.member_name}</h2>
          <span style={styles.date}>{reviewDate}</span>
        </div>

        {/* Full rating */}
        <div style={styles.ratingSection}>
          <div style={styles.stars}>
            {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
          </div>
          <span style={styles.ratingNumber}>{review.rating}/5</span>
        </div>

        {/* Comments */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Review Comments</h3>
          <p style={styles.comments}>{review.comments}</p>
        </div>

        {/* Reviewer */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Reviewer</h3>
          <div style={styles.fieldRow}>
            <span style={styles.fieldLabel}>Reviewed by</span>
            <span style={styles.fieldValue}>{review.reviewer_name}</span>
          </div>
        </div>

        {/* Historical ratings */}
        {memberHistory.length > 1 && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Rating History</h3>
            {memberHistory.map((r) => {
              const histDate = new Date(r.review_date).toLocaleDateString('en-ZA', {
                year: 'numeric', month: 'short', day: 'numeric',
              });
              const isCurrent = r.id === review.id;
              return (
                <div key={r.id} style={{
                  ...styles.historyRow,
                  background: isCurrent ? 'rgba(0,191,165,0.08)' : 'transparent',
                  borderRadius: 'var(--radius-sm)',
                }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', minWidth: '100px' }}>
                    {histDate}
                  </span>
                  <div style={styles.historyBar}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        style={{
                          display: 'inline-block',
                          width: '20px',
                          height: '8px',
                          borderRadius: '2px',
                          background: star <= r.rating ? '#FBBF24' : 'rgba(255,255,255,0.1)',
                          marginRight: '2px',
                        }}
                      />
                    ))}
                  </div>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.875rem', minWidth: '24px', textAlign: 'right' as const }}>
                    {r.rating}
                  </span>
                  {isCurrent && <span style={styles.currentBadge}>current</span>}
                </div>
              );
            })}
          </div>
        )}
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
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  } as React.CSSProperties,
  modal: {
    background: 'var(--glass-pink-frost)',
    backdropFilter: 'blur(var(--glass-blur-medium))',
    WebkitBackdropFilter: 'blur(var(--glass-blur-medium))',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-xl)',
    maxWidth: '520px',
    width: '100%',
    maxHeight: '85vh',
    overflowY: 'auto' as const,
    padding: 'var(--glass-card-padding)',
    position: 'relative' as const,
  } as React.CSSProperties,
  closeButton: {
    position: 'absolute' as const,
    top: '1rem',
    right: '1rem',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-sm)',
  } as React.CSSProperties,
  headerSection: {
    marginBottom: '1rem',
    paddingTop: '0.25rem',
  } as React.CSSProperties,
  memberName: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
  } as React.CSSProperties,
  date: {
    color: 'var(--text-muted)',
    fontSize: '0.875rem',
  } as React.CSSProperties,
  ratingSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1.25rem',
  } as React.CSSProperties,
  stars: {
    fontSize: '1.5rem',
    color: '#FBBF24',
    letterSpacing: '2px',
  } as React.CSSProperties,
  ratingNumber: {
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
  } as React.CSSProperties,
  section: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 'var(--radius-lg)',
    padding: '1rem',
    marginBottom: '0.75rem',
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    margin: '0 0 0.75rem 0',
  } as React.CSSProperties,
  comments: {
    color: 'var(--text-primary)',
    fontSize: '0.9375rem',
    lineHeight: 1.6,
    margin: 0,
  } as React.CSSProperties,
  fieldRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.4rem 0',
  } as React.CSSProperties,
  fieldLabel: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  } as React.CSSProperties,
  fieldValue: {
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    fontWeight: 500,
  } as React.CSSProperties,
  historyRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.5rem 0.5rem',
  } as React.CSSProperties,
  historyBar: {
    display: 'flex',
    alignItems: 'center',
    flex: 1,
  } as React.CSSProperties,
  currentBadge: {
    fontSize: '0.65rem',
    fontWeight: 600,
    color: 'var(--color-teal)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  } as React.CSSProperties,
};
