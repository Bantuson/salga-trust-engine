import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { Background } from "../components/Background";
import { GlassCard } from "../components/GlassCard";
import { StatCounter } from "../components/StatCounter";
import { AnimatedText } from "../components/AnimatedText";
import { colors } from "../design/tokens";
import { fontFamily } from "../design/fonts";

const stats = [
  {
    value: 100,
    prefix: "R",
    suffix: "B+",
    label: "Municipal Consumer Debt",
    color: colors.gold,
    delay: 15,
  },
  {
    value: 27,
    prefix: "",
    suffix: "/257",
    label: "Clean Audit Outcomes",
    color: colors.coral,
    delay: 35,
  },
  {
    value: 1.02,
    prefix: "R",
    suffix: "B",
    label: "Spent on Consultants (2023)",
    color: colors.teal,
    delay: 55,
    decimals: 2,
  },
];

export const S02_Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = spring({
    frame,
    fps,
    delay: 0,
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
          padding: 48,
          gap: 40,
        }}
      >
        <div style={{ opacity: headerOpacity }}>
          <AnimatedText
            text="The Crisis"
            fontSize={56}
            fontFamily={fontFamily.display}
            color={colors.coral}
            delay={0}
          />
        </div>

        {stats.map((stat, i) => (
          <GlassCard
            key={i}
            delay={stat.delay}
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: 32,
            }}
          >
            <StatCounter
              value={stat.value}
              prefix={stat.prefix}
              suffix={stat.suffix}
              label={stat.label}
              color={stat.color}
              delay={stat.delay + 5}
              decimals={stat.decimals ?? 0}
            />
          </GlassCard>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
