import { HeroSection } from '../components/landing/HeroSection';
import { ProblemSection } from '../components/landing/ProblemSection';
import { SolutionSection } from '../components/landing/SolutionSection';
import { FeaturesSection } from '../components/landing/FeaturesSection';
import { LiveStatsSection } from '../components/landing/LiveStatsSection';
import { MunicipalityShowcase } from '../components/landing/MunicipalityShowcase';
import { DashboardPreview } from '../components/landing/DashboardPreview';
import { DashboardCTA } from '../components/landing/DashboardCTA';

export function LandingPage() {
  return (
    <main className="landing-page">
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <FeaturesSection />
      <LiveStatsSection />
      <MunicipalityShowcase />
      <DashboardPreview />
      <DashboardCTA />
    </main>
  );
}
