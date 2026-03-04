import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { DemoBackground } from "../components/DemoBackground";
import { SectionTitle } from "../components/SectionTitle";
import { AnimatedText } from "../components/AnimatedText";
import { GlassCard } from "../components/GlassCard";
import { FeatureGrid } from "../components/FeatureGrid";
import { colors, glass } from "../design/tokens";
import { fontFamily } from "../design/fonts";

const chatMessages = [
  { from: "citizen", text: "Hi, I need to report a water leak", delay: 20 },
  { from: "gugu", text: "Hello! I'm Gugu, your AI assistant. I'll help you report this. Which area is the leak in?", delay: 35 },
  { from: "citizen", text: "Corner of Main and Church Street, Kimberley", delay: 50 },
  { from: "gugu", text: "Got it! I've created ticket #WTR-1247. A field team will be dispatched within 4 hours.", delay: 65 },
];

const reportingFeatures = [
  { icon: "📱", title: "WhatsApp Channel", description: "Report via familiar messaging app", color: "#25D366" },
  { icon: "🌐", title: "Web Portal", description: "Online form with photo upload", color: colors.teal },
  { icon: "🤖", title: "AI Triage", description: "CrewAI categorizes & routes tickets", color: colors.gold },
  { icon: "🎫", title: "Ticket Tracking", description: "Real-time status via WhatsApp", color: colors.coral },
  { icon: "🌍", title: "Trilingual", description: "English, isiZulu, Afrikaans support", color: colors.rose.primary },
  { icon: "📍", title: "Location Aware", description: "GPS coordinates for field dispatch", color: "#3b82f6" },
];

export const D14_CitizenReporting: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

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
        <SectionTitle number="14" title="Citizen Experience" color={colors.teal} delay={0} />

        <AnimatedText
          text="Multi-Channel Citizen Reporting"
          fontSize={40}
          fontFamily={fontFamily.display}
          delay={8}
          textAlign="center"
        />

        <div style={{ display: "flex", gap: 28, flex: 1 }}>
          {/* Left: Chat simulation */}
          <GlassCard delay={12} style={{ flex: 1, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: 22, background: "#25D366", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                📱
              </div>
              <span style={{ fontFamily: fontFamily.display, fontSize: 19, fontWeight: 600, color: "#25D366" }}>
                WhatsApp — Gugu AI
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {chatMessages.map((msg, i) => {
                const entrance = spring({ frame, fps, delay: msg.delay, config: { damping: 200 } });
                const isGugu = msg.from === "gugu";
                return (
                  <div
                    key={i}
                    style={{
                      alignSelf: isGugu ? "flex-start" : "flex-end",
                      maxWidth: "85%",
                      background: isGugu ? "rgba(0,191,165,0.12)" : "rgba(255,255,255,0.08)",
                      border: `1px solid ${isGugu ? `${colors.teal}33` : "rgba(255,255,255,0.12)"}`,
                      borderRadius: isGugu ? "16px 16px 16px 4px" : "16px 16px 4px 16px",
                      padding: "14px 20px",
                      opacity: entrance,
                      transform: `translateY(${interpolate(entrance, [0, 1], [10, 0])}px)`,
                    }}
                  >
                    <span style={{ fontFamily: fontFamily.body, fontSize: 16, color: colors.text.primary, lineHeight: 1.4 }}>
                      {msg.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* Right: Features */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <FeatureGrid items={reportingFeatures} columns={2} delay={30} stagger={8} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
