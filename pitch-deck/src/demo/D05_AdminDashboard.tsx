import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { DemoBackground } from "../components/DemoBackground";
import { SectionTitle } from "../components/SectionTitle";
import { AnimatedText } from "../components/AnimatedText";
import { DashboardMockup } from "../components/DashboardMockup";
import { GlassCard } from "../components/GlassCard";
import { StatCounter } from "../components/StatCounter";
import { FeatureGrid } from "../components/FeatureGrid";
import { colors } from "../design/tokens";
import { fontFamily } from "../design/fonts";

const adminMetrics = [
  { label: "Open Tickets", value: "247", color: colors.coral },
  { label: "SLA Compliance", value: "94%", color: colors.teal },
  { label: "Resolved Today", value: "38", color: "#22c55e" },
  { label: "Avg Response", value: "2.4h", color: colors.gold },
];

const adminFeatures = [
  { icon: "🎫", title: "Ticket Overview", description: "Real-time ticket status & assignment", color: colors.coral },
  { icon: "⏱️", title: "SLA Monitoring", description: "Circular gauge with breach alerts", color: colors.teal },
  { icon: "📈", title: "Category Analysis", description: "Ticket distribution by service type", color: colors.gold },
  { icon: "🔴", title: "Live Indicator", description: "Real-time data refresh every 30s", color: "#ef4444" },
  { icon: "👥", title: "Team Assignment", description: "Route tickets to teams & agents", color: colors.rose.primary },
  { icon: "📋", title: "Bulk Actions", description: "Multi-select, reassign, close tickets", color: "#22c55e" },
];

export const D05_AdminDashboard: React.FC = () => {
  return (
    <AbsoluteFill>
      <DemoBackground />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "50px 80px",
          gap: 28,
        }}
      >
        <SectionTitle number="05" title="Role-Specific Dashboards" color={colors.rose.primary} delay={0} />

        <AnimatedText
          text="Admin Operations Dashboard"
          fontSize={40}
          fontFamily={fontFamily.display}
          delay={8}
          textAlign="center"
        />

        <div style={{ display: "flex", gap: 28, flex: 1 }}>
          {/* Left: Dashboard mockup */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
            <DashboardMockup
              title="Operations Overview"
              metrics={adminMetrics}
              delay={15}
              accentColor={colors.coral}
            />
            <div style={{ display: "flex", justifyContent: "center", gap: 40 }}>
              <StatCounter value={1247} label="Total Tickets" color={colors.gold} delay={40} fontSize={42} />
              <StatCounter value={94} suffix="%" label="SLA Rate" color={colors.teal} delay={45} fontSize={42} />
              <StatCounter value={6} label="Active Teams" color={colors.coral} delay={50} fontSize={42} />
            </div>
          </div>

          {/* Right: Feature grid */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <FeatureGrid items={adminFeatures} columns={2} delay={25} stagger={8} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
