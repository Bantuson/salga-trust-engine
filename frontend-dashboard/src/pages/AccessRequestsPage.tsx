/**
 * AccessRequestsPage — SALGA Admin page to review municipality access requests.
 *
 * Mock data with filter bar (Status, Province), table with actions.
 * "Approve & Onboard" navigates to /onboarding with prefill state.
 * Clicking a row opens an inline detail modal (glass-pink-frost pattern).
 * Styling: glass card pattern, CSS variables only (no Tailwind).
 */

import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '../hooks/usePageHeader';
import { Select } from '@shared/components/ui/Select';

// ---------------------------------------------------------------------------
// Types & Mock Data
// ---------------------------------------------------------------------------

interface AccessRequest {
  id: string;
  municipalityName: string;
  demarcationCode: string;
  province: string;
  category: string;
  contactName: string;
  contactEmail: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
}

const MOCK_REQUESTS: AccessRequest[] = [
  {
    id: 'ar-1',
    municipalityName: 'Drakenstein',
    demarcationCode: 'WC023',
    province: 'Western Cape',
    category: 'B',
    contactName: 'Johan van Wyk',
    contactEmail: 'jvanwyk@drakenstein.gov.za',
    date: '2026-02-25',
    status: 'pending',
  },
  {
    id: 'ar-2',
    municipalityName: 'Emfuleni',
    demarcationCode: 'GT421',
    province: 'Gauteng',
    category: 'B',
    contactName: 'Lerato Molefe',
    contactEmail: 'lmolefe@emfuleni.gov.za',
    date: '2026-02-20',
    status: 'pending',
  },
  {
    id: 'ar-3',
    municipalityName: 'Mossel Bay',
    demarcationCode: 'WC043',
    province: 'Western Cape',
    category: 'B',
    contactName: 'Anele Nkosi',
    contactEmail: 'ankosi@mosselbaymun.gov.za',
    date: '2026-02-10',
    status: 'approved',
  },
];

const PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
  'Western Cape',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: 'pending' | 'approved' | 'rejected' }) {
  const config = {
    pending: {
      bg: 'rgba(251, 191, 36, 0.12)',
      border: 'rgba(251, 191, 36, 0.3)',
      color: 'var(--color-gold)',
      label: 'Pending',
    },
    approved: {
      bg: 'rgba(45, 212, 191, 0.12)',
      border: 'rgba(45, 212, 191, 0.3)',
      color: 'var(--color-teal)',
      label: 'Approved',
    },
    rejected: {
      bg: 'rgba(255, 107, 74, 0.12)',
      border: 'rgba(255, 107, 74, 0.3)',
      color: 'var(--color-coral)',
      label: 'Rejected',
    },
  }[status];

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: '12px',
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        background: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {config.label}
    </span>
  );
}

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
    gap: 'var(--space-sm)',
    padding: 'var(--glass-card-padding)',
    borderTop: '1px solid var(--glass-border)',
    position: 'sticky' as const,
    bottom: 0,
    background: 'var(--glass-pink-frost)',
    backdropFilter: 'blur(var(--glass-blur-medium))',
    WebkitBackdropFilter: 'blur(var(--glass-blur-medium))',
  } as React.CSSProperties,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AccessRequestsPage() {
  const navigate = useNavigate();

  usePageHeader('Access Requests');

  // Filters
  const [filterStatus, setFilterStatus] = useState<'' | 'pending' | 'approved' | 'rejected'>('');
  const [filterProvince, setFilterProvince] = useState('');

  // Local state for optimistic status updates
  const [requests, setRequests] = useState<AccessRequest[]>(MOCK_REQUESTS);

  // Modal state
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterProvince && r.province !== filterProvince) return false;
      return true;
    });
  }, [requests, filterStatus, filterProvince]);

  const hasActiveFilters = filterStatus || filterProvince;

  const handleClearFilters = () => {
    setFilterStatus('');
    setFilterProvince('');
  };

  const handleApproveAndOnboard = (req: AccessRequest) => {
    navigate('/onboarding', {
      state: {
        prefill: {
          municipalityName: req.municipalityName,
          demarcationCode: req.demarcationCode,
          mmEmail: req.contactEmail,
          province: req.province,
          category: req.category,
        },
      },
    });
  };

  const handleReject = (id: string) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'rejected' as const } : r))
    );
  };

  // Body scroll lock while modal is open
  useEffect(() => {
    if (!selectedRequest) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [selectedRequest]);

  // Close on Escape
  useEffect(() => {
    if (!selectedRequest) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedRequest(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedRequest]);

  // Keep modal in sync with state changes (e.g. after reject)
  useEffect(() => {
    if (!selectedRequest) return;
    const updated = requests.find((r) => r.id === selectedRequest.id);
    if (updated && updated.status !== selectedRequest.status) {
      setSelectedRequest(updated);
    }
  }, [requests, selectedRequest]);

  return (
    <div style={{ padding: 'var(--space-lg)', maxWidth: '1200px' }}>
      {/* Mock data warning banner */}
      <div
        style={{
          background: 'rgba(251, 191, 36, 0.1)',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-sm) var(--space-md)',
          marginBottom: 'var(--space-lg)',
          color: 'var(--color-gold)',
          fontSize: 'var(--text-sm)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
        }}
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span>
          <strong>Demo mode</strong> — Displaying sample access requests. Live data will appear when the access request API is available.
        </span>
      </div>

      {/* Filter bar */}
      <div
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '12px',
          padding: 'var(--space-md)',
          marginBottom: 'var(--space-lg)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-sm)',
          alignItems: 'flex-end',
        }}
      >
        {/* Status filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '140px', flex: '1 1 140px' }}>
          <label style={filterLabelStyle}>Status</label>
          <Select
            value={filterStatus}
            onChange={(value) => setFilterStatus(value as '' | 'pending' | 'approved' | 'rejected')}
            options={[
              { value: '', label: 'All' },
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
            ]}
            size="md"
          />
        </div>

        {/* Province filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px', flex: '1 1 180px' }}>
          <label style={filterLabelStyle}>Province</label>
          <Select
            value={filterProvince}
            onChange={(value) => setFilterProvince(value)}
            options={[
              { value: '', label: 'All Provinces' },
              ...PROVINCES.map((p) => ({ value: p, label: p })),
            ]}
            size="md"
          />
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            style={{
              alignSelf: 'flex-end',
              padding: '0.4rem 1rem',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)',
              fontSize: 'var(--text-sm)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Results count */}
      <div style={{ marginBottom: 'var(--space-sm)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
        {filtered.length} request{filtered.length !== 1 ? 's' : ''}{hasActiveFilters ? ' (filtered)' : ''}
      </div>

      {/* Table */}
      <div
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
                {['Municipality', 'Demarcation Code', 'Province', 'Category', 'Contact', 'Date', 'Status', 'Actions'].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        padding: 'var(--space-sm) var(--space-md)',
                        textAlign: 'left' as const,
                        fontSize: 'var(--text-xs)',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase' as const,
                        letterSpacing: '0.05em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      padding: 'var(--space-2xl)',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                    }}
                  >
                    No requests match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((req) => (
                  <tr
                    key={req.id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.08)',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                    onClick={() => setSelectedRequest(req)}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <td style={{ padding: 'var(--space-sm) var(--space-md)', fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                      {req.municipalityName}
                    </td>
                    <td style={{ padding: 'var(--space-sm) var(--space-md)', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', fontFamily: 'monospace' }}>
                      {req.demarcationCode}
                    </td>
                    <td style={{ padding: 'var(--space-sm) var(--space-md)', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                      {req.province}
                    </td>
                    <td style={{ padding: 'var(--space-sm) var(--space-md)', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                      {req.category}
                    </td>
                    <td style={{ padding: 'var(--space-sm) var(--space-md)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                        {req.contactName}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                        {req.contactEmail}
                      </div>
                    </td>
                    <td style={{ padding: 'var(--space-sm) var(--space-md)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', whiteSpace: 'nowrap' }}>
                      {req.date}
                    </td>
                    <td style={{ padding: 'var(--space-sm) var(--space-md)' }}>
                      <StatusBadge status={req.status} />
                    </td>
                    <td style={{ padding: 'var(--space-sm) var(--space-md)' }}>
                      {req.status === 'pending' ? (
                        <div
                          style={{ display: 'flex', gap: 'var(--space-xs)' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleApproveAndOnboard(req)}
                            style={{
                              padding: '3px 12px',
                              background: 'rgba(45, 212, 191, 0.12)',
                              border: '1px solid rgba(45, 212, 191, 0.3)',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--color-teal)',
                              fontSize: 'var(--text-xs)',
                              fontWeight: 600,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Approve & Onboard
                          </button>
                          <button
                            onClick={() => handleReject(req.id)}
                            style={{
                              padding: '3px 12px',
                              background: 'transparent',
                              border: '1px solid rgba(255, 107, 74, 0.3)',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--color-coral)',
                              fontSize: 'var(--text-xs)',
                              fontWeight: 600,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Access Request Detail Modal */}
      {selectedRequest && (
        <div
          style={modalStyles.overlay}
          onClick={() => setSelectedRequest(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedRequest.municipalityName} access request detail`}
        >
          <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={modalStyles.header}>
              <div style={modalStyles.headerLeft}>
                <h2 style={modalStyles.headerTitle}>{selectedRequest.municipalityName}</h2>
                <div style={{ marginTop: '0.25rem' }}>
                  <StatusBadge status={selectedRequest.status} />
                </div>
              </div>
              <button
                style={modalStyles.closeButton}
                onClick={() => setSelectedRequest(null)}
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
              {/* Request Details */}
              <div style={modalStyles.section}>
                <h3 style={modalStyles.sectionTitle}>Request Details</h3>
                <div style={modalStyles.detailRow}>
                  <span style={modalStyles.detailLabel}>Municipality Name</span>
                  <span style={modalStyles.detailValue}>{selectedRequest.municipalityName}</span>
                </div>
                <div style={modalStyles.detailRow}>
                  <span style={modalStyles.detailLabel}>Demarcation Code</span>
                  <span style={{ ...modalStyles.detailValue, fontFamily: 'monospace' }}>{selectedRequest.demarcationCode}</span>
                </div>
                <div style={modalStyles.detailRow}>
                  <span style={modalStyles.detailLabel}>Province</span>
                  <span style={modalStyles.detailValue}>{selectedRequest.province}</span>
                </div>
                <div style={modalStyles.detailRow}>
                  <span style={modalStyles.detailLabel}>Category</span>
                  <span style={modalStyles.detailValue}>{selectedRequest.category}</span>
                </div>
                <div style={modalStyles.detailRow}>
                  <span style={modalStyles.detailLabel}>Submitted Date</span>
                  <span style={modalStyles.detailValue}>{selectedRequest.date}</span>
                </div>
              </div>

              {/* Contact Information */}
              <div style={modalStyles.section}>
                <h3 style={modalStyles.sectionTitle}>Contact Information</h3>
                <div style={modalStyles.detailRow}>
                  <span style={modalStyles.detailLabel}>Contact Name</span>
                  <span style={modalStyles.detailValue}>{selectedRequest.contactName}</span>
                </div>
                <div style={modalStyles.detailRow}>
                  <span style={modalStyles.detailLabel}>Contact Email</span>
                  <span style={modalStyles.detailValue}>{selectedRequest.contactEmail}</span>
                </div>
              </div>

              {/* Status */}
              <div style={modalStyles.section}>
                <h3 style={modalStyles.sectionTitle}>Status</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.35rem 0' }}>
                  <StatusBadge status={selectedRequest.status} />
                  {(selectedRequest.status === 'approved' || selectedRequest.status === 'rejected') && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No decision history available in demo mode
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={modalStyles.footer}>
              {selectedRequest.status === 'pending' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      handleApproveAndOnboard(selectedRequest);
                      setSelectedRequest(null);
                    }}
                    style={{
                      background: 'var(--color-teal)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.5rem 1.25rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: '0.875rem',
                    }}
                  >
                    Approve & Onboard
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleReject(selectedRequest.id);
                      setSelectedRequest(null);
                    }}
                    style={{
                      background: 'transparent',
                      color: 'var(--color-coral)',
                      border: '1px solid var(--color-coral)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.5rem 1.25rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: '0.875rem',
                    }}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRequest(null)}
                    style={{
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.5rem 1.25rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: '0.875rem',
                    }}
                  >
                    Close
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setSelectedRequest(null)}
                  style={{
                    background: 'var(--color-teal)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.5rem 1.5rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '0.875rem',
                  }}
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter styles
// ---------------------------------------------------------------------------

const filterLabelStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 500,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

