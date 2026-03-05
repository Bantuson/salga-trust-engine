import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { DemoBackground } from "../components/DemoBackground";
import { SectionTitle } from "../components/SectionTitle";
import { AnimatedText } from "../components/AnimatedText";
import { TierBadge } from "../components/TierBadge";
import { GlassCard } from "../components/GlassCard";
import { FeatureGrid } from "../components/FeatureGrid";
import { StatCounter } from "../components/StatCounter";
import { colors, glass } from "../design/tokens";
import { fontFamily } from "../design/fonts";

const municipalities = [
  { name: "Sol Plaatje", score: 92, tier: "A" },
  { name: "Dawid Kruiper", score: 85, tier: "B+" },
  { name: "Emthanjeni", score: 74, tier: "B" },
  { name: "Kareeberg", score: 68, tier: "C+" },
  { name: "Ubuntu", score: 55, tier: "C" },
];

const salgaFeatures = [
  { icon: "\u{1F3C6}", title: "Municipality Ranking", description: "Performance leaderboard across all municipalities", color: colors.gold },
  { icon: "\u{1F4CA}", title: "Benchmarking", description: "Compare KPIs between municipalities", color: colors.teal },
  { icon: "\u{1F4E5}", title: "CSV Export", description: "Download data for external reporting", color: colors.coral },
  { icon: "\u2705", title: "Pending Approvals", description: "Review municipality onboarding requests", color: "#22c55e" },
  { icon: "\u{1F514}", title: "Alert Dashboard", description: "SLA breach notifications across system", color: "#ef4444" },
  { icon: "\u{1F4CB}", title: "Compliance Tracking", description: "Monitor statutory compliance per municipality", color: colors.rose.primary },
];

export const D09_SALGAAdmin: React.FC = () => {
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
          <SectionTitle number="09" title="SALGA Admin" color={colors.coral} delay={0} />
          <TierBadge tier={2} label="Oversight" color={colors.coral} delay={10} />
        </div>

        <AnimatedText
          text="Cross-Municipality Administration"
          fontSize={38}
          fontFamily={fontFamily.display}
          delay={8}
          textAlign="center"
        />

        <div style={{ display: "flex", gap: 28 }}>
          {/* Left: Municipality ranking */}
          <GlassCard delay={15} style={{ flex: 1, padding: 24 }}>
            <div style={{ fontFamily: fontFamily.display, fontSize: 16, fontWeight: 600, color: colors.text.primary, marginBottom: 16 }}>
              Municipality Rankings
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {municipalities.map((muni, i) => {
                const entrance = spring({ frame, fps, delay: 20 + i * 8, config: { damping: 200 } });
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, opacity: entrance, padding: "8px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 10 }}>
                    <span style={{ fontFamily: fontFamily.display, fontSize: 22, fontWeight: 700, color: colors.gold, width: 32 }}>
                      #{i + 1}
                    </span>
                    <span style={{ fontFamily: fontFamily.body, fontSize: 17, color: colors.text.primary, flex: 1 }}>
                      {muni.name}
                    </span>
                    <span style={{ fontFamily: fontFamily.display, fontSize: 17, fontWeight: 700, color: colors.teal }}>
                      {muni.score}%
                    </span>
                    <div style={{ background: `${colors.gold}22`, border: `1px solid ${colors.gold}44`, borderRadius: 6, padding: "2px 8px", fontFamily: fontFamily.display, fontSize: 15, fontWeight: 700, color: colors.gold }}>
                      {muni.tier}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: 40, marginTop: 20 }}>
              <StatCounter value={5} label="Municipalities" color={colors.gold} delay={55} fontSize={36} />
              <StatCounter value={78} suffix="%" label="Avg Score" color={colors.teal} delay={60} fontSize={36} />
            </div>
          </GlassCard>

          {/* Right: Features */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <FeatureGrid items={salgaFeatures} columns={2} delay={30} stagger={8} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
