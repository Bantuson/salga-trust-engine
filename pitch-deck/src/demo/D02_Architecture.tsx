import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { DemoBackground } from "../components/DemoBackground";
import { SectionTitle } from "../components/SectionTitle";
import { ArchitectureFlow } from "../components/ArchitectureFlow";
import { AnimatedText } from "../components/AnimatedText";
import { colors } from "../design/tokens";
import { fontFamily } from "../design/fonts";

const architectureNodes = [
  { icon: "📱", title: "Citizen", subtitle: "WhatsApp & Web Portal", color: colors.teal },
  { icon: "🤖", title: "AI Agent", subtitle: "CrewAI Triage & Route", color: colors.gold },
  { icon: "👥", title: "Municipal Team", subtitle: "Assignment & SLA", color: colors.coral },
  { icon: "📊", title: "Dashboard", subtitle: "Operations & KPIs", color: colors.rose.primary },
  { icon: "🌍", title: "Transparency", subtitle: "Public Performance", color: "#22c55e" },
];

export const D02_Architecture: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const descEntrance = spring({ frame, fps, delay: 90, config: { damping: 200 } });

  return (
    <AbsoluteFill>
      <DemoBackground />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "50px 80px",
          gap: 40,
        }}
      >
        <SectionTitle number="02" title="Platform Architecture" color={colors.teal} delay={0} />

        <AnimatedText
          text="End-to-End Municipal Service Flow"
          fontSize={42}
          fontFamily={fontFamily.display}
          delay={8}
          textAlign="center"
          style={{ marginTop: 20 }}
        />

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ArchitectureFlow nodes={architectureNodes} delay={20} stagger={15} />
        </div>

        <div
          style={{
            opacity: descEntrance,
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: fontFamily.body,
              fontSize: 20,
              color: colors.text.secondary,
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            From citizen report to public transparency — fully automated, AI-driven pipeline
          </p>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
