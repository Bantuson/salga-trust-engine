import { GlassCard } from '@shared/components/ui/GlassCard';

/**
 * Report issue page - placeholder until Plan 06 implementation
 * Protected route - requires citizen authentication
 */
export function ReportIssuePage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', paddingTop: '100px' }}>
      <GlassCard>
        <h1>Report an Issue</h1>
        <p>Report form coming soon...</p>
      </GlassCard>
    </div>
  );
}
