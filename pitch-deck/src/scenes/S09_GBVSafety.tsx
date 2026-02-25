import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { Background } from "../components/Background";
import { GlassCard } from "../components/GlassCard";
import { AnimatedText } from "../components/AnimatedText";
import { FirewallDiagram } from "../components/FirewallDiagram";
import { colors } from "../design/tokens";
import { fontFamily } from "../design/fonts";

const firewallLayers = [
  { label: "Layer 1: Agent Routing", color: colors.rose.light },
  { label: "Layer 2: Database RLS", color: colors.rose.primary },
  { label: "Layer 3: API Middleware", color: colors.rose.deep },
  { label: "Layer 4: Storage Encryption", color: colors.coral },
  { label: "Layer 5: Public View Filtering", color: "#e53e3e" },
];

export const S09_GBVSafety: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const badgeEntrance = spring({
    frame,
    fps,
    delay: 55,
    config: { damping: 200 },
  });

  const footerEntrance = spring({
    frame,
    fps,
    delay: 65,
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
          gap: 20,
        }}
      >
        <AnimatedText
          text="GBV Safety Firewall"
          fontSize={44}
          fontFamily={fontFamily.display}
          color={colors.rose.light}
          delay={0}
        />

        {/* SEC-05 badge */}
        <div
          style={{
            opacity: badgeEntrance,
            background: "rgba(229,62,62,0.15)",
            border: "1px solid rgba(229,62,62,0.3)",
            borderRadius: 8,
            padding: "6px 16px",
          }}
        >
          <span
            style={{
              fontFamily: fontFamily.display,
              fontSize: 16,
              fontWeight: 600,
              color: "#e53e3e",
              letterSpacing: 1,
            }}
          >
            SEC-05 • 5-LAYER DEFENSE
          </span>
        </div>

        <GlassCard
          delay={8}
          style={{
            width: "100%",
            padding: 20,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <FirewallDiagram
            layers={firewallLayers}
            delay={12}
            stagger={7}
          />
        </GlassCard>

        <div style={{ opacity: footerEntrance }}>
          <p
            style={{
              fontFamily: fontFamily.body,
              fontSize: 18,
              color: colors.text.secondary,
              textAlign: "center",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            GBV reports are encrypted and visible only to
            <br />
            <span style={{ color: colors.rose.light, fontWeight: 600 }}>
              SAPS Liaison Officers & System Admins
            </span>
          </p>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
