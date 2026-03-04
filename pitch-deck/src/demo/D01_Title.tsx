import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { DemoBackground } from "../components/DemoBackground";
import { GlassCard } from "../components/GlassCard";
import { colors } from "../design/tokens";
import { fontFamily } from "../design/fonts";

const TITLE_WORDS = ["SALGA", "Trust", "Engine"];

export const D01_Title: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const subtitleOpacity = spring({ frame, fps, delay: 30, config: { damping: 200 } });
  const taglineOpacity = spring({ frame, fps, delay: 45, config: { damping: 200 } });
  const badgeOpacity = spring({ frame, fps, delay: 60, config: { damping: 200 } });
  const taglineY = interpolate(taglineOpacity, [0, 1], [20, 0]);
  const badgeY = interpolate(badgeOpacity, [0, 1], [15, 0]);

  return (
    <AbsoluteFill>
      <DemoBackground />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 80,
        }}
      >
        <GlassCard
          elevated
          delay={0}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 36,
            padding: "64px 100px",
            maxWidth: 1200,
          }}
        >
          {/* Gradient title */}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 20, lineHeight: 1.2 }}>
            {TITLE_WORDS.map((word, i) => {
              const wordSpring = spring({ frame, fps, delay: 8 + i * 5, config: { damping: 200 } });
              const translateY = interpolate(wordSpring, [0, 1], [30, 0]);
              return (
                <span
                  key={i}
                  style={{
                    fontFamily: fontFamily.display,
                    fontSize: 96,
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

          {/* Platform Demo subtitle */}
          <div style={{ opacity: subtitleOpacity }}>
            <span
              style={{
                fontFamily: fontFamily.display,
                fontSize: 42,
                fontWeight: 600,
                color: colors.text.primary,
                letterSpacing: 4,
                textTransform: "uppercase",
              }}
            >
              Platform Demo
            </span>
          </div>

          {/* Tagline */}
          <div style={{ opacity: taglineOpacity, transform: `translateY(${taglineY}px)` }}>
            <p
              style={{
                fontFamily: fontFamily.body,
                fontSize: 28,
                color: colors.text.secondary,
                textAlign: "center",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              AI-Powered Municipal Service Management
            </p>
          </div>

          {/* Badges */}
          <div
            style={{
              display: "flex",
              gap: 16,
              opacity: badgeOpacity,
              transform: `translateY(${badgeY}px)`,
            }}
          >
            {[
              { text: "v1.0", color: colors.teal },
              { text: "2026", color: colors.gold },
              { text: "South Africa", color: colors.rose.primary },
            ].map((badge, i) => (
              <div
                key={i}
                style={{
                  background: `${badge.color}18`,
                  border: `1px solid ${badge.color}44`,
                  borderRadius: 12,
                  padding: "10px 28px",
                  fontFamily: fontFamily.display,
                  fontSize: 20,
                  fontWeight: 600,
                  color: badge.color,
                }}
              >
                {badge.text}
              </div>
            ))}
          </div>
        </GlassCard>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
