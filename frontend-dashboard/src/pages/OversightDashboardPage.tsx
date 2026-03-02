/**
 * OversightDashboardPage — stub.
 * Full implementation in Plan 31-03 (audit committee, internal auditor, MPAC, councillor).
 */

interface OversightDashboardPageProps {
  role: string;
}

export function OversightDashboardPage({ role }: OversightDashboardPageProps) {
  return (
    <div style={{ padding: 'var(--space-2xl)', color: 'var(--text-secondary)' }}>
      Oversight Dashboard ({role}) — loading...
    </div>
  );
}
