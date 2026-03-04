import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { DemoBackground } from "../components/DemoBackground";
import { SectionTitle } from "../components/SectionTitle";
import { AnimatedText } from "../components/AnimatedText";
import { WizardSteps } from "../components/WizardSteps";
import { GlassCard } from "../components/GlassCard";
import { FeatureGrid } from "../components/FeatureGrid";
import { colors } from "../design/tokens";
import { fontFamily } from "../design/fonts";

const wizardStepNames = [
  "Province", "District", "Municipality", "Logo Upload",
  "Contact Info", "Departments", "Teams", "Roles", "Review",
];

const onboardingFeatures = [
  { icon: "🏛️", title: "Self-Service Setup", description: "Municipality configures itself in minutes", color: colors.teal },
  { icon: "✅", title: "Guided Validation", description: "Each step validated before proceeding", color: "#22c55e" },
  { icon: "👤", title: "Role Assignment", description: "Assign staff to 6 system roles", color: colors.gold },
  { icon: "📋", title: "Department Config", description: "Activate departments per municipality", color: colors.coral },
  { icon: "🔒", title: "Tenant Isolation", description: "Automatic multi-tenant setup on complete", color: colors.rose.primary },
  { icon: "📊", title: "Instant Dashboard", description: "Dashboards available immediately after setup", color: colors.teal },
];

export const D03_Onboarding: React.FC = () => {
  return (
    <AbsoluteFill>
      <DemoBackground />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "50px 80px",
          gap: 32,
        }}
      >
        <SectionTitle number="03" title="Onboarding & Setup" color={colors.teal} delay={0} />

        <AnimatedText
          text="9-Step Municipality Onboarding"
          fontSize={40}
          fontFamily={fontFamily.display}
          delay={8}
          textAlign="center"
        />

        <GlassCard delay={12} style={{ padding: "28px 40px" }}>
          <WizardSteps steps={wizardStepNames} delay={18} stagger={8} />
        </GlassCard>

        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <FeatureGrid items={onboardingFeatures} columns={3} delay={50} stagger={8} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
