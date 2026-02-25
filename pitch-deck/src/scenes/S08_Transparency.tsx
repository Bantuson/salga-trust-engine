import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { Background } from "../components/Background";
import { GlassCard } from "../components/GlassCard";
import { AnimatedText } from "../components/AnimatedText";
import { SAMap } from "../components/SAMap";
import { colors } from "../design/tokens";
import { fontFamily } from "../design/fonts";

// Scattered dots representing active municipalities
const heatmapDots = [
  { x: 450, y: 90, delay: 30 },
  { x: 460, y: 100, delay: 33 },
  { x: 520, y: 85, delay: 36 },
  { x: 380, y: 110, delay: 39 },
  { x: 510, y: 200, delay: 42 },
  { x: 270, y: 260, delay: 45 },
  { x: 380, y: 370, delay: 48 },
  { x: 175, y: 400, delay: 51 },
];

export const S08_Transparency: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const subtitleOpacity = spring({
    frame,
    fps,
    delay: 20,
    config: { damping: 200 },
  });

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 36px",
          gap: 28,
        }}
      >
        <AnimatedText
          text="Public Transparency"
          fontSize={48}
          fontFamily={fontFamily.display}
          color={colors.teal}
          delay={0}
        />

        <GlassCard
          elevated
          delay={10}
          style={{
            width: "100%",
            padding: 24,
          }}
        >
          <SAMap
            delay={15}
            markers={heatmapDots.map((dot) => ({
              x: dot.x,
              y: dot.y,
              label: "",
              delay: dot.delay,
            }))}
          />
        </GlassCard>

        <div style={{ opacity: subtitleOpacity }}>
          <GlassCard delay={35} style={{ padding: 24 }}>
            <p
              style={{
                fontFamily: fontFamily.body,
                fontSize: 22,
                color: colors.text.primary,
                textAlign: "center",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Real-time, anonymized performance data.
              <br />
              <span style={{ color: colors.teal }}>
                Citizens see how their municipality performs.
              </span>
            </p>
          </GlassCard>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
