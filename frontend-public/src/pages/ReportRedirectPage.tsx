import { GlassCard } from '@shared/components/ui/GlassCard';
import { Button } from '@shared/components/ui/Button';

export function ReportRedirectPage() {
  // TODO: Replace with actual municipal dashboard URL from environment variable
  const municipalDashboardUrl = import.meta.env.VITE_MUNICIPAL_DASHBOARD_URL || 'http://localhost:5174';

  return (
    <div className="report-redirect-page">
      <div className="report-redirect-content">
        <GlassCard variant="elevated">
          <div className="report-redirect-inner">
            <div className="report-icon">📝</div>
            <h1 className="report-title">Report a Municipal Issue</h1>
            <p className="report-description">
              To report an issue, please sign in to the municipal dashboard. You'll need a verified account
              linked to your municipality.
            </p>

            <div className="report-cta-buttons">
              <Button
                variant="primary"
                size="lg"
                onClick={() => window.location.href = municipalDashboardUrl}
              >
                Sign In
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => window.location.href = `${municipalDashboardUrl}#register`}
              >
                Register
              </Button>
            </div>

            <div className="report-info-box">
              <h3>Don't have an account?</h3>
              <p>
                To register, you'll need:
              </p>
              <ul>
                <li>A valid South African phone number</li>
                <li>Proof of residence document (utility bill, lease agreement, or rates notice)</li>
                <li>Your municipality's invitation code (if applicable)</li>
              </ul>
              <p className="report-note">
                Your information is verified to ensure reports are linked to the correct municipality.
                All data is POPIA compliant and securely stored.
              </p>
            </div>

            <div className="report-alternative">
              <h3>Alternative Reporting Methods</h3>
              <p>
                You can also report issues via WhatsApp once you have an account. After registration, you'll
                receive instructions for WhatsApp reporting.
              </p>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
