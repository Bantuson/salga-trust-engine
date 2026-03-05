import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { DemoBackground } from "../components/DemoBackground";
import { SectionTitle } from "../components/SectionTitle";
import { AnimatedText } from "../components/AnimatedText";
import { TierBadge } from "../components/TierBadge";
import { GlassCard } from "../components/GlassCard";
import { FeatureGrid } from "../components/FeatureGrid";
import { TrafficLightBar } from "../components/TrafficLightBar";
import { colors, glass } from "../design/tokens";
import { fontFamily } from "../design/fonts";

const departments = [
  { name: "Planning & Dev", score: 45, color: "#ef4444" },
  { name: "Financial Services", score: 62, color: "#f59e0b" },
  { name: "Community Services", score: 78, color: colors.teal },
  { name: "Infrastructure", score: 85, color: "#22c55e" },
  { name: "Corporate Services", score: 91, color: "#22c55e" },
];

const mmFeatures = [
  { icon: "\u{1F4CA}", title: "Worst-First Sorting", description: "Underperformers shown at top", color: "#ef4444" },
  { icon: "\u{1F50D}", title: "Drill-Down", description: "Click department \u2192 KPI breakdown", color: colors.teal },
  { icon: "\u26A0\uFE0F", title: "Risk Register", description: "Organizational risk matrix view", color: colors.coral },
  { icon: "\u{1F4C8}", title: "Trend Analysis", description: "Quarter-over-quarter comparison", color: colors.gold },
];

export const D08_MMDashboard: React.FC = () => {
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
          gap: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <SectionTitle number="08" title="Municipal Manager" color={colors.gold} delay={0} />
          <TierBadge tier={1} label="Executive" color={colors.gold} delay={10} />
        </div>

        <AnimatedText
          text="Municipal Manager Performance View"
          fontSize={38}
          fontFamily={fontFamily.display}
          delay={8}
          textAlign="center"
        />

        <div style={{ display: "flex", gap: 28 }}>
          {/* Left: Department table */}
          <GlassCard delay={15} style={{ flex: 1.2, padding: 24 }}>
            <div style={{ fontFamily: fontFamily.display, fontSize: 16, fontWeight: 600, color: colors.text.primary, marginBottom: 16 }}>
              Department Performance (Worst First)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {departments.map((dept, i) => {
                const entrance = spring({ frame, fps, delay: 20 + i * 8, config: { damping: 200 } });
                const barWidth = interpolate(entrance, [0, 1], [0, dept.score]);
                return (
                  <div key={i} style={{ opacity: entrance, display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontFamily: fontFamily.body, fontSize: 16, color: colors.text.secondary, width: 160, flexShrink: 0 }}>
                      {dept.name}
                    </span>
                    <div style={{ flex: 1, height: 28, background: "rgba(255,255,255,0.06)", borderRadius: 14, overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${barWidth}%`,
                          height: "100%",
                          background: `linear-gradient(90deg, ${dept.color}, ${dept.color}88)`,
                          borderRadius: 14,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          paddingRight: 8,
                        }}
                      >
                        <span style={{ fontFamily: fontFamily.display, fontSize: 14, fontWeight: 700, color: "#fff" }}>
                          {dept.score}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 16 }}>
              <TrafficLightBar green={2} amber={1} red={2} delay={60} height={24} labels={{ green: "Good", amber: "At Risk", red: "Critical" }} />
            </div>
          </GlassCard>

          {/* Right: Features */}
          <div style={{ flex: 0.8, display: "flex", flexDirection: "column" }}>
            <FeatureGrid items={mmFeatures} columns={2} delay={30} stagger={10} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
