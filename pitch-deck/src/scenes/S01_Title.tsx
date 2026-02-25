import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { Background } from "../components/Background";
import { GlassCard } from "../components/GlassCard";
import { colors } from "../design/tokens";
import { fontFamily } from "../design/fonts";

const TITLE_WORDS = ["SALGA", "Trust", "Engine"];

export const S01_Title: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const subtitleOpacity = spring({
    frame,
    fps,
    delay: 30,
    config: { damping: 200 },
  });

  const pilotOpacity = spring({
    frame,
    fps,
    delay: 50,
    config: { damping: 200 },
  });

  const pilotY = interpolate(pilotOpacity, [0, 1], [20, 0]);

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
            gap: 24,
            padding: 48,
          }}
        >
          {/* Gold-to-teal gradient title with word-by-word animation */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 72 * 0.25,
              lineHeight: 1.2,
            }}
          >
            {TITLE_WORDS.map((word, i) => {
              const wordSpring = spring({
                frame,
                fps,
                delay: 8 + i * 5,
                config: { damping: 200 },
              });
              const translateY = interpolate(wordSpring, [0, 1], [30, 0]);

              return (
                <span
                  key={i}
                  style={{
                    fontFamily: fontFamily.display,
                    fontSize: 72,
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

          <div style={{ opacity: subtitleOpacity }}>
            <p
              style={{
                fontFamily: fontFamily.body,
                fontSize: 28,
                color: colors.text.secondary,
                textAlign: "center",
                lineHeight: 1.4,
                margin: 0,
              }}
            >
              AI-Powered Municipal
              <br />
              Service Management
            </p>
          </div>

          <div
            style={{
              opacity: pilotOpacity,
              transform: `translateY(${pilotY}px)`,
              marginTop: 16,
            }}
          >
            <div
              style={{
                background: `linear-gradient(135deg, rgba(255,213,79,0.2), rgba(255,213,79,0.05))`,
                border: `1px solid rgba(255,213,79,0.3)`,
                borderRadius: 16,
                padding: "12px 32px",
              }}
            >
              <span
                style={{
                  fontFamily: fontFamily.display,
                  fontSize: 24,
                  fontWeight: 600,
                  color: colors.gold,
                }}
              >
                Pilot Proposal — Northern Cape
              </span>
            </div>
          </div>
        </GlassCard>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
