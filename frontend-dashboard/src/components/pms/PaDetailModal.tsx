/**
 * PaDetailModal — Read-only detail view for a Performance Agreement.
 *
 * Thin wrapper around PmsDetailModal that maps a PA object to title + rows.
 *
 * Styling: CSS variables only (Phase 27-03 CSS lock — no Tailwind).
 */

import { PmsDetailModal } from './PmsDetailModal';

interface PaDetailModalProps {
  agreement: {
    id: string;
    financial_year: string;
    manager_name: string;
    manager_role: string;
    status: string;
    annual_score: number | null;
    kpi_count: number;
  };
  onClose: () => void;
}

const statusColors: Record<string, string> = {
  draft: 'var(--color-gold)',
  signed: 'var(--color-teal)',
  under_review: 'var(--color-coral)',
  assessed: '#4caf7d',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  signed: 'Signed',
  under_review: 'Under Review',
  assessed: 'Assessed',
};

const managerRoleLabels: Record<string, string> = {
  section57_director: 'Section 57 Director',
  municipal_manager: 'Municipal Manager',
};

export function PaDetailModal({ agreement, onClose }: PaDetailModalProps) {
  const statusColor = statusColors[agreement.status] || 'var(--text-secondary)';

  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: 'Role',
      value: managerRoleLabels[agreement.manager_role] || agreement.manager_role,
    },
    {
      label: 'Financial Year',
      value: agreement.financial_year,
    },
    {
      label: 'Status',
      value: (
        <span
          style={{
            display: 'inline-block',
            padding: '2px 10px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: statusColor,
            background: `${statusColor}22`,
            border: `1px solid ${statusColor}66`,
          }}
        >
          {statusLabels[agreement.status] || agreement.status}
        </span>
      ),
    },
    {
      label: 'KPI Count',
      value: `${agreement.kpi_count} KPI${agreement.kpi_count !== 1 ? 's' : ''}`,
    },
  ];

  if (agreement.annual_score !== null) {
    rows.push({
      label: 'Annual Score',
      value: (
        <span style={{ color: '#4caf7d', fontWeight: 700 }}>
          {agreement.annual_score.toFixed(1)}%
        </span>
      ),
    });
  }

  return (
    <PmsDetailModal
      title={agreement.manager_name}
      rows={rows}
      onClose={onClose}
    />
  );
}
