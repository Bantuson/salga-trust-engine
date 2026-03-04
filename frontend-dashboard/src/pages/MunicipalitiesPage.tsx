/**
 * MunicipalitiesPage — SALGA Admin municipality registry.
 *
 * Extracted from inline placeholder in App.tsx. Shows onboarded municipalities
 * with realistic mock data. Full CRUD implementation deferred to Phase 32+.
 *
 * Header uses usePageHeader with coral "Onboard Municipality" CTA button.
 * Clicking a row opens an inline detail modal (glass-pink-frost pattern).
 */

import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '../hooks/usePageHeader';
import { useState, useMemo, useEffect } from 'react';

interface Municipality {
  name: string;
  province: string;
  category: string;
  status: string;
  population: string;
}

const municipalities: Municipality[] = [
  { name: 'eThekwini Metropolitan', province: 'KwaZulu-Natal', category: 'A', status: 'Active', population: '3.9M' },
  { name: 'City of Tshwane', province: 'Gauteng', category: 'A', status: 'Active', population: '3.3M' },
  { name: 'Mangaung Metropolitan', province: 'Free State', category: 'A', status: 'Active', population: '787K' },
  { name: 'Nelson Mandela Bay', province: 'Eastern Cape', category: 'A', status: 'Active', population: '1.3M' },
  { name: 'Buffalo City Metropolitan', province: 'Eastern Cape', category: 'A', status: 'Active', population: '834K' },
  { name: 'Sol Plaatje Local', province: 'Northern Cape', category: 'B', status: 'Onboarding', population: '255K' },
];

// ---------------------------------------------------------------------------
// Inline Modal Styles (follows MunicipalityDetailModal pattern exactly)
// ---------------------------------------------------------------------------

const modalStyles = {
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
    maxWidth: '640px',
    width: '100%',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden' as const,
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
    flexDirection: 'column' as const,
    gap: '0.5rem',
  } as React.CSSProperties,
  headerTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
    lineHeight: 1.3,
  } as React.CSSProperties,
  badgeRow: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'var(--text-secondary)',
    fontSize: '0.75rem',
    fontWeight: 500,
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
    marginLeft: '1rem',
  } as React.CSSProperties,
  body: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: 'var(--glass-card-padding)',
  } as React.CSSProperties,
  section: {
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--glass-card-padding)',
    marginBottom: 'var(--space-lg)',
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginTop: 0,
    marginBottom: 'var(--space-md)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  } as React.CSSProperties,
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.35rem 0',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  } as React.CSSProperties,
  detailLabel: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
  } as React.CSSProperties,
  detailValue: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  } as React.CSSProperties,
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 'var(--glass-card-padding)',
    borderTop: '1px solid var(--glass-border)',
    position: 'sticky' as const,
    bottom: 0,
    background: 'var(--glass-pink-frost)',
    backdropFilter: 'blur(var(--glass-blur-medium))',
    WebkitBackdropFilter: 'blur(var(--glass-blur-medium))',
  } as React.CSSProperties,
  closeFooterButton: {
    background: 'var(--color-teal)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    padding: '0.5rem 1.5rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.875rem',
  } as React.CSSProperties,
};

