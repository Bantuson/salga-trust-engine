import { AbsoluteFill } from "remotion";
import { Background } from "../components/Background";
import { GlassCard } from "../components/GlassCard";
import { AnimatedText } from "../components/AnimatedText";
import { BulletList } from "../components/BulletList";
import { colors } from "../design/tokens";
import { fontFamily } from "../design/fonts";

const reasons = [
  { text: "Tailor workflows to actual municipal needs through co-design" },
  { text: "Perfect the AI system at manageable scale before rollout" },
  { text: "Prove measurable impact before nationwide deployment to 257 municipalities" },
];

export const S11_WhyPilot: React.FC = () => {
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
          gap: 36,
        }}
      >
        <AnimatedText
          text="Why Pilot First?"
          fontSize={52}
          fontFamily={fontFamily.display}
          color={colors.gold}
          delay={0}
        />

        <GlassCard
          elevated
          delay={10}
          style={{ width: "100%", padding: 36 }}
        >
          <BulletList
            items={reasons}
            delayStart={20}
            stagger={18}
            checkColor={colors.teal}
            fontSize={24}
          />
        </GlassCard>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
