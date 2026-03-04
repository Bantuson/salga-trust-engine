import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { DemoBackground } from "../components/DemoBackground";
import { SectionTitle } from "../components/SectionTitle";
import { AnimatedText } from "../components/AnimatedText";
import { GlassCard } from "../components/GlassCard";
import { StatCounter } from "../components/StatCounter";
import { FeatureGrid } from "../components/FeatureGrid";
import { colors, glass } from "../design/tokens";
import { fontFamily } from "../design/fonts";

const leaderboardData = [
  { name: "Sol Plaatje", score: 92, trend: "+3" },
  { name: "Dawid Kruiper", score: 85, trend: "+1" },
  { name: "Emthanjeni", score: 74, trend: "-2" },
  { name: "Kareeberg", score: 68, trend: "+5" },
];

const publicFeatures = [
  { icon: "🏆", title: "Leaderboard", description: "Ranked municipality performance", color: colors.gold },
  { icon: "📊", title: "SDBIP Gauges", description: "Radial progress for each KPA", color: colors.teal },
  { icon: "📈", title: "Service Stats", description: "Ticket resolution & SLA metrics", color: colors.coral },
  { icon: "🗺️", title: "Interactive Map", description: "Geographic service delivery view", color: "#3b82f6" },
  { icon: "📅", title: "Quarterly Updates", description: "Historical performance tracking", color: colors.rose.primary },
  { icon: "🔓", title: "Open Data", description: "Anonymized performance data", color: "#22c55e" },
];

export const D15_PublicTransparency: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

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
        <SectionTitle number="15" title="Public Transparency" color="#22c55e" delay={0} />

        <AnimatedText
          text="Public Performance Dashboard"
          fontSize={40}
          fontFamily={fontFamily.display}
          delay={8}
          textAlign="center"
        />

        <div style={{ display: "flex", gap: 28, flex: 1 }}>
          {/* Left: Leaderboard + stats */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
            <GlassCard delay={15} style={{ padding: 24 }}>
              <div style={{ fontFamily: fontFamily.display, fontSize: 20, fontWeight: 600, color: colors.text.primary, marginBottom: 14 }}>
                Municipality Leaderboard
              </div>
              {leaderboardData.map((muni, i) => {
                const entrance = spring({ frame, fps, delay: 20 + i * 8, config: { damping: 200 } });
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, opacity: entrance, padding: "8px 0", borderBottom: i < leaderboardData.length - 1 ? `1px solid ${glass.borderLight}` : "none" }}>
                    <span style={{ fontFamily: fontFamily.display, fontSize: 24, fontWeight: 700, color: i === 0 ? colors.gold : colors.text.secondary, width: 32 }}>
                      #{i + 1}
                    </span>
                    <span style={{ fontFamily: fontFamily.body, fontSize: 18, color: colors.text.primary, flex: 1 }}>
                      {muni.name}
                    </span>
                    <span style={{ fontFamily: fontFamily.display, fontSize: 20, fontWeight: 700, color: colors.teal }}>
                      {muni.score}%
                    </span>
                    <span style={{ fontFamily: fontFamily.body, fontSize: 15, color: muni.trend.startsWith("+") ? "#22c55e" : "#ef4444" }}>
                      {muni.trend}
                    </span>
                  </div>
                );
              })}
            </GlassCard>

            <div style={{ display: "flex", justifyContent: "center", gap: 40 }}>
              <StatCounter value={78} suffix="%" label="Avg SDBIP" color={colors.teal} delay={55} fontSize={40} />
              <StatCounter value={94} suffix="%" label="SLA Rate" color={colors.gold} delay={58} fontSize={40} />
              <StatCounter value={4} label="Municipalities" color={colors.coral} delay={61} fontSize={40} />
            </div>
          </div>

          {/* Right: Features */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <FeatureGrid items={publicFeatures} columns={2} delay={30} stagger={8} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
