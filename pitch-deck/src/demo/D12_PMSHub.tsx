import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { DemoBackground } from "../components/DemoBackground";
import { SectionTitle } from "../components/SectionTitle";
import { AnimatedText } from "../components/AnimatedText";
import { GlassCard } from "../components/GlassCard";
import { StatCounter } from "../components/StatCounter";
import { colors, glass } from "../design/tokens";
import { fontFamily } from "../design/fonts";

const pmsViews = [
  { icon: "\u{1F4CB}", title: "IDP", subtitle: "Integrated Development Plan", color: colors.gold },
  { icon: "\u{1F4CA}", title: "SDBIP", subtitle: "Service Delivery & Budget", color: colors.teal },
  { icon: "\u{1F517}", title: "Golden Thread", subtitle: "KPA \u2192 Goal \u2192 Objective \u2192 KPI", color: colors.coral },
  { icon: "\u{1F4DD}", title: "Performance Agreements", subtitle: "Section 57 Staff PAs", color: colors.rose.primary },
  { icon: "\u{1F4D1}", title: "Statutory Reports", subtitle: "Section 46/71/72 Reports", color: "#22c55e" },
  { icon: "\u2699\uFE0F", title: "Setup", subtitle: "Financial Year & KPA Config", color: colors.text.secondary },
];

export const D12_PMSHub: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const footerEntrance = spring({ frame, fps, delay: 70, config: { damping: 200 } });

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
        <SectionTitle number="12" title="Performance Management" color={colors.teal} delay={0} />

        <AnimatedText
          text="PMS Hub — 6 Integrated Views"
          fontSize={40}
          fontFamily={fontFamily.display}
          delay={8}
          textAlign="center"
        />

        {/* 6 view cards in 3x2 grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, flex: 1 }}>
          {pmsViews.map((view, i) => {
            const entrance = spring({ frame, fps, delay: 18 + i * 8, config: { damping: 200 } });
            const translateY = interpolate(entrance, [0, 1], [25, 0]);
            return (
              <div
                key={i}
                style={{
                  background: glass.bg,
                  backdropFilter: `blur(${glass.blur}px)`,
                  border: `1px solid ${glass.border}`,
                  borderRadius: 20,
                  padding: "40px 32px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 20,
                  opacity: entrance,
                  transform: `translateY(${translateY}px)`,
                }}
              >
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 20,
                    background: `${view.color}18`,
                    border: `1px solid ${view.color}33`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 40,
                  }}
                >
                  {view.icon}
                </div>
                <span style={{ fontFamily: fontFamily.display, fontSize: 28, fontWeight: 700, color: view.color }}>
                  {view.title}
                </span>
                <span style={{ fontFamily: fontFamily.body, fontSize: 19, color: colors.text.secondary, textAlign: "center", lineHeight: 1.3 }}>
                  {view.subtitle}
                </span>
              </div>
            );
          })}
        </div>

        {/* Stats footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 60,
            opacity: footerEntrance,
          }}
        >
          <StatCounter value={5} label="National KPAs" color={colors.gold} delay={75} fontSize={38} />
          <StatCounter value={28} label="Strategic Goals" color={colors.teal} delay={78} fontSize={38} />
          <StatCounter value={156} label="KPI Indicators" color={colors.coral} delay={81} fontSize={38} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
