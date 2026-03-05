import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { DemoBackground } from "../components/DemoBackground";
import { SectionTitle } from "../components/SectionTitle";
import { AnimatedText } from "../components/AnimatedText";
import { GlassCard } from "../components/GlassCard";
import { colors, glass } from "../design/tokens";
import { fontFamily } from "../design/fonts";

const kpaColors = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#8b5cf6"];

const threadLevels = [
  { level: 0, label: "National KPA", items: ["Basic Service Delivery", "Good Governance", "Financial Viability", "Institutional Development", "Local Economic Development"], colors: kpaColors },
  { level: 1, label: "Strategic Goals", example: "Ensure reliable water supply to all households" },
  { level: 2, label: "Objectives", example: "Reduce water loss to below 25% by 2027" },
  { level: 3, label: "KPI Indicators", example: "% water loss reduction (quarterly)" },
];

export const D13_GoldenThread: React.FC = () => {
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
        <SectionTitle number="13" title="Golden Thread" color={colors.gold} delay={0} />

        <AnimatedText
          text="KPA → Goal → Objective → KPI"
          fontSize={40}
          fontFamily={fontFamily.display}
          delay={8}
          textAlign="center"
        />

        <div style={{ display: "flex", gap: 28 }}>
          {/* Left: Hierarchy visualization */}
          <GlassCard delay={15} style={{ flex: 1.2, padding: 28 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* KPA level - show all 5 */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontFamily: fontFamily.display, fontSize: 13, fontWeight: 600, color: colors.text.secondary, marginBottom: 10, letterSpacing: 1 }}>
                  NATIONAL KPAs
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {threadLevels[0].items!.map((kpa, i) => {
                    const entrance = spring({ frame, fps, delay: 20 + i * 6, config: { damping: 200 } });
                    return (
                      <div
                        key={i}
                        style={{
                          background: `${kpaColors[i]}18`,
                          border: `1px solid ${kpaColors[i]}44`,
                          borderRadius: 10,
                          padding: "8px 18px",
                          fontFamily: fontFamily.body,
                          fontSize: 15,
                          color: kpaColors[i],
                          opacity: entrance,
                          transform: `scale(${interpolate(entrance, [0, 1], [0.8, 1])})`,
                        }}
                      >
                        {kpa}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Lower levels - indented */}
              {threadLevels.slice(1).map((level, i) => {
                const entrance = spring({ frame, fps, delay: 50 + i * 12, config: { damping: 200 } });
                const indent = (i + 1) * 32;
                return (
                  <div key={i} style={{ marginLeft: indent, opacity: entrance }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 20, height: 2, background: `${colors.gold}44` }} />
                      <span style={{ fontFamily: fontFamily.display, fontSize: 16, fontWeight: 600, color: colors.gold }}>
                        {level.label}
                      </span>
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        marginLeft: 30,
                        padding: "8px 14px",
                        background: "rgba(255,255,255,0.04)",
                        borderRadius: 8,
                        borderLeft: `2px solid ${colors.gold}44`,
                        fontFamily: fontFamily.body,
                        fontSize: 15,
                        color: colors.text.secondary,
                        fontStyle: "italic",
                      }}
                    >
                      e.g. "{level.example}"
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* Right: Feature explanation */}
          <GlassCard delay={25} style={{ flex: 0.8, padding: 28 }}>
            <div style={{ fontFamily: fontFamily.display, fontSize: 22, fontWeight: 600, color: colors.gold, marginBottom: 16 }}>
              Why Golden Thread?
            </div>
            {[
              "Traces every KPI back to national policy",
              "Ensures alignment from IDP to SDBIP",
              "5 color-coded KPA categories",
              "Drill-down from KPA to individual KPIs",
              "Automated scoring & progress tracking",
              "Visual hierarchy tree navigation",
            ].map((item, i) => {
              const entrance = spring({ frame, fps, delay: 40 + i * 8, config: { damping: 200 } });
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, opacity: entrance }}>
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: kpaColors[i % 5] }} />
                  <span style={{ fontFamily: fontFamily.body, fontSize: 17, color: colors.text.primary }}>
                    {item}
                  </span>
                </div>
              );
            })}
          </GlassCard>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
