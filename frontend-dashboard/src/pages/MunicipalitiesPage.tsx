/**
 * MunicipalitiesPage — SALGA Admin municipality registry.
 *
 * Extracted from inline placeholder in App.tsx. Shows onboarded municipalities
 * with realistic mock data. Full CRUD implementation deferred to Phase 32+.
 *
 * Header uses usePageHeader with coral "Onboard Municipality" CTA button.
 */

import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '../hooks/usePageHeader';
import { useMemo } from 'react';

const municipalities = [
  { name: 'eThekwini Metropolitan', province: 'KwaZulu-Natal', category: 'A', status: 'Active', population: '3.9M' },
  { name: 'City of Tshwane', province: 'Gauteng', category: 'A', status: 'Active', population: '3.3M' },
  { name: 'Mangaung Metropolitan', province: 'Free State', category: 'A', status: 'Active', population: '787K' },
  { name: 'Nelson Mandela Bay', province: 'Eastern Cape', category: 'A', status: 'Active', population: '1.3M' },
  { name: 'Buffalo City Metropolitan', province: 'Eastern Cape', category: 'A', status: 'Active', population: '834K' },
  { name: 'Sol Plaatje Local', province: 'Northern Cape', category: 'B', status: 'Onboarding', population: '255K' },
];

export function MunicipalitiesPage() {
  const navigate = useNavigate();

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
              <tr key={i} style={{
                borderBottom: '1px solid var(--glass-border)',
                cursor: 'pointer',
              }}>
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
    </div>
  );
}
