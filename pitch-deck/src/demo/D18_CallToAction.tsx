import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { DemoBackground } from "../components/DemoBackground";
import { GlassCard } from "../components/GlassCard";
import { StatCounter } from "../components/StatCounter";
import { AnimatedText } from "../components/AnimatedText";
import { colors, glow } from "../design/tokens";
import { fontFamily } from "../design/fonts";

const differentiators = [
  "AI-Powered Triage & Routing",
  "GBV 5-Layer Safety Firewall",
  "Full PMS Integration (IDP → SDBIP → KPI)",
  "POPIA Compliant from Day One",
  "Trilingual Support (EN/ZU/AF)",
  "Real-Time Public Transparency",
];

export const D18_CallToAction: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const ctaEntrance = spring({ frame, fps, delay: 55, config: { damping: 200 } });
  const ctaY = interpolate(ctaEntrance, [0, 1], [20, 0]);

  return (
    <AbsoluteFill>
      <DemoBackground />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 80px",
          gap: 48,
        }}
      >
        {/* Gradient title — rendered directly because backgroundClip:text must be on the text element */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 20, lineHeight: 1.2 }}>
          {["SALGA", "Trust", "Engine"].map((word, i) => {
            const wordSpring = spring({ frame, fps, delay: i * 4, config: { damping: 200 } });
            const translateY = interpolate(wordSpring, [0, 1], [30, 0]);
            return (
              <span
                key={i}
                style={{
                  fontFamily: fontFamily.display,
                  fontSize: 80,
                  fontWeight: 700,
                  display: "inline-block",
                  opacity: wordSpring,
                  transform: `translateY(${translateY}px)`,
                  background: `linear-gradient(135deg, ${colors.gold}, ${colors.teal})`,
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {word}
              </span>
            );
          })}
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 80 }}>
          <StatCounter value={18} label="Dashboard Views" color={colors.gold} delay={15} fontSize={64} />
          <StatCounter value={6} label="Role Tiers" color={colors.teal} delay={18} fontSize={64} />
          <StatCounter value={5} label="Safety Layers" color={colors.rose.primary} delay={21} fontSize={64} />
          <StatCounter value={156} label="KPI Indicators" color={colors.coral} delay={24} fontSize={64} />
        </div>

        {/* Differentiators */}
        <GlassCard elevated delay={28} style={{ padding: "40px 64px", maxWidth: 1400 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, width: "100%" }}>
            {differentiators.map((item, i) => {
              const entrance = spring({ frame, fps, delay: 35 + i * 5, config: { damping: 200 } });
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, opacity: entrance }}>
                  <div style={{ width: 10, height: 10, borderRadius: 5, background: colors.teal }} />
                  <span style={{ fontFamily: fontFamily.body, fontSize: 22, color: colors.text.primary }}>
                    {item}
                  </span>
                </div>
              );
            })}
          </div>
        </GlassCard>

        {/* CTA Button */}
        <div
          style={{
            opacity: ctaEntrance,
            transform: `translateY(${ctaY}px)`,
          }}
        >
          <div
            style={{
              background: `linear-gradient(135deg, ${colors.gold}, ${colors.teal})`,
              borderRadius: 24,
              padding: "22px 64px",
              boxShadow: glow.gold,
            }}
          >
            <span
              style={{
                fontFamily: fontFamily.display,
                fontSize: 32,
                fontWeight: 700,
                color: colors.dark,
              }}
            >
              Request a Demo
            </span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
