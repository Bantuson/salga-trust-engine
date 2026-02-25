import { AbsoluteFill } from "remotion";
import { Background } from "../components/Background";
import { AnimatedText } from "../components/AnimatedText";
import { FlowDiagram } from "../components/FlowDiagram";
import { colors } from "../design/tokens";
import { fontFamily } from "../design/fonts";

const steps = [
  {
    icon: "💬",
    title: "Citizen Reports",
    subtitle: "Via WhatsApp or Web Portal",
    color: colors.teal,
  },
  {
    icon: "🤖",
    title: "AI Agent Triages",
    subtitle: "Gugu classifies, extracts location, assigns priority",
    color: colors.rose.primary,
  },
  {
    icon: "👷",
    title: "Municipal Team Acts",
    subtitle: "Routed to correct department, SLA tracking begins",
    color: colors.gold,
  },
  {
    icon: "📊",
    title: "Public Dashboard Updates",
    subtitle: "Anonymized, real-time transparency for citizens",
    color: colors.coral,
  },
];

export const S05_HowItWorks: React.FC = () => {
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 40px",
          gap: 32,
        }}
      >
        <AnimatedText
          text="How It Works"
          fontSize={52}
          fontFamily={fontFamily.display}
          color={colors.gold}
          delay={0}
        />

        <FlowDiagram steps={steps} delayStart={15} stagger={22} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
