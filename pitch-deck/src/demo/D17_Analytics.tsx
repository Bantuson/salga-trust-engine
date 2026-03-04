import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { DemoBackground } from "../components/DemoBackground";
import { SectionTitle } from "../components/SectionTitle";
import { AnimatedText } from "../components/AnimatedText";
import { GlassCard } from "../components/GlassCard";
import { DashboardMockup } from "../components/DashboardMockup";
import { FeatureGrid } from "../components/FeatureGrid";
import { StatCounter } from "../components/StatCounter";
import { colors } from "../design/tokens";
import { fontFamily } from "../design/fonts";

const analyticsMetrics = [
  { label: "Active KPIs", value: "156", color: colors.teal },
  { label: "Completion Rate", value: "73%", color: colors.gold },
  { label: "Teams Tracked", value: "18", color: colors.coral },
  { label: "Reports Generated", value: "42", color: "#22c55e" },
];

const analyticsFeatures = [
  { icon: "📈", title: "KPI Sparklines", description: "Mini trend charts for each indicator", color: colors.teal },
  { icon: "🏆", title: "Team Leaderboard", description: "Ranked team performance scores", color: colors.gold },
  { icon: "📊", title: "Category Comparison", description: "Side-by-side KPA analysis", color: colors.coral },
  { icon: "📥", title: "CSV Export", description: "Download filtered data sets", color: "#22c55e" },
  { icon: "🔄", title: "Real-Time Refresh", description: "Live data with 30s intervals", color: "#3b82f6" },
  { icon: "📅", title: "Period Filters", description: "Monthly, quarterly, annual views", color: colors.rose.primary },
];

export const D17_Analytics: React.FC = () => {
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
        <SectionTitle number="17" title="Analytics & Insights" color={colors.teal} delay={0} />

        <AnimatedText
          text="Data-Driven Decision Making"
          fontSize={40}
          fontFamily={fontFamily.display}
          delay={8}
          textAlign="center"
        />

        <div style={{ display: "flex", gap: 28, flex: 1 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
            <DashboardMockup
              title="Analytics Overview"
              metrics={analyticsMetrics}
              delay={15}
              accentColor={colors.teal}
            />
            <div style={{ display: "flex", justifyContent: "center", gap: 40 }}>
              <StatCounter value={156} label="KPIs Tracked" color={colors.gold} delay={45} fontSize={38} />
              <StatCounter value={73} suffix="%" label="On Target" color={colors.teal} delay={48} fontSize={38} />
              <StatCounter value={42} label="Reports" color={colors.coral} delay={51} fontSize={38} />
            </div>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <FeatureGrid items={analyticsFeatures} columns={2} delay={25} stagger={8} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
