import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { Background } from "../components/Background";
import { GlassCard } from "../components/GlassCard";
import { AnimatedText } from "../components/AnimatedText";
import { SAMap } from "../components/SAMap";
import { colors } from "../design/tokens";
import { fontFamily } from "../design/fonts";

const pilotMunicipalities = [
  { x: 260, y: 220, label: "Sol Plaatje (Kimberley)", delay: 35 },
  { x: 200, y: 280, label: "Dawid Kruiper (Upington)", delay: 50 },
  { x: 320, y: 300, label: "Emthanjeni (De Aar)", delay: 65 },
];

export const S10_NorthernCape: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const subtext = spring({
    frame,
    fps,
    delay: 75,
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
          text="Northern Cape Pilot"
          fontSize={48}
          fontFamily={fontFamily.display}
          color={colors.rose.light}
          delay={0}
        />

        <GlassCard
          elevated
          delay={8}
          style={{ width: "100%", padding: 24 }}
        >
          <SAMap
            highlightProvince="NC"
            highlightColor={colors.rose.primary}
            markers={pilotMunicipalities}
            delay={12}
          />
        </GlassCard>

        <div style={{ opacity: subtext }}>
          <GlassCard delay={70} style={{ padding: 24 }}>
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
              <span style={{ color: colors.gold, fontWeight: 600 }}>3 municipalities</span>
              {" "}selected for diversity of size,
              <br />
              infrastructure, and service challenges.
            </p>
          </GlassCard>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
