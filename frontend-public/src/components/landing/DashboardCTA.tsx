import { Link } from 'react-router-dom';
import { Button } from '@shared/components/ui/Button';
import { GlassCard } from '@shared/components/ui/GlassCard';

export function DashboardCTA() {
  return (
    <section className="dashboard-cta-section">
      <GlassCard variant="elevated">
        <div className="dashboard-cta-content">
          <h2 className="dashboard-cta-title">
            Ready to see how your municipality performs?
          </h2>
          <p className="dashboard-cta-subtitle">
            Explore real-time performance data, service delivery metrics, and transparency statistics
            for municipalities across South Africa.
          </p>
          <Link to="/dashboard">
            <Button variant="primary" size="lg">
              View Dashboard
            </Button>
          </Link>
        </div>
      </GlassCard>
    </section>
  );
}
