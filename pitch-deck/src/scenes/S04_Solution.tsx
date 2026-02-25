import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { Background } from "../components/Background";
import { GlassCard } from "../components/GlassCard";
import { AnimatedText } from "../components/AnimatedText";
import { colors, glass } from "../design/tokens";
import { fontFamily } from "../design/fonts";

const pillars = [
  { icon: "💬", label: "Report", sublabel: "via WhatsApp", color: colors.teal },
  { icon: "📊", label: "Manage", sublabel: "Operations Dashboard", color: colors.rose.primary },
  { icon: "👁️", label: "See Results", sublabel: "Public Transparency", color: colors.gold },
];

export const S04_Solution: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 48,
          gap: 40,
        }}
      >
        <AnimatedText
          text="Our Solution"
          fontSize={52}
          fontFamily={fontFamily.display}
          color={colors.teal}
          delay={0}
        />

        <GlassCard
          elevated
          delay={10}
          style={{
            width: "100%",
            padding: 36,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <p
            style={{
              fontFamily: fontFamily.body,
              fontSize: 24,
              color: colors.text.primary,
              textAlign: "center",
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            A unified platform where citizens report issues,
            AI agents triage and route them, municipalities resolve
            them, and the public sees the results.
          </p>
        </GlassCard>

        <div
          style={{
            display: "flex",
            gap: 20,
            width: "100%",
            justifyContent: "center",
          }}
        >
          {pillars.map((pillar, i) => {
            const entrance = spring({
              frame,
              fps,
              delay: 30 + i * 12,
              config: { damping: 200 },
            });
            const y = interpolate(entrance, [0, 1], [40, 0]);

            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                  opacity: entrance,
                  transform: `translateY(${y}px)`,
                }}
              >
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 20,
                    background: glass.bg,
                    backdropFilter: `blur(${glass.blur}px)`,
                    border: `1px solid ${glass.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 36,
                  }}
                >
                  {pillar.icon}
                </div>
                <span
                  style={{
                    fontFamily: fontFamily.display,
                    fontSize: 22,
                    fontWeight: 600,
                    color: pillar.color,
                  }}
                >
                  {pillar.label}
                </span>
                <span
                  style={{
                    fontFamily: fontFamily.body,
                    fontSize: 14,
                    color: colors.text.secondary,
                    textAlign: "center",
                  }}
                >
                  {pillar.sublabel}
                </span>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