export function MunicipalitiesPage() {
  const navigate = useNavigate();
  const [selectedMunicipality, setSelectedMunicipality] = useState<Municipality | null>(null);

  const headerAction = useMemo(() => (
    <button
      onClick={() => navigate('/onboarding')}
      style={{
        background: 'var(--color-coral)',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        color: 'white',
        fontWeight: 600,
        cursor: 'pointer',
        padding: '6px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      Onboard Municipality
    </button>
  ), [navigate]);

  usePageHeader('Municipalities', headerAction);

  // Body scroll lock while modal is open
  useEffect(() => {
    if (!selectedMunicipality) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [selectedMunicipality]);

  // Close on Escape
  useEffect(() => {
    if (!selectedMunicipality) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedMunicipality(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedMunicipality]);

  return (
    <div style={{ padding: 'var(--space-lg)' }}>
      <div style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
              {['Municipality', 'Province', 'Category', 'Status', 'Population'].map(h => (
                <th key={h} style={{
                  padding: 'var(--space-sm) var(--space-md)',
                  textAlign: 'left' as const,
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.05em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {municipalities.map((m, i) => (
              <tr
                key={i}
                style={{
                  borderBottom: '1px solid var(--glass-border)',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onClick={() => setSelectedMunicipality(m)}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <td style={{ padding: 'var(--space-sm) var(--space-md)', fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</td>
                <td style={{ padding: 'var(--space-sm) var(--space-md)', color: 'var(--text-secondary)' }}>{m.province}</td>
                <td style={{ padding: 'var(--space-sm) var(--space-md)', color: 'var(--text-secondary)' }}>{m.category}</td>
                <td style={{ padding: 'var(--space-sm) var(--space-md)' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 10px',
                    borderRadius: '12px',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                    background: m.status === 'Active' ? 'rgba(45, 212, 191, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                    color: m.status === 'Active' ? 'var(--color-teal)' : 'var(--color-gold)',
                    border: `1px solid ${m.status === 'Active' ? 'rgba(45, 212, 191, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`,
                  }}>{m.status}</span>
                </td>
                <td style={{ padding: 'var(--space-sm) var(--space-md)', color: 'var(--text-secondary)' }}>{m.population}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 'var(--space-md)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
        Showing {municipalities.length} onboarded municipalities. Full management interface available in a future release.
      </p>

      {/* Municipality Detail Modal */}
      {selectedMunicipality && (
        <div
          style={modalStyles.overlay}
          onClick={() => setSelectedMunicipality(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedMunicipality.name} detail`}
        >
          <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={modalStyles.header}>
              <div style={modalStyles.headerLeft}>
                <h2 style={modalStyles.headerTitle}>{selectedMunicipality.name}</h2>
                <div style={modalStyles.badgeRow}>
                  <span style={modalStyles.badge}>Category {selectedMunicipality.category}</span>
                  <span style={modalStyles.badge}>{selectedMunicipality.province}</span>
                </div>
              </div>
              <button
                style={modalStyles.closeButton}
                onClick={() => setSelectedMunicipality(null)}
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div style={modalStyles.body}>
              {/* Overview section */}
              <div style={modalStyles.section}>
                <h3 style={modalStyles.sectionTitle}>Overview</h3>
                <div style={modalStyles.detailRow}>
                  <span style={modalStyles.detailLabel}>Status</span>
                  <span style={modalStyles.detailValue}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      background: selectedMunicipality.status === 'Active' ? 'rgba(45, 212, 191, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                      color: selectedMunicipality.status === 'Active' ? 'var(--color-teal)' : 'var(--color-gold)',
                      border: `1px solid ${selectedMunicipality.status === 'Active' ? 'rgba(45, 212, 191, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`,
                    }}>
                      {selectedMunicipality.status}
                    </span>
                  </span>
                </div>
                <div style={modalStyles.detailRow}>
                  <span style={modalStyles.detailLabel}>Population</span>
                  <span style={modalStyles.detailValue}>{selectedMunicipality.population}</span>
                </div>
                <div style={modalStyles.detailRow}>
                  <span style={modalStyles.detailLabel}>Category</span>
                  <span style={modalStyles.detailValue}>{selectedMunicipality.category}</span>
                </div>
                <div style={modalStyles.detailRow}>
                  <span style={modalStyles.detailLabel}>Province</span>
                  <span style={modalStyles.detailValue}>{selectedMunicipality.province}</span>
                </div>
              </div>

              {/* Onboarding Status section */}
              <div style={modalStyles.section}>
                <h3 style={modalStyles.sectionTitle}>Onboarding Status</h3>
                {selectedMunicipality.status === 'Active' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-teal)' }}>
                      Fully Onboarded
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {['Departments Setup', 'Leaders Assigned', 'PMS Gate'].map((step) => (
                      <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0' }}>
                        <span style={{
                          display: 'inline-block',
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: 'var(--color-gold)',
                          flexShrink: 0,
                        }} />
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{step}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>Pending</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                <button
                  disabled
                  style={{
                    padding: '0.5rem 1.25rem',
                    background: 'var(--color-teal)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    fontFamily: 'inherit',
                    cursor: 'not-allowed',
                    opacity: 0.5,
                  }}
                >
                  View Performance
                </button>
                <button
                  disabled
                  style={{
                    padding: '0.5rem 1.25rem',
                    background: 'transparent',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    fontFamily: 'inherit',
                    cursor: 'not-allowed',
                    opacity: 0.5,
                  }}
                >
                  Manage Departments
                </button>
              </div>
            </div>

            {/* Footer */}
            <div style={modalStyles.footer}>
              <button
                type="button"
                style={modalStyles.closeFooterButton}
                onClick={() => setSelectedMunicipality(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
