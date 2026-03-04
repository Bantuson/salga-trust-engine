import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { DemoBackground } from "../components/DemoBackground";
import { SectionTitle } from "../components/SectionTitle";
import { AnimatedText } from "../components/AnimatedText";
import { TierBadge } from "../components/TierBadge";
import { DashboardMockup } from "../components/DashboardMockup";
import { FeatureGrid } from "../components/FeatureGrid";
import { GlassCard } from "../components/GlassCard";
import { colors } from "../design/tokens";
import { fontFamily } from "../design/fonts";

const mayorMetrics = [
  { label: "SDBIP Progress", value: "78%", color: colors.gold },
  { label: "KPI Achievement", value: "82%", color: colors.teal },
  { label: "Pending Approvals", value: "5", color: colors.coral },
  { label: "Org Score", value: "B+", color: "#22c55e" },
];

const mayorFeatures = [
  { icon: "📋", title: "SDBIP Approval", description: "Review & approve municipal delivery plans", color: colors.gold },
  { icon: "🏆", title: "Org Scorecard", description: "Overall municipal performance grade", color: colors.teal },
  { icon: "📊", title: "KPI Distribution", description: "Track KPIs across all departments", color: colors.coral },
  { icon: "✅", title: "Approval Workflow", description: "Digital signature for statutory docs", color: "#22c55e" },
  { icon: "📅", title: "Statutory Calendar", description: "Key compliance deadlines & events", color: colors.rose.primary },
  { icon: "🔔", title: "Alert System", description: "Notifications on breaches & milestones", color: "#ef4444" },
];

export const D06_MayorDashboard: React.FC = () => {
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
          <SectionTitle number="06" title="Executive Mayor" color={colors.gold} delay={0} />
          <TierBadge tier={1} label="Executive" color={colors.gold} delay={10} />
        </div>

        <AnimatedText
          text="Mayor's Strategic Dashboard"
          fontSize={40}
          fontFamily={fontFamily.display}
          delay={8}
          textAlign="center"
        />

        <div style={{ display: "flex", gap: 28, flex: 1 }}>
          <div style={{ flex: 1 }}>
            <DashboardMockup
              title="Executive Overview"
              metrics={mayorMetrics}
              delay={15}
              accentColor={colors.gold}
            />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <FeatureGrid items={mayorFeatures} columns={2} delay={25} stagger={8} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
