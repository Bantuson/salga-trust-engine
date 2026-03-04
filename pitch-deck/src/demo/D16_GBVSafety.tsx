import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { DemoBackground } from "../components/DemoBackground";
import { SectionTitle } from "../components/SectionTitle";
import { AnimatedText } from "../components/AnimatedText";
import { GlassCard } from "../components/GlassCard";
import { FirewallDiagram } from "../components/FirewallDiagram";
import { BulletList } from "../components/BulletList";
import { colors } from "../design/tokens";
import { fontFamily } from "../design/fonts";

const firewallLayers = [
  { label: "Layer 1: Agent Routing", color: colors.rose.light },
  { label: "Layer 2: Database RLS", color: colors.rose.primary },
  { label: "Layer 3: API Middleware", color: colors.rose.deep },
  { label: "Layer 4: Storage Encryption", color: colors.coral },
  { label: "Layer 5: Public View Filtering", color: "#e53e3e" },
];

const popiaItems = [
  { text: "Consent tracking for all data collection" },
  { text: "Data access request management (SAR)" },
  { text: "Right to deletion enforcement" },
  { text: "Full audit trail on all models" },
  { text: "Data encryption at rest and in transit" },
];

const secMarkers = ["SEC-01", "SEC-02", "SEC-03", "SEC-04", "SEC-05"];

export const D16_GBVSafety: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const badgeEntrance = spring({ frame, fps, delay: 55, config: { damping: 200 } });

  return (
    <AbsoluteFill>
      <DemoBackground />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "50px 80px",
          gap: 24,
        }}
      >
        <SectionTitle number="16" title="Safety & Compliance" color={colors.rose.primary} delay={0} />

        <AnimatedText
          text="GBV Firewall & POPIA Compliance"
          fontSize={38}
          fontFamily={fontFamily.display}
          delay={8}
          textAlign="center"
          color={colors.rose.light}
        />

        <div style={{ display: "flex", gap: 28, flex: 1, alignItems: "stretch" }}>
          {/* Left: Firewall diagram */}
          <GlassCard delay={12} style={{ flex: 1, padding: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div
              style={{
                opacity: badgeEntrance,
                background: "rgba(229,62,62,0.15)",
                border: "1px solid rgba(229,62,62,0.3)",
                borderRadius: 8,
                padding: "6px 16px",
                marginBottom: 16,
              }}
            >
              <span style={{ fontFamily: fontFamily.display, fontSize: 17, fontWeight: 600, color: "#e53e3e", letterSpacing: 1 }}>
                SEC-05 • 5-LAYER DEFENSE
              </span>
            </div>
            <div style={{ width: "100%", maxWidth: 360 }}>
              <FirewallDiagram layers={firewallLayers} delay={18} stagger={7} />
            </div>
          </GlassCard>

          {/* Right: POPIA compliance */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
            <GlassCard delay={20} style={{ padding: 24 }}>
              <div style={{ fontFamily: fontFamily.display, fontSize: 18, fontWeight: 600, color: "#22c55e", marginBottom: 16 }}>
                POPIA Compliance
              </div>
              <BulletList items={popiaItems} delayStart={30} stagger={10} checkColor="#22c55e" fontSize={14} />
            </GlassCard>

            <GlassCard delay={40} style={{ padding: 20 }}>
              <div style={{ fontFamily: fontFamily.display, fontSize: 14, fontWeight: 600, color: colors.text.primary, marginBottom: 12 }}>
                Security Code Markers
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {secMarkers.map((marker, i) => {
                  const entrance = spring({ frame, fps, delay: 50 + i * 6, config: { damping: 200 } });
                  return (
                    <div
                      key={i}
                      style={{
                        background: `${colors.rose.primary}18`,
                        border: `1px solid ${colors.rose.primary}44`,
                        borderRadius: 8,
                        padding: "4px 12px",
                        fontFamily: fontFamily.display,
                        fontSize: 13,
                        fontWeight: 700,
                        color: colors.rose.light,
                        opacity: entrance,
                      }}
                    >
                      {marker}
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
