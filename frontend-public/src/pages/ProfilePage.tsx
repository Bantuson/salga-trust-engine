import { GlassCard } from '@shared/components/ui/GlassCard';

/**
 * Citizen profile page - placeholder until Plan 07 implementation
 * Protected route - requires citizen authentication
 */
export function ProfilePage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', paddingTop: '100px' }}>
      <GlassCard>
        <h1>My Profile</h1>
        <p>Profile page coming soon...</p>
      </GlassCard>
    </div>
  );
}
