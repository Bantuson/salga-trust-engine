import { HeroSection } from '../components/landing/HeroSection';
import { ProblemSection } from '../components/landing/ProblemSection';
import { FeaturesSection } from '../components/landing/FeaturesSection';
import { DashboardCTA } from '../components/landing/DashboardCTA';

export function LandingPage() {
  return (
    <main className="landing-page">
      <HeroSection />
      <ProblemSection />
      <FeaturesSection />
      <DashboardCTA />
    </main>
  );
}
