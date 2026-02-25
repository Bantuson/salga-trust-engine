import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { Background } from "../components/Background";
import { GlassCard } from "../components/GlassCard";
import { colors, glow } from "../design/tokens";
import { fontFamily } from "../design/fonts";

export const S12_CallToAction: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleEntrance = spring({
    frame,
    fps,
    delay: 5,
    config: { damping: 200 },
  });

  const subtitleOpacity = spring({
    frame,
    fps,
    delay: 25,
    config: { damping: 200 },
  });

  // Breathing glow pulse
  const pulse = Math.sin(frame * 0.08) * 0.5 + 0.5;
  const glowIntensity = interpolate(pulse, [0, 1], [0.3, 1]);
  const glowScale = interpolate(pulse, [0, 1], [0.98, 1.02]);

  const titleY = interpolate(titleEntrance, [0, 1], [40, 0]);

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
        }}
      >
        <GlassCard
          elevated
          delay={0}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 32,
            padding: 56,
            boxShadow: `0 0 ${60 * glowIntensity}px rgba(255,213,79,${0.2 * glowIntensity}), 0 0 ${120 * glowIntensity}px rgba(0,191,165,${0.1 * glowIntensity})`,
            transform: `scale(${glowScale})`,
          }}
        >
          <div
            style={{
              opacity: titleEntrance,
              transform: `translateY(${titleY}px)`,
            }}
          >
            <h1
              style={{
                fontFamily: fontFamily.display,
                fontSize: 56,
                fontWeight: 700,
                textAlign: "center",
                lineHeight: 1.2,
                background: `linear-gradient(135deg, ${colors.gold}, ${colors.teal})`,
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                margin: 0,
              }}
            >
              Let's Rebuild
              <br />
              Trust Together
            </h1>
          </div>

          <div style={{ opacity: subtitleOpacity }}>
            <p
              style={{
                fontFamily: fontFamily.display,
                fontSize: 28,
                color: colors.text.secondary,
                textAlign: "center",
                margin: 0,
              }}
            >
              SALGA Trust Engine
            </p>
          </div>

          <div
            style={{
              opacity: subtitleOpacity,
              width: 80,
              height: 3,
              background: `linear-gradient(90deg, ${colors.gold}, ${colors.teal})`,
              borderRadius: 2,
              marginTop: 8,
            }}
          />

          <div style={{ opacity: subtitleOpacity }}>
            <p
              style={{
                fontFamily: fontFamily.body,
                fontSize: 20,
                color: colors.text.secondary,
                textAlign: "center",
                margin: 0,
                opacity: 0.7,
              }}
            >
              Northern Cape Pilot • 2026
            </p>
          </div>
        </GlassCard>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
