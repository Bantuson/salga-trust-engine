import { AbsoluteFill } from "remotion";
import { DemoBackground } from "../components/DemoBackground";
import { SectionTitle } from "../components/SectionTitle";
import { AnimatedText } from "../components/AnimatedText";
import { TierBadge } from "../components/TierBadge";
import { DashboardMockup } from "../components/DashboardMockup";
import { FeatureGrid } from "../components/FeatureGrid";
import { colors } from "../design/tokens";
import { fontFamily } from "../design/fonts";

const cfoMetrics = [
  { label: "Budget Execution", value: "67%", color: colors.gold },
  { label: "Revenue Collection", value: "R2.1B", color: colors.teal },
  { label: "Risk Score", value: "Medium", color: colors.coral },
  { label: "Audit Status", value: "Clean", color: "#22c55e" },
];

const cfoFeatures = [
  { icon: "\u{1F4B0}", title: "Budget Execution", description: "Track spending vs allocation per dept", color: colors.gold },
  { icon: "\u26A0\uFE0F", title: "Risk Register", description: "Financial & operational risk matrix", color: colors.coral },
  { icon: "\u{1F4C5}", title: "Statutory Calendar", description: "MFMA compliance deadlines", color: colors.teal },
  { icon: "\u{1F4C8}", title: "Revenue Tracking", description: "Collection rates & billing efficiency", color: "#22c55e" },
  { icon: "\u{1F517}", title: "Service Correlation", description: "Budget-to-service delivery linkage", color: colors.rose.primary },
  { icon: "\u{1F4CA}", title: "Quarterly Reports", description: "Section 71/72 report generation", color: colors.gold },
];

export const D07_CFODashboard: React.FC = () => {
  return (
    <AbsoluteFill>
      <DemoBackground />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "50px 80px",
          gap: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <SectionTitle number="07" title="CFO Dashboard" color={colors.gold} delay={0} />
          <TierBadge tier={1} label="Executive" color={colors.gold} delay={10} />
        </div>

        <AnimatedText
          text="Chief Financial Officer View"
          fontSize={40}
          fontFamily={fontFamily.display}
          delay={8}
          textAlign="center"
        />

        <div style={{ display: "flex", gap: 28, flex: 1 }}>
          <div style={{ flex: 1 }}>
            <DashboardMockup
              title="Financial Overview"
              metrics={cfoMetrics}
              delay={15}
              accentColor={colors.gold}
            />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <FeatureGrid items={cfoFeatures} columns={2} delay={25} stagger={8} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
