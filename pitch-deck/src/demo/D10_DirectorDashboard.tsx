import { AbsoluteFill } from "remotion";
import { DemoBackground } from "../components/DemoBackground";
import { SectionTitle } from "../components/SectionTitle";
import { AnimatedText } from "../components/AnimatedText";
import { TierBadge } from "../components/TierBadge";
import { DashboardMockup } from "../components/DashboardMockup";
import { FeatureGrid } from "../components/FeatureGrid";
import { TrafficLightBar } from "../components/TrafficLightBar";
import { GlassCard } from "../components/GlassCard";
import { colors } from "../design/tokens";
import { fontFamily } from "../design/fonts";

const directorMetrics = [
  { label: "KPIs On Track", value: "12/18", color: "#22c55e" },
  { label: "At Risk", value: "4", color: "#f59e0b" },
  { label: "Behind", value: "2", color: "#ef4444" },
  { label: "Team Size", value: "24", color: colors.teal },
];

const directorFeatures = [
  { icon: "\u{1F6A6}", title: "Traffic Light KPIs", description: "Green/amber/red status for all KPIs", color: "#22c55e" },
  { icon: "\u{1F4DD}", title: "Activity Feed", description: "Recent updates from team members", color: colors.teal },
  { icon: "\u{1F4CE}", title: "Evidence Upload", description: "Attach documents to KPI evidence", color: colors.gold },
  { icon: "\u{1F465}", title: "Team Members", description: "View & manage department team", color: colors.coral },
  { icon: "\u{1F4CA}", title: "Performance Agreement", description: "Track individual PA progress", color: colors.rose.primary },
  { icon: "\u{1F514}", title: "Deadline Alerts", description: "Upcoming KPI due dates", color: "#ef4444" },
];

export const D10_DirectorDashboard: React.FC = () => {
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
          <SectionTitle number="10" title="Section 56 Director" color={colors.gold} delay={0} />
          <TierBadge tier={1} label="Executive" color={colors.gold} delay={10} />
        </div>

        <AnimatedText
          text="Director's Department View"
          fontSize={38}
          fontFamily={fontFamily.display}
          delay={8}
          textAlign="center"
        />

        <div style={{ display: "flex", gap: 28, flex: 1 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
            <DashboardMockup
              title="Department KPIs"
              metrics={directorMetrics}
              delay={15}
              accentColor="#22c55e"
            />
            <GlassCard delay={35} style={{ padding: 20 }}>
              <div style={{ fontFamily: fontFamily.display, fontSize: 17, fontWeight: 600, color: colors.text.primary, marginBottom: 12 }}>
                KPI Status Distribution
              </div>
              <TrafficLightBar green={12} amber={4} red={2} delay={40} />
            </GlassCard>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <FeatureGrid items={directorFeatures} columns={2} delay={25} stagger={8} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
